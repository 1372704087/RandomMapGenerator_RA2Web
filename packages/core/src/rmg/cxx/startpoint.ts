/**
 * Transliteration of G:/MapGenerator MapGenStartpoint.cpp - the
 * "RMG: Creating starting points" stage (sub_598960 @ 0x598e9e retry loop)
 * and its two steps (sub_594B50 / sub_5A1FB0), plus the engine-global
 * option roll (RollGlobalOptions, sub_596300 @ 0x59678f) and the
 * movement-zone rebuild family (sub_56C510 / sub_56CB90 / GetMoveError
 * 0x56d230).
 *
 * Also carries the functions that live in this C++ file even though other
 * stages call them: LoadNeutralTechBuildings / LoadMultiplayerHouses
 * (MapGen.cpp 0x599650 tail) and sub_595400 GiveRegionATechBuilding with
 * its FoundationFitsAt / FoundationFitsAtFlat / RecordPlacedBuilding
 * helpers, and the [port-only] relocation machinery
 * (EnsureStartingPointsConnected + the three Relocate* variants,
 * IsCliffClearAround, BuildCoastalDistance).
 *
 * Alignment contract: same params + same seeds => byte-identical cell
 * state and .map output. All divergences settle on the C++ source.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { Rmg } from './mapGen';

import {
    Box,
    box,
    CellIterator,
    GlobalMapOptions,
    LandType,
    MapCell,
    MapRegion,
    packXY,
    unpX,
    unpYS,
    i16,
} from './types';
import { F2I64, K_UNIT_SCALE } from './mathTables';
import { diag } from './diag';
import { profileString } from './winapi';
import { releaseRegionObject, createRegionRecord } from './making';
import {
    isWithinUsableArea,
    isWithinUsableRect,
    tileRectClear,
    tileRectLevelClear,
} from './makingSub';
import { msvcSort } from './msvcSort';

// ---------------------------------------------------------------------------
// The scenario's [Map] LocalSize = {2, 5, W, H} (MapClass::VisibleRect);
// W/H are size_.width / size_.height. Same pair MapGenMakingSub.cpp carries.
// ---------------------------------------------------------------------------
const K_VISIBLE_OFFSET_X = 2;
const K_VISIBLE_OFFSET_Y = 5;

// PassabilityType enum values used here (game enum order).
const PASSABLE = 0;
const BEACH = 3;
const WATER = 4;
const IMPASSABLE = 6;
const OUTSIDE_MAP = 7;

// AltCellFlags_ContainsBuilding (cell +? AltFlags bit 0x2).
const ALT_CELL_FLAGS_CONTAINS_BUILDING = 0x2;
// The starting-point cell flag (CellFlags bit 4, written by sub_594870).
const CELL_FLAG_START_POINT = 4;

// [port-only] the "walk to the sea" budget for the coastal hard constraint.
const K_COASTAL_STEPS = 15;

// ---------------------------------------------------------------------------
// The static table at 0x82A594: thirteen rows of eight ints. Row = the
// movement zone's index, column = a cell's passability class. 1 means
// "cannot cross", 2 and 3 are the two grades that can. sub_56C510 only ever
// tests "== 1". Mirrored into Rmg.zonePassability (the 13 Uint8Array rows).
// ---------------------------------------------------------------------------
const K_ZONE_PASSABILITY: readonly number[][] = [
    [1, 2, 2, 2, 2, 2, 2, 3],
    [1, 1, 2, 2, 2, 2, 2, 3],
    [1, 1, 1, 2, 2, 2, 2, 3],
    [1, 1, 1, 1, 1, 1, 2, 3],
    [1, 1, 2, 1, 1, 2, 2, 3],
    [1, 2, 2, 1, 1, 2, 2, 3],
    [1, 1, 1, 2, 2, 2, 1, 3],
    [1, 2, 2, 2, 2, 1, 2, 3],
    [1, 1, 1, 2, 2, 1, 2, 3],
    [1, 1, 1, 1, 1, 1, 1, 3],
    [2, 2, 2, 2, 1, 2, 2, 3],
    [2, 2, 2, 1, 1, 2, 2, 3],
    [1, 1, 1, 2, 2, 2, 2, 3],
];

/** The zone number is the 16-bit field at +2 of each 4-byte record. */
function lpZone(r: Rmg, index: number): number {
    const arr = r.levelAndPassability;
    if (index < 0 || index >= arr.length) return 0; // C++ reads raw bytes; unreachable in practice
    return arr[index]!.zoneArrayIndex;
}

function lpSetZone(r: Rmg, index: number, zone: number): void {
    const arr = r.levelAndPassability;
    if (index < 0 || index >= arr.length) return;
    arr[index]!.zoneArrayIndex = zone;
}

/** byte 0 of the record: the passability class (read but never written by the fill). */
function lpPass(r: Rmg, index: number): number {
    const arr = r.levelAndPassability;
    if (index < 0 || index >= arr.length) return 0; // C++ reads raw bytes; unreachable in practice
    return arr[index]!.cellPassability;
}

/** byte 1 of the record: the cell's level, the "same layer" test. */
function lpLevel(r: Rmg, index: number): number {
    const arr = r.levelAndPassability;
    if (index < 0 || index >= arr.length) return 0; // C++ reads raw bytes; unreachable in practice
    return arr[index]!.cellLevel;
}

// ---------------------------------------------------------------------------
// Step 2's flood (sub_5A1FB0): an 8-byte node - the cell plus its
// straight-line distance to the starting point - and a 1-based min-heap
// over references to those nodes (the vanilla heap object the lake stage
// ports as LakeHeap: sift-down sub_5AD870, pop sub_5AC960, inline sift-up).
// ---------------------------------------------------------------------------
interface StartFloodNode {
    coords: number; // packed CellStruct (+0)
    distance: number; // float (+4)
}

class StartFloodHeap {
    static readonly kCapacity = 800; // vanilla: `if (count + 1 < cap)`

    slots: (StartFloodNode | null)[]; // slots[0] unused
    count = 0;

    constructor() {
        this.slots = new Array<StartFloodNode | null>(StartFloodHeap.kCapacity + 1).fill(null);
    }

    /** Sift-down (sub_5AD870). */
    siftDown(a2: number): void {
        let v2 = a2;
        let v3 = 2 * a2;
        const v4 = 2 * a2 + 1;
        if (!(2 * a2 <= this.count)
            || this.slots[a2]!.distance <= this.slots[2 * a2]!.distance)
            v3 = a2;
        if (v4 <= this.count && this.slots[v3]!.distance > this.slots[v4]!.distance)
            v3 = 2 * a2 + 1;
        if (v3 === a2)
            return;
        do {
            const v6 = 2 * v3 + 1;
            const v7 = this.slots[v2]!;
            this.slots[v2] = this.slots[v3];
            v2 = v3;
            this.slots[v3] = v7;
            if (2 * v3 <= this.count
                && this.slots[v3]!.distance > this.slots[2 * v3]!.distance)
                v3 *= 2;
            if (v6 <= this.count && this.slots[v3]!.distance > this.slots[v6]!.distance)
                v3 = v6;
        } while (v3 !== v2);
    }

    /**
     * Sift-up insert. Silently dropped once count + 1 would reach the
     * capacity - the node keeps its mark but never enters the queue.
     * NOTE the vanilla sets `count = v` (the final slot), exactly as the
     * C++ source does - not `count + 1`.
     */
    push(node: StartFloodNode): void {
        let v = this.count + 1;
        let parent = v >> 1;
        if (v >= StartFloodHeap.kCapacity)
            return;
        while (v > 1 && this.slots[parent] !== null
            && this.slots[parent]!.distance > node.distance) {
            this.slots[v] = this.slots[parent];
            v = parent;
            parent >>= 1;
        }
        this.slots[v] = node;
        this.count = v;
    }

    /** Pop the nearest node (sub_5AC960). */
    pop(): StartFloodNode | null {
        if (this.count === 0)
            return null;
        const root = this.slots[1]!;
        this.slots[1] = this.slots[this.count];
        this.slots[this.count] = null;
        --this.count;
        this.siftDown(1);
        return root;
    }
}

// ---------------------------------------------------------------------------
// MapClass::GetMoveError (0x56d230 - 0x56d399).
//
//   idx = coords.X + coords.Y * (MapRect.Height + MapRect.Width + 1)
//   if (idx < 0)                     idx = 0
//   if (idx >= ValidMapCellCount)    idx = ValidMapCellCount - 1
//   return MovementZones[zone][ LevelAndPassability[idx].ZoneArrayIndex ]
//
// The vanilla first runs a bridge branch when its fourth argument is true; the
// generator always passes false, so it is not modelled.
// ---------------------------------------------------------------------------
export function getMoveError(r: Rmg, coords: number, movementZone: number): number {
    // The vanilla indexes MapClass::MovementZones[nMovementZone] with no test at
    // all; that array holds thirteen tables, so the port only guards the ends.
    if (movementZone < 0 || movementZone >= 13)
        return 0;

    const idx = unpX(coords) + unpYS(coords) * (r.size.height + r.size.width + 1);
    let index = idx;
    if (index < 0)
        index = 0;
    else if (index >= r.levelAndPassability.length)
        index = r.levelAndPassability.length - 1;

    const zoneIndex = r.levelAndPassability[index]!.zoneArrayIndex;
    const table = r.movementZones[movementZone]!;
    if (zoneIndex < 0 || zoneIndex >= table.length)
        return 0;
    return table[zoneIndex]!;
}

// ---------------------------------------------------------------------------
// sub_56C510 (0x56c510 - 0x56cb8d) - the movement-zone rebuild.
// ---------------------------------------------------------------------------
export function rebuildMoveZones(r: Rmg): number {
    const count = r.levelAndPassability.length;
    if (count === 0)
        return 0;

    // The static 0x82A594 table lives on Rmg.zonePassability (13 rows of 8).
    for (let t = 0; t < 13; ++t) {
        if (r.zonePassability[t]!.length !== 8)
            r.zonePassability[t] = Uint8Array.from(K_ZONE_PASSABILITY[t]!);
    }

    // ---- 1. clear (0x56c522 - 0x56c5c8) -----------------------------------
    for (let i = 0; i < 256; ++i)
        r.zoneConnections[i]!.length = 0;
    for (let i = 0; i < count; ++i)
        r.levelAndPassability[i]!.zoneArrayIndex = 0; // 0x56c5ac, word at +2
    r.lastRecordedZone = 0;

    // The passability values are needed again at the tail, so keep a copy.
    if (r.passabilityCopy.length !== count)
        r.passabilityCopy = new Uint8Array(count);
    for (let i = 0; i < count; ++i)
        r.passabilityCopy[i] = lpPass(r, i);

    // ---- 2. stamp the zone numbers (0x56c5d0 - 0x56c6a4) ------------------
    // Zones count up from 1; the run length FillZoneFromRow returns is how far
    // to skip. A cell is "done" when its passability is the sentinel 7 or when
    // its zone field is already set.
    let zone = 1;
    let largestZone = 0;
    let largestRun = -1;
    for (let i = 0; i < count; ) {
        const done = lpPass(r, i) === 7 || lpZone(r, i) !== 0;
        if (done) {
            ++i;
            continue;
        }

        // The seed cell's passability is this zone's own passability; the flood
        // leaves byte 0 alone, so read it here.
        const zpv = r.zonePassabilityValue;
        while (zpv.length < zone + 1) zpv.push(0);
        if (zpv.length > zone + 1) zpv.length = zone + 1;
        zpv[zone] = lpPass(r, i);

        r.lastRecordedZone = 0;
        const covered = box(0);
        const run = fillZoneFromRow(r, { index: i }, zone, covered);

        if (run > largestRun) {
            largestRun = run;
            largestZone = zone;
        }
        ++zone;
        i += covered.v;
    }

    // ---- 3. the recorded borders ------------------------------------------
    // (MapClass::SubzoneTracking fold-in not modelled - the generator never
    // creates subzone tracking records.)

    // ---- 4. the thirteen move-error tables (0x56c8b0 - 0x56cfd0) ----------
    // 4a. Fill each row from the static table (1 = impassable, else walkable).
    // 4b. Merge the impassable zones over the ZoneConnections adjacency graph;
    //     components count from 2, walkable zones keep 1, slot 0 becomes -1.
    const adjacency: number[][] = new Array(zone);
    for (let i = 0; i < zone; ++i) adjacency[i] = [];
    for (let key = 0; key < 256; ++key) {
        const pairs = r.zoneConnections[key]!;
        for (let i = 0; i < pairs.length; ++i) {
            const lo = pairs[i]! & 0xFFFF;
            const hi = (pairs[i]! >> 16) & 0xFFFF;
            if (lo <= 0 || lo >= zone || hi <= 0 || hi >= zone)
                continue;
            adjacency[lo]!.push(hi);
            adjacency[hi]!.push(lo);
        }
    }

    for (let t = 0; t < 13; ++t) {
        const table = new Array<number>(zone).fill(0);
        for (let z = 1; z < zone; ++z) {
            const passability = r.zonePassabilityValue[z]!;
            table[z] = r.zonePassability[t]![passability & 7] !== 1 ? 1 : 0;
        }

        let group = 2;
        const stack: number[] = [];
        for (let z = 1; z < zone; ++z) {
            if (table[z] !== 0)
                continue;

            stack.length = 0;
            stack.push(z);
            table[z] = group;
            while (stack.length > 0) {
                const current = stack.pop()!;
                const neighbours = adjacency[current]!;
                for (let i = 0; i < neighbours.length; ++i) {
                    const n = neighbours[i]!;
                    if (table[n] !== 0)
                        continue;
                    table[n] = group;
                    stack.push(n);
                }
            }
            ++group;
        }

        table[0] = -1;
        r.movementZones[t] = table;
    }

    // ---- 5. the ZoneArrayIndex is already in place ------------------------

    return largestZone;
}

