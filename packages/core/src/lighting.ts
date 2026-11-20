/**
 * 地图环境光照（`[Lighting]` 段）的预设与派生逻辑。
 *
 * 红警2/尤里的复仇里，一张地图的“环境色”就是 `[Lighting]` 段的这 5 个数值：
 *   - `Ambient`  环境光强度，越小越暗；
 *   - `Red/Green/Blue`  三个通道的色调增益，1.0 = 不偏色，>1 该色更饱和，
 *     <1 该色被压暗 —— 这三项组合起来就是“偏暖/偏冷/偏蓝”的观感；
 *   - `Level`    额外亮度层级（原版几乎所有地图都是 0.03）。
 * 尤里复仇另有 `Ion*` 五行（离子风暴/闪电时的替代光照），地图里可以不带。
 *
 * 这里的四档时间预设取自游戏自己的光照表（实测 `POST /api/rmg/cxx/generate`
 * 的 `timeOfDay` 0..3 输出，温带与非温带各一套），不是拍脑袋编的：
 *
 *   timeOfDay 0  暖光（晨昏/低角度日照）   A .75  R 1.09  G .80  B .49
 *   timeOfDay 1  正午明亮                 A 1.00  R 1.08  G .94  B .68
 *   timeOfDay 2  冷调偏蓝（阴天/黄昏）      A .75  R .71   G .81  B 1.19
 *   timeOfDay 3  夜间深蓝                 A .35  R .51   G .46  B 1.41
 *
 * 非温带（雪地/沙漠/新城区/岛屿）游戏只有一套共用的冷色调表：
 *
 *   timeOfDay 0  A .75  R 1.12  G .80  B 1.33
 *   timeOfDay 1  A 1.00  R .99   G 1.04  B 1.07
 *   timeofDay 2  A .75  R 1.06  G 1.07  B 1.54
 *   timeOfDay 3  A .55  R .76   G .74   B 1.18
 *
 * DESERT 的预设不存在于游戏光照表里（原版沙漠是靠 `settings.ini` 的区间随机），
 * 所以这里用沙漠 settings.ini 的中值（R .98 / G .955 / B .955 / A .875 / L .017）
 * 作为“正午基准色”，再套上面温带表的相对比例缩放出四个时段，保留沙漠本身偏黄
 * 的底色。派生结果会夹到 0.2..1.6 之间，避免夜间蓝通道被推到不合理的 1.98。
 */

import { Random } from './random';

/** 一天里的四档光照（对齐游戏 `timeOfDay`）。 */
export type TimeOfDay = 0 | 1 | 2 | 3;

/** 环境主题：决定基础色调。由 theater 名推导，也可以显式指定。 */
export type LightingEnvironment =
  | 'temperate'
  | 'snow'
  | 'desert'
  | 'newurban'
  | 'islands';

/** `[Lighting]` 的数值集合。`Ion*` 为可选项（不写就沿用游戏默认）。 */
export interface LightingValues {
  Ambient: number;
  Red: number;
  Green: number;
  Blue: number;
  Level: number;
  IonAmbient?: number;
  IonRed?: number;
  IonGreen?: number;
  IonBlue?: number;
  IonLevel?: number;
}

/** 四档时间的中文标签，前端下拉直接用。 */
export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  0: '暖光（晨昏）',
  1: '正午明亮',
  2: '冷调（阴天/黄昏）',
  3: '夜间',
};

/** 环境主题的中文标签。 */
export const LIGHTING_ENVIRONMENT_LABELS: Record<LightingEnvironment, string> = {
  temperate: '温带',
  snow: '雪地',
  desert: '沙漠',
  newurban: '新城区',
  islands: '岛屿',
};

/** 所有可选环境主题，按前端下拉顺序排列。 */
export const LIGHTING_ENVIRONMENTS: readonly LightingEnvironment[] = [
  'temperate',
  'snow',
  'desert',
  'newurban',
  'islands',
];

/** 温带四档（实测游戏光照表）。 */
const TEMPERATE_TABLE: readonly LightingValues[] = [
  { Ambient: 0.75, Red: 1.09, Green: 0.8, Blue: 0.49, Level: 0.03 },
  { Ambient: 1.0, Red: 1.08, Green: 0.94, Blue: 0.68, Level: 0.03 },
  { Ambient: 0.75, Red: 0.71, Green: 0.81, Blue: 1.19, Level: 0.03 },
  { Ambient: 0.35, Red: 0.51, Green: 0.46, Blue: 1.41, Level: 0.03 },
];

/** 非温带（雪地等）四档（实测游戏光照表，游戏里所有非温带 theater 共用这一套）。 */
const COLD_TABLE: readonly LightingValues[] = [
  { Ambient: 0.75, Red: 1.12, Green: 0.8, Blue: 1.33, Level: 0.03 },
  { Ambient: 1.0, Red: 0.99, Green: 1.04, Blue: 1.07, Level: 0.03 },
  { Ambient: 0.75, Red: 1.06, Green: 1.07, Blue: 1.54, Level: 0.03 },
  { Ambient: 0.55, Red: 0.76, Green: 0.74, Blue: 1.18, Level: 0.03 },
];

/** DESERT `settings.ini` 的中值（Red/Green/Blue/Level/Ambient 各自区间取中点）。 */
const DESERT_BASE: LightingValues = {
  Ambient: 0.875,
  Red: 0.98,
  Green: 0.955,
  Blue: 0.955,
  Level: 0.017,
};

