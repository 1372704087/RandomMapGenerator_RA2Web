import { AbstractMapUnit } from './abstractMapUnit';
import { WorkingMap } from '../workingMap';

/**
 * 抽象地图成员（地图单元在最终地图上的放置实例）
 *
 * 对应 C# RandomMapGenerator.AbstractMapMember。
 * 描述一个抽象地图单元被放置到地图上后的连接状态、熵等调度信息。
 *
 * 移植要点：
 *   - 各默认值与 C# 字段初始化器保持一致（MapUnitName="empty"、Entropy=50 等）。
 *   - GetAbstractMapUnit 通过 WorkingMap.AbstractMapUnitList 查找对应模板。
 */
export class AbstractMapMember {
  /** 对应 C# string MapUnitName = "empty" */
  public MapUnitName: string = 'empty';
  /** 对应 C# bool IsOnMap = false */
  public IsOnMap: boolean = false;
  /** 对应 C# bool Placed = false */
  public Placed: boolean = false;
  /** 对应 C# bool NWConnected = false（西北方向已连接） */
  public NWConnected: boolean = false;
  /** 对应 C# bool NEConnected = false（东北方向已连接） */
  public NEConnected: boolean = false;
  /** 对应 C# bool SEConnected = false（东南方向已连接） */
  public SEConnected: boolean = false;
  /** 对应 C# bool SWConnected = false（西南方向已连接） */
  public SWConnected: boolean = false;
  /** 对应 C# int Entropy = 50（熵值，用于调度随机性） */
  public Entropy: number = 50;
  /** 对应 C# bool IsAllOnVisibleMap = false */
  public IsAllOnVisibleMap: boolean = false;
  /** 对应 C# bool PlayerLocationHasTiberium = false */
  public PlayerLocationHasTiberium: boolean = false;

  /**
   * 获取当前成员对应的抽象地图单元模板
   *
   * 对应 C# AbstractMapMember.GetAbstractMapUnit()。
   * 遍历 WorkingMap.AbstractMapUnitList 查找 MapUnitName 匹配项；
   * 未找到时返回一个新建的空 AbstractMapUnit（与 C# 行为一致）。
   */
  public GetAbstractMapUnit(): AbstractMapUnit {
    let absMapUnit = new AbstractMapUnit();
    for (const pAbsMapUnit of WorkingMap.AbstractMapUnitList) {
      if (this.MapUnitName === pAbsMapUnit.MapUnitName) {
        absMapUnit = pAbsMapUnit;
      }
    }
    return absMapUnit;
  }
}
