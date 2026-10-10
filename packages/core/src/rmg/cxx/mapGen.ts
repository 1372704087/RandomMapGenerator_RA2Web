/**
 * Transliteration of G:/MapGenerator MapGen.cpp (+ the MapGen.h state model).
 *
 * Class Rmg holds every piece of generator state (the C++ class's members).
 * The other cxx/ modules add free functions taking `r: Rmg` (the C++ `this`),
 * so there are no runtime import cycles: only this module's imports of the
 * loader / stage functions are runtime dependencies.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { K_UNIT_SCALE, F2I64, yrSqrt } from './mathTables';
import { R250Random } from './r250';
import {
    CellIterator,
    DIR_X,
    DIR_Y,
    LandType,
    MapCell,
    MapGenConfig,
    MapRect,
    MapSizeResult,
    MultiplayerHouse,
    NeutralTechBuilding,
    OverlayTypeInfo,
    GroundTypeInfo,
    TiberiumInfo,
    CellLevelPassability,
    ElevationEntry,
    MapRegion,
    MapStructureRec,
    MapTerrainObjectRec,
    StartingPointRecord,
    TileCellAttr,
    WorkArray,
    packXY,
    unpX,
    unpY,
    unpYS,
    i16,
} from './types';
import { diag } from './diag';
import {
    profileInt,
    readIntList,
    readNameList,
} from './winapi';
import {
    generateRiver,
    generateLake,
    smoothWaterBody,
    loadTheaterTiles,
    isWaterFamilyTile,
} from './river';
import { loadTileCellAttrs, loadOverlayTypes, loadGroundTypes, loadTiberiums } from './recalc';
import { loadNeutralTechBuildings, loadMultiplayerHouses } from './startpoint';

/** kUnitScale re-export for call sites that spell it out. */
const kUnitScale = K_UNIT_SCALE;

// Size interpolation tables (players 2-8 -> index 0-6). Source 0x7ED634 etc.
const K_WMIN = [70, 70, 70, 80, 90, 100, 100];
const K_WMAX = [80, 80, 80, 90, 100, 110, 120];
const K_HMIN = [70, 70, 70, 80, 90, 100, 100];
const K_HMAX = [80, 80, 80, 90, 100, 110, 120];

const K_SIZE_CLAMP = 1.2;
const K_ONE_THIRD = 1.0 / 3.0;

// [Map] LocalSize offsets (VisibleRect.X / .Y).
export const K_VISIBLE_OFFSET_X = 2;
export const K_VISIBLE_OFFSET_Y = 5;

/** PassabilityType enum (YRpp order). */
export const Passability = {
    Passable: 0,
    Crushable: 1,
    Destroyable: 2,
    Beach: 3,
    Water: 4,
    HasFreeSpots: 5,
    Impassable: 6,
    OutsideMap: 7,
} as const;

/** RMGSettings - RMGMD.INI [General] (sub_5981F0). */
export class RMGSettings {
    MinTiberium = 2500;
    MaxTiberium = 5500;
    MaxTrees = 600;

    LevelLightSettings: number[] = [];
    TemperateAmbientLight: number[] = [];
    SnowAmbientLight: number[] = [];
    TemperateAmbientRed: number[] = [];
    TemperateAmbientGreen: number[] = [];
    TemperateAmbientBlue: number[] = [];
    SnowAmbientRed: number[] = [];
    SnowAmbientGreen: number[] = [];
    SnowAmbientBlue: number[] = [];
    VegetationMinimums: number[] = [];
    VegetationMaximums: number[] = [];

    TemperateOrePatchLamps: string[] = [];
    SnowOrePatchLamps: string[] = [];

    setDefaults(): void {
        // vanilla YR RMGMD.INI contents / the RMG instance ctor values
        this.MinTiberium = 2500;
        this.MaxTiberium = 5500;
        this.MaxTrees = 600;
        this.LevelLightSettings = [3, 3, 3, 3];
        this.TemperateAmbientLight = [75, 100, 75, 35];
        this.SnowAmbientLight = [75, 100, 75, 55];
        this.TemperateAmbientRed = [109, 108, 71, 51];
        this.TemperateAmbientGreen = [80, 94, 81, 46];
        this.TemperateAmbientBlue = [49, 68, 119, 141];
        this.SnowAmbientRed = [112, 99, 106, 76];
        this.SnowAmbientGreen = [80, 104, 107, 74];
        this.SnowAmbientBlue = [133, 107, 154, 118];
        this.VegetationMinimums = [60, 60, 60, 60, 60];
        this.VegetationMaximums = [100, 100, 100, 100, 100];
        this.TemperateOrePatchLamps = ['TEMMORLAMP', 'TEMDAYLAMP', 'TEMDUSLAMP', 'TEMNITLAMP'];
        this.SnowOrePatchLamps = ['SNOMORLAMP', 'SNODAYLAMP', 'SNODUSLAMP', 'SNONITLAMP'];
    }

    private static listAt(v: number[], i: number): number {
        if (v.length === 0) return 0;
        if (i < 0) i = 0;
        if (i >= v.length) i = v.length - 1;
        return v[i]!;
    }
    levelLight(timeOfDay: number): number { return RMGSettings.listAt(this.LevelLightSettings, timeOfDay); }
    ambientLight(theater: number, timeOfDay: number): number {
        return RMGSettings.listAt(theater ? this.SnowAmbientLight : this.TemperateAmbientLight, timeOfDay);
    }
    vegetationMin(landType: number): number { return RMGSettings.listAt(this.VegetationMinimums, landType); }
    vegetationMax(landType: number): number { return RMGSettings.listAt(this.VegetationMaximums, landType); }
}

// ---------------------------------------------------------------------------
// GrowPatch priority-queue node + 1-based min-heap (MapGen.cpp anonymous ns).
// ---------------------------------------------------------------------------
interface PatchNode {
    coords: number; // packed
    priority: number; // float
}

