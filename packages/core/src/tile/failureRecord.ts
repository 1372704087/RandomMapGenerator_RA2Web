import { WorkingMap } from '../workingMap';

/**
 * 抽象地图单元放置失败记录
 *
 * 对应 C# RandomMapGenerator.TileInfo.FailureAbstractMapUnitRecord。
 * 记录某个坐标位置上放置失败的地图单元名称列表，用于避免重复尝试
 * 具有相同连接类型的单元。
 *
 * 移植要点：
 *   - WorkingMap.GetAbstractMapUnitByName 始终返回有效 AbstractMapUnit
 *     （未找到时返回空实例，与 C# 原版语义一致）。
 */
export class FailureAbstractMapUnitRecord {
  /** 对应 C# int X（失败位置 X） */
  public X: number = 0;
  /** 对应 C# int Y（失败位置 Y） */
  public Y: number = 0;
  /** 对应 C# List&lt;string&gt; Name（失败单元名称列表） */
  public Name: string[] = [];

  /**
   * 添加失败记录
   *
   * 对应 C# AddFailureRecord(int x, int y, string name)。
   * 更新记录位置并将失败单元名称追加到列表。
   */
  public AddFailureRecord(x: number, y: number, name: string): void {
    this.X = x;
    this.Y = y;
    this.Name.push(name);
  }

  /**
   * 判断给定坐标是否为本记录的目标位置
   *
   * 对应 C# IsTargetFailureRecord(int x, int y)。
   */
  public IsTargetFailureRecord(x: number, y: number): boolean {
    if (x === this.X && y === this.Y) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * 判断与给定单元具有相同连接类型的单元是否已在失败记录中
   *
   * 对应 C# IsInFailureRecord(string name)。
   * 比较四个方向（NE/SE/NW/SW）的连接类型是否完全一致。
   */
  public IsInFailureRecord(name: string): boolean {
    const targetMU = WorkingMap.GetAbstractMapUnitByName(name);
    for (const n of this.Name) {
      const thisMU = WorkingMap.GetAbstractMapUnitByName(n);
      if (
        targetMU.NEConnectionType === thisMU.NEConnectionType &&
        targetMU.SEConnectionType === thisMU.SEConnectionType &&
        targetMU.NWConnectionType === thisMU.NWConnectionType &&
        targetMU.SWConnectionType === thisMU.SWConnectionType
      ) {
        return true;
      }
    }
    return false;
  }
}
