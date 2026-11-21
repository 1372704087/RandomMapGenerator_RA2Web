/**
 * 随机离子风暴（RA2/YR 的 Lightning Storm）。
 *
 * 背景：`[SpecialFlags] IonStorms=yes` 在红警2/尤里的复仇里是**失效标志**
 * （ModEnc 明确标注：游戏会读，但什么都不做，属 TS 时代遗留），所以想在地图上
 * 出现"过一阵来一场雷暴"，唯一可行的是 trigger：
 *
 *   Action 102 = Lightning Storm strike —— 在指定 waypoint 处起一场闪电风暴
 *   Event 13   = Time Units Passed —— 相对上一次判定经过 N 秒（trigger 循环时重新计时）
 *   Event 51   = Random Delay —— 在参数的 50%~150% 之间随机触发一次
 *
 * 引擎没有"随机选点"原语：Action 102 只认一个固定 waypoint。所以"随机位置"用
 * **多点位 + 各自错开的定时循环**近似：在地图上均分若干片、每片随机落一个点位，
 * 每个点位配一个独立 trigger，触发间隔 = 平均间隔 × 点位数。玩家看到的就是
 * "隔一会儿某个地方开始打雷"，位置与顺序都不固定（randomize 时每个点位自己
 * 还在 0.5~1.5 倍窗口里漂移）。
 *
 * 风暴本身的观感由两处决定：
 *   - `[Lighting]` 的 Ion* 五行（风暴期间替换环境光，等同原版默认值）
 *   - `[General]` 的 Lightning* 数值（伤害、持续、命中间隔、散布范围）
 * 这里默认用 **rulesmd.ini 的原版数值**，即和天气控制机（GAWEAT）放出的大招一致。
 *
 * 触发链的书写格式按 ModEnc（`Triggers` / `Events` / `Actions (maps)/RA2YR`）：
 *   [Triggers] 0E000000=Neutral,<none>,Random Ion Storm,0,1,1,1,0
 *   [Events]   0E000000=1,13,0,2400          ← 首位是"条件数量"
 *   [Actions]  0E000000=1,102,0,0,0,0,0,0,Q  ← 首位是"动作数量"，P7 用字母（16 = "Q"）
 *   [Tags]     0E000010=2,RANDOM ION STORM 1,0E000000
 *   [CellTags] <y><xxx>=0E000010             ← tag 必须挂到格子上才会被处理
 *   [Waypoints] 16=<Y><XXX>
 *
 * 三个曾经踩过的坑，都已在 `trigger.ts` 里统一处理：
 * 1. `[Events]` / `[Actions]` 少了数量前缀 → 引擎会把动作号当数量读，整条链失效；
 * 2. 动作 P7（waypoint）直接写十进制数字 → ModEnc 明确要求字母编码（0=A、16=Q）；
 * 3. tag 只写进 `[Tags]` 却没挂 `[CellTags]` → 没有载体，永远不会被评估。
 */

import { IniFile } from './io/iniFile';
import { Random } from './random';
import {
  formatActions,
  formatEvents,
  formatWaypointCell,
  hexId,
  waypointLetter,
} from './trigger';

export { hexId, formatWaypointCell } from './trigger';

/** `[General]` 里的闪电风暴数值（原版 rulesmd.ini 的量级）。 */
export interface IonStormValues {
  /** 单次雷击伤害，原版 250。 */
  damage: number;
  /** 雷击预警帧数，原版 250。 */
  deferment: number;
  /** 风暴持续帧数，原版 180。 */
  duration: number;
  /** 中心目标被击中的间隔帧数，原版 10。 */
  hitDelay: number;
  /** 随机落雷的散布范围（n×n 格），原版 10。 */
  cellSpread: number;
  /** 两道雷之间的间隔帧数，原版 5（官方注释：不要调小，有性能开销）。 */
  scatterDelay: number;
  /** 云块之间的城市街区距离，原版 3。 */
  separation: number;
}

/** 原版 `rulesmd.ini` 的闪电风暴数值。 */
export const ION_STORM_RULES_VALUES: IonStormValues = {
  damage: 250,
  deferment: 250,
  duration: 180,
  hitDelay: 10,
  cellSpread: 10,
  scatterDelay: 5,
  separation: 3,
};

