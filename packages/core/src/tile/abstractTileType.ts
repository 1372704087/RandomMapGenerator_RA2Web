/**
 * 抽象图块类型
 *
 * 对应 C# RandomMapGenerator.TileInfo.AbstractTileType。
 * 描述一个“地图单元模板”中单个格位的图块类型信息，
 * 不包含该格位在最终地图上的坐标位置（坐标由 AbstractTile 承载）。
 */
export class AbstractTileType {
  /** 对应 C# int TileNum（图块编号） */
  public TileNum: number = 0;
  /** 对应 C# int SubTile（子图块索引） */
  public SubTile: number = 0;
  /** 对应 C# int Z（高度偏移） */
  public Z: number = 0;
  /** 对应 C# bool Used（该格位是否被使用） */
  public Used: boolean = false;
}
