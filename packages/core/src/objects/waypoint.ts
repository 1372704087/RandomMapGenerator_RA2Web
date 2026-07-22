import { WorkingMap } from '../workingMap';
import type { IniKeyValuePair } from '../fileio';

/**
 * 路径点（Waypoint）
 *
 * 对应 C# RandomMapGenerator.NonTileObjects.Waypoint。
 * 用于标记出生点、巡逻路径等关键位置。
 *
 * 移植要点：
 *   - C# KeyValuePair&lt;string, string&gt; 用 { key, value } 接口表示。
 *   - C# string.Format("{0:000}", X) 用 X.toString().padStart(3, '0') 替代。
 *   - C# Substring(startIndex, length) 用 slice 复刻。
 *   - C# MemberwiseClone() 用 Object.assign 实现浅拷贝。
 */
export class Waypoint {
  /** 对应 C# int RelativeX（相对坐标 X） */
  public RelativeX: number = 0;
  /** 对应 C# int X（输出坐标 X） */
  public X: number = 0;
  /** 对应 C# int RelativeY（相对坐标 Y） */
  public RelativeY: number = 0;
  /** 对应 C# int Y（输出坐标 Y） */
  public Y: number = 0;
  /** 对应 C# int Index（路径点编号） */
  public Index: number = 0;

  /**
   * 从 INI 行初始化
   *
   * 对应 C# Waypoint.Initialize(KeyValuePair&lt;string,string&gt; iniLine)。
   * 键为路径点编号，值格式为 YYYXXX（Y 不定长 + X 三位零填充）。
   */
  public Initialize(iniLine: IniKeyValuePair): void {
    const value = iniLine.value;
    // C# value.Substring(value.Length - 3, 3) 取末尾 3 位；
    // C# value.Substring(0, value.Length - 3) 取前 (length-3) 位。
    // 用 slice 复刻以避免 C# Substring 与 JS substring 的参数语义差异。
    const x = value.slice(-3);
    const y = value.slice(0, value.length - 3);
    this.Index = parseInt(iniLine.key, 10);
    this.RelativeX = parseInt(x, 10) - WorkingMap.StartingX;
    this.RelativeY = parseInt(y, 10) - WorkingMap.StartingY;
  }

  /**
   * 浅拷贝克隆，对应 C# Waypoint.Clone() -> MemberwiseClone()
   */
  public Clone(): Waypoint {
    const clone = Object.create(Waypoint.prototype) as Waypoint;
    return Object.assign(clone, this);
  }

  /**
   * 生成 INI 行
   *
   * 对应 C# Waypoint.CreateINILine()。
   * 键为路径点编号，值格式为 Y.toString() + X 三位零填充。
   */
  public CreateINILine(): IniKeyValuePair {
    const value = this.Y.toString() + this.X.toString().padStart(3, '0');
    return { key: this.Index.toString(), value };
  }
}
