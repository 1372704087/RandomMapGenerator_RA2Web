/**
 * WorkingMap - TypeScript port of the C# RandomMapGenerator.WorkingMap static class.
 *
 * This is the central orchestrator for random map generation. It maintains the
 * full grid of AbstractTiles, the AbstractMapMemberMatrix (coarse placement grid),
 * all loaded AbstractMapUnit templates, and the generated non-tile object lists.
 *
 * Design decisions (see task spec):
 *   - Maintained as a static class (matching C#). Server-side callers should
 *     serialise map-generation requests to avoid concurrency issues.
 *   - File I/O removed: SterilizeMapUnit / Initialize accept a WorkingMapConfig
 *     object whose properties are the raw INI/.map file contents (strings).
 *   - C# Serilog.Log  ->  console.log / console.warn / console.error.
 *   - C# System.Random  ->  seedable Random (linear congruential generator).
 *   - C# Weighted_Randomizer  ->  lightweight WeightedRandomizer<T>.
 *   - C# 2-D arrays [,]  ->  arrays-of-arrays [][], accessed as arr[x][y].
 *   - C# List<T>  ->  T[]; C# Dictionary  ->  Record / Map; LINQ  ->  array methods.
 *   - Methods depending on System.Drawing.Bitmap are skipped; CreateTileList
 *     (which only uses Color, not Bitmap) is ported with an optional
 *     minimapIniContent parameter.
 */

import { IniFile, IniSection } from './io/iniFile';
import { MapFile } from './fileio';
import type { FileInfoLike } from './fileio';
import { IsoTile, FromArgb } from './tile/isoTile';
import type { Color } from './tile/isoTile';
import { Overlay } from './tile/overlay';
import { Theater } from './tile/enums';
import { AbstractTileType } from './tile/abstractTileType';
import { AbstractTile } from './tile/abstractTile';
import { AbstractMapUnit } from './tile/abstractMapUnit';
import { AbstractMapMember } from './tile/abstractMapMember';
import { FailureAbstractMapUnitRecord } from './tile/failureRecord';
import { Unit } from './objects/unit';
import { Infantry } from './objects/infantry';
import { Structure } from './objects/structure';
import { Terrain } from './objects/terrain';
import { Aircraft } from './objects/aircraft';
import { Smudge } from './objects/smudge';
import { Waypoint } from './objects/waypoint';

// ---------------------------------------------------------------------------
// Configuration interface
// ---------------------------------------------------------------------------

/** WorkingMap initialization configuration (replaces file-path-based I/O). */
export interface WorkingMapConfig {
  /** MapUnits 目录下所有 .map 文件的映射：文件名 -> 文件内容 */
  mapUnitFiles: { name: string; content: string }[];
  /** indicator.map 文件内容 */
  indicatorMapContent: string;
  /** cannotplacesmudge.map 文件内容（可选） */
  cannotPlaceSmudgeMapContent?: string;
  /** settings.ini 文件内容 */
  settingsContent: string;
  /** rulesmd.ini 文件内容 */
  rulesContent: string;
  /** artmd.ini 文件内容 */
  artContent: string;
}

// ---------------------------------------------------------------------------
// Seedable Random (linear congruential generator)
// ---------------------------------------------------------------------------

/**
 * Seedable pseudo-random number generator.
 *
 * Mirrors the public API of C# System.Random:
 *   - Next(max)        -> [0, max)
 *   - Next(min, max)   -> [min, max)
 *   - NextDouble()     -> [0, 1)
 *
 * Uses a linear congruential generator so that results are reproducible
 * when a seed is supplied.
 */
export class Random {
  private state: number;

  constructor(seed?: number) {
    this.state = (seed ?? Date.now()) & 0x7fffffff;
  }

  private next(): number {
    // LCG constants (same family as glibc / ANSI C)
    this.state = (this.state * 1103515245 + 12345) & 0x7fffffff;
    return this.state / 0x80000000; // [0, 1)
  }

  public NextDouble(): number {
    return this.next();
  }

  /** Next(max) -> [0, max)  or  Next(min, max) -> [min, max) */
  public Next(minOrMax: number, max?: number): number {
    if (max === undefined) {
      return Math.floor(this.next() * minOrMax);
    }
    return Math.floor(this.next() * (max - minOrMax)) + minOrMax;
  }
}

// ---------------------------------------------------------------------------
// Weighted randomizer (replaces C# Weighted_Randomizer.DynamicWeightedRandomizer)
// ---------------------------------------------------------------------------

/**
 * Simple weighted random selector.
 *
 * Mirrors the public API used from C# Weighted_Randomizer:
 *   - Add(item, weight)
 *   - NextWithReplacement()  – pick without removing
 *   - NextWithRemoval()      – pick and remove
 *   - Count
 *
 * Uses WorkingMap.Randomizer internally so that results are seed-reproducible.
 */
export class WeightedRandomizer<T> {
  private items: { item: T; weight: number }[] = [];
  private totalWeight = 0;

  public Add(item: T, weight: number): void {
    this.items.push({ item, weight });
    this.totalWeight += weight;
  }

  public get Count(): number {
    return this.items.length;
  }

  public NextWithReplacement(): T {
    if (this.items.length === 0) {
      throw new Error('WeightedRandomizer is empty');
    }
    let r = WorkingMap.Randomizer.NextDouble() * this.totalWeight;
    for (const entry of this.items) {
      r -= entry.weight;
      if (r <= 0) {
        return entry.item;
      }
    }
    return this.items[this.items.length - 1].item;
  }