class PatchHeap {
    slots: (PatchNode | null)[] = []; // slots[0] unused
    count = 0;

    /** sub_5AD870 sift-down. */
    siftDown(a2: number): void {
        let v2 = a2;
        let v3 = 2 * a2;
        const v4 = 2 * a2 + 1;
        if (!(2 * a2 <= this.count) || this.slots[a2]!.priority <= this.slots[2 * a2]!.priority) v3 = a2;
        if (v4 <= this.count && this.slots[v3]!.priority > this.slots[v4]!.priority) v3 = 2 * a2 + 1;
        if (v3 === a2) return;
        do {
            const v6 = 2 * v3 + 1;
            const v7 = this.slots[v2]!;
            this.slots[v2] = this.slots[v3];
            v2 = v3;
            this.slots[v3] = v7;
            if (2 * v3 <= this.count && this.slots[v3]!.priority > this.slots[2 * v3]!.priority) v3 *= 2;
            if (v6 <= this.count && this.slots[v3]!.priority > this.slots[v6]!.priority) v3 = v6;
        } while (v3 !== v2);
    }

    push(node: PatchNode, capacity: number): void {
        let v = this.count + 1;
        if (v >= capacity) return;
        let parent = v >> 1;
        while (v > 1 && this.slots[parent]!.priority > node.priority) {
            this.slots[v] = this.slots[parent];
            v = parent;
            parent >>= 1;
        }
        this.slots[v] = node;
        ++this.count;
    }

    pop(): PatchNode | null {
        if (this.count === 0) return null;
        const root = this.slots[1]!;
        this.slots[1] = this.slots[this.count];
        this.slots[this.count] = null;
        --this.count;
        this.siftDown(1);
        return root;
    }
}

// ---------------------------------------------------------------------------
// Rmg - the RandomMapGenerator state + MapGen.cpp behaviour.
// ---------------------------------------------------------------------------
export class Rmg {
    config: MapGenConfig = {
        landType: LandType.Continent,
        theater: 0,
        timeOfDay: 0,
        sizeSlider: 0,
        playerCount: 2,
        oreDensity: 0,
        multiplayer: false,
        waterAmount: 0,
        randomSeed: 0,
        mapRngSeed: 0,
        global: {
            flag010: 0, n3: 0, value020: 0, value018: 0, value03C: 0,
            waterAmount: 0, ruggedness: 0, urbanPresence: 0, accessibility: 0,
            regionSize: 0, tiberiumLayout: 0, vegetation: 0, seed04C: 0,
        },
    };
    size: MapSizeResult = { width: 0, height: 0, mapWidth: 0, mapHeight: 0, workSide: 0 };
    settings = new RMGSettings();
    iniLoaded = false;
    rng = new R250Random();
    globalRng = new R250Random();
    globalOptions: import('./types').GlobalMapOptions = {
        flag010: 0, n3: 0, value020: 0, value018: 0, value03C: 0,
        waterAmount: 0, ruggedness: 0, urbanPresence: 0, accessibility: 0,
        regionSize: 0, tiberiumLayout: 0, vegetation: 0, seed04C: 0,
    };
    /** 出生点圈地放宽开关（[port-only]，MapGen.h startpointRelaxedMove_）。 */
    startpointRelaxedMove = false;

    // cell slots (512-stride) + pool
    cellSlots: (MapCell | null)[] = [];
    slotRows = 0;
    cellCount = 0;

    work: WorkArray = new WorkArray(0);

    // hill stage scratch elevation grid
    elevGrid: ElevationEntry[] = [];
    elevLeft = 0;
    elevTop = 0;
    elevStride = 0;

    tileMorphable: Uint8Array = new Uint8Array(0);

    // progress ladder
    progressPercent = 0;

    // region system
    regions: MapRegion[] = [];
    regionIdCounter = 0;

    invalidCell = new MapCell();

    random25Flag = false;
    baseLevel = 4;
    usedWaterCells = 0; // RMG this[193]
    genCode = 0; // RMG this[194]
    waterAmount = 0; // RMG this[19]

    // theater tile-family indices (LoadTheaterTiles fills; -1 when absent)
    waterTileIndex = -1;
    shoreTileIndex = -1;
    greenTileIndex = -1;
    clearToGreenLatIndex = -1;
    waterCliffsIndex = -1;
    destroyableCliffsIndex = -1;
    cliffRampsIndex = -1;
    waterCavesIndex = -1;
    bridgeSetIndex = -1;
    woodBridgeSetIndex = -1;
    rampBaseIndex = -1;
    slopeSetPiecesIndex = -1;
    pavedRoadsIndex = -1;
    pavedRoadEndsIndex = -1;
    miscPaveTileIndex = -1;
    paveTileIndex = -1;
    waterFamily4Base = [-1, -1, -1, -1]; // East, West, South, North
    shorePieces = -1;
    shoreAnchor: number[] = new Array(42).fill(0); // packed (0,0) until filled
    rampSmoothIndex = -1;
    mmRampBaseIndex = -1;
    clearTileIndex = -1;
    roughTileIndex = -1;
    sandTileIndex = -1;
    clearToRoughLatIndex = -1;
    clearToSandLatIndex = -1;
    clearToPaveLatIndex = -1;
    heightBaseIndex = -1;
    blackTileIndex = -1;
    slopeSetPieces2Index = -1;
    monorailSlopesIndex = -1;
    tunnelsIndex = -1;
    trackTunnelsIndex = -1;
    dirtTunnelsIndex = -1;
    dirtTrackTunnelsIndex = -1;
    mediansIndex = -1;
    roughGroundIndex = -1;
    dirtRoadJunctionIndex = -1;
    dirtRoadCurveIndex = -1;
    dirtRoadStraightIndex = -1;
    pavedRoadSlopesIndex = -1;
    dirtRoadSlopesIndex = -1;
    rocksIndex = -1;
    waterBridgeIndex = -1;