/** 风暴期间替换环境光的 `[Lighting]` Ion* 五行（等同原版默认值）。 */
export const ION_STORM_LIGHTING: Record<string, number> = {
  IonAmbient: 0.65,
  IonRed: 0.695,
  IonGreen: 0.445,
  IonBlue: 0.775,
};

/** 请求参数。 */
export interface IonStormOptions {
  enabled?: boolean;
  /** 平均两场风暴之间的间隔秒数（每个点位的实际间隔 = 它 × 点位数）。 */
  intervalSeconds?: number;
  /** true 用 Event 51（实际间隔在 0.5~1.5 倍之间随机），false 用 Event 13（严格周期）。 */
  randomize?: boolean;
  /** 风暴点位数（1 = 只在地图中心；2..12 = 均分片区各随机落一点）。 */
  sites?: number;
  /** 覆盖任意一条 `[General]` 数值，留空即用原版。 */
  values?: Partial<IonStormValues>;
}

/** 单个风暴点位。 */
export interface IonStormSite {
  /** waypoint 编号（16 起）。 */
  waypoint: number;
  /** 点位格坐标。 */
  cell: { x: number; y: number };
  /** 该点位的触发器 ID（8 位十六进制字符串）。 */
  triggerId: string;
  /** 该点位关联的 tag ID。 */
  tagId: string;
  /** 该点位自己的触发间隔（秒）。 */
  intervalSeconds: number;
}

/** 实际写入结果（回显给前端 / 响应头）。 */
export interface IonStormResult {
  enabled: true;
  /** 平均间隔（所有点位合起来）。 */
  intervalSeconds: number;
  randomize: boolean;
  values: IonStormValues;
  /** 点位数。 */
  siteCount: number;
  /** 所有点位（第一个点位同时作为 `cell` / `waypoint` 的兼容回显）。 */
  sites: IonStormSite[];
  /** 首个点位的 waypoint 编号（兼容单点位时的旧字段）。 */
  waypoint: number;
  /** 首个点位的格坐标。 */
  cell: { x: number; y: number };
  /** 实际使用的触发事件号（13 = 严格周期，51 = 随机窗口）。 */
  eventId: number;
  /** 实际使用的动作号（102 = Lightning Storm strike）。 */
  actionId: number;
}

/** 间隔允许范围（秒）。 */
export const ION_STORM_MIN_INTERVAL = 30;
export const ION_STORM_MAX_INTERVAL = 3600;
export const ION_STORM_DEFAULT_INTERVAL = 600;

/** 点位数范围。 */
export const ION_STORM_MIN_SITES = 1;
export const ION_STORM_MAX_SITES = 12;
export const ION_STORM_DEFAULT_SITES = 4;

/** 首个 waypoint 编号。两位数以内的编号在 action 参数里可直接写十进制。 */
export const ION_STORM_WAYPOINT_BASE = 16;
/** 触发器 ID 起始值（生成出来的地图里 `[Triggers]` 本来是空的，不会冲突）。 */
export const ION_STORM_TRIGGER_BASE = 0x0e000000;
/** tag ID 起始值，与触发器 ID 相隔一段，避免撞号。 */
export const ION_STORM_TAG_BASE = 0x0e000010;
/** Event 13 = Time Units Passed（严格周期）；Event 51 = Random Delay（随机窗口）。 */
export const ION_STORM_EVENT_PERIODIC = 13;
export const ION_STORM_EVENT_RANDOM = 51;
/** Action 102 = Lightning Storm strike（在 waypoint 处起风暴）。 */
export const ION_STORM_ACTION = 102;

/** 兼容旧名：单点位时用的 waypoint 编号。 */
export const ION_STORM_WAYPOINT = ION_STORM_WAYPOINT_BASE;
export const ION_STORM_TRIGGER_ID = '0E000000';
export const ION_STORM_TAG_ID = '0E000010';

function clampInterval(value: number): number {
  if (!Number.isFinite(value)) return ION_STORM_DEFAULT_INTERVAL;
  return Math.min(
    ION_STORM_MAX_INTERVAL,
    Math.max(ION_STORM_MIN_INTERVAL, Math.round(value)),
  );
}

function clampSites(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ION_STORM_DEFAULT_SITES;
  }
  return Math.min(ION_STORM_MAX_SITES, Math.max(ION_STORM_MIN_SITES, Math.round(value)));
}

