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

/** 地图生成结果 */
export interface GenerateResult {
  /** 生成的地图 INI 内容 */
  mapContent: string;
  /** 建议的文件名（含扩展名） */
  fileName: string;
}
