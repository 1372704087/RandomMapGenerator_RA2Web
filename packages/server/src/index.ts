/**
 * 红警2随机地图生成器 - Node.js 后端 API
 *
 * Express 服务器，提供以下接口：
 *   GET  /api/health             - 健康检查
 *   GET  /api/theaters           - 返回可用 theater 列表
 *   GET  /api/theaters/:name/info - 返回单个 theater 的详细信息
 *   POST /api/generate           - 生成地图，返回 .yrm 文件
 *   POST /api/split              - 把完整地图拆解成若干 .map 切片（默认自动识别 theater）
 *   POST /api/split/detect       - 只识别地图的 theater，不拆解
 *   POST /api/split/spawns       - 只切出生点（每个 Waypoint 一个居中 spawn 单元）
 *   POST /api/preview            - 地图雷达预览（RGB，支持批量）
 *
 * 服务器启动时加载所有资源到内存（loadAllResources）。
 */

import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import {
  loadAllResources,
  getTheaterInfoList,
  getTheaterResources,
  getGlobalResources,
} from './resourceLoader';
import { generateMap } from './generator';
import { splitFullMap, splitSpawnUnitsForTheater, detectTheater, buildTheaterWarnings } from './splitter';
import {
  renderMapPreview,
  Random,
  TimeOfDay,
  getLightingPreset,
  getLightingForHour,
  LIGHTING_ENVIRONMENTS,
  LIGHTING_HOURS,
  HOUR_LABELS,
  LIGHTING_ENVIRONMENT_LABELS,
  TIME_OF_DAY_LABELS,
} from '@ra2/core';
import { generateRmgCxx } from './rmgCxxService';
import { renderCncmapsPreview } from './cncmapsPreview';
import { putMap, getMap } from './mapHandoff';
import { GenerateOptions, LightingRequest, IonStormRequest, DayNightRequest } from './types';

// ---------------------------------------------------------------------------
// 服务器配置
// ---------------------------------------------------------------------------

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ---------------------------------------------------------------------------
// 创建 Express 应用
// ---------------------------------------------------------------------------

const app: Application = express();

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 请求日志
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ---------------------------------------------------------------------------
// API 路由
// ---------------------------------------------------------------------------

/**
 * GET /api/health
 * 健康检查
 */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /api/theaters
 * 返回所有可用 theater 的列表
 */
app.get('/api/theaters', (_req: Request, res: Response) => {
  const theaters = getTheaterInfoList();
  res.json({
    count: theaters.length,
    theaters,
  });
});

/**
 * GET /api/lighting/presets
 *
 * 返回环境光照预设表（4 个时段 × 5 个环境主题），前端用它在「环境光照」
 * 面板里画色卡预览、并提示可选值，避免前后端各写一份常量。
 */
app.get('/api/lighting/presets', (_req: Request, res: Response) => {
  const environments = LIGHTING_ENVIRONMENTS.map((env) => ({
    id: env,
    label: LIGHTING_ENVIRONMENT_LABELS[env],
    presets: ([0, 1, 2, 3] as TimeOfDay[]).map((tod) => ({
      timeOfDay: tod,
      label: TIME_OF_DAY_LABELS[tod],
      values: getLightingPreset(env, tod),
    })),
    // 24 个整点的插值结果，前端用它画每小时的色卡
    hourly: LIGHTING_HOURS.map((hour) => ({
      hour,
      label: HOUR_LABELS[hour],
      values: getLightingForHour(env, hour),
    })),
  }));
  res.json({
    timeOfDay: ([0, 1, 2, 3] as TimeOfDay[]).map((tod) => ({
      value: tod,
      label: TIME_OF_DAY_LABELS[tod],
    })),
    hours: LIGHTING_HOURS.map((hour) => ({ value: hour, label: HOUR_LABELS[hour] })),
    environments,
    modes: [
      { value: 'auto', label: '跟随原版（沙漠随机 / 其余不写光照）' },
      { value: 'preset', label: '固定预设（按时段+环境写死）' },
      { value: 'random', label: '预设 + 随机抖动（受种子约束）' },
      { value: 'custom', label: '自定义通道值' },
    ],
  });
});

/**
 * GET /api/theaters/:name/info
 * 返回指定 theater 的详细信息
 */
