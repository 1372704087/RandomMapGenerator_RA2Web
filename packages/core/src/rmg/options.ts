/**
 * RMG 选项与尺寸推导 —— `MapSeedClass` + `ClampFields @ 0x005975E0` + map-prep `0x00599650`
 *
 * 字段偏移取自 `MapSeedClass__Constructor @ 0x00595680` 的逐条指令读取；
 * clamp 范围取自 `0x005975E0`；尺寸表的 4×7 个整数与浮点常数均从二进制读出。
 */

import { chopAdd, chopMul, chopSub, ftol } from './x87';

/** 触发「向零截断」控制字的那个常数，同时也是 `ftol` 的实现依据 */
const ONE_F32 = 1.0;
const F32_SCALE = 0.3333333432674408; // float32 @ 0x007ED968
const CAP_1_2 = 1.2; // double  @ 0x007E5190

/** `MapSeedClass` 的 16 个整数选项字段（顺序即内存偏移顺序） */
export interface RmgOptions {
  /** +0x38 Theater：0=TEMPERATE 1=SNOW 2=URBAN 3=DESERT 4=NEWURBAN。**ClampFields 不 clamp 它** */
  theater: number;
  /** +0x3C MapType：0 群岛 / 1 大陆 / 2 团队大陆 / 3 内陆 / 4 多山 */
  mapType: number;
  /** +0x40 Resources 0..3 */
  resources: number;
  /** +0x44 Ruggedness % 0..100 */
  ruggedness: number;
  /** +0x48 Time 0..3：晨/昼/昏/夜 */
  time: number;
  /** +0x4C WaterAmount % 0..100（面板上无控件，由派生逻辑写入） */
  waterAmount: number;
  /** +0x50 NumPlayers 2..8 */
  numPlayers: number;
  /** +0x54 Tiberium % 1..100 */
  tiberium: number;
  /** +0x58 TiberiumLayout % 0..100 */
  tiberiumLayout: number;
  /** +0x5C Vegetation % 0..100 */
  vegetation: number;
  /** +0x60 UrbanPresence % 0..100（零售版无消费者） */
  urbanPresence: number;
  /** +0x64 Width 档 0..3 */
  width: number;
  /** +0x68 Height 档 0..3 */
  height: number;
  /** +0x6C Accessibility % 0..100 */
  accessibility: number;
  /** +0x70 RegionSize % 0..100 */
  regionSize: number;
  /** +0x74 Seed 0..0xFFFF（构造默认 -1 = 未设） */
  seed: number;
  /** +0x78 Description（`.SED` 的 hex-CSV 编码串） */
  description?: string;
}

/** `MapSeedClass__Constructor @ 0x00595680` 的初值（逐指令读出） */
export function defaultOptions(): RmgOptions {
  return {
    theater: 0,
    mapType: 1,
    resources: 1,
    ruggedness: 0,
    time: 1,
    waterAmount: 0,
    numPlayers: 2,
    tiberium: 0,
    tiberiumLayout: 0,
    vegetation: 0,
    urbanPresence: 0,
    width: 0,
    height: 0,
    accessibility: 0,
    regionSize: 0,
    seed: -1,
  };
}

interface ClampRule {
  key: keyof RmgOptions;
  min: number;
  max: number;
}

/**
 * `ClampFields 0x005975E0` 的范围表。
 *
 * 两个坑：
 *   1. **Theater 不在表里** —— 原生从不 clamp 它；
 *   2. Tiberium 下限是 **1**（不是 0），Resources 是 0..3 的档位（不是百分比）。
 */
export const CLAMP_RULES: readonly ClampRule[] = [
  { key: 'resources', min: 0, max: 3 },
  { key: 'mapType', min: 0, max: 4 },
  { key: 'time', min: 0, max: 3 },
  { key: 'ruggedness', min: 0, max: 100 },
  { key: 'waterAmount', min: 0, max: 100 },
  { key: 'tiberiumLayout', min: 0, max: 100 },
  { key: 'vegetation', min: 0, max: 100 },
  { key: 'urbanPresence', min: 0, max: 100 },
  { key: 'accessibility', min: 0, max: 100 },
  { key: 'regionSize', min: 0, max: 100 },
  { key: 'numPlayers', min: 2, max: 8 },
  { key: 'tiberium', min: 1, max: 100 },
  { key: 'width', min: 0, max: 3 },
  { key: 'height', min: 0, max: 3 },
  { key: 'seed', min: 0, max: 0xffff },
];

/** 原地 clamp（等价 `0x005975E0`）。注意 theater 不动。 */
export function clampOptions(o: RmgOptions): RmgOptions {
  const target = o as unknown as Record<string, number>;
  for (const r of CLAMP_RULES) {
    const v = o[r.key] as number;
    target[r.key] = v < r.min ? r.min : v > r.max ? r.max : v;
  }
  return o;
}