/** `[Waypoints]` 的值格式：`<y><xxx>`（y 不加前导零，x 补 3 位）。 */

/**
 * 选风暴点位。
 *
 * 1 个点位 = 地图正中；多个点位时把地图内缩 10%（至少 2 格）后的区域切成
 * 近似方形的网格，每格中心再按 `rng` 抖动 ±30% 格宽，保证既分散又不会压到边缘。
 * 抖动受种子约束，同一张图 + 同一个 seed 点位可复现。
 */
export function pickStormSites(
  mapWidth: number,
  mapHeight: number,
  count: number,
  rng?: Random,
): Array<{ waypoint: number; cell: { x: number; y: number } }> {
  const sites: Array<{ waypoint: number; cell: { x: number; y: number } }> = [];
  const n = clampSites(count);
  const width = Math.max(2, Math.round(mapWidth));
  const height = Math.max(2, Math.round(mapHeight));

  if (n === 1) {
    sites.push({
      waypoint: ION_STORM_WAYPOINT_BASE,
      cell: { x: Math.floor(width / 2), y: Math.floor(height / 2) },
    });
    return sites;
  }

  const marginX = Math.max(2, Math.min(Math.floor(width / 4), Math.round(width * 0.1)));
  const marginY = Math.max(2, Math.min(Math.floor(height / 4), Math.round(height * 0.1)));
  const x0 = marginX;
  const x1 = Math.max(x0, width - 1 - marginX);
  const y0 = marginY;
  const y1 = Math.max(y0, height - 1 - marginY);

  const cols = Math.min(n, Math.max(1, Math.ceil(Math.sqrt(n))));
  const rows = Math.max(1, Math.ceil(n / cols));
  const regionW = (x1 - x0) / cols;
  const regionH = (y1 - y0) / rows;

  const used = new Set<string>();
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const jitterX = rng ? (rng.NextDouble() * 0.6 - 0.3) * regionW : 0;
    const jitterY = rng ? (rng.NextDouble() * 0.6 - 0.3) * regionH : 0;
    let x = Math.round(x0 + (col + 0.5) * regionW + jitterX);
    let y = Math.round(y0 + (row + 0.5) * regionH + jitterY);
    x = Math.min(x1, Math.max(x0, x));
    y = Math.min(y1, Math.max(y0, y));
    // 小图上可能出现重复格，沿 x 方向挪一格避开
    let guard = 0;
    while (used.has(`${x},${y}`) && guard < Math.max(width, 4)) {
      x = x >= x1 ? x0 : x + 1;
      guard++;
    }
    used.add(`${x},${y}`);
    sites.push({
      waypoint: ION_STORM_WAYPOINT_BASE + i,
      cell: { x, y },
    });
  }
  return sites;
}

/**
 * 把随机离子风暴写进地图 INI。
 *
 * 必须在环境光照之后调用：`ChangeLighting` 会把未显式给出的 Ion* 键删掉，
 * 而风暴需要它们。
 *
 * @param iniContent 地图 INI 文本
 * @param options    请求参数
 * @param width      地图 x 边长（拿不到 `[Header]` 时的兜底）
 * @param height     地图 y 边长
 * @param rng        用于点位抖动（受种子约束）；不传则按片区正中落点
 */
