import { WorkingMap } from '../workingMap';

/**
 * 污渍（弹坑 / 焦痕等地表修饰）
 *
 * 对应 C# RandomMapGenerator.NonTileObjects.Smudge。
 *
 * 移植要点：
 *   - C# MemberwiseClone() 用 Object.assign 实现浅拷贝。
 *   - 期望 4 个以逗号分隔的字段。
 */
export class Smudge {
  /** 对应 C# string Name（污渍规则名） */
  public Name: string = '';
  /** 对应 C# int RelativeX（相对坐标 X） */
  public RelativeX: number = 0;
  /** 对应 C# int X（输出坐标 X） */
  public X: number = 0;
  /** 对应 C# int RelativeY（相对坐标 Y） */
  public RelativeY: number = 0;
  /** 对应 C# int Y（输出坐标 Y） */
  public Y: number = 0;
  /** 对应 C# int unknown（未知字段） */
  public unknown: number = 0;

  /**
   * 从 INI 值字符串初始化
   *
   * 对应 C# Smudge.Initialize(string iniValue)。
   * 期望 4 个以逗号分隔的字段。
   * 注意：C# 原实现在字段数不匹配时不输出警告，此处保持一致。
   */
  public Initialize(iniValue: string): void {
    const values = iniValue.split(',');
    if (values.length === 4) {
      this.Name = values[0];
      this.RelativeX = parseInt(values[1], 10) - WorkingMap.StartingX;
      this.RelativeY = parseInt(values[2], 10) - WorkingMap.StartingY;
      this.unknown = parseInt(values[3], 10);
    }
  }

  /**
   * 浅拷贝克隆，对应 C# Smudge.Clone() -> MemberwiseClone()
   */
  public Clone(): Smudge {
    const clone = Object.create(Smudge.prototype) as Smudge;
    return Object.assign(clone, this);
  }

  /**
   * 生成 INI 值字符串
   *
   * 对应 C# Smudge.CreateINIValue()。
   * 输出使用 X / Y（绝对坐标）。
   */
  public CreateINIValue(): string {
    return this.Name + ',' + this.X + ',' + this.Y + ',' + this.unknown;
  }
}