/**
 * 尺寸表（索引 `n = NumPlayers - 2`，7 项）。
 * `MIN_W @ 0x007ED634` / `MAX_W @ 0x007ED650` / `MIN_H @ 0x007ED66C` / `MAX_H @ 0x007ED688`
 */
export const MIN_W = [70, 70, 70, 80, 90, 100, 100] as const;
export const MAX_W = [80, 80, 80, 90, 100, 110, 120] as const;
export const MIN_H = [70, 70, 70, 80, 90, 100, 100] as const;
export const MAX_H = [80, 80, 80, 90, 100, 110, 120] as const;

export interface DerivedDimensions {
  /** `MapSeed+0x180` */
  genW: number;
  /** `MapSeed+0x184` */
  genH: number;
  /** `g_Map+0xF4` = genW + 4 */
  mapW: number;
  /** `g_Map+0xF8` = genH + 12 */
  mapH: number;
  /** `[Map] LocalSize` */
  localSize: [number, number, number, number];
  /** 菱形界下界 = mapW */
  diamondMin: number;
  /** 菱形界上界 = mapW + 2·mapH */
  diamondMax: number;
  /** `g_PathfinderLinearMapWidth` = genW + genH + 17 */
  linearMapWidth: number;
  /** playfield 格数 = mapH · (2·mapW − 1) */
  cells: number;
  /** 供调试：cap 前的 s 值 */
  rawScaleW: number;
  rawScaleH: number;
}

/**
 * 地图尺寸推导（`0x00599650` 头部）。
 *
 * 原生 x87 细节（本函数逐条对齐）：
 *   sW/sH 由 `Width档 × 0.33333334f` 算出并**以 float32 存回内存**；
 *   非 3/4 型：sW = min(sW,1.2) 且**以 float32 存回**，
 *              sH = min(sH,1.2) 但**留在 FPU 栈上（保持 double 1.2）**；
 *   3/4 型  ：两者都用内存里的**未 clamp** 值。
 *   最后 `genW = ftol(MinW[n]·(1−sW) + MaxW[n]·sW)`，`ftol` 向零截断。
 */
export function deriveDimensions(o: RmgOptions): DerivedDimensions {
  const n = Math.max(0, Math.min(6, o.numPlayers - 2));

  const rawScaleW = Math.fround(o.width * F32_SCALE);
  const rawScaleH = Math.fround(o.height * F32_SCALE);

  let sW = rawScaleW; // 内存中的 float32
  let sH: number; // FPU 栈上的值

  if (o.mapType === 3 || o.mapType === 4) {
    sH = rawScaleH; // 未 clamp，取自内存
  } else {
    sW = Math.fround(rawScaleW < CAP_1_2 ? rawScaleW : CAP_1_2);
    // 被 clamp 时留在 FPU 栈上的是 double 1.2（不再降到 float32）
    sH = rawScaleH < CAP_1_2 ? rawScaleH : CAP_1_2;
  }

  const genW = ftol(
    chopAdd(chopMul(MIN_W[n], chopSub(ONE_F32, sW)), chopMul(MAX_W[n], sW)),
  );
  const genH = ftol(
    chopAdd(chopMul(MIN_H[n], chopSub(ONE_F32, sH)), chopMul(MAX_H[n], sH)),
  );

  const mapW = genW + 4;
  const mapH = genH + 12;

  return {
    genW,
    genH,
    mapW,
    mapH,
    localSize: [2, 5, genW, genH],
    diamondMin: mapW,
    diamondMax: mapW + 2 * mapH,
    linearMapWidth: mapW + mapH + 1,
    cells: mapH * (2 * mapW - 1),
    rawScaleW,
    rawScaleH,
  };
}

/**
 * `RandomizeDerivedFields @ 0x00597260` 用到的按地图类型的区间表
 * （索引 = MapType 0..4）。注意这些走的是 `g_MainRng`，不是地形流。
 */
export const DERIVED_RANGES = {
  waterMin: [75, 0, 50, 0, 0],
  waterMax: [100, 25, 100, 100, 100],
  regionSizeMin: [50, 0, 35, 0, 0],
  regionSizeMax: [100, 100, 100, 100, 50],
  urbanMin: [0, 0, 0, 0, 0],
  urbanMax: [50, 100, 100, 100, 0],
  accessMin: [0, 0, 0, 0, 0],
  accessMax: [100, 100, 100, 100, 20],
} as const;

/** `.SED` / `MapSeedClass` 的 Theater 选项序（**不是** `tile/enums.ts` 的 Theater） */
export const RMG_THEATER = {
  TEMPERATE: 0,
  SNOW: 1,
  URBAN: 2,
  DESERT: 3,
  NEWURBAN: 4,
} as const;
