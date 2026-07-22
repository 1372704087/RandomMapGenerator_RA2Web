import { WorkingMap } from '../workingMap';

/**
 * 单位（车辆 / 战车）
 *
 * 对应 C# RandomMapGenerator.NonTileObjects.Unit。
 *
 * 移植要点：
 *   - C# MemberwiseClone() 用 Object.assign(Object.create(prototype), this) 实现浅拷贝。
 *   - C# int.Parse 用 parseInt(s, 10) 替代。
 *   - C# WorkingMap.StartingX / StartingY 暂用 WorkingMap 静态占位变量。
 */
export class Unit {
  /** 对应 C# string Owner（所属方） */
  public Owner: string = '';
  /** 对应 C# string Name（单位规则名） */
  public Name: string = '';
  /** 对应 C# int Strength（生命值百分比） */
  public Strength: number = 0;
  /** 对应 C# int RelativeX（相对坐标 X） */
  public RelativeX: number = 0;
  /** 对应 C# int X（输出坐标 X） */
  public X: number = 0;
  /** 对应 C# int RelativeY（相对坐标 Y） */
  public RelativeY: number = 0;
  /** 对应 C# int Y（输出坐标 Y） */
  public Y: number = 0;
  /** 对应 C# int Direction（朝向） */
  public Direction: number = 0;
  /** 对应 C# string State（状态） */
  public State: string = '';
  /** 对应 C# string Tag（标签） */
  public Tag: string = '';
  /** 对应 C# int Veteran（老兵等级） */
  public Veteran: number = 0;
  /** 对应 C# int Group（编组） */
  public Group: number = 0;
  /** 对应 C# int OnBridge（是否在桥上） */
  public OnBridge: number = 0;
  /** 对应 C# int FollowerID（跟随目标 ID） */
  public FollowerID: number = 0;
  /** 对应 C# int AutocreateNoRecruitable */
  public AutocreateNoRecruitable: number = 0;
  /** 对应 C# int AutocreateYesRecruitable */
  public AutocreateYesRecruitable: number = 0;

  /**
   * 从 INI 值字符串初始化
   *
   * 对应 C# Unit.Initialize(string iniValue)。
   * 期望 14 个以逗号分隔的字段。
   */
  public Initialize(iniValue: string): void {
    const values = iniValue.split(',');
    if (values.length === 14) {
      this.Owner = values[0];
      this.Name = values[1];
      this.Strength = parseInt(values[2], 10);
      this.RelativeX = parseInt(values[3], 10) - WorkingMap.StartingX;
      this.RelativeY = parseInt(values[4], 10) - WorkingMap.StartingY;
      this.Direction = parseInt(values[5], 10);
      this.State = values[6];
      this.Tag = values[7];
      this.Veteran = parseInt(values[8], 10);
      this.Group = parseInt(values[9], 10);
      this.OnBridge = parseInt(values[10], 10);
      this.FollowerID = parseInt(values[11], 10);
      this.AutocreateNoRecruitable = parseInt(values[12], 10);
      this.AutocreateYesRecruitable = parseInt(values[13], 10);
    } else {
      console.warn('A unit cannot be parsed.');
    }
  }

  /**
   * 浅拷贝克隆，对应 C# Unit.Clone() -> MemberwiseClone()
   */
  public Clone(): Unit {
    const clone = Object.create(Unit.prototype) as Unit;
    return Object.assign(clone, this);
  }

  /**
   * 生成 INI 值字符串
   *
   * 对应 C# Unit.CreateINIValue()。
   * 注意：输出使用 X / Y（绝对坐标），而非 RelativeX / RelativeY。
   */
  public CreateINIValue(): string {
    return (
      this.Owner + ',' + this.Name + ',' + this.Strength + ',' + this.X + ',' + this.Y +
      ',' + this.Direction + ',' + this.State + ',' + this.Tag + ',' + this.Veteran + ',' + this.Group +
      ',' + this.OnBridge + ',' + this.FollowerID + ',' + this.AutocreateNoRecruitable + ',' + this.AutocreateYesRecruitable
    );
  }
}
