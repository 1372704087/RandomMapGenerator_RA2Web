import { WorkingMap } from '../workingMap';

/**
 * 步兵
 *
 * 对应 C# RandomMapGenerator.NonTileObjects.Infantry。
 *
 * 移植要点：
 *   - 与 Unit 字段相近，但多出 Unknown 字段，且 Initialize 的解析顺序不同
 *     （Unknown 在 State 之前、Direction 在 State 之后）。
 *   - C# MemberwiseClone() 用 Object.assign 实现浅拷贝。
 */
export class Infantry {
  /** 对应 C# string Owner（所属方） */
  public Owner: string = '';
  /** 对应 C# string Name（步兵规则名） */
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
  /** 对应 C# int Unknown（未知字段） */
  public Unknown: number = 0;
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
  /** 对应 C# int AutocreateNoRecruitable */
  public AutocreateNoRecruitable: number = 0;
  /** 对应 C# int AutocreateYesRecruitable */
  public AutocreateYesRecruitable: number = 0;

  /**
   * 从 INI 值字符串初始化
   *
   * 对应 C# Infantry.Initialize(string iniValue)。
   * 期望 14 个以逗号分隔的字段。注意解析顺序与 Unit 不同：
   * 索引 5 为 Unknown，索引 6 为 State，索引 7 为 Direction。
   */
  public Initialize(iniValue: string): void {
    const values = iniValue.split(',');
    if (values.length === 14) {
      this.Owner = values[0];
      this.Name = values[1];
      this.Strength = parseInt(values[2], 10);
      this.RelativeX = parseInt(values[3], 10) - WorkingMap.StartingX;
      this.RelativeY = parseInt(values[4], 10) - WorkingMap.StartingY;
      this.Unknown = parseInt(values[5], 10);
      this.State = values[6];
      this.Direction = parseInt(values[7], 10);
      this.Tag = values[8];
      this.Veteran = parseInt(values[9], 10);
      this.Group = parseInt(values[10], 10);
      this.OnBridge = parseInt(values[11], 10);
      this.AutocreateNoRecruitable = parseInt(values[12], 10);
      this.AutocreateYesRecruitable = parseInt(values[13], 10);
    } else {
      console.warn('An infantry cannot be parsed.');
    }
  }

  /**
   * 浅拷贝克隆，对应 C# Infantry.Clone() -> MemberwiseClone()
   */
  public Clone(): Infantry {
    const clone = Object.create(Infantry.prototype) as Infantry;
    return Object.assign(clone, this);
  }

  /**
   * 生成 INI 值字符串
   *
   * 对应 C# Infantry.CreateINIValue()。
   * 输出顺序：Owner,Name,Strength,X,Y,Unknown,State,Direction,Tag,
   * Veteran,Group,OnBridge,AutocreateNoRecruitable,AutocreateYesRecruitable
   */
  public CreateINIValue(): string {
    return (
      this.Owner + ',' + this.Name + ',' + this.Strength + ',' + this.X + ',' + this.Y +
      ',' + this.Unknown + ',' + this.State + ',' + this.Direction + ',' + this.Tag + ',' + this.Veteran +
      ',' + this.Group + ',' + this.OnBridge + ',' + this.AutocreateNoRecruitable + ',' + this.AutocreateYesRecruitable
    );
  }
}
