/**
 * `RMGMD.INI [General]` 读取 —— `0x005981F0`
 *
 * 文件来自零售 MIX；键缺失时保留**构造器缺省**（不是 0）。
 * 无 INI 时：min/max tiberium = 2500/5500，MaxTrees = 500，
 * levelLight/vegetation 表全 0（原生构造器对数组未显式写入时为零）。
 *
 * 本地核对文件：`G:\openyrweb\尤里复仇配置文件\rmgmd.ini`
 * （与语料从 ra2md.mix 抽出的值逐项一致）。
 */

import { IniFile } from '../io/iniFile';

export const TIME_BUCKETS = 4;
export const MAP_TYPE_BUCKETS = 5;

/** 构造器缺省（无 INI / 无键时） */
export const DEFAULT_MIN_TIBERIUM = 2500;
export const DEFAULT_MAX_TIBERIUM = 5500;
export const DEFAULT_MAX_TREES = 500;

export interface RmgSettings {
  minTiberium: number;
  maxTiberium: number;
  maxTrees: number;
  /** 按时段 morning/day/dusk/night，0..100 */
  levelLight: number[];
  /** 按地图类型 0..4 */
  vegetationMin: number[];
  vegetationMax: number[];
  /** 零售版读入但永不消费（保留以对齐） */
  temperateOrePatchLamps: string;
  snowOrePatchLamps: string;
  /** 按时段环境光（0 黑 .. 100 正常） */
  temperateAmbientLight: number[];
  snowAmbientLight: number[];
  temperateAmbientRed: number[];
  temperateAmbientGreen: number[];
  temperateAmbientBlue: number[];
  snowAmbientRed: number[];
  snowAmbientGreen: number[];
  snowAmbientBlue: number[];
}

export function defaultRmgSettings(): RmgSettings {
  return {
    minTiberium: DEFAULT_MIN_TIBERIUM,
    maxTiberium: DEFAULT_MAX_TIBERIUM,
    maxTrees: DEFAULT_MAX_TREES,
    levelLight: new Array<number>(TIME_BUCKETS).fill(0),
    vegetationMin: new Array<number>(MAP_TYPE_BUCKETS).fill(0),
    vegetationMax: new Array<number>(MAP_TYPE_BUCKETS).fill(0),
    temperateOrePatchLamps: '',
    snowOrePatchLamps: '',
    temperateAmbientLight: new Array<number>(TIME_BUCKETS).fill(0),
    snowAmbientLight: new Array<number>(TIME_BUCKETS).fill(0),
    temperateAmbientRed: new Array<number>(TIME_BUCKETS).fill(0),
    temperateAmbientGreen: new Array<number>(TIME_BUCKETS).fill(0),
    temperateAmbientBlue: new Array<number>(TIME_BUCKETS).fill(0),
    snowAmbientRed: new Array<number>(TIME_BUCKETS).fill(0),
    snowAmbientGreen: new Array<number>(TIME_BUCKETS).fill(0),
    snowAmbientBlue: new Array<number>(TIME_BUCKETS).fill(0),
  };
}

function readInt(
  sec: ReturnType<IniFile['GetSection']>,
  key: string,
): number | null {
  if (!sec || !sec.KeyExists(key)) return null;
  const raw = sec.GetStringValue(key, '').trim();
  if (!/^[+-]?\d+$/.test(raw)) return null;
  return Number.parseInt(raw, 10);
}

function readIntList(
  sec: ReturnType<IniFile['GetSection']>,
  key: string,
  n: number,
): number[] | null {
  if (!sec || !sec.KeyExists(key)) return null;
  const raw = sec.GetStringValue(key, '');
  const parts = raw.split(',').map((p) => p.trim());
  const out: number[] = [];
  for (const p of parts) {
    if (!/^[+-]?\d+$/.test(p)) return null;
    out.push(Number.parseInt(p, 10));
  }
  // 过短则整键无效（与 Rust 侧一致：不部分应用）
  if (out.length < n) return null;
  return out.slice(0, n);
}

