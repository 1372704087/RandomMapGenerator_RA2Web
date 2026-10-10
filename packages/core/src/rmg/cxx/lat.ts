/**
 * Transliteration of G:/MapGenerator MapGenLAT.cpp - the
 * "RMG: Creating LATs, rocks etc" stage (sub_598960 slice @ 0x599215).
 *
 *   createLats             the stage body (four calls, one per step)
 *   prepareLATDensities    sub_5A38C0 - the per-cell density doubles
 *   scatterLATBlobs        sub_5A3AE0 - LAT blobs + SetupLAT + tree patches
 *                          + the overlay 168..177 tail
 *   resetLATDensityFields  the inline 0x59923E loop (+0x20 = 0.001, +0x28
 *                          = 0.005 on every cell)
 *   scatterRocks           sub_5A4280 - rock blobs + SetupLAT + tree patches
 *   placeBlob              sub_5A4B60 - best-first jittered blob growth
 *   scatterTrees           sub_5A45E0 - TREE01..25 planting
 *   placeGreenPatches      the tree-patch loop the vanilla inlines twice
 *   pruneTerrainTrees      [port-only] final misplaced-tree removal
 *   isStartClearArea /
 *   isOreClearArea         [port-only] starting-point clear-area tests
 *   isClearToSandLatTile   sub_486790
 *
 * The three LAT density doubles live in the work array as raw f64 slots:
 * WorkCell is `int data[20]` (80 bytes) and the C++ stores through
 * `reinterpret_cast<double*>(w.data + 6 / +8 / +10)`, i.e. byte offsets
 * +0x18 (24) / +0x20 (32) / +0x28 (40) of each cell record. Access here
 * goes through a DataView over work.bytes (f64 little-endian).
 */

import type { Rmg } from './mapGen';

import {
    CellIterator,
    DIR_X,
    DIR_Y,
    LandType,
    MapCell,
    MapTerrainObjectRec,
    i16,
    packXY,
    unpX,
    unpY,
    unpYS,
} from './types';
import { F2I64, K_UNIT_SCALE } from './mathTables';
import { diag } from './diag';
// river: the stage's tile-family predicates (PORTING.md rule 5 keeps the
// graph acyclic; river itself only depends on lake).
import {
    isShoreTile,
    isGreenGroundTile,
    isMiscPaveTile,
    isPaveTile,
} from './river';
// recalc: SetupLAT (sub_47CA80) and RecalcAttributes (sub_47D2B0) are shared
// pipeline stages - recalc imports nothing at runtime, so lat -> recalc is
// acyclic (reported deviation from the strict "river only" note).
import { setupLAT, recalcAttributes } from './recalc';

// ---------------------------------------------------------------------------
// Constants.
// ---------------------------------------------------------------------------

/** AltCellFlags bit 0x2 (ContainsBuilding) - the "occupied" stand-in. */
const K_ALT_CELL_FLAGS_CONTAINS_BUILDING = 0x2;

/** WorkCell stride: `int data[20]` = 80 bytes. */
const K_WORK_STRIDE = 80;
/** work +0x18 - the GreenTile probability double (w.data + 6). */
const K_DENSITY18 = 24;
/** work +0x20 - the SandTile threshold double (w.data + 8). */
const K_DENSITY20 = 32;
/** work +0x28 - the RoughTile threshold / rock probability double (w.data + 10). */
const K_DENSITY28 = 40;

/** The TREE01..25 names (sprintf("TREE%d%d", n / 10, n % 10), n in 1..25). */
const K_TREE_NAMES: readonly string[] = [
    'TREE01', 'TREE02', 'TREE03', 'TREE04', 'TREE05',
    'TREE06', 'TREE07', 'TREE08', 'TREE09', 'TREE10',
    'TREE11', 'TREE12', 'TREE13', 'TREE14', 'TREE15',
    'TREE16', 'TREE17', 'TREE18', 'TREE19', 'TREE20',
    'TREE21', 'TREE22', 'TREE23', 'TREE24', 'TREE25',
];

// ---------------------------------------------------------------------------
// f64 access over the work array (the density doubles).
// ---------------------------------------------------------------------------
const workViews = new WeakMap<Uint8Array, DataView>();

function workView(r: Rmg): DataView {
    const bytes = r.work.bytes;
    let view = workViews.get(bytes);
    if (view === undefined) {
        view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        workViews.set(bytes, view);
    }
    return view;
}

/** work.double(byteOff) of work cell `index` (little-endian f64). */
function workDensity(r: Rmg, index: number, byteOff: number): number {
    return workView(r).getFloat64(index * K_WORK_STRIDE + byteOff, true);
}

function setWorkDensity(r: Rmg, index: number, byteOff: number, v: number): void {
    workView(r).setFloat64(index * K_WORK_STRIDE + byteOff, v, true);
}

// ---------------------------------------------------------------------------
// Shared small helpers.
// ---------------------------------------------------------------------------

/**
 * One raw-uniform draw in [0, 1): the vanilla's
 * `static_cast<double>(static_cast<uint32_t>(rng_.Next())) * kUnitScale`.
 */