// ---------------------------------------------------------------------------
// RecordZonePair - one push into zoneConnections_.
//
//   key = (zone & 0xF) | (16 * (other & 0xF))
//   the vanilla walks the entry's pair list and writes only when absent, so the
//   table holds unique pairs. Both zone numbers are packed into one byte.
// ---------------------------------------------------------------------------
export function recordZonePair(r: Rmg, zone: number, other: number): void {
    const key = (zone & 0xF) | (16 * (other & 0xF));
    const value = zone | (other << 16);

    const table = r.zoneConnections[key]!;
    for (let i = 0; i < table.length; ++i) {
        if (table[i] === value)
            return;
    }
    table.push(value);
}

// ---------------------------------------------------------------------------
// sub_56CB90 (0x56cb90 - 0x56cfff) - the recursive scanline fill.
//
// `row` is a handle to one 4-byte LevelAndPassability record ({ index } into
// r.levelAndPassability); all C++ pointer arithmetic is in units of 4 bytes,
// i.e. cell records. The run this call owns is bounded by `west` and `east`;
// every cell in it is stamped with `zone`, and every border with a different
// zone is recorded through RecordZonePair.
//
//   - the westward grow tests |level difference| >= 2, the eastward grow >= 4;
//   - a row whose class byte is 6 treats any level as connected (wildcard).
// ---------------------------------------------------------------------------
export function fillZoneFromRow(r: Rmg, row: { index: number }, zone: number, out: Box<number>): number {
    const startZone = lpPass(r, row.index);
    const wildcardLevel = startZone === 6;
    let level = lpLevel(r, row.index);

    // ---- grow west (0x56cbb0) ---------------------------------------------
    let west = row.index;
    for (;;) {
        const diff = lpLevel(r, west) - level;
        if (diff >= 2 || diff <= -2)
            break;
        lpSetZone(r, west, zone);
        level = lpLevel(r, west);
        const prevZone = lpPass(r, west - 1);
        west -= 1;
        if (prevZone !== startZone)
            break;
    }

    let westLevel = level;

    // ---- record the west border (0x56cbe0) --------------------------------
    {
        const borderZone = lpZone(r, west);
        if (borderZone !== 0) {
            const diff = lpLevel(r, west) - westLevel;
            if (((diff < 2 && diff > -2) || wildcardLevel)
                && borderZone !== r.lastRecordedZone && borderZone !== zone) {
                recordZonePair(r, zone, borderZone);
                r.lastRecordedZone = borderZone;
            }
        }
    }

    // ---- grow east (0x56cc10) ---------------------------------------------
    let east = row.index;
    if (lpPass(r, row.index) === startZone) {
        let eastLevel = westLevel;
        do {
            const diff = lpLevel(r, east) - eastLevel;
            if (diff >= 4 || diff <= -4)
                break;
            lpSetZone(r, east, zone);
            eastLevel = lpLevel(r, east);
            east += 1;
            westLevel = eastLevel;
        } while (lpPass(r, east) === startZone);
    }

    // ---- record the east border -------------------------------------------
    {
        const borderZone = lpZone(r, east);
        if (borderZone !== 0) {
            const diff = lpLevel(r, east) - westLevel;
            if (((diff < 2 && diff > -2) || wildcardLevel)
                && borderZone !== r.lastRecordedZone && borderZone !== zone) {
                recordZonePair(r, zone, borderZone);
                r.lastRecordedZone = borderZone;
            }
        }
    }

    // ---- run extent and the two neighbouring rows -------------------------
    let runStart = east - west - 1;                     // v77
    out.v = east - row.index - 1;                       // a4

    const aboveWalk = west + 1;                         // v37
    const belowEnd = east - 1;                          // v38

    const rowSpan = r.size.height + r.size.width + 1;   // v39 (cells; C++: *4 bytes)
    const upStep = rowSpan + 1;                         // v40 (C++: rowSpan + 4 bytes)

    const belowStart = aboveWalk + rowSpan - 1;         // v85
    const aboveEnd = belowEnd + upStep;                 // v84
    const belowStop = belowEnd - rowSpan + 1;           // v87

    let aboveStart = aboveWalk - upStep;                // v41
    let aboveOut = 0;
    let belowOut = 0;

    // ---- walk the row above (0x56ccf0) ------------------------------------
    while (aboveStart <= belowStop) {
        const aboveZone = lpZone(r, aboveStart);

        // The cell of the row above that this cell is compared against: the one
        // straight up, or - near the row's right end - the one up-and-left.
        let abovePeer: number;
        if (aboveStart >= belowStop - 1)
            abovePeer = (aboveStart === belowStop - 1) ? aboveStart + rowSpan
                                                       : aboveStart + rowSpan - 1;
        else
            abovePeer = aboveStart + upStep;

        if (aboveZone !== 0) {
            if (aboveZone !== zone && aboveZone !== r.lastRecordedZone) {
                const diff = lpLevel(r, aboveStart) - lpLevel(r, abovePeer);
                if ((diff < 2 && diff > -2) || wildcardLevel) {
                    recordZonePair(r, zone, aboveZone);
                    r.lastRecordedZone = aboveZone;
                }
            }
        } else if (lpPass(r, aboveStart) === startZone) {
            const diff = lpLevel(r, aboveStart) - lpLevel(r, abovePeer);
            if (diff < 2 && diff > -2) {
                const aboveBox = box(0);
                runStart += fillZoneFromRow(r, { index: aboveStart }, zone, aboveBox);
                aboveOut = aboveBox.v;
                aboveStart += aboveOut;
                if (aboveStart > belowStop)
                    break;
                continue;
            }
        }
        aboveStart += 1;
    }

    // ---- walk the row below (0x56cf00) ------------------------------------
    // The walk ends at aboveEnd (vanilla's v84), not at belowEnd.
    let belowWalk = belowStart;
    while (belowWalk <= aboveEnd) {
        const belowZone = lpZone(r, belowWalk);

        // Mirror of the above-row peer: the cell straight down, or - near the
        // row's left end - the one down-and-right.
        let belowPeer: number;
        if (belowWalk >= belowEnd - 1) {
            const step = (belowWalk !== belowEnd - 1) ? upStep : rowSpan;
            belowPeer = belowWalk - step;
        } else {
            belowPeer = belowWalk - rowSpan + 1;
        }

        if (belowZone !== 0) {
            if (belowZone !== zone && belowZone !== r.lastRecordedZone) {
                const diff = lpLevel(r, belowWalk) - lpLevel(r, belowPeer);
                if ((diff < 2 && diff > -2) || wildcardLevel) {
                    recordZonePair(r, zone, belowZone);
                    r.lastRecordedZone = belowZone;
                }
            }
            belowWalk += 1;
        } else if (lpPass(r, belowWalk) === startZone
                   && lpLevel(r, belowWalk) - lpLevel(r, belowPeer) < 2
                   && lpLevel(r, belowWalk) - lpLevel(r, belowPeer) > -2) {
            const belowBox = box(0);
            runStart += fillZoneFromRow(r, { index: belowWalk }, zone, belowBox);
            belowOut = belowBox.v;
            belowWalk += belowOut;
        } else {
            belowWalk += 1;
        }
    }

    return runStart;
}

// ---------------------------------------------------------------------------
// RollGlobalOptions - the rolls sub_596300 makes when the random-map dialog's
// "start generation" button is pressed (WM_COMMAND id 0x621).
// Roll order (verified against the C++): flag010, n3, value020, value018,
// value03C, then the sub_597260 block (waterAmount, ruggedness,
// urbanPresence, accessibility, regionSize, [this[21] = 20*this[16] no draw],
// tiberiumLayout, vegetation) and finally seed04C.
// ---------------------------------------------------------------------------
const K_WATER_LO = [75, 0, 50, 0, 0];
const K_WATER_HI = [100, 25, 100, 100, 100];
const K_024_HI = [100, 100, 100, 0, 20];
// Tuned 2026-10-01 (user request) - non-cliff types 0/1/2 stay vanilla.
const K_027_LO = [0, 0, 0, 35, 30];
const K_027_HI = [100, 100, 100, 100, 55];
const K_028_LO = [50, 0, 35, 0, 0];
const K_028_HI = [100, 100, 100, 100, 50];

export function rollGlobalOptions(r: Rmg, seed: number): GlobalMapOptions {
    r.globalRng.seed(seed);

    const opt: GlobalMapOptions = {
        flag010: 0,
        n3: 0,
        value020: 0,
        value018: 0,
        value03C: 0,
        waterAmount: 0,
        ruggedness: 0,
        urbanPresence: 0,
        accessibility: 0,
        regionSize: 0,
        tiberiumLayout: 0,
        vegetation: 0,
        seed04C: 0,
    };
    opt.flag010 = r.globalRng.randomRanged(0, 100) < 50 ? 1 : 0;
    opt.n3 = r.globalRng.randomRanged(1, 4);
    opt.value020 = r.globalRng.randomRanged(0, 3);
    opt.value018 = r.globalRng.randomRanged(0, 3);
    opt.value03C = r.globalRng.randomRanged(0, 3);

    // ---- sub_597260(n3): the RMG option rolls (0x597282 - 0x597372) --------
    // Eight RandomRanged draws, in this exact order. this[21] = 20 * this[16]
    // sits between the fifth and the sixth and consumes none.
    const index = opt.n3 >= 0 && opt.n3 < 5 ? opt.n3 : 4;

    opt.waterAmount = r.globalRng.randomRanged(K_WATER_LO[index]!,
                                               K_WATER_HI[index]!);   // 0x597282
    opt.ruggedness = r.globalRng.randomRanged(20, 100);               // 0x59729f
    opt.urbanPresence = r.globalRng.randomRanged(0, K_024_HI[index]!); // 0x5972bc
    opt.accessibility = r.globalRng.randomRanged(K_027_LO[index]!,
                                                 K_027_HI[index]!);   // 0x5972d9
    opt.regionSize = r.globalRng.randomRanged(K_028_LO[index]!,
                                              K_028_HI[index]!);      // 0x5972f6
    // 0x59730b: this[21] = 20 * this[16] - no draw.

    opt.tiberiumLayout = r.globalRng.randomRanged(0, 100);            // 0x597313

    // this[23]: RMGVegetationMinimums / Maximums[n3], each clamped to 0..100
    // and with lo = min(lo, hi) (0x597322 - 0x597350).
    let vegLo = r.settings.vegetationMin(opt.n3);
    let vegHi = r.settings.vegetationMax(opt.n3);
    if (vegLo < 0) vegLo = 0; else if (vegLo > 100) vegLo = 100;
    if (vegHi < 0) vegHi = 0; else if (vegHi > 100) vegHi = 100;
    if (vegLo > vegHi) vegLo = vegHi;
    opt.vegetation = r.globalRng.randomRanged(vegLo, vegHi);          // 0x59736a

    opt.seed04C = r.globalRng.randomRanged(0, 0xFFFF);                // 0x59736d

    r.globalOptions = { ...opt };
    return opt;
}