    currentBuildingType = 0;

    // recalc tables
    overlayTypes: OverlayTypeInfo[] = [];
    levelAndPassability: CellLevelPassability[] = [];
    levelAndPassability2: number[] = [];
    tileCellAttrs: TileCellAttr[][] = [];
    groundTypes: GroundTypeInfo[] = [];
    cliffBackImpassability = -1;
    tiberiums: TiberiumInfo[] = [];

    // ledgers
    structures: MapStructureRec[] = [];
    terrainObjects: MapTerrainObjectRec[] = [];
    waypoints: number[] = new Array(702).fill(0);
    startingPoints: StartingPointRecord[] = [];
    startingPointCount = 0;
    neutralTechBuildings: NeutralTechBuilding[] = [];
    multiplayerHouses: MultiplayerHouse[] = [];

    // movement zones (sub_56C510)
    movementZones: number[][] = Array.from({ length: 13 }, () => []);
    zonePassability: Uint8Array[] = Array.from({ length: 13 }, () => new Uint8Array(0));
    zoneConnections: number[][] = Array.from({ length: 256 }, () => []);
    lastRecordedZone = 0;
    passabilityCopy: Uint8Array = new Uint8Array(0);
    zonePassabilityValue: number[] = [];

    // cliff stamp ledger
    cliffStamps: import('./types').CliffStampOutcome[] = [];

    // foundation preview (DisplayClass stand-in)
    fpCenter = 0; // packed
    fpTopLeft = 0; // packed
    fpData: number[] | null = null;

    /** Where the INIs / tile art live (the exe's folder in the reference). */
    resourceDir: string;

    constructor(resourceDir = 'G:/MapGenerator/x64/Release') {
        this.resourceDir = resourceDir;
        this.settings.setDefaults();
    }

    // ---- path resolution (mirrors the C++ candidate lists) ---------------
    private exeDir(): string {
        return this.resourceDir.replace(/\/?$/, '/');
    }

    rulesIniPath(): string | null {
        const d = this.exeDir();
        const candidates = [
            join(d, 'rulesmd.ini'),
            join(d, '../rulesmd.ini'),
            join(d, '../../相关INI/rulesmd.ini'),
            join(d, '相关INI/rulesmd.ini'),
        ];
        for (const c of candidates) if (existsSync(c)) return c;
        return null;
    }

    theaterIniPath(theater: number): string | null {
        const d = this.exeDir();
        const name = theater === 1 ? 'snowmd.ini' : 'temperatmd.ini';
        const candidates = [
            join(d, name),
            join(d, `../${name}`),
            join(d, `../../相关INI/${name}`),
        ];
        for (const c of candidates) if (existsSync(c)) return c;
        return null;
    }

    artDir(theater: number): string {
        const d = this.exeDir();
        return join(d, `../../Tile资源/${theater === 1 ? '雪地' : '温和'}/`);
    }

    rmgmdIniPath(): string | null {
        const p = join(this.exeDir(), 'RMGMD.INI');
        return existsSync(p) ? p : null;
    }

    // ---- CellExists / accessors ------------------------------------------
    cellExists(x: number, y: number): boolean {
        const s = x + y;
        if (s <= this.size.mapWidth || s > this.size.mapWidth + 2 * this.size.mapHeight) return false;
        let d = x - y;
        if (d < 0) d = -d;
        return d < this.size.mapWidth;
    }

    /** sub_5657AF GetCellAt_MapCrd - invalid-cell fallback, never null. */
    cellAt(x: number, y: number): MapCell {
        const index = x + (y << 9);
        if (index >= 0 && index < this.slotRows * 512) {
            const c = this.cellSlots[index];
            if (c) return c;
        }
        this.invalidCell.mapCoords =
            ((i16(x) & 0xffff) | ((i16(y) & 0xffff) << 16)) | 0;
        return this.invalidCell;
    }

    /** Cells.Items[index] - null when out of range / empty slot. */
    rawSlot(index: number): MapCell | null {
        if (index < 0 || index >= this.slotRows * 512) return null;
        return this.cellSlots[index] ?? null;
    }

    /** CellClass::GetNeighbourCell 0x481810 (16-bit coordinate adds). */
    getNeighbourCell(cell: MapCell, facing: number): MapCell {
        const x = i16((cell.mapCoords & 0xffff) + DIR_X[facing & 7]);
        const y = i16(i16(cell.mapCoords >>> 16) + DIR_Y[facing & 7]);
        return this.cellAt(x, y);
    }

    workIndex(x: number, y: number): number {
        return x + this.size.workSide * y;
    }

    // ---- CalcMapSize (0x599665 - 0x599748) --------------------------------
    calcMapSize(cfg: MapGenConfig): MapSizeResult {
        const result: MapSizeResult = { width: 0, height: 0, mapWidth: 0, mapHeight: 0, workSide: 0 };

        let playerIdx = cfg.playerCount - 2;
        if (playerIdx < 0) playerIdx = 0;
        if (playerIdx > 6) playerIdx = 6;

        let wFrac = Math.fround(cfg.sizeSlider * K_ONE_THIRD);
        let hFrac = Math.fround(cfg.sizeSlider * K_ONE_THIRD);

        const lt = cfg.landType;
        if (lt !== LandType.Inland && lt !== LandType.Mountainous) {
            if (wFrac > K_SIZE_CLAMP) wFrac = K_SIZE_CLAMP;
            if (hFrac > K_SIZE_CLAMP) hFrac = K_SIZE_CLAMP;
        }

        const w = Math.fround(K_WMIN[playerIdx]! * (1.0 - wFrac) + K_WMAX[playerIdx]! * wFrac);
        const h = Math.fround(K_HMIN[playerIdx]! * (1.0 - hFrac) + K_HMAX[playerIdx]! * hFrac);

        result.width = F2I64(w);
        result.height = F2I64(h);
        result.mapWidth = result.width + 4;
        result.mapHeight = result.height + 12;
        result.workSide = result.mapWidth + result.mapHeight + 1;
        return result;
    }

