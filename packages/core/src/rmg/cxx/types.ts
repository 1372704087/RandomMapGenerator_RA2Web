/**
 * Core data model for the C++-aligned RMG pipeline.
 *
 * This subtree (rmg/cxx/) is a 1:1 transliteration of the reference C++
 * project G:\MapGenerator (MapGen.h + MapGen*.cpp). Alignment contract:
 * same params + same seeds => byte-identical cell state and .map output.
 * The authoritative source for every function is the C++ file named in
 * each module's header comment - when in doubt, read the C++, not this
 * comment.
 *
 * Numeric conventions for the whole subtree (see also cxx/README.md):
 *  - C++ `int`  -> TS `number`, 32-bit wrap via `| 0` where it can overflow.
 *  - C++ `uint32` ops -> `>>> 0`.
 *  - 32-bit products -> `Math.imul(a, b)` (plain `a * b` loses bits past 2^53).
 *  - C++ `float` stores -> wrap with `Math.fround`.
 *  - trunc casts -> `F2I64` (toward zero).
 *  - packed cell coord: low 16 bits = X (sign-extended with `unpX`),
 *    high 16 bits = Y (zero-extended with `unpY`, sign-extended with `unpYS`
 *    exactly where the C++ writes the int16 cast).
 */

/** Mutable box for C++ T* in/out parameters. */
export interface Box<T> { v: T }
export const box = <T,>(v: T): Box<T> => ({ v });

export enum LandType {
    Archipelago = 0,
    Continent = 1,
    TeamContinent = 2,
    Inland = 3,
    Mountainous = 4,
}

export type TheaterTypeInt = 0 | 1; // 0 temperate, 1 snow
export type TimeOfDayInt = 0 | 1 | 2 | 3;

/** RectangleStruct stand-in. */
export interface MapRect {
    X: number;
    Y: number;
    Width: number;
    Height: number;
}

export const rect = (X: number, Y: number, Width: number, Height: number): MapRect => ({ X, Y, Width, Height });

/** CellStruct { int16 X; int16 Y } carried as a packed int32. */
export type CellStructPacked = number;

export const packXY = (x: number, y: number): number =>
    ((x & 0xffff) | ((y & 0xffff) << 16)) | 0;

/** low 16 bits, sign-extended (C++ `static_cast<int16_t>(v & 0xFFFF)`). */
export const unpX = (p: number): number => (p << 16) >> 16;
/** high 16 bits, zero-extended (C++ `(uint32_t)v >> 16`). */
export const unpY = (p: number): number => p >>> 16;
/** high 16 bits, sign-extended (C++ `static_cast<int16_t>(uint32(v) >> 16)`). */
export const unpYS = (p: number): number => ((p >>> 16) << 16) >> 16;

/** int16 wrap helper for coordinate adds (GetNeighbourCell uses 16-bit adds). */
export const i16 = (v: number): number => (v << 16) >> 16;

// ---------------------------------------------------------------------------
// MapCell - simplified CellClass (only fields the generation touches).
// ---------------------------------------------------------------------------
export class MapCell {
    mapCoords = 0; // packed: low16 X, high16 Y
    level = 4;
    isoTileTypeIndex = 0;
    slopeIndex = 0;
    height = 0;
    overlayTypeIndex = -1;
    overlayData = 0;
    altFlags = 0; // AltCellFlags bits (0x2 ContainsBuilding)

    // ---- fields the "Recalculating cell attributes" stage owns ----
    landType = 0; // cell +0xEC floor class
    passability = 0; // cell +0x4C PassabilityType
    tubeIndex = -1; // cell +0x116
    zAdjust = 0; // cell +0x11D
    cellFlags = 0; // cell +0x140 (bit 0x20000 = tile animation attached)

    reset(cellLevel: number): void {
        // cell reset loop of sub_599650 (0x599e86)
        this.slopeIndex = 0;
        this.level = cellLevel;
        this.isoTileTypeIndex = 0;
        this.height = 0;
        this.overlayTypeIndex = -1;
        this.overlayData = 0;
    }
}

