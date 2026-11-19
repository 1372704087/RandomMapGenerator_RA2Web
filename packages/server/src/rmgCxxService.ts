/**
 * cxx 管线服务 —— 用 `core/src/rmg/cxx/`（vera20k 逐函数平移的 gamemd 实现）
 * 从**一个种子**跑完整随机地图。
 *
 * 与 `rmgFullService.ts`（`core/src/rmg/pipeline.ts`，TS 原生那套）的区别：
 *   - 这套的入口是 `generateMap(params, outPath)`，16 个 MAPSEEDCLASS 字段
 *     由 `rollGlobalOptions(rmg, globalSeed)` 摇出来，不是用户直接填的；
 *   - 多一张 `RMG_STAGES` 之外的真实状态，走的是逐函数对拍的语义。
 *
 * 资源目录（theater 的 TEMPERATMD.INI / SNOWMD.INI 等）按以下顺序解析：
 *   1. `RA2_RMG_RESOURCE_DIR` 环境变量
 *   2. `G:/MapGenerator/x64/Release`（本机固定的原版资源解开目录）
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateCxxMap, CxxGenerateParams, MAX_THEATER_INDEX, theaterEntry } from '@ra2/core';

/** 默认资源目录：解开的原版 theater INI + TMP 目录 */
const DEFAULT_RESOURCE_DIR = 'G:/MapGenerator/x64/Release';

/**
 * theater 控制 INI 的补充目录（temperatmd / snowmd / urbanmd / desertmd /
 * urbannmd）。原版 exe 从它自己目录和 相关INI 找，这里补一份仓库内的副本，
 * 这样不需要往 G:/MapGenerator 写东西也能跑沙漠/城市。
 */
const THEATER_INI_DIR = path.join(__dirname, '..', 'resources', 'theater');

/**
 * 非温带/雪地 theater 的 TMP 瓦片缓存（城市 / 沙漠 / 新城市）。
 *
 * `Tile资源/` 里只有 温和 和 雪地 —— 原版 MapGenerator 也只放了这两套。
 * 其余三套的 .urb/.des/.ubn 瓦片躺在游戏的 theater mix 里，由
 * `scripts/extract-theater-tiles.mjs` 从 `isodesmd.mix` / `isourbmd.mix` /
 * `isoubnmd.mix` 抽到本目录。没有 TMP 就没有每格的 Height/RampType，
 * recalc 的「瓦片有没有这一帧」判定会把整张图擦成 0xFFFF（一片空白沙地）。
 */
const TILE_ART_DIR = path.join(__dirname, '..', 'resources', 'theater-tiles');

export interface CxxGenerateInput {
  /** 全局种子（exe 的 WinMain 种子里那个；16 个选项由它摇出） */
  globalSeed?: number;
  environment?: number;
  timeOfDay?: number;
  /**
   * theater 选项（引擎顺序，VERA20k emit.rs `theater_name`）：
   * 0 温带 / 1 雪地 / 2 城市 / 3 沙漠 / 4 新城市；5 月球是本仓库的扩展
   * （gamemd 的 RMG 选项只到新城市，但 theater 数据层有 LUNAR，引擎读该
   * theater 时会把悬崖/水域七族清零）。越界回落温带。
   */
  theater?: number;
  mapSize?: number;
  oreDensity?: number;
  playerIndex?: number;
  gameType?: number;
  /** 地图文件名（不含扩展名） */
  name?: string;
  /**
   * Ares「Create Urban Areas」开关（原版 exe 没有）：`true` 按面积折算城区数量，
   * 数字则直接指定数量。缺省不生成。
   */
  urbanAreas?: boolean | number;
}

export interface CxxGlobalOptions {
  waterAmount: number;
  ruggedness: number;
  urbanPresence: number;
  accessibility: number;
  regionSize: number;
  tiberiumLayout: number;
  vegetation: number;
  seed04C: number;
}

export interface CxxGenerateResult {
  mapContent: string;
  fileName: string;
  /** [Map] Size 的宽高（tile 数） */
  width: number;
  height: number;
  waterAmount: number;
  cellCount: number;
  elapsedMs: number;
  globalSeed: number;
  /** 由种子摇出的选项（页面上当只读结果展示） */
  options: CxxGlobalOptions & {
    environment: number;
    timeOfDay: number;
    theater: number;
    mapSize: number;
    oreDensity: number;
    playerCount: number;
    multiplayer: boolean;
  };
}

function resolveResourceDir(): string {
  const custom = process.env.RA2_RMG_RESOURCE_DIR;
  if (custom && fs.existsSync(custom)) return custom;
  if (fs.existsSync(DEFAULT_RESOURCE_DIR)) return DEFAULT_RESOURCE_DIR;
  throw new Error(
    '资源目录不可用：请设置 RA2_RMG_RESOURCE_DIR 指向解开的原版资源目录'
    + `（当前尝试过 ${custom ?? '(未设置)'} 和 ${DEFAULT_RESOURCE_DIR}）`,
  );
}

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback;
  return Math.min(hi, Math.max(lo, n));
}