// ---------------------------------------------------------------------------
// The stage body (0x598e9e - 0x598ebe): the retry loop.
// ---------------------------------------------------------------------------
export function createStartingPoints(r: Rmg): void {
    for (;;) {
        if (!selectStartingPointRegions(r))      // 0x598eab  sub_594B50
            continue;
        if (!paintStartingPointTerrain(r))       // 0x598eb6  sub_5A1FB0
            continue;
        break;
    }
}

// ---------------------------------------------------------------------------
// Step 1 - sub_594B50 (0x594B50 - 0x5953FF). Picks the regions the starting
// points sit in. Always answers true.
// ---------------------------------------------------------------------------
export function selectStartingPointRegions(r: Rmg): boolean {
    // ---- 1. movement zone (0x594b53 - 0x594b9b) ---------------------------
    //     nMovementZone[5] = { 5, 5, 5, 0, 0 }; selected = table[n3].
    const K_ZONE_TABLE = [5, 5, 5, 0, 0];
    const n3 = r.config.global.n3;
    const movementZone = K_ZONE_TABLE[n3 >= 0 && n3 < 5 ? n3 : 0]!;

    // ---- 2. the reference move error (0x594b62 - 0x594bb0) ----------------
    const largestZone = rebuildMoveZones(r);
    let referenceError = 0;
    if (movementZone >= 0 && movementZone < 13) {
        const table = r.movementZones[movementZone]!;
        if (largestZone >= 0 && largestZone < table.length)
            referenceError = table[largestZone]!;
    }

    // ---- 3. the region size floor -----------------------------------------
    //     number = HEIGHT * WIDTH * 0.03, floored at 400; minCells = (int).
    let number = r.size.height * r.size.width * 0.03;
    if (number < 400.0)
        number = 400.0;
    const minCells = F2I64(number);                 // F2I64 truncates

    // ---- 4. clear every region (0x594bc0, sub_58CE90) ---------------------
    {
        const side = r.size.workSide;
        const workCount = side * side;
        for (let idx = 0; idx < workCount; ++idx) {
            r.work.setI(idx, 14, -1);
            r.work.setI(idx, 15, -1);
        }
        for (let i = r.regions.length - 1; i >= 0; --i) {
            const region = r.regions[i]!;
            releaseRegionObject(r, region, true);
        }
        r.regionIdCounter = 0;
    }

    // ---- 5. seed one region per qualifying cell (0x594be0 - 0x594e00) -----
    {
        let diagInDiamond = 0;
        let diagPassable = 0;
        let diagMatchErr = 0;
        const it = new CellIterator();
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {
            const x = unpX(cell.mapCoords);
            const y = unpYS(cell.mapCoords);

            if (!r.cellExists(x, y))
                continue;
            ++diagInDiamond;
            if (cell.passability !== PASSABLE)
                continue;
            ++diagPassable;
            if (getMoveError(r, packXY(x, y), movementZone) !== referenceError)
                continue;
            ++diagMatchErr;

            if (r.work.i(x + r.size.workSide * y, 14) !== -1)
                continue;

            seedRegionFromCell(r, cell, movementZone, referenceError);
        }
        diag(`SP-CELLS inDiamond=${diagInDiamond} passable=${diagPassable} passableAndErrMatch=${diagMatchErr} refErr=${referenceError}`);
    }

    // 切断主因诊断：全菱形格按 Passability 类别计数；纯可通行格(Passable=0)
    // 里 GetMoveError 的取值分布。
    {
        const passHist = [0, 0, 0, 0, 0, 0, 0, 0];
        let errMatch = 0;
        let errOther = 0;
        const errOtherVals = new Array<number>(16).fill(0);
        const it = new CellIterator();
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {
            const x = unpX(cell.mapCoords);
            const y = unpYS(cell.mapCoords);
            if (!r.cellExists(x, y))
                continue;
            let pc = cell.passability;
            if (pc < 0 || pc > 7)
                pc = 7;
            ++passHist[pc]!;
            if (cell.passability === PASSABLE) {
                const e = getMoveError(r, packXY(x, y), movementZone);
                if (e === referenceError)
                    ++errMatch;
                else {
                    ++errOther;
                    if (e >= 0 && e < 16)
                        ++errOtherVals[e]!;
                }
            }
        }
        diag(`SP-PASS pass0=${passHist[0]} crush1=${passHist[1]} destroy2=${passHist[2]} beach3=${passHist[3]} water4=${passHist[4]} free5=${passHist[5]} impass6=${passHist[6]} outside7=${passHist[7]}`);
        let errDist = 'SP-ERRDIST';
        for (let e = 0; e < 16; ++e)
            if (errOtherVals[e]! > 0)
                errDist += ' e' + e + '=' + errOtherVals[e]!;
        diag(`${errDist} (passableErrMatch=${errMatch} passableErrOther=${errOther})`);
    }

    // ---- 6. cull the small regions (0x594e10 - 0x594e78) ------------------
    let seededRegions = 0;
    let maxSeenCells = 0;
    let hist200 = 0, hist300 = 0, hist400 = 0;
    for (let i = 0; i < r.regions.length; ++i) {
        const region = r.regions[i]!;
        ++seededRegions;
        const cc = region.cellCount;
        if (cc > maxSeenCells)
            maxSeenCells = cc;
        if (cc >= 200) ++hist200;
        if (cc >= 300) ++hist300;
        if (cc >= 400) ++hist400;
    }
    for (let i = r.regions.length - 1; i >= 0; --i) {
        const region = r.regions[i]!;
        if (region.cellCount < minCells)
            releaseRegionObject(r, region, true);
    }
    diag(`SP-SIZE maxRegionCells=${maxSeenCells}  >=200:${hist200} >=300:${hist300} >=400:${hist400}`);

    // 隔离带诊断：对"Passable 且 err=referenceError"的格按 8 邻域连通分块，
    // 再对最大 5 块统计其边界外侧相邻的非合格格类别。
    {
        const side = r.size.workSide;
        const K_DX = [0, 1, 1, 1, 0, -1, -1, -1];
        const K_DY = [-1, -1, 0, 1, 1, 1, 0, -1];

        const isGood = (x: number, y: number): boolean => {
            if (!r.cellExists(i16(x), i16(y)))
                return false;
            const c = r.cellAt(x, y);
            return c.passability === PASSABLE
                && getMoveError(r, packXY(i16(x), i16(y)), movementZone) === referenceError;
        };

        const blockOf = new Int32Array(side * side).fill(-1);
        const blockSize: number[] = [];
        for (let sy = 0; sy < side; ++sy) {
            for (let sx = 0; sx < side; ++sx) {
                const seedIdx = sx + side * sy;
                if (blockOf[seedIdx] !== -1 || !isGood(sx, sy))
                    continue;
                const bid = blockSize.length;
                blockSize.push(0);
                const st: number[] = [seedIdx];
                blockOf[seedIdx] = bid;
                while (st.length > 0) {
                    const idx = st.pop()!;
                    ++blockSize[bid]!;
                    const px = idx % side;
                    const py = Math.floor(idx / side);
                    for (let d = 0; d < 8; ++d) {
                        const nx = px + K_DX[d]!;
                        const ny = py + K_DY[d]!;
                        if (nx < 0 || ny < 0 || nx >= side || ny >= side)
                            continue;
                        const ni = nx + side * ny;
                        if (blockOf[ni] !== -1 || !isGood(nx, ny))
                            continue;
                        blockOf[ni] = bid;
                        st.push(ni);
                    }
                }
            }
        }

        const bySize: Array<{ bid: number; size: number }> = [];
        for (let bi = 0; bi < blockSize.length; ++bi)
            bySize.push({ bid: bi, size: blockSize[bi]! });
        msvcSort(bySize, (a, b) => a.size > b.size);

        for (let rank = 0; rank < 5 && rank < bySize.length; ++rank) {
            const bid = bySize[rank]!.bid;
            let nbBeach = 0, nbWater = 0, nbImpass = 0, nbE1 = 0, nbOut = 0, nbOther = 0;
            for (let idx = 0; idx < side * side; ++idx) {
                if (blockOf[idx] !== bid)
                    continue;
                const px = idx % side;
                const py = Math.floor(idx / side);
                for (let d = 0; d < 8; ++d) {
                    const nx = px + K_DX[d]!, ny = py + K_DY[d]!;
                    if (nx < 0 || ny < 0 || nx >= side || ny >= side) { ++nbOut; continue; }
                    if (!r.cellExists(i16(nx), i16(ny))) { ++nbOut; continue; }
                    const nc = r.cellAt(nx, ny);
                    if (isGood(nx, ny)) continue;          // 合格平地（块内/别的块）
                    if (nc.passability === BEACH) ++nbBeach;
                    else if (nc.passability === WATER) ++nbWater;
                    else if (nc.passability === IMPASSABLE) ++nbImpass;
                    else if (nc.passability === OUTSIDE_MAP) ++nbOut;
                    else if (nc.passability === PASSABLE) ++nbE1;
                    else ++nbOther;
                }
            }
            diag(`SP-BLOCK rank=${rank + 1} size=${bySize[rank]!.size} neighbours: beach=${nbBeach} water=${nbWater} impass=${nbImpass} otherFlat=${nbE1} outside=${nbOut} other=${nbOther}`);
        }
    }
    let survivingRegions = 0;
    for (let i = 0; i < r.regions.length; ++i)
        ++survivingRegions;
    diag(`SP-REGIONS n3=${n3} zone=${movementZone} refErr=${referenceError} minCells=${minCells} seeded=${seededRegions} surviving=${survivingRegions}`);

    // ---- 7. rank, select and split the starting-point budget --------------
    const selected: MapRegion[] = [];
    {
        // vanilla keeps at most 10 candidates (sub_5AD930(10))
        const ranked: Array<{ score: number; region: MapRegion }> = [];
        const regionCount = r.regions.length;
        for (let i = 0; i < r.regions.length; ++i) {
            const region = r.regions[i]!;
            const score = region.id + regionCount * (500000 - region.cellCount);
            ranked.push({ score, region });
        }
        ranked.sort((a, b) => a.score - b.score);       // stable_sort

        const take = ranked.length < 10 ? ranked.length : 10;
        for (let i = 0; i < take; ++i)
            selected.push(ranked[i]!.region);
    }

    {
        let total = 0;
        for (let i = 0; i < selected.length; ++i)
            total += selected[i]!.cellCount;

        const budget = r.config.playerCount;            // dword_ABE028 = NumPlayers
        let running = 0;
        let spent = 0;
        for (let i = 0; i < selected.length; ++i) {
            running += selected[i]!.cellCount;          // 0x5951xx: v21 += cellCount

            let share: number;
            if (i + 1 === selected.length) {
                share = budget - spent;                 // the last takes the rest
            } else {
                // F2I64(running / total * budget + 0.5 - spent); subtracting the
                // integer spent outside the truncation is the same thing.
                share = total > 0
                    ? F2I64(running / total * budget + 0.5) - spent
                    : 0;
            }
            selected[i]!.startingPoints = share;
            spent += share;
            diag(`SP-SELECT rank=${i} total=${total} budget=${budget} region id=${selected[i]!.id} cells=${selected[i]!.cellCount} share=${share}`);
        }
    }
    if (selected.length === 0)
        diag('SP-SELECT no region passed the size floor - budget cannot be assigned');

    // ---- 8. stamp the starting-point cells (0x5952xx, sub_594870) ---------
    let offset = 0;
    for (let i = 0; i < selected.length; ++i) {
        stampStartingPointCells(r, selected[i]!, offset);
        offset += selected[i]!.startingPoints;
    }
    r.startingPointCount = offset;

    // ---- 8b. 稳定出生点兜底：严格口径一个点都没放出来时，放宽重圈 ----------
    if (r.startingPoints.length === 0) {
        r.startpointRelaxedMove = true;
        diag('SP-RELAX strict pass produced 0 start points - reseeding on plain-passable ground');

        // 清场（同第 4 步）
        {
            const side2 = r.size.workSide;
            const workCount2 = side2 * side2;
            for (let idx = 0; idx < workCount2; ++idx) {
                r.work.setI(idx, 14, -1);
                r.work.setI(idx, 15, -1);
            }
            for (let i = r.regions.length - 1; i >= 0; --i)
                releaseRegionObject(r, r.regions[i]!, true);
            r.regionIdCounter = 0;
        }

        // 放宽播种：只要求在菱形内、无标记、纯可通行（flood 同样忽略移动分量）
        {
            const it = new CellIterator();
            it.reset(r.cellSlots, r.size.mapWidth);
            for (let cell = it.next(); cell !== null; cell = it.next()) {
                const x = unpX(cell.mapCoords);
                const y = unpYS(cell.mapCoords);
                if (!r.cellExists(x, y))
                    continue;
                if (r.work.i(x + r.size.workSide * y, 14) !== -1)
                    continue;
                if (cell.passability !== PASSABLE)
                    continue;
                seedRegionFromCell(r, cell, movementZone, referenceError);
            }
        }

        // 剔除小块：门槛取 min(400, 最大块大小)。
        let maxRelaxCells = 0;
        for (let i = 0; i < r.regions.length; ++i)
            if (r.regions[i]!.cellCount > maxRelaxCells)
                maxRelaxCells = r.regions[i]!.cellCount;
        const relaxFloor = maxRelaxCells < minCells ? maxRelaxCells : minCells;
        for (let i = r.regions.length - 1; i >= 0; --i) {
            const region = r.regions[i]!;
            if (region.cellCount < relaxFloor)
                releaseRegionObject(r, region, true);
        }
        diag(`SP-RELAX-FLOOR floor=${relaxFloor} maxSameLevelCells=${maxRelaxCells}`);

        // 排序取前 10
        const relaxedSelected: MapRegion[] = [];
        {
            const ranked: Array<{ score: number; region: MapRegion }> = [];
            const regionCount = r.regions.length;
            for (let i = 0; i < r.regions.length; ++i) {
                const region = r.regions[i]!;
                ranked.push({
                    score: region.id + regionCount * (500000 - region.cellCount),
                    region,
                });
            }
            ranked.sort((a, b) => a.score - b.score);   // stable_sort
            const take = ranked.length < 10 ? ranked.length : 10;
            for (let i = 0; i < take; ++i)
                relaxedSelected.push(ranked[i]!.region);
        }

        // 分名额：全部名额都给最大的那一块（主大陆），其余块名额为 0。
        {
            const budget = r.config.playerCount;
            for (let i = 0; i < relaxedSelected.length; ++i) {
                const share = i === 0 ? budget : 0;
                relaxedSelected[i]!.startingPoints = share;
                diag(`SP-RELAX-SELECT rank=${i} budget=${budget} region id=${relaxedSelected[i]!.id} cells=${relaxedSelected[i]!.cellCount} share=${share}${i === 0 ? ' (mainland, all players)' : ' (separated by water/cliff, 0)'}`);
            }
        }

        // 重放出生点（先清掉严格流程可能留下的空账与路标计数）
        r.startingPoints.length = 0;
        offset = 0;
        for (let i = 0; i < relaxedSelected.length; ++i) {
            stampStartingPointCells(r, relaxedSelected[i]!, offset);
            offset += relaxedSelected[i]!.startingPoints;
        }
        r.startingPointCount = offset;
        diag(`SP-RELAX done: regions=${relaxedSelected.length} startPoints=${r.startingPoints.length}`);

        r.startpointRelaxedMove = false;
    }

    // ---- 9. the zero-share fallback (0x5953xx) ----------------------------
    // When n3 == 0 every region that ended up with no point gets one more chance
    // on a coin flip. n3 is 1..3 here (never 0) on the dialog path.
    if (n3 === 0) {
        for (let i = 0; i < selected.length; ++i) {
            if (selected[i]!.startingPoints === 0
                && r.rng.unit() < 0.5) {
                giveRegionATechBuilding(r, selected[i]!);   // sub_595400
            }
        }
    }

    // ---- 10. 出生点连通性保证（端口定制）-----------------------------------
    ensureStartingPointsConnected(r);

    return true;
}