function rawUniform(r: Rmg): number {
    return (r.rng.next() >>> 0) * K_UNIT_SCALE;
}

/** One heap node of PlaceBlob / ScatterTrees: packed coords + float key. */
interface BlobNode {
    packed: number;
    priority: number; // float storage -> fround on write
}

/**
 * The 20-byte heap control block both scatterers use: a 1-based min-heap of
 * pool indices with sift-up insert (refused while `heap.length >= capacity`)
 * and root-pop + sift-down (sub_5AD870(1)). Textually identical in
 * sub_5A4B60 and sub_5A45E0.
 */
function makeBlobHeap(pool: BlobNode[], capacity: number): {
    push(node: number): void;
    pop(): number;
} {
    const heap: number[] = [-1]; // slot 0 unused sentinel

    const push = (node: number): void => {
        if (heap.length >= capacity) return;
        heap.push(node);
        let i = heap.length - 1;
        while (i > 1 && pool[heap[i >> 1]].priority > pool[heap[i]].priority) {
            const t = heap[i >> 1];
            heap[i >> 1] = heap[i];
            heap[i] = t;
            i >>= 1;
        }
    };

    const pop = (): number => {
        if (heap.length <= 1) return -1;
        const root = heap[1];
        heap[1] = heap[heap.length - 1];
        heap.pop();
        const last = heap.length - 1;
        let i = 1;
        for (;;) {
            let m = i;
            const l = 2 * i;
            const rr = 2 * i + 1;
            if (l <= last && pool[heap[l]].priority < pool[heap[m]].priority) m = l;
            if (rr <= last && pool[heap[rr]].priority < pool[heap[m]].priority) m = rr;
            if (m === i) break;
            const t = heap[i];
            heap[i] = heap[m];
            heap[m] = t;
            i = m;
        }
        return root;
    };

    return { push, pop };
}

// ---------------------------------------------------------------------------
// The stage body - the four calls of sub_598960's slice, in order.
// ---------------------------------------------------------------------------
export function createLats(r: Rmg): void {
    prepareLATDensities(r);       // 0x59922B  sub_5A38C0
    scatterLATBlobs(r);           // 0x599232  sub_5A3AE0
    resetLATDensityFields(r);     // 0x59923E  the inline loop
    scatterRocks(r);              // 0x5992AB  sub_5A4280
}

// ---------------------------------------------------------------------------
// Step 1 - PrepareLATDensities (sub_5A38C0, 0x5A38C0 - 0x5A3A50).
//
// The vanilla walks a 5x5 block around every shore cell but stores through
// the SAME work pointer, so it collapses to one write per cell. The else
// branch runs when work.double(+0x28) == 0.0 - taken by every non-shore cell
// on a fresh map. No RNG.
// ---------------------------------------------------------------------------
export function prepareLATDensities(r: Rmg): void {
    if (r.cellSlots.length === 0 || r.work.count === 0) return;

    // this[23] - GlobalMapOptions::vegetation (60..100 with the shipped INI).
    const half = r.globalOptions.vegetation * 0.01;

    const it = new CellIterator();
    it.reset(r.cellSlots, r.size.mapWidth);          // 0x5a38d4
    for (let cell = it.next(); cell !== null; cell = it.next()) {
        const x = cell.mapCoords & 0xffff;
        const y = cell.mapCoords >>> 16;
        const idx = r.workIndex(x, y);               // 0x5a3920

        if (isShoreTile(r, cell)) {                  // 0x5a3922 sub_4865B0
            setWorkDensity(r, idx, K_DENSITY28, 0.005);            // 0x7ED7D8 / 0x7ED7DC
            setWorkDensity(r, idx, K_DENSITY20, 0.0);              // 0x5a39b6 / 0x5a39b9
            setWorkDensity(r, idx, K_DENSITY18, 0.02 * half * 10.0); // 0x7ED7E0, x 10.0
        } else if (workDensity(r, idx, K_DENSITY28) === 0.0) {   // 0x5a39f5 - 0x5a3a03
            setWorkDensity(r, idx, K_DENSITY28, 0.005);
            setWorkDensity(r, idx, K_DENSITY18, 0.02 * half);
            setWorkDensity(r, idx, K_DENSITY20, 0.005);
        }
    }
}

// ---------------------------------------------------------------------------
// IsClearToSandLatTile - sub_486790 (0x486790 - 0x4867B4).
//
// The vanilla does NOT guard against the family index being unset (-1), and
// neither does this: with an unset index the comparison accepts tiles 0..14,
// exactly as the engine's would.
// ---------------------------------------------------------------------------
export function isClearToSandLatTile(r: Rmg, cell: MapCell): boolean {
    const tile = cell.isoTileTypeIndex;
    return tile >= r.clearToSandLatIndex && tile < r.clearToSandLatIndex + 16;
}