// ---------------------------------------------------------------------------
// WorkArray - the 80-byte-per-cell work grid (game global dword_ABED10).
//
// Byte-level init from sub_599650 (0x59a321 - 0x59a376):
//   data[16] (bytes 64..67) = -1, byte 74 = 1, everything else 0.
// Linear index: x + workSide * y.
//
// Named dword slots used by the pipeline:
//   data[14] (+56)  generation mark   (blob territory / genCode)
//   data[15] (+60)  occupancy mark    (patch growth / region id)
//   data[16] (+64)  TileNeighbourMask cache
// Byte slots:
//   74  validity flag (1 from the ctor)
//   75  ring marker (sub_5A0700)
//   69  hill protection / tech apron mark
// ---------------------------------------------------------------------------
export class WorkArray {
    readonly bytes: Uint8Array;
    readonly dwords: Int32Array;
    readonly count: number;

    constructor(count: number) {
        this.count = count;
        this.bytes = new Uint8Array(count * 80);
        this.dwords = new Int32Array(this.bytes.buffer);
        for (let i = 0; i < count; ++i) {
            this.dwords[i * 20 + 16] = -1;
            this.bytes[i * 80 + 74] = 1;
        }
    }

    /** data[dword] of cell `index`. */
    i(index: number, dword: number): number {
        return this.dwords[index * 20 + dword];
    }
    setI(index: number, dword: number, v: number): void {
        this.dwords[index * 20 + dword] = v | 0;
    }
    byte(index: number, off: number): number {
        return this.bytes[index * 80 + off];
    }
    setByte(index: number, off: number, v: number): void {
        this.bytes[index * 80 + off] = v & 0xff;
    }
    /** generation mark (+56). */
    genMark(index: number): number {
        return this.i(index, 14);
    }
    setGenMark(index: number, v: number): void {
        this.setI(index, 14, v);
    }
    /** occupancy mark (+60). */
    occupancy(index: number): number {
        return this.i(index, 15);
    }
    setOccupancy(index: number, v: number): void {
        this.setI(index, 15, v);
    }
    /** neighbour-mask cache (+64). */
    maskCache(index: number): number {
        return this.i(index, 16);
    }
    setMaskCache(index: number, v: number): void {
        this.setI(index, 16, v);
    }
    /** signed view of a dword slot (values are stored/retrieved as int32). */
    iSigned(index: number, dword: number): number {
        return this.dwords[index * 20 + dword];
    }
}

// ---------------------------------------------------------------------------
// CellIterator - exact replication of the game's diamond cell iterator
// (Reset = sub_578350, Next = MapClass::CellIteratorNext 0x578290).
// ---------------------------------------------------------------------------
export class CellIterator {
    private slots: (MapCell | null)[] | null = null;
    private mapWidth = 0;
    private nextX = 0;
    private nextY = 0;
    private currentY = 0;
    private slotIndex = 0;

    reset(slots: (MapCell | null)[], mapWidth: number): void {
        this.slots = slots;
        this.mapWidth = mapWidth;
        this.nextX = 1;
        this.nextY = mapWidth;
        this.currentY = mapWidth - 1;
        this.slotIndex = 512 * mapWidth + 1;
    }

    /** Next cell, or null when the walk leaves the diamond. */
    next(): MapCell | null {
        if (this.slots === null) return null;
        const curY = this.currentY;
        const oldSlot = this.slotIndex;
        if (curY !== 0) {
            this.nextY -= 1;
            this.nextX += 1;
            this.currentY = curY - 1;
            this.slotIndex = oldSlot - 511;
        } else {
            const ny = this.nextY;
            const nx = this.nextX;
            this.nextX = ny;
            this.nextY = nx;
            if (((ny - this.mapWidth + nx - 1) & 1) !== 0) {
                this.currentY = this.mapWidth - 1;
                this.nextY = nx + 1;
            } else {
                this.currentY = this.mapWidth - 2;
                this.nextX = ny + 1;
            }
            this.slotIndex = this.nextX + (this.nextY << 9);
        }
        return this.slots[oldSlot] ?? null;
    }
}

/** Neighbours table order (CellClass::GetNeighbourCell), N first, clockwise. */
export const DIR_X = [0, 1, 1, 1, 0, -1, -1, -1];
export const DIR_Y = [-1, -1, 0, 1, 1, 1, 0, -1];

// ---------------------------------------------------------------------------
// Generation config (MapGenConfig) + rolled global options (GlobalMapOptions).
// ---------------------------------------------------------------------------
export interface GlobalMapOptions {
    flag010: number;
    n3: number;
    value020: number;
    value018: number;
    value03C: number;
    waterAmount: number; // this[19]
    ruggedness: number; // this[17]
    urbanPresence: number; // this[24]
    accessibility: number; // this[27]
    regionSize: number; // this[28]
    tiberiumLayout: number; // this[22]
    vegetation: number; // this[23]
    seed04C: number; // this[29]
}

