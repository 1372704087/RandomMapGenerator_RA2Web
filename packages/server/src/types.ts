/**
 * 共享类型定义
 *
 * 服务器端 API 与地图生成器之间共享的数据结构。
 */

/** 玩家出生点方向 */
export type Direction = 'N' | 'S' | 'W' | 'E' | 'NE' | 'SE' | 'NW' | 'SW';

/** 所有方向常量，按固定顺序排列 */
export const ALL_DIRECTIONS: Direction[] = [
  'N',
  'S',
  'W',
  'E',
  'NE',
  'SE',
  'NW',
  'SW',
];

/**
 * 各方向的玩家出生点数量。
 *
 * 对应 C# PlacePlayerLocation(number, direction) 的参数。
 * 每个方向的出生点数量，所有方向的总数不能超过 8。
 */
export interface PlayerLocations {
  N?: number;
  S?: number;
  W?: number;
  E?: number;
  NE?: number;
  SE?: number;
  NW?: number;
  SW?: number;
}

/** 建筑损坏设置 */
export interface DamagedBuildingOptions {
  /** 最小生命值 (0-256) */
  min: number;
  /** 最大生命值 (0-256) */
  max: number;
  /** 被完全摧毁的概率 (0-100) */
  destroyP: number;
}

/**
 * 地图生成请求选项。
 *
 * 对应 C# Program.cs 中的命令行参数与生成流程配置。
 */
export interface GenerateOptions {
  /** 地图宽度（isometric tile 数）。为 0 时随机生成。 */
  width: number;
  /** 地图高度（isometric tile 数）。为 0 时随机生成。 */
  height: number;
  /** 地形类型（theater 目录名），如 "TEMPERATE"、"DESERT"、"NEWURBAN"、"TEMPERATE_Islands" */
  theaterType: string;
  /** 地图名称，未提供时使用全局 settings.ini 中的 OutputName */
  name?: string;
  /** 游戏模式，如 "standard"、"megawealth"、"navalwar" */
  gamemode?: string;
  /** 各方向的玩家出生点数量 */
  playerLocations: PlayerLocations;
  /** 是否完全随机（随机地图尺寸等） */
  totalRandom?: boolean;
  /** 建筑损坏设置，true 表示随机损坏，或提供具体参数 */
  damagedBuilding?: boolean | DamagedBuildingOptions;
  /** 随机污迹密度 (0-0.5)，不提供或为 0 则不放置污迹 */
  smudge?: number;
  /**
   * VERA20k 适配：允许最多 30 个出生点与超大尺寸地图
   * （Width+Height ≤ 1024，最大正方形 512×512；>512 时 overlay 用 1024 网格）。
   */
  vera20k?: boolean;
  /**
   * 随机种子（0..2147483647 的整数）。给了就复现同一张图；不给则由服务端现摇一个，
   * 并通过响应头 `X-Map-Seed` 回给调用方，方便事后复现。
   */
  seed?: number;

  /**
   * 环境光照（`[Lighting]` 段）。不传 = `auto`，即原版行为：
   * settings.ini 带光照区间的 theater（目前只有 DESERT）随机抖动，其余不写；
   * 传 `preset`/`random`/`custom` 则按时间段 + 环境主题强制写入一组颜色。
   */
  lighting?: LightingRequest;
}

/** 地图尺寸范围 */
export interface SizeRange {
  min: number;
  max: number;
}

/** Theater 的尺寸配置 */
export interface TheaterSizeConfig {
  gigantic: SizeRange;
  big: SizeRange;
  medium: SizeRange;
  small: SizeRange;
}

/**
 * Theater 信息（用于 /api/theaters 接口返回）。
 */
export interface TheaterInfo {
  /** 目录名，如 "TEMPERATE"、"DESERT" */
  name: string;
  /** Theater 枚举名，如 "TEMPERATE"、"DESERT" */
  theater: string;
  /** 地图单元尺寸，如 "15x15"、"25x25" */
  mapUnitSize: string;
  /** 顶角坐标，如 "13,13" */
  topCorner: string;
  /** 底部空间 */
  bottomSpace: number;
  /** 是否有光照范围设置 */
  hasLighting: boolean;
  /** 是否有 addition.ini */
  hasAdditionIni: boolean;
  /** 是否有 cannotplacesmudge.map */
  hasCannotPlaceSmudge: boolean;
  /** 地图尺寸范围配置（可选，TEMPERATE 没有） */
  sizeConfig?: TheaterSizeConfig;
  /** 玩家人数对应的尺寸增量 */
  playerAdditions?: Record<string, number>;
  /** 地图单元文件数量 */
  mapUnitCount: number;
}

/**
 * 环境光照请求。
 *
 * - `auto`（默认）：沿用原版行为 —— settings.ini 带光照区间的 theater（目前只有
 *   DESERT）随机抖动，其余 theater 不写 `[Lighting]`；
 * - `preset`：按“环境主题 + 时间段”写死一组真实游戏光照值，所有 theater 都能用；
 * - `random`：在 preset 的基准值上做 ±`jitter` 的随机抖动（仍受 seed 约束，可复现）；
 * - `custom`：在 preset 基准上叠加 `values` 里显式给出的通道。
 */
export type LightingMode = 'auto' | 'preset' | 'random' | 'custom';

/** `[Lighting]` 的十个键，全部是 0.2..1.6 的小数（`Ion*` 可省）。 */
export interface LightingRequestValues {
  Ambient?: number;
  Red?: number;
  Green?: number;
  Blue?: number;
  Level?: number;
  IonAmbient?: number;
  IonRed?: number;
  IonGreen?: number;
  IonBlue?: number;
  IonLevel?: number;
}

/** 光照请求参数。 */
export interface LightingRequest {
  /** 模式，缺省视为 `auto`。 */
  mode?: LightingMode;
  /** 时间段 0..3（0 暖光晨昏 / 1 正午 / 2 冷调 / 3 夜间），缺省 1。 */
  timeOfDay?: number;
  /** 环境主题；缺省由 theater 名推导（TEMPERATE→temperate，SNOW→snow 等）。 */
  environment?: 'temperate' | 'snow' | 'desert' | 'newurban' | 'islands';
  /** `custom` / `preset` 模式下要覆盖的通道值。 */
  values?: LightingRequestValues;
  /** `random` 模式的抖动幅度（0..0.5，缺省 0.08）。 */
  jitter?: number;
}

/** 实际写入地图的光照结果，回给调用方便于核对/复现。 */
export interface LightingResult {
  mode: LightingMode;
  environment: 'temperate' | 'snow' | 'desert' | 'newurban' | 'islands';
  timeOfDay: number;
  /** 最终写进 `[Lighting]` 的数值。 */
  values: {
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
  };
}

/** 地图生成结果 */
export interface GenerateResult {
  /** 生成的地图 INI 内容 */
  mapContent: string;
  /** 建议的文件名（含扩展名） */
  fileName: string;
  /** 本次实际使用的随机种子（给了就用给的，没给就是服务端临时摇的） */
  seed?: number;
  /** 本次实际写入的环境光照（未指定 `lighting` 时不返回） */
  lighting?: LightingResult;
}