// ---------------------------------------------------------------------------
// IsCliffClearAround [port-only] - no slope tile, no impassable cliff wall and
// no |level| >= 2 terrace inside the radius square around the anchor.
// ---------------------------------------------------------------------------
export function isCliffClearAround(r: Rmg, anchor: number, radius: number): boolean {
    const anchorX = unpX(anchor);
    const anchorY = unpYS(anchor);
    if (!r.cellExists(anchorX, anchorY))
        return false;
    const baseLevel = r.cellAt(anchorX, anchorY).level;

    for (let cy = anchorY - radius; cy <= anchorY + radius; ++cy) {
        for (let cx = anchorX - radius; cx <= anchorX + radius; ++cx) {
            const ax = i16(cx);
            const ay = i16(cy);
            if (!r.cellExists(ax, ay))
                continue;
            const q = r.cellAt(ax, ay);
            const diff = q.level - baseLevel;
            if (q.slopeIndex !== 0
                || q.passability === IMPASSABLE
                || diff >= 2 || diff <= -2) {
                return false;
            }
        }
    }
    return true;
}

// ---------------------------------------------------------------------------
// BuildCoastalDistance [port-only]
//
//   1. flood the open sea: Water cells touching the map rim (the OutsideMap
//      ring outside IsWithinUsableArea), orthogonal flood over Water only.
//   2. multi-source BFS over walkable land (Passable/Beach; same level, or a
//      real slope tile for a +-1 step) seeded from the land touching the sea;
//      record each reachable cell's step distance to the coast.
//
// Open-sea cells get 0, land next to the sea gets 1; unreachable stays -1.
// ---------------------------------------------------------------------------
export function buildCoastalDistance(r: Rmg): number[] {
    const side = r.size.workSide;
    const total = side * side;
    const K_DX = [0, 1, 0, -1];
    const K_DY = [-1, 0, 1, 0];

    const sea = new Uint8Array(total);
    const distance: number[] = new Array<number>(total).fill(-1);
    const queue: number[] = [];

    // ---- 1. 外海泛洪（只走水格，且必须贴着地图外圈 OutsideMap）-------------
    {
        const it = new CellIterator();
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {
            if (cell.passability !== WATER)
                continue;
            const x = cell.mapCoords & 0xffff;
            const y = cell.mapCoords >>> 16;
            let onRim = false;
            for (let d = 0; d < 4 && !onRim; ++d) {
                const nx = i16(x + K_DX[d]!);
                const ny = i16(y + K_DY[d]!);
                if (!r.cellExists(nx, ny))
                    continue;
                if (r.cellAt(nx, ny).passability === OUTSIDE_MAP)
                    onRim = true;
            }
            if (!onRim)
                continue;
            const idx = x + side * y;
            if (sea[idx] !== 0)
                continue;
            sea[idx] = 1;
            queue.push(idx);
        }
    }

    for (let head = 0; head < queue.length; ++head) {
        const idx = queue[head]!;
        const x = idx % side;
        const y = Math.floor(idx / side);
        for (let d = 0; d < 4; ++d) {
            const nx = i16(x + K_DX[d]!);
            const ny = i16(y + K_DY[d]!);
            if (!r.cellExists(nx, ny))
                continue;
            const nidx = nx + side * ny;
            if (sea[nidx] !== 0 || r.cellAt(nx, ny).passability !== WATER)
                continue;
            sea[nidx] = 1;
            queue.push(nidx);
        }
    }
    const seaCells = queue.length;

    // 找不到外海（极端情况：整图无水）时返回空表，本轮不启用靠海约束。
    if (seaCells === 0) {
        diag('SP-COAST seaCells=0 - coastal constraint skipped this round');
        return [];
    }

    // ---- 2. 陆军步数 BFS：种子 = 贴着外海的可走陆格 ------------------------
    queue.length = 0;
    const walkableLand = (c: MapCell | null): boolean =>
        c !== null
        && (c.passability === PASSABLE || c.passability === BEACH);

    {
        const seedIt = new CellIterator();
        seedIt.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = seedIt.next(); cell !== null; cell = seedIt.next()) {
            const x = cell.mapCoords & 0xffff;
            const y = cell.mapCoords >>> 16;
            if (!walkableLand(cell))
                continue;
            for (let d = 0; d < 4; ++d) {
                const nx = i16(x + K_DX[d]!);
                const ny = i16(y + K_DY[d]!);
                if (!r.cellExists(nx, ny) || sea[nx + side * ny] === 0)
                    continue;
                const idx = x + side * y;
                if (distance[idx]! >= 0)
                    break;
                distance[idx] = 1;
                queue.push(idx);
                break;
            }
        }
    }

    for (let head = 0; head < queue.length; ++head) {
        const idx = queue[head]!;
        const x = idx % side;
        const y = Math.floor(idx / side);
        const a = r.cellAt(x, y);
        for (let d = 0; d < 4; ++d) {
            const nx = i16(x + K_DX[d]!);
            const ny = i16(y + K_DY[d]!);
            if (!r.cellExists(nx, ny))
                continue;
            const b = r.cellAt(nx, ny);
            if (!walkableLand(b))
                continue;
            const diff = b.level - a.level;
            if (diff !== 0
                && !((diff === 1 || diff === -1)
                     && (a.slopeIndex !== 0 || b.slopeIndex !== 0)))
                continue;
            const nidx = nx + side * ny;
            if (distance[nidx]! >= 0)
                continue;
            distance[nidx] = distance[idx]! + 1;
            queue.push(nidx);
        }
    }

    diag(`SP-COAST seaCells=${seaCells} walkable=${queue.length >>> 0}`);
    return distance;
}

// ---------------------------------------------------------------------------
// [port-only] shared land-component flood: the army-land walkability the
// relocation machinery uses (Passable/Beach; same level joins directly, a
// +-1 step needs a real slope tile on either cell, >= 2 never joins).
// Orthogonal adjacency only.
// ---------------------------------------------------------------------------
const K_DX4 = [0, 1, 0, -1];
const K_DY4 = [-1, 0, 1, 0];

function isWalkableLand(c: MapCell | null): boolean {
    return c !== null
        && (c.passability === PASSABLE || c.passability === BEACH);
}

function landEdge(r: Rmg, a: MapCell, nx: number, ny: number): boolean {
    const side = r.size.workSide;
    if (nx < 0 || ny < 0 || nx >= side || ny >= side)
        return false;
    if (!r.cellExists(i16(nx), i16(ny)))
        return false;
    const b = r.cellAt(nx, ny);
    if (!isWalkableLand(b))
        return false;
    const d = b.level - a.level;
    if (d === 0)
        return true;
    if (d === 1 || d === -1)
        return a.slopeIndex !== 0 || b.slopeIndex !== 0;
    return false;
}

