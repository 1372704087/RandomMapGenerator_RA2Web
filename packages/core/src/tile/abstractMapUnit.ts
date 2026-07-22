import { AbstractTileType } from './abstractTileType';
import type { Overlay } from './overlay';
import { WorkingMap } from '../workingMap';
import { MapFile } from '../fileio';
import type { FileInfoLike } from '../fileio';
import { IniFile } from '../io/iniFile';
import { Unit } from '../objects/unit';
import { Infantry } from '../objects/infantry';
import { Structure } from '../objects/structure';
import { Terrain } from '../objects/terrain';
import { Aircraft } from '../objects/aircraft';
import { Smudge } from '../objects/smudge';
import { Waypoint } from '../objects/waypoint';

/**
 * 抽象地图单元（地图模板）
 *
 * 对应 C# RandomMapGenerator.TileInfo.AbstractMapUnit（Tile/AbstractMapUnit.cs）。
 * 一个抽象地图单元是一块固定宽高的“模板”，包含图块类型网格、四向连接类型、
 * 权重，以及模板内附带的各类非图块对象（单位、步兵、建筑、地形物件等）。
 *
 * 移植要点：
 *   - C# AbstractTileType[,] 二维数组用 (AbstractTileType | null)[][] 表示。
 *   - Width / Height 取自 WorkingMap 静态占位变量（与 C# 字段初始化器一致）；
 *     WorkingMap 仅以 type-only 方式反向引用本类，运行期无循环依赖。
 *   - Initialize 依赖 MapFile（占位）与项目已有 IniFile（src/io）读取 .map 文件。
 *     INI 段迭代适配现有 IniSection API：Keys 返回 string[]，值通过
 *     GetStringValue(key, '') 获取。
 *   - C# List<T> 用 T[] 表示，Initialize 中重建为空数组。
 */
export class AbstractMapUnit {
  /** 对应 C# string MapUnitName（单元名称） */
  public MapUnitName: string = '';
  /** 对应 C# int Width = WorkingMap.MapUnitWidth（单元宽度） */
  public Width: number = WorkingMap.MapUnitWidth;
  /** 对应 C# int Height = WorkingMap.MapUnitHeight（单元高度） */
  public Height: number = WorkingMap.MapUnitHeight;
  /** 对应 C# AbstractTileType[,] AbsTileType（图块类型网格） */
  public AbsTileType: (AbstractTileType | null)[][] = [];
  /** 对应 C# int NWConnectionType = -1（西北连接类型） */
  public NWConnectionType: number = -1;
  /** 对应 C# int NEConnectionType = -1（东北连接类型） */
  public NEConnectionType: number = -1;
  /** 对应 C# int SWConnectionType = -1（西南连接类型） */
  public SWConnectionType: number = -1;
  /** 对应 C# int SEConnectionType = -1（东南连接类型） */
  public SEConnectionType: number = -1;
  /** 对应 C# int Weight = 0（权重） */
  public Weight: number = 0;

  /** 对应 C# int UseTimes { get; set; }（使用次数） */
  public UseTimes: number = 0;

  /** 对应 C# List&lt;Unit&gt; UnitList { get; private set; } */
  public UnitList: Unit[] = [];
  /** 对应 C# List&lt;Infantry&gt; InfantryList { get; private set; } */
  public InfantryList: Infantry[] = [];
  /** 对应 C# List&lt;Structure&gt; StructureList { get; private set; } */
  public StructureList: Structure[] = [];
  /** 对应 C# List&lt;Terrain&gt; TerrainList { get; private set; } */
  public TerrainList: Terrain[] = [];
  /** 对应 C# List&lt;Aircraft&gt; AircraftList { get; private set; } */
  public AircraftList: Aircraft[] = [];
  /** 对应 C# List&lt;Smudge&gt; SmudgeList { get; private set; } */
  public SmudgeList: Smudge[] = [];
  /** 对应 C# List&lt;Overlay&gt; OverlayList { get; private set; } */
  public OverlayList: Overlay[] = [];
  /** 对应 C# List&lt;Waypoint&gt; WaypointList { get; private set; } */
  public WaypointList: Waypoint[] = [];