app.get(
  '/api/theaters/:name/info',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const name = req.params.name;
      const theater = getTheaterResources(name);
      if (!theater) {
        res.status(404).json({
          error: `Theater "${name}" not found`,
          available: getTheaterInfoList().map((t) => t.name),
        });
        return;
      }
      res.json({
        name: theater.name,
        theater: theater.theaterEnum,
        mapUnitSize: theater.mapUnitSize,
        topCorner: theater.topCorner,
        bottomSpace: theater.bottomSpace,
        hasLighting: theater.lightingSettings !== null,
        lightingSettings: theater.lightingSettings,
        hasAdditionIni: theater.additionIniContent !== null,
        hasCannotPlaceSmudge: theater.hasCannotPlaceSmudge,
        sizeConfig: theater.sizeConfig,
        playerAdditions: theater.playerAdditions,
        mapUnitCount: theater.mapUnitCount,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/generate
 * 生成地图
 *
 * 请求体: GenerateOptions JSON
 * 响应: Content-Type: application/octet-stream
 *        Content-Disposition: attachment; filename="xxx.yrm"
 */
app.post(
  '/api/generate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const options = req.body as GenerateOptions;

      // 参数校验
      const validationError = validateGenerateOptions(options);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      // 生成地图
      // 种子：调用方没给就现摇一个，再原样回给调用方（X-Map-Seed），方便复现同一张图
      if (options.seed === undefined) {
        options.seed = new Random().Seed;
      }
      const result = await generateMap(options);

      // 设置响应头，返回文件
      const encodedFileName = encodeURIComponent(result.fileName);
      res.setHeader(
        'Content-Type',
        'application/octet-stream',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
      );
      res.setHeader('Content-Length', Buffer.byteLength(result.mapContent, 'utf-8'));
      // 预览时凭这个 key 取回原文，省掉前端再上传一次几 MB 的地图文本
      res.setHeader('X-Map-Key', putMap(result.mapContent));
      res.setHeader('X-Map-Seed', String(options.seed));
      if (result.lighting) {
        // 环境光照结果回显（JSON，键为 [Lighting] 里的键名），前端可显示当前天色
        res.setHeader('X-Map-Lighting', JSON.stringify(result.lighting.values));
      }
      if (result.ionStorm) {
        // 离子风暴回显：间隔、风暴中心格、实际使用的 event/action
        res.setHeader(
          'X-Map-IonStorm',
          JSON.stringify({
            intervalSeconds: result.ionStorm.intervalSeconds,
            randomize: result.ionStorm.randomize,
            siteCount: result.ionStorm.siteCount,
            sites: result.ionStorm.sites.map((s) => ({
              w: s.waypoint,
              x: s.cell.x,
              y: s.cell.y,
            })),
            cell: result.ionStorm.cell,
            eventId: result.ionStorm.eventId,
          }),
        );
      }
      if (result.dayNight) {
        // 昼夜交替回显：一轮时长、各档钟点与时长、实际用到的事件/动作
        res.setHeader(
          'X-Map-DayNight',
          JSON.stringify({
            cycleSeconds: result.dayNight.cycleSeconds,
            environment: result.dayNight.environment,
            stages: result.dayNight.stages.map((s) => ({
              hour: s.hour,
              seconds: s.seconds,
              ambientPercent: s.ambientPercent,
            })),
            eventId: result.dayNight.eventId,
            actions: result.dayNight.actions,
            cells: result.dayNight.cellTags.map((c) => c.key),
          }),
        );
      }
      res.setHeader(
        'Access-Control-Expose-Headers',
        'X-Map-Key, X-Map-Seed, X-Map-Lighting, X-Map-IonStorm, X-Map-DayNight, Content-Disposition',
      );

      res.send(result.mapContent);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/split/detect
 * 只做识别、不拆解：从地图文本里读出 `[Map] Theater` 并解析到本仓库的 theater 目录。
 *
 * 请求体: { "mapContent": "<完整地图 INI 文本>" }
 * 响应:   { engineTheater, dir, candidates, ambiguous, exactNameMatch, mapUnitSize, available, hasMapSection }
 */
app.post('/api/split/detect', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mapContent } = req.body as { mapContent?: string };
    if (!mapContent || typeof mapContent !== 'string' || mapContent.trim().length === 0) {
      res.status(400).json({ error: 'mapContent is required and must be a non-empty string' });
      return;
    }
    res.json(detectTheater(mapContent));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/split
 * 把一张完整地图拆解成若干 `.map` 切片。
 *
 * 请求体:
 *   {
 *     "mapContent": "<完整地图 INI 文本>",
 *     "autoTheater": true,        // 可选，默认 true：按地图自身的 [Map] Theater 切
 *     "theaterType": "TEMPERATE", // autoTheater=false 时必填（手动指定）
 *     "skipEmpty": true,          // 可选，默认 true，是否跳过内部为空的地块
 *     "skipPartial": false,       // 可选，默认 false：跳过功能窗口内缺源地形、
 *                                 // 会被编辑器自动补清地的边缘切片（网页层默认开启）
 *     "frame": true               // 可选，默认 true：画窗外框
 *   }
 *
 * 切片必须按源地图自己的 theater 参数（MapUnitSize / TopCorner / indicator）进行，
 * 手动选错会切出错位的地形，因此默认走自动识别。
 *
 * 响应: JSON
 *   {
 *     "theater": "TEMPERATE",        // 生效 theater 的引擎名
 *     "theaterDir": "TEMPERATE",     // 实际使用的资源目录
 *     "detectedTheater": "TEMPERATE",// 从地图里读到的引擎名
 *     "detectedTheaterDir": "TEMPERATE",
 *     "theaterSource": "auto" | "manual",
 *     "detection": { candidates, ambiguous, exactNameMatch, available, hasMapSection },
 *     "warnings": ["..."],
 *     "unitSize": "15x15",
 *     "count": 16,
 *     "slices": [ { "name": "split_0_0", "gridX": 0, "gridY": 0, "content": "..." }, ... ]
 *   }
 */
app.post(
  '/api/split',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { theaterType, mapContent, skipEmpty, skipPartial, autoTheater, frame } = req.body as {
        theaterType?: string;
        mapContent?: string;
        skipEmpty?: boolean;
        skipPartial?: boolean;
        autoTheater?: boolean;
        frame?: boolean;
      };

      if (!mapContent || typeof mapContent !== 'string' || mapContent.trim().length === 0) {
        res.status(400).json({ error: 'mapContent is required and must be a non-empty string' });
        return;
      }

      const auto = autoTheater !== false; // 默认自动识别
      const detection = detectTheater(mapContent);

      let effectiveDir: string | null = null;
      let source: 'auto' | 'manual';
      if (auto && detection.dir) {
        effectiveDir = detection.dir;
        source = 'auto';
      } else if (typeof theaterType === 'string' && theaterType.length > 0) {
        effectiveDir = theaterType;
        source = 'manual';
      } else {
        res.status(400).json({
          error:
            detection.engineTheater
              ? `地图的 Theater=${detection.engineTheater} 在本仓库没有对应地形目录` +
                `（可用：${detection.available.join(' / ')}），请手动指定 theaterType。`
              : '无法从地图内容识别地图类型，请提供 theaterType。',
          available: detection.available,
        });
        return;
      }

      const theater = getTheaterResources(effectiveDir);
      if (!theater) {
        const available = getTheaterInfoList().map((t) => t.name);
        res.status(404).json({
          error: `Theater "${effectiveDir}" not found`,
          available,
        });
        return;
      }

      // frame 默认开启：按 empty.map 补齐功能窗口外的框体/底色（纯视觉）；
      // 显式传 frame=false 可关闭。边缘不完整切片保留原版格子，由预览端裁边。
      const effectiveFrame = frame !== false;
      const effectiveSkipPartial = skipPartial === true;
      const slices = splitFullMap(effectiveDir, mapContent, {
        skipEmpty: skipEmpty ?? true,
        skipPartial: effectiveSkipPartial,
        frame: effectiveFrame,
      });

      res.json({
        theater: theater.theaterEnum,
        theaterDir: effectiveDir,
        frame: effectiveFrame,
        skipPartial: effectiveSkipPartial,
        detectedTheater: detection.engineTheater,
        detectedTheaterDir: detection.dir,
        theaterSource: source,
        detection: {
          candidates: detection.candidates,
          ambiguous: detection.ambiguous,
          exactNameMatch: detection.exactNameMatch,
          hasMapSection: detection.hasMapSection,
          available: detection.available,
        },
        warnings: buildTheaterWarnings(detection, effectiveDir, source),
        unitSize: theater.mapUnitSize,
        count: slices.length,
        slices,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/split/spawns
 * 只切出生点：以源图每个 Waypoint 为中心切一个单元，每张只带一个出生点。
 *
 * 请求体: { mapContent, autoTheater?, theaterType? }
 * 响应: { theater, theaterDir, theaterSource, unitSize, count, spawns: [
 *   { name, content, x, y, partial } ] }
 */
app.post(
  '/api/split/spawns',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { theaterType, mapContent, autoTheater } = req.body as {
        theaterType?: string;
        mapContent?: string;
        autoTheater?: boolean;
      };

      if (!mapContent || typeof mapContent !== 'string' || mapContent.trim().length === 0) {
        res.status(400).json({ error: 'mapContent is required and must be a non-empty string' });
        return;
      }

      const auto = autoTheater !== false;
      const detection = detectTheater(mapContent);

      let effectiveDir: string | null = null;
      let source: 'auto' | 'manual';
      if (auto && detection.dir) {
        effectiveDir = detection.dir;
        source = 'auto';
      } else if (typeof theaterType === 'string' && theaterType.length > 0) {
        effectiveDir = theaterType;
        source = 'manual';
      } else {
        res.status(400).json({
          error:
            detection.engineTheater
              ? `地图的 Theater=${detection.engineTheater} 在本仓库没有对应地形目录` +
                `（可用：${detection.available.join(' / ')}），请手动指定 theaterType。`
              : '无法从地图内容识别地图类型，请提供 theaterType。',
          available: detection.available,
        });
        return;
      }

      const theater = getTheaterResources(effectiveDir);
      if (!theater) {
        const available = getTheaterInfoList().map((t) => t.name);
        res.status(404).json({
          error: `Theater "${effectiveDir}" not found`,
          available,
        });
        return;
      }

      const spawns = splitSpawnUnitsForTheater(effectiveDir, mapContent);

      res.json({
        theater: theater.theaterEnum,
        theaterDir: effectiveDir,
        theaterSource: source,
        detectedTheater: detection.engineTheater,
        detectedTheaterDir: detection.dir,
        warnings: buildTheaterWarnings(detection, effectiveDir, source),
        unitSize: theater.mapUnitSize,
        count: spawns.length,
        spawns,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/rmg/cxx/generate
 * 请求体: { globalSeed, environment?, timeOfDay?, theater?, mapSize?,
 *          oreDensity?, playerIndex?, gameType?, name? }
 * 响应:   { mapContent, fileName, width, height, waterAmount, cellCount,
 *          elapsedMs, globalSeed, options }
 *
 * 跑的是 `core/src/rmg/cxx/`（vera20k 逐函数平移的 gamemd 管线）：
 * 16 个 MAPSEEDCLASS 字段由 globalSeed 摇出，`options` 里原样回给前端展示。
 */
app.post('/api/rmg/cxx/generate', (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = generateRmgCxx(req.body as Parameters<typeof generateRmgCxx>[0]);
    // 预览用 key 取原文，前端不必把几 MB 的地图再传一遍
    res.json({ ...result, mapKey: putMap(result.mapContent) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/preview
 * 地图雷达预览：minimap.ini 配色 + 覆盖物/地形/建筑覆盖 + 高度明暗，
 * 投影与 FA2 小地图一致（一格一像素）。支持批量（一次把全部切片渲染完）。
 *
 * 请求体: { "contents": ["<地图 INI 文本>", ...] }（1..300 个）
 * 响应:   { "items": [ { "width", "height", "rgb": <base64 RGB> }, ... ] }
 */
app.post('/api/preview', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contents, cropEmpty, transparentEmpty, mapUnitWindow } = req.body as {
      contents?: unknown;
      cropEmpty?: unknown;
      transparentEmpty?: unknown;
      mapUnitWindow?: unknown;
    };
    if (
      !Array.isArray(contents) ||
      contents.length === 0 ||
      contents.length > 300 ||
      contents.some((c) => typeof c !== 'string')
    ) {
      res.status(400).json({ error: 'contents is required: string[] with 1..300 items' });
      return;
    }
    const minimapContent = getGlobalResources().minimapContent;
    const items = contents.map((c) => {
      const theater = detectTheater(c).engineTheater;
      const p = renderMapPreview(c, minimapContent, theater, {
        cropEmpty: cropEmpty === true,
        transparentEmpty: transparentEmpty === true,
        mapUnitWindow: mapUnitWindow === true || cropEmpty === true,
      });
      return {
        width: p.width,
        height: p.height,
        rgb: Buffer.from(p.rgb).toString('base64'),
        ...(p.alpha ? { alpha: Buffer.from(p.alpha).toString('base64') } : {}),
      };
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/cncmaps-preview
 * 用 cncmaps-ts 渲染生成地图的缩略预览。
 *
 * 请求体: { mapKey?: string, mapContent?: string, name?: string, width?: number }
 *   mapKey 由生成接口（/api/generate 的 X-Map-Key 头、/api/rmg/cxx/generate 的字段）给出，
 *   有 key 就优先用，避免前端重传整张地图。
 * 响应: image/png（默认 1600px 宽）；画布超过 CNCMAPS_MAX_PIXELS 时回 413，
 *       前端应退回雷达预览。
 *
 * 依赖 cncmaps Web 服务（默认 http://127.0.0.1:5174），可用 CNCMAPS_WEB_URL 覆盖。
 */
app.post('/api/cncmaps-preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mapKey, mapContent, name, width } = req.body as {
      mapKey?: unknown;
      mapContent?: unknown;
      name?: unknown;
      width?: unknown;
    };
    let content: string | null = null;
    if (typeof mapKey === 'string' && mapKey.trim()) {
      content = getMap(mapKey.trim());
    }
    if (!content && typeof mapContent === 'string' && mapContent.trim().length > 0) {
      content = mapContent;
    }
    if (!content) {
      res.status(400).json({
        error:
          'mapKey 已失效（服务可能重启过），请传 mapContent 或重新生成地图',
      });
      return;
    }
    const previewWidth = typeof width === 'number' && Number.isFinite(width) ? width : 1600;
    const png = await renderCncmapsPreview(
      content,
      typeof name === 'string' && name.trim() ? name.trim() : 'Random Map',
      previewWidth,
    );
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', png.length);
    res.setHeader('Cache-Control', 'no-store');
    res.send(png);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// 静态文件服务（可选，用于前端托管）
// ---------------------------------------------------------------------------

// 如果前端构建产物存在，则提供静态文件服务
const webDistPath = path.join(__dirname, '..', '..', 'web', 'dist');
// 使用 fs.existsSync 检查，避免目录不存在时报错
if (fs.existsSync(webDistPath)) {
  // HTML 不缓存：前端重建后浏览器必须拉新包（旧包的表单提交路径会导航跳页）
  app.use(express.static(webDistPath, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  }));
  console.log(`[server] Serving static files from: ${webDistPath}`);
}

// ---------------------------------------------------------------------------
// 错误处理
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const maybeStatus = (err as unknown as { statusCode?: unknown }).statusCode;
  const status = typeof maybeStatus === 'number' ? maybeStatus : 500;
  if (status >= 500) {
    console.error('[server] Unhandled error:', err);
  } else {
    console.warn(`[server] Request rejected: ${err.message}`);
  }
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

// ---------------------------------------------------------------------------
// 参数校验
// ---------------------------------------------------------------------------

/**
 * 校验生成请求参数。
 * 返回错误消息字符串，无错误时返回 null。
 */
function validateGenerateOptions(options: GenerateOptions): string | null {
  if (!options) {
    return 'Request body is required';
  }

  if (!options.theaterType || typeof options.theaterType !== 'string') {
    return 'theaterType is required and must be a string';
  }

  // 检查 theater 是否存在
  const theater = getTheaterResources(options.theaterType);
  if (!theater) {
    const available = getTheaterInfoList().map((t) => t.name);
    return `Unknown theaterType: "${options.theaterType}". Available: ${available.join(', ')}`;
  }

  const vera20k = options.vera20k === true;
  const width = options.width ?? 0;
  const height = options.height ?? 0;
  if (vera20k) {
    if (options.totalRandom) {
      return 'VERA20k mode requires explicit width/height and playerLocations (totalRandom is not supported)';
    }
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      return 'VERA20k mode requires positive integer width and height';
    }
    if (width > 512 || height > 512 || width + height > 1024) {
      return `VERA20k size limit is each side <= 512 and width+height <= 1024; got ${width}x${height}`;
    }
  }

  // width/height 可以是 0（表示随机），但如果是非零值必须为正整数
  if (
    options.width !== undefined &&
    options.width !== 0 &&
    (!Number.isInteger(options.width) || options.width < 0)
  ) {
    return 'width must be a non-negative integer (0 for random)';
  }
  if (
    options.height !== undefined &&
    options.height !== 0 &&
    (!Number.isInteger(options.height) || options.height < 0)
  ) {
    return 'height must be a non-negative integer (0 for random)';
  }

  // 种子：可选，必须是 31 位非负整数（内部 RNG 状态就是 31 位）
  if (options.seed !== undefined) {
    if (
      typeof options.seed !== 'number' ||
      !Number.isInteger(options.seed) ||
      options.seed < 0 ||
      options.seed > 0x7fffffff
    ) {
      return 'seed must be an integer in 0..2147483647';
    }
  }

  // 环境光照：可选，给了就得是合法组合
  const lightingError = validateLightingRequest(options.lighting);
  if (lightingError) {
    return lightingError;
  }

  // 随机离子风暴：可选，给了就得是合法组合
  const ionStormError = validateIonStormRequest(options.ionStorm);
  if (ionStormError) {
    return ionStormError;
  }

  // 昼夜交替：可选，给了就得是合法组合
  const dayNightError = validateDayNightRequest(options.dayNight);
  if (dayNightError) {
    return dayNightError;
  }

  // totalRandom 模式下不需要 playerLocations
  if (!options.totalRandom) {
    if (!options.playerLocations || typeof options.playerLocations !== 'object') {
      return 'playerLocations is required and must be an object (or set totalRandom=true)';
    }

    const validDirections = ['N', 'S', 'W', 'E', 'NE', 'SE', 'NW', 'SW'];
    let totalPlayers = 0;
    for (const [dir, count] of Object.entries(options.playerLocations)) {
      if (!validDirections.includes(dir)) {
        return `Invalid player location direction: "${dir}". Valid: ${validDirections.join(', ')}`;
      }
      if (
        count !== undefined &&
        count !== null &&
        (!Number.isInteger(count) || count < 0)
      ) {
        return `playerLocations.${dir} must be a non-negative integer`;
      }
      if (
        vera20k &&
        ['N', 'S', 'W', 'E'].includes(dir) &&
        typeof count === 'number' &&
        count > 4
      ) {
        return `VERA20k: playerLocations.${dir} must be at most 4 (cardinal placement pattern)`;
      }
      totalPlayers += count ?? 0;
    }

    const maxPlayers = vera20k ? 30 : 8;
    if (totalPlayers > maxPlayers) {
      return `Total player count (${totalPlayers}) must not exceed ${maxPlayers}`;
    }
  }

  // 检查建筑损坏设置
  if (options.damagedBuilding && typeof options.damagedBuilding === 'object') {
    const db = options.damagedBuilding;
    if (
      !Number.isInteger(db.min) ||
      db.min < 0 ||
      db.min > 256
    ) {
      return 'damagedBuilding.min must be an integer between 0 and 256';
    }
    if (
      !Number.isInteger(db.max) ||
      db.max < 0 ||
      db.max > 256
    ) {
      return 'damagedBuilding.max must be an integer between 0 and 256';
    }
    if (db.min > db.max) {
      return 'damagedBuilding.min must not be greater than damagedBuilding.max';
    }
    if (
      !Number.isFinite(db.destroyP) ||
      db.destroyP < 0 ||
      db.destroyP > 100
    ) {
      return 'damagedBuilding.destroyP must be a number between 0 and 100';
    }
  }

  // 检查污迹密度
  if (options.smudge !== undefined && options.smudge !== null) {
    if (
      typeof options.smudge !== 'number' ||
      options.smudge < 0 ||
      options.smudge > 0.5
    ) {
      return 'smudge must be a number between 0 and 0.5';
    }
  }

  return null;
}

/** 校验 `lighting` 参数（模式、时段、主题、通道值、抖动幅度）。 */
function validateLightingRequest(lighting: LightingRequest | undefined): string | null {
  if (lighting === undefined || lighting === null) {
    return null;
  }
  if (typeof lighting !== 'object' || Array.isArray(lighting)) {
    return 'lighting must be an object';
  }

  const modes = ['auto', 'preset', 'random', 'custom'];
  if (lighting.mode !== undefined && !modes.includes(lighting.mode)) {
    return `lighting.mode must be one of ${modes.join(', ')}`;
  }

  if (lighting.timeOfDay !== undefined) {
    if (
      !Number.isInteger(lighting.timeOfDay) ||
      lighting.timeOfDay < 0 ||
      lighting.timeOfDay > 3
    ) {
      return 'lighting.timeOfDay must be an integer in 0..3';
    }
  }

  const environments = ['temperate', 'snow', 'desert', 'newurban', 'islands'];
  if (lighting.environment !== undefined && !environments.includes(lighting.environment)) {
    return `lighting.environment must be one of ${environments.join(', ')}`;
  }

  if (lighting.hour !== undefined) {
    if (!Number.isInteger(lighting.hour) || lighting.hour < 0 || lighting.hour > 23) {
      return 'lighting.hour must be an integer in 0..23';
    }
  }

  if (lighting.jitter !== undefined) {
    if (
      typeof lighting.jitter !== 'number' ||
      !Number.isFinite(lighting.jitter) ||
      lighting.jitter < 0 ||
      lighting.jitter > 0.5
    ) {
      return 'lighting.jitter must be a number between 0 and 0.5';
    }
  }

  const valueKeys = [
    'Ambient',
    'Red',
    'Green',
    'Blue',
    'Level',
    'IonAmbient',
    'IonRed',
    'IonGreen',
    'IonBlue',
    'IonLevel',
  ] as const;
  if (lighting.values !== undefined) {
    if (typeof lighting.values !== 'object' || Array.isArray(lighting.values)) {
      return 'lighting.values must be an object';
    }
    for (const key of Object.keys(lighting.values)) {
      if (!valueKeys.includes(key as (typeof valueKeys)[number])) {
        return `lighting.values.${key} is not a known channel (${valueKeys.join(', ')})`;
      }
      const v = (lighting.values as Record<string, unknown>)[key];
      // Level 的量级和颜色通道不同：原版 0.03，夜景脚本 0.001~0.003
      const isLevel = key === 'Level' || key === 'IonLevel';
      const min = isLevel ? 0.001 : 0.03;
      const max = isLevel ? 0.2 : 1.6;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
        return `lighting.values.${key} must be a number between ${min} and ${max}`;
      }
    }
  }

  return null;
}

/**
 * 校验随机离子风暴参数。
 *
 * 只有 `enabled:true` 时才写任何东西，其余字段都可以省（间隔默认 600 秒、
 * 数值默认原版）。数值范围按帧/伤害量级给宽松上限，防止写出离谱的值。
 */
function validateIonStormRequest(ionStorm: IonStormRequest | undefined): string | null {
  if (ionStorm === undefined || ionStorm === null) {
    return null;
  }
  if (typeof ionStorm !== 'object' || Array.isArray(ionStorm)) {
    return 'ionStorm must be an object';
  }

  if (ionStorm.enabled !== undefined && typeof ionStorm.enabled !== 'boolean') {
    return 'ionStorm.enabled must be a boolean';
  }

  if (ionStorm.intervalSeconds !== undefined) {
    if (
      typeof ionStorm.intervalSeconds !== 'number' ||
      !Number.isInteger(ionStorm.intervalSeconds) ||
      ionStorm.intervalSeconds < 30 ||
      ionStorm.intervalSeconds > 3600
    ) {
      return 'ionStorm.intervalSeconds must be an integer between 30 and 3600';
    }
  }

  if (ionStorm.randomize !== undefined && typeof ionStorm.randomize !== 'boolean') {
    return 'ionStorm.randomize must be a boolean';
  }

  if (ionStorm.sites !== undefined) {
    if (
      typeof ionStorm.sites !== 'number' ||
      !Number.isInteger(ionStorm.sites) ||
      ionStorm.sites < 1 ||
      ionStorm.sites > 12
    ) {
      return 'ionStorm.sites must be an integer between 1 and 12';
    }
  }

  const valueKeys = [
    'damage',
    'deferment',
    'duration',
    'hitDelay',
    'cellSpread',
    'scatterDelay',
    'separation',
  ] as const;
  if (ionStorm.values !== undefined) {
    if (typeof ionStorm.values !== 'object' || Array.isArray(ionStorm.values)) {
      return 'ionStorm.values must be an object';
    }
    for (const key of Object.keys(ionStorm.values)) {
      if (!valueKeys.includes(key as (typeof valueKeys)[number])) {
        return `ionStorm.values.${key} is not a known key (${valueKeys.join(', ')})`;
      }
      const v = (ionStorm.values as Record<string, unknown>)[key];
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > 1000) {
        return `ionStorm.values.${key} must be a number between 0 and 1000`;
      }
    }
  }

  return null;
}

/**
 * 校验昼夜交替入参。
 *
 * 错误文案固定（验收脚本按这些字符串断言）：
 * - `dayNight must be an object`
 * - `dayNight.enabled must be a boolean`
 * - `dayNight.cycleSeconds must be an integer between 60 and 7200`
 * - `dayNight.stages must be an integer between 2 and 24`
 * - `dayNight.startHour must be an integer between 0 and 23`
 * - `dayNight.retint must be a boolean`
 */
function validateDayNightRequest(dayNight: DayNightRequest | undefined): string | null {
  if (dayNight === undefined || dayNight === null) {
    return null;
  }
  if (typeof dayNight !== 'object' || Array.isArray(dayNight)) {
    return 'dayNight must be an object';
  }

  if (dayNight.enabled !== undefined && typeof dayNight.enabled !== 'boolean') {
    return 'dayNight.enabled must be a boolean';
  }

  if (dayNight.cycleSeconds !== undefined) {
    if (
      typeof dayNight.cycleSeconds !== 'number' ||
      !Number.isInteger(dayNight.cycleSeconds) ||
      dayNight.cycleSeconds < 60 ||
      dayNight.cycleSeconds > 7200
    ) {
      return 'dayNight.cycleSeconds must be an integer between 60 and 7200';
    }
  }

  if (dayNight.stages !== undefined) {
    if (
      typeof dayNight.stages !== 'number' ||
      !Number.isInteger(dayNight.stages) ||
      dayNight.stages < 2 ||
      dayNight.stages > 24
    ) {
      return 'dayNight.stages must be an integer between 2 and 24';
    }
  }

  if (dayNight.startHour !== undefined) {
    if (
      typeof dayNight.startHour !== 'number' ||
      !Number.isInteger(dayNight.startHour) ||
      dayNight.startHour < 0 ||
      dayNight.startHour > 23
    ) {
      return 'dayNight.startHour must be an integer between 0 and 23';
    }
  }

  if (dayNight.retint !== undefined && typeof dayNight.retint !== 'boolean') {
    return 'dayNight.retint must be a boolean';
  }

  return null;
}

// ---------------------------------------------------------------------------
// 启动服务器
// ---------------------------------------------------------------------------

/**
 * 启动服务器。
 *
 * 先加载所有资源到内存，然后启动 Express 监听。
 */
function start(): void {
  console.log('[server] Starting RA2 Random Map Generator server...');

  // 加载资源
  try {
    loadAllResources();
  } catch (err) {
    console.error('[server] Failed to load resources:', err);
    process.exit(1);
  }

  // 启动 HTTP 服务器
  app.listen(PORT, HOST, () => {
    console.log(`[server] Server listening on http://${HOST}:${PORT}`);
    console.log('[server] API endpoints:');
    console.log('  GET  /api/health             - Health check');
    console.log('  GET  /api/theaters           - List theaters');
    console.log('  GET  /api/theaters/:name/info - Theater info');
    console.log('  POST /api/generate           - Generate map');
    console.log('  POST /api/split              - Split map into slices (auto-detects theater)');
    console.log('  POST /api/split/detect       - Detect map theater only');
    console.log('  POST /api/split/spawns       - Cut spawn units centered on each waypoint');
    console.log('  POST /api/rmg/cxx/generate   - Random map from one seed (vera20k-aligned cxx pipeline)');
  });
}

// 启动（仅在直接运行时，而非被 require 时）
if (require.main === module) {
  start();
}

export { app, start };