export interface MapGenConfig {
    landType: LandType;
    theater: number; // 0 temperate / 1 snow
    timeOfDay: number; // 0..3
    sizeSlider: number; // 0..3
    playerCount: number; // 2..8
    oreDensity: number; // 0..3
    multiplayer: boolean;
    waterAmount: number; // 0..100 (rolled by the caller like sub_597260)
    randomSeed: number; // this[29] label only - NOT the map RNG seed
    mapRngSeed: number; // the map RNG's seed (exe keeps the vanilla 0)
    global: GlobalMapOptions;
}

export interface MapSizeResult {
    width: number;
    height: number;
    mapWidth: number; // W' = W + 4
    mapHeight: number; // H' = H + 12
    workSide: number; // W' + H' + 1
}

// ---------------------------------------------------------------------------
// MapRegion - one region record (vanilla 0x50-byte object).
// ---------------------------------------------------------------------------
export interface MapRegion {
    startPointPicks: number[]; // packed coords (pick list left by sub_594870)
    neighbours: number[]; // +0x04
    id: number; // +0x08
    cellCount: number; // +0x0C
    level: number; // +0x10
    waterFamily: boolean; // +0x14
    mergeSettled: number; // +0x1A byte
    rampFlag: number; // +0x1B byte
    startingPoints: number; // +0x20
    consumed: number; // +0x24 byte
    cells: number[]; // +0x28 packed coords of every covered cell
    bounds: MapRect; // +0x40 { minX, minY, width, height }
}

export const newRegion = (): MapRegion => ({
    startPointPicks: [],
    neighbours: [],
    id: 0,
    cellCount: 0,
    level: 0,
    waterFamily: false,
    mergeSettled: 0,
    rampFlag: 0,
    startingPoints: 0,
    consumed: 0,
    cells: [],
    bounds: rect(0, 0, 0, 0),
});

// ---------------------------------------------------------------------------
// Ledgers (route B for the engine's object system).
// ---------------------------------------------------------------------------
export interface MapStructureRec {
    coords: number; // packed
    typeName: string;
    houseName: string;
    facing: number;
}

export interface MapTerrainObjectRec {
    coords: number; // packed
    typeName: string;
}

export interface StartingPointRecord {
    index: number;
    coords: number; // packed
}

export interface NeutralTechBuilding {
    name: string;
    width: number;
    height: number;
}

export interface MultiplayerHouse {
    country: string;
    color: string;
}

// ---------------------------------------------------------------------------
// Tile / overlay / ground / tiberium tables (see MapGen.h for the vanilla
// offsets each field mirrors).
// ---------------------------------------------------------------------------
export interface TileCellAttr {
    hasFrame: boolean;
    terrainType: number;
    rampType: number;
    flags36: number;
    cellsInX: number;
    cellsInY: number;
    extra4: number;
    extra24: number;
    radarRedLeft: number;
    radarGreenLeft: number;
    radarBlueLeft: number;
    radarRedRight: number;
    radarGreenRight: number;
    radarBlueRight: number;
}

export interface OverlayTypeInfo {
    present: boolean;
    landType: number;
    tiberium: boolean;
    noUseTileLandType: boolean;
    crushable: boolean;
    wall: boolean;
    isARock: boolean;
    isRubble: boolean;
}

export interface GroundTypeInfo {
    cost: number[]; // 8 float speed-type multipliers
    buildable: boolean;
}

export interface TiberiumInfo {
    overlayStart: number;
    numImages: number;
    extra: number;
    arrayIndex: number;
}

/** CellLevelPassabilityStruct - four bytes: passability, level, zone index. */
export interface CellLevelPassability {
    cellPassability: number;
    cellLevel: number;
    zoneArrayIndex: number;
}

/** Hill stage elevation grid entry (8 bytes, game dword_B0B6EC). */
export interface ElevationEntry {
    corner: number; // +0
    blocked: number; // +4
    touched: number; // +5
}

/** One CliffSet footprint stamp outcome (PlaceCliffs). */
export interface CliffStampOutcome {
    ox: number;
    oy: number;
    x: number;
    y: number;
    slot: number;
    h: number;
    z: number;
    ok: number;
}