// ---------------------------------------------------------------------------
// Step 2 - ScatterLATBlobs (sub_5A3AE0, 0x5A3AE0 - 0x5A4279).
//
//   1. clear work dword +0x3C on every cell;
//   2. three "blob count" uniforms, draw order Rough / Sand / Green;
//   3. the LAT pass (first branch that fires wins);
//   4. SetupLAT for every cell;
//   5. the tree-patch loop (PlaceGreenPatches);
//   6. the overlay tail (168..177 family).
// ---------------------------------------------------------------------------
export function scatterLATBlobs(r: Rmg): void {
    if (r.cellSlots.length === 0 || r.work.count === 0) return;

    const slotCount = r.size.workSide * r.size.workSide;

    // ---- 1. clear the access mark (work dword +0x3C) on every cell ---------
    // 0x5a3af8 - 0x5a3b35.
    {
        const it = new CellIterator();
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {
            const x = cell.mapCoords & 0xffff;
            const y = cell.mapCoords >>> 16;
            r.work.setI(r.workIndex(x, y), 15, 0);
        }
    }

    // ---- 2. the three blob counts (0x5a3b47 - 0x5a3be6) --------------------
    // Each is F2I64(uniform() * 21 + 20), rejected while > 40 (20..40). The
    // draw order is Rough (var_4C), Sand (var_54), Green (var_3C).
    const drawBlobCount = (): number => {
        let n: number;
        do {
            n = F2I64(rawUniform(r) * 21.0 + 20.0);
        } while (n > 40);
        return n;
    };
    const countRough = drawBlobCount();           // 0x5a3b62 var_4C
    const countSand = drawBlobCount();            // 0x5a3b92 var_54
    const countGreen = drawBlobCount();           // 0x5a3bc2 var_3C

    // The clipped Gaussian + PlaceBlob every branch ends with (0x5a3c92 -
    // 0x5a3d3a, 0x5a3d6d - 0x5a3e16, 0x5a3e49 - 0x5a3ef7): span 20 / centre n,
    // replaced by 38 / 42 when the window would not fit, clipped to [4, 80].
    const placeBlobClipped = (cell: MapCell, tileIndex: number, centre: number, slot: number): void => {
        let span = 20.0;
        let mean = centre;
        if (mean - 20.0 > 80.0 || mean + 20.0 < 4.0) {
            span = 38.0;
            mean = 42.0;
        }
        let size: number;
        do {
            size = r.rng.gaussian() * span + mean;
        } while (size < 4.0 || size > 80.0);
        placeBlob(r, cell, tileIndex, F2I64(size), slot, false);
    };

    // ---- 3. the LAT pass (0x5a3bea - 0x5a3f0a) ----------------------------
    // The fall-through of the first threshold test is the ROUGH tile, the
    // second the SAND tile and the third the GREEN tile.
    {
        const it = new CellIterator();
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {
            const x = cell.mapCoords & 0xffff;
            const y = cell.mapCoords >>> 16;
            const idx = r.workIndex(x, y);

            const density18 = workDensity(r, idx, K_DENSITY18);
            const density20 = workDensity(r, idx, K_DENSITY20);
            const density28 = workDensity(r, idx, K_DENSITY28);

            // 0x5a3c47: placeholder tile, flat, no overlay, no object and not
            // hill-protected.
            if (!r.isPlaceholderTile(cell)
                || cell.slopeIndex !== 0
                || cell.overlayTypeIndex !== -1
                || (cell.altFlags & K_ALT_CELL_FLAGS_CONTAINS_BUILDING) !== 0
                || r.work.byte(idx, 69) !== 0)
                continue;

            const slot = x + (y << 9);                // 0x5a3c67

            if (rawUniform(r) >= density18)           // 0x5a3c88
            {
                if (rawUniform(r) >= density28)       // 0x5a3d63
                {
                    if (rawUniform(r) < density20)    // 0x5a3e3f
                        placeBlobClipped(cell, r.greenTileIndex, countGreen, slot);
                }
                else
                {
                    placeBlobClipped(cell, r.sandTileIndex, countSand, slot);
                }
            }
            else
            {
                placeBlobClipped(cell, r.roughTileIndex, countRough, slot);
            }
        }
    }

    // ---- 4. SetupLAT refresh (0x5a3f19 - 0x5a3f2e) ------------------------
    {
        const it = new CellIterator();
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next())
            setupLAT(r, cell);
    }

    // ---- 5. the green patch loop ------------------------------------------
    placeGreenPatches(r);                             // 0x5a3f6c - 0x5a40bd

    // ---- 6. the overlay tail (0x5a40df - 0x5a4271) ------------------------
    // m = sub_42B1F0() / 200 = 2 * W * (H + 4) / 200, then at most n successful
    // plantings (n uniform in [0, m]) out of at most 5 * n attempts.
    const overlayRange = Math.trunc((2 * r.size.mapWidth * (r.size.mapHeight + 4)) / 200);

    let overlayCount: number;
    do {
        overlayCount = F2I64(rawUniform(r) * (overlayRange + 1));
    } while (overlayCount > overlayRange);            // 0x5a4119

    let successes = 0;                                // v37
    let attempts = 0;                                 // v35
    for (;;) {
        if (successes >= overlayCount)                // 0x5a4133
            return;

        // A random work slot whose packed coords are not (0,0) - no attempt cap
        // here, unlike the patch loop above (0x5a4141 - 0x5a419c). The index
        // draw keeps the vanilla's `while (index > slotCount - 1)` rejection.
        let packed: number;
        do {
            let slot: number;
            do {
                slot = F2I64(rawUniform(r) * slotCount);
            } while (slot > slotCount - 1);
            packed = r.work.i(slot, 0);
        } while (packed === 0);

        const ovX = unpX(packed);
        const ovY = unpYS(packed);
        const cell = r.cellAt(ovX, ovY);

        // [移植侧] 出生点净场 6x6 内不放这种随机地面 overlay（168..177）。
        // 跳过本格继续重抽，不影响别处 overlay 数量目标。
        // 科技建筑地基格同样不铺：地基上不能有任何覆盖物。
        if (isStartClearArea(r, ovX, ovY)
            || (cell.altFlags & K_ALT_CELL_FLAGS_CONTAINS_BUILDING) !== 0)
            continue;

        if (cell.overlayTypeIndex === -1)             // 0x5a41cd
        {
            let type = -1;
            if (isClearToSandLatTile(r, cell))        // 0x5a41d5
            {
                let pick: number;
                do {
                    pick = F2I64(rawUniform(r) * 5.0);
                } while (pick > 4);
                type = pick + 168;
            }
            else if (r.isPlaceholderTile(cell)
                || isGreenGroundTile(r, cell))        // 0x5a421f
            {
                let pick: number;
                do {
                    pick = F2I64(rawUniform(r) * 5.0);
                } while (pick > 4);
                type = pick + 173;
            }

            if (type >= 0)
                cell.overlayTypeIndex = type;         // 0x5a424c

            // 0x5a424f zeroes the cell byte at +0x11E, which the port does not
            // model and never writes - a no-op here.
            recalcAttributes(r, cell, -1);            // 0x5a4259
            ++successes;                              // 0x5a425e
        }

        ++attempts;
        if (attempts >= 5 * overlayCount)             // 0x5a4271
            return;
    }
}