    // ---- InitCells / InitWorkArray / FillWorkCoords -----------------------
    initCells(): void {
        this.cellSlots = [];
        this.slotRows = 0;
        this.cellCount = 0;

        this.slotRows = this.size.mapWidth + this.size.mapHeight + 1;
        this.cellSlots = new Array(this.slotRows * 512).fill(null);

        const maxX = this.size.mapWidth + this.size.mapHeight - 1;

        for (let y = 0; y < this.slotRows; ++y)
            for (let x = 0; x <= maxX; ++x)
                if (this.cellExists(x, y)) ++this.cellCount;

        const pool = new Array<MapCell>(this.cellCount);
        for (let i = 0; i < this.cellCount; ++i) pool[i] = new MapCell();

        let idx = 0;
        for (let y = 0; y < this.slotRows; ++y) {
            for (let x = 0; x <= maxX; ++x) {
                if (!this.cellExists(x, y)) continue;
                const cell = pool[idx]!;
                cell.mapCoords = (x & 0xffff) | ((y & 0xffff) << 16);
                cell.level = this.baseLevel;
                cell.isoTileTypeIndex = 0;
                cell.slopeIndex = 0;
                cell.height = 0;
                cell.overlayTypeIndex = -1;
                cell.overlayData = 0;
                cell.altFlags = 0;
                this.cellSlots[512 * y + x] = cell;
                ++idx;
            }
        }
    }

    initWorkArray(): void {
        const workCount = this.size.workSide * this.size.workSide;
        this.work = new WorkArray(workCount);

        // passability byte starts at OutsideMap (7) - see InitWorkArray note.
        this.levelAndPassability = new Array(workCount);
        for (let i = 0; i < workCount; ++i)
            this.levelAndPassability[i] = { cellPassability: Passability.OutsideMap, cellLevel: 0, zoneArrayIndex: 0 };
        this.lastRecordedZone = 0;
        for (let i = 0; i < 256; ++i) this.zoneConnections[i] = [];
        this.passabilityCopy = new Uint8Array(workCount);
        this.levelAndPassability2 = new Array(workCount).fill(0);

        this.waypoints = new Array(702).fill(0);
        this.startingPoints = [];
        this.startingPointCount = 0;
    }

