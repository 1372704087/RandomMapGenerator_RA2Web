/**
 * 地形剧场类型枚举
 *
 * 对应 C# RandomMapGenerator.TileInfo.Theater。
 * 红警2中不同的剧场决定了一套地形图块资源（.tmp/.tst 等）。
 */
export enum Theater {
  /** 温带 */
  TEMPERATE = 0,
  /** 雪地 */
  SNOW = 1,
  /** 城市 */
  URBAN = 2,
  /** 新城市（尤里复仇） */
  NEWURBAN = 3,
  /** 月球（尤里复仇） */
  LUNAR = 4,
  /** 沙漠（尤里复仇） */
  DESERT = 5
}

/**
 * 通用图块编号枚举
 *
 * 对应 C# RandomMapGenerator.TileInfo.Common。
 * 用于表示抽象图块类型中“无图块 / 空白”的特殊编号。
 */
export enum Common {
  /** 空图块编号 */
  _000_Empty = -1
}
