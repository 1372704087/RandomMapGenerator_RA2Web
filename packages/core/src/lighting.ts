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
 *
 * 四档之外还提供「整点」曲线（`getLightingForHour`）：把 4 组实测值按
 * 00:00 / 06:00 / 12:00 / 18:00 摆成一条闭合日照曲线，中间整点线性插值，
 * 于是 24 个整点都能选，而锚点上的取值与四档预设逐位相同。
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

// ---------------------------------------------------------------------------
// 整点小时曲线
// ---------------------------------------------------------------------------

/**
 * 四档预设落在一天里的哪几个钟点（游戏光照表本身只有这 4 组，没有中间值）：
 * timeOfDay 3 = 00:00 深夜、0 = 06:00 日出、1 = 12:00 正午、2 = 18:00 黄昏。
 * 在这 4 个锚点之间按时间线性插值，就得到 24 个整点的天色 —— 曲线是闭合的
 * （18:00 → 24:00 接回 00:00），所以 19..23 点会自然落回夜色。
 */
const ANCHOR_HOURS = [0, 6, 12, 18, 24] as const;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 24 个整点的中文时段名（前端下拉标签）。 */
export const HOUR_LABELS: Record<number, string> = {
  0: '00:00 深夜', 1: '01:00 深夜', 2: '02:00 凌晨', 3: '03:00 凌晨',
  4: '04:00 黎明前', 5: '05:00 黎明', 6: '06:00 日出', 7: '07:00 清晨',
  8: '08:00 清晨', 9: '09:00 上午', 10: '10:00 上午', 11: '11:00 上午',
  12: '12:00 正午', 13: '13:00 下午', 14: '14:00 下午', 15: '15:00 下午',
  16: '16:00 傍晚', 17: '17:00 傍晚', 18: '18:00 黄昏', 19: '19:00 入夜',
  20: '20:00 入夜', 21: '21:00 夜间', 22: '22:00 夜间', 23: '23:00 深夜',
};

/** 所有可选整点（0..23）。 */
export const LIGHTING_HOURS: readonly number[] = Array.from({ length: 24 }, (_, i) => i);

/** 每个整点在四个锚点里的位置（返回锚点数组下标 0..3 与段内比例 t）。 */
function hourToSegment(hour: number): { index: number; t: number } {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  let index = 0;
  while (index < 3 && h >= ANCHOR_HOURS[index + 1]) {
    index += 1;
  }
  const span = ANCHOR_HOURS[index + 1] - ANCHOR_HOURS[index];
  const t = span === 0 ? 0 : (h - ANCHOR_HOURS[index]) / span;
  return { index, t };
}

/** 某个环境的锚点曲线（顺序：00:00、06:00、12:00、18:00、24:00=00:00）。 */
function curveOf(environment: LightingEnvironment): LightingValues[] {
  const table = TABLES[environment] ?? TEMPERATE_TABLE;
  return [table[3], table[0], table[1], table[2], table[3]];
}

/**
 * 取某个环境 + 某个整点（0..23）的光照值：四个实测锚点之间线性插值。
 * 整点正落在锚点上时与 `getLightingPreset` 完全一致。
 */
export function getLightingForHour(
  environment: LightingEnvironment,
  hour: number,
): LightingValues {
  const curve = curveOf(environment);
  const { index, t } = hourToSegment(hour);
  const a = curve[index];
  const b = curve[index + 1];
  return {
    Ambient: round6(clamp(lerp(a.Ambient, b.Ambient, t), CHANNEL_MIN, CHANNEL_MAX)),
    Red: round6(clamp(lerp(a.Red, b.Red, t), CHANNEL_MIN, CHANNEL_MAX)),
    Green: round6(clamp(lerp(a.Green, b.Green, t), CHANNEL_MIN, CHANNEL_MAX)),
    Blue: round6(clamp(lerp(a.Blue, b.Blue, t), CHANNEL_MIN, CHANNEL_MAX)),
    Level: round6(lerp(a.Level, b.Level, t)),
  };
}

/** 整点标签；越界时裁到 0..23。 */
export function getHourLabel(hour: number): string {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  return HOUR_LABELS[h];
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