function floodLandComponents(r: Rmg): { compOf: Int32Array; compCells: number[][] } {
    const side = r.size.workSide;
    const compOf = new Int32Array(side * side).fill(-1);
    const compCells: number[][] = [];
    for (let sy = 0; sy < side; ++sy) {
        for (let sx = 0; sx < side; ++sx) {
            const seedIdx = sx + side * sy;
            if (compOf[seedIdx] !== -1)
                continue;
            if (!r.cellExists(i16(sx), i16(sy)))
                continue;
            const seed = r.cellAt(sx, sy);
            if (!isWalkableLand(seed))
                continue;

            const cid = compCells.length;
            compCells.push([]);
            const st: number[] = [seedIdx];
            compOf[seedIdx] = cid;
            while (st.length > 0) {
                const idx = st.pop()!;
                const px = idx % side;
                const py = Math.floor(idx / side);
                compCells[cid]!.push(packXY(px, py));
                const cur = r.cellAt(px, py);
                for (let dir = 0; dir < 4; ++dir) {
                    const nx = px + K_DX4[dir]!;
                    const ny = py + K_DY4[dir]!;
                    if (nx < 0 || ny < 0 || nx >= side || ny >= side)
                        continue;
                    const ni = nx + side * ny;
                    if (compOf[ni] !== -1)
                        continue;
                    if (landEdge(r, cur, nx, ny)) {
                        compOf[ni] = cid;
                        st.push(ni);
                    }
                }
            }
        }
    }
    return { compOf, compCells };
}

/** [port-only] the shared "clear old points, write the new ones" tail. */
function writeRelocatedStartPoints(r: Rmg, picks: number[], players: number): void {
    for (let i = 0; i < r.startingPoints.length; ++i) {
        const old = r.cellAt(unpX(r.startingPoints[i]!.coords),
                             unpYS(r.startingPoints[i]!.coords));
        old.cellFlags = old.cellFlags & ~CELL_FLAG_START_POINT;
    }
    r.startingPoints.length = 0;
    while (r.waypoints.length < 702)
        r.waypoints.push(0);
    for (let i = 0; i < players; ++i) {
        const c = picks[i]!;
        r.waypoints[i] = c;
        r.cellAt(unpX(c), unpYS(c)).cellFlags |= CELL_FLAG_START_POINT;
        r.startingPoints.push({ index: i, coords: c });
    }
    r.startingPointCount = players;
}

/** [port-only] the farthest pair + greedy farthest spread (variants of
 * RelocateStartingPointsLandConnected / EnsureStartingPointsConnected). */
function spreadFarthest(r: Rmg, candidates: number[], players: number): number[] {
    void r;
    const picks: number[] = [];
    let bi = -1, bj = -1;
    let bd = -1.0;
    for (let i = 0; i + 1 < candidates.length; ++i)
        for (let j = i + 1; j < candidates.length; ++j) {
            const dx = unpX(candidates[i]!) - unpX(candidates[j]!);
            const dy = unpYS(candidates[i]!) - unpYS(candidates[j]!);
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > bd) { bd = d; bi = i; bj = j; }
        }
    if (bi >= 0) {
        picks.push(candidates[bi]!);
        picks.push(candidates[bj]!);
    }
    while (picks.length < players) {
        let ci = -1;
        let bestMin = -1.0;
        for (let i = 0; i < candidates.length; ++i) {
            let mn = 1e18;
            for (let j = 0; j < picks.length; ++j) {
                const dx = unpX(candidates[i]!) - unpX(picks[j]!);
                const dy = unpYS(candidates[i]!) - unpYS(picks[j]!);
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < mn) mn = d;
            }
            if (mn > bestMin) { bestMin = mn; ci = i; }
        }
        if (ci < 0) break;
        picks.push(candidates[ci]!);
    }
    return picks;
}

// ---------------------------------------------------------------------------
// RelocateStartingPointsLandConnected [port-only] - one landmass, points may
// sit on different terraces as long as real ramps connect them.
// ---------------------------------------------------------------------------
export function relocateStartingPointsLandConnected(r: Rmg, players: number): boolean {
    const side = r.size.workSide;

    const { compOf, compCells } = floodLandComponents(r);

    if (compCells.length === 0)
        return false;

    // ---- 选陆块：原点全在同一块就锁定它，否则取最大块 ----------------------
    let target = -1;
    let originComp = -1;
    let allSame = true;
    for (let i = 0; i < r.startingPoints.length; ++i) {
        const c = r.startingPoints[i]!.coords;
        const cid = r.cellExists(unpX(c), unpYS(c)) ? compOf[unpX(c) + side * unpYS(c)]! : -1;
        if (cid < 0) { allSame = false; break; }
        if (originComp < 0) originComp = cid;
        else if (cid !== originComp) allSame = false;
    }
    if (allSame && originComp >= 0)
        target = originComp;
    else
        for (let i = 0; i < compCells.length; ++i)
            if (target < 0 || compCells[i]!.length > compCells[target]!.length)
                target = i;

    const land = compCells[target]!;

    // 陆块的高程跨度（日志用）
    let loLevel = 1000, hiLevel = -1000;
    for (let i = 0; i < land.length; ++i) {
        const lv = r.cellAt(unpX(land[i]!), unpYS(land[i]!)).level;
        if (lv < loLevel) loLevel = lv;
        if (lv > hiLevel) hiLevel = lv;
    }
    diag(`SP-LAND components=${compCells.length >>> 0} target=${target} cells=${land.length} levelSpan=${loLevel}..${hiLevel} originsSame=${allSame ? 'YES' : 'NO'}`);

    // ---- 枚举陆块内全部可放点 ----------------------------------------------
    const kCliffClear = 4;
    const visX = K_VISIBLE_OFFSET_X + 4;
    const visY = K_VISIBLE_OFFSET_Y + 4;
    const visW = r.size.width - 8;
    const visH = r.size.height - 8;
    const needCoastal = r.config.landType === LandType.Continent;
    let coastalDist: number[] = [];
    if (needCoastal)
        coastalDist = buildCoastalDistance(r);
    const candidates: number[] = [];
    for (let i = 0; i < land.length; ++i) {
        const picked = land[i]!;
        const c = r.cellAt(unpX(picked), unpYS(picked));
        // 锚点必须是纯可通行（Beach 只能当路面不能摆基地车），且自身是平格。
        if (c.passability !== PASSABLE || c.slopeIndex !== 0)
            continue;
        // 6x6 同高净空。
        if (!tileRectLevelClear(r, unpX(picked) - 3, unpYS(picked) - 3, 6, 6, false))
            continue;
        if (!isWithinUsableRect(r, picked, true, visX, visY, visW, visH))
            continue;

        // 悬崖缓冲圈。
        if (!isCliffClearAround(r, picked, kCliffClear))
            continue;

        // 靠海硬约束。coastalDist 为空表示本轮没圈到外海（约束自动失效）。
        if (needCoastal && coastalDist.length !== 0) {
            const steps = coastalDist[unpX(picked) + side * unpYS(picked)]!;
            if (steps < 1 || steps > K_COASTAL_STEPS)
                continue;
        }

        candidates.push(picked);
    }
    if (candidates.length < players) {
        diag(`SP-LAND component cells=${land.length} only ${candidates.length} flat clear spots for ${players} players - fallback to same-level plane`);
        return false;
    }

    // ---- 几何最远对 + 贪心最远分散 -----------------------------------------
    const picks = spreadFarthest(r, candidates, players);
    if (picks.length < players) {
        diag(`SP-LAND could only spread ${picks.length}/${players} - fallback to same-level plane`);
        return false;
    }

    // ---- 清旧点写新点（路标索引 0..players-1 连续）------------------------
    writeRelocatedStartPoints(r, picks, players);

    diag(`SP-LAND relocated ${players} points across one landmass cells=${land.length} levels=${loLevel}..${hiLevel}`);
    for (let i = 0; i < players; ++i)
        diag(`SP-LAND pt${i}=(${unpX(picks[i]!)},${unpYS(picks[i]!)}) L${r.cellAt(unpX(picks[i]!), unpYS(picks[i]!)).level}`);
    return true;
}

// ---------------------------------------------------------------------------
// RelocateStartingPointsTwoIslands [port-only] - TeamContinent: split the
// players evenly over the two largest landmasses (no land-connectedness rule).
// ---------------------------------------------------------------------------
export function relocateStartingPointsTwoIslands(r: Rmg, players: number): boolean {
    const side = r.size.workSide;

    const { compCells } = floodLandComponents(r);

    if (compCells.length < 2) {
        diag(`SP-TEAM only ${compCells.length} landmass(es) - fallback`);
        return false;
    }

    // ---- 取两个最大的陆块 --------------------------------------------------
    const isl = [-1, -1];
    for (let i = 0; i < compCells.length; ++i) {
        const cellCount = compCells[i]!.length;
        if (isl[0]! < 0
            || cellCount > compCells[isl[0]!]!.length) {
            isl[1] = isl[0]!;
            isl[0] = i;
        } else if (isl[1]! < 0
                   || cellCount > compCells[isl[1]!]!.length) {
            isl[1] = i;
        }
    }
    if (isl[1]! < 0) {
        diag('SP-TEAM cannot find two landmasses - fallback');
        return false;
    }

    // 外接框左上角（用于给两岛定序：先上后左）。
    const boxMin = (id: number): number => {
        let minX = 0x7FFFFFFF;
        let minY = 0x7FFFFFFF;
        const cells = compCells[id]!;
        for (let i = 0; i < cells.length; ++i) {
            const cx = unpX(cells[i]!);
            const cy = unpYS(cells[i]!);
            if (cx < minX) minX = cx;
            if (cy < minY) minY = cy;
        }
        return packXY(minX, minY);
    };
    const top0 = boxMin(isl[0]!);
    const top1 = boxMin(isl[1]!);
    if (unpYS(top1) < unpYS(top0)
        || (unpYS(top1) === unpYS(top0) && unpX(top1) < unpX(top0))) {
        const swap = isl[0]!;
        isl[0] = isl[1]!;
        isl[1] = swap;
    }

    const firstCount = Math.trunc((players + 1) / 2);
    const secondCount = players - firstCount;

    const kCliffClear = 4;
    const visX = K_VISIBLE_OFFSET_X + 4;
    const visY = K_VISIBLE_OFFSET_Y + 4;
    const visW = r.size.width - 8;
    const visH = r.size.height - 8;

    // 靠海距离表（与大岛屿共用；为空表示本轮没圈到外海，约束自动失效）。
    const coastalDist = buildCoastalDistance(r);

    // 在某块岛内挑 count 个点。
    const spreadOnIsland = (island: number[], count: number, out: number[]): boolean => {
        const candidates: number[] = [];
        for (let i = 0; i < island.length; ++i) {
            const picked = island[i]!;
            const c = r.cellAt(unpX(picked), unpYS(picked));
            if (c.passability !== PASSABLE || c.slopeIndex !== 0)
                continue;
            if (!tileRectLevelClear(r, unpX(picked) - 3, unpYS(picked) - 3, 6, 6, false))
                continue;
            if (!isWithinUsableRect(r, picked, true, visX, visY, visW, visH))
                continue;
            if (!isCliffClearAround(r, picked, kCliffClear))
                continue;
            if (coastalDist.length !== 0) {
                const steps =
                    coastalDist[unpX(picked) + side * unpYS(picked)]!;
                if (steps < 1 || steps > K_COASTAL_STEPS)
                    continue;
            }
            candidates.push(picked);
        }
        if (candidates.length < count)
            return false;

        const local: number[] = [];
        if (count >= 2) {
            let bi = -1, bj = -1;
            let bd = -1.0;
            for (let i = 0; i + 1 < candidates.length; ++i)
                for (let j = i + 1; j < candidates.length; ++j) {
                    const dx = unpX(candidates[i]!) - unpX(candidates[j]!);
                    const dy = unpYS(candidates[i]!) - unpYS(candidates[j]!);
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d > bd) { bd = d; bi = i; bj = j; }
                }
            local.push(candidates[bi]!);
            local.push(candidates[bj]!);
        } else {
            local.push(candidates[0]!);
        }
        while (local.length < count) {
            let ci = -1;
            let bestMin = -1.0;
            for (let i = 0; i < candidates.length; ++i) {
                let mn = 1e18;
                for (let j = 0; j < local.length; ++j) {
                    const dx = unpX(candidates[i]!) - unpX(local[j]!);
                    const dy = unpYS(candidates[i]!) - unpYS(local[j]!);
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d < mn) mn = d;
                }
                if (mn > bestMin) { bestMin = mn; ci = i; }
            }
            if (ci < 0)
                break;
            local.push(candidates[ci]!);
        }
        if (local.length < count)
            return false;

        for (const c of local) out.push(c);
        return true;
    };

    const picks: number[] = [];
    if (!spreadOnIsland(compCells[isl[0]!]!, firstCount, picks)
        || !spreadOnIsland(compCells[isl[1]!]!, secondCount, picks)) {
        diag(`SP-TEAM islands cells=${compCells[isl[0]!]!.length}/${compCells[isl[1]!]!.length} cannot host ${firstCount}+${secondCount} players - fallback`);
        return false;
    }

    // ---- 清旧点写新点（路标索引 0..players-1 连续）------------------------
    writeRelocatedStartPoints(r, picks, players);

    diag(`SP-TEAM split ${players} points over two landmasses (${firstCount}+${secondCount}) cells=${compCells[isl[0]!]!.length}/${compCells[isl[1]!]!.length}`);
    for (let i = 0; i < players; ++i)
        diag(`SP-TEAM pt${i}=(${unpX(picks[i]!)},${unpYS(picks[i]!)}) island=${i < firstCount ? 0 : 1}`);
    return true;
}