/** 城市/沙漠/新城市需要额外的 TMP 瓦片；缺了就要提醒一句，否则整张图会被擦空。 */
const warnedTheaters = new Set<number>();
function warnIfTileArtMissing(theater: number, resourceDir: string): void {
  if (theater < 2 || warnedTheaters.has(theater)) return;
  const entry = theaterEntry(theater);
  const installed = path.join(resourceDir, '..', '..', 'Tile资源', entry.artFolder);
  const cached = path.join(TILE_ART_DIR, entry.artCacheFolder);
  if (fs.existsSync(installed) || fs.existsSync(cached)) return;
  warnedTheaters.add(theater);
  console.warn(
    `[rmg-cxx] ${entry.name} 缺少 TMP 瓦片（${installed} 与 ${cached} 都不存在）：`
    + ' 生成的图会被 recalc 擦成 0xFFFF。先跑 '
    + `node scripts/extract-theater-tiles.mjs --game-dir <游戏目录> --theater ${entry.artCacheFolder}`,
  );
}

/** 种子可以是 0x 前缀的十六进制，也可以是十进制 */
export function parseSeed(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v) >>> 0;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return 0;
    const n = /^0x/i.test(s) ? parseInt(s, 16) : /^[0-9a-f]{7,8}$/i.test(s) ? parseInt(s, 16) : Number(s);
    if (Number.isFinite(n)) return Math.trunc(n) >>> 0;
  }
  return 0;
}

/**
 * 跑一次 cxx 管线。
 *
 * `saveCxxMapFile` 由 `generateCxxMap` 内部按 `outPath` 调用，所以这里只负责
 * 给一个临时路径、把产出读回来；生成的 `.map` 文本即浏览器的下载内容。
 */
export function generateRmgCxx(input: CxxGenerateInput): CxxGenerateResult {
  const globalSeed = parseSeed(input.globalSeed);
  const params: CxxGenerateParams = {
    environment: clampInt(input.environment, 0, 4, 1),
    timeOfDay: clampInt(input.timeOfDay, 0, 3, 0),
    theater: clampInt(input.theater, 0, MAX_THEATER_INDEX, 0),
    mapSize: clampInt(input.mapSize, 0, 3, 1),
    oreDensity: clampInt(input.oreDensity, 0, 3, 0),
    playerIndex: clampInt(input.playerIndex, 0, 6, 2),
    gameType: clampInt(input.gameType, 0, 1, 0),
    globalSeed,
    mapSeed: 0,
    urbanAreas: input.urbanAreas === true ? true
      : typeof input.urbanAreas === 'number' ? Math.max(0, Math.trunc(input.urbanAreas)) : false,
  };

  const resourceDir = resolveResourceDir();
  warnIfTileArtMissing(params.theater, resourceDir);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rmg-cxx-'));
  const outPath = path.join(tmpDir, 'out.map');

  let result: ReturnType<typeof generateCxxMap>;
  const t0 = Date.now();
  try {
    result = generateCxxMap(params, outPath, resourceDir, THEATER_INI_DIR, TILE_ART_DIR);
  } finally {
    // 生成失败时也要清掉临时目录
  }
  const elapsedMs = Date.now() - t0;

  if (!result.result.ok) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error('cxx 管线生成失败（generateMapBody 返回 false）');
  }
  if (!fs.existsSync(outPath)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error('cxx 管线没有写出 .map 文件');
  }

  const mapContent = fs.readFileSync(outPath, 'utf8');
  fs.rmSync(tmpDir, { recursive: true, force: true });

  const rmg = result.rmg;
  const g = rmg.globalOptions as CxxGlobalOptions;
  const name = (input.name ?? `cxx_${globalSeed.toString(16).toUpperCase()}`).replace(/[^\w.-]+/g, '_');

  return {
    mapContent,
    fileName: `${name}.map`,
    width: rmg.size.mapWidth,
    height: rmg.size.mapHeight,
    waterAmount: result.result.waterAmount,
    cellCount: result.result.cellCount,
    elapsedMs,
    globalSeed,
    options: {
      waterAmount: g.waterAmount,
      ruggedness: g.ruggedness,
      urbanPresence: g.urbanPresence,
      accessibility: g.accessibility,
      regionSize: g.regionSize,
      tiberiumLayout: g.tiberiumLayout,
      vegetation: g.vegetation,
      seed04C: g.seed04C,
      environment: params.environment,
      timeOfDay: params.timeOfDay,
      theater: params.theater,
      mapSize: params.mapSize,
      oreDensity: params.oreDensity,
      playerCount: params.playerIndex + 2,
      multiplayer: params.gameType === 1,
    },
  };
}