// ---------------------------------------------------------------------------
// Step 3 - ResetLATDensityFields (the inline loop at 0x59923E - 0x5992A9).
//
// Writes the two doubles 0.005 (+0x28) and 0.001 (+0x20) on every diamond
// cell. Does NOT touch +0x18, so a shore cell keeps the value
// PrepareLATDensities gave it. No RNG.
// ---------------------------------------------------------------------------
export function resetLATDensityFields(r: Rmg): void {
    if (r.cellSlots.length === 0 || r.work.count === 0) return;

    const it = new CellIterator();
    it.reset(r.cellSlots, r.size.mapWidth);           // 0x59923e sub_578350
    for (let cell = it.next(); cell !== null; cell = it.next()) {
        const x = cell.mapCoords & 0xffff;
        const y = cell.mapCoords >>> 16;
        const idx = r.workIndex(x, y);                // 0x599251 - 0x59927b

        // The vanilla stores four dwords (0x599283 - 0x599298):
        //   +0x28 / +0x2C = 0x7ED7F0 / 0x7ED7F4  ->  the double 0.005
        //   +0x20 / +0x24 = 0x7ED7F8 / 0x7ED7FC  ->  the double 0.001
        setWorkDensity(r, idx, K_DENSITY28, 0.005);
        setWorkDensity(r, idx, K_DENSITY20, 0.001);
    }
}

// ---------------------------------------------------------------------------
// PlaceGreenPatches - the loop the vanilla INLINES TWICE: at the end of
// sub_5A3AE0 (0x5a3f6c - 0x5a40bd) and at the end of sub_5A4280 (0x5a4433 -
// 0x5a45cf), with identical code.
//
// The slot pick uses sub_598030 (rng.randomFloatRange: float scaling + upper
// rejection), NOT Randomizer::RandomRanged.
// ---------------------------------------------------------------------------
export function placeGreenPatches(r: Rmg): void {
    const slotCount = r.size.workSide * r.size.workSide;

    let remaining = F2I64(
        (r.config.sizeSlider * 0.1 + 0.7)
        * (r.globalOptions.vegetation * 0.01)
        * r.settings.MaxTrees);

    let patches = 0;
    while (remaining > 0) {
        if (patches >= 100)
            break;

        let chosenX = 0;
        let chosenY = 0;
        let attempts = 0;
        for (;;) {
            let packed: number;
            do {
                const slot = r.rng.randomFloatRange(0, slotCount - 1);
                packed = r.work.i(slot, 0);
            } while (packed === 0);

            ++attempts;
            if (attempts > 200) {
                chosenX = 0;
                chosenY = 0;
                break;
            }

            chosenX = unpX(packed);
            chosenY = unpYS(packed);
            if (r.isPlaceholderTile(r.cellAt(chosenX, chosenY)))
                break;
        }

        let size: number;
        do {
            size = r.rng.gaussian() * 0.1 + 0.2;
        } while (size < 0.05 || size > 0.4);

        let count: number;
        do {
            count = r.rng.gaussian() * 10.0 + 25.0;
        } while (count < 10.0 || count > 35.0);

        remaining -= scatterTrees(r, r.cellAt(chosenX, chosenY), F2I64(count), size);
        ++patches;
    }
}