// ---------------------------------------------------------------------------
// RelocateStartingPointsOneIslandEach [port-only] - Archipelago: exactly one
// starting point on each of the min(players, islands) largest islands.
// ---------------------------------------------------------------------------
export function relocateStartingPointsOneIslandEach(r: Rmg, players: number): boolean {
    const side = r.size.workSide;

    const { compCells } = floodLandComponents(r);

    if (compCells.length < players) {
        diag(`SP-ARCH only ${compCells.length} landmass(es) < ${players} players - fallback`);
        return false;
    }

    // ---- 按格子数从大到小挑出前 players 块岛 ------------------------------
    const used = new Uint8Array(compCells.length);
    const order: number[] = [];
    for (let k = 0; k < players; ++k) {
        let best = -1;
        for (let i = 0; i < compCells.length; ++i) {
            if (used[i] !== 0)
                continue;
            if (best < 0
                || compCells[i]!.length > compCells[best]!.length) {
                best = i;
            }
        }
        used[best] = 1;
        order.push(best);
    }

    const kCliffClear = 4;
    const visX = K_VISIBLE_OFFSET_X + 4;
    const visY = K_VISIBLE_OFFSET_Y + 4;
    const visW = r.size.width - 8;
    const visH = r.size.height - 8;

    const commonAnchor = (picked: number): boolean => {
        const c = r.cellAt(unpX(picked), unpYS(picked));
        return c.passability === PASSABLE
            && c.slopeIndex === 0
            && tileRectLevelClear(r, unpX(picked) - 3, unpYS(picked) - 3, 6, 6, false)
            && isWithinUsableRect(r, picked, true, visX, visY, visW, visH)
            && isCliffClearAround(r, picked, kCliffClear);
    };

    // ---- 每岛恰好一个点 ----------------------------------------------------
    const picks: number[] = [];
    for (let k = 0; k < players; ++k) {
        const island = compCells[order[k]!]!;

        let chosen = island[0]!;
        let found = false;

        for (let i = 0; i < island.length && !found; ++i) {
            if (commonAnchor(island[i]!)) {
                chosen = island[i]!;
                found = true;
            }
        }
        for (let i = 0; i < island.length && !found; ++i) {
            // 放宽一档：可通行 + 自身平 + 在可见区内。
            const c = r.cellAt(unpX(island[i]!), unpYS(island[i]!));
            if (c.passability === PASSABLE && c.slopeIndex === 0
                && isWithinUsableRect(r, island[i]!, true, visX, visY, visW, visH)) {
                chosen = island[i]!;
                found = true;
            }
        }
        for (let i = 0; i < island.length && !found; ++i) {
            // 再放宽一档：只要是能站人的陆地格。
            const c = r.cellAt(unpX(island[i]!), unpYS(island[i]!));
            if (c.passability === PASSABLE) {
                chosen = island[i]!;
                found = true;
            }
        }
        if (!found) {
            diag(`SP-ARCH island ${order[k]!} cells=${island.length} has no anchor - fallback`);
            return false;
        }
        picks.push(chosen);
    }

    // ---- 清旧点写新点（路标索引 0..players-1 连续）------------------------
    writeRelocatedStartPoints(r, picks, players);

    diag(`SP-ARCH one point per island: ${players} points over ${compCells.length} landmasses`);
    for (let i = 0; i < players; ++i)
        diag(`SP-ARCH pt${i}=(${unpX(picks[i]!)},${unpYS(picks[i]!)}) island=${order[i]!}`);
    return true;
}

// ---------------------------------------------------------------------------
// EnsureStartingPointsConnected [port-only] - dispatch to the per-land-type
// relocation machinery, then fall back to the same-level orthogonal plane.
// ---------------------------------------------------------------------------
export function ensureStartingPointsConnected(r: Rmg): void {
    const players = r.config.playerCount;
    if (players <= 1 || r.startingPoints.length <= 1)
        return;   // 0/1 个点谈不上互相连通

    // 群岛（Archipelago）：一岛一点。
    const landType = r.config.landType;
    if (landType === LandType.Archipelago
        && relocateStartingPointsOneIslandEach(r, players)) {
        return;
    }

    // 大岛屿群（TeamContinent）：两岛均分，不做陆地连通要求。
    if (landType === LandType.TeamContinent
        && relocateStartingPointsTwoIslands(r, players)) {
        return;
    }

    // 大岛屿/内陆/山地：彼此可经真实斜坡陆路连通即可。
    if ((landType === LandType.Continent
         || landType === LandType.Inland
         || landType === LandType.Mountainous)
        && relocateStartingPointsLandConnected(r, players)) {
        return;
    }

    const side = r.size.workSide;

    // ---- 同高正交连通分块 ------------------------------------------------
    const blockOf = new Int32Array(side * side).fill(-1);
    const blockCells: number[][] = [];
    for (let sy = 0; sy < side; ++sy) {
        for (let sx = 0; sx < side; ++sx) {
            const seedIdx = sx + side * sy;
            if (blockOf[seedIdx] !== -1)
                continue;
            if (!r.cellExists(i16(sx), i16(sy)))
                continue;
            const seed = r.cellAt(sx, sy);
            if (seed.passability !== PASSABLE)
                continue;

            const level = seed.level;
            const bid = blockCells.length;
            blockCells.push([]);
            const st: number[] = [seedIdx];
            blockOf[seedIdx] = bid;
            while (st.length > 0) {
                const idx = st.pop()!;
                const px = idx % side;
                const py = Math.floor(idx / side);
                blockCells[bid]!.push(packXY(px, py));
                for (let d = 0; d < 4; ++d) {
                    const nx = px + K_DX4[d]!;
                    const ny = py + K_DY4[d]!;
                    if (nx < 0 || ny < 0 || nx >= side || ny >= side)
                        continue;
                    const ni = nx + side * ny;
                    if (blockOf[ni] !== -1)
                        continue;
                    if (!r.cellExists(i16(nx), i16(ny)))
                        continue;
                    const nc = r.cellAt(nx, ny);
                    if (nc.passability !== PASSABLE
                        || nc.level !== level)
                        continue;
                    blockOf[ni] = bid;
                    st.push(ni);
                }
            }
        }
    }

    // ---- 记录原点是否已连通（仅用于日志）----------------------------------
    let commonBlock = -1;
    let allSame = true;
    for (let i = 0; i < r.startingPoints.length; ++i) {
        const c = r.startingPoints[i]!.coords;
        if (!r.cellExists(unpX(c), unpYS(c))) {
            allSame = false;
            break;
        }
        const b = blockOf[unpX(c) + side * unpYS(c)]!;
        if (b < 0) {
            allSame = false;
            break;
        }
        if (commonBlock < 0)
            commonBlock = b;
        else if (b !== commonBlock)
            allSame = false;
    }
    diag(`SP-CONNECT original points connected=${allSame ? 'YES' : 'NO'} (block cells=${commonBlock >= 0 ? blockCells[commonBlock]!.length : 0}) - spreading to maximize distance`);

    // ---- 选定用来放全部玩家的连通平面 ------------------------------------
    let best = -1;
    if (allSame && commonBlock >= 0
        && blockCells[commonBlock]!.length >= players) {
        best = commonBlock;
    } else {
        for (let b = 0; b < blockCells.length; ++b)
            if (blockCells[b]!.length >= players
                && (best < 0
                    || blockCells[b]!.length > blockCells[best]!.length))
                best = b;
    }
    if (best < 0) {
        diag(`SP-CONNECT no single same-level plane holds ${players} players - leaving points as-is`);
        return;
    }

    const plane = blockCells[best]!;
    const planeLevel = r.cellAt(unpX(plane[0]!), unpYS(plane[0]!)).level;

    // ---- 枚举平面内全部 6x6 净地格作为候选（不随机限量）------------------
    const visX = K_VISIBLE_OFFSET_X + 4;
    const visY = K_VISIBLE_OFFSET_Y + 4;
    const visW = r.size.width - 8;
    const visH = r.size.height - 8;
    const kCliffClear = 4;
    const needCoastal = r.config.landType === LandType.Continent
        || r.config.landType === LandType.TeamContinent;
    let coastalDist: number[] = [];
    if (needCoastal)
        coastalDist = buildCoastalDistance(r);
    const candidates: number[] = [];
    const cellCount = plane.length;
    for (let i = 0; i < cellCount; ++i) {
        const picked = plane[i]!;
        if (!tileRectClear(r, unpX(picked) - 3, unpYS(picked) - 3, 6, 6, false, false))
            continue;
        if (!isWithinUsableRect(r, picked, true, visX, visY, visW, visH))
            continue;
        if (!isCliffClearAround(r, picked, kCliffClear))
            continue;
        // 靠海硬约束（大岛屿）。
        if (needCoastal && coastalDist.length !== 0) {
            const steps = coastalDist[unpX(picked) + side * unpYS(picked)]!;
            if (steps < 1 || steps > K_COASTAL_STEPS)
                continue;
        }
        candidates.push(picked);
    }
    if (candidates.length < players) {
        diag(`SP-CONNECT plane L${planeLevel} cells=${cellCount} only ${candidates.length} clear spots - leaving points as-is`);
        return;
    }

    // ---- 最远分散选 players 个 -------------------------------------------
    const picks = spreadFarthest(r, candidates, players);
    if (picks.length < players) {
        diag(`SP-CONNECT could only spread ${picks.length}/${players} on plane L${planeLevel} - leaving points as-is`);
        return;
    }

    // ---- 清旧点写新点（路标索引 0..players-1 连续）-----------------------
    writeRelocatedStartPoints(r, picks, players);

    diag(`SP-CONNECT relocated ${players} points onto one same-level plane L${planeLevel} cells=${cellCount}`);
    for (let i = 0; i < players; ++i)
        diag(`SP-CONNECT pt${i}=(${unpX(picks[i]!)},${unpYS(picks[i]!)})`);
}

// ---------------------------------------------------------------------------
// sub_594420 (0x594420 - 0x59486F) - grow one region out of a seed cell.
// The mark is stamped into data[15] on DISCOVERY and into data[14] on POP, so
// a cell that is already queued is never queued twice. No RNG is consumed.
// ---------------------------------------------------------------------------
const K_DIR_X8 = [0, 1, 1, 1, 0, -1, -1, -1];
const K_DIR_Y8 = [-1, -1, 0, 1, 1, 1, 0, -1];

