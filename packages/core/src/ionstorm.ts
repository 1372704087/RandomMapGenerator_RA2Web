/**
 * 随机离子风暴（RA2/YR 的 Lightning Storm）。
 *
 * 背景：`[SpecialFlags] IonStorms=yes` 在红警2/尤里的复仇里是**失效标志**
 * （ModEnc 明确标注：游戏会读，但什么都不做，属 TS 时代遗留），所以想在地图上
 * 出现“过一阵来一场雷暴”，唯一可行的是 trigger：
 *
 *   Action 102 = Lightning Storm strike —— 在指定 waypoint 处起一场闪电风暴
 *   Event 13   = Time Units Passed —— 相对上一次判定经过 N 秒（trigger 循环时重新计时）
 *   Event 51   = Random Delay —— 在参数的 50%~150% 之间随机触发一次
 *
 * 风暴本身的观感由两处决定：
 *   - `[Lighting]` 的 Ion* 五行（风暴期间替换环境光，等同第 7 关/原版默认值）
 *   - `[General]` 的 Lightning* 数值（伤害、持续、命中间隔、散布范围）
 * 这里默认用 **rulesmd.ini 的原版数值**，即和天气控制机（GAWEAT）放出的大招一致。
 *
 * 触发链的书写格式照抄游戏自带模板地图（`packages/server/resources/MapUnits/*`）：
 *   [Triggers] 0E000000=Neutral,<none>,Random Ion Storm,0,1,1,1,2
 *   [Events]   0E000000=13,0,600
 *   [Actions]  0E000000=102,0,0,0,0,0,0,16
 *   [Tags]     0E000001=2,RANDOM ION STORM,0E000000
 *   [Waypoints] 16=<Y><XXX>
 * 触发器第 5 个数字是“0=只触发一次 / 2=循环”，模板与 FA2 输出都用 0,1,1,1 前缀。
 */

import { IniFile } from './io/iniFile';

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
  /** 两场风暴之间的间隔秒数（Event 13 / 51 的参数）。 */
  intervalSeconds?: number;
  /** true 用 Event 51（实际间隔在 0.5~1.5 倍之间随机），false 用 Event 13（严格周期）。 */
  randomize?: boolean;
  /** 覆盖任意一条 `[General]` 数值，留空即用原版。 */
  values?: Partial<IonStormValues>;
}

/** 实际写入结果（回显给前端 / 响应头）。 */
export interface IonStormResult {
  enabled: true;
  intervalSeconds: number;
  randomize: boolean;
  values: IonStormValues;
  waypoint: number;
  cell: { x: number; y: number };
  eventId: number;
  actionId: number;
}

/** 间隔允许范围（秒）。 */
export const ION_STORM_MIN_INTERVAL = 30;
export const ION_STORM_MAX_INTERVAL = 3600;
export const ION_STORM_DEFAULT_INTERVAL = 600;

/** 触发器 / 标签的固定 ID（生成出来的地图里 `[Triggers]` 本来是空的，不会冲突）。 */
export const ION_STORM_TRIGGER_ID = '0E000000';
export const ION_STORM_TAG_ID = '0E000001';
/** 风暴中心 waypoint 编号。两位数以内的编号在 action 参数里可直接写十进制。 */
export const ION_STORM_WAYPOINT = 16;
/** Event 13 = Time Units Passed（严格周期）；Event 51 = Random Delay（随机窗口）。 */
export const ION_STORM_EVENT_PERIODIC = 13;
export const ION_STORM_EVENT_RANDOM = 51;
/** Action 102 = Lightning Storm strike（在 waypoint 处起风暴）。 */
export const ION_STORM_ACTION = 102;

function clampInterval(value: number): number {
  if (!Number.isFinite(value)) return ION_STORM_DEFAULT_INTERVAL;
  return Math.min(
    ION_STORM_MAX_INTERVAL,
    Math.max(ION_STORM_MIN_INTERVAL, Math.round(value)),
  );
}

/** `[Waypoints]` 的值格式：`<y><xxx>`（y 不加前导零，x 补 3 位）。 */
export function formatWaypointCell(x: number, y: number): string {
  return `${y}${String(x).padStart(3, '0')}`;
}

/**
 * 把随机离子风暴写进地图 INI。
 *
 * 必须在环境光照之后调用：`ChangeLighting` 会把未显式给出的 Ion* 键删掉，
 * 而风暴需要它们。
 *
 * @param iniContent 地图 INI 文本
 * @param options    请求参数
 * @param width      地图 x 边长（用于取中心格）
 * @param height     地图 y 边长
 */
export function applyIonStorm(
  iniContent: string,
  options: IonStormOptions | undefined,
  width: number,
  height: number,
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

  // 风暴中心：地图正中的格。优先用 [Header] 的真实尺寸（请求尺寸与实际网格
  // 并不相同，比如请求 150x150 生成出来是 145x139），拿不到才退回调用方给的。
  const header = mapFile.GetSection('Header');
  const headerWidth = Number(header?.GetStringValue('Width', '') ?? '');
  const headerHeight = Number(header?.GetStringValue('Height', '') ?? '');
  const mapWidth = Number.isFinite(headerWidth) && headerWidth > 0 ? headerWidth : width;
  const mapHeight = Number.isFinite(headerHeight) && headerHeight > 0 ? headerHeight : height;
  const cell = {
    x: Math.max(0, Math.floor(mapWidth / 2)),
    y: Math.max(0, Math.floor(mapHeight / 2)),
  };

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

  // 风暴中心 waypoint（中心格已在上面按 [Header] 真实尺寸算出）
  const waypoints = mapFile.GetSection('Waypoints') ?? mapFile.AddSection('Waypoints');
  waypoints.SetStringValue(String(ION_STORM_WAYPOINT), formatWaypointCell(cell.x, cell.y));

  // 触发器：循环（2 = repeating），前三项难度全开
  const triggers = mapFile.GetSection('Triggers') ?? mapFile.AddSection('Triggers');
  triggers.SetStringValue(
    ION_STORM_TRIGGER_ID,
    'Neutral,<none>,Random Ion Storm,0,1,1,1,2',
  );
  const events = mapFile.GetSection('Events') ?? mapFile.AddSection('Events');
  events.SetStringValue(
    ION_STORM_TRIGGER_ID,
    `${randomize ? ION_STORM_EVENT_RANDOM : ION_STORM_EVENT_PERIODIC},0,${intervalSeconds}`,
  );
  // Action 102 的第 7 个参数是 waypoint 编号
  const actions = mapFile.GetSection('Actions') ?? mapFile.AddSection('Actions');
  actions.SetStringValue(
    ION_STORM_TRIGGER_ID,
    `${ION_STORM_ACTION},0,0,0,0,0,0,${ION_STORM_WAYPOINT}`,
  );
  const tags = mapFile.GetSection('Tags') ?? mapFile.AddSection('Tags');
  tags.SetStringValue(
    ION_STORM_TAG_ID,
    `2,RANDOM ION STORM,${ION_STORM_TRIGGER_ID}`,
  );

  return {
    iniContent: mapFile.WriteIniFile(),
    ionStorm: {
      enabled: true,
      intervalSeconds,
      randomize,
      values,
      waypoint: ION_STORM_WAYPOINT,
      cell,
      eventId: randomize ? ION_STORM_EVENT_RANDOM : ION_STORM_EVENT_PERIODIC,
      actionId: ION_STORM_ACTION,
    },
  };
}
