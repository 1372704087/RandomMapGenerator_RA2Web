/**
 * 昼夜交替（游戏内按周期循环切换环境光）。
 *
 * 为什么不能只写 `[Lighting]`：那张表是**开局那一刻**的静态光照，游戏跑起来
 * 就不会再变。想让它一局里天黑、天亮，只能用地图触发器在运行时改光照，
 * 而 YR 里能改光照的动作只有四条（ModEnc「Actions (maps)/RA2YR」）：
 *
 *   Action 73  = Set ambient light      —— 环境光亮度，参数是 0..100 的百分比
 *   Action 142 = Retint Red             —— 红色通道，同样按百分比
 *   Action 143 = Retint Green
 *   Action 144 = Retint Blue
 *   Action 53 / 54 = Enable / Disable Trigger —— 参数是另一个触发器的 ID
 *
 * 另外 `[Lighting]` 的 Level（高差光照）在运行时**没有任何动作能改**，只能在
 * 地图文件里定死，所以这里把它按各阶段的值写进 `[Lighting]`，实际生效的是
 * 开局那一档（夜里那几档更小的 Level 只体现在静态图上）。
 *
 * 触发链怎么排成"循环"：
 *   Event 13 = Time Units Passed，计时基准是「触发器被激活之后过了多久」，
 *   触发器被 54 禁用后停表、被 53 重新启用后重新从 0 计。于是用环形链：
 *
 *     开局：基础 `[Lighting]` = 第 0 档，T0 启用，其余 T1..T_{n-1} 全部禁用
 *     T0 等 d0 秒 → 把光切成第 1 档 → 启用 T1、禁用自己
 *     T1 等 d1 秒 → 第 2 档 → 启用 T2、禁用自己
 *     ...
 *     T_{n-1} 等 d_{n-1} 秒 → 回到第 0 档 → 启用 T0、禁用自己
 *
 *   d0..d_{n-1} 之和 = cycleSeconds，所以一轮（白天+黑夜）正好 cycleSeconds 秒。
 *   由于 53/54 是"激活即重新计时"，这条链天然是严格周期，不会漂移。
 *
 * 编码格式（ModEnc 明确，且与我们上一版离子风暴不同）：
 *   [Triggers] ID=HOUSE,<linked>,NAME,DISABLED,EASY,NORMAL,HARD,TRANSFERABLE
 *   [Events]   ID=NUM,E1,E1P1,E1P2          ← 第一个字段是条件数量
 *   [Actions]  ID=NUM,A1,A1P1..A1P7          ← 第一个字段是动作数量，每个动作 7 个参数
 *   [Tags]     TAGID=<持久值>,NAME,TRIGGERID  ← 持久值 2 = 永久（可被反复启用）
 *   [CellTags] <y><xxx>=TAGID                ← tag 必须挂到格子上才会被处理
 *   Action 的 P7 一律按字母写（0=A、1=B…25=Z、26=AA），非 waypoint 动作用 A（=0）。
 */

import { IniFile } from './io/iniFile';
import { formatActions, formatEvents, formatWaypointCell } from './trigger';
import {
  getLightingForHour,
  getHourLabel,
  theaterToLightingEnvironment,
  LightingEnvironment,
  LightingValues,
} from './lighting';

/** 请求参数。 */
export interface DayNightOptions {
  /** 不传/false = 完全不写触发器，保持静态光照。 */
  enabled?: boolean;
  /** 一轮（白天 + 黑夜）的总时长，秒。 */
  cycleSeconds?: number;
  /** 关键帧数：2 = 只有白天/黑夜，4 = 清晨/正午/黄昏/深夜，24 = 逐整点全走一遍。 */
  stages?: number;
  /** 开局是几点（0..23），默认 6 点日出。 */
  startHour?: number;
  /** 是否同时改 RGB 三个通道（动作 142/143/144），默认 true。 */
  retint?: boolean;
  /** 环境主题；不传则由 theater 推导。 */
  environment?: LightingEnvironment;
}

/** 一个阶段（一个关键帧）的最终形态。 */
export interface DayNightStage {
  index: number;
  /** 该阶段代表的钟点（0..23）。 */
  hour: number;
  /** 钟点中文标签，如「12:00 正午」。 */
  label: string;
  /** 该阶段持续秒数。 */
  seconds: number;
  /** 该阶段写进 `[Lighting]`/触发动作的光照值。 */
  values: LightingValues;
  /** 写进动作 73 的百分比。 */
  ambientPercent: number;
  /** 该阶段的触发器 ID（同时是 `[Events]`/`[Actions]` 的键）。 */
  triggerId: string;
  /** 该阶段挂格子用的 tag ID。 */
  tagId: string;
}
/** 实际写入结果。 */
export interface DayNightResult {
  enabled: true;
  cycleSeconds: number;
  environment: LightingEnvironment;
  stages: DayNightStage[];
  /** 实际使用的动作号（顺序：环境光 → 红 → 绿 → 蓝 → 启用下一档 → 禁用自己）。 */
  actions: number[];
  /** Event 13 = Time Units Passed。 */
  eventId: number;
  /** tag 挂载的格子（每档一个，均在地图中线上）。 */
  cellTags: Array<{ cell: { x: number; y: number }; key: string; tagId: string }>;
}
/** 一轮时长范围（秒）。 */
export const DAYNIGHT_MIN_CYCLE = 60;
export const DAYNIGHT_MAX_CYCLE = 7200;
export const DAYNIGHT_DEFAULT_CYCLE = 600;