function readString(
  sec: ReturnType<IniFile['GetSection']>,
  key: string,
): string | null {
  if (!sec || !sec.KeyExists(key)) return null;
  return sec.GetStringValue(key, '');
}

/**
 * 从 `RMGMD.INI` 文本解析设置。
 * 传 `null`/`undefined`/空串 → 纯构造器缺省。
 * 逐键 fallback：缺键保留 default 对应字段。
 */
export function loadRmgmd(content: string | null | undefined): RmgSettings {
  const out = defaultRmgSettings();
  if (!content || content.trim().length === 0) return out;

  const ini = new IniFile(content);
  const sec = ini.GetSection('General');

  const minT = readInt(sec, 'RMGMinimumTiberium');
  if (minT !== null) out.minTiberium = minT;
  const maxT = readInt(sec, 'RMGMaximumTiberium');
  if (maxT !== null) out.maxTiberium = maxT;
  const trees = readInt(sec, 'MaxTrees');
  if (trees !== null) out.maxTrees = trees;

  const level = readIntList(sec, 'RMGLevelLightSettings', TIME_BUCKETS);
  if (level) out.levelLight = level;
  const vMin = readIntList(sec, 'RMGVegetationMinimums', MAP_TYPE_BUCKETS);
  if (vMin) out.vegetationMin = vMin;
  const vMax = readIntList(sec, 'RMGVegetationMaximums', MAP_TYPE_BUCKETS);
  if (vMax) out.vegetationMax = vMax;

  const tLamps = readString(sec, 'TemperateOrePatchLamps');
  if (tLamps !== null) out.temperateOrePatchLamps = tLamps;
  const sLamps = readString(sec, 'SnowOrePatchLamps');
  if (sLamps !== null) out.snowOrePatchLamps = sLamps;

  const tAmb = readIntList(sec, 'TemperateAmbientLight', TIME_BUCKETS);
  if (tAmb) out.temperateAmbientLight = tAmb;
  const sAmb = readIntList(sec, 'SnowAmbientLight', TIME_BUCKETS);
  if (sAmb) out.snowAmbientLight = sAmb;

  const tR = readIntList(sec, 'TemperateAmbientRed', TIME_BUCKETS);
  if (tR) out.temperateAmbientRed = tR;
  const tG = readIntList(sec, 'TemperateAmbientGreen', TIME_BUCKETS);
  if (tG) out.temperateAmbientGreen = tG;
  const tB = readIntList(sec, 'TemperateAmbientBlue', TIME_BUCKETS);
  if (tB) out.temperateAmbientBlue = tB;

  const sR = readIntList(sec, 'SnowAmbientRed', TIME_BUCKETS);
  if (sR) out.snowAmbientRed = sR;
  const sG = readIntList(sec, 'SnowAmbientGreen', TIME_BUCKETS);
  if (sG) out.snowAmbientGreen = sG;
  const sB = readIntList(sec, 'SnowAmbientBlue', TIME_BUCKETS);
  if (sB) out.snowAmbientBlue = sB;

  return out;
}

/**
 * 按地图类型取植被区间（RandomizeDerivedFields 消费）。
 * 越界 MapType 回退到索引 0 的表项（原生用固定步长表，越界属未定义；
 * 这里与 Clamp 后 0..4 对齐，越界夹到 0..4）。
 */
export function vegetationRange(
  settings: RmgSettings,
  mapType: number,
): { min: number; max: number } {
  const i = Math.max(0, Math.min(MAP_TYPE_BUCKETS - 1, mapType | 0));
  return {
    min: settings.vegetationMin[i],
    max: settings.vegetationMax[i],
  };
}

/** 按时段取 level light（0..100）。 */
export function levelLightAt(settings: RmgSettings, time: number): number {
  const i = Math.max(0, Math.min(TIME_BUCKETS - 1, time | 0));
  return settings.levelLight[i];
}
