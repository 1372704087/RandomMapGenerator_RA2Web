/**
 * 等距图块与地图对象基类层次
 *
 * 对应 C# RandomMapGenerator.MapFormat.cs 中的：
 *   - MapObject
 *   - NamedMapObject
 *   - NumberedMapObject
 *   - IsoTile
 *
 * 移植要点：
 *   - C# System.Drawing.Color 用 { r, g, b } 接口表示（Color.FromArgb(r,g,b)）。
 *   - C# MemberwiseClone() 用 Object.assign(Object.create(prototype), this) 实现浅拷贝。
 *   - C# ushort / byte / short 在 TypeScript 中统一用 number 表示（注释标明原 C# 类型）。
 */

/**
 * RGB 颜色接口
 *
 * 对应 C# System.Drawing.Color。原 C# 中 Color 为 struct（值类型），
 * 此处用对象表示，因此对默认值采用每次新建对象的方式以模拟值语义。
 */
export interface Color {
  /** 红色通道 0-255 */
  r: number;
  /** 绿色通道 0-255 */
  g: number;
  /** 蓝色通道 0-255 */
  b: number;
}

/** 白色，对应 C# Color.White */
export const ColorWhite: Color = { r: 255, g: 255, b: 255 };

/**
 * 创建一个颜色对象，对应 C# Color.FromArgb(r, g, b)
 */
export function FromArgb(r: number, g: number, b: number): Color {
  return { r, g, b };
}

/**
 * 地图对象基类
 *
 * 对应 C# MapObject：仅持有一个关联的等距图块引用。
 */
export class MapObject {
  /** 关联的等距图块，对应 C# MapObject.Tile */
  public Tile: IsoTile | null = null;
}

/**
 * 具名地图对象
 *
 * 对应 C# NamedMapObject : MapObject，增加 Name 属性。
 */
export class NamedMapObject extends MapObject {
  /** 对应 C# NamedMapObject.Name */
  public Name: string = '';
}

/**
 * 编号地图对象
 *
 * 对应 C# NumberedMapObject : MapObject，增加虚拟 Number 属性。
 *
 * 注意：C# 中 Number 为 virtual 属性，子类（如 Overlay）可重写。
 * 此处使用 getter/setter 形式声明，以便子类通过同名 getter/setter 重写。
 */
export class NumberedMapObject extends MapObject {
  private _Number: number = 0;

  /** 对应 C# NumberedMapObject.Number（virtual） */
  public get Number(): number {
    return this._Number;
  }
  public set Number(value: number) {
    this._Number = value;
  }
}

/**
 * 等距图块
 *
 * 对应 C# IsoTile : NumberedMapObject。
 * 表示地图上单个等距菱形图块，是地图格式的最小几何单元。
 */
export class IsoTile extends NumberedMapObject {
  /** 对应 C# ushort Dx（display x，未直接使用但保留以对应原结构） */
  public Dx: number;
  /** 对应 C# ushort Dy */
  public Dy: number;
  /** 对应 C# ushort Rx（规则坐标 X） */
  public Rx: number;
  /** 对应 C# ushort Ry（规则坐标 Y） */
  public Ry: number;
  /** 对应 C# byte Z（高度层级） */
  public Z: number;
  /** 对应 C# short TileNum（图块编号） */
  public TileNum: number;
  /** 对应 C# byte SubTile（子图块索引） */
  public SubTile: number;
  /** 左侧雷达颜色，对应 C# Color RadarLeft = Color.White */
  public RadarLeft: Color = { r: 255, g: 255, b: 255 };
  /** 右侧雷达颜色，对应 C# Color RadarRight = Color.White */
  public RadarRight: Color = { r: 255, g: 255, b: 255 };

  /**
   * @param dx   ushort Dx
   * @param dy   ushort Dy
   * @param rx   ushort Rx
   * @param ry   ushort Ry
   * @param z    byte Z
   * @param tileNum short TileNum
   * @param subTile  byte SubTile
   */
  constructor(
    dx: number,
    dy: number,
    rx: number,
    ry: number,
    z: number,
    tileNum: number,
    subTile: number
  ) {
    super();
    this.Dx = dx;
    this.Dy = dy;
    this.Rx = rx;
    this.Ry = ry;
    this.Z = z;
    this.TileNum = tileNum;
    this.SubTile = subTile;
  }

  /**
   * 生成 MapPack5 格式的单条图块记录
   *
   * 对应 C# IsoTile.ToMapPack5Entry()，返回 11 字节序列。
   * C# 使用 BitConverter.GetBytes（小端序）依次写入：
   *   Rx(2) + Ry(2) + TileNum(2) + 0(1) + 0(1) + SubTile(1) + Z(1) + 0(1)
   *
   * @returns 字节数组（每个元素 0-255），小端序
   */
  public ToMapPack5Entry(): number[] {
    const ret: number[] = [];
    // BitConverter.GetBytes(Rx) — 2 bytes, little-endian (ushort)
    ret.push(this.Rx & 0xff, (this.Rx >>> 8) & 0xff);
    // BitConverter.GetBytes(Ry) — 2 bytes, little-endian (ushort)
    ret.push(this.Ry & 0xff, (this.Ry >>> 8) & 0xff);
    // BitConverter.GetBytes(TileNum) — 2 bytes, little-endian (short)
    ret.push(this.TileNum & 0xff, (this.TileNum >>> 8) & 0xff);
    // 0 + 0
    ret.push(0, 0);
    // SubTile
    ret.push(this.SubTile & 0xff);
    // Z
    ret.push(this.Z & 0xff);
    // 0
    ret.push(0);
    return ret;
  }

  /**
   * 浅拷贝克隆
   *
   * 对应 C# IsoTile.Clone() -> MemberwiseClone()。
   * 使用 Object.assign(Object.create(prototype), this) 实现浅拷贝，
   * 保持与 C# MemberwiseClone 一致的引用语义（Color 对象为共享引用）。
   */
  public Clone(): IsoTile {
    const clone = Object.create(IsoTile.prototype) as IsoTile;
    return Object.assign(clone, this);
  }
}