/** 色值夹取范围：太高的通道增益会把贴图颜色推崩，太低则发黑。 */
const CHANNEL_MIN = 0.2;
const CHANNEL_MAX = 1.6;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** 按温带四档的相对比例，把某个基准色缩放出四个时段。 */
function deriveFromBase(base: LightingValues): LightingValues[] {
  const noon = TEMPERATE_TABLE[1];
  const out: LightingValues[] = [];
  for (let i = 0; i < 4; i++) {
    const t = TEMPERATE_TABLE[i];
    out.push({
      Ambient: round6(clamp((base.Ambient * t.Ambient) / noon.Ambient, CHANNEL_MIN, CHANNEL_MAX)),
      Red: round6(clamp((base.Red * t.Red) / noon.Red, CHANNEL_MIN, CHANNEL_MAX)),
      Green: round6(clamp((base.Green * t.Green) / noon.Green, CHANNEL_MIN, CHANNEL_MAX)),
      Blue: round6(clamp((base.Blue * t.Blue) / noon.Blue, CHANNEL_MIN, CHANNEL_MAX)),
      Level: base.Level,
    });
  }
  return out;
}

/** 沙漠四档：由 settings.ini 基准色派生。 */
const DESERT_TABLE: readonly LightingValues[] = deriveFromBase(DESERT_BASE);

/** 每个环境主题对应的四档表。 */
const TABLES: Record<LightingEnvironment, readonly LightingValues[]> = {
  temperate: TEMPERATE_TABLE,
  snow: COLD_TABLE,
  desert: DESERT_TABLE,
  newurban: COLD_TABLE,
  islands: COLD_TABLE,
};

/** 取某个环境 + 某个时段的标准光照值。 */
export function getLightingPreset(
  environment: LightingEnvironment,
  timeOfDay: TimeOfDay,
): LightingValues {
  const table = TABLES[environment] ?? TEMPERATE_TABLE;
  return { ...table[timeOfDay] };
}

/** 把 theater 目录名（TEMPERATE / SNOW / DESERT / NEWURBAN / TEMPERATE_Islands）映射到环境主题。 */
export function theaterToLightingEnvironment(theaterType: string): LightingEnvironment {
  const upper = (theaterType || '').toUpperCase();
  if (upper.startsWith('DESERT')) return 'desert';
  if (upper.startsWith('SNOW')) return 'snow';
  if (upper.startsWith('NEWURBAN')) return 'newurban';
  if (upper.includes('ISLAND')) return 'islands';
  return 'temperate';
}

/**
 * 在基准值上叠加自定义覆盖（只覆盖给了的字段），并夹到合法范围。
 * 覆盖值可以是 `Ambient/Red/Green/Blue/Level/Ion*` 的任意子集。
 */
export function applyLightingOverrides(
  base: LightingValues,
  overrides?: Partial<LightingValues>,
): LightingValues {
  const result: LightingValues = { ...base };
  if (!overrides) return result;

  const coreKeys: (keyof LightingValues)[] = ['Ambient', 'Red', 'Green', 'Blue', 'Level'];
  for (const key of coreKeys) {
    const v = overrides[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      result[key] = round6(clamp(v, CHANNEL_MIN, CHANNEL_MAX));
    }
  }
  const ionKeys: (keyof LightingValues)[] = [
    'IonAmbient',
    'IonRed',
    'IonGreen',
    'IonBlue',
    'IonLevel',
  ];
  for (const key of ionKeys) {
    const v = overrides[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      result[key] = round6(clamp(v, CHANNEL_MIN, CHANNEL_MAX));
    }
  }
  return result;
}

/**
 * 在基准值上做随机抖动：每个通道乘以 `1 + rand(-jitter, +jitter)`。
 *
 * 复用 `MapFile.Randomizer`，所以同一个种子抖动出的结果完全一致 —— 既保留
 * 原版沙漠那种“每张天色不同”的手感，又不破坏可复现性。
 */
export function jitterLighting(
  base: LightingValues,
  jitter: number,
  rng: Random,
): LightingValues {
  const j = clamp(jitter, 0, 0.5);
  const wobble = (): number => 1 + (rng.NextDouble() * 2 - 1) * j;
  const result: LightingValues = {
    Ambient: round6(clamp(base.Ambient * wobble(), CHANNEL_MIN, CHANNEL_MAX)),
    Red: round6(clamp(base.Red * wobble(), CHANNEL_MIN, CHANNEL_MAX)),
    Green: round6(clamp(base.Green * wobble(), CHANNEL_MIN, CHANNEL_MAX)),
    Blue: round6(clamp(base.Blue * wobble(), CHANNEL_MIN, CHANNEL_MAX)),
    Level: round6(clamp(base.Level * wobble(), 0.001, 0.2)),
  };
  if (base.IonAmbient !== undefined) {
    result.IonAmbient = round6(clamp(base.IonAmbient * wobble(), CHANNEL_MIN, CHANNEL_MAX));
  }
  if (base.IonRed !== undefined) {
    result.IonRed = round6(clamp(base.IonRed * wobble(), CHANNEL_MIN, CHANNEL_MAX));
  }
  if (base.IonGreen !== undefined) {
    result.IonGreen = round6(clamp(base.IonGreen * wobble(), CHANNEL_MIN, CHANNEL_MAX));
  }
  if (base.IonBlue !== undefined) {
    result.IonBlue = round6(clamp(base.IonBlue * wobble(), CHANNEL_MIN, CHANNEL_MAX));
  }
  if (base.IonLevel !== undefined) {
    result.IonLevel = round6(clamp(base.IonLevel * wobble(), 0.001, 0.2));
  }
  return result;
}