export function applyIonStorm(
  iniContent: string,
  options: IonStormOptions | undefined,
  width: number,
  height: number,
  rng?: Random,
): { iniContent: string; ionStorm?: IonStormResult } {
  if (!options?.enabled) return { iniContent };

  const intervalSeconds = clampInterval(
    options.intervalSeconds ?? ION_STORM_DEFAULT_INTERVAL,
  );
  const randomize = options.randomize === true;
  const values: IonStormValues = { ...ION_STORM_RULES_VALUES };
  if (options.values) {
    for (const key of Object.keys(ION_STORM_RULES_VALUES) as (keyof IonStormValues)[]) {
      const v = options.values[key];
      if (typeof v === 'number' && Number.isFinite(v)) values[key] = v;
    }
  }

  const mapFile = new IniFile(iniContent);

  // 尺寸优先取 [Header] 的真实值：请求尺寸与实际网格并不相同（请求 150x150
  // 生成出来是 145x139），拿请求尺寸算点位会整体偏掉。
  const header = mapFile.GetSection('Header');
  const headerWidth = Number(header?.GetStringValue('Width', '') ?? '');
  const headerHeight = Number(header?.GetStringValue('Height', '') ?? '');
  const mapWidth = Number.isFinite(headerWidth) && headerWidth > 0 ? headerWidth : width;
  const mapHeight = Number.isFinite(headerHeight) && headerHeight > 0 ? headerHeight : height;

  // [General] —— 闪电风暴数值（原版值，写进来是为了显式表达与可覆盖）
  const general = mapFile.GetSection('General') ?? mapFile.AddSection('General');
  general.SetStringValue('LightningDamage', String(values.damage));
  general.SetStringValue('LightningDeferment', String(values.deferment));
  general.SetStringValue('LightningStormDuration', String(values.duration));
  general.SetStringValue('LightningHitDelay', String(values.hitDelay));
  general.SetStringValue('LightningCellSpread', String(values.cellSpread));
  general.SetStringValue('LightningScatterDelay', String(values.scatterDelay));
  general.SetStringValue('LightningSeparation', String(values.separation));

  // [Lighting] —— 风暴期间的环境光
  const lighting = mapFile.GetSection('Lighting') ?? mapFile.AddSection('Lighting');
  for (const [key, value] of Object.entries(ION_STORM_LIGHTING)) {
    lighting.SetStringValue(key, value.toFixed(6));
  }

  const sites = pickStormSites(mapWidth, mapHeight, options.sites ?? ION_STORM_DEFAULT_SITES, rng);
  const perSiteInterval = Math.min(
    24 * 3600,
    intervalSeconds * sites.length,
  );
  const eventId = randomize ? ION_STORM_EVENT_RANDOM : ION_STORM_EVENT_PERIODIC;

  const waypoints = mapFile.GetSection('Waypoints') ?? mapFile.AddSection('Waypoints');
  const triggers = mapFile.GetSection('Triggers') ?? mapFile.AddSection('Triggers');
  const events = mapFile.GetSection('Events') ?? mapFile.AddSection('Events');
  const actions = mapFile.GetSection('Actions') ?? mapFile.AddSection('Actions');
  const tags = mapFile.GetSection('Tags') ?? mapFile.AddSection('Tags');
  const cellTags = mapFile.GetSection('CellTags') ?? mapFile.AddSection('CellTags');

  const resultSites: IonStormSite[] = sites.map((site, index) => {
    const triggerId = hexId(ION_STORM_TRIGGER_BASE + index);
    const tagId = hexId(ION_STORM_TAG_BASE + index);

    waypoints.SetStringValue(
      String(site.waypoint),
      formatWaypointCell(site.cell.x, site.cell.y),
    );
    // 触发器：第 8 位是 TRANSFERABLE（不是循环标志），循环靠 tag 的持久值 2
    triggers.SetStringValue(triggerId, 'Neutral,<none>,Random Ion Storm,0,1,1,1,0');
    events.SetStringValue(
      triggerId,
      formatEvents([{ id: eventId, params: [0, perSiteInterval] }]),
    );
    // Action 102 的 P7 是 waypoint，按 ModEnc 必须写成字母（16 → "Q"）
    actions.SetStringValue(
      triggerId,
      formatActions([{ id: ION_STORM_ACTION, p7: waypointLetter(site.waypoint) }]),
    );
    tags.SetStringValue(tagId, `2,RANDOM ION STORM ${index + 1},${triggerId}`);
    // tag 挂到点位所在的格子上，否则没有载体、永远不会被评估
    cellTags.SetStringValue(formatWaypointCell(site.cell.x, site.cell.y), tagId);

    return {
      waypoint: site.waypoint,
      cell: site.cell,
      triggerId,
      tagId,
      intervalSeconds: perSiteInterval,
    };
  });

  const first = resultSites[0];
  return {
    iniContent: mapFile.WriteIniFile(),
    ionStorm: {
      enabled: true,
      intervalSeconds,
      randomize,
      values,
      siteCount: resultSites.length,
      sites: resultSites,
      waypoint: first.waypoint,
      cell: first.cell,
      eventId,
      actionId: ION_STORM_ACTION,
    },
  };
}
