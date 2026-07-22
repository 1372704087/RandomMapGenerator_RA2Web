import { WorkingMap } from '../workingMap';

/**
 * 建筑结构
 *
 * 对应 C# RandomMapGenerator.NonTileObjects.Structure。
 *
 * 移植要点：
 *   - C# MemberwiseClone() 用 Object.assign 实现浅拷贝。
 *   - C# int.Parse 用 parseInt(s, 10) 替代。
 */
export class Structure {
  /** 对应 C# string Owner（所属方） */
  public Owner: string = '';
  /** 对应 C# string Name（建筑规则名） */
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
  /** 对应 C# string Tag（标签） */
  public Tag: string = '';
  /** 对应 C# int Sellable（是否可出售） */
  public Sellable: number = 0;
  /** 对应 C# int Rebuild（是否重建） */
  public Rebuild: number = 0;
  /** 对应 C# int EnergySupport（能量产出） */
  public EnergySupport: number = 0;
  /** 对应 C# int UpgradeCount（升级数量） */
  public UpgradeCount: number = 0;
  /** 对应 C# int SpotLight（聚光灯） */
  public SpotLight: number = 0;
  /** 对应 C# string Upgrade1（升级插件 1） */
  public Upgrade1: string = '';
  /** 对应 C# string Upgrade2（升级插件 2） */
  public Upgrade2: string = '';
  /** 对应 C# string Upgrade3（升级插件 3） */
  public Upgrade3: string = '';
  /** 对应 C# int AIRepairs（AI 修理） */
  public AIRepairs: number = 0;
  /** 对应 C# int ShowName（是否显示名称） */
  public ShowName: number = 0;

  /**
   * 从 INI 值字符串初始化
   *
   * 对应 C# Structure.Initialize(string iniValue)。
   * 期望 17 个以逗号分隔的字段。
   */
  public Initialize(iniValue: string): void {
    const values = iniValue.split(',');
    if (values.length === 17) {
      this.Owner = values[0];
      this.Name = values[1];
      this.Strength = parseInt(values[2], 10);
      this.RelativeX = parseInt(values[3], 10) - WorkingMap.StartingX;
      this.RelativeY = parseInt(values[4], 10) - WorkingMap.StartingY;
      this.Direction = parseInt(values[5], 10);
      this.Tag = values[6];
      this.Sellable = parseInt(values[7], 10);
      this.Rebuild = parseInt(values[8], 10);
      this.EnergySupport = parseInt(values[9], 10);
      this.UpgradeCount = parseInt(values[10], 10);
      this.SpotLight = parseInt(values[11], 10);
      this.Upgrade1 = values[12];
      this.Upgrade2 = values[13];
      this.Upgrade3 = values[14];
      this.AIRepairs = parseInt(values[15], 10);
      this.ShowName = parseInt(values[16], 10);
    } else {
      console.warn('An Structure cannot be parsed.');
    }
  }

  /**
   * 浅拷贝克隆，对应 C# Structure.Clone() -> MemberwiseClone()
   */
  public Clone(): Structure {
    const clone = Object.create(Structure.prototype) as Structure;
    return Object.assign(clone, this);
  }

  /**
   * 生成 INI 值字符串
   *
   * 对应 C# Structure.CreateINIValue()。
   * 输出使用 X / Y（绝对坐标）。
   */
  public CreateINIValue(): string {
    return (
      this.Owner + ',' + this.Name + ',' + this.Strength + ',' + this.X + ',' + this.Y +
      ',' + this.Direction + ',' + this.Tag + ',' + this.Sellable + ',' + this.Rebuild + ',' + this.EnergySupport +
      ',' + this.UpgradeCount + ',' + this.SpotLight + ',' + this.Upgrade1 + ',' + this.Upgrade2 +
      ',' + this.Upgrade3 + ',' + this.AIRepairs + ',' + this.ShowName
    );
  }
}
