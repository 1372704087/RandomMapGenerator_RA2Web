/**
 * Transliteration of G:/MapGenerator MapGenHills.cpp - the "RMG: Creating
 * hills" stage (sub_598960 @ 0x599171) and its driver sub_5A35F0.
 *
 * The stage body is the six-step sequence (createHills below mirrors it one
 * call per step):
 *
 *   0x5a35f9  1. MarkHillProtection      sub_5A33F0
 *   0x5a3600  2. BuildHillHeightField    sub_5A2F50
 *   0x5a3605  3. BuildElevationGrid      sub_6B2A70
 *   0x5a361a  4. ApplyElevationLevels    the inline level-apply loop
 *   0x5a36c1  5. FinalizeElevationSlopes sub_6B3850
 *   0x5a36cb  6. MergeSlopeBlocks        the inline 2x2 slope merge
 *
 * plus the [port-only] MarkTechBuildingProtection (runs before step 1) and
 * RemoveCliffsOverRamps (runs after step 6).
 *
 * All of the stage's RNG lives in step 2: two clipped Gaussian rejection
 * loops per processed work cell (two r.rng.gaussian() draws per cell, order
 * is a contract).
 *
 * IsMorphableTile / CanHostSlope are defined in this C++ file but already
 * ported in makingSub.ts - re-exported here so the module keeps the C++
 * file's surface.
 */

import type { Rmg } from './mapGen';

import {
    CellIterator,
    DIR_X,
    DIR_Y,
    ElevationEntry,
    MapCell,
    i16,
    unpX,
    unpYS,
} from './types';
import { F2I64 } from './mathTables';
import { diag } from './diag';
import { canHostSlope, isMorphableTile, isCliffFamilyTile } from './makingSub';
import { cliffCellsInX, isCliffWallRiding, isShoreTile } from './river';

// IsMorphableTile / CanHostSlope (MapGenHills.cpp local definitions) live in
// makingSub.ts - re-exported so this module mirrors the C++ file's exports.
export { canHostSlope, isMorphableTile };

/** AltCellFlags bit 0x2 (ContainsBuilding) - the "occupied" stand-in. */
const K_ALT_CELL_FLAGS_CONTAINS_BUILDING = 0x2;

// ---------------------------------------------------------------------------
// The undo journal (C++ member elevJournal_, std::vector<ElevationWrite>,
// MapGen.h:1589 - the vanilla's dword_B0B654 buffer). The member is NOT on
// Rmg yet, so it lives as a module-local per-Rmg array (REPORTED - if another
// module ever needs it, move it onto Rmg centrally).
// ---------------------------------------------------------------------------
export interface ElevationWrite {
    index: number; // the grid point
    oldCorner: number; // the corner value it held
}

const elevJournals = new Map<Rmg, ElevationWrite[]>();

function journalOf(r: Rmg): ElevationWrite[] {
    let j = elevJournals.get(r);
    if (j === undefined) {
        j = [];
        elevJournals.set(r, j);
    }
    return j;
}

// ---------------------------------------------------------------------------
// The two doubles a work cell carries: the HEIGHT field at byte +8 and the
// AMPLITUDE field at +16 (WorkCell stores 20 ints, so the vanilla reaches
// both through reinterpret_cast on the raw bytes). A Float64Array over the
// work grid's buffer is bit-exact; 80 bytes per cell keeps both doubles
// 8-aligned, so cell i's height is element 10*i + 1 and its amplitude
// element 10*i + 2. (MarkHillProtection writes its 0.5 seed through
// r.work.setI instead - the vanilla's two dwords 0 / 0x3FE00000.)
// ---------------------------------------------------------------------------
const F64_PER_CELL = 10; // Float64 elements per 80-byte work cell
const F64_HEIGHT = 1; // byte +8
const F64_AMPLITUDE = 2; // byte +16

const f64View = (r: Rmg): Float64Array => new Float64Array(r.work.bytes.buffer);

// ---------------------------------------------------------------------------
// The slope-pattern table at 0x83FF18: 19 patterns of four corner offsets,
// in the order the four grid points are read - e(x, y), e(x + 1, y),
// e(x + 1, y + 1), e(x, y + 1).
//
// Index 0 is four zeros (it points at the never-written 16-byte global
// 0xB0B6DC) - NOT a -1 sentinel: a flat cell seeds 15 * Level and gets
// SlopeIndex 0 + the clear tile in the final pass.
// ---------------------------------------------------------------------------
const K_SLOPE_CORNERS: number[][] = [
    [0, 0, 0, 0], //  0
    [0, 15, 15, 0], //  1
    [0, 0, 15, 15], //  2
    [15, 0, 0, 15], //  3
    [15, 15, 0, 0], //  4
    [0, 0, 15, 0], //  5
    [0, 0, 0, 15], //  6
    [15, 0, 0, 0], //  7
    [0, 15, 0, 0], //  8
    [0, 15, 15, 15], //  9
    [15, 0, 15, 15], // 10
    [15, 15, 0, 15], // 11
    [15, 15, 15, 0], // 12
    [0, 15, 30, 15], // 13
    [15, 0, 15, 30], // 14
    [30, 15, 0, 15], // 15
    [15, 30, 15, 0], // 16
    [0, 15, 0, 15], // 17
    [15, 0, 15, 0], // 18
];

// ---------------------------------------------------------------------------
// The stage body - sub_5A35F0 (0x5A35F0 - 0x5A38B0).
// ---------------------------------------------------------------------------
export function createHills(r: Rmg): void {
    markTechBuildingProtection(r); // [port-only] keep tech buildings on flat ground
    markHillProtection(r); // 0x5a35f9  sub_5A33F0
    buildHillHeightField(r); // 0x5a3600  sub_5A2F50
    buildElevationGrid(r); // 0x5a3605  sub_6B2A70
    applyElevationLevels(r); // 0x5a361a  the inline level-apply loop
    finalizeElevationSlopes(r); // 0x5a36c1  sub_6B3850
    mergeSlopeBlocks(r); // 0x5a36cb  the inline 2x2 slope merge
    removeCliffsOverRamps(r); // port-only: keep ramp seams free of walls
}