// ---------------------------------------------------------------------------
// Step 4 - ScatterRocks (sub_5A4280, 0x5A4280 - 0x5A45DD).
//
//   1. clear work dword +0x3C on every cell;
//   2. for every placeholder, flat, unprotected cell draw once and on
//      uniform() < work.double(+0x28) (= 0.005 after step 3) place a rock
//      blob of RoughTile;
//   3. SetupLAT for every cell;
//   4. the same tree-patch loop as step 2.
// ---------------------------------------------------------------------------
export function scatterRocks(r: Rmg): void {
    if (r.cellSlots.length === 0 || r.work.count === 0) return;

    // ---- 1. clear the access mark (work dword +0x3C) on every cell ---------
    // 0x5a4298 - 0x5a42d5.
    {
        const it = new CellIterator();
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {
            const x = cell.mapCoords & 0xffff;
            const y = cell.mapCoords >>> 16;
            r.work.setI(r.workIndex(x, y), 15, 0);
        }
    }

    // ---- 2. the rock pass (0x5a42e7 - 0x5a43e6) ---------------------------
    {
        const it = new CellIterator();
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {
            const x = cell.mapCoords & 0xffff;
            const y = cell.mapCoords >>> 16;
            const idx = r.workIndex(x, y);

            if (!r.isPlaceholderTile(cell))                   // 0x5a4328
                continue;
            if (cell.slopeIndex !== 0 || r.work.byte(idx, 69) !== 0)  // 0x5a4341
                continue;
            // [移植侧] 岩石种子不选在出生点净场 6x6 内。
            if (isStartClearArea(r, x, y))
                continue;
            // [移植侧] 岩石种子不选在科技建筑地基上（扩散时对地基格另有
            // 拦截，见 PlaceBlob；种子本身在扩散循环外，必须在这里挡掉，
            // 否则岩石地砖会直接盖到建筑下）。
            if ((cell.altFlags & K_ALT_CELL_FLAGS_CONTAINS_BUILDING) !== 0)
                continue;

            // 0x5a4382: the probability is work.double(+0x28), which the
            // stage's inline reset has just set to 0.005 on every cell.
            const density28 = workDensity(r, idx, K_DENSITY28);
            if (rawUniform(r) >= density28)
                continue;

            let size: number;
            do {                                              // 0x5a439a - 0x5a43ba
                size = r.rng.gaussian() * 15.0 + 20.0;
            } while (size < 4.0 || size > 60.0);

            // The rocks use RoughTile (dword_ABC2B8). The slot argument is the
            // vanilla's own expression, which carries the y << 16 term too
            // (sub_5A3AE0's equivalent is the clean x + (y << 9)); harmless,
            // since +0x3C is cleared per call and only compared for equality.
            placeBlob(r, cell, r.roughTileIndex, F2I64(size),
                cell.mapCoords + (y << 9), false,
                /*avoidStartClear=*/true);   // [移植侧] 岩石避开出生点
        }
    }

    // ---- 3. SetupLAT refresh (0x5a43f5 - 0x5a440a) ------------------------
    {
        const it = new CellIterator();
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next())
            setupLAT(r, cell);
    }

    // ---- 4. the same green patch loop -------------------------------------
    placeGreenPatches(r);                                     // 0x5a4433 - 0x5a45cf
}

