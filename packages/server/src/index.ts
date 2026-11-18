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
import { renderMapPreview } from '@ra2/core';
import { generateRmgCxx } from './rmgCxxService';
import { renderCncmapsPreview } from './cncmapsPreview';
import { GenerateOptions } from './types';

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
    res.json(generateRmgCxx(req.body as Parameters<typeof generateRmgCxx>[0]));
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
 * 请求体: { mapContent: string, name?: string, width?: number }
 * 响应: image/png（默认 1600px 宽；500×500 全图约 30s）
 *
 * 依赖 cncmaps Web 服务（默认 http://127.0.0.1:5174），可用 CNCMAPS_WEB_URL 覆盖。
 */
app.post('/api/cncmaps-preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mapContent, name, width } = req.body as {
      mapContent?: unknown;
      name?: unknown;
      width?: unknown;
    };
    if (typeof mapContent !== 'string' || mapContent.trim().length === 0) {
      res.status(400).json({ error: 'mapContent is required and must be a non-empty string' });
      return;
    }
    const previewWidth = typeof width === 'number' && Number.isFinite(width) ? width : 1600;
    const png = await renderCncmapsPreview(
      mapContent,
      typeof name === 'string' && name.trim() ? name : 'Random Map',
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