// ---------------------------------------------------------------------------
// MarkTechBuildingProtection [port-only].
//
// Paints the hill protection mark (work byte +69) on every tech-building
// foundation cell (AltCellFlags_ContainsBuilding) and on a two-cell apron
// around it, so the height field pins those cells near ground level and the
// slope pass never stamps on them.
// ---------------------------------------------------------------------------
export function markTechBuildingProtection(r: Rmg): void {
    if (r.cellSlots.length === 0 || r.work.count === 0)
        return;

    const side = r.size.workSide;
    const kApron = 2; // flat cells kept around the foundation
    let foundations = 0;
    let marked = 0;

    const it = new CellIterator();
    it.reset(r.cellSlots, r.size.mapWidth);
    for (let cell = it.next(); cell !== null; cell = it.next()) {
        if ((cell.altFlags & K_ALT_CELL_FLAGS_CONTAINS_BUILDING) === 0)
            continue;
        ++foundations;

        const bx = unpX(cell.mapCoords);
        const by = unpYS(cell.mapCoords);

        for (let dy = -kApron; dy <= kApron; ++dy) {
            for (let dx = -kApron; dx <= kApron; ++dx) {
                const x = i16(bx + dx);
                const y = i16(by + dy);
                if (!r.cellExists(x, y))
                    continue;
                const wi = x + side * y;
                if (r.work.byte(wi, 69) === 0) {
                    r.work.setByte(wi, 69, 1);
                    ++marked;
                }
            }
        }
    }

    diag(`HILL-PROT tech foundations=${foundations} newly marked apron cells=${marked}`);
}