export function seedRegionFromCell(r: Rmg, seedCell: MapCell, movementZone: number,
                                   referenceError: number): void {
    if (seedCell === null || r.work.count === 0)
        return;

    const side = r.size.workSide;

    const region = createRegionRecord(r, seedCell.mapCoords);      // 0x59442e
    const mark = region.id;                                        // 0x59444b

    const seedPacked = seedCell.mapCoords;
    const seedX = unpX(seedPacked);
    const seedY = unpYS(seedPacked);

    r.work.setI(seedX + side * seedY, 15, mark);                   // 0x594498

    const pending: number[] = [packXY(seedX, seedY)];              // 0x5944e0

    // 连通判据严格沿用游戏自己的移动分量（与原版 sub_594420 完全一致）。
    while (pending.length > 0) {
        const cur = pending.pop()!;                                // 0x594503
        const curX = unpX(cur);
        const curY = unpYS(cur);

        r.work.setI(curX + side * curY, 14, mark);                 // 0x59454a
        ++region.cellCount;                                        // 0x594552
        region.cells.push(cur);                                    // 0x59458b

        for (let dir = 0; dir < 8; ++dir) {                        // 0x594598
            const nx = i16(curX + K_DIR_X8[dir]!);
            const ny = i16(curY + K_DIR_Y8[dir]!);
            if (!r.cellExists(nx, ny))
                continue;

            const neighbour = r.cellAt(nx, ny);
            if (neighbour.passability !== PASSABLE)
                continue;
            if (getMoveError(r, packXY(nx, ny), movementZone) !== referenceError)
                continue;

            const nbIndex = nx + side * ny;
            if (r.work.i(nbIndex, 15) !== -1)                      // 0x594664
                continue;

            r.work.setI(nbIndex, 15, mark);                        // 0x59466a
            pending.push(packXY(nx, ny));                          // 0x5946b0
        }
    }
}

// ---------------------------------------------------------------------------
// sub_594870 (0x594870 - 0x594A55) - stamp one region's starting-point cells.
// Deviation: when region->startingPoints is larger than the pick list the
// vanilla's stamp loop reads past the end of the list; the port stops at the
// end instead of reading heap garbage.
// ---------------------------------------------------------------------------
export function stampStartingPointCells(r: Rmg, region: MapRegion, offset: number): void {
    if (region === null)
        return;

    const points = region.startingPoints;          // region +0x20
    const cellCount = region.cells.length;

    // A region always carries at least the cell it was seeded from.
    if (cellCount === 0)
        return;

    // ---- 1. sample the candidates (0x594898 - 0x594a1b) -------------------
    const visX = K_VISIBLE_OFFSET_X + 4;
    const visY = K_VISIBLE_OFFSET_Y + 4;
    const visW = r.size.width - 8;
    const visH = r.size.height - 8;

    let n2: number;
    do {
        n2 = F2I64(r.rng.next() * (3.0 * K_UNIT_SCALE));
    } while (n2 > 2);

    const wanted = n2 + 15 * points;               // 12 * points + 3 * points

    const candidates: number[] = [];
    let rejectRect = 0;
    let rejectBand = 0;
    for (let attempt = 0; candidates.length < wanted; ++attempt) {
        if (attempt >= 300)                        // 0x594918
            break;

        let index: number;
        do {
            index = F2I64(r.rng.next() * cellCount * K_UNIT_SCALE);
        } while (index > cellCount - 1);

        const picked = region.cells[index]!;
        if (!tileRectClear(r, unpX(picked) - 3, unpYS(picked) - 3, 6, 6, false, false)) {
            ++rejectRect;
            continue;
        }
        if (!isWithinUsableRect(r, picked, true, visX, visY, visW, visH)) {
            ++rejectBand;
            continue;
        }

        candidates.push(picked);                   // 0x5949fb
    }
    if (points > 0 && candidates.length < wanted)
        diag(`SP-SAMPLE region=${region.id} tries ran out: rejected by 6x6 TileRectClear=${rejectRect}, by usable band=${rejectBand}`);

    // ---- 2. choose --------------------------------------------------------
    const picks = chooseStartingPointCells(r, region, candidates);
    diag(`SP-STAMP region=${region.id} points=${points} cellCount=${cellCount} wanted=${wanted} candidates=${candidates.length} picks=${picks.length}`);
    if (picks.length === 0 && points > 0) {
        // The vanilla keeps going here and stamps garbage; with nothing to
        // stamp there is nothing to record either.
        region.startPointPicks = picks.slice();
        return;
    }

    // ---- 3. stamp (0x594a5e - 0x594ac1) -----------------------------------
    const stampable = points < picks.length ? points : picks.length;
    diag(`SP-STAMP region=${region.id} stamped=${stampable} (budget points=${points})`);
    for (let i = 0; i < stampable; ++i) {
        const cell = picks[i]!;
        const index = offset + i;

        if (index >= 0 && index < r.waypoints.length)
            r.waypoints[index] = cell;             // sub_68BF50

        const mapCell = r.cellAt(unpX(cell), unpYS(cell));
        mapCell.cellFlags |= CELL_FLAG_START_POINT;    // 0x594ac1

        r.startingPoints.push({ index, coords: cell });
    }

    // The leftovers stay on the region (the vanilla's region +0x00).
    region.startPointPicks = picks.slice(stampable);
}

// ---------------------------------------------------------------------------
// sub_594F40 (0x594F40 - 0x5953F3) - which of the candidates become starting
// points. No RNG is consumed.
// ---------------------------------------------------------------------------
export function chooseStartingPointCells(r: Rmg, region: MapRegion,
                                         candidates: number[]): number[] {
    const picks: number[] = [];
    if (region === null)
        return picks;

    const points = region.startingPoints;
    const candidateCount = candidates.length;

    // dword_ABE030 = the rolled TiberiumLayout option and dword_ABE028 = the
    // player count; the vanilla's shape stays visible.
    const wantDouble =
        (r.globalOptions.tiberiumLayout * 0.01 * 12.0
         / r.config.playerCount + 2.0)
        * points;
    let want = F2I64(wantDouble);

    let limit = want;                                       // vanilla's v36
    if (points === 0 && candidateCount > 0) {
        limit = candidateCount;
        want = limit;
    }
    if (want > candidateCount || want === 0) {
        if (points === 0)
            return picks;
        limit = candidateCount;
    }

    const side = r.size.workSide;

    // ---- the first pick (0x595002 - 0x595198) -----------------------------
    if (candidateCount > 1 && limit > 0) {
        let best = -1.0;
        let bestIndex = -1;
        for (let i = 0; i + 1 < candidateCount; ++i) {
            const a = candidates[i]!;
            const markA = r.work.i(unpX(a) + side * unpYS(a), 14);
            for (let j = i + 1; j < candidateCount; ++j) {
                const b = candidates[j]!;
                const markB = r.work.i(unpX(b) + side * unpYS(b), 14);
                const dx = unpX(a) - unpX(b);
                const dy = unpYS(a) - unpYS(b);
                const d = Math.sqrt(dx * dx + dy * dy)
                    + (markA !== markB ? 20 : 0);
                if (j !== 0 && d > best)                    // 0x5950fd
                {
                    best = d;
                    bestIndex = i;
                }
            }
        }
        if (bestIndex !== -1)
            picks.push(candidates[bestIndex]!);
    }

    // ---- the fill (0x595198 - 0x5953f3) -----------------------------------
    while (picks.length < limit) {
        let best = -1.0;
        let bestIndex = -1;
        for (let i = 0; i < candidateCount; ++i) {
            const a = candidates[i]!;
            const markA = r.work.i(unpX(a) + side * unpYS(a), 14);

            let nearest = 9999999.0;
            for (let j = 0; j < picks.length; ++j) {
                const b = picks[j]!;
                const markB = r.work.i(unpX(b) + side * unpYS(b), 14);
                const dx = unpX(a) - unpX(b);
                const dy = unpYS(a) - unpYS(b);
                const d = Math.sqrt(dx * dx + dy * dy)
                    + (markA !== markB ? 20 : 0);
                if (d < nearest)
                    nearest = d;
            }

            if (nearest > best) {
                best = nearest;
                bestIndex = i;
            }
        }

        if (bestIndex === -1)
            break;                                          // no candidates left
        picks.push(candidates[bestIndex]!);
    }

    return picks;
}

// ---------------------------------------------------------------------------
// Locate one of the game's INI files: next to the executable first, then one
// and two levels up, then the project's rules-INI folder - the same candidate
// list LoadOverlayTypes (MapGenRecalc.cpp) uses. Null when none exists.
// ---------------------------------------------------------------------------
function findGameIni(r: Rmg, fileName: string): string | null {
    const dir = r.resourceDir.replace(/\/?$/, '/');
    const candidates = [
        join(dir, fileName),                       // next to the executable
        join(dir, '../' + fileName),
        join(dir, '../../相关INI/' + fileName),
        join(dir, '相关INI/' + fileName),
    ];
    for (const c of candidates)
        if (existsSync(c)) return c;
    return null;
}

// ---------------------------------------------------------------------------
// LoadNeutralTechBuildings - RulesClass::NeutralTechBuildings (rules INI
// [AI]) plus each type's foundation. The list is read from the [AI] section,
// not [General]. The size comes from the ART INI ("Foundation" = "WxH"), read
// via the entry's Image= section first, falling back to the entry itself.
// ---------------------------------------------------------------------------
export function loadNeutralTechBuildings(r: Rmg): void {
    r.neutralTechBuildings.length = 0;

    const rulesPath = r.rulesIniPath();
    if (rulesPath === null) {
        diag('TECH-DIAG LoadNeutral: rulesmd.ini NOT FOUND by FindGameIni');
        return;
    }
    diag(`TECH-DIAG LoadNeutral: rules path='${rulesPath}'`);

    const list = profileString(rulesPath, 'AI', 'NeutralTechBuildings', '');
    diag(`TECH-DIAG LoadNeutral: raw list='${list}' len=${list.length}`);
    if (list.length === 0)
        return;

    const artPath = findGameIni(r, 'artmd.ini');
    const haveArt = artPath !== null;
    diag(`TECH-DIAG LoadNeutral: artmd.ini found=${haveArt ? 1 : 0} path='${haveArt ? artPath : '(none)'}'`);

    // strtok_s over ',': consecutive delimiters collapse, empty tokens skip.
    for (const rawToken of list.split(',')) {
        if (rawToken.length === 0)
            continue;
        const name = rawToken.replace(/^[ \t]+/, '');

        const entry = { name: name.slice(0, 31), width: 1, height: 1 };

        if (haveArt && artPath !== null) {
            const image = profileString(artPath, name, 'Image', '');

            let value = '';
            if (image.length !== 0)
                value = profileString(artPath, image, 'Foundation', '');
            if (value.length === 0)
                value = profileString(artPath, name, 'Foundation', '');

            if (value.length !== 0) {
                const m = /^\s*([+-]?\d+)x\s*([+-]?\d+)/.exec(value);
                if (m !== null) {
                    const w = parseInt(m[1]!, 10) | 0;
                    const h = parseInt(m[2]!, 10) | 0;
                    if (w > 0 && h > 0) {
                        entry.width = w;
                        entry.height = h;
                    }
                }
            }
        }

        r.neutralTechBuildings.push(entry);
        diag(`TECH-DIAG LoadNeutral: entry[${r.neutralTechBuildings.length - 1}]='${entry.name}' ${entry.width}x${entry.height}`);
    }

    diag(`TECH-DIAG LoadNeutral: total entries=${r.neutralTechBuildings.length}`);
}

