import { NumberedMapObject } from './isoTile';

/**
 * 覆盖物（Overlay）
 *
 * 对应 C# Overlay : NumberedMapObject（MapFormat.cs）。
 * 覆盖物是叠在等距图块之上的地表元素，如矿石、岩石、围墙等。
 *
 * 移植要点：
 *   - C# override int Number 映射为同名 getter/setter，读写 OverlayID。
 *   - C# byte OverlayID / OverlayValue 用 number 表示。
 *   - C# MemberwiseClone() 用 Object.assign 实现浅拷贝。
 */
export class Overlay extends NumberedMapObject {
  /** 对应 C# byte OverlayID（覆盖物类型编号） */
  public OverlayID: number;
  /** 对应 C# byte OverlayValue（覆盖物数值，如矿石富集度） */
  public OverlayValue: number;

  /**
   * @param overlayID   byte OverlayID
   * @param overlayValue byte OverlayValue
   */
  constructor(overlayID: number, overlayValue: number) {
    super();
    this.OverlayID = overlayID;
    this.OverlayValue = overlayValue;
  }

  /**
   * 编号属性，对应 C# override int Number
   *
   * C# 实现：get { return OverlayID; } set { OverlayID = (byte)value; }
   */
  public get Number(): number {
    return this.OverlayID;
  }
  public set Number(value: number) {
    this.OverlayID = value & 0xff;
  }

  /**
   * 浅拷贝克隆
   *
   * 对应 C# Overlay.Clone() -> MemberwiseClone()。
   */
  public Clone(): Overlay {
    const clone = Object.create(Overlay.prototype) as Overlay;
    return Object.assign(clone, this);
  }
}