// ---------------------------------------------------------------------------
// Step 1 - MarkHillProtection (sub_5A33F0, 0x5A33F0 - 0x5A35EB).
//
// For every shore tile (sub_4865B0) the first placeholder-tile neighbour in
// Neighbours order gets its height field (work +8) seeded with the double
// 0.5 (the two dwords 0 / 0x3FE00000) and its protection mark (+69) set.
// For every cliff-family tile (sub_4863D0) the same neighbour only gets the
// protection mark.
// ---------------------------------------------------------------------------
export function markHillProtection(r: Rmg): void {
    if (r.cellSlots.length === 0 || r.work.count === 0)
        return;

    const side = r.size.workSide;

    const it = new CellIterator();
    it.reset(r.cellSlots, r.size.mapWidth);
    for (let cell = it.next(); cell !== null; cell = it.next()) {
        const x = unpX(cell.mapCoords);
        const y = unpYS(cell.mapCoords);

        // ---- shore tile (0x5a3417 sub_4865B0) -----------------------------
        if (isShoreTile(r, cell)) {
            for (let d = 0; d < 8; ++d) {
                // 0x5a3431 Neighbours order
                const nbX = i16(x + DIR_X[d]);
                const nbY = i16(y + DIR_Y[d]);
                if (!r.cellExists(nbX, nbY)) // 0x5a3483 diamond test
                    continue;
                if (!r.isPlaceholderTile(r.cellAt(nbX, nbY))) // 0x5a3496 sub_486380
                    continue;

                const wi = nbX + side * nbY;
                // 0x5a34ce / 0x5a34dc: the two dwords 0 and 0x3FE00000, i.e.
                // the height field (work +8) seeded with the double 0.5.
                r.work.setI(wi, 2, 0);
                r.work.setI(wi, 3, 0x3fe00000);
                r.work.setByte(wi, 69, 1); // 0x5a3503
                break; // 0x5a3508
            }
            continue;
        }

        // ---- cliff-family tile (0x5a350f sub_4863D0) ----------------------
        if (isCliffFamilyTile(r, cell)) {
            for (let d = 0; d < 8; ++d) {
                const nbX = i16(x + DIR_X[d]);
                const nbY = i16(y + DIR_Y[d]);
                if (!r.cellExists(nbX, nbY))
                    continue;
                if (!r.isPlaceholderTile(r.cellAt(nbX, nbY)))
                    continue;

                r.work.setByte(nbX + side * nbY, 69, 1); // 0x5a35ca
                break;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Step 2 - BuildHillHeightField (sub_5A2F50, 0x5A2F50 - 0x5A33EF).
//
// Gated on ruggedness * 0.0025 >= 0.025. Blends the height field (work +8,
// a DELTA) and the amplitude field (work +16) from the west / north
// neighbours, clips the amplitude delta, forces the protected cells' height
// to >= 0 and their amplitude to 0.0025, applies two clipped Gaussian
// perturbation draws per cell, then rounds the height field to
// (double)F2I64(x +- 0.5).
//
// The only RNG consumer of the stage (sub_5980C0 = r.rng.gaussian()).
// ---------------------------------------------------------------------------
export function buildHillHeightField(r: Rmg): void {
    if (r.work.count === 0)
        return;

    // globalOptions.ruggedness - the hill strength rolled by sub_597260.
    const strength = r.globalOptions.ruggedness;
    const ampLo = strength * 0.0025; // 0x5a2f88
    const jitter = strength * 0.0001 + 0.1; // 0x5a2f76
    const ampHi = strength * 0.005; // 0x5a2f92
    if (ampLo < 0.025) // 0x5a2fa8
        return; // never taken: sub_597260 rolls ruggedness in [20, 100]

    const side = r.size.workSide;
    const count = side * side;
    const f64 = f64View(r);
    const height = (i: number): number => f64[i * F64_PER_CELL + F64_HEIGHT];
    const setHeight = (i: number, v: number): void => {
        f64[i * F64_PER_CELL + F64_HEIGHT] = v;
    };
    const amplitude = (i: number): number => f64[i * F64_PER_CELL + F64_AMPLITUDE];
    const setAmplitude = (i: number, v: number): void => {
        f64[i * F64_PER_CELL + F64_AMPLITUDE] = v;
    };

    // ---- pass A (0x5a2fc7 - 0x5a3383) -------------------------------------
    for (let i = 0; i < count; ++i) {
        const packed = r.work.i(i, 0); // 0x5a2fc9
        if (packed === 0) // 0x5a2fd3 / 0x5a2fdb
            continue;

        const x = unpX(packed);
        const y = unpYS(packed);
        const xm = i16(x - 1);
        const ym = i16(y - 1);

        setAmplitude(i, 0.0); // 0x5a2fe7 / 0x5a2ff0

        // The reference height: the north-west cell (x-1, y-1).
        let reference = 0.0; // var_40
        if (r.cellExists(xm, ym)) // 0x5a3034
            reference = height(xm + side * ym); // 0x5a3053

        // The west cell (x-1, y): it sets the amplitude (or ampLo when it
        // lies off the diamond) and seeds the delta (0x5a305b - 0x5a30d2).
        let delta = 0.0; // v30 / var_58
        if (r.cellExists(xm, y)) {
            setHeight(i, height(i) + height(xm + side * y)); // 0x5a309c
            setAmplitude(i, amplitude(xm + side * y)); // 0x5a30a2 / 0x5a30ab
            delta = height(xm + side * y) - reference; // 0x5a30ae
        } else {
            setAmplitude(i, ampLo); // 0x5a30cc / 0x5a30d2
        }

        // The north cell (x, y-1) adds in, or ampLo when off the diamond
        // (0x5a30df - 0x5a3151).
        if (r.cellExists(x, ym)) {
            setHeight(i, height(i) + height(x + side * ym)); // 0x5a311e
            setAmplitude(i, amplitude(i) + amplitude(x + side * ym)); // 0x5a3127
            delta += height(x + side * ym) - reference; // 0x5a3130 / 0x5a3134
        } else {
            setAmplitude(i, amplitude(i) + ampLo); // 0x5a3145
        }

        // Average with what the cell already carried: zero for an ordinary
        // cell, the 0.5 seed sub_5A33F0 left on a protected one
        // (0x5a3154 - 0x5a3169).
        setHeight(i, height(i) * 0.5);
        setAmplitude(i, amplitude(i) * 0.5);

        // The delta is only ever used as a sign (0x5a316c - 0x5a31a6).
        if (delta > 0.0)
            delta = jitter;
        else if (delta < 0.0)
            delta = -jitter;

        // A protected cell keeps a non-negative height and a 0.0025 amplitude
        // (0x5a31aa - 0x5a31d9).
        if (r.work.byte(i, 69) !== 0) {
            if (height(i) < 0.0)
                setHeight(i, 0.0); // 0x5a31bc / 0x5a31c6
            setAmplitude(i, 0.0025); // 0x5a31c9 / 0x5a31d0
        }

        // ---- draw 1, the amplitude (0x5a31e0 - 0x5a3281) ------------------
        {
            const lo = -amplitude(i); // v32
            const hi = ampHi - amplitude(i); // v24
            let span = 0.025; // v36
            let centre = 0.0; // v38
            if (-0.025 > hi || lo > 0.025) {
                // 0x5a3237
                span = (hi - lo) * 0.5; // 0x5a3247
                centre = span - amplitude(i); // 0x5a324f
            }
            let d: number;
            do
                d = r.rng.gaussian() * span + centre; // 0x5a3272 / 0x5a3281
            while (d < lo || d > hi);
            setAmplitude(i, amplitude(i) + d); // 0x5a328a
        }

        // ---- draw 2, the height (0x5a329a - 0x5a335d) ---------------------
        {
            const lo = -2.0 - height(i); // v25
            const hi = 2.0 - height(i); // v33
            let centre = delta < lo ? lo : delta > hi ? hi : delta; // v16
            let span = amplitude(i); // v31: the updated amplitude
            if (centre - amplitude(i) > hi || amplitude(i) + centre < lo) {
                // 0x5a330f
                span = (hi - lo) * 0.5; // 0x5a3323
                centre = span + lo; // 0x5a332b
            }
            let d: number;
            do
                d = r.rng.gaussian() * span + centre; // 0x5a334e / 0x5a335d
            while (d < lo || d > hi);
            setHeight(i, height(i) + d); // 0x5a336c
        }
    }

    // ---- pass B, round the height field (0x5a338d - 0x5a33e6) -------------
    // Every work slot is rounded, not just the ones pass A touched: the
    // driver reads the field back as the integer height step.
    for (let i = 0; i < count; ++i) {
        const h = height(i);
        if (h > 0.0)
            setHeight(i, F2I64(h + 0.5)); // 0x5a33dc
        else if (h < 0.0)
            setHeight(i, F2I64(h - 0.5)); // 0x5a33b8
        // h == 0 is left as it is
    }
}

// ---------------------------------------------------------------------------
// Step 3 - BuildElevationGrid (sub_6B2A70, 0x6B2A70 - 0x6B2F28).
//
// Allocates the scratch elevation grid over the map's cell rectangle - workSide
// x workSide entries with Left = Top = 0 and stride = workSide - and seeds
// each entry from the map cell's own elevation
//     15 * cell->Level + kSlopeCorners[cell->SlopeIndex][0]
// plus the "blocked" byte for the grid points whose walk left the diamond or
// whose neighbouring cells fail the usable / overlay / object / +69 / tile
// tests.
// ---------------------------------------------------------------------------
export function buildElevationGrid(r: Rmg): void {
    if (r.cellSlots.length === 0)
        return;

    // 0x6b2a9e / 0x6b2b3b: the grid is (Right + 1) x (Bottom + 1) entries with
    // the row stride Right + 1. The diamond's cells span x, y in [1, W'+H'-1]
    // and every cell reads the four grid points (x, y) .. (x + 1, y + 1), so
    // the grid carries gx, gy in [0, W'+H'] - i.e. workSide of both.
    const side = r.size.workSide; // Right + 1 = W' + H' + 1
    const rows = r.size.workSide; // Bottom + 1

    r.elevLeft = 0;
    r.elevTop = 0;
    r.elevStride = side;

    // 0x6b2a7e: a previous grid is freed first.
    r.elevGrid = new Array<ElevationEntry>(side * rows);
    for (let i = 0; i < r.elevGrid.length; ++i) {
        r.elevGrid[i] = { corner: 0, blocked: 0, touched: 0 };
    }

    // The three offsets applied to the ORIGINAL coords to pull the grid point
    // back into the diamond, in this order, giving up after them
    // (0x6b2bb5 - 0x6b2be3).
    const K_PULL_X = [0, -1, -1];
    const K_PULL_Y = [-1, -1, 0];

    for (let gy = 0; gy < rows; ++gy) {
        for (let gx = 0; gx < side; ++gx) {
            const entry = r.elevGrid[gx + r.elevStride * gy];

            const bx = i16(r.elevLeft + gx);
            const by = i16(r.elevTop + gy);

            let cx = bx;
            let cy = by;
            for (let step = 0; !r.cellExists(cx, cy) && step < 3; ++step) {
                cx = i16(bx + K_PULL_X[step]);
                cy = i16(by + K_PULL_Y[step]);
            }

            if (!r.cellExists(cx, cy)) {
                entry.corner = 0; // v39 was never set
                entry.blocked = 1; // 0x6b2ee4
                continue;
            }

            // The seed value comes from the cell the walk landed on (0x6b2c95).
            const seed = r.cellAt(cx, cy);
            const slope = seed.slopeIndex >>> 0;
            entry.corner = 15 * seed.level
                + (slope < 19 ? K_SLOPE_CORNERS[slope][0] : 0);

            // The four probes are all run on the ORIGINAL coords (0x6b2ca3 -
            // 0x6b2eda): (bx, by - 1), (bx - 1, by - 1), (bx - 1, by), (bx, by).
            // Each is a plain "in the diamond and unusable" test; an
            // out-of-diamond probe sets nothing.
            if ((r.cellExists(bx, i16(by - 1))
                    && !canHostSlope(r, bx, i16(by - 1)))
                || (r.cellExists(i16(bx - 1), i16(by - 1))
                    && !canHostSlope(r, i16(bx - 1), i16(by - 1)))
                || (r.cellExists(i16(bx - 1), by)
                    && !canHostSlope(r, i16(bx - 1), by))
                || (r.cellExists(bx, by) && !canHostSlope(r, bx, by))) {
                entry.blocked = 1;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Step 4 - ApplyElevationLevels (the inline loop at 0x5A361A - 0x5A36B7).
//
// For every work slot whose packed coords are not (0,0):
//     target  = (double)cell->Level + work.double(+8)
//     current = elevationCurrentLevel(cell)
//     d       = F2I64(target - current);  step = (d >= 0) ? 1 : -1
//     for (n = |d|; n; --n)
//     {
//         mask = elevationStepMask(cell, step);
//         applyElevationStep(step, x, y, mask);
//     }
// ---------------------------------------------------------------------------
export function applyElevationLevels(r: Rmg): void {
    if (r.work.count === 0 || r.cellSlots.length === 0 || r.elevGrid.length === 0)
        return;

    const side = r.size.workSide;
    const count = side * side;
    const f64 = f64View(r);

    for (let i = 0; i < count; ++i) {
        const packed = r.work.i(i, 0); // 0x5a3629
        if (packed === 0) // 0x5a3643 gate
            continue;

        const x = unpX(packed);
        const y = unpYS(packed);
        const cell = r.cellAt(x, y);

        // target = (double)cell->Level + the rounded height field
        // (0x5a3652 - 0x5a3659; the cell's Level is the byte at +0x11B).
        const target = Math.min(10, cell.level + f64[i * F64_PER_CELL + F64_HEIGHT]);   // [QUALITY-FIX] 目标层钳到合法值域
        const current = elevationCurrentLevel(r, cell); // 0x5a365d
        const diff = F2I64(target - current); // 0x5a366e
        const step = diff >= 0 ? 1 : -1; // 0x5a367e - 0x5a3688

        // 0x5a368a - 0x5a36a5: |diff| steps, each raising or lowering the
        // cell by one level.
        for (let n = diff < 0 ? -diff : diff; n > 0; --n) {
            const mask = elevationStepMask(r, cell, step); // 0x5a3692
            applyElevationStep(r, step, x, y, mask); // 0x5a369f
        }
    }
}

// ---------------------------------------------------------------------------
// The grid accessors.
// ---------------------------------------------------------------------------
export function elevationIndexInRange(r: Rmg, index: number): boolean {
    return index >= 0 && index < r.elevGrid.length;
}

export function elevationCornerAt(r: Rmg, index: number): number {
    // Guard only: for every cell of the diamond the four indices a cell uses
    // (index, index + 1, index + stride, index + stride + 1) stay inside the
    // rectangle that covers the iterator's whole span. The vanilla indexes
    // blindly.
    if (!elevationIndexInRange(r, index))
        return 0;
    return r.elevGrid[index].corner;
}

export function rollbackElevationJournal(r: Rmg): void {
    // 0x6b4056 - 0x6b4075: the journal is replayed backwards.
    const j = journalOf(r);
    for (let i = j.length; i > 0; --i) {
        const w = j[i - 1];
        if (elevationIndexInRange(r, w.index))
            r.elevGrid[w.index].corner = w.oldCorner;
    }
    j.length = 0;
}

// ---------------------------------------------------------------------------
// ElevationCurrentLevel - sub_6B4100 (0x6B4100 - 0x6B4231).
//
// The cell's level according to the grid: the smallest of the four corners of
// its 2x2 block, divided by 15. When the cell cannot host a slope the cell's
// own Level is answered instead - the vanilla's condition there is exactly
// CanHostSlope, so the two collapse into one test.
// ---------------------------------------------------------------------------
export function elevationCurrentLevel(r: Rmg, cell: MapCell): number {
    const x = unpX(cell.mapCoords);
    const y = unpYS(cell.mapCoords);
    if (!canHostSlope(r, x, y))
        return cell.level; // 0x6b4207 (+0x11B)

    const index = (x - r.elevLeft) + r.elevStride * (y - r.elevTop);
    let lowest = 1000; // 0x6b4162 literal seed
    const corners = [
        index,
        index + 1,
        index + r.elevStride + 1,
        index + r.elevStride,
    ];
    for (let k = 0; k < 4; ++k) {
        const corner = elevationCornerAt(r, corners[k]); // 0x6b4144 - 0x6b415e
        if (corner < lowest)
            lowest = corner;
    }
    return Math.trunc(lowest / 15); // 0x6b421e
}

// ---------------------------------------------------------------------------
// ElevationStepMask - sub_6B4240 (0x6B4240 - 0x6B43AC).
//
// The four corners in this function's order are
//     e(x, y), e(x + 1, y), e(x + 1, y + 1), e(x, y + 1)
// (bit 0 .. bit 3 of the result). A corner is set when it is not blocked and
//     - all four corners equal, or
//     - step <= 0 (lowering) and the corner is above the minimum, or
//     - step > 0  (raising) and the corner is below the maximum.
// ---------------------------------------------------------------------------
export function elevationStepMask(r: Rmg, cell: MapCell, step: number): number {
    const x = unpX(cell.mapCoords);
    const y = unpYS(cell.mapCoords);
    const indexA = (x - r.elevLeft) + r.elevStride * (y - r.elevTop);
    const indexB = indexA + r.elevStride; // the row below

    const corners = [indexA, indexA + 1, indexB + 1, indexB];

    let lowest = 1000; // 0x6b42f5
    let highest = -1; // 0x6b42fa
    for (let k = 0; k < 4; ++k) {
        const corner = elevationCornerAt(r, corners[k]);
        if (corner < lowest)
            lowest = corner;
        if (corner > highest)
            highest = corner;
    }

    let result = 0;
    for (let k = 0; k < 4; ++k) {
        if (elevationIndexInRange(r, corners[k]) && r.elevGrid[corners[k]].blocked !== 0)
            continue; // blocked corners never move

        let setBit: boolean;
        if (highest === lowest)
            setBit = true; // 0x6b4320 - 0x6b433b
        else if (step <= 0)
            setBit = elevationCornerAt(r, corners[k]) > lowest; // 0x6b434b
        else
            setBit = elevationCornerAt(r, corners[k]) < highest; // 0x6b437d
        if (setBit)
            result |= 1 << k;
    }
    return result;
}

// ---------------------------------------------------------------------------
// ValidateElevationStep - sub_6B3A80 (0x6B3A80 - 0x6B3CC1).
//
// Walks the eight grid neighbours of (x, y) - the centre is stepped over - and
// enforces that no neighbour's corner ends up more than 15 (one level) away
// from the reference corner: a neighbour further off in the step's direction
// is pulled to exactly one level away and then validated recursively. Every
// write goes into the journal.
// ---------------------------------------------------------------------------
export function validateElevationStep(r: Rmg, delta: number, x: number, y: number): boolean {
    const base = (x - r.elevLeft) + r.elevStride * (y - r.elevTop);
    if (!elevationIndexInRange(r, base))
        return false;
    const reference = r.elevGrid[base].corner; // v7 / v19

    // The disassembly's neighbour order (0x6b3aa3 starts the pair at
    // dx = dy = -1 and walks -1, 0, 1 twice): (-1,-1), (0,-1), (1,-1),
    // (-1,0), [(0,0) skipped], (1,0), (-1,1), (0,1), (1,1). All EIGHT
    // neighbours take part.
    const K_DX = [-1, 0, 1, -1, 1, -1, 0, 1];
    const K_DY = [-1, -1, -1, 0, 0, 1, 1, 1];
    const rows = r.elevStride + 1;
    const j = journalOf(r);

    for (let k = 0; k < 8; ++k) {
        const nx = i16(x + K_DX[k]);
        const ny = i16(y + K_DY[k]);
        const gx = nx - r.elevLeft;
        const gy = ny - r.elevTop;
        if (gx < 0 || gy < 0 || gx >= r.elevStride || gy >= rows)
            return false; // 0x6b3c8d (flag == 0)
        const index = gx + r.elevStride * gy;
        if (!elevationIndexInRange(r, index))
            return false;

        const entry = r.elevGrid[index];

        let distance = entry.corner - reference;
        if (distance < 0)
            distance = -distance;

        if (entry.blocked !== 0) {
            if (distance > 15)
                return false; // 0x6b3b55
            continue;
        }
        if (distance <= 15)
            continue; // 0x6b3b6e

        if (delta === 1) {
            if (entry.corner < reference) {
                // 0x6b3b79
                j.push({ index, oldCorner: entry.corner }); // 0x6b3bd9
                entry.corner = reference - 15; // 0x6b3c5b
                entry.touched = 1;
            }
        } else if (entry.corner > reference) {
            // 0x6b3bf0
            j.push({ index, oldCorner: entry.corner }); // 0x6b3c48
            entry.corner = reference + 15; // 0x6b3c58
            entry.touched = 1;
        }

        if (entry.blocked !== 0 || !validateElevationStep(r, delta, nx, ny))
            return false; // 0x6b3c87
    }
    return true; // 0x6b3cbc
}

// ---------------------------------------------------------------------------
// ApplyElevationStep - sub_6B3E60 (0x6B3E60 - 0x6B40FC).
//
// Adds 15 * delta to the masked corners of the 2x2 grid block at (x, y). Each
// write is journalled first and kept only while the new value stays in
// [0, 180]; every touched point is validated (ValidateElevationStep) and a
// failure rolls the whole journal back and fails the step.
//
// The driver always calls this with the flag = 0 (0x5a369a `xor dl, dl`),
// which is why the vanilla's third journal byte and its "keep going on a
// blocked point" branch are both dead here.
// ---------------------------------------------------------------------------
export function applyElevationStep(r: Rmg, delta: number, x: number, y: number, mask: number): boolean {
    journalOf(r).length = 0; // 0x6b3e7a
    const j = journalOf(r);

    // elevationStepMask hands the mask over in its own corner order -
    // e(x,y), e(x+1,y), e(x+1,y+1), e(x,y+1) - while this function walks the
    // 2x2 block row by row: e(x,y), e(x+1,y), e(x,y+1), e(x+1,y+1). The
    // disassembly swaps the two middle bits for that (0x6b3ebd).
    const walkMask = (mask & 3)
        | (2 * (mask & 4))
        | ((mask >>> 1) & 4);

    for (let k = 0; k < 4; ++k) {
        if ((walkMask & (1 << k)) === 0)
            continue;

        const nx = i16(x + (k & 1));
        const ny = i16(y + ((k >> 1) & 1));
        const index = (nx - r.elevLeft) + r.elevStride * (ny - r.elevTop);
        if (!elevationIndexInRange(r, index))
            continue;

        const entry = r.elevGrid[index];

        if (entry.blocked !== 0) {
            // 0x6b4089: with the driver's flag = 0 a blocked point aborts the
            // step and undoes everything written so far.
            rollbackElevationJournal(r);
            return false;
        }

        const original = entry.corner;
        entry.corner = 15 * delta + original; // 0x6b3f42
        if (entry.corner < 0 || entry.corner > 180) // 0x6b3f4f
            entry.corner = original; // 0x6b3fe8: undone in place
        else
            j.push({ index, oldCorner: original }); // 0x6b3faf
        entry.touched = 1; // 0x6b3fcf

        if (!validateElevationStep(r, delta, nx, ny)) // 0x6b3fe2
        {
            rollbackElevationJournal(r);
            return false;
        }
    }

    j.length = 0; // 0x6b40bc
    return true;
}

// ---------------------------------------------------------------------------
// Step 5 - FinalizeElevationSlopes (sub_6B3850, 0x6B3850 - 0x6B3A7C).
//
// Walks the diamond; for a cell whose 2x2 grid block was touched, with
// max - min <= 15 and the cell a valid target (CanHostSlope):
//     cell->Level = min / 15
//     the four corners -= min           // the normalized pattern
//     SlopeIndex   = the pattern's index in kSlopeCorners (0..18)
//     IsoTileTypeIndex = SlopeIndex ? rampBaseIndex + SlopeIndex - 1
//                                   : clearTileIndex
// then frees the grid.
// ---------------------------------------------------------------------------
export function finalizeElevationSlopes(r: Rmg): void {
    if (r.cellSlots.length === 0 || r.elevGrid.length === 0)
        return;

    const it = new CellIterator();
    it.reset(r.cellSlots, r.size.mapWidth); // 0x6b3858
    for (let cell = it.next(); cell !== null; cell = it.next()) {
        const x = unpX(cell.mapCoords);
        const y = unpYS(cell.mapCoords);
        const indexA = (x - r.elevLeft) + r.elevStride * (y - r.elevTop);
        const indexB = indexA + r.elevStride; // the row below
        const index = [indexA, indexA + 1, indexB + 1, indexB];

        // 0x6b38c7: only cells whose 2x2 block has a touched grid point are
        // considered at all.
        let touched = false;
        for (let k = 0; k < 4 && !touched; ++k)
            touched = elevationIndexInRange(r, index[k])
                && r.elevGrid[index[k]].touched !== 0;
        if (!touched)
            continue;

        // The four corners, in this function's order (0x6b38db - 0x6b3913):
        // e(x,y), e(x + 1,y), e(x + 1,y + 1), e(x,y + 1).
        const corner = [0, 0, 0, 0];
        let lowest = 1000; // 0x6b38f6
        let highest = 0; // 0x6b38fb
        for (let k = 0; k < 4; ++k) {
            corner[k] = elevationCornerAt(r, index[k]);
            if (corner[k] < lowest)
                lowest = corner[k];
            if (corner[k] > highest)
                highest = corner[k];
        }
        if (highest - lowest > 15) // 0x6b391a
            continue; // more than one level

        if (!canHostSlope(r, x, y)) // 0x6b396f - 0x6b39b2
            continue;

        // Port tuning (user reports 2026-10-01): refuse a hill micro-slope
        // that shares an EDGE with a CliffSet facade two or more levels higher
        // unless that edge already holds a same-level CliffSet foot cell
        // (whose art renders the intervening wall). Only ORTHOGONAL
        // neighbours count: diagonal L4-slope/L8-cliff touches are a
        // vanilla-legal configuration and suppressing those deleted a
        // legitimate connecting band slope at (90,121) in rmg_085817.
        {
            const newLevel = Math.trunc(lowest / 15);
            const oDX = [0, 1, 0, -1];
            const oDY = [-1, 0, 1, 0];
            let block = false;
            for (let sd = 0; sd < 4; ++sd) {
                // CellAt never returns null (it falls back to the shared
                // InvalidCell sentinel), so the vanilla's null check is
                // vacuous and the sentinel's fields would be tested too.
                const oq = r.cellAt(i16(x + oDX[sd]), i16(y + oDY[sd]));
                if (oq.isoTileTypeIndex >= r.shoreTileIndex
                    && oq.isoTileTypeIndex <= r.shoreTileIndex + 39
                    && oq.level - newLevel >= 2) {
                    block = true;
                    break;
                }
            }
            if (block) {
                let sameLevelFoot = false;
                for (let sd = 0; sd < 4; ++sd) {
                    const sq = r.cellAt(i16(x + oDX[sd]), i16(y + oDY[sd]));
                    if (sq.isoTileTypeIndex >= r.shoreTileIndex
                        && sq.isoTileTypeIndex <= r.shoreTileIndex + 39
                        && sq.level === newLevel) {
                        sameLevelFoot = true;
                        break;
                    }
                }
                if (!sameLevelFoot)
                    continue;
            }
        }

        // 0x6b39dc: the level. Written BEFORE the pattern lookup, so a cell
        // whose corner pattern is not in the table still has its level
        // updated - only the slope and the tile are skipped for it.
        cell.level = Math.trunc(lowest / 15);

        for (let k = 0; k < 4; ++k) // 0x6b39ea
            corner[k] -= lowest; // the normalized pattern

        // 0x6b39f9: find that pattern in kSlopeCorners (0..18; running past
        // the end leaves the cell with just its new level).
        let slope = -1;
        for (let k = 0; k < 19; ++k) {
            if (K_SLOPE_CORNERS[k][0] === corner[0]
                && K_SLOPE_CORNERS[k][1] === corner[1]
                && K_SLOPE_CORNERS[k][2] === corner[2]
                && K_SLOPE_CORNERS[k][3] === corner[3]) {
                slope = k;
                break;
            }
        }
        if (slope < 0)
            continue; // 0x6b3a25 -> LABEL_36

        cell.slopeIndex = slope; // 0x6b3a2b
        cell.isoTileTypeIndex = slope !== 0
            ? r.rampBaseIndex + slope - 1 // 0x6b3a40 (0xABC1D8)
            : r.clearTileIndex; // 0x6b3a33 (0xAA10B0)
    }

    // 0x6b3a68: the scratch grid is freed and dword_B0B6EC cleared.
    r.elevGrid.length = 0;
}

// ---------------------------------------------------------------------------
// Step 6 - MergeSlopeBlocks (the inline merge at 0x5A36CB - 0x5A38A9).
//
// Walks the diamond and, for a cell whose SlopeIndex is 5 or 11, checks the
// 2x2 block it anchors - the four cells in order (0,0) (1,0) (1,1) (0,1):
//     SlopeIndex == 5  -> they must be 5 / 6 / 7 / 8
//     SlopeIndex == 11 -> they must be 11 / 12 / 9 / 10
// When all four match, each of the four cells is stamped
//     IsoTileTypeIndex = 0xFFFF, Height = 0, SlopeIndex = 0
// and, only for the 11 case, Level += 1.
// ---------------------------------------------------------------------------
export function mergeSlopeBlocks(r: Rmg): void {
    if (r.cellSlots.length === 0)
        return;

    // The four cells of the block, in the vanilla's packed-offset order
    // v33 = { (0,0), (1,0), (1,1), (0,1) } (0x5a36f1 - 0x5a3729).
    const K_OFF_X = [0, 1, 1, 0];
    const K_OFF_Y = [0, 0, 1, 1];
    // v34 (0x5a372d - 0x5a3745): the slope each cell must carry when the
    // anchor's slope is 11. For a slope-5 anchor the expected values are
    // simply 5, 6, 7, 8 in the same order.
    const K_EXPECTED_11 = [11, 12, 9, 10];

    const it = new CellIterator();
    it.reset(r.cellSlots, r.size.mapWidth); // 0x5a36cb
    for (let cell = it.next(); cell !== null; cell = it.next()) {
        const x = unpX(cell.mapCoords);
        const y = unpYS(cell.mapCoords);
        const anchor = cell.slopeIndex; // 0x5a375a

        // Only the two anchor slopes take part; everything else is skipped
        // (0x5a3769 / 0x5a37c9 / LABEL_24). The 11 case also bumps the level.
        let bump: number;
        if (anchor === 5)
            bump = 0;
        else if (anchor === 11)
            bump = 1;
        else
            continue;

        // The block merges only when all four cells carry the expected slope
        // (0x5a37b5 for the 5 case, 0x5a3816 for the 11 case). The vanilla
        // keeps scanning after a mismatch - only the flag is cleared - so
        // this loop does too.
        let allMatch = true; // v25
        for (let k = 0; k < 4; ++k) {
            const expected = anchor === 5 ? k + 5 : K_EXPECTED_11[k];
            if (r.cellAt(i16(x + K_OFF_X[k]), i16(y + K_OFF_Y[k])).slopeIndex !== expected)
                allMatch = false;
        }
        if (!allMatch) // LABEL_21
            continue;

        // Port tuning (user report 2026-10-01): do not collapse a slope block
        // when it sits right against a carved region ramp (CliffRamps 384-393)
        // or a CliffSet facade outside the block. Vanilla's saved maps never
        // carry a merged 0xFFFF cell on such a seam; collapsing here stamped
        // empty cells beside the ramp and left white wall triangles (e.g.
        // rmg_090407 near the 386/387 strips). On open ground the merge
        // proceeds exactly as vanilla.
        {
            let touchesArt = false;
            for (let k = 0; k < 4 && !touchesArt; ++k) {
                const bx = i16(x + K_OFF_X[k]);
                const by = i16(y + K_OFF_Y[k]);
                for (let adx = -1; adx <= 1 && !touchesArt; ++adx) {
                    for (let ady = -1; ady <= 1; ++ady) {
                        if (adx === 0 && ady === 0)
                            continue;
                        const ax = i16(bx + adx);
                        const ay = i16(by + ady);
                        // ignore the other three cells of this very block
                        if (ax >= x && ax <= x + 1 && ay >= y && ay <= y + 1)
                            continue;
                        const aq = r.cellAt(ax, ay);
                        const at = aq.isoTileTypeIndex;
                        if ((at >= r.cliffRampsIndex && at <= r.cliffRampsIndex + 9)
                            || (at >= r.shoreTileIndex
                                && at <= r.shoreTileIndex + 39)) {
                            touchesArt = true;
                            break;
                        }
                    }
                }
            }
            if (touchesArt)
                continue;
        }

        // Collapse the four cells into the multi-cell tile
        // (0x5a382b - 0x5a3891): 0xFFFF is the "no own tile" mark the delta
        // corners use too.
        for (let k = 0; k < 4; ++k) {
            const c = r.cellAt(i16(x + K_OFF_X[k]), i16(y + K_OFF_Y[k]));
            const level = c.level; // 0x5a386a
            c.isoTileTypeIndex = 0xffff; // 0x5a3876
            c.height = 0; // 0x5a387d
            c.slopeIndex = 0; // 0x5a3884
            c.level = Math.min(10, bump + level); // 0x5a388b + [QUALITY-FIX]
        }
    }
}

// ---------------------------------------------------------------------------
// RemoveCliffsOverRamps - port-only final sweep.
//
// PlaceCliffPiece's pre-stamp guard can only see ramps that exist while
// cliffs are placed. FinalizeElevationSlopes runs later (this stage) and lays
// micro slope tiles (RampBase + slope - 1) from the final elevation corner
// pattern, so a CliffSet piece accepted earlier can finish with a wall cell
// riding a freshly laid ramp body.
//
// Group the surviving CliffSet cells back into pieces (a piece's sub-cell
// Height is col + row*CellsInX, so the anchor inverts with modulo / divide),
// find the riding wall cells (IsCliffWallRiding), erase the piece and stamp
// smaller CliffSet art on the surviving cells instead of leaving bare ground:
//   - 2x2 walls (slots 4-7) whose east column rides collapse to the C8 1x2
//     vertical strip on the west column;
//   - every other surviving wall cell becomes C34 (t82), surviving feet one
//     of C12..C14;
//   - only the riding cells themselves go back to t0 (the ramp corridor the
//     game loader fills).
// Ramp-top seam pieces (a wall met at its own level by a ramp top cell) are
// left untouched - their facade is required art.
// ---------------------------------------------------------------------------
interface UnwallMember {
    x: number;
    y: number;
    h: number;
    level: number;
}
interface UnwallPiece {
    tile: number;
    ax: number;
    ay: number;
    cells: UnwallMember[];
}

export function removeCliffsOverRamps(r: Rmg): void {
    if (r.cellSlots.length === 0 || r.shoreTileIndex < 0)
        return;

    const pieces: UnwallPiece[] = [];

    const it = new CellIterator();
    it.reset(r.cellSlots, r.size.mapWidth);
    for (let cell = it.next(); cell !== null; cell = it.next()) {
        const t = cell.isoTileTypeIndex;
        if (t < r.shoreTileIndex || t >= r.shoreTileIndex + 40)
            continue;
        const x = unpX(cell.mapCoords);
        const y = unpYS(cell.mapCoords);
        const w = cliffCellsInX(r, t);
        const ax = x - (cell.height % w);
        const ay = y - Math.trunc(cell.height / w);

        let found: UnwallPiece | null = null;
        for (const pc of pieces) {
            if (pc.tile === t && pc.ax === ax && pc.ay === ay) {
                found = pc;
                break;
            }
        }
        if (found === null) {
            found = { tile: t, ax: i16(ax), ay: i16(ay), cells: [] };
            pieces.push(found);
        }
        found.cells.push({ x, y, h: cell.height, level: cell.level });
    }

    const tVStrip = r.shoreTileIndex + 7; // C8
    const tWallCap = r.shoreTileIndex + 33; // C34
    const tFlatBase = r.shoreTileIndex + 11; // C12..14

    diag(`UNWALL-START pieces=${pieces.length >>> 0} shoreBase=${r.shoreTileIndex} slopeSetBase=${r.slopeSetPiecesIndex}`);
    for (const pc of pieces) {
        const slot = pc.tile - r.shoreTileIndex + 1;
        const riders: UnwallMember[] = [];
        for (const m of pc.cells) {
            if (m.level >= 7 && isCliffWallRiding(r, m.x, m.y, m.level))
                riders.push(m);
        }
        if (riders.length === 0)
            continue;

        // Take the piece off first; only the non-riding members get new art.
        for (const m of pc.cells) {
            // CellAt never returns null (shared InvalidCell sentinel).
            const c = r.cellAt(m.x, m.y);
            diag(`CLIFF-UNWALL t${pc.tile} anchor=(${pc.ax},${pc.ay}) cell=(${m.x},${m.y}) L${m.level}`);
            c.isoTileTypeIndex = 0;
            c.height = 0;
        }

        const isRider = (h: number): boolean => {
            for (const rd of riders)
                if (rd.h === h) return true;
            return false;
        };
        const memberAt = (h: number): UnwallMember | null => {
            for (const m of pc.cells)
                if (m.h === h) return m;
            return null;
        };
        const restamp = (x: number, y: number, tile: number, height: number, level: number): void => {
            const c = r.cellAt(i16(x), i16(y));
            if (c.isoTileTypeIndex !== 0)
                return; // ramp / other art
            diag(`CLIFF-REWALL t${pc.tile} (${x},${y}) -> t${tile}/h${height} L${level}`);
            c.isoTileTypeIndex = tile;
            c.height = height & 0xff; // static_cast<uint8_t>
            c.level = level;
        };

        // C8: west column h0 wall + h2 foot survives, east column rides.
        const westTop = memberAt(0);
        const westFoot = memberAt(2);
        if (slot >= 4 && slot <= 7
            && westTop !== null && westTop.level >= 7 && !isRider(0)
            && westFoot !== null && westFoot.level <= 5 && !isRider(2)) {
            restamp(westTop.x, westTop.y, tVStrip, 0, westTop.level);
            restamp(westFoot.x, westFoot.y, tVStrip, 1, westFoot.level);
            continue;
        }

        for (const m of pc.cells) {
            if (isRider(m.h))
                continue; // stays t0
            if (m.level >= 7)
                restamp(m.x, m.y, tWallCap, 0, m.level);
            else
                restamp(m.x, m.y, tFlatBase + (pc.ax + pc.ay + m.h) % 3, 0, m.level);
        }

        // Riding wall cells keep tile=0, but their Level was bumped by the
        // wall's z=4 during placement. Restore the pre-wall ground level so a
        // lowered cliff-base cell does not get stranded at the wall height.
        for (const rd of riders) {
            const c = r.cellAt(rd.x, rd.y);
            if (c.isoTileTypeIndex === 0)
                c.level = rd.level - 4;
        }
    }
}