// ---------------------------------------------------------------------------
// PlaceBlob - sub_5A4B60 (0x5A4B60 - 0x5A4FB0).
//
// Best-first (jittered-distance heap) growth of at most `count` cells from
// `cell`. Each accepted cell gets IsoTileTypeIndex = tileIndex and
// work.dword(+0x3C) = slotIndex. The seed is stamped with slotIndex first,
// which keeps the blob from re-entering itself. The heap key is
// sqrt(distance from the seed) + Random() * 5.0 * 2^-32.
// ---------------------------------------------------------------------------
export function placeBlob(
    r: Rmg,
    cell: MapCell,
    tileIndex: number,
    count: number,
    slotIndex: number,
    allowLatToLat: boolean,
    avoidStartClear = false,
): void {
    if (count <= 0)
        return;

    // 0x5a4b72: 10 * count nodes; 0x5a4bcc: room for 10 * count + 1 pointers.
    const capacity = 10 * count;
    const pool: BlobNode[] = new Array<BlobNode>(capacity);
    const { push, pop } = makeBlobHeap(pool, capacity);

    const seedX = unpX(cell.mapCoords);
    const seedY = unpYS(cell.mapCoords);

    let nextNode = 0;
    pool[nextNode] = { packed: cell.mapCoords, priority: 0 };  // 0x5a4c23 / 0x5a4c25
    r.work.setI(r.workIndex(seedX, seedY), 15, slotIndex);     // 0x5a4c4f (+0x3C)
    push(nextNode);
    ++nextNode;

    let processed = 0;                                         // v45
    let current = pop();                                       // 0x5a4cae - 0x5a4ce6
    while (current >= 0) {
        const packed = pool[current].packed;
        const cx = unpX(packed);
        const cy = unpYS(packed);

        // [移植侧] 岩石 blob 不盖出生点净场格，也不盖科技建筑地基格（扩散
        // 候选在下面的邻居循环里已排除地基格，但种子格不在候选循环内，要在
        // 这里一并挡住）。跳过盖章但继续扩散邻居。
        const stampBlocked =
            (avoidStartClear && isStartClearArea(r, cx, cy))
            || (r.cellAt(cx, cy).altFlags & K_ALT_CELL_FLAGS_CONTAINS_BUILDING) !== 0;
        if (!stampBlocked)
            r.cellAt(cx, cy).isoTileTypeIndex = tileIndex;     // 0x5a4d13

        for (let k = 0; k < 8; ++k) {                          // 0x5a4d44 - 0x5a4f42
            const nx = i16(cx + DIR_X[k]);
            const ny = i16(cy + DIR_Y[k]);
            if (!r.cellExists(nx, ny))
                continue;
            // [移植侧] 岩石 blob 不把净场格纳入候选，岩石不会漫进出生区。
            if (avoidStartClear && isStartClearArea(r, nx, ny))
                continue;

            const nb = r.cellAt(nx, ny);
            if (!(r.isPlaceholderTile(nb)
                || (allowLatToLat && (isMiscPaveTile(r, nb) || isPaveTile(r, nb)))))
                continue;                                      // 0x5a4dbf

            // The three acceptance clauses: the work dword +0x3C, the cell's
            // +0x11C (not modelled, always passes) and the cell's
            // OverlayTypeIndex / FirstObject.
            const widx = r.workIndex(nx, ny);
            if (r.work.i(widx, 15) === slotIndex)              // 0x5a4e1a
                continue;
            if (nb.overlayTypeIndex !== -1)
                continue;
            if ((nb.altFlags & K_ALT_CELL_FLAGS_CONTAINS_BUILDING) !== 0)
                continue;                                      // FirstObject (+0xE4)

            const dx = seedX - nx;
            const dy = seedY - ny;
            const distance = Math.sqrt(dx * dx + dy * dy);     // 0x5a4e67
            const key = Math.fround(
                distance + (r.rng.next() >>> 0) * 5.0 * K_UNIT_SCALE);  // 0x5a4ea2

            pool[nextNode] = { packed: nb.mapCoords, priority: key };  // 0x5a4e2f
            r.work.setI(widx, 15, slotIndex);                  // 0x5a4eba
            push(nextNode);                                    // 0x5a4ec3 - 0x5a4f33
            ++nextNode;
        }

        ++processed;                                           // 0x5a4f4e
        if (processed >= count)                                // 0x5a4f63
            break;
        current = pop();                                       // sub_5AC960
    }
}

// ---------------------------------------------------------------------------
// ScatterTrees - sub_5A45E0 (0x5A45E0 - 0x5A4ACD).
//
// Plants up to `count` TREE objects around `cell` and returns how many were
// planted. Per popped cell: when it carries no object, no overlay and
// LandType != 3, draw uniform() < probability and pick a tree type with
// F2I64(raw u32 * 25 * 2^-32 + 1) rejected while > 25 (1..25, the +1 bias
// keeping 00 out). Pushes the 8 neighbours while
// work.byte(+0x47) == 0 && work.byte(+0x45) == 0, marking each pushed cell
// work.byte(+0x47) = 1.
//
// Route B: the vanilla creates a real ObjectClass here; the port records one
// MapTerrainObject per tree (type name + cell).
// ---------------------------------------------------------------------------
export function scatterTrees(r: Rmg, cell: MapCell, count: number,
    probability: number): number {
    if (count <= 0)
        return 0;

    // 0x5a45f2: 25 * count nodes; 0x5a4657: room for 25 * count + 1 pointers.
    const capacity = 25 * count;
    const pool: BlobNode[] = new Array<BlobNode>(capacity);
    const { push, pop } = makeBlobHeap(pool, capacity);

    const seedX = unpX(cell.mapCoords);
    const seedY = unpYS(cell.mapCoords);

    let nextNode = 1;                                          // v41 starts at 1
    pool[0] = { packed: cell.mapCoords, priority: 0 };         // 0x5a46b0 / 0x5a46b2
    r.work.setByte(r.workIndex(seedX, seedY), 71, 1);          // 0x5a46dc
    push(0);

    let planted = 0;                                           // v42
    let current = pop();                                       // 0x5a4740 - 0x5a4783
    while (current >= 0 && nextNode < capacity) {              // 0x5a479f
        const packed = pool[current].packed;
        const cx = unpX(packed);
        const cy = unpYS(packed);

        const c = r.cellAt(cx, cy);
        if (r.isPlaceholderTile(c)) {                          // 0x5a47be
            // 0x5a47ec: no object, no overlay, and the floor class is not the
            // third one (LandType != 3, cell +0xEC).
            const eligible =
                (c.altFlags & K_ALT_CELL_FLAGS_CONTAINS_BUILDING) === 0
                && c.overlayTypeIndex === -1
                && c.landType !== 3;

            if (eligible
                && rawUniform(r) < probability) {              // 0x5a4816
                let type: number;
                do {                                           // 0x5a4826 - 0x5a4848
                    // The +1 bias is the vanilla's - n never comes out 00.
                    type = F2I64(
                        (r.rng.next() >>> 0) * 25.0 * K_UNIT_SCALE + 1.0);
                } while (type > 25);

                // Route B: record one terrain object (the vanilla creates an
                // ObjectClass via operator new(0xE0) + sub_71BB90).
                r.terrainObjects.push(
                    { coords: packXY(cx, cy), typeName: K_TREE_NAMES[type - 1] });
                ++planted;                                     // 0x5a48af
            }
        }

        for (let k = 0; k < 8; ++k) {                          // 0x5a48cc - 0x5a4a61
            const nx = i16(cx + DIR_X[k]);
            const ny = i16(cy + DIR_Y[k]);
            if (!r.cellExists(nx, ny))
                continue;

            const widx = r.workIndex(nx, ny);
            // 0x5a496c: not already planted, not hill-protected, and the pool
            // still has room.
            if (r.work.byte(widx, 71) !== 0 || r.work.byte(widx, 69) !== 0)
                continue;
            if (nextNode >= capacity)
                continue;

            const dx = seedX - nx;
            const dy = seedY - ny;
            const distance = Math.sqrt(dx * dx + dy * dy);     // 0x5a49b1
            const key = Math.fround(
                distance + (r.rng.next() >>> 0) * 5.0 * K_UNIT_SCALE);  // 0x5a49eb

            // The vanilla stores the coords it computed, not the cell's own.
            pool[nextNode] = { packed: (nx & 0xffff) | (ny << 16), priority: key };
            r.work.setByte(widx, 71, 1);                       // 0x5a49ee
            push(nextNode);
            ++nextNode;                                        // 0x5a49dd
        }

        current = pop();
        if (planted >= count)                                  // 0x5a4aaa
            break;
    }
    return planted;                                            // 0x5a4aca
}

