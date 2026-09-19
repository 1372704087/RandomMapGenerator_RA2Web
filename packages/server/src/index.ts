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
 *   POST /api/preview            - 地图雷达预览（RGB，支持批量）
 *   GET  /api/rmg/meta           - RMG 选项元数据 / 默认值 / 阶段状态
 *   POST /api/rmg/derive         - RMG 选项 clamp + 尺寸推导
 *   POST /api/rmg/sed/read       - 读 .SED 还原 RMG 选项（carry-default）
 *   POST /api/rmg/sed/write      - RMG 选项写出 .SED
 *   POST /api/rmg/generate       - 跑 RMG 管线产出地图（当前为 S1 骨架）
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
import { splitFullMap, detectTheater, buildTheaterWarnings } from './splitter';
import { renderMapPreview } from '@ra2/core';
import {
  getRmgMeta,
  deriveRmgOptions,
  readSedOptions,
  writeSedOptions,
  generateRmgMap,
  RmgFillMode,
} from './rmgService';
import { generateRmgFull } from './rmgFullService';
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
 *     "skipEmpty": true           // 可选，默认 true，是否跳过内部为空的地块
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
      const { theaterType, mapContent, skipEmpty, autoTheater, frame } = req.body as {
        theaterType?: string;
        mapContent?: string;
        skipEmpty?: boolean;
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

      // frame 默认 true（网页层）：给切片画窗外框（沿用 empty.map 的手工单元框），
      // 只落在功能窗口之外，对生成器纯视觉（见 scripts/verify-split.mjs 的惰性证明）。
      const slices = splitFullMap(effectiveDir, mapContent, {
        skipEmpty: skipEmpty ?? true,
        frame: frame ?? true,
      });

      res.json({
        theater: theater.theaterEnum,
        theaterDir: effectiveDir,
        frame: frame ?? true,
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

// ---------------------------------------------------------------------------
// RMG 路由（gamemd 精确管线，见 rmgService.ts 头部说明）
// ---------------------------------------------------------------------------

/**
 * GET /api/rmg/meta
 * 返回 RMG 选项字段元数据、构造器默认值、RMGMD 缺省、以及阶段实现状态。
 */
app.get('/api/rmg/meta', (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(getRmgMeta());
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/rmg/derive
 * 请求体: { options: RmgOptions, clamp?: boolean }
 * 响应: { options, derived }
 *
 * clamp 默认 true（等价原生 ClampFields 0x005975E0）；传 false 可看原始值。
 */
app.post('/api/rmg/derive', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { options, clamp } = req.body as { options?: unknown; clamp?: boolean };
    res.json(deriveRmgOptions(options, clamp !== false));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/rmg/sed/read
 * 请求体: { content: string, base?: RmgOptions }
 * 响应: { options, derived, sectionFound, ignoredKeys }
 *
 * carry-default 语义：缺失/读失败的键保留 base（缺省为构造器默认）。
 * 与原生 reader 一致，**不** 调用 ClampFields。
 */
app.post('/api/rmg/sed/read', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, base } = req.body as { content?: string; base?: unknown };
    if (typeof content !== 'string') {
      res.status(400).json({ error: 'content is required and must be a string' });
      return;
    }
    res.json(readSedOptions(content, base));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/rmg/sed/write
 * 请求体: { options: RmgOptions }
 * 响应: { content, options }
 */
app.post('/api/rmg/sed/write', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { options } = req.body as { options?: unknown };
    res.json(writeSedOptions(options));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/rmg/generate
 * 请求体: { options: RmgOptions, fill?: 'unassigned'|'clear', name?: string, withPreview?: boolean }
 * 响应: JSON，含 mapContent（完整地图 INI 文本）与阶段状态清单。
 *
 * ⚠ 当前实现边界：管线只有阶段 0/1/2 落地，产出为 S1（map-prep）骨架。
 *   响应里的 `outputLevel` / `missing` / `stages` 如实说明缺口，前端须原样展示。
 */
app.post('/api/rmg/generate', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { options, fill, name, withPreview, mode, extension } = req.body as {
      options?: unknown;
      fill?: RmgFillMode;
      name?: string;
      withPreview?: boolean;
      mode?: 'full' | 'skeleton';
      extension?: 'map' | 'yrm';
    };
    // full = gamemd 精确管线（MapType 0/1/2 完整地形）；skeleton = 旧 S1 骨架
    if (mode === 'skeleton') {
      res.json(generateRmgMap({ options, fill, name, withPreview }));
      return;
    }
    res.json(generateRmgFull({ options, fill, name, withPreview, extension }));
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
    const { contents } = req.body as { contents?: unknown };
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
      const p = renderMapPreview(c, minimapContent, theater);
      return {
        width: p.width,
        height: p.height,
        rgb: Buffer.from(p.rgb).toString('base64'),
      };
    });
    res.json({ items });
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
  console.error('[server] Unhandled error:', err);
  res.status(500).json({
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
      totalPlayers += count ?? 0;
    }

    if (totalPlayers > 8) {
      return `Total player count (${totalPlayers}) must not exceed 8`;
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
    console.log('  GET  /api/rmg/meta           - RMG option metadata / defaults / stages');
    console.log('  POST /api/rmg/derive         - RMG clamp + size derivation');
    console.log('  POST /api/rmg/sed/read       - Read .SED into RMG options');
    console.log('  POST /api/rmg/sed/write      - Write RMG options into .SED');
    console.log('  POST /api/rmg/generate       - Run RMG pipeline (currently S1 skeleton)');
  });
}

// 启动（仅在直接运行时，而非被 require 时）
if (require.main === module) {
  start();
}

export { app, start };