  public NextWithRemoval(): T {
    const result = this.NextWithReplacement();
    const idx = this.items.findIndex((e) => e.item === result);
    if (idx >= 0) {
      this.totalWeight -= this.items[idx].weight;
      this.items.splice(idx, 1);
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 对应 C# Constants.FailureTimes = 10000 */
const FAILURE_TIMES = 10000;

// ---------------------------------------------------------------------------
// WorkingMap static class
// ---------------------------------------------------------------------------

/**
 * 工作地图静态类
 *
 * 对应 C# RandomMapGenerator.WorkingMap（WorkingMap.cs，2372 行）。
 * 维护地图生成过程中的所有全局状态：图块网格、地图单元模板列表、
 * 地图成员矩阵、放置记录、各类非图块对象列表等。
 *
 * 所有字段和方法均为静态，与 C# 原版一致。服务器端应串行化地图生成请求
 * 以避免并发问题。
 */
export class WorkingMap {
  // ---- 静态字段（对应 C# public static properties） ----

  /** 对应 C# int Width */
  public static Width: number = 0;
  /** 对应 C# int Height */
  public static Height: number = 0;
  /** 对应 C# int[] Size = { Width, Height } */
  public static Size: number[] = [0, 0];
  /** 对应 C# AbstractTile[,] AbsTile（二维图块网格，[x][y]） */
  public static AbsTile: AbstractTile[][] = [];
  /** 对应 C# int MapTheater（Theater 枚举值） */
  public static MapTheater: number = 0;
  /** 对应 C# List<AbstractMapUnit> AbstractMapUnitList */
  public static AbstractMapUnitList: AbstractMapUnit[] = [];
  /** 对应 C# AbstractMapMember[,] AbstractMapMemberMatrix（[i][j]） */
  public static AbstractMapMemberMatrix: AbstractMapMember[][] = [];
  /** 对应 C# List<int[]> PlacedAbstractMapUnitRecord */
  public static PlacedAbstractMapUnitRecord: number[][] = [];
  /** 对应 C# List<FailureAbstractMapUnitRecord> FailureAbsMapUnitRecordList */
  public static FailureAbsMapUnitRecordList: FailureAbstractMapUnitRecord[] = [];
  /** 对应 C# List<Unit> UnitList */
  public static UnitList: Unit[] = [];
  /** 对应 C# List<Infantry> InfantryList */
  public static InfantryList: Infantry[] = [];
  /** 对应 C# List<Structure> StructureList */
  public static StructureList: Structure[] = [];
  /** 对应 C# List<Terrain> TerrainList */
  public static TerrainList: Terrain[] = [];
  /** 对应 C# List<Aircraft> AircraftList */
  public static AircraftList: Aircraft[] = [];
  /** 对应 C# List<Smudge> SmudgeList */
  public static SmudgeList: Smudge[] = [];
  /** 对应 C# List<Overlay> OverlayList */
  public static OverlayList: Overlay[] = [];
  /** 对应 C# List<Waypoint> WaypointList */
  public static WaypointList: Waypoint[] = [];
  /** 对应 C# int IndicatorNum */
  public static IndicatorNum: number = 0;
  /** 对应 C# string Path（TS 版不再用于文件 I/O，仅保留兼容） */
  public static Path: string = '';
  /** 对应 C# int MapUnitWidth */
  public static MapUnitWidth: number = 0;
  /** 对应 C# int MapUnitHeight */
  public static MapUnitHeight: number = 0;
  /** 对应 C# int StartingX */
  public static StartingX: number = 0;
  /** 对应 C# int StartingY */
  public static StartingY: number = 0;
  /** 对应 C# IniFile Rules（rulesmd.ini） */
  public static Rules: IniFile = new IniFile();
  /** 对应 C# IniFile Art（artmd.ini） */
  public static Art: IniFile = new IniFile();
  /** 对应 C# List<AbstractTileType> CannotPlaceSmudgeList */
  public static CannotPlaceSmudgeList: AbstractTileType[] = [];
  /** 对应 C# Random Randomizer */
  public static Randomizer: Random = new Random();
  /** 对应 C# int BottomSpace */
  public static BottomSpace: number = 0;

  // -----------------------------------------------------------------------
  // 1. SterilizeMapUnit – 读取所有地图单元文件
  // -----------------------------------------------------------------------

  /**
   * 读取并初始化所有地图单元模板。
   *
   * 对应 C# WorkingMap.SterilizeMapUnit(string path)。
   * C# 版从磁盘目录读取 indicator.map、cannotplacesmudge.map 及所有 .map/.yrm/.mpr 文件；
   * TS 版改为通过 WorkingMapConfig 传入文件内容字符串。
   *
   * 前置条件：Initialize() 必须先于本方法调用（AbstractMapUnit.Initialize 依赖
   * WorkingMap.StartingX / StartingY / MapUnitWidth / MapUnitHeight / IndicatorNum）。
   *
   * @param config 包含所有文件内容的配置对象
   */
  public static SterilizeMapUnit(config: WorkingMapConfig): void {
    WorkingMap.AbstractMapUnitList = [];
    WorkingMap.CannotPlaceSmudgeList = [];

    // 读取 indicator.map，获取 IndicatorNum
    const indicatorMap = new MapFile();
    indicatorMap.CreateIsoTileList(config.indicatorMapContent);
    if (indicatorMap.IsoTileList.length > 0) {
      WorkingMap.IndicatorNum = indicatorMap.IsoTileList[0].TileNum;
    }

    // 读取 cannotplacesmudge.map（可选）
    if (config.cannotPlaceSmudgeMapContent) {
      const smudgeMap = new MapFile();
      smudgeMap.CreateIsoTileList(config.cannotPlaceSmudgeMapContent);
      for (const tile of smudgeMap.IsoTileList) {
        if (tile.TileNum !== 0 && tile.TileNum !== -1) {
          const absTileType = new AbstractTileType();
          absTileType.TileNum = tile.TileNum;
          absTileType.SubTile = tile.SubTile;
          WorkingMap.CannotPlaceSmudgeList.push(absTileType);
        }
      }
    }

    // 读取所有地图单元 .map 文件
    for (const fileEntry of config.mapUnitFiles) {
      const fileInfo: FileInfoLike = {
        name: fileEntry.name,
        fullName: fileEntry.name,
      };
      const absMapUnit = new AbstractMapUnit();
      absMapUnit.Initialize(fileInfo, fileEntry.content);
      WorkingMap.AbstractMapUnitList.push(absMapUnit);
    }
  }

  // -----------------------------------------------------------------------
  // 2. Initialize – 初始化地图网格
  // -----------------------------------------------------------------------

  /**
   * 初始化地图网格及全局状态。
   *
   * 对应 C# WorkingMap.Initialize(int width, int height, string path)。
   * C# 版从 path 目录读取 settings.ini、Program.RulesPath、Program.ArtPath；
   * TS 版改为通过 WorkingMapConfig 传入文件内容字符串。
   *
   * @param width  地图宽度
   * @param height 地图高度
   * @param config 包含 settings/rules/art 文件内容的配置对象
   */
  public static Initialize(
    width: number,
    height: number,
    config: WorkingMapConfig,
  ): void {
    const settings = new IniFile(config.settingsContent);

    WorkingMap.MapUnitWidth = parseInt(
      settings.GetStringValue('settings', 'MapUnitSize', '25x25').split('x')[0],
      10,
    );
    WorkingMap.MapUnitHeight = parseInt(
      settings.GetStringValue('settings', 'MapUnitSize', '25x25').split('x')[1],
      10,
    );
    WorkingMap.StartingX = parseInt(
      settings.GetStringValue('settings', 'TopCorner', '18,18').split(',')[0],
      10,
    );
    WorkingMap.StartingY = parseInt(
      settings.GetStringValue('settings', 'TopCorner', '18,18').split(',')[1],
      10,
    );

    WorkingMap.Width = width;
    WorkingMap.Height = height;
    const range = WorkingMap.Width + WorkingMap.Height;

    // 初始化 AbsTile 二维数组 [range][range]
    WorkingMap.AbsTile = [];
    for (let x = 0; x < range; x++) {
      WorkingMap.AbsTile[x] = new Array<AbstractTile>(range);
    }
    WorkingMap.Size = [WorkingMap.Width, WorkingMap.Height];

    // 初始化 AbstractMapMemberMatrix
    const ammWidth = Math.ceil(range / WorkingMap.MapUnitWidth);
    const ammHeight = Math.ceil(range / WorkingMap.MapUnitHeight);
    WorkingMap.AbstractMapMemberMatrix = [];
    for (let i = 0; i < ammWidth; i++) {
      WorkingMap.AbstractMapMemberMatrix[i] = new Array<AbstractMapMember>(
        ammHeight,
      );
    }

    WorkingMap.PlacedAbstractMapUnitRecord = [];
    WorkingMap.FailureAbsMapUnitRecordList = [];
    WorkingMap.UnitList = [];
    WorkingMap.InfantryList = [];
    WorkingMap.StructureList = [];
    WorkingMap.TerrainList = [];
    WorkingMap.AircraftList = [];
    WorkingMap.SmudgeList = [];
    WorkingMap.OverlayList = [];
    WorkingMap.WaypointList = [];
    WorkingMap.Randomizer = new Random();

    WorkingMap.Rules = new IniFile(config.rulesContent);
    WorkingMap.Art = new IniFile(config.artContent);

    WorkingMap.BottomSpace = settings.GetIntValue('settings', 'BottomSpace', 4);

    // 解析剧场类型
    const theater = settings.GetStringValue('settings', 'Theater', 'NEWURBAN');
    if (theater) {
      const theaterMap: Record<string, number> = {
        NEWURBAN: Theater.NEWURBAN,
        URBAN: Theater.URBAN,
        TEMPERATE: Theater.TEMPERATE,
        LUNAR: Theater.LUNAR,
        DESERT: Theater.DESERT,
        SNOW: Theater.SNOW,
      };
      WorkingMap.MapTheater = theaterMap[theater] ?? Theater.TEMPERATE;
    }

    // 初始化每个 AbsTile
    for (let y = 0; y < range; y++) {
      for (let x = 0; x < range; x++) {
        const absTile = new AbstractTile();
        absTile.Initialize(x, y);
        WorkingMap.AbsTile[x][y] = absTile;
      }
    }

    // 初始化 AbstractMapMemberMatrix
    for (let i = 0; i < WorkingMap.AbstractMapMemberMatrix.length; i++) {
      for (
        let j = 0;
        j < WorkingMap.AbstractMapMemberMatrix[i].length;
        j++
      ) {
        WorkingMap.AbstractMapMemberMatrix[i][j] = new AbstractMapMember();
      }
    }

    // 计算每个 AbstractMapMember 的可见性、连接状态
    for (let i = 0; i < WorkingMap.AbstractMapMemberMatrix.length; i++) {
      for (
        let j = 0;
        j < WorkingMap.AbstractMapMemberMatrix[i].length;
        j++
      ) {
        const amm = WorkingMap.AbstractMapMemberMatrix[i][j];
        amm.IsAllOnVisibleMap = true;
        for (let x = 0; x < WorkingMap.MapUnitWidth; x++) {
          for (let y = 0; y < WorkingMap.MapUnitHeight; y++) {
            if (
              i * WorkingMap.MapUnitWidth + x < range &&
              j * WorkingMap.MapUnitHeight + y < range
            ) {
              if (
                WorkingMap.IsValidAT(
                  i * WorkingMap.MapUnitWidth + x,
                  j * WorkingMap.MapUnitHeight + y,
                )
              ) {
                const atTile =
                  WorkingMap.AbsTile[i * WorkingMap.MapUnitWidth + x][
                    j * WorkingMap.MapUnitHeight + y
                  ];
                if (atTile.IsOnMap) {
                  amm.IsOnMap = true;
                }
                if (!atTile.IsOnVisibleMap) {
                  amm.IsAllOnVisibleMap = false;
                }
              }
            }
          }
        }
        if (!amm.IsOnMap) {
          amm.IsAllOnVisibleMap = false;
        }
        if (!amm.IsOnMap) {
          amm.Placed = true;
        }

        // NE 连接（j-1 方向）
        if (WorkingMap.IsValidAMMM(i, j - 1)) {
          if (!WorkingMap.AbstractMapMemberMatrix[i][j - 1].IsOnMap) {
            amm.NEConnected = true;
          }
        } else {
          amm.NEConnected = true;
        }

        // SW 连接（j+1 方向）
        if (WorkingMap.IsValidAMMM(i, j + 1)) {
          if (!WorkingMap.AbstractMapMemberMatrix[i][j + 1].IsOnMap) {
            amm.SWConnected = true;
          }
        } else {
          amm.SWConnected = true;
        }

        // NW 连接（i-1 方向）
        if (WorkingMap.IsValidAMMM(i - 1, j)) {
          if (!WorkingMap.AbstractMapMemberMatrix[i - 1][j].IsOnMap) {
            amm.NWConnected = true;
          }
        } else {
          amm.NWConnected = true;
        }

        // SE 连接（i+1 方向）
        if (WorkingMap.IsValidAMMM(i + 1, j)) {
          if (!WorkingMap.AbstractMapMemberMatrix[i + 1][j].IsOnMap) {
            amm.SEConnected = true;
          }
        } else {
          amm.SEConnected = true;
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // 3-5. 边界检查方法
  // -----------------------------------------------------------------------

  /** 对应 C# IsValidAMMM(int x, int y) – 检查 AbstractMapMemberMatrix 边界 */
  public static IsValidAMMM(x: number, y: number): boolean {
    if (
      WorkingMap.AbstractMapMemberMatrix.length === 0 ||
      x >= WorkingMap.AbstractMapMemberMatrix.length ||
      x < 0
    ) {
      return false;
    }
    if (
      y >= WorkingMap.AbstractMapMemberMatrix[x].length ||
      y < 0
    ) {
      return false;
    }
    return true;
  }

  /** 对应 C# IsValidAT(int x, int y) – 检查 AbsTile 边界 */
  public static IsValidAT(x: number, y: number): boolean {
    if (
      x < WorkingMap.Width + WorkingMap.Height &&
      y < WorkingMap.Width + WorkingMap.Height &&
      x >= 0 &&
      y >= 0
    ) {
      return true;
    }
    return false;
  }

  /** 对应 C# IsOnMapAT(int x, int y) – 检查是否在地图可见范围 */
  public static IsOnMapAT(x: number, y: number): boolean {
    let isOnMap = false;
    if (
      y + x > WorkingMap.Width &&
      x + y < 2 * WorkingMap.Height + WorkingMap.Width + 1 &&
      y - x < WorkingMap.Width &&
      x - y < WorkingMap.Width
    ) {
      isOnMap = true;
    }
    return isOnMap;
  }

  // -----------------------------------------------------------------------
  // 6. GetAbstractMapUnitByName
  // -----------------------------------------------------------------------

  /**
   * 按名称获取地图单元模板。
   *
   * 对应 C# GetAbstractMapUnitByName(string mapUnitName)。
   * 未找到时返回一个新建的空 AbstractMapUnit（与 C# 原版语义一致）。
   */
  public static GetAbstractMapUnitByName(mapUnitName: string): AbstractMapUnit {
    let absMapUnit = new AbstractMapUnit();
    for (const pAbsMapUnit of WorkingMap.AbstractMapUnitList) {
      if (mapUnitName === pAbsMapUnit.MapUnitName) {
        absMapUnit = pAbsMapUnit;
      }
    }
    return absMapUnit;
  }

  // -----------------------------------------------------------------------
  // 7. GetNearbyAbstractMapMemberInfo
  // -----------------------------------------------------------------------

  /**
   * 获取相邻4个 AbstractMapMember（NE, NW, SW, SE 顺序）。
   *
   * 对应 C# GetNearbyAbstractMapMemberInfo(int x, int y)。
   * 返回长度为 4 的数组，无效位置的元素为 null。
   *
   * 顺序：
   *   [0] = NE  (x, y-1)
   *   [1] = NW  (x-1, y)
   *   [2] = SW  (x, y+1)
   *   [3] = SE  (x+1, y)
   */
  public static GetNearbyAbstractMapMemberInfo(
    x: number,
    y: number,
  ): (AbstractMapMember | null)[] {
    const absMapMember: (AbstractMapMember | null)[] = [null, null, null, null];
    if (WorkingMap.IsValidAMMM(x, y - 1)) {
      absMapMember[0] = WorkingMap.AbstractMapMemberMatrix[x][y - 1];
    }
    if (WorkingMap.IsValidAMMM(x - 1, y)) {
      absMapMember[1] = WorkingMap.AbstractMapMemberMatrix[x - 1][y];
    }
    if (WorkingMap.IsValidAMMM(x, y + 1)) {
      absMapMember[2] = WorkingMap.AbstractMapMemberMatrix[x][y + 1];
    }
    if (WorkingMap.IsValidAMMM(x + 1, y)) {
      absMapMember[3] = WorkingMap.AbstractMapMemberMatrix[x + 1][y];
    }
    return absMapMember;
  }

  // -----------------------------------------------------------------------
  // 8. PlaceMapUnitToWorkingMap
  // -----------------------------------------------------------------------

  /**
   * 将指定地图单元放置到工作地图的 (x, y) 位置。
   *
   * 对应 C# PlaceMapUnitToWorkingMap(int x, int y, string mapUnitName)。
   * 将地图单元的图块类型写入 AbsTile 对应区域，并标记成员为已放置。
   */
  public static PlaceMapUnitToWorkingMap(
    x: number,
    y: number,
    mapUnitName: string,
  ): void {
    for (const mapUnit of WorkingMap.AbstractMapUnitList) {
      if (mapUnit.MapUnitName === mapUnitName) {
        mapUnit.UseTimes++;
        break;
      }
    }
    const absMapUnit = WorkingMap.GetAbstractMapUnitByName(mapUnitName);
    WorkingMap.AbstractMapMemberMatrix[x][y].Placed = true;

    for (let i = 0; i < WorkingMap.MapUnitWidth; i++) {
      for (let j = 0; j < WorkingMap.MapUnitHeight; j++) {
        if (
          WorkingMap.IsValidAT(
            x * WorkingMap.MapUnitWidth + i,
            y * WorkingMap.MapUnitHeight + j,
          )
        ) {
          const absTileType = absMapUnit.AbsTileType[i][j];
          const absTile = new AbstractTile();
          absTile.SetProperty(
            x * WorkingMap.MapUnitWidth + i,
            y * WorkingMap.MapUnitHeight + j,
            0,
            absTileType,
          );
          WorkingMap.AbsTile[x * WorkingMap.MapUnitWidth + i][
            y * WorkingMap.MapUnitHeight + j
          ] = absTile;
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // 9. CreateNonTileObjectLists
  // -----------------------------------------------------------------------

  /**
   * 遍历 AbstractMapMemberMatrix，将每个成员对应的地图单元模板中的
   * 非图块对象（建筑、单位、步兵、地形、飞机、污迹、路径点、覆盖物）
   * 放置到工作地图并填充对应的全局列表。
   *
   * 对应 C# CreateNonTileObjectLists()。
   */
  public static CreateNonTileObjectLists(): void {
    console.log('******************************************************');
    console.log('Start creating non-tile objects');
    console.log('******************************************************');

    for (let i = 0; i < WorkingMap.AbstractMapMemberMatrix.length; i++) {
      for (
        let j = 0;
        j < WorkingMap.AbstractMapMemberMatrix[i].length;
        j++
      ) {
        const absMapMember = WorkingMap.AbstractMapMemberMatrix[i][j];
        const absMapUnit = absMapMember.GetAbstractMapUnit();
        const unitList = absMapUnit.UnitList;
        const infantryList = absMapUnit.InfantryList;
        const structureList = absMapUnit.StructureList;
        const terrainList = absMapUnit.TerrainList;
        const aircraftList = absMapUnit.AircraftList;
        const smudgeList = absMapUnit.SmudgeList;
        const overlayList = absMapUnit.OverlayList;
        const waypointList = absMapUnit.WaypointList;

        // Structures
        if (structureList && structureList.length > 0) {
          for (let k = 0; k < structureList.length; k++) {
            const newStructure = structureList[k].Clone();
            newStructure.X = newStructure.RelativeX + i * WorkingMap.MapUnitWidth;
            newStructure.Y =
              newStructure.RelativeY + j * WorkingMap.MapUnitHeight;

            if (
              WorkingMap.IsValidAT(newStructure.X, newStructure.Y) &&
              WorkingMap.IsOnMapAT(newStructure.X, newStructure.Y)
            ) {
              if (
                WorkingMap.CanPlaceStructure(
                  newStructure.X,
                  newStructure.Y,
                  newStructure.Name,
                )
              ) {
                WorkingMap.StructureList.push(newStructure);
                console.log(
                  `Add structure [${newStructure.Name}] in [${newStructure.X},${newStructure.Y}]`,
                );
                const size = WorkingMap.GetStructureSize(newStructure.Name);
                for (let l = 0; l < size[0]; l++) {
                  for (let m = 0; m < size[1]; m++) {
                    WorkingMap.AbsTile[newStructure.X + l][
                      newStructure.Y + m
                    ].HasStructure = true;
                    if (WorkingMap.IsNeuralTechBuilding(newStructure.Name)) {
                      WorkingMap.AbsTile[newStructure.X + l][
                        newStructure.Y + m
                      ].HasNeuralTechStructure = true;
                    }
                  }
                }
              } else {
                console.warn(
                  `Cannot structure unit [${newStructure.Name}] in [${newStructure.X},${newStructure.Y}] because it is blocked`,
                );
              }
            }
          }
        }

        // Units
        if (unitList && unitList.length > 0) {
          for (let k = 0; k < unitList.length; k++) {
            const newUnit = unitList[k].Clone();
            newUnit.X = newUnit.RelativeX + i * WorkingMap.MapUnitWidth;
            newUnit.Y = newUnit.RelativeY + j * WorkingMap.MapUnitHeight;

            if (
              WorkingMap.IsValidAT(newUnit.X, newUnit.Y) &&
              WorkingMap.IsOnMapAT(newUnit.X, newUnit.Y)
            ) {
              if (WorkingMap.CanPlaceUnit(newUnit.X, newUnit.Y)) {
                WorkingMap.UnitList.push(newUnit);
                console.log(
                  `Add unit [${newUnit.Name}] in [${newUnit.X},${newUnit.Y}]`,
                );
                WorkingMap.AbsTile[newUnit.X][newUnit.Y].HasUnit = true;
              } else {
                console.warn(
                  `Cannot place unit [${newUnit.Name}] in [${newUnit.X},${newUnit.Y}] because it is blocked`,
                );
              }
            }
          }
        }

        // Infantry
        if (infantryList && infantryList.length > 0) {
          for (let k = 0; k < infantryList.length; k++) {
            const newInfantry = infantryList[k].Clone();
            newInfantry.X =
              newInfantry.RelativeX + i * WorkingMap.MapUnitWidth;
            newInfantry.Y =
              newInfantry.RelativeY + j * WorkingMap.MapUnitHeight;

            if (
              WorkingMap.IsValidAT(newInfantry.X, newInfantry.Y) &&
              WorkingMap.IsOnMapAT(newInfantry.X, newInfantry.Y)
            ) {
              if (WorkingMap.CanPlaceInfantry(newInfantry.X, newInfantry.Y)) {
                WorkingMap.InfantryList.push(newInfantry);
                console.log(
                  `Add infantry [${newInfantry.Name}] in [${newInfantry.X},${newInfantry.Y}]`,
                );
                WorkingMap.AbsTile[newInfantry.X][newInfantry.Y].HasInfantry =
                  true;
                WorkingMap.AbsTile[newInfantry.X][
                  newInfantry.Y
                ].InfantryCount++;
              } else {
                console.warn(
                  `Cannot place infantry [${newInfantry.Name}] in [${newInfantry.X},${newInfantry.Y}] because it is blocked`,
                );
              }
            }
          }
        }

        // Terrain
        if (terrainList && terrainList.length > 0) {
          for (let k = 0; k < terrainList.length; k++) {
            const newTerrain = terrainList[k].Clone();
            newTerrain.X =
              newTerrain.RelativeX + i * WorkingMap.MapUnitWidth;
            newTerrain.Y =
              newTerrain.RelativeY + j * WorkingMap.MapUnitHeight;

            if (
              WorkingMap.IsValidAT(newTerrain.X, newTerrain.Y) &&
              WorkingMap.IsOnMapAT(newTerrain.X, newTerrain.Y)
            ) {
              if (newTerrain.Name.includes('TRFF')) {
                if (WorkingMap.CanPlaceTRFF(newTerrain.X, newTerrain.Y)) {
                  WorkingMap.TerrainList.push(newTerrain);
                  console.log(
                    `Add terrain [${newTerrain.Name}] in [${newTerrain.X},${newTerrain.Y}]`,
                  );
                  WorkingMap.AbsTile[newTerrain.X][newTerrain.Y].HasTerrain =
                    true;
                  WorkingMap.AbsTile[newTerrain.X][
                    newTerrain.Y
                  ].TerrainName = newTerrain.Name;
                } else {
                  console.warn(
                    `Cannot place terrain [${newTerrain.Name}] in [${newTerrain.X},${newTerrain.Y}] because it is blocked`,
                  );
                }
              } else {
                if (WorkingMap.CanPlaceTerrain(newTerrain.X, newTerrain.Y)) {
                  WorkingMap.TerrainList.push(newTerrain);
                  console.log(
                    `Add terrain [${newTerrain.Name}] in [${newTerrain.X},${newTerrain.Y}]`,
                  );
                  WorkingMap.AbsTile[newTerrain.X][newTerrain.Y].HasTerrain =
                    true;
                  WorkingMap.AbsTile[newTerrain.X][
                    newTerrain.Y
                  ].TerrainName = newTerrain.Name;
                } else {
                  console.warn(
                    `Cannot place terrain [${newTerrain.Name}] in [${newTerrain.X},${newTerrain.Y}] because it is blocked`,
                  );
                }
              }
            }
          }
        }

        // Aircraft
        if (aircraftList && aircraftList.length > 0) {
          for (let k = 0; k < aircraftList.length; k++) {
            const newAircraft = aircraftList[k].Clone();
            newAircraft.X =
              newAircraft.RelativeX + i * WorkingMap.MapUnitWidth;
            newAircraft.Y =
              newAircraft.RelativeY + j * WorkingMap.MapUnitHeight;

            if (
              WorkingMap.IsValidAT(newAircraft.X, newAircraft.Y) &&
              WorkingMap.IsOnMapAT(newAircraft.X, newAircraft.Y)
            ) {
              if (WorkingMap.CanPlaceAircraft(newAircraft.X, newAircraft.Y)) {
                WorkingMap.AircraftList.push(newAircraft);
                console.log(
                  `Add aircraft [${newAircraft.Name}] in [${newAircraft.X},${newAircraft.Y}]`,
                );
                WorkingMap.AbsTile[newAircraft.X][
                  newAircraft.Y
                ].HasAircraft = true;
              } else {
                console.warn(
                  `Cannot place aircraft [${newAircraft.Name}] in [${newAircraft.X},${newAircraft.Y}] because it is blocked`,
                );
              }
            }
          }
        }

        // Smudge
        if (smudgeList && smudgeList.length > 0) {
          for (let k = 0; k < smudgeList.length; k++) {
            const newSmudge = smudgeList[k].Clone();
            newSmudge.X = newSmudge.RelativeX + i * WorkingMap.MapUnitWidth;
            newSmudge.Y = newSmudge.RelativeY + j * WorkingMap.MapUnitHeight;

            if (
              WorkingMap.IsValidAT(newSmudge.X, newSmudge.Y) &&
              WorkingMap.IsOnMapAT(newSmudge.X, newSmudge.Y)
            ) {
              if (
                WorkingMap.CanPlaceSmudge(
                  newSmudge.X,
                  newSmudge.Y,
                  newSmudge.Name,
                )
              ) {
                WorkingMap.SmudgeList.push(newSmudge);
                console.log(
                  `Add smudge [${newSmudge.Name}] in [${newSmudge.X},${newSmudge.Y}]`,
                );
                const size = WorkingMap.GetSmudgeSize(newSmudge.Name);
                for (let l = 0; l < size[0]; l++) {
                  for (let m = 0; m < size[1]; m++) {
                    WorkingMap.AbsTile[newSmudge.X + l][
                      newSmudge.Y + m
                    ].HasSmudge = true;
                  }
                }
              } else {
                console.warn(
                  `Cannot place smudge [${newSmudge.Name}] in [${newSmudge.X},${newSmudge.Y}] because it is blocked`,
                );
              }
            }
          }
        }

        // Waypoints
        if (waypointList && waypointList.length > 0) {
          for (let k = 0; k < waypointList.length; k++) {
            const newWaypoint = waypointList[k].Clone();
            newWaypoint.X =
              newWaypoint.RelativeX + i * WorkingMap.MapUnitWidth;
            newWaypoint.Y =
              newWaypoint.RelativeY + j * WorkingMap.MapUnitHeight;

            if (
              WorkingMap.IsValidAT(newWaypoint.X, newWaypoint.Y) &&
              WorkingMap.IsOnMapAT(newWaypoint.X, newWaypoint.Y)
            ) {
              WorkingMap.WaypointList.push(newWaypoint);
              console.log(
                `Add waypoint [${WorkingMap.WaypointList.length - 1}] in [${newWaypoint.X},${newWaypoint.Y}]`,
              );
            }
          }
        }

        // Overlay
        if (overlayList && overlayList.length > 0) {
          for (let k = 0; k < overlayList.length; k++) {
            const newOverlay = new Overlay(
              overlayList[k].OverlayID,
              overlayList[k].OverlayValue,
            );
            const tile = overlayList[k].Tile;
            if (tile !== null) {
              newOverlay.Tile = new IsoTile(
                tile.Dx,
                tile.Dy,
                tile.Rx,
                tile.Ry,
                tile.Z,
                tile.TileNum,
                tile.SubTile,
              );
              newOverlay.Tile.Rx =
                newOverlay.Tile.Rx + i * WorkingMap.MapUnitWidth;
              newOverlay.Tile.Ry =
                newOverlay.Tile.Ry + j * WorkingMap.MapUnitHeight;

              if (
                WorkingMap.IsValidAT(
                  newOverlay.Tile.Rx,
                  newOverlay.Tile.Ry,
                ) &&
                WorkingMap.IsOnMapAT(
                  newOverlay.Tile.Rx,
                  newOverlay.Tile.Ry,
                )
              ) {
                if (
                  WorkingMap.CanPlaceOverlay(
                    newOverlay.Tile.Rx,
                    newOverlay.Tile.Ry,
                  )
                ) {
                  WorkingMap.OverlayList.push(newOverlay);
                  console.log(
                    `Add overlay [${newOverlay.OverlayID},${newOverlay.OverlayValue}] in [${newOverlay.Tile.Rx},${newOverlay.Tile.Ry}]`,
                  );
                  WorkingMap.AbsTile[newOverlay.Tile.Rx][
                    newOverlay.Tile.Ry
                  ].HasOverlay = true;
                  WorkingMap.AbsTile[newOverlay.Tile.Rx][
                    newOverlay.Tile.Ry
                  ].OverlayID = newOverlay.OverlayID;
                  WorkingMap.AbsTile[newOverlay.Tile.Rx][
                    newOverlay.Tile.Ry
                  ].OverlayValue = newOverlay.OverlayValue;
                } else {
                  console.warn(
                    `Cannot place overlay [${newOverlay.OverlayID},${newOverlay.OverlayValue}] in [${newOverlay.Tile.Rx},${newOverlay.Tile.Ry}] because it is blocked`,
                  );
                }
              }
            }
          }
        }
      }
    }
    console.log('******************************************************');
    console.log('End of creating non-tile objects');
    console.log('******************************************************');
  }

  // -----------------------------------------------------------------------
  // PlaceMapUnitByAbsMapMatrix
  // -----------------------------------------------------------------------

  /**
   * 将 AbstractMapMemberMatrix 中已分配的地图单元全部放置到工作地图，
   * 然后创建非图块对象列表。
   *
   * 对应 C# PlaceMapUnitByAbsMapMatrix()。
   */
  public static PlaceMapUnitByAbsMapMatrix(): void {
    for (let i = 0; i < WorkingMap.AbstractMapMemberMatrix.length; i++) {
      for (
        let j = 0;
        j < WorkingMap.AbstractMapMemberMatrix[i].length;
        j++
      ) {
        if (WorkingMap.AbstractMapMemberMatrix[i][j].IsOnMap) {
          WorkingMap.PlaceMapUnitToWorkingMap(
            i,
            j,
            WorkingMap.AbstractMapMemberMatrix[i][j].MapUnitName,
          );
        }
      }
    }
    WorkingMap.CreateNonTileObjectLists();
  }

  // -----------------------------------------------------------------------
  // CountMapUnitUsage
  // -----------------------------------------------------------------------

  /** 对应 C# CountMapUnitUsage() – 输出地图单元使用次数统计 */
  public static CountMapUnitUsage(): void {
    console.log('******************************************************');
    console.log('Map units usage statistics:');
    for (const mapUnit of WorkingMap.AbstractMapUnitList) {
      console.log(`${mapUnit.MapUnitName}: ${mapUnit.UseTimes}`);
    }
    console.log('******************************************************');
  }

  // -----------------------------------------------------------------------
  // SetMapUnit / SetMapUnitTest / DeleteMapUnitTest
  // -----------------------------------------------------------------------

  /** 对应 C# SetMapUnit(int x, int y, string mapUnitName) */
  public static SetMapUnit(x: number, y: number, mapUnitName: string): void {
    if (WorkingMap.IsValidAMMM(x, y)) {
      WorkingMap.AbstractMapMemberMatrix[x][y].MapUnitName = mapUnitName;
      WorkingMap.AbstractMapMemberMatrix[x][y].Placed = true;
      WorkingMap.RecordPlacedMapUnit(x, y);
    }
  }

  /** 对应 C# SetMapUnitTest(int x, int y, string mapUnitName) */
  public static SetMapUnitTest(
    x: number,
    y: number,
    mapUnitName: string,
  ): void {
    if (WorkingMap.IsValidAMMM(x, y)) {
      WorkingMap.AbstractMapMemberMatrix[x][y].MapUnitName = mapUnitName;
      WorkingMap.AbstractMapMemberMatrix[x][y].Placed = true;
    }
  }

  /** 对应 C# DeleteMapUnitTest(int x, int y) */
  public static DeleteMapUnitTest(x: number, y: number): void {
    if (WorkingMap.IsValidAMMM(x, y)) {
      WorkingMap.AbstractMapMemberMatrix[x][y].MapUnitName = 'empty';
      WorkingMap.AbstractMapMemberMatrix[x][y].Placed = false;
    }
  }

  // -----------------------------------------------------------------------
  // RandomSetMapUnit
  // -----------------------------------------------------------------------

  /**
   * 从候选列表中随机选择一个地图单元放置到 (x, y)。
   *
   * 对应 C# RandomSetMapUnit(int x, int y, List<string> mapUnitName)。
   * 会移除与相邻成员同名的候选（避免重复），使用等权重随机选择。
   */
  public static RandomSetMapUnit(
    x: number,
    y: number,
    mapUnitName: string[],
  ): void {
    const randomizer = new WeightedRandomizer<string>();
    const nearby = WorkingMap.GetNearbyAbstractMapMemberInfo(x, y);

    // 移除与相邻成员同名的候选（保留至少1个）
    if (nearby[0] !== null) {
      for (let i = mapUnitName.length - 1; i >= 0; i--) {
        if (
          mapUnitName.length > 1 &&
          mapUnitName[i] === nearby[0]!.MapUnitName
        ) {
          mapUnitName.splice(i, 1);
        }
      }
    }
    if (nearby[1] !== null) {
      for (let i = mapUnitName.length - 1; i >= 0; i--) {
        if (
          mapUnitName.length > 1 &&
          mapUnitName[i] === nearby[1]!.MapUnitName
        ) {
          mapUnitName.splice(i, 1);
        }
      }
    }
    if (nearby[2] !== null) {
      for (let i = mapUnitName.length - 1; i >= 0; i--) {
        if (
          mapUnitName.length > 1 &&
          mapUnitName[i] === nearby[2]!.MapUnitName
        ) {
          mapUnitName.splice(i, 1);
        }
      }
    }
    if (nearby[3] !== null) {
      for (let i = mapUnitName.length - 1; i >= 0; i--) {
        if (
          mapUnitName.length > 1 &&
          mapUnitName[i] === nearby[3]!.MapUnitName
        ) {
          mapUnitName.splice(i, 1);
        }
      }
    }

    for (const name of mapUnitName) {
      randomizer.Add(name, 1);
    }
    WorkingMap.SetMapUnit(x, y, randomizer.NextWithReplacement());
  }

  // -----------------------------------------------------------------------
  // MovePositionCloseToCenter
  // -----------------------------------------------------------------------

  /**
   * 将坐标向中心移动一步。
   *
   * 对应 C# MovePositionCloseToCenter(int x, int y)。
   * 注意：C# 原版对 y 的比较也使用 centerL[0]（疑似 bug），此处保持一致。
   */
  public static MovePositionCloseToCenter(
    x: number,
    y: number,
  ): number[] {
    const centerL = WorkingMap.GetCentralAbsMapMemberLocation();
    if (x < centerL[0]) {
      x++;
    } else if (x > centerL[0]) {
      x--;
    }
    if (y < centerL[0]) {
      y++;
    } else if (y > centerL[0]) {
      y--;
    }
    return [x, y];
  }

  // -----------------------------------------------------------------------
  // RandomSetMapUnitNoOverlap
  // -----------------------------------------------------------------------

  /**
   * 在 (x, y) 或其附近放置地图单元，避免与已放置的相邻单元重叠。
   * 如果当前位置不可用，递归向中心移动。
   *
   * 对应 C# RandomSetMapUnitNoOverlap(int x, int y, List<string> mapUnitName)。
   */
  public static RandomSetMapUnitNoOverlap(
    x: number,
    y: number,
    mapUnitName: string[],
  ): void {
    const group: number[][] = [
      [x - 1, y - 1],
      [x - 1, y],
      [x - 1, y + 1],
      [x, y - 1],
      [x, y + 1],
      [x + 1, y - 1],
      [x + 1, y],
      [x + 1, y + 1],
    ];

    if (
      WorkingMap.AbstractMapMemberMatrix[x][y].Placed ||
      !WorkingMap.AbstractMapMemberMatrix[x][y].IsAllOnVisibleMap
    ) {
      for (let i = 0; i < group.length; i++) {
        if (WorkingMap.IsValidAMMM(group[i][0], group[i][1])) {
          if (
            !WorkingMap.AbstractMapMemberMatrix[group[i][0]][group[i][1]]
              .Placed &&
            WorkingMap.AbstractMapMemberMatrix[group[i][0]][group[i][1]]
              .IsAllOnVisibleMap
          ) {
            WorkingMap.RandomSetMapUnit(
              group[i][0],
              group[i][1],
              mapUnitName,
            );
            return;
          }
        }
      }
    } else {
      WorkingMap.RandomSetMapUnit(x, y, mapUnitName);
      return;
    }

    const moved = WorkingMap.MovePositionCloseToCenter(x, y);
    const newX = moved[0];
    const newY = moved[1];
    const centerL = WorkingMap.GetCentralAbsMapMemberLocation();

    if (newX !== centerL[0] || newY !== centerL[1]) {
      WorkingMap.RandomSetMapUnitNoOverlap(newX, newY, mapUnitName);
    }
  }

  // -----------------------------------------------------------------------
  // RecordPlacedMapUnit / DeleteMapUnit
  // -----------------------------------------------------------------------

  /** 对应 C# RecordPlacedMapUnit(int x, int y) */
  public static RecordPlacedMapUnit(x: number, y: number): void {
    WorkingMap.PlacedAbstractMapUnitRecord.push([x, y]);
  }

  /** 对应 C# DeleteMapUnit(int x, int y) */
  public static DeleteMapUnit(x: number, y: number): void {
    if (WorkingMap.IsValidAMMM(x, y)) {
      WorkingMap.AbstractMapMemberMatrix[x][y].MapUnitName = 'empty';
      WorkingMap.AbstractMapMemberMatrix[x][y].Placed = false;
      WorkingMap.UpdateMapUnitInfo();
      console.warn(
        `Delete [${x},${y}] because the next step has no valid options`,
      );
      console.log('');
      let removeIndex = -1;
      for (let i = 0; i < WorkingMap.PlacedAbstractMapUnitRecord.length; i++) {
        const record = WorkingMap.PlacedAbstractMapUnitRecord[i];
        if (record[0] === x && record[1] === y) {
          removeIndex = i;
        }
      }
      if (removeIndex > -1) {
        WorkingMap.PlacedAbstractMapUnitRecord.splice(removeIndex, 1);
      }
    }
  }

  // -----------------------------------------------------------------------
  // SetMapUnitByEntropy
  // -----------------------------------------------------------------------

  /**
   * 基于熵值的地图单元放置主循环。
   *
   * 对应 C# SetMapUnitByEntropy()。
   * 每轮选取熵值最低的未放置成员，尝试放置有效地图单元；
   * 若无有效选项，回溯删除上一个放置的单元并记录失败。
   * 最多尝试 FAILURE_TIMES 次后放弃。
   */
  public static SetMapUnitByEntropy(): void {
    let notAllMapUnitsSet = true;
    let failureTimes = 0;
    while (notAllMapUnitsSet) {
      WorkingMap.UpdateMapUnitInfo();
      notAllMapUnitsSet = false;
      for (let i = 0; i < WorkingMap.AbstractMapMemberMatrix.length; i++) {
        for (
          let j = 0;
          j < WorkingMap.AbstractMapMemberMatrix[i].length;
          j++
        ) {
          const absMapMember = WorkingMap.AbstractMapMemberMatrix[i][j];
          if (
            !(
              absMapMember.SEConnected &&
              absMapMember.NWConnected &&
              absMapMember.SWConnected &&
              absMapMember.NEConnected
            )
          ) {
            notAllMapUnitsSet = true;
          }
        }
      }

      const targetMapUnit = WorkingMap.GetLowestEntropyMU();
      if (targetMapUnit[0] === -1 && targetMapUnit[1] === -1) {
        console.log('******************************************************');
        console.log('Successfully place all map units!');
        console.log('******************************************************');
        return;
      }

      // order: NE NW SW SE
      const nearbyAbsMapMember = WorkingMap.GetNearbyAbstractMapMemberInfo(
        targetMapUnit[0],
        targetMapUnit[1],
      );
      let validMapUnitList = WorkingMap.GetValidAbsMapUnitList(
        nearbyAbsMapMember,
      );

      let failureRecord = new FailureAbstractMapUnitRecord();
      const deleteUnitMap: number[] = [];
      for (const record of WorkingMap.FailureAbsMapUnitRecordList) {
        if (record.IsTargetFailureRecord(targetMapUnit[0], targetMapUnit[1])) {
          failureRecord = record;
        }
      }
      for (let i = 0; i < validMapUnitList.length; i++) {
        if (failureRecord.IsInFailureRecord(validMapUnitList[i].MapUnitName)) {
          deleteUnitMap.push(i);
        }
      }
      for (let i = validMapUnitList.length - 1; i >= 0; i--) {
        for (const record of deleteUnitMap) {
          if (i === record) {
            validMapUnitList.splice(i, 1);
          }
        }
      }

      // 移除 spawn 和 tiberium 类型的地图单元（它们由专门方法处理）
      for (let i = validMapUnitList.length - 1; i >= 0; i--) {
        if (
          validMapUnitList[i].MapUnitName.includes('spawn') ||
          validMapUnitList[i].MapUnitName.includes('tiberium')
        ) {
          validMapUnitList.splice(i, 1);
        }
      }

      // 检查放置某单元后，NE 方向的成员是否仍有有效选项
      const nearbyAbsMapMemberOfNE = WorkingMap.GetNearbyAbstractMapMemberInfo(
        targetMapUnit[0],
        targetMapUnit[1] - 1,
      );

      if (validMapUnitList.length > 0) {
        for (let i = validMapUnitList.length - 1; i >= 0; i--) {
          WorkingMap.SetMapUnitTest(
            targetMapUnit[0],
            targetMapUnit[1],
            validMapUnitList[i].MapUnitName,
          );
          const validMapUnitListOfNE = WorkingMap.GetValidAbsMapUnitList(
            nearbyAbsMapMemberOfNE,
          );
          if (validMapUnitListOfNE.length < 1) {
            console.warn(
              validMapUnitList[i].MapUnitName +
                ' is removed because it will cause further struggle',
            );
            validMapUnitList.splice(i, 1);
          }
          WorkingMap.DeleteMapUnitTest(targetMapUnit[0], targetMapUnit[1]);
        }
      }

      const randomizer = new WeightedRandomizer<string>();
      if (validMapUnitList.length > 0) {
        console.log('Valid map unit list:');
        let weight = 0;
        for (const abstractMapUnit of validMapUnitList) {
          weight += abstractMapUnit.Weight;
        }
        if (weight > 0) {
          for (const abstractMapUnit of validMapUnitList) {
            randomizer.Add(abstractMapUnit.MapUnitName, abstractMapUnit.Weight);
            weight += abstractMapUnit.Weight;
            console.log(
              '  Name: ' +
                abstractMapUnit.MapUnitName +
                ', Weight: ' +
                abstractMapUnit.Weight,
            );
          }
        } else {
          for (const abstractMapUnit of validMapUnitList) {
            randomizer.Add(abstractMapUnit.MapUnitName, 1);
            weight += abstractMapUnit.Weight;
            console.log(
              '  Name: ' + abstractMapUnit.MapUnitName + ', Weight: 1',
            );
          }
          console.warn('Weights are modified because all of them are 0');
        }
        const result = randomizer.NextWithReplacement();
        WorkingMap.SetMapUnit(targetMapUnit[0], targetMapUnit[1], result);
        console.log(
          `Choose ${result} to place in [${targetMapUnit[0]},${targetMapUnit[1]}]`,
        );
        console.log('');
      } else {
        // 无有效选项，回溯
        const previousLocation =
          WorkingMap.PlacedAbstractMapUnitRecord[
            WorkingMap.PlacedAbstractMapUnitRecord.length - 1
          ];
        const previousName =
          WorkingMap.AbstractMapMemberMatrix[previousLocation[0]][
            previousLocation[1]
          ].MapUnitName;
        const failure = new FailureAbstractMapUnitRecord();
        let existFailureIndex = -1;
        for (
          let i = 0;
          i < WorkingMap.FailureAbsMapUnitRecordList.length;
          i++
        ) {
          if (
            WorkingMap.FailureAbsMapUnitRecordList[i].IsTargetFailureRecord(
              previousLocation[0],
              previousLocation[1],
            )
          ) {
            existFailureIndex = i;
          }
        }
        if (existFailureIndex > -1) {
          WorkingMap.FailureAbsMapUnitRecordList[existFailureIndex].AddFailureRecord(
            previousLocation[0],
            previousLocation[1],
            previousName,
          );
        } else {
          failure.AddFailureRecord(
            previousLocation[0],
            previousLocation[1],
            previousName,
          );
          WorkingMap.FailureAbsMapUnitRecordList.push(failure);
        }
        for (const failureRec of WorkingMap.FailureAbsMapUnitRecordList) {
          if (failureRec.IsTargetFailureRecord(targetMapUnit[0], targetMapUnit[1])) {
            failureRec.Name.length = 0;
          }
        }
        WorkingMap.DeleteMapUnit(previousLocation[0], previousLocation[1]);

        failureTimes++;
        if (failureTimes >= FAILURE_TIMES) {
          console.error('No valid map unit to place!');
          return;
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // GetFirstEmptyMapMember
  // -----------------------------------------------------------------------

  /**
   * 按顺序查找第一个未放置的地图成员。
   *
   * 对应 C# GetFirstEmptyMapMember()。
   * 返回 [i, j] 坐标；全部已放置时返回 [0, 0]（注意：C# 原版如此）。
   */
  public static GetFirstEmptyMapMember(): number[] {
    const colCount =
      WorkingMap.AbstractMapMemberMatrix.length > 0
        ? WorkingMap.AbstractMapMemberMatrix[0].length
        : 0;
    for (let j = 0; j < colCount; j++) {
      for (
        let i = 0;
        i < WorkingMap.AbstractMapMemberMatrix.length;
        i++
      ) {
        if (
          WorkingMap.AbstractMapMemberMatrix[i][j].IsOnMap &&
          WorkingMap.AbstractMapMemberMatrix[i][j].MapUnitName === 'empty'
        ) {
          return [i, j];
        }
      }
    }
    return [0, 0];
  }

  // -----------------------------------------------------------------------
  // SetMapUnitByOrder
  // -----------------------------------------------------------------------

  /**
   * 按顺序放置地图单元（与 SetMapUnitByEntropy 类似，但使用顺序查找代替熵查找）。
   *
   * 对应 C# SetMapUnitByOrder()。
   */
  public static SetMapUnitByOrder(): void {
    let notAllMapUnitsSet = true;
    let failureTimes = 0;
    while (notAllMapUnitsSet) {
      WorkingMap.UpdateMapUnitInfo();
      notAllMapUnitsSet = false;
      for (let i = 0; i < WorkingMap.AbstractMapMemberMatrix.length; i++) {
        for (
          let j = 0;
          j < WorkingMap.AbstractMapMemberMatrix[i].length;
          j++
        ) {
          const absMapMember = WorkingMap.AbstractMapMemberMatrix[i][j];
          if (
            !(
              absMapMember.SEConnected &&
              absMapMember.NWConnected &&
              absMapMember.SWConnected &&
              absMapMember.NEConnected
            )
          ) {
            notAllMapUnitsSet = true;
          }
        }
      }

      const targetMapUnit = WorkingMap.GetFirstEmptyMapMember();
      if (targetMapUnit[0] === -1 && targetMapUnit[1] === -1) {
        console.log('******************************************************');
        console.log('Successfully place all map units!');
        console.log('******************************************************');
        return;
      }

      const nearbyAbsMapMember = WorkingMap.GetNearbyAbstractMapMemberInfo(
        targetMapUnit[0],
        targetMapUnit[1],
      );
      let validMapUnitList = WorkingMap.GetValidAbsMapUnitList(
        nearbyAbsMapMember,
      );

      let failureRecord = new FailureAbstractMapUnitRecord();
      const deleteUnitMap: number[] = [];
      for (const record of WorkingMap.FailureAbsMapUnitRecordList) {
        if (record.IsTargetFailureRecord(targetMapUnit[0], targetMapUnit[1])) {
          failureRecord = record;
        }
      }
      for (let i = 0; i < validMapUnitList.length; i++) {
        if (failureRecord.IsInFailureRecord(validMapUnitList[i].MapUnitName)) {
          deleteUnitMap.push(i);
        }
      }
      for (let i = validMapUnitList.length - 1; i >= 0; i--) {
        for (const record of deleteUnitMap) {
          if (i === record) {
            validMapUnitList.splice(i, 1);
          }
        }
      }

      const nearbyAbsMapMemberOfNE = WorkingMap.GetNearbyAbstractMapMemberInfo(
        targetMapUnit[0],
        targetMapUnit[1] - 1,
      );

      if (validMapUnitList.length > 0) {
        for (let i = validMapUnitList.length - 1; i >= 0; i--) {
          WorkingMap.SetMapUnitTest(
            targetMapUnit[0],
            targetMapUnit[1],
            validMapUnitList[i].MapUnitName,
          );
          const validMapUnitListOfNE = WorkingMap.GetValidAbsMapUnitList(
            nearbyAbsMapMemberOfNE,
          );
          if (validMapUnitListOfNE.length < 1) {
            console.warn(
              validMapUnitList[i].MapUnitName +
                ' is removed because it will cause further struggle',
            );
            validMapUnitList.splice(i, 1);
          }
          WorkingMap.DeleteMapUnitTest(targetMapUnit[0], targetMapUnit[1]);
        }
      }

      const randomizer = new WeightedRandomizer<string>();
      if (validMapUnitList.length > 0) {
        console.log('Valid map unit list:');
        let weight = 0;
        for (const abstractMapUnit of validMapUnitList) {
          weight += abstractMapUnit.Weight;
        }
        if (weight > 0) {
          for (const abstractMapUnit of validMapUnitList) {
            randomizer.Add(abstractMapUnit.MapUnitName, abstractMapUnit.Weight);
            weight += abstractMapUnit.Weight;
            console.log(
              '  Name: ' +
                abstractMapUnit.MapUnitName +
                ', Weight: ' +
                abstractMapUnit.Weight,
            );
          }
        } else {
          for (const abstractMapUnit of validMapUnitList) {
            randomizer.Add(abstractMapUnit.MapUnitName, 1);
            weight += abstractMapUnit.Weight;
            console.log(
              '  Name: ' + abstractMapUnit.MapUnitName + ', Weight: 1',
            );
          }
          console.warn('Weights are modified because all of them are 0');
        }
        const result = randomizer.NextWithReplacement();
        WorkingMap.SetMapUnit(targetMapUnit[0], targetMapUnit[1], result);
        console.log(
          `Choose ${result} to place in [${targetMapUnit[0]},${targetMapUnit[1]}]`,
        );
        console.log('');
      } else {
        const previousLocation =
          WorkingMap.PlacedAbstractMapUnitRecord[
            WorkingMap.PlacedAbstractMapUnitRecord.length - 1
          ];
        const previousName =
          WorkingMap.AbstractMapMemberMatrix[previousLocation[0]][
            previousLocation[1]
          ].MapUnitName;
        const failure = new FailureAbstractMapUnitRecord();
        let existFailureIndex = -1;
        for (
          let i = 0;
          i < WorkingMap.FailureAbsMapUnitRecordList.length;
          i++
        ) {
          if (
            WorkingMap.FailureAbsMapUnitRecordList[i].IsTargetFailureRecord(
              previousLocation[0],
              previousLocation[1],
            )
          ) {
            existFailureIndex = i;
          }
        }
        if (existFailureIndex > -1) {
          WorkingMap.FailureAbsMapUnitRecordList[existFailureIndex].AddFailureRecord(
            previousLocation[0],
            previousLocation[1],
            previousName,
          );
        } else {
          failure.AddFailureRecord(
            previousLocation[0],
            previousLocation[1],
            previousName,
          );
          WorkingMap.FailureAbsMapUnitRecordList.push(failure);
        }
        for (const failureRec of WorkingMap.FailureAbsMapUnitRecordList) {
          if (failureRec.IsTargetFailureRecord(targetMapUnit[0], targetMapUnit[1])) {
            failureRec.Name.length = 0;
          }
        }
        WorkingMap.DeleteMapUnit(previousLocation[0], previousLocation[1]);

        failureTimes++;
        if (failureTimes >= FAILURE_TIMES) {
          console.error('No valid map unit to place!');
          return;
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // FillRemainingEmptyUnitMap
  // -----------------------------------------------------------------------

  /**
   * 填充剩余未放置的空地图成员。
   *
   * 对应 C# FillRemainingEmptyUnitMap()。
   * 在 SetMapUnitByEntropy/SetMapUnitByOrder 之后，对仍为 "empty" 的成员
   * 尝试放置有效地图单元（不进行回溯）。
   */
  public static FillRemainingEmptyUnitMap(): void {
    WorkingMap.UpdateMapUnitInfo();
    console.log('******************************************************');
    console.log('Strat filling remaining empty unit map');
    console.log('******************************************************');
    let count = 0;
    for (let i = 0; i < WorkingMap.AbstractMapMemberMatrix.length; i++) {
      for (
        let j = 0;
        j < WorkingMap.AbstractMapMemberMatrix[i].length;
        j++
      ) {
        const unitMap = WorkingMap.AbstractMapMemberMatrix[i][j];
        if (
          unitMap.MapUnitName === 'empty' &&
          unitMap.IsOnMap &&
          !unitMap.Placed
        ) {
          const nearbyAbsMapMember = WorkingMap.GetNearbyAbstractMapMemberInfo(
            i,
            j,
          );
          const validMapUnitList = WorkingMap.GetValidAbsMapUnitList(
            nearbyAbsMapMember,
          );
          const randomizer = new WeightedRandomizer<string>();
          if (validMapUnitList.length > 0) {
            console.log('Valid map unit list:');
            let weight = 0;
            for (const abstractMapUnit of validMapUnitList) {
              weight += abstractMapUnit.Weight;
            }
            if (weight > 0) {
              for (const abstractMapUnit of validMapUnitList) {
                randomizer.Add(
                  abstractMapUnit.MapUnitName,
                  abstractMapUnit.Weight,
                );
                weight += abstractMapUnit.Weight;
                console.log(
                  '  Name: ' +
                    abstractMapUnit.MapUnitName +
                    ', Weight: ' +
                    abstractMapUnit.Weight,
                );
              }
            } else {
              for (const abstractMapUnit of validMapUnitList) {
                randomizer.Add(abstractMapUnit.MapUnitName, 1);
                weight += abstractMapUnit.Weight;
                console.log(
                  '  Name: ' + abstractMapUnit.MapUnitName + ', Weight: 1',
                );
                console.log('Weights are modified because all of them are 0');
              }
            }
            const result = randomizer.NextWithReplacement();
            WorkingMap.SetMapUnit(i, j, result);
            count++;
            console.log(`Choose ${result} to place in [${i},${j}]`);
            console.log('');
          } else {
            console.error(`Failed to fill empty unit map in [${i},${j}]`);
            console.log('');
          }
        }
      }
    }
    console.log('End of filling remaining empty unit map');
    console.log(`Counts: ${count}`);
    console.log('******************************************************');
  }

  // -----------------------------------------------------------------------
  // GetValidAbsMapUnitList
  // -----------------------------------------------------------------------

  /**
   * 根据相邻成员的连接类型，筛选出所有可放置的地图单元。
   *
   * 对应 C# GetValidAbsMapUnitList(AbstractMapMember[] nearbyUnitMap)。
   * 检查四个方向（NE/NW/SW/SE）的连接类型是否匹配。
   * 同时移除与相邻成员同名的单元（当有效单元数 >1 时）。
   */
  public static GetValidAbsMapUnitList(
    nearbyUnitMap: (AbstractMapMember | null)[],
  ): AbstractMapUnit[] {
    const validMapUnitList: AbstractMapUnit[] = [];

    for (let i = 0; i < WorkingMap.AbstractMapUnitList.length; i++) {
      if (WorkingMap.AbstractMapUnitList[i].MapUnitName === 'empty') {
        continue;
      }
      let conditionsMet = 0;

      // NE 方向 [0]
      if (nearbyUnitMap[0] !== null) {
        if (
          nearbyUnitMap[0]!.MapUnitName !== 'empty' &&
          nearbyUnitMap[0]!.IsOnMap
        ) {
          if (
            WorkingMap.AbstractMapUnitList[i].NEConnectionType ===
            nearbyUnitMap[0]!.GetAbstractMapUnit().SWConnectionType
          ) {
            conditionsMet++;
          }
        } else {
          conditionsMet++;
        }
      } else {
        conditionsMet++;
      }

      // NW 方向 [1]
      if (nearbyUnitMap[1] !== null) {
        if (
          nearbyUnitMap[1]!.MapUnitName !== 'empty' &&
          nearbyUnitMap[1]!.IsOnMap
        ) {
          if (
            WorkingMap.AbstractMapUnitList[i].NWConnectionType ===
            nearbyUnitMap[1]!.GetAbstractMapUnit().SEConnectionType
          ) {
            conditionsMet++;
          }
        } else {
          conditionsMet++;
        }
      } else {
        conditionsMet++;
      }

      // SW 方向 [2]
      if (nearbyUnitMap[2] !== null) {
        if (
          nearbyUnitMap[2]!.MapUnitName !== 'empty' &&
          nearbyUnitMap[2]!.IsOnMap
        ) {
          if (
            WorkingMap.AbstractMapUnitList[i].SWConnectionType ===
            nearbyUnitMap[2]!.GetAbstractMapUnit().NEConnectionType
          ) {
            conditionsMet++;
          }
        } else {
          conditionsMet++;
        }
      } else {
        conditionsMet++;
      }

      // SE 方向 [3]
      if (nearbyUnitMap[3] !== null) {
        if (
          nearbyUnitMap[3]!.MapUnitName !== 'empty' &&
          nearbyUnitMap[3]!.IsOnMap
        ) {
          if (
            WorkingMap.AbstractMapUnitList[i].SEConnectionType ===
            nearbyUnitMap[3]!.GetAbstractMapUnit().NWConnectionType
          ) {
            conditionsMet++;
          }
        } else {
          conditionsMet++;
        }
      } else {
        conditionsMet++;
      }

      if (conditionsMet === 4) {
        validMapUnitList.push(WorkingMap.AbstractMapUnitList[i]);
      }
    }

    // 统计有权重的有效单元数
    let validCount = 0;
    for (const mapUnit of validMapUnitList) {
      if (mapUnit.Weight > 0) {
        validCount++;
      }
    }

    // 移除与相邻同名的单元
    for (let i = validMapUnitList.length - 1; i >= 0; i--) {
      if (validCount > 1) {
        const name = validMapUnitList[i].MapUnitName;
        if (
          nearbyUnitMap[0] !== null &&
          nearbyUnitMap[0]!.MapUnitName === name
        ) {
          validMapUnitList.splice(i, 1);
          validCount--;
          continue;
        }
        if (
          nearbyUnitMap[1] !== null &&
          nearbyUnitMap[1]!.MapUnitName === name
        ) {
          validMapUnitList.splice(i, 1);
          validCount--;
          continue;
        }
        if (
          nearbyUnitMap[2] !== null &&
          nearbyUnitMap[2]!.MapUnitName === name
        ) {
          validMapUnitList.splice(i, 1);
          validCount--;
          continue;
        }
        if (
          nearbyUnitMap[3] !== null &&
          nearbyUnitMap[3]!.MapUnitName === name
        ) {
          validMapUnitList.splice(i, 1);
          validCount--;
          continue;
        }
      }
    }
    return validMapUnitList;
  }

  // -----------------------------------------------------------------------
  // GetLowestEntropyMU
  // -----------------------------------------------------------------------

  /**
   * 查找熵值最低的未放置地图成员。
   *
   * 对应 C# GetLowestEntropyMU()。
   * 返回 [i, j] 坐标；无未放置成员时返回 [-1, -1]。
   */
  public static GetLowestEntropyMU(): number[] {
    WorkingMap.UpdateMapUnitInfo();
    const lowestEntropyMU = [-1, -1];
    let lowestEntropy = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < WorkingMap.AbstractMapMemberMatrix.length; i++) {
      for (
        let j = 0;
        j < WorkingMap.AbstractMapMemberMatrix[i].length;
        j++
      ) {
        const amm = WorkingMap.AbstractMapMemberMatrix[i][j];
        if (
          amm.Entropy < lowestEntropy &&
          amm.MapUnitName === 'empty' &&
          amm.IsOnMap
        ) {
          lowestEntropy = amm.Entropy;
          lowestEntropyMU[0] = i;
          lowestEntropyMU[1] = j;
        }
      }
    }
    return lowestEntropyMU;
  }

  // -----------------------------------------------------------------------
  // UpdateMapUnitInfo
  // -----------------------------------------------------------------------

  /**
   * 更新所有 AbstractMapMember 的连接状态和熵值。
   *
   * 对应 C# UpdateMapUnitInfo()。
   * 遍历矩阵，根据相邻成员是否已放置来更新四向连接标志和熵值。
   */
  public static UpdateMapUnitInfo(): void {
    for (let i = 0; i < WorkingMap.AbstractMapMemberMatrix.length; i++) {
      for (
        let j = 0;
        j < WorkingMap.AbstractMapMemberMatrix[i].length;
        j++
      ) {
        const amm = WorkingMap.AbstractMapMemberMatrix[i][j];
        amm.Entropy = 50;

        if (WorkingMap.IsValidAMMM(i, j - 1)) {
          if (WorkingMap.AbstractMapMemberMatrix[i][j - 1].MapUnitName !== 'empty') {
            amm.NEConnected = true;
            amm.Entropy -= 10;
          }
        }
        if (WorkingMap.IsValidAMMM(i, j + 1)) {
          if (WorkingMap.AbstractMapMemberMatrix[i][j + 1].MapUnitName !== 'empty') {
            amm.SWConnected = true;
            amm.Entropy -= 10;
          }
        }
        if (WorkingMap.IsValidAMMM(i - 1, j)) {
          if (WorkingMap.AbstractMapMemberMatrix[i - 1][j].MapUnitName !== 'empty') {
            amm.NWConnected = true;
            amm.Entropy -= 10;
          }
        }
        if (WorkingMap.IsValidAMMM(i + 1, j)) {
          if (WorkingMap.AbstractMapMemberMatrix[i + 1][j].MapUnitName !== 'empty') {
            amm.SEConnected = true;
            amm.Entropy -= 10;
          }
        }

        if (
          !(
            amm.SEConnected &&
            amm.NWConnected &&
            amm.SWConnected &&
            amm.NEConnected
          )
        ) {
          if (amm.SEConnected) {
            amm.Entropy -= 2;
          }
          if (amm.NWConnected) {
            amm.Entropy -= 2;
          }
          if (amm.SWConnected) {
            amm.Entropy -= 2;
          }
          if (amm.NEConnected) {
            amm.Entropy -= 2;
          }
        } else {
          amm.Entropy = 50;
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // GetCentralAbsMapMemberLocation
  // -----------------------------------------------------------------------

  /**
   * 获取 AbstractMapMemberMatrix 的中心位置。
   *
   * 对应 C# GetCentralAbsMapMemberLocation()。
   */
  public static GetCentralAbsMapMemberLocation(): number[] {
    const range = WorkingMap.Width + WorkingMap.Height;
    const location = [
      Math.round(range / 2.0 / WorkingMap.MapUnitWidth - 0.15),
      Math.round(range / 2.0 / WorkingMap.MapUnitHeight - 0.15),
    ];
    return location;
  }

  // -----------------------------------------------------------------------
  // GetCentralSideLocation
  // -----------------------------------------------------------------------

  /**
   * 获取指定方向（N/S/W/E）的中央偏侧位置。
   *
   * 对应 C# GetCentralSideLocation(string direction)。
   * 从初始位置出发，逐步调整直到找到 IsAllOnVisibleMap 的成员。
   * 未找到有效方向时返回 null。
   */
  public static GetCentralSideLocation(direction: string): number[] | null {
    const xLength = WorkingMap.AbstractMapMemberMatrix.length;
    const yLength =
      WorkingMap.AbstractMapMemberMatrix.length > 0
        ? WorkingMap.AbstractMapMemberMatrix[0].length
        : 0;

    if (direction === 'N') {
      let order = 0;
      let x = Math.round(xLength / 4.0);
      let y = Math.round(yLength / 4.0);
      while (!WorkingMap.AbstractMapMemberMatrix[x][y].IsAllOnVisibleMap) {
        if (order % 2 === 0) {
          y += 1;
        } else {
          x += 1;
        }
        order++;
      }
      return [x, y];
    }
    if (direction === 'W') {
      let order = 0;
      let x = Math.round(xLength / 4.0 - 0.5);
      let y = Math.round((yLength * 3.0) / 4.0);
      while (!WorkingMap.AbstractMapMemberMatrix[x][y].IsAllOnVisibleMap) {
        if (order % 2 === 0) {
          y -= 1;
        } else {
          x += 1;
        }
        order++;
      }
      return [x, y];
    }
    if (direction === 'S') {
      let order = 0;
      let x = Math.round((xLength * 3.0) / 4.0);
      let y = Math.round((yLength * 3.0) / 4.0);
      while (!WorkingMap.AbstractMapMemberMatrix[x][y].IsAllOnVisibleMap) {
        if (order % 2 === 0) {
          x -= 1;
        } else {
          y -= 1;
        }
        order++;
      }
      return [x, y];
    }
    if (direction === 'E') {
      let order = 0;
      let x = Math.round((xLength * 3.0) / 4.0);
      let y = Math.round(yLength / 4.0 - 0.15);
      while (!WorkingMap.AbstractMapMemberMatrix[x][y].IsAllOnVisibleMap) {
        if (order % 2 === 0) {
          x -= 1;
        } else {
          y += 1;
        }
        order++;
      }
      return [x, y];
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // GetEnoughPlaceAbsMapMemberLocation
  // -----------------------------------------------------------------------

  /**
   * 在指定方向（NW/NE/SW/SE）找到有足够空间放置 length 个成员的位置。
   *
   * 对应 C# GetEnoughPlaceAbsMapMemberLocation(string direction, int length)。
   */
  public static GetEnoughPlaceAbsMapMemberLocation(
    direction: string,
    length: number,
  ): number[] {
    const result = [1, 1];

    if (direction === 'NW') {
      for (let i = 0; i < WorkingMap.AbstractMapMemberMatrix.length; i++) {
        for (
          let j = 0;
          j < WorkingMap.AbstractMapMemberMatrix[i].length;
          j++
        ) {
          if (
            WorkingMap.IsValidAMMM(i, j) &&
            WorkingMap.IsValidAMMM(i, j + length - 1)
          ) {
            if (
              WorkingMap.AbstractMapMemberMatrix[i][j].IsAllOnVisibleMap &&
              WorkingMap.AbstractMapMemberMatrix[i][j + length - 1]
                .IsAllOnVisibleMap
            ) {
              result[0] = i;
              result[1] = j;
              return result;
            }
          }
        }
      }
    }
    if (direction === 'NE') {
      const colCount =
        WorkingMap.AbstractMapMemberMatrix.length > 0
          ? WorkingMap.AbstractMapMemberMatrix[0].length
          : 0;
      for (let i = 0; i < colCount; i++) {
        for (
          let j = WorkingMap.AbstractMapMemberMatrix.length - 1;
          j >= 0;
          j--
        ) {
          if (
            WorkingMap.IsValidAMMM(j, i) &&
            WorkingMap.IsValidAMMM(j - length + 1, i)
          ) {
            if (
              WorkingMap.AbstractMapMemberMatrix[j][i].IsAllOnVisibleMap &&
              WorkingMap.AbstractMapMemberMatrix[j - length + 1][i]
                .IsAllOnVisibleMap
            ) {
              result[0] = j;
              result[1] = i;
              return result;
            }
          }
        }
      }
    }
    if (direction === 'SW') {
      for (
        let i = (WorkingMap.AbstractMapMemberMatrix[0]?.length ?? 1) - 1;
        i >= 0;
        i--
      ) {
        for (
          let j = 0;
          j < WorkingMap.AbstractMapMemberMatrix.length;
          j++
        ) {
          if (
            WorkingMap.IsValidAMMM(j, i) &&
            WorkingMap.IsValidAMMM(j + length - 1, i)
          ) {
            if (
              WorkingMap.AbstractMapMemberMatrix[j][i].IsAllOnVisibleMap &&
              WorkingMap.AbstractMapMemberMatrix[j + length - 1][i]
                .IsAllOnVisibleMap
            ) {
              result[0] = j;
              result[1] = i;
              return result;
            }
          }
        }
      }
    }
    if (direction === 'SE') {
      for (
        let i = WorkingMap.AbstractMapMemberMatrix.length - 1;
        i >= 0;
        i--
      ) {
        for (
          let j = (WorkingMap.AbstractMapMemberMatrix[i]?.length ?? 1) - 1;
          j >= 0;
          j--
        ) {
          if (
            WorkingMap.IsValidAMMM(i, j) &&
            WorkingMap.IsValidAMMM(i, j - length + 1)
          ) {
            if (
              WorkingMap.AbstractMapMemberMatrix[i][j].IsAllOnVisibleMap &&
              WorkingMap.AbstractMapMemberMatrix[i][j - length + 1]
                .IsAllOnVisibleMap
            ) {
              result[0] = i;
              result[1] = j;
              return result;
            }
          }
        }
      }
    }
    return result;
  }

  // -----------------------------------------------------------------------
  // ReadyForMiniMap
  // -----------------------------------------------------------------------

  /**
   * 为小地图预览做准备：标记玩家位置周围格和桥梁格。
   *
   * 对应 C# ReadyForMiniMap()。
   */
  public static ReadyForMiniMap(): void {
    for (let k = 0; k < WorkingMap.WaypointList.length; k++) {
      if (k > 7) {
        break;
      }
      const waypoint = WorkingMap.WaypointList[k];
      WorkingMap.AbsTile[waypoint.X][waypoint.Y].AroundPlayerLocation = true;
      WorkingMap.AbsTile[waypoint.X + 1][
        waypoint.Y + 1
      ].AroundPlayerLocation = true;
      WorkingMap.AbsTile[waypoint.X - 1][
        waypoint.Y - 1
      ].AroundPlayerLocation = true;
      WorkingMap.AbsTile[waypoint.X + 1][
        waypoint.Y - 1
      ].AroundPlayerLocation = true;
      WorkingMap.AbsTile[waypoint.X - 1][
        waypoint.Y + 1
      ].AroundPlayerLocation = true;
      WorkingMap.AbsTile[waypoint.X + 1][
        waypoint.Y
      ].AroundPlayerLocation = true;
      WorkingMap.AbsTile[waypoint.X - 1][
        waypoint.Y
      ].AroundPlayerLocation = true;
      WorkingMap.AbsTile[waypoint.X][
        waypoint.Y - 1
      ].AroundPlayerLocation = true;
      WorkingMap.AbsTile[waypoint.X][
        waypoint.Y + 1
      ].AroundPlayerLocation = true;
    }

    for (let k = 0; k < WorkingMap.OverlayList.length; k++) {
      const overlay = WorkingMap.OverlayList[k];
      const tile = overlay.Tile;
      if (tile === null) {
        continue;
      }
      const x = tile.Rx;
      const y = tile.Ry;

      // 低矮桥梁 NW-SE
      if (
        (overlay.OverlayID >= 74 && overlay.OverlayID <= 82) ||
        (overlay.OverlayID >= 92 && overlay.OverlayID <= 94) ||
        (overlay.OverlayID >= 205 && overlay.OverlayID <= 213) ||
        (overlay.OverlayID >= 223 && overlay.OverlayID <= 226) ||
        (overlay.OverlayID >= 233 && overlay.OverlayID <= 234)
      ) {
        if (overlay.OverlayValue === 1) {
          WorkingMap.AbsTile[x][y].HasBridge = true;
          WorkingMap.AbsTile[x][y + 1].HasBridge = true;
          WorkingMap.AbsTile[x][y - 1].HasBridge = true;
        }
      } else if (
        // 低矮桥梁 SW-NE
        (overlay.OverlayID >= 83 && overlay.OverlayID <= 91) ||
        (overlay.OverlayID >= 96 && overlay.OverlayID <= 99) ||
        (overlay.OverlayID >= 214 && overlay.OverlayID <= 222) ||
        (overlay.OverlayID >= 227 && overlay.OverlayID <= 230) ||
        (overlay.OverlayID >= 235 && overlay.OverlayID <= 236)
      ) {
        if (overlay.OverlayValue === 1) {
          WorkingMap.AbsTile[x][y].HasBridge = true;
          WorkingMap.AbsTile[x + 1][y].HasBridge = true;
          WorkingMap.AbsTile[x - 1][y].HasBridge = true;
        }
      } else if (
        // 高架桥梁
        overlay.OverlayID === 24 ||
        overlay.OverlayID === 25 ||
        overlay.OverlayID === 237 ||
        overlay.OverlayID === 238
      ) {
        if (overlay.OverlayValue >= 0 && overlay.OverlayValue <= 8) {
          // NW-SE
          WorkingMap.AbsTile[x][y].HasBridge = true;
          WorkingMap.AbsTile[x][y + 1].HasBridge = true;
          WorkingMap.AbsTile[x][y - 1].HasBridge = true;
        } else if (overlay.OverlayValue >= 9 && overlay.OverlayValue <= 17) {
          // NE-SW
          WorkingMap.AbsTile[x][y].HasBridge = true;
          WorkingMap.AbsTile[x + 1][y].HasBridge = true;
          WorkingMap.AbsTile[x - 1][y].HasBridge = true;
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // SafeColorInt
  // -----------------------------------------------------------------------

  /** 对应 C# SafeColorInt(int x) – 将颜色分量限制在 [0, 255] */
  public static SafeColorInt(x: number): number {
    if (x > 255) {
      x = 255;
    }
    if (x < 0) {
      x = 0;
    }
    return x;
  }

  // -----------------------------------------------------------------------
  // CreateTileList
  // -----------------------------------------------------------------------

  /**
   * 创建等距图块列表（用于小地图渲染）。
   *
   * 对应 C# CreateTileList()。
   * C# 版从磁盘读取 minimap.ini；TS 版通过可选参数传入 minimap.ini 内容。
   * 根据 TileNum、覆盖物、桥梁、地形、建筑等设置雷达颜色。
   *
   * @param minimapIniContent minimap.ini 文件内容（可选，未提供时使用默认白色）
   */
  public static CreateTileList(minimapIniContent?: string): IsoTile[] {
    const tileList: IsoTile[] = [];
    const range = WorkingMap.Width + WorkingMap.Height;

    const minimapIni = new IniFile(minimapIniContent ?? '');
    const section = minimapIni.GetSection(
      Theater[WorkingMap.MapTheater] as string,
    );

    for (let y = 0; y < range; y++) {
      for (let x = 0; x < range; x++) {
        const absTile = WorkingMap.AbsTile[x][y];
        if (absTile.IsOnMap) {
          const tile = new IsoTile(
            absTile.X - absTile.Y + WorkingMap.Width - 1,
            absTile.X + absTile.Y - WorkingMap.Width - 1,
            absTile.X,
            absTile.Y,
            absTile.Z,
            absTile.TileNum,
            absTile.SubTile,
          );

          // 从 minimap.ini 读取基础雷达颜色
          let radarLeft: Color = { r: 255, g: 255, b: 255 };
          let radarRight: Color = { r: 255, g: 255, b: 255 };
          if (section !== null) {
            const value = section.GetStringValue(
              absTile.TileNum.toString(),
              '255,255,255,255,255,255',
            );
            const colorcombos = value.split('/');
            let index = absTile.SubTile;
            if (index > colorcombos.length) {
              index = 0;
            }
            const colorcombo = colorcombos[index];
            const rgbs = colorcombo.split(',');
            radarLeft = FromArgb(
              WorkingMap.SafeColorInt(parseInt(rgbs[0], 10)),
              WorkingMap.SafeColorInt(parseInt(rgbs[1], 10)),
              WorkingMap.SafeColorInt(parseInt(rgbs[2], 10)),
            );
            radarRight = FromArgb(
              WorkingMap.SafeColorInt(parseInt(rgbs[3], 10)),
              WorkingMap.SafeColorInt(parseInt(rgbs[4], 10)),
              WorkingMap.SafeColorInt(parseInt(rgbs[5], 10)),
            );
          }
          tile.RadarLeft = radarLeft;
          tile.RadarRight = radarRight;

          // 覆盖物颜色覆盖
          if (absTile.HasOverlay) {
            if (absTile.OverlayID >= 27 && absTile.OverlayID <= 38) {
              // gems
              tile.RadarLeft = FromArgb(132, 0, 132);
              tile.RadarRight = FromArgb(132, 0, 132);
            } else if (
              absTile.OverlayID >= 102 &&
              absTile.OverlayID <= 166
            ) {
              // ores
              tile.RadarLeft = FromArgb(220, 217, 0);
              tile.RadarRight = FromArgb(220, 217, 0);
            } else {
              tile.RadarLeft = FromArgb(91, 91, 93);
              tile.RadarRight = FromArgb(91, 91, 93);
            }
            if (
              absTile.OverlayID === 100 ||
              absTile.OverlayID === 101 ||
              absTile.OverlayID === 231
            ) {
              // broken bridge – 恢复基础颜色
              tile.RadarLeft = radarLeft;
              tile.RadarRight = radarRight;
            }
          }
          // 桥梁颜色
          if (absTile.HasBridge) {
            tile.RadarLeft = FromArgb(107, 109, 107);
            tile.RadarRight = FromArgb(107, 109, 107);
          }
          // 地形物件颜色
          if (absTile.HasTerrain) {
            if (absTile.TerrainName.includes('TREE')) {
              tile.RadarLeft = FromArgb(0, 194, 0);
              tile.RadarRight = FromArgb(0, 194, 0);
            } else if (absTile.TerrainName.includes('TIBTRE')) {
              tile.RadarLeft = FromArgb(10, 10, 10);
              tile.RadarRight = FromArgb(10, 10, 10);
            } else {
              tile.RadarLeft = FromArgb(69, 68, 69);
              tile.RadarRight = FromArgb(69, 68, 69);
            }
          }
          // 建筑/步兵/单位/飞机颜色
          if (
            absTile.HasStructure ||
            absTile.HasInfantry ||
            absTile.HasUnit ||
            absTile.HasAircraft
          ) {
            tile.RadarLeft = FromArgb(123, 125, 123);
            tile.RadarRight = FromArgb(123, 125, 123);
          }
          // 中立科技建筑颜色
          if (absTile.HasNeuralTechStructure) {
            tile.RadarLeft = FromArgb(215, 215, 215);
            tile.RadarRight = FromArgb(215, 215, 215);
          }
          // 玩家位置颜色
          if (absTile.AroundPlayerLocation) {
            tile.RadarLeft = FromArgb(220, 0, 0);
            tile.RadarRight = FromArgb(220, 0, 0);
          }

          // 高度阴影
          if (absTile.Z <= 10) {
            tile.RadarLeft = FromArgb(
              WorkingMap.SafeColorInt(tile.RadarLeft.r + absTile.Z * 2 - 1),
              WorkingMap.SafeColorInt(tile.RadarLeft.g + absTile.Z * 2 - 1),
              WorkingMap.SafeColorInt(tile.RadarLeft.b + absTile.Z * 2 - 1),
            );
            tile.RadarRight = FromArgb(
              WorkingMap.SafeColorInt(tile.RadarLeft.r + absTile.Z * 2 - 1),
              WorkingMap.SafeColorInt(tile.RadarLeft.g + absTile.Z * 2 - 1),
              WorkingMap.SafeColorInt(tile.RadarLeft.b + absTile.Z * 2 - 1),
            );
          } else {
            tile.RadarLeft = FromArgb(
              WorkingMap.SafeColorInt(
                tile.RadarLeft.r + Math.floor(absTile.Z * 2.5) - 1,
              ),
              WorkingMap.SafeColorInt(
                tile.RadarLeft.g + Math.floor(absTile.Z * 2.5) - 1,
              ),
              WorkingMap.SafeColorInt(
                tile.RadarLeft.b + Math.floor(absTile.Z * 2.5) - 1,
              ),
            );
            tile.RadarRight = FromArgb(
              WorkingMap.SafeColorInt(
                tile.RadarLeft.r + Math.floor(absTile.Z * 2.5) - 1,
              ),
              WorkingMap.SafeColorInt(
                tile.RadarLeft.g + Math.floor(absTile.Z * 2.5) - 1,
              ),
              WorkingMap.SafeColorInt(
                tile.RadarLeft.b + Math.floor(absTile.Z * 2.5) - 1,
              ),
            );
          }

          tileList.push(tile);
        }
      }
    }
    return tileList;
  }

  // -----------------------------------------------------------------------
  // Create*INI – 生成各对象节的 INI 内容
  // -----------------------------------------------------------------------

  /** 对应 C# CreateUnitINI() – 生成 [Units] 节 */
  public static CreateUnitINI(): IniSection | null {
    if (WorkingMap.UnitList.length === 0) {
      return null;
    }
    console.log('Creating Unit ini...');
    const unitIniSection = new IniSection('Units');
    let index = 0;
    for (const unit of WorkingMap.UnitList) {
      unitIniSection.AddKey(index.toString(), unit.CreateINIValue());
      index++;
    }
    return unitIniSection;
  }

  /** 对应 C# CreateInfantryINI() – 生成 [Infantry] 节 */
  public static CreateInfantryINI(): IniSection | null {
    if (WorkingMap.InfantryList.length === 0) {
      return null;
    }
    console.log('Creating Infantry ini...');
    const infantryIniSection = new IniSection('Infantry');
    let index = 0;
    for (const infantry of WorkingMap.InfantryList) {
      infantryIniSection.AddKey(index.toString(), infantry.CreateINIValue());
      index++;
    }
    return infantryIniSection;
  }

  /** 对应 C# CreateStructureINI() – 生成 [Structures] 节 */
  public static CreateStructureINI(): IniSection | null {
    if (WorkingMap.StructureList.length === 0) {
      return null;
    }
    console.log('Creating Structure ini...');
    const structureIniSection = new IniSection('Structures');
    let index = 0;
    for (const structure of WorkingMap.StructureList) {
      structureIniSection.AddKey(index.toString(), structure.CreateINIValue());
      index++;
    }
    return structureIniSection;
  }

  /** 对应 C# CreateTerrainINI() – 生成 [Terrain] 节 */
  public static CreateTerrainINI(): IniSection | null {
    if (WorkingMap.TerrainList.length === 0) {
      return null;
    }
    console.log('Creating Terrain ini...');
    const terrainIniSection = new IniSection('Terrain');
    for (const terrain of WorkingMap.TerrainList) {
      const iniLine = terrain.CreateINILine();
      // 确保红绿灯（TRFF）可以覆盖树木
      if (terrainIniSection.KeyExists(iniLine.key)) {
        if (
          terrainIniSection
            .GetStringValue(iniLine.key, 'TREE')
            .includes('TREE') ||
          terrain.Name.includes('TRFF')
        ) {
          terrainIniSection.RemoveKey(iniLine.key);
          terrainIniSection.AddKey(iniLine.key, iniLine.value);
        }
      } else {
        terrainIniSection.AddKey(iniLine.key, iniLine.value);
      }
    }
    return terrainIniSection;
  }

  /** 对应 C# CreateAircraftINI() – 生成 [Aircraft] 节 */
  public static CreateAircraftINI(): IniSection | null {
    if (WorkingMap.AircraftList.length === 0) {
      return null;
    }
    console.log('Creating Aircraft ini...');
    const aircraftIniSection = new IniSection('Aircraft');
    let index = 0;
    for (const aircraft of WorkingMap.AircraftList) {
      aircraftIniSection.AddKey(index.toString(), aircraft.CreateINIValue());
      index++;
    }
    return aircraftIniSection;
  }

  /** 对应 C# CreateSmudgeINI() – 生成 [Smudge] 节 */
  public static CreateSmudgeINI(): IniSection | null {
    if (WorkingMap.SmudgeList.length === 0) {
      return null;
    }
    console.log('Creating Smudge ini...');
    const smudgeIniSection = new IniSection('Smudge');
    let index = 0;
    for (const smudge of WorkingMap.SmudgeList) {
      smudgeIniSection.AddKey(index.toString(), smudge.CreateINIValue());
      index++;
    }
    return smudgeIniSection;
  }

  /** 对应 C# CreateWaypointINI() – 生成 [Waypoints] 节 */
  public static CreateWaypointINI(): IniSection | null {
    if (WorkingMap.WaypointList.length === 0) {
      return null;
    }
    console.log('Creating Waypoints ini...');
    const waypointIniSection = new IniSection('Waypoints');
    let index = 0;
    for (const waypoint of WorkingMap.WaypointList) {
      const iniLine = waypoint.CreateINILine();
      waypointIniSection.AddKey(index.toString(), iniLine.value);
      index++;
    }
    return waypointIniSection;
  }

  // -----------------------------------------------------------------------
  // PlacePlayerLocation
  // -----------------------------------------------------------------------

  /**
   * 在指定方向放置玩家出生点（spawn 类型的地图单元）。
   *
   * 对应 C# PlacePlayerLocation(int number, string direction)。
   * 根据 direction 选择位置策略，放置 number 个出生点，
   * 然后调用 PlaceTiberiumMUNearPlayer() 在出生点附近放置矿石。
   */
  public static PlacePlayerLocation(number: number, direction: string): void {
    if (number === 0) {
      return;
    }
    const startingUnits: string[] = [];
    for (const absMU of WorkingMap.AbstractMapUnitList) {
      if (absMU.MapUnitName.includes('spawn')) {
        startingUnits.push(absMU.MapUnitName);
      }
    }
    if (startingUnits.length === 0) {
      return;
    }

    let playerLocation: number[] = [0, 0];
    if (direction === 'NW') {
      playerLocation = WorkingMap.GetEnoughPlaceAbsMapMemberLocation(
        'NW',
        number,
      );
    }
    if (direction === 'SW') {
      playerLocation = WorkingMap.GetEnoughPlaceAbsMapMemberLocation(
        'SW',
        number,
      );
    }
    if (direction === 'SE') {
      playerLocation = WorkingMap.GetEnoughPlaceAbsMapMemberLocation(
        'SE',
        number,
      );
    }
    if (direction === 'NE') {
      playerLocation = WorkingMap.GetEnoughPlaceAbsMapMemberLocation(
        'NE',
        number,
      );
    }
    if (direction === 'N') {
      const loc = WorkingMap.GetCentralSideLocation('N');
      if (loc) {
        playerLocation = loc;
      }
    }
    if (direction === 'S') {
      const loc = WorkingMap.GetCentralSideLocation('S');
      if (loc) {
        playerLocation = loc;
      }
    }
    if (direction === 'W') {
      const loc = WorkingMap.GetCentralSideLocation('W');
      if (loc) {
        playerLocation = loc;
      }
    }
    if (direction === 'E') {
      const loc = WorkingMap.GetCentralSideLocation('E');
      if (loc) {
        playerLocation = loc;
      }
    }

    if (direction === 'NW') {
      for (let i = 0; i < number; i++) {
        WorkingMap.RandomSetMapUnitNoOverlap(
          playerLocation[0],
          playerLocation[1] + i,
          startingUnits,
        );
        console.log(
          `Player is set in abstract map member [${playerLocation[0]},${playerLocation[1] + i}]`,
        );
      }
    } else if (direction === 'SW') {
      for (let i = 0; i < number; i++) {
        WorkingMap.RandomSetMapUnitNoOverlap(
          playerLocation[0] + i,
          playerLocation[1],
          startingUnits,
        );
        console.log(
          `Player is set in abstract map member [${playerLocation[0] + i},${playerLocation[1]}]`,
        );
      }
    } else if (direction === 'SE') {
      for (let i = 0; i < number; i++) {
        WorkingMap.RandomSetMapUnitNoOverlap(
          playerLocation[0],
          playerLocation[1] - i,
          startingUnits,
        );
        console.log(
          `Player is set in abstract map member [${playerLocation[0]},${playerLocation[1] - i}]`,
        );
      }
    } else if (direction === 'NE') {
      for (let i = 0; i < number; i++) {
        WorkingMap.RandomSetMapUnitNoOverlap(
          playerLocation[0] - i,
          playerLocation[1],
          startingUnits,
        );
        console.log(
          `Player is set in abstract map member [${playerLocation[0] - i},${playerLocation[1]}]`,
        );
      }
    }

    if (direction === 'N') {
      WorkingMap.RandomSetMapUnitNoOverlap(
        playerLocation[0],
        playerLocation[1],
        startingUnits,
      );
      console.log(
        `Player is set in abstract map member [${playerLocation[0]},${playerLocation[1]}]`,
      );
      if (number === 1) {
        WorkingMap.PlaceTiberiumMUNearPlayer();
        return;
      }
      WorkingMap.RandomSetMapUnitNoOverlap(
        playerLocation[0] + 1,
        playerLocation[1] - 1,
        startingUnits,
      );
      console.log(
        `Player is set in abstract map member [${playerLocation[0] + 1},${playerLocation[1] - 1}]`,
      );
      if (number === 2) {
        WorkingMap.PlaceTiberiumMUNearPlayer();
        return;
      }
      WorkingMap.RandomSetMapUnitNoOverlap(
        playerLocation[0] - 1,
        playerLocation[1] + 1,
        startingUnits,
      );
      console.log(
        `Player is set in abstract map member [${playerLocation[0] - 1},${playerLocation[1] + 1}]`,
      );
      if (number === 3) {
        WorkingMap.PlaceTiberiumMUNearPlayer();
        return;
      }
      WorkingMap.RandomSetMapUnitNoOverlap(
        playerLocation[0] + 2,
        playerLocation[1] - 2,
        startingUnits,
      );
      console.log(
        `Player is set in abstract map member [${playerLocation[0] + 2},${playerLocation[1] - 2}]`,
      );
    } else if (direction === 'W') {
      WorkingMap.RandomSetMapUnitNoOverlap(
        playerLocation[0],
        playerLocation[1],
        startingUnits,
      );
      console.log(
        `Player is set in abstract map member [${playerLocation[0]},${playerLocation[1]}]`,
      );
      if (number === 1) {
        WorkingMap.PlaceTiberiumMUNearPlayer();
        return;
      }
      WorkingMap.RandomSetMapUnitNoOverlap(
        playerLocation[0] - 1,
        playerLocation[1] - 1,
        startingUnits,
      );
      console.log(
        `Player is set in abstract map member [${playerLocation[0] - 1},${playerLocation[1] - 1}]`,
      );
      if (number === 2) {
        WorkingMap.PlaceTiberiumMUNearPlayer();
        return;
      }
      WorkingMap.RandomSetMapUnitNoOverlap(
        playerLocation[0] + 1,
        playerLocation[1] + 1,
        startingUnits,
      );
      console.log(
        `Player is set in abstract map member [${playerLocation[0] + 1},${playerLocation[1] + 1}]`,
      );
      if (number === 3) {
        WorkingMap.PlaceTiberiumMUNearPlayer();
        return;
      }
      WorkingMap.RandomSetMapUnitNoOverlap(
        playerLocation[0] - 2,
        playerLocation[1] - 2,
        startingUnits,
      );
      console.log(
        `Player is set in abstract map member [${playerLocation[0] - 2},${playerLocation[1] - 2}]`,
      );
    } else if (direction === 'S') {
      WorkingMap.RandomSetMapUnitNoOverlap(
        playerLocation[0],
        playerLocation[1],
        startingUnits,
      );
      console.log(
        `Player is set in abstract map member [${playerLocation[0]},${playerLocation[1]}]`,
      );
      if (number === 1) {
        WorkingMap.PlaceTiberiumMUNearPlayer();
        return;
      }
      WorkingMap.RandomSetMapUnitNoOverlap(
        playerLocation[0] - 1,
        playerLocation[1] + 1,
        startingUnits,
      );
      console.log(
        `Player is set in abstract map member [${playerLocation[0] - 1},${playerLocation[1] + 1}]`,
      );
      if (number === 2) {
        WorkingMap.PlaceTiberiumMUNearPlayer();
        return;
      }
      WorkingMap.RandomSetMapUnitNoOverlap(
        playerLocation[0] + 1,
        playerLocation[1] - 1,
        startingUnits,
      );
      console.log(
        `Player is set in abstract map member [${playerLocation[0] + 1},${playerLocation[1] - 1}]`,
      );
      if (number === 3) {
        WorkingMap.PlaceTiberiumMUNearPlayer();
        return;
      }
      WorkingMap.RandomSetMapUnitNoOverlap(
        playerLocation[0] - 2,
        playerLocation[1] + 2,
        startingUnits,
      );
      console.log(
        `Player is set in abstract map member [${playerLocation[0] - 2},${playerLocation[1] + 2}]`,
      );
    } else if (direction === 'E') {
      WorkingMap.RandomSetMapUnitNoOverlap(
        playerLocation[0],
        playerLocation[1],
        startingUnits,
      );
      console.log(
        `Player is set in abstract map member [${playerLocation[0]},${playerLocation[1]}]`,
      );
      if (number === 1) {
        WorkingMap.PlaceTiberiumMUNearPlayer();
        return;
      }
      WorkingMap.RandomSetMapUnitNoOverlap(
        playerLocation[0] + 1,
        playerLocation[1] + 1,
        startingUnits,
      );
      console.log(
        `Player is set in abstract map member [${playerLocation[0] + 1},${playerLocation[1] + 1}]`,
      );
      if (number === 2) {
        WorkingMap.PlaceTiberiumMUNearPlayer();
        return;
      }
      WorkingMap.RandomSetMapUnitNoOverlap(
        playerLocation[0] - 1,
        playerLocation[1] - 1,
        startingUnits,
      );
      console.log(
        `Player is set in abstract map member [${playerLocation[0] - 1},${playerLocation[1] - 1}]`,
      );
      if (number === 3) {
        WorkingMap.PlaceTiberiumMUNearPlayer();
        return;
      }
      WorkingMap.RandomSetMapUnitNoOverlap(
        playerLocation[0] + 2,
        playerLocation[1] + 2,
        startingUnits,
      );
      console.log(
        `Player is set in abstract map member [${playerLocation[0] + 2},${playerLocation[1] + 2}]`,
      );
    }
    WorkingMap.PlaceTiberiumMUNearPlayer();
  }

  // -----------------------------------------------------------------------
  // PlaceTiberiumMUNearPlayer
  // -----------------------------------------------------------------------

  /**
   * 在玩家出生点附近放置矿石（tiberium）类型的地图单元。
   *
   * 对应 C# PlaceTiberiumMUNearPlayer()。
   * 查找所有包含 "tiberium1" / "tiberium2" 的地图单元，
   * 在每个 spawn 成员附近随机放置矿石单元。
   */
  public static PlaceTiberiumMUNearPlayer(): void {
    const tiberium1: string[] = [];
    for (const absMU of WorkingMap.AbstractMapUnitList) {
      if (absMU.MapUnitName.includes('tiberium1')) {
        tiberium1.push(absMU.MapUnitName);
      }
    }
    const tiberium2: string[] = [];
    for (const absMU of WorkingMap.AbstractMapUnitList) {
      if (absMU.MapUnitName.includes('tiberium2')) {
        tiberium2.push(absMU.MapUnitName);
      }
    }
    if (tiberium1.length + tiberium2.length === 0) {
      return;
    }

    let count = 0;
    const randomizer = new WeightedRandomizer<string>();
    for (let i = 0; i < WorkingMap.AbstractMapMemberMatrix.length; i++) {
      for (
        let j = 0;
        j < WorkingMap.AbstractMapMemberMatrix[i].length;
        j++
      ) {
        const amm = WorkingMap.AbstractMapMemberMatrix[i][j];
        if (
          amm.MapUnitName.includes('spawn') &&
          !amm.PlayerLocationHasTiberium
        ) {
          count++;
          randomizer.Add(i.toString() + ',' + j.toString(), 1);
        }
      }
    }

    // 第一轮：使用 NextWithRemoval（不放回）
    while (count > 0) {
      if (randomizer.Count === 0) {
        break;
      }
      const result = randomizer.NextWithRemoval().split(',');
      const placeTiberium2Chance = WorkingMap.Randomizer.Next(100);
      let success = false;
      if (count >= 2) {
        if (placeTiberium2Chance > 63 && tiberium2.length > 0) {
          success = WorkingMap.RandomPlaceMUNearbyAndAllOnMap(
            parseInt(result[0], 10),
            parseInt(result[1], 10),
            tiberium2,
          );
          if (success) {
            count -= 2;
          }
          continue;
        }
      }
      if (tiberium1.length > 0) {
        success = WorkingMap.RandomPlaceMUNearbyAndAllOnMap(
          parseInt(result[0], 10),
          parseInt(result[1], 10),
          tiberium1,
        );
      }
      if (success) {
        count -= 1;
      }
    }

    // 第二轮：仍有剩余时，使用 NextWithReplacement（放回），最多尝试30次
    if (count > 0) {
      for (let i = 0; i < WorkingMap.AbstractMapMemberMatrix.length; i++) {
        for (
          let j = 0;
          j < WorkingMap.AbstractMapMemberMatrix[i].length;
          j++
        ) {
          const amm = WorkingMap.AbstractMapMemberMatrix[i][j];
          if (
            amm.MapUnitName.includes('spawn') &&
            !amm.PlayerLocationHasTiberium
          ) {
            randomizer.Add(i.toString() + ',' + j.toString(), 1);
          }
        }
      }
      let failure = 0;
      while (count > 0) {
        if (randomizer.Count === 0) {
          break;
        }
        const result = randomizer.NextWithReplacement().split(',');
        const placeTiberium2Chance = WorkingMap.Randomizer.Next(100);
        let success = false;
        if (count >= 2) {
          if (placeTiberium2Chance > 63 && tiberium2.length > 0) {
            success = WorkingMap.RandomPlaceMUNearbyAndAllOnMap(
              parseInt(result[0], 10),
              parseInt(result[1], 10),
              tiberium2,
            );
            if (success) {
              count -= 2;
            }
            continue;
          }
        }
        if (tiberium1.length > 0) {
          success = WorkingMap.RandomPlaceMUNearbyAndAllOnMap(
            parseInt(result[0], 10),
            parseInt(result[1], 10),
            tiberium1,
          );
        }
        if (success) {
          count -= 1;
        }
        failure++;
        if (failure > 30) {
          console.warn('No place to set tiberium map unit!');
          break;
        }
      }
    }

    // 标记所有 spawn 成员已处理
    for (let i = 0; i < WorkingMap.AbstractMapMemberMatrix.length; i++) {
      for (
        let j = 0;
        j < WorkingMap.AbstractMapMemberMatrix[i].length;
        j++
      ) {
        const amm = WorkingMap.AbstractMapMemberMatrix[i][j];
        if (
          amm.MapUnitName.includes('spawn') &&
          !amm.PlayerLocationHasTiberium
        ) {
          amm.PlayerLocationHasTiberium = true;
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // RandomPlaceMUNearbyAndAllOnMap
  // -----------------------------------------------------------------------

  /**
   * 在 (x, y) 的相邻位置中随机选择一个放置地图单元。
   *
   * 对应 C# RandomPlaceMUNearbyAndAllOnMap(int x, int y, List<string> mapUnitName)。
   * 注意：C# 原版不检查边界（调用方需保证安全），此处保持一致。
   *
   * @returns 是否成功找到一个可放置的相邻位置
   */
  public static RandomPlaceMUNearbyAndAllOnMap(
    x: number,
    y: number,
    mapUnitName: string[],
  ): boolean {
    const randomizer = new WeightedRandomizer<number>();
    if (
      !WorkingMap.AbstractMapMemberMatrix[x][y - 1].Placed &&
      WorkingMap.AbstractMapMemberMatrix[x][y - 1].IsAllOnVisibleMap
    ) {
      randomizer.Add(1, 1);
    }
    if (
      !WorkingMap.AbstractMapMemberMatrix[x - 1][y].Placed &&
      WorkingMap.AbstractMapMemberMatrix[x - 1][y].IsAllOnVisibleMap
    ) {
      randomizer.Add(2, 1);
    }
    if (
      !WorkingMap.AbstractMapMemberMatrix[x][y + 1].Placed &&
      WorkingMap.AbstractMapMemberMatrix[x][y + 1].IsAllOnVisibleMap
    ) {
      randomizer.Add(3, 1);
    }
    if (
      !WorkingMap.AbstractMapMemberMatrix[x + 1][y].Placed &&
      WorkingMap.AbstractMapMemberMatrix[x + 1][y].IsAllOnVisibleMap
    ) {
      randomizer.Add(4, 1);
    }
    if (randomizer.Count === 0) {
      return false;
    }
    const result = randomizer.NextWithReplacement();
    if (result === 1) {
      WorkingMap.RandomSetMapUnitNoOverlap(x, y - 1, mapUnitName);
    }
    if (result === 2) {
      WorkingMap.RandomSetMapUnitNoOverlap(x - 1, y, mapUnitName);
    }
    if (result === 3) {
      WorkingMap.RandomSetMapUnitNoOverlap(x, y + 1, mapUnitName);
    }
    if (result === 4) {
      WorkingMap.RandomSetMapUnitNoOverlap(x + 1, y, mapUnitName);
    }
    return true;
  }

  // -----------------------------------------------------------------------
  // RandomPlaceMUInCenter
  // -----------------------------------------------------------------------

  /**
   * 有概率在地图中心放置 "center" 类型的地图单元。
   *
   * 对应 C# RandomPlaceMUInCenter(int chance)。
   *
   * @param chance 触发概率（0-99，越大越可能放置）
   */
  public static RandomPlaceMUInCenter(chance: number): void {
    if (chance < WorkingMap.Randomizer.Next(100)) {
      return;
    }
    const center: string[] = [];
    for (const absMU of WorkingMap.AbstractMapUnitList) {
      if (absMU.MapUnitName.includes('center')) {
        center.push(absMU.MapUnitName);
      }
    }
    const centerL = WorkingMap.GetCentralAbsMapMemberLocation();
    if (center.length > 0) {
      WorkingMap.RandomSetMapUnit(centerL[0], centerL[1], center);
    }
  }

  // -----------------------------------------------------------------------
  // IncreaseWeightContainsX
  // -----------------------------------------------------------------------

  /**
   * 增加具有指定连接类型的地图单元的权重。
   *
   * 对应 C# IncreaseWeightContainsX(int type, int times = 1)。
   * 对四向连接类型中任一匹配 type-1 的单元，权重 +1，重复 times 次。
   */
  public static IncreaseWeightContainsX(type: number, times: number = 1): void {
    type -= 1;
    for (let j = 0; j < times; j++) {
      for (let i = 0; i < WorkingMap.AbstractMapUnitList.length; i++) {
        const absMU = WorkingMap.AbstractMapUnitList[i];
        if (absMU.Weight !== 0) {
          if (absMU.NEConnectionType === type) {
            WorkingMap.AbstractMapUnitList[i].Weight += 1;
          }
          if (absMU.NWConnectionType === type) {
            WorkingMap.AbstractMapUnitList[i].Weight += 1;
          }
          if (absMU.SEConnectionType === type) {
            WorkingMap.AbstractMapUnitList[i].Weight += 1;
          }
          if (absMU.SWConnectionType === type) {
            WorkingMap.AbstractMapUnitList[i].Weight += 1;
          }
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // IsNeuralTechBuilding
  // -----------------------------------------------------------------------

  /** 对应 C# IsNeuralTechBuilding(string name) – 判断是否为中立科技建筑 */
  public static IsNeuralTechBuilding(name: string): boolean {
    const TechBuildingList = [
      'CATHOSP',
      'CAOILD',
      'CAOUTP',
      'CAMACH',
      'CAPOWR',
      'CASLAB',
      'CAHOSP',
      'CAAIRP',
    ];
    if (TechBuildingList.includes(name)) {
      return true;
    }
    return false;
  }

  // -----------------------------------------------------------------------
  // ChangeStructureHealth
  // -----------------------------------------------------------------------

  /**
   * 随机修改建筑生命值。
   *
   * 对应 C# ChangeStructureHealth(int min, int max, int destroyPercentage = 0)。
   * 对每个非 CABHUT 建筑设置 [min, max) 范围内的生命值，
   * 并有 destroyPercentage% 的概率直接摧毁（非科技建筑）。
   */
  public static ChangeStructureHealth(
    min: number,
    max: number,
    destroyPercentage: number = 0,
  ): void {
    if (min < 0) {
      min = 0;
    }
    if (max > 256) {
      max = 256;
    }

    const TechBuildingList = [
      'CATHOSP',
      'CAOILD',
      'CAOUTP',
      'CAMACH',
      'CAPOWR',
      'CASLAB',
      'CAHOSP',
      'CAAIRP',
    ];

    for (const structure of WorkingMap.StructureList) {
      if (structure.Name !== 'CABHUT') {
        structure.Strength = WorkingMap.Randomizer.Next(min, max);
        const destroyed = WorkingMap.Randomizer.Next(100);
        if (
          destroyed < destroyPercentage &&
          !TechBuildingList.includes(structure.Name)
        ) {
          structure.Strength = 0;
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // ChangeUnitAirInfHealth
  // -----------------------------------------------------------------------

  /**
   * 随机修改单位、飞机、步兵的生命值。
   *
   * 对应 C# ChangeUnitAirInfHealth(int min, int max)。
   */
  public static ChangeUnitAirInfHealth(
    min: number,
    max: number,
  ): void {
    if (min < 0) {
      min = 0;
    }
    if (max > 256) {
      max = 256;
    }

    for (const unit of WorkingMap.UnitList) {
      unit.Strength = WorkingMap.Randomizer.Next(min, max);
    }
    for (const aircraft of WorkingMap.AircraftList) {
      aircraft.Strength = WorkingMap.Randomizer.Next(min, max);
    }
    for (const infantry of WorkingMap.InfantryList) {
      infantry.Strength = WorkingMap.Randomizer.Next(min, max);
    }
  }

  // -----------------------------------------------------------------------
  // GetStructureSize
  // -----------------------------------------------------------------------

  /**
   * 获取建筑的底座尺寸。
   *
   * 对应 C# GetStructureSize(string name)。
   * 从 rulesmd.ini 查找 Image 名称，再从 artmd.ini 查找 Foundation。
   * 返回 [width, height]。
   */
  public static GetStructureSize(name: string): number[] {
    let artName = name;
    if (WorkingMap.Rules.SectionExists(name)) {
      if (WorkingMap.Rules.KeyExists(name, 'Image')) {
        artName = WorkingMap.Rules.GetStringValue(name, 'Image', name);
      }
    } else {
      return [1, 1];
    }

    if (!WorkingMap.Art.KeyExists(artName, 'Foundation')) {
      return [1, 1];
    }
    const foundation = WorkingMap.Art.GetStringValue(artName, 'Foundation', '1x1');
    const width = parseInt(foundation.split(/[xX]/)[0], 10);
    const height = parseInt(foundation.split(/[xX]/)[1], 10);
    return [width, height];
  }

  // -----------------------------------------------------------------------
  // GetSmudgeSize
  // -----------------------------------------------------------------------

  /**
   * 获取污迹的尺寸。
   *
   * 对应 C# GetSmudgeSize(string name)。
   * 从 rulesmd.ini 查找 Width 和 Height。返回 [width, height]。
   */
  public static GetSmudgeSize(name: string): number[] {
    let width = 1;
    let height = 1;

    if (WorkingMap.Rules.SectionExists(name)) {
      if (WorkingMap.Rules.KeyExists(name, 'Width')) {
        width = WorkingMap.Rules.GetIntValue(name, 'Width', 1);
      }
      if (WorkingMap.Rules.KeyExists(name, 'Height')) {
        height = WorkingMap.Rules.GetIntValue(name, 'Height', 1);
      }
    }
    return [width, height];
  }

  // -----------------------------------------------------------------------
  // CanPlace* – 放置可行性检查
  // -----------------------------------------------------------------------

  /**
   * 检查能否在 (x, y) 放置指定建筑。
   *
   * 对应 C# CanPlaceStructure(int x, int y, string name)。
   * 检查建筑底座覆盖的所有格位是否空闲。
   */
  public static CanPlaceStructure(
    x: number,
    y: number,
    name: string,
  ): boolean {
    const size = WorkingMap.GetStructureSize(name);
    for (let i = 0; i < size[0]; i++) {
      for (let j = 0; j < size[1]; j++) {
        if (!WorkingMap.IsValidAT(x + i, y + j)) {
          return false;
        }
        const absTile = WorkingMap.AbsTile[x + i][y + j];
        if (
          absTile.HasStructure ||
          absTile.HasAircraft ||
          absTile.HasUnit ||
          absTile.HasInfantry ||
          absTile.HasTerrain ||
          absTile.HasOverlay ||
          absTile.HasSmudge
        ) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * 检查能否在 (x, y) 放置单位。
   *
   * 对应 C# CanPlaceUnit(int x, y)。
   * 注意：不检查 HasStructure（单位可以放在维修厂等建筑上）。
   */
  public static CanPlaceUnit(x: number, y: number): boolean {
    const absTile = WorkingMap.AbsTile[x][y];
    if (
      absTile.HasAircraft ||
      absTile.HasUnit ||
      absTile.HasInfantry ||
      absTile.HasTerrain
    ) {
      return false;
    }
    return true;
  }

  /** 对应 C# CanPlaceAircraft(int x, int y) – 飞机使用与单位相同的规则 */
  public static CanPlaceAircraft(x: number, y: number): boolean {
    return WorkingMap.CanPlaceUnit(x, y);
  }

  /** 对应 C# CanPlaceTerrain(int x, int y) */
  public static CanPlaceTerrain(x: number, y: number): boolean {
    const absTile = WorkingMap.AbsTile[x][y];
    if (
      absTile.HasStructure ||
      absTile.HasAircraft ||
      absTile.HasUnit ||
      absTile.HasInfantry ||
      absTile.HasTerrain
    ) {
      return false;
    }
    return true;
  }

  /** 对应 C# CanPlaceTRFF(int x, int y) – 红绿灯放置检查（允许地形物件） */
  public static CanPlaceTRFF(x: number, y: number): boolean {
    const absTile = WorkingMap.AbsTile[x][y];
    if (
      absTile.HasStructure ||
      absTile.HasAircraft ||
      absTile.HasUnit ||
      absTile.HasInfantry
    ) {
      return false;
    }
    return true;
  }

  /**
   * 检查能否在 (x, y) 放置指定污迹。
   *
   * 对应 C# CanPlaceSmudge(int x, int y, string name)。
   * 检查污迹覆盖的所有格位，并排除 CannotPlaceSmudgeList 中的图块类型。
   */
  public static CanPlaceSmudge(
    x: number,
    y: number,
    name: string,
  ): boolean {
    const size = WorkingMap.GetSmudgeSize(name);
    for (let i = 0; i < size[0]; i++) {
      for (let j = 0; j < size[1]; j++) {
        if (!WorkingMap.IsValidAT(x + i, y + j)) {
          return false;
        }
        const absTile = WorkingMap.AbsTile[x + i][y + j];
        if (
          absTile.HasStructure ||
          absTile.HasTerrain ||
          absTile.HasOverlay ||
          absTile.HasSmudge
        ) {
          return false;
        }
        for (const absTileType of WorkingMap.CannotPlaceSmudgeList) {
          if (absTileType.TileNum === absTile.TileNum) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /** 对应 C# CanPlaceInfantry(int x, int y) – 步兵可叠加（最多3个） */
  public static CanPlaceInfantry(x: number, y: number): boolean {
    const absTile = WorkingMap.AbsTile[x][y];
    if (
      absTile.HasStructure ||
      absTile.HasAircraft ||
      absTile.HasUnit ||
      absTile.InfantryCount >= 3 ||
      absTile.HasTerrain
    ) {
      return false;
    }
    return true;
  }

  /** 对应 C# CanPlaceOverlay(int x, int y) */
  public static CanPlaceOverlay(x: number, y: number): boolean {
    const absTile = WorkingMap.AbsTile[x][y];
    if (
      absTile.HasStructure ||
      absTile.HasTerrain ||
      absTile.HasSmudge ||
      absTile.HasOverlay
    ) {
      return false;
    }
    return true;
  }

  // -----------------------------------------------------------------------
  // RandomPlaceSmudge
  // -----------------------------------------------------------------------

  /**
   * 在地图上随机放置污迹（弹坑、烧痕）。
   *
   * 对应 C# RandomPlaceSmudge(double density)。
   * 密度范围 [0, 0.5]，通过随机尝试放置污迹直到达到目标密度。
   *
   * @param density 目标密度（SmudgeList.Count / ((Width*2-1) * Height)）
   */
  public static RandomPlaceSmudge(density: number): void {
    if (density > 0.5) {
      console.warn('The density is considered too high.');
      return;
    }
    if (density < 0) {
      console.warn('The density should between 0 and 0.5!');
      return;
    }

    let currentDensity = 0;
    const range = WorkingMap.Width + WorkingMap.Height;
    const smudgeList = [
      'BURNT01',
      'BURNT02',
      'BURNT03',
      'BURNT04',
      'BURNT05',
      'BURNT06',
      'BURNT07',
      'BURNT08',
      'BURNT09',
      'BURNT10',
      'BURNT11',
      'BURNT12',
      'CRATER01',
      'CRATER02',
      'CRATER03',
      'CRATER04',
      'CRATER05',
      'CRATER06',
      'CRATER07',
      'CRATER08',
      'CRATER09',
      'CRATER10',
      'CRATER11',
      'CRATER12',
    ];
    let loopTimes = 0;

    while (density > currentDensity) {
      const x = WorkingMap.Randomizer.Next(0, range);
      const y = WorkingMap.Randomizer.Next(0, range);

      loopTimes++;
      if (loopTimes > (WorkingMap.Width * 2 - 1) * WorkingMap.Height * 10) {
        console.warn(
          'Random place smudge is forcefully stopped because of too many retries.',
        );
        console.warn('Please make sure the density is not too high');
        break;
      }

      if (!WorkingMap.AbsTile[x][y].IsOnMap) {
        continue;
      }

      const choice = WorkingMap.Randomizer.Next(smudgeList.length);
      if (!WorkingMap.CanPlaceSmudge(x, y, smudgeList[choice])) {
        continue;
      }

      const newSmudge = new Smudge();
      newSmudge.X = x;
      newSmudge.Y = y;
      newSmudge.Name = smudgeList[choice];

      WorkingMap.SmudgeList.push(newSmudge);
      console.log(
        `Random place smudge [${newSmudge.Name}] in [${newSmudge.X},${newSmudge.Y}]`,
      );
      const size = WorkingMap.GetSmudgeSize(newSmudge.Name);
      for (let l = 0; l < size[0]; l++) {
        for (let m = 0; m < size[1]; m++) {
          WorkingMap.AbsTile[newSmudge.X + l][
            newSmudge.Y + m
          ].HasSmudge = true;
        }
      }

      currentDensity =
        WorkingMap.SmudgeList.length /
        ((WorkingMap.Width * 2 - 1) * WorkingMap.Height);
    }
  }
}