/** 关键帧数范围。 */
export const DAYNIGHT_MIN_STAGES = 2;
export const DAYNIGHT_MAX_STAGES = 24;
export const DAYNIGHT_DEFAULT_STAGES = 4;

/** 触发器 ID 起始（纯数字，避免十六进制/十进制解析歧义）。 */
export const DAYNIGHT_TRIGGER_BASE = 16100000;
/** tag ID 起始，与触发器 ID 隔一段。 */
export const DAYNIGHT_TAG_BASE = 16110000;

export const DAYNIGHT_EVENT_TIME_PASSED = 13;
export const DAYNIGHT_ACTION_AMBIENT = 73;
export const DAYNIGHT_ACTION_RED = 142;
export const DAYNIGHT_ACTION_GREEN = 143;
export const DAYNIGHT_ACTION_BLUE = 144;
export const DAYNIGHT_ACTION_ENABLE = 53;
export const DAYNIGHT_ACTION_DISABLE = 54;

/** tag 持久值：2 = 永久（否则切一轮之后 tag 就自我销毁，链断掉）。 */
export const DAYNIGHT_TAG_PERSISTENCE = 2;

export { formatActions, formatEvents, waypointLetter } from './trigger';

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function clampCycle(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DAYNIGHT_DEFAULT_CYCLE;
  return clamp(Math.round(value), DAYNIGHT_MIN_CYCLE, DAYNIGHT_MAX_CYCLE);
}

function clampStages(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DAYNIGHT_DEFAULT_STAGES;
  return clamp(Math.round(value), DAYNIGHT_MIN_STAGES, DAYNIGHT_MAX_STAGES);
}

function clampHour(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 6;
  return ((Math.round(value) % 24) + 24) % 24;
}

/** 各阶段的钟点：从 startHour 起把 24 小时等分。 */
export function stageHours(startHour: number, stages: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < stages; i++) {
    const raw = Math.round(startHour + (i * 24) / stages) % 24;
    out.push(((raw % 24) + 24) % 24);
  }
  return out;
}

/** 各阶段时长：等分 cycleSeconds，余数补在最后一档（保证总和相等）。 */
function stageDurations(cycleSeconds: number, stages: number): number[] {
  const per = Math.max(1, Math.floor(cycleSeconds / stages));
  const out: number[] = [];
  for (let i = 0; i < stages - 1; i++) out.push(per);
  out.push(Math.max(1, cycleSeconds - per * (stages - 1)));
  return out;
}

/** 在地图中线上挑 `count` 个互不相同的格子（tag 要一个格子挂一个）。 */
function pickTagCells(
  width: number,
  height: number,
  count: number,
): Array<{ x: number; y: number }> {
  const w = Math.max(2, Math.round(width));
  const h = Math.max(2, Math.round(height));
  const y = Math.min(h - 1, Math.max(0, Math.floor(h / 2)));
  const startX = Math.max(0, Math.min(w - 1, Math.floor(w / 2) - Math.floor(count / 2)));
  const cells: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const x = (startX + i) % w;
    cells.push({ x, y });
  }
  return cells;
}

/** `[CellTags]` 的键格式，与 `[Waypoints]` 的值相同：`<y><xxx>`。 */

/**
 * 把昼夜交替写进地图 INI。
 *
 * 调用顺序上必须在环境光照之后（本函数会覆盖 `[Lighting]` 的五个基础键），
 * 且要在离子风暴之前（风暴要写 Ion* 键，`ChangeLighting` 会删掉它们）。
 */
