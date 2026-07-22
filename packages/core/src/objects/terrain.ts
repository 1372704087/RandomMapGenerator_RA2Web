import { WorkingMap } from '../workingMap';
import type { IniKeyValuePair } from '../fileio';

/**
 * 地形物件（树木 / 路灯等）
 *
 * 对应 C# RandomMapGenerator.NonTileObjects.Terrain。
 *
 * 移植要点：
 *   - C# KeyValuePair&lt;string, string&gt; 用 { key, value } 接口表示。
 *   - C# string.Format("{0:000}", X) 用 X.toString().padStart(3, '0') 替代。
 *   - C# MemberwiseClone() 用 Object.assign 实现浅拷贝。
 */
export class Terrain {
  /** 对应 C# int RelativeX（相对坐标 X） */
  public RelativeX: number = 0;
  /** 对应 C# int X（输出坐标 X） */
  public X: number = 0;
  /** 对应 C# int RelativeY（相对坐标 Y） */
  public RelativeY: number = 0;
  /** 对应 C# int Y（输出坐标 Y） */
  public Y: number = 0;
  /** 对应 C# string Name（地形物件规则名） */
  public Name: string = '';

  /**
   * 从 INI 行初始化
   *
   * 对应 C# Terrain.Initialize(KeyValuePair&lt;string,string&gt; iniLine)。
   * 键格式为 YYYXXX（Y 不定长 + X 三位零填充），值规则名为物件名。
   */
  public Initialize(iniLine: IniKeyValuePair): void {
    const key = iniLine.key;
    // C# key.Substring(key.Length - 3, 3) 取末尾 3 位；
    // C# key.Substring(0, key.Length - 3) 取前 (length-3) 位。
    // 注意 C# Substring(startIndex, length) 与 JS substring(start, end) 语义不同，
    // 此处用 slice 复刻：slice(-3) 取末尾 3 位，slice(0, len-3) 取前段。
    const x = key.slice(-3);
    const y = key.slice(0, key.length - 3);
    this.Name = iniLine.value;
    this.RelativeX = parseInt(x, 10) - WorkingMap.StartingX;
    this.RelativeY = parseInt(y, 10) - WorkingMap.StartingY;
  }

  /**
   * 浅拷贝克隆，对应 C# Terrain.Clone() -> MemberwiseClone()
   */
  public Clone(): Terrain {
    const clone = Object.create(Terrain.prototype) as Terrain;
    return Object.assign(clone, this);
  }

  /**
   * 生成 INI 行
   *
   * 对应 C# Terrain.CreateINILine()。
   * 键格式为 Y.toString() + X 三位零填充，值为物件名。
   */
  public CreateINILine(): IniKeyValuePair {
    const key = this.Y.toString() + this.X.toString().padStart(3, '0');
    return { key, value: this.Name };
  }
}
