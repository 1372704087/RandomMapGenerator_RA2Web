import { AbstractTileType } from './abstractTileType';
import { Common } from './enums';
import { WorkingMap } from '../workingMap';

/**
 * 抽象图块（最终地图上的格位）
 *
 * 对应 C# RandomMapGenerator.AbstractTile : TileInfo.AbstractTileType。
 * 在 AbstractTileType 基础上增加坐标位置、地图可见性、以及各类对象的占用标志。
 *
 * 移植要点：
 *   - C# `public int X { get; private set; }` 等私有 setter 属性，
 *     用 public getter + private setter + 私有后备字段实现，保持封装一致。
 *   - Initialize / SetProperty 中用到的 WorkingMap.Size / WorkingMap.BottomSpace
 *     暂用 WorkingMap 静态占位变量，后续 WorkingMap 实现后对接。
 */
export class AbstractTile extends AbstractTileType {
  // ---- 对应 C# { get; private set; } 属性：公有读、私有写 ----
  private _X: number = 0;
  private _Y: number = 0;
  private _IsOnMap: boolean = false;
  private _IsOnVisibleMap: boolean = false;
  private _Edited: boolean = false;

  /** 对应 C# int X { get; private set; }（地图坐标 X） */
  public get X(): number {
    return this._X;
  }
  private set X(value: number) {
    this._X = value;
  }

  /** 对应 C# int Y { get; private set; }（地图坐标 Y） */
  public get Y(): number {
    return this._Y;
  }
  private set Y(value: number) {
    this._Y = value;
  }

  /** 对应 C# bool IsOnMap { get; private set; }（是否在地图范围内） */
  public get IsOnMap(): boolean {
    return this._IsOnMap;
  }
  private set IsOnMap(value: boolean) {
    this._IsOnMap = value;
  }

  /** 对应 C# bool IsOnVisibleMap { get; private set; }（是否在可见地图范围内） */
  public get IsOnVisibleMap(): boolean {
    return this._IsOnVisibleMap;
  }
  private set IsOnVisibleMap(value: boolean) {
    this._IsOnVisibleMap = value;
  }

  /** 对应 C# bool Edited { get; private set; }（是否被编辑过） */
  public get Edited(): boolean {
    return this._Edited;
  }
  private set Edited(value: boolean) {
    this._Edited = value;
  }

  // ---- 对应 C# { get; set; } 公有读写属性 ----
  /** 对应 C# bool HasStructure */
  public HasStructure: boolean = false;
  /** 对应 C# bool HasUnit */
  public HasUnit: boolean = false;
  /** 对应 C# bool HasAircraft */
  public HasAircraft: boolean = false;
  /** 对应 C# bool HasInfantry */
  public HasInfantry: boolean = false;
  /** 对应 C# int InfantryCount */
  public InfantryCount: number = 0;
  /** 对应 C# bool HasSmudge */
  public HasSmudge: boolean = false;
  /** 对应 C# bool HasTerrain */
  public HasTerrain: boolean = false;
  /** 对应 C# bool HasOverlay */
  public HasOverlay: boolean = false;
  /** 对应 C# bool HasBridge */
  public HasBridge: boolean = false;
  /** 对应 C# int OverlayID */
  public OverlayID: number = 0;
  /** 对应 C# int OverlayValue */
  public OverlayValue: number = 0;
  /** 对应 C# string TerrainName */
  public TerrainName: string = '';
  /** 对应 C# bool AroundPlayerLocation */
  public AroundPlayerLocation: boolean = false;
  /** 对应 C# bool HasNeuralTechStructure */
  public HasNeuralTechStructure: boolean = false;

  /**
   * 初始化图块
   *
   * 对应 C# AbstractTile.Initialize(int x, int y)。
   * 依据 WorkingMap.Size 与 WorkingMap.BottomSpace 判定该格位是否在
   * 可见地图范围 / 地图范围内，并重置全部占用标志。
   */
  public Initialize(x: number, y: number): void {
    this.X = x;
    this.Y = y;
    this.Z = 0;
    this.Edited = false;
    this.TileNum = Common._000_Empty;
    this.SubTile = 0;
    let isOnMap = false;
    let isOnVisibleMap = false;
    this.Used = true;
    if (
      y > WorkingMap.Size[0] - x + 4 &&
      y < 2 * WorkingMap.Size[1] + WorkingMap.Size[0] + 1 - x - 1 - WorkingMap.BottomSpace &&
      y < x + WorkingMap.Size[0] - 3 &&
      y > x - WorkingMap.Size[0] + 3
    ) {
      isOnVisibleMap = true;
    }
    if (
      y > WorkingMap.Size[0] - x &&
      y < 2 * WorkingMap.Size[1] + WorkingMap.Size[0] + 1 - x &&
      y < x + WorkingMap.Size[0] &&
      y > x - WorkingMap.Size[0]
    ) {
      isOnMap = true;
    }
    this.IsOnMap = isOnMap;
    this.IsOnVisibleMap = isOnVisibleMap;

    this.HasStructure = false;
    this.HasUnit = false;
    this.HasAircraft = false;
    this.HasInfantry = false;
    this.InfantryCount = 0;
    this.HasSmudge = false;
    this.HasTerrain = false;
    this.HasOverlay = false;
    this.OverlayID = 0;
    this.OverlayValue = 0;
    this.TerrainName = '';
    this.AroundPlayerLocation = false;
    this.HasBridge = false;
    this.HasNeuralTechStructure = false;
  }

  /**
   * 应用抽象图块类型属性
   *
   * 对应 C# AbstractTile.SetProperty(int x, int y, int z, AbstractTileType absTileType)。
   * 将模板图块类型信息写入当前格位，并叠加高度、重算 IsOnMap。
   */
  public SetProperty(x: number, y: number, z: number, absTileType: AbstractTileType | null): void {
    if (absTileType === null) {
      return;
    }
    this.TileNum = absTileType.TileNum;
    this.SubTile = absTileType.SubTile;
    this.Used = absTileType.Used;
    this.X = x;
    this.Y = y;
    this.Z = z;
    this.Z += absTileType.Z;
    this.Edited = true;
    let isOnMap = false;
    if (
      y > WorkingMap.Size[0] - x &&
      y < 2 * WorkingMap.Size[1] + WorkingMap.Size[0] + 1 - x &&
      y < x + WorkingMap.Size[0] &&
      y > x - WorkingMap.Size[0]
    ) {
      isOnMap = true;
    }
    this.IsOnMap = isOnMap;
  }
}