// ---------------------------------------------------------------------------
// PruneTerrainTrees - [移植侧] 最终瓦片定型后剔除放错位置的树。
//
// 在第 4 次 RecalculateCellAttributes 之后运行：种树（ScatterTrees）在
// CreateLATs 阶段，悬崖 / 水体多格大片 footprint 内的覆盖格当时还是 0xFFFF，
// 只有所有瓦片定型后按最终格属性判定才能可靠剔除。
//
// 剔除规则（只作用于 TREE01..25，TIBTRE 矿树不动）：
//   1. 格不存在 / tile == 0xFFFF（多格片覆盖，非可站立地面）；
//   2. 水面格（IsWaterTile）；
//   3. 真悬崖墙格：CliffSet（shoreTileIndex_ 起 40 宽）或 WaterCliffs
//      （waterCliffsIndex_ 起 28 宽）。坡一律保留。
//   4. 出生点周围少放：切比雪夫距离 <= 2 全删；2 < d <= 5 按棋盘格
//      （x+y 为偶）删掉一半；更远不动。
// ---------------------------------------------------------------------------
export function pruneTerrainTrees(r: Rmg): void {
    const K_TREE_CLEAR_RADIUS = 2;    // 出生点四周此距离内不放树
    const K_TREE_SPARSE_RADIUS = 5;   // 到此距离内做棋盘格稀疏

    const isTreeObject = (name: string): boolean => {
        // 仅 TREE01..TREE25；TIBTRE01..03 前缀是 "TIBT"，不会命中。
        return name.startsWith('TREE')
            && name.charCodeAt(4) >= 48 && name.charCodeAt(4) <= 57;
    };

    const onBlockingTerrain = (c: MapCell | null): boolean => {
        if (c === null)
            return true;                       // 格不存在
        const tile = c.isoTileTypeIndex;
        if (tile === 0xffff)
            return true;                       // 多格片覆盖格
        if (r.isWaterTile(c))
            return true;                       // 水面
        if (r.shoreTileIndex !== -1
            && tile >= r.shoreTileIndex && tile < r.shoreTileIndex + 40)
            return true;                       // CliffSet 悬崖墙（40 宽）
        if (r.waterCliffsIndex !== -1
            && tile >= r.waterCliffsIndex && tile < r.waterCliffsIndex + 28)
            return true;                       // WaterCliffs 水崖（28 宽）
        return false;                          // 含坡：RampBase/CliffRamps/...
    };

    const nearStartTooClose = (x: number, y: number): number => {
        // 返回到最近出生点的切比雪夫距离（无出生点时 > kTreeSparseRadius）。
        let best = K_TREE_SPARSE_RADIUS + 1;
        for (const sp of r.startingPoints) {
            const d = Math.max(Math.abs(x - unpX(sp.coords)),
                Math.abs(y - unpY(sp.coords)));
            if (d < best) best = d;
        }
        return best;
    };

    let removedTerrain = 0;
    let removedStart = 0;
    let removedBuilding = 0;   // [移植侧] 压在科技建筑地基上的地形对象

    diag(`TREE-PRUNE-BASE water=${r.waterTileIndex} shore=${r.shoreTileIndex} waterCliffs=${r.waterCliffsIndex}`);

    // std::remove_if + erase: keep order, drop removed entries.
    const kept: MapTerrainObjectRec[] = [];
    for (const obj of r.terrainObjects) {
        const x = unpX(obj.coords);
        const y = unpY(obj.coords);
        const c = r.cellExists(x, y) ? r.cellAt(x, y) : null;

        // [移植侧] 最高优先级：任何地形对象（树、TIBTRE 矿柱，不论种类）
        // 都不允许压在科技建筑地基上。写盘前的最后一道兜底。
        if (c !== null
            && (c.altFlags & K_ALT_CELL_FLAGS_CONTAINS_BUILDING) !== 0) {
            ++removedBuilding;
            diag(`TREE-PRUNE-BUILDING (${x},${y}) ${obj.typeName} tile=${c.isoTileTypeIndex}`);
            continue;
        }

        if (!isTreeObject(obj.typeName)) {
            kept.push(obj);                // 非树（矿树等）一律保留
            continue;
        }

        const tileNow = c !== null ? c.isoTileTypeIndex : -1;

        if (onBlockingTerrain(c)) {
            ++removedTerrain;
            diag(`TREE-PRUNE-DEL (${x},${y}) ${obj.typeName} tile=${tileNow}`);
            continue;
        }

        // [TEMP DIAG] 视觉水/崖硬编码区间 vs 运行时基址判据对不上时打印。
        if ((tileNow >= 314 && tileNow <= 327)
            || (tileNow >= 49 && tileNow <= 88)) {
            diag(`TREE-PRUNE-MISMATCH (${x},${y}) ${obj.typeName} tile=${tileNow} water=${r.waterTileIndex}..${r.waterTileIndex + 13} shore=${r.shoreTileIndex}..${r.shoreTileIndex + 39} wc=${r.waterCliffsIndex}..${r.waterCliffsIndex + 27}`);
        }

        const d = nearStartTooClose(x, y);
        if (d <= K_TREE_CLEAR_RADIUS) {
            ++removedStart;
            continue;                      // 出生点紧邻：清空
        }
        if (d <= K_TREE_SPARSE_RADIUS && ((x + y) & 1) === 0) {
            ++removedStart;
            continue;                      // 近圈：棋盘格稀疏一半
        }
        kept.push(obj);
    }
    r.terrainObjects = kept;

    diag(`TREE-PRUNE terrain=${removedTerrain} start=${removedStart} building=${removedBuilding} kept=${r.terrainObjects.length}`);

    // [移植侧] 最后兜底：科技建筑地基格上不允许残留任何 overlay（矿石、
    // 碎石 LAT 等）。各生成阶段已直接避让，这一遍只清除漏网之鱼。
    if (r.cellSlots.length !== 0) {
        let clearedOverlay = 0;
        const it = new CellIterator();
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {
            if ((cell.altFlags & K_ALT_CELL_FLAGS_CONTAINS_BUILDING) !== 0
                && cell.overlayTypeIndex !== -1) {
                diag(`TREE-PRUNE-BUILDING-OVERLAY (${cell.mapCoords & 0xffff},${cell.mapCoords >>> 16}) overlay=${cell.overlayTypeIndex}`);
                cell.overlayTypeIndex = -1;
                cell.overlayData = 0;
                ++clearedOverlay;
            }
        }
        diag(`TREE-PRUNE building overlays swept=${clearedOverlay}`);
    }
}

