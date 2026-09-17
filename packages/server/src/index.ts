/**
 * 红警2随机地图生成器 - Node.js 后端 API
 *
 * Express 服务器，提供以下接口：
 *   GET  /api/health             - 健康检查
 *   GET  /api/theaters           - 返回可用 theater 列表
 *   GET  /api/theaters/:name/info - 返回单个 theater 的详细信息
 *   POST /api/generate           - 生成地图，返回 .yrm 文件
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
} from './resourceLoader';
import { generateMap } from './generator';
import { splitFullMap } from './splitter';
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
 * POST /api/split
 * 把一张完整地图拆解成若干 `.map` 切片。
 *
 * 请求体:
 *   {
 *     "theaterType": "TEMPERATE",
 *     "mapContent": "<完整地图 INI 文本>",
 *     "skipEmpty": true   // 可选，默认 true，是否跳过内部为空的地块
 *   }
 *
 * 响应: JSON
 *   {
 *     "theater": "TEMPERATE",
 *     "unitSize": "25x25",
 *     "count": 16,
 *     "slices": [
 *       { "name": "split_0_0", "gridX": 0, "gridY": 0, "content": "..." },
 *       ...
 *     ]
 *   }
 */
app.post(
  '/api/split',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { theaterType, mapContent, skipEmpty } = req.body as {
        theaterType?: string;
        mapContent?: string;
        skipEmpty?: boolean;
      };

      if (!theaterType || typeof theaterType !== 'string') {
        res.status(400).json({ error: 'theaterType is required and must be a string' });
        return;
      }
      const theater = getTheaterResources(theaterType);
      if (!theater) {
        const available = getTheaterInfoList().map((t) => t.name);
        res.status(404).json({
          error: `Theater "${theaterType}" not found`,
          available,
        });
        return;
      }
      if (!mapContent || typeof mapContent !== 'string' || mapContent.trim().length === 0) {
        res.status(400).json({ error: 'mapContent is required and must be a non-empty string' });
        return;
      }

      const slices = splitFullMap(theaterType, mapContent, { skipEmpty: skipEmpty ?? true });

      res.json({
        theater: theater.theaterEnum,
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
// 静态文件服务（可选，用于前端托管）
// ---------------------------------------------------------------------------

// 如果前端构建产物存在，则提供静态文件服务
const webDistPath = path.join(__dirname, '..', '..', 'web', 'dist');
// 使用 fs.existsSync 检查，避免目录不存在时报错
if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
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
    console.log('  POST /api/split              - Split map into slices');
  });
}

// 启动（仅在直接运行时，而非被 require 时）
if (require.main === module) {
  start();
}

export { app, start };