    fillWorkCoords(): void {
        if (this.work.count === 0 || this.cellSlots.length === 0) return;
        const it = new CellIterator();
        it.reset(this.cellSlots, this.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {
            const x = cell.mapCoords & 0xffff;
            const y = cell.mapCoords >>> 16;
            this.work.setI(this.workIndex(x, y), 0, cell.mapCoords);
        }
    }

    // ---- GenerateMapBody (sub_599650 RNG-relevant core) -------------------
    generateMapBody(cfg: MapGenConfig): boolean {
        diag('==== MAP BODY START ====');
        this.config = cfg;
        this.waterAmount = cfg.waterAmount;

        // The map RNG keeps the vanilla constant-0 seed (0x58b770).
        this.rng.seed(cfg.mapRngSeed);

        this.reInitMapData();

        this.size = this.calcMapSize(cfg);
        if (this.size.width <= 0 || this.size.height <= 0) return false;

        this.baseLevel = 4;
        this.usedWaterCells = 0;
        loadTheaterTiles(this, cfg.theater);
        loadTileCellAttrs(this, cfg.theater);
        loadOverlayTypes(this);
        loadGroundTypes(this);
        loadTiberiums(this);
        loadNeutralTechBuildings(this);
        loadMultiplayerHouses(this);

        this.initCells();
        this.initWorkArray();
        this.fillWorkCoords();

        this.random25Flag = this.rng.chance25();
        return true;
    }

    // ---- GenerateTerrain (sub_59A6C0 segments 1-6) ------------------------
    generateTerrain(): void {
        // Segment 1: flood every diamond cell with the water base tile.
        {
            const it = new CellIterator();
            it.reset(this.cellSlots, this.size.mapWidth);
            for (let cell = it.next(); cell !== null; cell = it.next())
                cell.isoTileTypeIndex = this.waterTileIndex;
        }

        // Segment 2: land-type dispatch.
        switch (this.config.landType) {
            case LandType.Archipelago: this.generateArchipelago(); break;
            case LandType.Continent: this.generateContinent(); break;
            case LandType.TeamContinent: this.generateTeamContinent(); break;
            default: break;
        }

        // Segment 3: one-cell water holes become land.
        {
            const it = new CellIterator();
            it.reset(this.cellSlots, this.size.mapWidth);
            for (let cell = it.next(); cell !== null; cell = it.next()) {
                if (cell.isoTileTypeIndex !== this.waterTileIndex) continue;
                let allPlaceholder = true;
                for (let facing = 0; facing < 8; facing += 2) {
                    if (!this.isPlaceholderTile(this.getNeighbourCell(cell, facing))) {
                        allPlaceholder = false;
                        break;
                    }
                }
                if (allPlaceholder) cell.isoTileTypeIndex = 0;
            }
        }

        // Segment 4: whole-map shore pass.
        smoothWaterBody(this, 0, 0);

        // Segment 5: reset both work marks over the whole work grid.
        if (this.work.count > 0) {
            const workCellCount = this.size.workSide * this.size.workSide;
            for (let idx = 0; idx < workCellCount; ++idx) {
                this.work.setI(idx, 14, -1);
                this.work.setI(idx, 15, -1);
            }
        }

        // Segment 6: shore tiles stamp their bare neighbours green.
        {
            const it = new CellIterator();
            it.reset(this.cellSlots, this.size.mapWidth);
            for (let cell = it.next(); cell !== null; cell = it.next()) {
                const tile = cell.isoTileTypeIndex;
                if (tile < this.shorePieces || tile >= this.shorePieces + 42) continue;
                for (let facing = 0; facing < 8; facing += 2) {
                    const neighbour = this.getNeighbourCell(cell, facing);
                    if (this.isPlaceholderTile(neighbour)) neighbour.isoTileTypeIndex = this.greenTileIndex;
                }
            }
        }
    }

    // ---- ClearWorkOccupancy (common generator prologue) -------------------
    clearWorkOccupancy(): void {
        const it = new CellIterator();
        it.reset(this.cellSlots, this.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {
            const x = cell.mapCoords & 0xffff;
            const y = cell.mapCoords >>> 16;
            this.work.setI(this.workIndex(x, y), 15, 0);
        }
    }

    // ---- GenerateArchipelago (sub_59AD10) ---------------------------------
    generateArchipelago(): void {
        this.genCode = 1;

        let span = Math.trunc(this.config.playerCount / 2);
        if (span < 2) span = 2;
        const extra = this.rng.randomFloatRange(1, span);

        const visible: MapRect = {
            X: K_VISIBLE_OFFSET_X,
            Y: K_VISIBLE_OFFSET_Y,
            Width: this.size.width,
            Height: this.size.height,
        };

        const blocks: MapRect[] = [];
        this.splitVisibleRectIntoBlocks(blocks, extra + this.config.playerCount, visible);

        this.clearWorkOccupancy();

        for (let b = 0; b < blocks.length; ++b) {
            const rect = blocks[b]!;
            const area = F2I64((this.rng.unit() * 0.05 + 0.45) * (2.0 * rect.Width * rect.Height));

            const centreX = rect.X + Math.trunc(rect.Width / 2) + Math.trunc(rect.Height / 2) + rect.Y + 1;
            const centreY = rect.Y + this.size.mapWidth + Math.trunc(rect.Height / 2) - Math.trunc(rect.Width / 2) - rect.X;
            const centrePacked = packXY(centreX, centreY);

            let grown = 0;
            for (let attempt = 0; attempt < 10; ++attempt) {
                grown = this.growPatch(area, rect, centrePacked, 1, centrePacked, 0.25, 0);
                if (grown) break;
                ++this.genCode;
            }
        }
    }

    // ---- SplitVisibleRectIntoBlocks (sub_59A8F0) --------------------------
    splitVisibleRectIntoBlocks(blocks: MapRect[], count: number, rect: MapRect): void {
        if (count <= 0) return;

        const root = Math.trunc(Math.sqrt(count));
        const a = root * root === count ? root : root + 1;
        const b = root * a < count ? a : root;

        const wide = this.rng.unit() >= 0.5;

        let blockW: number, blockH: number;
        let innerStepX: number, innerStepY: number;
        let groupStepX: number, groupStepY: number;
        if (wide) {
            blockW = Math.trunc(rect.Width / a);
            blockH = Math.trunc(rect.Height / b);
            innerStepX = blockW; innerStepY = 0;
            groupStepX = 0; groupStepY = blockH;
        } else {
            blockW = Math.trunc(rect.Width / b);
            blockH = Math.trunc(rect.Height / a);
            innerStepX = 0; innerStepY = blockH;
            groupStepX = blockW; groupStepY = 0;
        }

        const perGroup: number[] = new Array(b).fill(a);
        const pool: number[] = [];
        for (let i = 0; i < b; ++i) pool.push(i);

        const shortGroups = a * b - count;
        for (let s = 0; s < shortGroups; ++s) {
            const pick = this.rng.randomFloatRange(0, pool.length - 1);
            perGroup[pool[pick]!] = root;
            pool.splice(pick, 1);
        }

        let x = rect.X;
        let y = rect.Y;
        for (let g = 0; g < b; ++g) {
            const inGroup = perGroup[g]!;
            if (inGroup < a) {
                if (wide) x += Math.trunc(blockW / 2);
                else y += Math.trunc(blockH / 2);
            }
            for (let k = 0; k < inGroup; ++k) {
                blocks.push({ X: x + 2, Y: y + 2, Width: blockW - 4, Height: blockH - 4 });
                x += innerStepX;
                y += innerStepY;
            }
            x += groupStepX;
            y += groupStepY;
            if (wide) x = rect.X;
            else y = rect.Y;
        }
    }

    // ---- GenerateContinent (sub_59AFA0) -----------------------------------
    generateContinent(): void {
        this.genCode = 1;

        const total = 2 * this.size.mapWidth * (this.size.mapHeight + 4);
        const water = this.waterAmount;
        const target = (1.0 - water * 0.01) * (0.5 - 0.45) + 0.45;
        const maxPatch = F2I64(total * 0.03 * target);

        const centre = Math.trunc(this.size.mapHeight / 2) + Math.trunc(this.size.mapWidth / 2);

        let seedX = centre + 1;
        let seedY = centre;
        const centrePacked = packXY(centre + 1, centre);

        this.clearWorkOccupancy();

        const bounds: MapRect = {
            X: K_VISIBLE_OFFSET_X + 1,
            Y: K_VISIBLE_OFFSET_Y + 1,
            Width: this.size.width - 2,
            Height: this.size.height - 2,
        };

        let grown = 0;
        let patches = 0;
        let covered = 0.0;

        if (target > 0.0) {
            do {
                if (patches >= 100) break;

                let area = F2I64((target - covered) * total);
                if (area >= maxPatch) area = maxPatch;

                grown += this.growPatch(area, bounds, packXY(seedX, seedY), 1, centrePacked, 0.75, 1);
                ++patches;
                covered = grown / total;

                let bestDistance = 50000;
                let bestX = 0;
                let bestY = 0;
                const it = new CellIterator();
                it.reset(this.cellSlots, this.size.mapWidth);
                for (let cell = it.next(); cell !== null; cell = it.next()) {
                    const x = cell.mapCoords & 0xffff;
                    const y = cell.mapCoords >>> 16;
                    if (this.work.i(this.workIndex(x, y), 15) !== 0) continue;

                    const distance = Math.abs(x - (centre + 1)) + Math.abs(y - centre);
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestX = x;
                        bestY = y;
                    }
                }
                seedX = bestX;
                seedY = bestY;
            } while (covered < target);
        }
    }

    // ---- GenerateTeamContinent (sub_59B200) -------------------------------
    generateTeamContinent(): void {
        this.genCode = 1;

        const total = 2 * this.size.mapWidth * (this.size.mapHeight + 4);
        const water = this.waterAmount;
        const target = (1.0 - water * 0.01) * (0.2 - 0.15) + 0.15;
        const maxPatch = F2I64(total * 0.06 * target);

        this.clearWorkOccupancy();

        const half: MapRect[] = [{ X: 0, Y: 0, Width: 0, Height: 0 }, { X: 0, Y: 0, Width: 0, Height: 0 }];
        const roll = this.rng.next() * kUnitScale;
        if (roll >= 0.5) {
            half[0] = { X: K_VISIBLE_OFFSET_X, Y: K_VISIBLE_OFFSET_Y, Width: this.size.width, Height: Math.trunc(this.size.height / 2) - 1 };
            half[1] = { X: half[0].X, Y: Math.trunc(this.size.height / 2) + K_VISIBLE_OFFSET_Y + 1, Width: half[0].Width, Height: half[0].Height };
        } else {
            half[0] = { X: K_VISIBLE_OFFSET_X, Y: K_VISIBLE_OFFSET_Y, Width: Math.trunc(this.size.width / 2) - 1, Height: this.size.height };
            half[1] = { X: Math.trunc(this.size.width / 2) + K_VISIBLE_OFFSET_X + 1, Y: half[0].Y, Width: half[0].Width, Height: half[0].Height };
        }

        let patches = 0;

        for (let h = 0; h < 2; ++h) {
            const r = half[h]!;
            const rectX = r.X, rectY = r.Y, rectW = r.Width, rectH = r.Height;

            const centreX = rectX + Math.trunc(rectH / 2) + Math.trunc(rectW / 2) + rectY + 1;
            const centreY = rectY + this.size.mapWidth + Math.trunc(rectH / 2) - Math.trunc(rectW / 2) - rectX;
            const centrePacked = packXY(centreX, centreY);

            let weightX: number, weightY: number;
            if (rectH <= rectW) {
                weightX = 1.0;
                weightY = rectW / rectH * 1.2;
            } else {
                weightY = 1.0;
                weightX = rectH / rectW * 1.2;
            }
            const invW2 = 1.0 / (rectW * 0.5 * (rectW * 0.5));
            const invH2 = 1.0 / (rectH * 0.5 * (rectH * 0.5));

            let grown = 0;
            let covered = 0.0;
            let seedX = centreX;
            let seedY = centreY;

            if (target > 0.0) {
                do {
                    if (patches >= 100) break;

                    let area = F2I64((target - covered) * total);
                    if (area >= maxPatch) area = maxPatch;

                    grown += this.growPatch(area, r, packXY(seedX, seedY), 1, centrePacked, 0.75, 1);
                    let bestSeed = 0;
                    ++patches;
                    covered = grown / total;

                    const boxMinDiff = 2 * rectX - this.size.mapWidth + 1;
                    const boxMaxDiff = boxMinDiff + 2 * rectW + 2;
                    const boxMinSum = this.size.mapWidth + 2 * rectY + 1;
                    const boxMaxSum = boxMinSum + 2 * rectH + 2;
                    let bestDistance = 50000;

                    const cellCount = this.size.workSide * this.size.workSide;
                    for (let idx = 0; idx < cellCount; ++idx) {
                        const x = idx % this.size.workSide;
                        const y = Math.trunc(idx / this.size.workSide);
                        const sum = x + y;
                        const diff = x - y;
                        if (sum < boxMinSum || sum > boxMaxSum) continue;
                        if (diff < boxMinDiff || diff > boxMaxDiff) continue;
                        if (this.work.i(idx, 15) !== 0) continue;

                        const packed = packXY(x, y);
                        if (!this.patchInBounds(packed, r, 1, invW2, invH2)) continue;

                        const distance = F2I64(Math.abs(y - centreY) * weightY + Math.abs(x - centreX) * weightX);
                        if (distance < bestDistance) {
                            bestDistance = distance;
                            bestSeed = packed;
                        }
                    }

                    seedX = unpX(bestSeed);
                    seedY = unpYS(bestSeed);
                } while (covered < target);
            }
        }
    }

    // ---- GrowPatch (sub_59BBC0) -------------------------------------------
    growPatch(
        areaReq: number,
        bounds: MapRect | null,
        seedXY: number,
        boundsMode: number,
        centerXY: number,
        step: number,
        priorityMode: number,
    ): number {
        let area = areaReq;
        if (area <= 400) area = 400;
        let capacity = 8 * area + 2;
        if (capacity <= 100) capacity = 100;

        const pool: PatchNode[] = new Array(capacity);
        const heap = new PatchHeap();
        heap.slots = new Array(capacity + 1).fill(null);
        let used = 0;

        // B. Seed
        let seedX: number, seedY: number;
        if (seedXY !== 0) {
            seedX = unpX(seedXY);
            seedY = unpYS(seedXY);
        } else {
            let tries = 0;
            for (;;) {
                let rx: number;
                do {
                    rx = F2I64(this.rng.next() * this.size.mapWidth * kUnitScale);
                } while ((rx >>> 0) > (this.size.mapWidth - 1) >>> 0);
                let ry: number;
                do {
                    ry = F2I64(this.rng.next() * this.size.mapHeight * kUnitScale);
                } while ((ry >>> 0) > (this.size.mapHeight - 1) >>> 0);

                seedX = ry + rx + 1;
                seedY = this.size.mapWidth - rx + ry;
                ++tries;
                if (tries >= 200) return 0;

                if (this.work.i(this.workIndex(seedX, seedY), 14) === 0 &&
                    isWaterFamilyTile(this, this.cellAt(seedX, seedY)))
                    break;
            }
        }

        // C. Aspect weights
        let weightA = 0.0; // v86
        let weightB = 0.0; // v85
        if (bounds !== null) {
            if (bounds.Width <= bounds.Height) {
                weightB = Math.fround(1.0);
                weightA = Math.fround((bounds.Height / bounds.Width) * 1.2);
            } else {
                weightA = Math.fround(1.0);
                weightB = Math.fround((bounds.Width / bounds.Height) * 1.2);
            }
        }

        let cursorX = seedX;
        let cursorY = seedY;

        pool[0] = { coords: packXY(seedX, seedY), priority: 0.0 };
        this.work.setI(this.workIndex(seedX, seedY), 15, this.genCode);
        used = 1;
        heap.push(pool[0]!, capacity);
        let node = heap.pop();

        const halfWidth = bounds ? bounds.Width * 0.5 : 0.0;
        const halfHeight = bounds ? bounds.Height * 0.5 : 0.0;
        const invHalfWidthSq = bounds ? 1.0 / (halfWidth * halfWidth) : 0.0;
        const invHalfHeightSq = bounds ? 1.0 / (halfHeight * halfHeight) : 0.0;

        // D. Growth loop
        let grown = 0;
        while (node !== null) {
            const cx = unpX(node.coords);
            const cy = unpYS(node.coords);
            this.work.setI(this.workIndex(cx, cy), 14, this.genCode);
            this.cellAt(cx, cy).isoTileTypeIndex = 0;

            for (let facing = 0; facing < 8; facing += 2) {
                const nx = cx + DIR_X[facing]!;
                const ny = cy + DIR_Y[facing]!;
                if (!this.cellExists(nx, ny)) continue;

                const wi = this.workIndex(nx, ny);
                if (this.work.i(wi, 14) !== 0 || this.work.i(wi, 15) === this.genCode) continue;

                const neighbour = this.cellAt(nx, ny);
                if (!isWaterFamilyTile(this, neighbour)) continue;
                if (used >= capacity) continue;
                if (!this.patchInBounds(packXY(nx, ny), bounds, boundsMode, invHalfWidthSq, invHalfHeightSq)) continue;

                const curX = F2I64(cursorX + 0.5);
                const curY = F2I64(cursorY + 0.5);
                let priority: number;
                if (priorityMode) {
                    priority = this.patchDirectionalPriority(
                        packXY(curX, curY), packXY(nx, ny), bounds, centerXY, weightA, weightB);
                } else {
                    const dx = nx - curX;
                    const dy = ny - curY;
                    const dist = yrSqrt(dx * dx + dy * dy);
                    priority = this.rng.next() * 5.0 * kUnitScale + dist;
                }

                const pushed: PatchNode = {
                    coords: packXY(nx, ny),
                    priority: Math.fround(priority),
                };
                this.work.setI(wi, 15, this.genCode);
                pool[used] = pushed;
                ++used;
                heap.push(pushed, capacity);
            }

            cursorX += this.rng.gaussian() * step;
            cursorY += this.rng.gaussian() * step;
            ++grown;

            node = heap.pop();
            if (grown >= area) break;
        }

        // E. Drain the leftover queue
        for (let left = heap.pop(); left !== null; left = heap.pop()) {
            const px = unpX(left.coords);
            const py = unpYS(left.coords);
            const wi = this.workIndex(px, py);
            if (this.work.i(wi, 14) === 0 && isWaterFamilyTile(this, this.cellAt(px, py))) {
                this.cellAt(px, py).isoTileTypeIndex = 0;
                this.work.setI(wi, 14, this.genCode);
            }
            ++grown;
        }

        // F. Smoothing + shore reclaim
        const smoothed = smoothWaterBody(this, this.genCode, 1);
        {
            const it = new CellIterator();
            it.reset(this.cellSlots, this.size.mapWidth);
            for (let cell = it.next(); cell !== null; cell = it.next()) {
                if (cell.isoTileTypeIndex >= this.shorePieces &&
                    cell.isoTileTypeIndex < this.shorePieces + 42) {
                    cell.isoTileTypeIndex = 0;
                    cell.height = 0;
                }
            }
        }

        // G. Success / rollback
        if (smoothed) {
            const result = grown;
            ++this.genCode;
            return result;
        }

        {
            const it = new CellIterator();
            it.reset(this.cellSlots, this.size.mapWidth);
            for (let cell = it.next(); cell !== null; cell = it.next()) {
                const x = cell.mapCoords & 0xffff;
                const y = cell.mapCoords >>> 16;
                const wi = this.workIndex(x, y);
                if (this.work.i(wi, 14) === this.genCode) {
                    this.work.setI(wi, 14, 0);
                    this.work.setByte(wi, 75, 0);
                    cell.isoTileTypeIndex = this.waterTileIndex;
                    cell.height = 0;
                    cell.level = this.baseLevel;
                }
            }
        }
        return 0;
    }

    // ---- PatchInBounds (sub_59BAB0) ----------------------------------------
    patchInBounds(
        cellXY: number,
        bounds: MapRect | null,
        boundsMode: number,
        invHalfWidthSq: number,
        invHalfHeightSq: number,
    ): boolean {
        if (bounds === null) return true;

        const cellX = unpX(cellXY);
        const cellY = unpYS(cellXY);

        if (boundsMode) {
            const u = (cellX - 2 * bounds.X - cellY + this.size.mapWidth - 1) * 0.5 - bounds.Width * 0.5;
            const v = (cellX - 2 * bounds.Y - this.size.mapWidth + cellY - 1) * 0.5 - bounds.Height * 0.5;
            return v * v * invHalfHeightSq + u * u * invHalfWidthSq < 1.0;
        }

        return cellX >= bounds.X && cellX < bounds.X + bounds.Width &&
            cellY >= bounds.Y && cellY < bounds.Y + bounds.Height;
    }

    // ---- PatchDirectionalPriority (sub_59B940) -----------------------------
    patchDirectionalPriority(
        cursorXY: number,
        cellXY: number,
        bounds: MapRect | null,
        centreXY: number,
        weightA: number,
        weightB: number,
    ): number {
        const cursorX = unpX(cursorXY);
        const cursorY = unpYS(cursorXY);
        const cellX = unpX(cellXY);
        const cellY = unpYS(cellXY);

        if (bounds === null) {
            const dx = cursorX - cellX;
            const dy = cursorY - cellY;
            return yrSqrt(dx * dx + dy * dy);
        }

        const centreX = unpX(centreXY);
        const centreY = unpYS(centreXY);

        const du = Math.abs(((cellX - cellY) >> 1) - ((centreX - centreY) >> 1));
        const dv = Math.abs(((cellX + cellY) >> 1) - ((centreX + centreY) >> 1));
        if (du === 0 && dv === 0) return 0.0;

        const len = yrSqrt(du * du + dv * dv);

        let chebyshev = Math.abs(cursorY - cellY);
        const dxAbs = Math.abs(cursorX - cellX);
        if (dxAbs > chebyshev) chebyshev = dxAbs;

        const unitU = du / len;
        const unitV = dv / len;
        return (unitV * weightB + weightA * unitU) * chebyshev;
    }

    // ---- GenerateSpecialTerrain (sub_59C580) --------------------------------
    generateSpecialTerrain(): void {
        ++this.genCode;

        const landType = this.config.landType;
        diag(`SPEC g=${this.genCode} landType=${landType} water=${this.waterAmount}`);
        if ((landType === LandType.Inland || landType === LandType.Mountainous) && this.waterAmount > 20) {
            for (let i = 0; i < 10; ++i) {
                const startXY = 0;
                diag(`RIVER-TRY ${i}`);
                if (generateRiver(this, { v: startXY }, 0.0, false)) {
                    ++this.genCode;
                    diag(`RIVER-OK g=${this.genCode}`);
                    break;
                }
            }
        }
        for (let i = 0; i < 10; ++i) {
            const lakeSeed = 0;
            diag(`LAKE-TRY ${i}`);
            if (generateLake(this, { v: lakeSeed })) {
                ++this.genCode;
                diag(`LAKE-OK g=${this.genCode}`);
                return;
            }
        }
    }

    // ---- tile predicates ----------------------------------------------------
    /** sub_485060. */
    isWaterTile(cell: MapCell): boolean {
        const tile = cell.isoTileTypeIndex;
        return tile >= this.waterTileIndex && tile < this.waterTileIndex + 14;
    }

    /** sub_486380. */
    isPlaceholderTile(cell: MapCell): boolean {
        const tile = cell.isoTileTypeIndex;
        return tile === 0 || tile === 0xffff;
    }

    // ---- ReInitMapData (sub_5981F0) -----------------------------------------
    reInitMapData(): boolean {
        const path = this.rmgmdIniPath();
        if (path === null) {
            this.iniLoaded = false;
            return false;
        }

        const s = this.settings;
        s.LevelLightSettings = [];
        s.TemperateAmbientLight = [];
        s.SnowAmbientLight = [];
        s.TemperateAmbientRed = [];
        s.TemperateAmbientGreen = [];
        s.TemperateAmbientBlue = [];
        s.SnowAmbientRed = [];
        s.SnowAmbientGreen = [];
        s.SnowAmbientBlue = [];
        s.VegetationMinimums = [];
        s.VegetationMaximums = [];
        s.TemperateOrePatchLamps = [];
        s.SnowOrePatchLamps = [];

        s.MinTiberium = profileInt(path, 'General', 'RMGMinimumTiberium', s.MinTiberium);
        s.MaxTiberium = profileInt(path, 'General', 'RMGMaximumTiberium', s.MaxTiberium);

        readIntList(path, 'RMGLevelLightSettings', s.LevelLightSettings);
        readIntList(path, 'RMGVegetationMinimums', s.VegetationMinimums);
        readIntList(path, 'RMGVegetationMaximums', s.VegetationMaximums);
        readIntList(path, 'TemperateAmbientLight', s.TemperateAmbientLight);
        readIntList(path, 'SnowAmbientLight', s.SnowAmbientLight);
        readIntList(path, 'TemperateAmbientRed', s.TemperateAmbientRed);
        readIntList(path, 'TemperateAmbientGreen', s.TemperateAmbientGreen);
        readIntList(path, 'TemperateAmbientBlue', s.TemperateAmbientBlue);
        readIntList(path, 'SnowAmbientRed', s.SnowAmbientRed);
        readIntList(path, 'SnowAmbientGreen', s.SnowAmbientGreen);
        readIntList(path, 'SnowAmbientBlue', s.SnowAmbientBlue);

        s.MaxTrees = profileInt(path, 'General', 'MaxTrees', s.MaxTrees);

        readNameList(path, 'TemperateOrePatchLamps', s.TemperateOrePatchLamps);
        readNameList(path, 'SnowOrePatchLamps', s.SnowOrePatchLamps);

        this.iniLoaded = true;
        return true;
    }
}