// ---------------------------------------------------------------------------
// IsStartClearArea - 出生点净场 6x6 判定（移植侧）。
//
// 出生点 2x2（MCV 占地）居中、四周外扩 kStartClearOuter 格 => 边长
// 2 + 2*kStartClearOuter = 6。CreateStartingPoints 在 AddTiberium 与
// CreateLATs 之前运行，故矿石、矿柱、树、岩石生成时直接调用它跳过这些格。
// ---------------------------------------------------------------------------
export function isStartClearArea(r: Rmg, x: number, y: number): boolean {
    const K_START_CLEAR_OUTER = 2;   // 6x6
    for (const sp of r.startingPoints) {
        const sx = unpX(sp.coords);
        const sy = unpY(sp.coords);
        if (x >= sx - K_START_CLEAR_OUTER
            && x <= sx + K_START_CLEAR_OUTER + 1
            && y >= sy - K_START_CLEAR_OUTER
            && y <= sy + K_START_CLEAR_OUTER + 1) {
            return true;
        }
    }
    return false;
}

// 矿石/矿柱净场：出生点 2x2 外扩 8 格 => 18x18（默认口径）。
// 群岛例外：外扩 3 格 => 8x8，这是群岛特有的规则。
export function isOreClearArea(r: Rmg, x: number, y: number): boolean {
    const K_ORE_CLEAR_OUTER = 8;              // 默认 18x18
    const K_ORE_CLEAR_OUTER_ISLES = 3;        // 群岛 8x8
    const outer = r.config.landType === LandType.Archipelago
        ? K_ORE_CLEAR_OUTER_ISLES
        : K_ORE_CLEAR_OUTER;
    for (const sp of r.startingPoints) {
        const sx = unpX(sp.coords);
        const sy = unpY(sp.coords);
        if (x >= sx - outer
            && x <= sx + outer + 1
            && y >= sy - outer
            && y <= sy + outer + 1) {
            return true;
        }
    }
    return false;
}