export function applyDayNight(
  iniContent: string,
  options: DayNightOptions | undefined,
  theaterType: string,
  width: number,
  height: number,
): { iniContent: string; dayNight?: DayNightResult } {
  if (!options?.enabled) return { iniContent };

  const cycleSeconds = clampCycle(options.cycleSeconds);
  const stageCount = clampStages(options.stages);
  const startHour = clampHour(options.startHour);
  const retint = options.retint !== false;
  const environment =
    options.environment ?? theaterToLightingEnvironment(theaterType);

  const mapFile = new IniFile(iniContent);
  const header = mapFile.GetSection('Header');
  const headerWidth = Number(header?.GetStringValue('Width', '') ?? '');
  const headerHeight = Number(header?.GetStringValue('Height', '') ?? '');
  const mapWidth = Number.isFinite(headerWidth) && headerWidth > 0 ? headerWidth : width;
  const mapHeight =
    Number.isFinite(headerHeight) && headerHeight > 0 ? headerHeight : height;

  const hours = stageHours(startHour, stageCount);
  const durations = stageDurations(cycleSeconds, stageCount);
  const cells = pickTagCells(mapWidth, mapHeight, stageCount);

  const lighting = mapFile.GetSection('Lighting') ?? mapFile.AddSection('Lighting');
  const triggers = mapFile.GetSection('Triggers') ?? mapFile.AddSection('Triggers');
  const events = mapFile.GetSection('Events') ?? mapFile.AddSection('Events');
  const actions = mapFile.GetSection('Actions') ?? mapFile.AddSection('Actions');
  const tags = mapFile.GetSection('Tags') ?? mapFile.AddSection('Tags');
  const cellTags = mapFile.GetSection('CellTags') ?? mapFile.AddSection('CellTags');

  const stageValues = hours.map((hour) => getLightingForHour(environment, hour));
  // 开局那一档直接写进 [Lighting]：玩家一进游戏看到的就是"现在的天色"
  const first = stageValues[0];
  lighting.SetStringValue('Ambient', first.Ambient.toFixed(6));
  lighting.SetStringValue('Red', first.Red.toFixed(6));
  lighting.SetStringValue('Green', first.Green.toFixed(6));
  lighting.SetStringValue('Blue', first.Blue.toFixed(6));
  lighting.SetStringValue('Level', first.Level.toFixed(6));

  const resultStages: DayNightStage[] = [];
  const cellList: DayNightResult['cellTags'] = [];

  for (let i = 0; i < stageCount; i++) {
    const triggerId = String(DAYNIGHT_TRIGGER_BASE + i);
    const tagId = String(DAYNIGHT_TAG_BASE + i);
    const nextId = String(DAYNIGHT_TRIGGER_BASE + ((i + 1) % stageCount));
    const values = stageValues[i];
    const ambientPercent = clamp(Math.round(values.Ambient * 100), 1, 100);

    // 第 0 档开局就启用，其余等前一档把它们叫起来
    triggers.SetStringValue(
      triggerId,
      `Neutral,<none>,Day Night Cycle ${i + 1},${i === 0 ? 0 : 1},1,1,1,0`,
    );
    events.SetStringValue(
      triggerId,
      formatEvents([{ id: DAYNIGHT_EVENT_TIME_PASSED, params: [0, durations[i]] }]),
    );

    // 每一档做六件事：切环境光/RGB，然后把链交给下一档并关掉自己
    const blocks: Array<{ id: number; params?: Array<number | string> }> = [
      { id: DAYNIGHT_ACTION_AMBIENT, params: [0, ambientPercent] },
    ];
    if (retint) {
      blocks.push(
        { id: DAYNIGHT_ACTION_RED, params: [0, clamp(Math.round(values.Red * 100), 0, 200)] },
        { id: DAYNIGHT_ACTION_GREEN, params: [0, clamp(Math.round(values.Green * 100), 0, 200)] },
        { id: DAYNIGHT_ACTION_BLUE, params: [0, clamp(Math.round(values.Blue * 100), 0, 200)] },
      );
    }
    blocks.push(
      // P2 = 目标触发器 ID
      { id: DAYNIGHT_ACTION_ENABLE, params: [0, nextId] },
      { id: DAYNIGHT_ACTION_DISABLE, params: [0, triggerId] },
    );
    actions.SetStringValue(triggerId, formatActions(blocks));

    tags.SetStringValue(tagId, `${DAYNIGHT_TAG_PERSISTENCE},DAY NIGHT ${i + 1},${triggerId}`);
    const key = formatWaypointCell(cells[i].x, cells[i].y);
    cellTags.SetStringValue(key, tagId);
    cellList.push({ cell: cells[i], key, tagId });

    resultStages.push({
      index: i,
      hour: hours[i],
      label: getHourLabel(hours[i]),
      seconds: durations[i],
      values,
      ambientPercent,
      triggerId,
      tagId,
    });
  }

  return {
    iniContent: mapFile.WriteIniFile(),
    dayNight: {
      enabled: true,
      cycleSeconds,
      environment,
      stages: resultStages,
      eventId: DAYNIGHT_EVENT_TIME_PASSED,
      actions: retint
        ? [
            DAYNIGHT_ACTION_AMBIENT,
            DAYNIGHT_ACTION_RED,
            DAYNIGHT_ACTION_GREEN,
            DAYNIGHT_ACTION_BLUE,
            DAYNIGHT_ACTION_ENABLE,
            DAYNIGHT_ACTION_DISABLE,
          ]
        : [DAYNIGHT_ACTION_AMBIENT, DAYNIGHT_ACTION_ENABLE, DAYNIGHT_ACTION_DISABLE],
      cellTags: cellList,
    },
  };
}