  /**
 * 从 .map 文件初始化抽象地图单元
 *
 * 对应 C# AbstractMapUnit.Initialize(FileInfo file)。
 *
 * 流程：
 *   1. 重建各对象列表、重置 UseTimes；
 *   2. 通过 MapFile 读取等距图块与覆盖物，填充 AbsTileType 网格与 OverlayList；
 *   3. 检测四向连接类型（依据指示图块 IndicatorNum）；
 *   4. 统计权重；
 *   5. 通过 IniFile 读取各对象节并填充对应列表。
 *
 * 移植说明：C# 版直接以 FileInfo 全路径读写磁盘文件；TS 版 core 包不依赖
 * Node.js fs，因此调用方需在读取 .map 文件后将其文本内容通过 fileContent
 * 传入。file 仅用于推导 MapUnitName（去扩展名）。
 *
 * @param file 文件信息，对应 C# FileInfo（使用 fullName / name）
 * @param fileContent .map 文件的 INI 文本内容
 */
  public Initialize(file: FileInfoLike, fileContent: string): void {
    this.UnitList = [];
    this.InfantryList = [];
    this.StructureList = [];
    this.TerrainList = [];
    this.AircraftList = [];
    this.SmudgeList = [];
    this.OverlayList = [];
    this.WaypointList = [];
    this.UseTimes = 0;

    // 重建图块类型网格 [Width][Height]，对应 C# new AbstractTileType[w, h]
    this.AbsTileType = [];
    for (let i = 0; i < this.Width; i++) {
      this.AbsTileType[i] = new Array<AbstractTileType | null>(this.Height).fill(null);
    }

    const map = new MapFile();
    map.CreateIsoTileList(fileContent);
    const overlayList: Overlay[] = map.ReadOverlay(fileContent) ?? [];

    // 文件名去掉最后一个扩展名作为单元名，对应 C# file.Name 去尾段扩展的逻辑
    const computedName = file.name.split('.').slice(0, -1).join('.');

    // 填充图块类型网格与覆盖物
    for (let i = 0; i < this.Width; i++) {
      for (let j = 0; j < this.Height; j++) {
        const absTileType = new AbstractTileType();
        for (const tile of map.IsoTileList) {
          if (tile.Rx === i + WorkingMap.StartingX && tile.Ry === j + WorkingMap.StartingY) {
            this.MapUnitName = computedName;
            absTileType.TileNum = tile.TileNum;
            absTileType.SubTile = tile.SubTile;
            absTileType.Z = tile.Z;
            this.AbsTileType[i][j] = absTileType;
          }
        }
        for (const overlay of overlayList) {
          if (
            overlay.Tile !== null &&
            overlay.Tile.Rx === i + WorkingMap.StartingX &&
            overlay.Tile.Ry === j + WorkingMap.StartingY
          ) {
            overlay.Tile.Rx = i;
            overlay.Tile.Ry = j;
            this.OverlayList.push(overlay);
          }
        }
      }
    }

    // 检测四向连接类型（依据指示图块 IndicatorNum）
    for (let i = 0; i < this.Width; i++) {
      for (const tile of map.IsoTileList) {
        if (
          tile.Rx === WorkingMap.StartingX - 3 &&
          tile.Ry === i + WorkingMap.StartingY &&
          tile.TileNum === WorkingMap.IndicatorNum
        ) {
          this.NWConnectionType = i;
        }
        if (
          tile.Rx === WorkingMap.StartingX + this.Width + 2 &&
          tile.Ry === i + WorkingMap.StartingY &&
          tile.TileNum === WorkingMap.IndicatorNum
        ) {
          this.SEConnectionType = i;
        }
        if (
          tile.Ry === WorkingMap.StartingX - 3 &&
          tile.Rx === i + WorkingMap.StartingY &&
          tile.TileNum === WorkingMap.IndicatorNum
        ) {
          this.NEConnectionType = i;
        }
        if (
          tile.Ry === WorkingMap.StartingX + this.Width + 2 &&
          tile.Rx === i + WorkingMap.StartingY &&
          tile.TileNum === WorkingMap.IndicatorNum
        ) {
          this.SWConnectionType = i;
        }
      }
    }

    // 统计权重
    for (const tile of map.IsoTileList) {
      if (tile.Rx < WorkingMap.StartingX - 5 && tile.TileNum === WorkingMap.IndicatorNum) {
        this.Weight++;
      }
    }

    // 读取 INI 各对象节
    const mapFile = new IniFile(fileContent);

    if (mapFile.SectionExists('Units')) {
      const unitSection = mapFile.GetSection('Units');
      if (unitSection !== null) {
        for (const key of unitSection.Keys) {
          const unit = new Unit();
          unit.Initialize(unitSection.GetStringValue(key, ''));
          if (
            unit.RelativeX < WorkingMap.MapUnitWidth &&
            unit.RelativeX >= 0 &&
            unit.RelativeY < WorkingMap.MapUnitHeight &&
            unit.RelativeY >= 0
          ) {
            this.UnitList.push(unit);
          }
        }
      }
    }

    if (mapFile.SectionExists('Infantry')) {
      const infantrySection = mapFile.GetSection('Infantry');
      if (infantrySection !== null) {
        for (const key of infantrySection.Keys) {
          const infantry = new Infantry();
          infantry.Initialize(infantrySection.GetStringValue(key, ''));
          if (
            infantry.RelativeX < WorkingMap.MapUnitWidth &&
            infantry.RelativeX >= 0 &&
            infantry.RelativeY < WorkingMap.MapUnitHeight &&
            infantry.RelativeY >= 0
          ) {
            this.InfantryList.push(infantry);
          }
        }
      }
    }

    if (mapFile.SectionExists('Structures')) {
      const structureSection = mapFile.GetSection('Structures');
      if (structureSection !== null) {
        for (const key of structureSection.Keys) {
          const structure = new Structure();
          structure.Initialize(structureSection.GetStringValue(key, ''));
          if (
            structure.RelativeX < WorkingMap.MapUnitWidth &&
            structure.RelativeX >= 0 &&
            structure.RelativeY < WorkingMap.MapUnitHeight &&
            structure.RelativeY >= 0
          ) {
            this.StructureList.push(structure);
          }
        }
      }
    }

    if (mapFile.SectionExists('Terrain')) {
      const terrainSection = mapFile.GetSection('Terrain');
      if (terrainSection !== null) {
        for (const key of terrainSection.Keys) {
          const terrain = new Terrain();
          terrain.Initialize({ key, value: terrainSection.GetStringValue(key, '') });
          // out of bounder is disabled here for placing lamps
          this.TerrainList.push(terrain);
        }
      }
    }

    if (mapFile.SectionExists('Aircraft')) {
      const aircraftSection = mapFile.GetSection('Aircraft');
      if (aircraftSection !== null) {
        for (const key of aircraftSection.Keys) {
          const aircraft = new Aircraft();
          aircraft.Initialize(aircraftSection.GetStringValue(key, ''));
          if (
            aircraft.RelativeX < WorkingMap.MapUnitWidth &&
            aircraft.RelativeX >= 0 &&
            aircraft.RelativeY < WorkingMap.MapUnitHeight &&
            aircraft.RelativeY >= 0
          ) {
            this.AircraftList.push(aircraft);
          }
        }
      }
    }

    if (mapFile.SectionExists('Smudge')) {
      const smudgeSection = mapFile.GetSection('Smudge');
      if (smudgeSection !== null) {
        for (const key of smudgeSection.Keys) {
          const smudge = new Smudge();
          smudge.Initialize(smudgeSection.GetStringValue(key, ''));
          if (
            smudge.RelativeX < WorkingMap.MapUnitWidth &&
            smudge.RelativeX >= 0 &&
            smudge.RelativeY < WorkingMap.MapUnitHeight &&
            smudge.RelativeY >= 0
          ) {
            this.SmudgeList.push(smudge);
          }
        }
      }
    }

    if (mapFile.SectionExists('Waypoints')) {
      const waypointSection = mapFile.GetSection('Waypoints');
      if (waypointSection !== null) {
        for (const key of waypointSection.Keys) {
          const waypoint = new Waypoint();
          waypoint.Initialize({ key, value: waypointSection.GetStringValue(key, '') });
          if (
            waypoint.RelativeX < WorkingMap.MapUnitWidth &&
            waypoint.RelativeX >= 0 &&
            waypoint.RelativeY < WorkingMap.MapUnitHeight &&
            waypoint.RelativeY >= 0
          ) {
            this.WaypointList.push(waypoint);
          }
        }
      }
    }
  }
}
