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
import { generateCxxMap, CxxGenerateParams } from '@ra2/core';

/** 默认资源目录：解开的原版 theater INI + TMP 目录 */
const DEFAULT_RESOURCE_DIR = 'G:/MapGenerator/x64/Release';

export interface CxxGenerateInput {
  /** 全局种子（exe 的 WinMain 种子里那个；16 个选项由它摇出） */
  globalSeed?: number;
  environment?: number;
  timeOfDay?: number;
  theater?: number;
  mapSize?: number;
  oreDensity?: number;
  playerIndex?: number;
  gameType?: number;
  /** 地图文件名（不含扩展名） */
  name?: string;
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
    theater: clampInt(input.theater, 0, 1, 0),
    mapSize: clampInt(input.mapSize, 0, 3, 1),
    oreDensity: clampInt(input.oreDensity, 0, 3, 0),
    playerIndex: clampInt(input.playerIndex, 0, 6, 2),
    gameType: clampInt(input.gameType, 0, 1, 0),
    globalSeed,
    mapSeed: 0,
  };

  const resourceDir = resolveResourceDir();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rmg-cxx-'));
  const outPath = path.join(tmpDir, 'out.map');

  let result: ReturnType<typeof generateCxxMap>;
  const t0 = Date.now();
  try {
    result = generateCxxMap(params, outPath, resourceDir);
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