// ---------------------------------------------------------------------------
// LoadMultiplayerHouses - the [Houses] ledger the multiplayer (.yrm) layout
// writes: the rules [Countries] keys in index order, each with its country's
// Color from the rules [<country>] section.
// ---------------------------------------------------------------------------
export function loadMultiplayerHouses(r: Rmg): void {
    r.multiplayerHouses.length = 0;

    const rulesPath = r.rulesIniPath();
    if (rulesPath === null)
        return;

    // The keys are contiguous from 0, so stop at the first absent index. The
    // sentinel default tells "no such key" apart from a present, empty value.
    for (let index = 0; index < 64; ++index) {
        const key = `${index}`;

        // GetPrivateProfileStringA truncates at the 64-byte buffer (63 chars).
        const countryBuf = profileString(rulesPath, 'Countries', key, '\x01').slice(0, 63);
        if (countryBuf.length === 0 || countryBuf.charAt(0) === '\x01')
            break;

        // strncpy_s(house.country /* char[32] */, country, _TRUNCATE) keeps 31.
        const country = countryBuf.slice(0, 31);
        // The Color lookup runs against the 64-byte buffer's value, not the
        // truncated house name - with the shipped rules' commented values the
        // section never exists and Grey wins.
        const color = profileString(rulesPath, countryBuf, 'Color', 'Grey').slice(0, 23);
        r.multiplayerHouses.push({ country, color });
    }

    diag(`HOUSES-DIAG LoadMultiplayerHouses: countries=${r.multiplayerHouses.length}`);
}

// ---------------------------------------------------------------------------
// sub_595400 (0x595400 - 0x59567F) - the zero-share fallback.
// [port-only] 先要求 1 格平坦围裙（pass 0），100 次都找不到再用原版仅看地基的
// 规则兜底（pass 1, apron = 0）。
// ---------------------------------------------------------------------------
export function giveRegionATechBuilding(r: Rmg, region: MapRegion): boolean {
    if (region === null || r.work.count === 0)
        return false;
    if (region.cells.length === 0 || r.neutralTechBuildings.length === 0)
        return false;

    // ---- 1. the type (0x595451 - 0x5954a6) --------------------------------
    const typeCount = r.neutralTechBuildings.length;
    let typeIndex: number;
    do {
        typeIndex = F2I64(r.rng.next() * typeCount * K_UNIT_SCALE);
    } while (typeIndex > typeCount - 1);

    const type = r.neutralTechBuildings[typeIndex]!;

    // ---- 2. up to 100 attempts (0x5954bb - 0x595647) ----------------------
    const cellCount = region.cells.length;
    for (let pass = 0; pass < 2; ++pass) {
        const apron = pass === 0 ? 1 : 0;
        for (let attempt = 0; attempt < 100; ++attempt) {
            let index: number;
            do {
                index = F2I64(r.rng.next() * cellCount * K_UNIT_SCALE);
            } while (index > cellCount - 1);

            const cell = region.cells[index]!;
            const level = r.cellAt(unpX(cell), unpYS(cell)).level;   // 0x595522

            if (!foundationFitsAtFlat(r, cell, level,
                                      type.width, type.height, apron))
                continue;

            // The vanilla Unlimbos here (0x595608 - 0x595633) and answers 1.
            if (apron === 0)
                diag(`TECH-DIAG region site fell back to foundation-only rule (${type.name})`);
            recordPlacedBuilding(r, cell, type.name, type.width, type.height);
            return true;
        }
    }

    return false;
}

// ---------------------------------------------------------------------------
// The foundation fit test of sub_595400's inner loop (0x595548 - 0x5955e5).
// The port walks the type's W x H rectangle anchored at the position cell and
// models FirstObject through AltCellFlags_ContainsBuilding.
// ---------------------------------------------------------------------------
export function foundationFitsAt(r: Rmg, base: number, level: number,
                                 width: number, height: number): boolean {
    const side = r.size.workSide;
    const baseX = unpX(base);
    const baseY = unpYS(base);

    for (let row = 0; row < height; ++row) {
        for (let col = 0; col < width; ++col) {
            const x = i16(baseX + col);
            const y = i16(baseY + row);

            const cell = r.cellAt(x, y);
            if ((cell.altFlags & ALT_CELL_FLAGS_CONTAINS_BUILDING) !== 0)
                return false;
            if (!r.isPlaceholderTile(cell))                // 0x5955a6 sub_486380
                return false;
            if (cell.level !== level)                      // 0x5955b5
                return false;
            if (cell.landType === 3)                       // 0x5955bf LandType_Rock
                return false;
            if (!isWithinUsableArea(r, packXY(x, y), true)) // 0x5955c8
                return false;
            if (r.work.byte(x + side * y, 69) !== 0)       // 0x5955d6
                return false;
        }
    }
    return true;
}

// ---------------------------------------------------------------------------
// FoundationFitsAtFlat [port-only] - vanilla fit on the foundation itself,
// plus every cell of an apron around it must be in the diamond, flat,
// land-walkable and at the same Level.
// ---------------------------------------------------------------------------
export function foundationFitsAtFlat(r: Rmg, base: number, level: number,
                                     width: number, height: number,
                                     apron: number): boolean {
    if (apron <= 0)
        return foundationFitsAt(r, base, level, width, height);

    if (!foundationFitsAt(r, base, level, width, height))
        return false;

    const baseX = unpX(base);
    const baseY = unpYS(base);

    for (let row = baseY - apron; row < baseY + height + apron; ++row) {
        for (let col = baseX - apron; col < baseX + width + apron; ++col) {
            if (col >= baseX && col < baseX + width
                && row >= baseY && row < baseY + height)
                continue;                       // foundation: tested above

            const x = i16(col);
            const y = i16(row);
            if (!r.cellExists(x, y))
                return false;
            const ring = r.cellAt(x, y);
            // Same elevation, no ramp tile, and land (plain or beach) only.
            if (ring.level !== level || ring.slopeIndex !== 0)
                return false;
            if (ring.passability !== PASSABLE
                && ring.passability !== BEACH)
                return false;
        }
    }
    return true;
}

// ---------------------------------------------------------------------------
// Route B placement shared by sub_595400 and sub_5A95B0: append the
// MapStructure and mark every foundation cell with the
// AltCellFlags_ContainsBuilding stand-in.
// ---------------------------------------------------------------------------
export function recordPlacedBuilding(r: Rmg, base: number,
                                     typeName: string,
                                     width: number, height: number): void {
    r.structures.push({ coords: base, typeName, houseName: 'Neutral House', facing: 0 /*North*/ });

    const baseX = unpX(base);
    const baseY = unpYS(base);
    for (let row = 0; row < height; ++row) {
        for (let col = 0; col < width; ++col) {
            r.cellAt(i16(baseX + col), i16(baseY + row)).altFlags
                |= ALT_CELL_FLAGS_CONTAINS_BUILDING;
        }
    }
}

// ---------------------------------------------------------------------------
// Step 2 - sub_5A1FB0 (0x5A1FB0 - 0x5A21AF): paint each starting point's
// surroundings. No RNG. Always answers true (the stage's retry loop ends here).
// ---------------------------------------------------------------------------
export function paintStartingPointTerrain(r: Rmg): boolean {
    if (r.work.count === 0 || r.cellSlots.length === 0)
        return true;

    const side = r.size.workSide;

    for (let i = 0; i < r.startingPointCount; ++i) {
        if (i >= r.waypoints.length)
            break;                          // no waypoint stamped that far
        const start = r.waypoints[i]!;
        const startX = unpX(start);
        const startY = unpYS(start);

        const pool: StartFloodNode[] = [];
        const heap = new StartFloodHeap();

        // ---- clear every diamond cell's start mark ------------------------
        {
            const it = new CellIterator();
            it.reset(r.cellSlots, r.size.mapWidth);
            for (let cell = it.next(); cell !== null; cell = it.next()) {
                const x = unpX(cell.mapCoords);
                const y = unpYS(cell.mapCoords);
                r.work.setI(x + side * y, 15, 0);
            }
        }

        const mark = i + 1;

        // ---- the seed ------------------------------------------------------
        pool.push({ coords: start, distance: 0 });
        r.work.setI(startX + side * startY, 15, mark);
        heap.push(pool[0]!);

        // ---- the flood -----------------------------------------------------
        let painted = 0;
        let node = heap.pop();
        while (node !== null) {
            if (painted >= 400)
                break;

            const cur = node.coords;
            const curX = unpX(cur);
            const curY = unpYS(cur);
            r.work.setByte(curX + side * curY, 69, 1);

            for (let dir = 0; dir < 8; ++dir) {
                const nx = i16(curX + K_DIR_X8[dir]!);
                const ny = i16(curY + K_DIR_Y8[dir]!);
                if (!r.cellExists(nx, ny))
                    continue;
                if (r.work.i(nx + side * ny, 15) !== 0)
                    continue;

                const cell = r.cellAt(nx, ny);
                if (!r.isPlaceholderTile(cell))         // sub_486380
                    continue;

                const dx = nx - startX;
                const dy = ny - startY;

                const entry: StartFloodNode = {
                    coords: packXY(nx, ny),
                    distance: Math.fround(Math.sqrt(dx * dx + dy * dy)),
                };

                pool.push(entry);
                r.work.setI(nx + side * ny, 15, mark);
                heap.push(entry);
            }

            ++painted;
            node = heap.pop();
        }

        diag(`SP-PAINT pt${i} start=(${startX},${startY}) painted=${painted}`);
    }

    // 诊断：对每一对出生点，检查二者之间能否沿"占位/可通行同高"格连通，
    // 以及路径中点是否被任一 byte69 保护区覆盖。
    if (r.startingPointCount >= 2) {
        const pDX = [0, 1, 0, -1];
        const pDY = [-1, 0, 1, 0];
        for (let a = 0; a < r.startingPointCount; ++a)
            for (let b = a + 1; b < r.startingPointCount; ++b) {
                const sa = r.waypoints[a]!;
                const sb = r.waypoints[b]!;
                const saX = unpX(sa);
                const saY = unpYS(sa);
                const sbX = unpX(sb);
                const sbY = unpYS(sb);
                const lvl = r.cellAt(saX, saY).level;
                const q: number[] = [saX + side * saY];
                const seen = new Uint8Array(side * side);
                seen[saX + side * saY] = 1;
                let reachable = false;
                let pathLen = 0;
                const parent: number[] = new Array<number>(side * side).fill(-1);
                let head = 0;
                while (head < q.length) {
                    const idx = q[head++]!;
                    const px = idx % side;
                    const py = Math.floor(idx / side);
                    if (px === sbX && py === sbY) { reachable = true; break; }
                    for (let d = 0; d < 4; ++d) {
                        const nx = px + pDX[d]!, ny = py + pDY[d]!;
                        if (nx < 0 || ny < 0 || nx >= side || ny >= side)
                            continue;
                        const ni = nx + side * ny;
                        if (seen[ni] !== 0)
                            continue;
                        if (!r.cellExists(i16(nx), i16(ny)))
                            continue;
                        const nc = r.cellAt(nx, ny);
                        if (nc.passability !== PASSABLE || nc.level !== lvl)
                            continue;
                        seen[ni] = 1;
                        parent[ni] = idx;
                        q.push(ni);
                    }
                }
                if (reachable) {
                    let cur = sbX + side * sbY;
                    let unprotected = 0;
                    let total = 0;
                    while (cur >= 0) {
                        ++total;
                        if (r.work.byte(cur, 69) === 0)
                            ++unprotected;
                        if (cur === saX + side * saY)
                            break;
                        cur = parent[cur]!;
                    }
                    pathLen = total;
                    diag(`SP-PATHTEST ${a}->${b} lvl=${lvl} reachable=YES path=${pathLen} unprotected69=${unprotected}`);
                } else {
                    diag(`SP-PATHTEST ${a}->${b} lvl=${lvl} reachable=NO (a=(${saX},${saY})L${r.cellAt(saX, saY).level} b=(${sbX},${sbY})L${r.cellAt(sbX, sbY).level})`);
                }
            }
    }

    return true;
}
