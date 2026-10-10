/**
 * Transliteration of G:/MapGenerator MapGenMakingSub.cpp - the Making-regions
 * (MapGenMaking.cpp) subordinates, one per vanilla routine, in the vanilla
 * call order:
 *
 *   RebuildRegionBodies     sub_58EBC0   rebuild every region body + settle/merge
 *   RegionNodePriority      sub_58C6F0   the growth node priority key
 *   SplitOrDropRegion       sub_58D620   split / drop one large region
 *   ReseedRegions           sub_58EF10   destroy + re-seed, adjacency, ramps
 *   CliffPass               sub_579010   one recursive cliff-blob step
 *   CliffMask               sub_579B70   the 8-bit height-direction mask
 *   IsCliffFamilyTile       sub_4863D0   the cliff-family tile test
 *   LinkRegionNeighbours    sub_58F0C0   a region's neighbour-id vector
 *   CarveRegionRamps        sub_5905D0   ramps between neighbouring regions
 *   CarveRampAt             sub_590970   try to carve one ramp at a cell
 *   DrawZeroOrOne                        the 0/1 draw the strips jitter with
 *   RampMask                sub_590FD0   the ramp direction mask
 *   RectHasRegionCells      sub_5A1E50   "does the region own enough of this rect?"
 *   SetWorkMark             sub_58D070   write the region-id mark of one cell
 *   RampRectClear           sub_594010   the builders' coverage precondition
 *   RampBuilder1..7         sub_593AF0 / 593550 / 593030 / 592440 / 591D80 /
 *                           591740 / 5910F0 - the directed ramp builders
 *   TileRectClear           sub_5A7250   pave/placeholder-only rectangle
 *   TileRectLevelClear      sub_5A7440   the same plus a uniform Level
 *   OverlayRectClear        sub_5902C0   untouched uniformly levelled slot
 *   PlaceBridgeRepairHut    sub_5904B0   the bridge repair hut placer
 *   CreateNeutralBridgeRepairHut         route B building record
 *   CorridorBandClear                    the corridor cross-section gate
 *   LinkSameLevelRegions    sub_58F2C0   the paved lateral-corridor builder
 *   FindRegionById                       the id -> record lookup
 *   IsWithinUsableArea      0x578460     the "playable diamond" test
 *   IsWithinUsableRect      sub_578640   the same with the rectangle passed in
 *   FixCliffLevels          sub_5A19E0   cliff edge / corner +-4 Level fix-up
 *   PlaceCliffs             sub_578E60   cliff placement driver
 *   PlaceCliffPiece         sub_579620   single cliff-piece placement
 *   ResolveCliffVariant     sub_5A1350   corrected CliffSet tile for a tile
 *   CorrectCliffTiles       sub_5A17F0   cliff correction pass
 *   FillGreenPlaceholders   sub_59B740   fill leftovers next to green ground
 *
 * Plus RandomMapGenerator::CanHostSlope (sub_6B2520) / IsMorphableTile from
 * MapGenHills.cpp, routed through this module so hills.ts can import them
 * along the documented dependency direction (hills -> makingSub).
 *
 * The one deviation is CreateNeutralBridgeRepairHut, which records the
 * building instead of instantiating one (route B; MapStructure in types.ts).
 */

import type { Rmg } from './mapGen';

import {
    Box,
    CellIterator,
    DIR_X,
    DIR_Y,
    MapCell,
    MapRegion,
    WorkArray,
    packXY,
    unpX,
    unpYS,
    i16,
} from './types';
import { F2I64, K_UNIT_SCALE, tableAtan } from './mathTables';
import { diag, f4 } from './diag';
import {
    resetPreviewState,
    placeIsoTile,
    placeWaterDetailTile,
    setFoundationCenter,
    isWaterFamilyTile,
    isGreenGroundTile,
    isPavedRoadTile,
    isPavedRoadEndTile,
    isMiscPaveTile,
    isPaveTile,
    cliffCellsInX,
    cliffPieceHitsRamp,
    trimCliffPieceForRamp,
} from './river';
import {
    releaseRegionObject,
    assignRemainingCells,
    collectRegionBoundary,
    createRegionRecord,
} from './making';

// Re-exports for making.ts: PORTING.md rule 5 fixes the runtime graph at
// making -> makingSub -> river, so the river helpers the Init-regions stage
// needs travel through here.
export {
    isWaterFamilyTile,
    isGreenGroundTile,
} from './river';
import { buildWaterRing, repairCliffPieces } from './river';
export { buildWaterRing, repairCliffPieces };

// ---------------------------------------------------------------------------
// Constants (MapGenMakingSub.cpp anonymous namespace).
// ---------------------------------------------------------------------------
const K_TWO_PI = 6.283185307179586;           // dbl_7E3CC0
const K_PI = 3.141592653589793;               // dbl_7E44D0 / dbl_7E2820
const K_PI_OVER_EIGHT = 0.3926990816987241;   // dbl_7ED8A0
// Random() * 2 pi / 2^32 - the growth loop's initial heading (0x58d... fmul
// 1.462918079607772e-9, i.e. 2 pi / 2^32; NOT kUnitScale, which carries the
// extra (1 + 2^-32) factor).
const K_ANGLE_SCALE = 1.462918079607772e-9;

// The 8 neighbour offsets in Neighbours order (0x89F688):
//   N (0,-1)  NE (1,-1)  E (1,0)  SE (1,1)  S (0,1)  SW (-1,1)  W (-1,0)  NW (-1,-1)
const K_DIR_X = DIR_X;
const K_DIR_Y = DIR_Y;

// The [Map] LocalSize offsets - VisibleRect.X and VisibleRect.Y - that
// IsWithinUsableArea uses.
const K_VISIBLE_OFFSET_X = 2;
const K_VISIBLE_OFFSET_Y = 5;

// AltCellFlags bit 0x2 (ContainsBuilding) - the "occupied" stand-in.
const K_ALT_CELL_FLAGS_CONTAINS_BUILDING = 0x2;

// NodeHeap::Pop's "nothing left" answer.
const K_NO_NODE = -1;

// ---------------------------------------------------------------------------
// One growth node: the packed cell coords plus the float priority key (the
// vanilla's 8-byte node entries, `operator new(8 * (2 * cellCount + 10))` at
// 0x58d640; the key sits at +4).
// ---------------------------------------------------------------------------
export interface RegionNode {
    coords: number;   // packed CellStruct (+0)
    key: number;      // float (+4)
}

// ---------------------------------------------------------------------------
// The vanilla's 0x14-byte priority queue { count, capacity, items, maxSeen,
// minSeen } - a min-heap on the node key whose item array lives in the node
// array. SiftDown is sub_5AD870. maxSeen / minSeen are dead stores and are
// dropped; slots hold node INDICES so the node vector may reallocate safely.
// ---------------------------------------------------------------------------
export class NodeHeap {
    private slots: number[] = [];

    empty(): boolean {
        return this.slots.length === 0;
    }

    // 0x58da63 - 0x58dabf: bubble the new node up while its key is smaller.
    push(nodes: RegionNode[], index: number): void {
        this.slots.push(index);
        let i = this.slots.length;                     // 1-based during the walk
        while (i > 1) {
            const parent = i >> 1;
            if (nodes[this.slots[parent - 1]!].key <= nodes[index]!.key)
                break;
            this.slots[i - 1] = this.slots[parent - 1]!;
            i = parent;
        }
        this.slots[i - 1] = index;
    }

    // 0x58db09 - 0x58db2a: take the root, move the last slot into it, sift down.
    pop(nodes: RegionNode[]): number {
        if (this.slots.length === 0)
            return K_NO_NODE;
        const top = this.slots[0]!;
        this.slots[0] = this.slots[this.slots.length - 1]!;
        this.slots.pop();
        if (this.slots.length !== 0)
            this.siftDown(nodes, 0);
        return top;
    }

    // sub_5AD870 - the smaller-key child bubbles up until both children are
    // larger (or absent).
    private siftDown(nodes: RegionNode[], i: number): void {
        const count = this.slots.length;
        const moved = this.slots[i]!;
        do {
            const child = 2 * i + 1;
            if (child >= count)
                break;
            let pick = child;
            if (child + 1 < count
                && nodes[this.slots[child + 1]!].key < nodes[this.slots[child]!].key)
                pick = child + 1;
            if (nodes[this.slots[pick]!].key >= nodes[moved]!.key)
                break;
            this.slots[i] = this.slots[pick]!;
            i = pick;
        } while (true);
        this.slots[i] = moved;
    }
}

// ---------------------------------------------------------------------------
// sub_58EBC0 - Making-regions step 1: rebuild every region body, then settle
// the small ones and merge the big ones away.
// ---------------------------------------------------------------------------
export function rebuildRegionBodies(r: Rmg): void {
    if (r.work.count === 0)
        return;

    const side = r.size.workSide;

    // ---- 1. Reset every region (0x58ebd0 - 0x58ec11) ----------------------
    for (let i = 0; i < r.regions.length; ++i) {          // 0x58ebd0
        const region = r.regions[i]!;
        if (region === null)
            continue;
        region.cells.length = 0;                          // 0x58ebe9 (vtable +0x0C)
        region.cellCount = 0;                             // 0x58ebf4
        region.bounds.X = 9999;                           // 0x58ec0c
        region.bounds.Y = 9999;                           // 0x58ec0e
        region.bounds.Width = 0;                          // 0x58ec11
        region.bounds.Height = 0;                         // increment clause
    }

    // ---- 2. Regroup the work square, backwards (0x58ec28 - 0x58ed83) ------
    for (let idx = side * side - 1; idx >= 0; --idx) {    // 0x58ec28 / 0x58ed73
        const packed = r.work.i(idx, 0);                  // 0x58ec49
        const x = i16(unpX(packed));
        const y = i16(unpYS(packed));
        if (!r.cellExists(x, y))                          // 0x58ec81
            continue;

        const mark = r.work.i(idx, 14);                   // 0x58ec8c
        if (mark < 0 || mark >= r.regions.length)
            continue;                                     // 0x58ec9e
        const region = r.regions[mark];
        if (region === undefined || region === null)
            continue;

        ++region.cellCount;                               // 0x58ecb0
        region.cells.push(packXY(x, y));                  // 0x58ecf8

        const b = region.bounds;                          // 0x58ecff
        if (b.Width === 0) {                              // 0x58ed0a
            b.X = x;                                      // 0x58ed16
            b.Y = y;                                      // 0x58ed18
            b.Width = 1;                                  // 0x58ed1b
            b.Height = 1;                                 // 0x58ed1e
        }
        const minX = b.X;                                 // 0x58ed21
        if (x >= b.X + b.Width)                           // 0x58ed2c
            b.Width = x - minX + 1;                       // 0x58ed33
        if (x < minX) {                                   // 0x58ed38
            const w = b.Width;                            // 0x58ed3a
            b.X = x;                                      // 0x58ed41
            b.Width = minX - x + w;                       // 0x58ed43
        }
        const minY = b.Y;                                 // 0x58ed46
        if (y >= b.Y + b.Height)                          // 0x58ed52
            b.Height = y - minY + 1;                      // 0x58ed59
        if (y < minY) {                                   // 0x58ed5e
            const h = b.Height;                           // 0x58ed60
            b.Y = y;                                      // 0x58ed67
            b.Height = minY - y + h;                      // 0x58ed6a
        }
    }

    // ---- 3. Region size gate (0x58ed89 - 0x58edae) ------------------------
    // dword_ABE048 = globalOptions_.regionSize, ABE15C = size_.height,
    // ABE158 = size_.width - all read live from the instance.
    const threshold = F2I64(
        2.0 * ((0.005 * r.globalOptions.regionSize + 0.05)
            * r.size.width
            * r.size.height));

    // ---- 4. Settle / merge pass (0x58edb5 - 0x58ee8b) ---------------------
    let j = 0;                                            // 0x58edbe (LABEL_32)
    while (j < r.regions.length) {
        const region = r.regions[j];                      // 0x58edca
        if (region === undefined || region === null
            || region.mergeSettled !== 0                  // 0x58edd4
            || region.waterFamily) {
            ++j;
            continue;
        }


        if (region.cellCount <= threshold) {              // 0x58edde
            region.mergeSettled = 1;                      // 0x58eded
            ++j;
            continue;
        }

        if (splitOrDropRegion(r, region)) {               // 0x58ede2
            releaseRegionObject(r, region, true);         // 0x58ee03 - 0x58ee83
            // Vanilla's `goto LABEL_32` (0x58ee8b) targets the loop HEAD: the
            // same slot j is re-tested, which now holds the record that slid
            // down through ReleaseRegionObject's compaction. (Verified against
            // the exe: after src=6's split the scan lands on the slid-down
            // region 7 and splits it, which a ++j here would skip.)
            continue;
        }
        ++j;
    }
}

// ---------------------------------------------------------------------------
// sub_58C6F0 - the priority key of one growth node (0x58c6f0 - 0x58c7ff).
// One RNG draw per call.
// ---------------------------------------------------------------------------
export function regionNodePriority(r: Rmg, seed: number, cell: number, angle: number): number {
    const dx = unpX(cell) - unpX(seed);
    const dy = unpYS(cell) - unpYS(seed);
    const dist = Math.sqrt(dx * dx + dy * dy);

    let theta: number;
    if (dx !== 0) {
        theta = tableAtan(-(dy / dx));                // 0x58c754 sub_4CADE0
        if (dx < 0)
            theta += K_PI;                            // 0x58c760
    } else {
        theta = K_PI / 2.0;                           // 0x58c73e
    }

    let diff = Math.abs(theta - angle);               // 0x58c76b
    while (diff >= K_TWO_PI)                          // 0x58c77e
        diff -= K_TWO_PI;
    if (diff > K_PI)                                  // 0x58c795
        diff = K_TWO_PI - diff;

    return r.rng.next() * K_UNIT_SCALE * 2.5          // 0x58c7b5
        + diff * 1.5
        + dist * 0.15;
}

// ---------------------------------------------------------------------------
// sub_58D620 - the merge pass's per-region callback: split / drop one large
// region (0x58d62c - 0x58e5cb). Always reports the region as consumed
// (0x58e5c3) unless byte +26 was already set.
// ---------------------------------------------------------------------------
export function splitOrDropRegion(r: Rmg, region: MapRegion | null): boolean {
    if (region === null || r.work.count === 0)
        return false;
    if (region.mergeSettled !== 0)                        // 0x58d631
        return false;

    diag(`SPLIT-IN id=${region.id} cells=${region.cellCount} level=${region.level} water=${region.waterFamily ? 1 : 0}`);

    const side = r.size.workSide;
    const workCount = side * side;

    // ---- 1. Node buffer + heap (0x58d63b - 0x58d734) ----------------------
    const nodes: RegionNode[] = [];                       // vanilla's Block
    const heap = new NodeHeap();

    // ---- 2. Mark the square: -1 everywhere, -2 on this region's cells -----
    for (let idx = 0; idx < workCount; ++idx)             // 0x58d73f
        r.work.setI(idx, 14, -1);
    for (let i = region.cells.length - 1; i >= 0; --i) {  // 0x58d7xx (from the end)
        const c = region.cells[i]!;
        r.work.setI(r.workIndex(unpX(c), unpYS(c)), 14, -2);
    }

    // ---- 3. Target size and seed cell (both one RNG draw) -----------------
    const hi = Math.trunc(region.cellCount / 3);          // 0x58d64c
    const lo = Math.trunc(region.cellCount / 8);
    let target: number;
    do {
        target = lo + F2I64(                              // 0x58d6xx (rejection is dead:
            r.rng.next()
            * (hi - lo + 1) * K_UNIT_SCALE);
    }                                                     // the scaled value is < hi)
    while (target > hi);

    const cellTotal = region.cells.length;
    let seedIndex: number;
    do {
        seedIndex = F2I64(                                // 0x58d6xx
            r.rng.next()
            * cellTotal * K_UNIT_SCALE);
    } while (seedIndex > cellTotal - 1);

    const seed = region.cells[seedIndex]!;
    const seedX = unpX(seed);
    const seedY = unpYS(seed);
    diag(`SPLIT-GROW id=${region.id} target=${target} lo=${lo} hi=${hi} seedIdx=${seedIndex} seed=(${seedX},${seedY})`);
    r.work.setI(r.workIndex(seedX, seedY), 15, -3);       // 0x58d6xx
    {
        const root: RegionNode = { coords: seed, key: Math.fround(0.0) };  // 0x58d6xx
        nodes.push(root);
        heap.push(nodes, 0);
    }

    // ---- 4. Priority growth (0x58d8xx - 0x58db3a) -------------------------
    const K_GROW_DIR_X = [0, 1, 0, -1];   // Neighbours 0 / 2 / 4 / 6
    const K_GROW_DIR_Y = [-1, 0, 1, 0];

    let heading = r.rng.next() * K_ANGLE_SCALE;           // 0x58d8xx [RNG]
    diag(`SPLIT-HEADING id=${region.id} heading=${f4(heading)}`);
    let grown = 0;
    let growStop = 'heap-dry';
    let cur = heap.pop(nodes);                            // the seed node, key 0
    while (cur !== K_NO_NODE) {
        if (grown >= target) {                            // 0x58d8xx
            growStop = 'target-reached';
            break;
        }

        const cc = nodes[cur]!.coords;
        const ccX = unpX(cc);
        const ccY = unpYS(cc);
        r.work.setI(r.workIndex(ccX, ccY), 14, -3);       // 0x58d9xx (carved)

        for (let d = 0; d < 4; ++d) {
            const nx = i16(ccX + K_GROW_DIR_X[d]!);
            const ny = i16(ccY + K_GROW_DIR_Y[d]!);
            if (!r.cellExists(nx, ny))                    // 0x58d991 - 0x58d9b7
                continue;

            const wi = r.workIndex(nx, ny);
            if (r.work.i(wi, 14) !== -2)                  // 0x58d9dd
                continue;
            if (r.work.i(wi, 15) === -3)                  // 0x58d9ea
                continue;
            if (!r.isPlaceholderTile(r.cellAt(nx, ny)))   // 0x58da05
                continue;

            const nodeCoords = packXY(nx, ny);
            const node: RegionNode = {
                coords: nodeCoords,
                key: Math.fround(                         // 0x58da31 [RNG]
                    regionNodePriority(r, seed, nodeCoords, heading)),
            };
            nodes.push(node);                             // 0x58da1e
            r.work.setI(wi, 15, -3);                      // 0x58da5b
            heap.push(nodes, nodes.length - 1);
        }

        ++grown;                                          // 0x58dae2
        heading += r.rng.gaussian() * K_PI_OVER_EIGHT;    // 0x58daf0 [RNG]
        cur = heap.pop(nodes);                            // 0x58db09
    }

    // ---- 5. Reset the visited marks, drain the heap (0x58db3b - 0x58dc1c) --
    for (let idx = 0; idx < workCount; ++idx)             // 0x58db3b
        r.work.setI(idx, 15, -1);
    for (;;) {                                            // 0x58db5d
        const n = heap.pop(nodes);
        if (n === K_NO_NODE)
            break;
        const c = nodes[n]!.coords;
        r.work.setI(r.workIndex(unpX(c), unpYS(c)), 14, -3);   // 0x58dbea
    }
    {
        let nCarved = 0, nLeft = 0;
        for (let i = region.cells.length - 1; i >= 0; --i) {
            const c = region.cells[i]!;
            const m = r.work.i(r.workIndex(unpX(c), unpYS(c)), 14);
            if (m === -3) ++nCarved;
            else if (m === -2) ++nLeft;
        }
        diag(`SPLIT-GROWN id=${region.id} popped=${grown} stop=${growStop} carved=${nCarved} leftover=${nLeft} nodes=${nodes.length}`);
    }

    // ---- 6. Re-assign the marked cells to new records (0x58dc5d - 0x58e4f9)
    const created: MapRegion[] = [];                      // vanilla's v167 / v170
    const pending: number[] = [];

    for (let k = region.cells.length - 1; k >= 0; --k) {
        const cell = region.cells[k]!;
        const cellX = unpX(cell);
        const cellY = unpYS(cell);
        const mark = r.work.i(r.workIndex(cellX, cellY), 14);
        if (mark >= -1)                                   // only -2 / -3 were taken
            continue;

        const nr = createRegionRecord(r, cell);           // 0x58dcc8
        nr.cells.push(cell);                              // 0x58dcex
        ++nr.cellCount;
        created.push(nr);                                 // 0x58dxxx
        r.work.setI(r.workIndex(cellX, cellY), 14, nr.id);     // 0x58e0xx

        pending.length = 0;                               // 0x58ddxx
        pending.push(cell);
        while (pending.length > 0) {
            const c = pending.pop()!;
            const cX = unpX(c);
            const cY = unpYS(c);
            for (let dir = 0; dir < 8; ++dir) {
                const nx = i16(cX + K_DIR_X[dir]!);
                const ny = i16(cY + K_DIR_Y[dir]!);
                if (!r.cellExists(nx, ny))                // 0x58e2xx
                    continue;
                const wi = r.workIndex(nx, ny);
                if (r.work.i(wi, 14) !== mark)            // 0x58e2xx
                    continue;
                nr.cells.push(packXY(nx, ny));
                ++nr.cellCount;
                r.work.setI(wi, 14, nr.id);
                pending.push(packXY(nx, ny));
            }
        }

        {
            let minX = cellX, maxX = cellX, minY = cellY, maxY = cellY;
            for (let ci = 0; ci < nr.cells.length; ++ci) {
                const qc = nr.cells[ci]!;
                const qx = unpX(qc);
                const qy = unpYS(qc);
                if (qx < minX) minX = qx;
                if (qx > maxX) maxX = qx;
                if (qy < minY) minY = qy;
                if (qy > maxY) maxY = qy;
            }
            diag(`SPLIT-REC id=${nr.id} from=${mark === -3 ? 'carved' : 'leftover'} anchor=(${cellX},${cellY}) level=${nr.level} cells=${nr.cellCount} bbox=(${minX},${minY})-(${maxX},${maxY})`);
        }
    }

    // ---- 7. Neighbour analysis + Level settle (0x58df8x - 0x58e52x) -------
    for (let i = created.length - 1; i >= 0; --i) {
        const nr = created[i]!;
        if (nr.consumed !== 0)                            // 0x58dfaf
            continue;

        // The boundary cells: sub_58E5D0 collects the record's own cells that
        // have an in-diamond neighbour with a different mark - the shared
        // collector is used (this step only needs the SET).
        const boundary = collectRegionBoundary(r, nr);    // 0x58dfbc

        const touching = new Uint8Array(r.regionIdCounter);   // 0x58dfc1 (indexed by id)
        for (let b = boundary.length - 1; b >= 0; --b) {
            const c = boundary[b]!;
            const cX = unpX(c);
            const cY = unpYS(c);
            for (let dir = 0; dir < 8; ++dir) {
                const nx = i16(cX + K_DIR_X[dir]!);
                const ny = i16(cY + K_DIR_Y[dir]!);
                if (!r.cellExists(nx, ny))                // 0x58e0xx
                    continue;
                const m = r.work.i(r.workIndex(nx, ny), 14);
                if (m >= 0 && m !== nr.id)                // 0x58e101
                    touching[m] = 1;
            }
        }

        // The biggest touching non-water record, plus the Level range.
        let best: MapRegion | null = null;                // v147
        let bestSize = -1;                                // v157
        let bestLevel = -1;                               // v160
        let minLevel = -1, maxLevel = -1;                 // n4 / n7
        for (let id = 0; id < r.regionIdCounter; ++id) {  // 0x58e0da
            if (touching[id] === 0)
                continue;

            const r2 = findRegionById(r, id);             // the id -> record lookup
            if (r2 === null)                              // vanilla would read past
                continue;                                 // the array here
            if (r2.consumed !== 0)                        // 0x58e...
                continue;

            if (r2.cellCount > bestSize && !r2.waterFamily) {   // 0x58e0xx
                bestSize = r2.cellCount;
                best = r2;
                bestLevel = r2.level;
            }
            if (minLevel === -1) {                        // 0x58e140
                minLevel = r2.level;
                maxLevel = minLevel;
            } else {
                if (r2.level > maxLevel)
                    maxLevel = r2.level;
                if (r2.level < minLevel)
                    minLevel = r2.level;
            }
        }

        // Candidate Levels for this piece (0x58e16a - 0x58e341).
        const candidates: number[] = [];
        const span = maxLevel - minLevel;
        if (span === 8) {                                 // 0x58e191
            candidates.push(Math.trunc((maxLevel + minLevel) / 2));   // 0x58e19a
        } else {
            if (span === 4)                               // 0x58e18c
                candidates.push(maxLevel);                // 0x58e222
            if (minLevel >= 4)                            // 0x58e...
                candidates.push(minLevel - 4);
            if (maxLevel <= 7)                            // 0x58e...
                candidates.push(maxLevel + 4);
        }
        if (r.config.landType === 3                       // n3 @0xABE014 == 3 / 4
            || r.config.landType === 4) {
            let w = 0;                                    // 0x58e308 - 0x58e341
            for (let ci = 0; ci < candidates.length; ++ci) {
                if (candidates[ci] !== 0)
                    candidates[w++] = candidates[ci]!;
            }
            candidates.length = w;
        }
        // [QUALITY-FIX] 原版（C++ 移植层与漂移文本同款）对候选等级没有上限：
        // maxLevel<=7 时 maxLevel+4 直接产出 11，merge 级联再 +1 得 12 —— 超出
        // 游戏合法层（exe 全部存档图 z≤10，z=11/12 无瓦片美术，渲染黑块且游戏
        // 内非法）。种子 0x09B3C6E7 (env3/s1/p1) 最小复现。这里钳到观测值域，
        // 常规种子（候选均 ≤10）行为与移植层逐位一致。
        for (let ci = 0; ci < candidates.length; ++ci) {
            if (candidates[ci]! > 10)
                candidates[ci] = 10;
        }

        if (nr.cellCount <= 100) {                        // 0x58e354
            {
                const cs = candidates.join(',');
                const bestStr = best !== null
                    ? `id${best.id}/L${bestLevel}/n${best.cellCount}`
                    : 'NONE';
                diag(`SPLIT-SETTLE id=${nr.id} cells=${nr.cellCount} minL=${minLevel} maxL=${maxLevel} span=${span} best=${bestStr} cands=[${cs}]`);
            }
            if (best === null)                            // 0x58e40a: nothing to do
                continue;

            // Hand the piece over to the biggest neighbour: adopt its Level,
            // shift the piece's cells by the difference, move them across.
            const oldLevel = nr.level;                    // v129
            nr.level = bestLevel;                         // 0x58e422
            const delta = bestLevel - oldLevel;           // v130 (a byte in vanilla)
            diag(`SPLIT-MERGE id=${nr.id} cells=${nr.cellCount} oldL=${oldLevel} -> best=${best.id} L=${bestLevel} delta=${delta}`);

            {                                             // 0x58e427
                const it = new CellIterator();
                it.reset(r.cellSlots, r.size.mapWidth);
                for (let c = it.next(); c !== null; c = it.next()) {   // 0x58e3cc
                    const x = i16(unpX(c.mapCoords));
                    const y = i16(unpYS(c.mapCoords));
                    if (r.work.i(r.workIndex(x, y), 14) === nr.id) {   // 0x58e3e5
                        const before = c.level;
                        c.level = Math.min(10, c.level + delta);   // 0x58e3ef + [QUALITY-FIX] 防级联越界
                        if (delta !== 0)
                            diag(`SPLIT-SHIFT (${x},${y}) L${before}->${c.level} id=${nr.id} merge->${best.id}`);
                    }
                }
            }

            for (let c = nr.cells.length - 1; c >= 0; --c) {   // 0x58e410 - 0x58e4f5
                const cc = nr.cells[c]!;
                best.cells.push(cc);                      // 0x58e4xx
                ++best.cellCount;
                r.work.setI(r.workIndex(unpX(cc), unpYS(cc)), 14, best.id);
            }
            nr.consumed = 1;                              // 0x58e4eb
        } else if (candidates.length > 0) {
            // Big piece: pick one of the candidate Levels at random (0x58e343 -
            // 0x58e39d) and shift the piece's cells by the difference.
            // NOTE: vanilla has no empty-list guard here - with an empty list
            // the rejection loop below would spin forever.
            let pick: number;
            do {
                pick = F2I64(                             // [RNG]
                    r.rng.next()
                    * candidates.length * K_UNIT_SCALE);
            } while (pick > candidates.length - 1);

            const chosen = candidates[pick]!;
            const delta = chosen - nr.level;              // v125
            nr.level = chosen;                            // 0x58e3xx
            {
                const cs = candidates.join(',');
                diag(`SPLIT-PICK id=${nr.id} cells=${nr.cellCount} minL=${minLevel} maxL=${maxLevel} span=${span} pick=${pick} chosen=${chosen} delta=${delta} cands=[${cs}]`);
            }

            {                                             // 0x58e3bd
                const it = new CellIterator();
                it.reset(r.cellSlots, r.size.mapWidth);
                for (let c = it.next(); c !== null; c = it.next()) {   // 0x58e3ce
                    const x = i16(unpX(c.mapCoords));
                    const y = i16(unpYS(c.mapCoords));
                    if (r.work.i(r.workIndex(x, y), 14) === nr.id) {
                        const before = c.level;
                        c.level = Math.min(10, c.level + delta);   // 0x58e3ef + [QUALITY-FIX] 防级联越界
                        if (delta !== 0)
                            diag(`SPLIT-SHIFT (${x},${y}) L${before}->${c.level} id=${nr.id} pick`);
                    }
                }
            }
        }
    }

    // ---- 8. Destroy the consumed records (0x58e52x - 0x58e55x) ------------
    let nConsumed = 0;
    for (let i = r.regions.length - 1; i >= 0; --i) {
        const rr = r.regions[i];
        if (rr === undefined || rr === null || rr === region)   // vanilla keeps v62
            continue;
        if (rr.consumed !== 0) {                          // 0x58e52e
            ++nConsumed;
            releaseRegionObject(r, rr, true);             // sub_58C070 + delete
        }
    }
    diag(`SPLIT-END src=${region.id} created=${created.length} consumed=${nConsumed}`);

    // (0x58e561 ++record[7] - the +0x1C split counter - is a write-only field
    //  and is not modelled.)

    return true;                                          // 0x58e5c3 `mov al, 1`
}

// ---------------------------------------------------------------------------
// sub_58EF10 - Making-regions step 2: rebuild the region set from the work
// marks, then link the regions and carve the ramps between them.
// ---------------------------------------------------------------------------
export function reseedRegions(r: Rmg): void {
    if (r.work.count === 0 || r.cellSlots.length === 0)
        return;

    const side = r.size.workSide;
    const workCount = side * side;

    // ---- 1. Preview reset + the cliff blob pass (0x58ef15 - 0x58ef65) -----
    resetPreviewState(r);
    let pass = true;                                      // vanilla v15 (0x58ef1e)
    {
        const it = new CellIterator();                    // 0x58ef2d sub_578350
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {   // 0x58ef37
            if (!pass)                                    // 0x58ef43
                break;
            pass = cliffPass(r, cell, -1);                // 0x58ef50 sub_579010
        }
    }

    // ---- 2. Reset the work marks (0x58ef67 - 0x58ef96) --------------------
    for (let idx = 0; idx < workCount; ++idx) {           // 0x58ef7e
        r.work.setI(idx, 14, -1);                         // 0x58ef88 byte 56
        r.work.setI(idx, 15, -1);                         // 0x58ef92 byte 60
    }

    // ---- 3. Tear every region down (0x58ef98 - 0x58efc3) ------------------
    // sub_58C070 + operator delete == releaseRegionObject(region, true).
    for (let i = r.regions.length - 1; i >= 0; --i) {
        const region = r.regions[i];
        if (region !== null && region !== undefined)      // 0x58efae
            releaseRegionObject(r, region, true);         // 0x58efb4 + 0x58efba
    }
    r.regionIdCounter = 0;
    // 0x58efd0 dword_ABED14 (the region-id counter reset)

    // ---- 4. Re-seed the leftovers (0x58efcb - 0x58f02b) -------------------
    // The vanilla carries a SECOND inline copy of sub_58D010's sweep here;
    // the shared helper with flag 0 produces the identical sweep order and
    // stamped value.
    assignRemainingCells(r, 0);                           // 0x58efcb - 0x58f02b

    // ---- 5. Adjacency and ramps (0x58f033 - 0x58f0aa) ---------------------
    if (pass) {                                           // 0x58f038
        for (let j = 0; j < r.regions.length; ++j)        // 0x58f04b sub_58F0C0
            linkRegionNeighbours(r, r.regions[j]!);

        for (let j = 0; j < r.regions.length; ++j) {      // 0x58f069 sub_5905D0
            carveRegionRamps(r, r.regions[j]!);
        }

        // 0x58f07f - 0x58f0aa frees each region's neighbour-id vector (+4) and
        // clears the pointer - modelled as clearing the vector.
        for (let j = 0; j < r.regions.length; ++j)        // 0x58f07f
            r.regions[j]!.neighbours.length = 0;
    }
}

// ---------------------------------------------------------------------------
// sub_579010 - one step of the recursive "fill the depressions" pass
// (0x579010 - 0x579312). sub_5A00C0 is a plain work[+56] read and sub_5A0090
// its write, so the two are inlined below.
// ---------------------------------------------------------------------------
export function cliffPass(r: Rmg, cell: MapCell | null, mode: number): boolean {
    if (cell === null || r.work.count === 0)
        return true;

    const mask = cliffMask(r, cell);                      // 0x5790xx sub_579B70
    const x = i16(unpX(cell.mapCoords));
    const y = i16(unpYS(cell.mapCoords));

    let hit = false;
    if ((mask & 0xa0) === 0xa0)
        hit = (mask & 0x11) === 0x11;

    // The four opposite-side continuation probes (0x57904d .. 0x5791c0): when
    // the cell is high on one side, look TWO cells over on the OTHER side and
    // test that neighbour's outward bit.
    if ((mask & 0x20) !== 0) {                            // W high -> two to the E
        if ((cliffMask(r, r.cellAt(i16(x + 1), i16(y))) & 0x02) !== 0)
            hit = true;
    }
    if ((mask & 0x02) !== 0) {                            // E high -> two to the W
        if ((cliffMask(r, r.cellAt(i16(x - 1), i16(y))) & 0x20) !== 0)
            hit = true;
    }
    if ((mask & 0x08) !== 0) {                            // S high -> two to the N
        if ((cliffMask(r, r.cellAt(i16(x), i16(y - 1))) & 0x80) !== 0)
            hit = true;
    }
    if ((mask & 0x80) !== 0) {                            // N high -> two to the S
        if ((cliffMask(r, r.cellAt(i16(x), i16(y + 1))) & 0x08) !== 0)
            hit = true;
    }

    if ((mask & 0x11) === 0x11
        && ((mask & 0x0a) !== 0x0a || (mask & 0xe0) !== 0)
        && ((mask & 0xa0) !== 0xa0 || (mask & 0x0e) !== 0))
        hit = true;
    if ((mask & 0x44) === 0x44
        && ((mask & 0x28) !== 0x28 || (mask & 0x83) !== 0)
        && ((mask & 0x82) !== 0x82 || (mask & 0x38) !== 0))
        hit = true;
    if ((mask & 0x2c) === 0x24 || (mask & 0xa1) === 0x21
        || (mask & 0x1a) === 0x12 || (mask & 0xc2) === 0x42
        || (mask & 0x0b) === 0x09 || (mask & 0x68) === 0x48
        || (mask & 0x86) === 0x84 || (mask & 0xb0) === 0x90)
        hit = true;

    if ((mask & 0x88) === 0x88 || (mask & 0x22) === 0x22 || hit) {
        if (!r.cellExists(i16(x), i16(y)))
            return true;                                  // out-of-diamond cell: mask 0
        const wi = r.workIndex(x, y);
        const mark = r.work.i(wi, 14);                    // 0x5791xx sub_5A00C0
        if (mark > 0 && mark !== mode && mode !== -1)     // 0x5791xx
            return false;

        cell.level += 4;                                  // 0x5792xx fill the dip
        r.work.setI(wi, 14, mode);                        // 0x5792xx sub_5A0090

        for (let dir = 0; dir < 8; ++dir) {               // 0x5792xx
            const nx = i16(x + K_DIR_X[dir]!);
            const ny = i16(y + K_DIR_Y[dir]!);
            cliffPass(r, r.cellAt(nx, ny), mode);         // recursion, result dropped
        }
    }
    return true;                                          // 0x57930a
}

// ---------------------------------------------------------------------------
// sub_579B70 - the 8-bit height-direction mask (0x579b70 - 0x57a0b8).
// SE -> 4, S -> 8, SW -> 0x10, W -> 0x20, NW -> 0x40, N -> 0x80, NE -> 1, E -> 2.
// ---------------------------------------------------------------------------
export function cliffMask(r: Rmg, cell: MapCell | null): number {
    if (cell === null || r.work.count === 0)
        return 0;

    const packed = cell.mapCoords;
    const x = i16(unpX(packed));
    const y = i16(unpYS(packed));
    if (!r.cellExists(x, y))                              // the diamond gate first
        return 0;
    if (r.work.byte(r.workIndex(x, y), 74) === 0)         // 0x579bxx the enable flag
        return 0;

    const level = cell.level;
    const K_BIT = [0x80, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40];

    let mask = 0;
    for (let d = 0; d < 8; ++d) {
        const nx = i16(x + K_DIR_X[d]!);
        const ny = i16(y + K_DIR_Y[d]!);
        if (!r.cellExists(nx, ny))                        // CoordinatesLegal
            continue;
        const n = r.cellAt(nx, ny);
        if (n.level !== level + 4)                        // exactly one level up
            continue;
        if (isCliffFamilyTile(r, n))                      // !sub_4863D0(n)
            continue;
        mask |= K_BIT[d]!;
    }
    return mask;
}

// ---------------------------------------------------------------------------
// sub_4863D0 - the cliff-family tile test (0x4863d0 - 0x4865ad). The byte is
// YRpp's CellClass::Height (+0x11A), NOT the SlopeIndex at +0x11C.
// ---------------------------------------------------------------------------
export function isCliffFamilyTile(r: Rmg, cell: MapCell | null): boolean {
    if (cell === null)
        return false;

    const tile = cell.isoTileTypeIndex;                   // cell +0x38
    const height = cell.height;                           // cell +0x11A

    if (r.shoreTileIndex !== -1
        && tile >= r.shoreTileIndex && tile < r.shoreTileIndex + 40)
        return true;

    for (let i = 0; i < 4; ++i) {                         // the four waterfalls
        const base = r.waterFamily4Base[i]!;
        if (base === -1 || tile < base || tile >= base + 4)
            continue;
        if (tile !== base && tile !== base + 3)
            return true;                                  // the middle two tiles
        switch (i) {
            case 0: return height !== 0 && height !== 4;  // East
            case 1: return height !== 1 && height !== 3;  // West
            case 2: return height >= 2;                   // South
            default: return height !== 2 && height !== 3; // North
        }
    }

    if (r.cliffRampsIndex !== -1
        && tile >= r.cliffRampsIndex && tile < r.cliffRampsIndex + 20)
        return true;
    if (r.waterCavesIndex !== -1
        && tile >= r.waterCavesIndex && tile < r.waterCavesIndex + 4)
        return true;
    if (r.bridgeSetIndex !== -1
        && tile >= r.bridgeSetIndex && tile < r.bridgeSetIndex + 16)
        return true;
    if (r.woodBridgeSetIndex !== -1
        && tile >= r.woodBridgeSetIndex && tile < r.woodBridgeSetIndex + 16)
        return true;
    if (r.destroyableCliffsIndex !== -1
        && tile >= r.destroyableCliffsIndex && tile < r.destroyableCliffsIndex + 2)
        return true;
    if (r.waterCliffsIndex === -1)
        return false;
    return tile >= r.waterCliffsIndex && tile < r.waterCliffsIndex + 28;
}

// ---------------------------------------------------------------------------
// sub_58F0C0 - build one region's neighbour-id vector (0x58f0c0 - 0x58f2be).
// No RNG.
// ---------------------------------------------------------------------------
export function linkRegionNeighbours(r: Rmg, region: MapRegion | null): void {
    if (region === null || r.work.count === 0)
        return;

    const side = r.size.workSide;
    const workCount = side * side;

    // 1. the vector at region +4
    region.neighbours.length = 0;                         // 0x58f0f9

    // 2. the touching-region byte map (indexed by region id)
    const touching = new Uint8Array(r.regionIdCounter);   // 0x58f114

    // 3. which regions own a cell next to the region's boundary
    const boundary = collectRegionBoundary(r, region);    // 0x58f13c
    for (let i = 0; i < boundary.length; ++i) {           // 0x58f158
        const c = boundary[i]!;
        const cX = unpX(c);
        const cY = unpYS(c);
        for (let dir = 0; dir < 8; ++dir) {               // 0x58f16d
            const nx = i16(cX + K_DIR_X[dir]!);
            const ny = i16(cY + K_DIR_Y[dir]!);
            if (!r.cellExists(nx, ny))                    // the diamond gate
                continue;
            const mark = r.work.i(r.workIndex(nx, ny), 14);
            if (mark >= 0 && mark < touching.length)      // 0x58f1a9
                touching[mark] = 1;
        }
    }

    // 4. append the ids (skipping this region's own)
    for (let id = 0; id < r.regionIdCounter; ++id) {      // 0x58f1db
        if (touching[id] !== 0 && id !== region.id)
            region.neighbours.push(id);                   // 0x58f1f6
    }

    // 5. recount the region's cells
    region.cellCount = 0;                                 // 0x58f204
    for (let idx = 0; idx < workCount; ++idx) {           // 0x58f20a
        if (r.work.i(idx, 14) === region.id
            && r.work.i(idx, 0) !== 0)                    // coords non-zero
            ++region.cellCount;
    }
}

// ---------------------------------------------------------------------------
// sub_5905D0 - carve the ramps between one region and its neighbours
// (0x5905d0 - 0x590967). Two branches: water-family linking and the land
// ramp roll / boundary sampling.
// ---------------------------------------------------------------------------
export function carveRegionRamps(r: Rmg, region: MapRegion | null): void {
    if (region === null || r.work.count === 0)
        return;

    if (region.waterFamily) {                             // 0x5905f7
        const nb = region.neighbours.slice();             // a copy: callees can
        const count = nb.length;                          // reshape the array
        if (count - 1 > 0) {                              // 0x59060c
            for (let i = 1; i < count; ++i) {             // 0x5906xx (v42)
                const a = findRegionById(r, nb[i]!);
                if (a === null)                           // vanilla reads past the
                    continue;                             // array here
                if (a.neighbours.length <= 1 && a.cellCount <= 50)   // 0x5906xx
                    continue;                             // LABEL_28
                for (let j = i; j < count; ++j) {         // 0x5907xx (j starts at i)
                    const b = findRegionById(r, nb[j]!);
                    if (b === null)
                        continue;
                    if ((b.neighbours.length > 1 || b.cellCount > 50)
                        && !b.waterFamily) {              // 0x5907xx
                        if (b.level === a.level && a.level === region.level)
                            linkSameLevelRegions(r, region, a, b);   // 0x5906d5 sub_58F2C0
                    }
                }
            }
        }
        return;
    }

    const nb = region.neighbours.slice();                 // 0x5906a6 (a copy: callees can
                                                          // reshape the array)
    for (let k = 0; k < nb.length; ++k) {
        const other = findRegionById(r, nb[k]!);          // 0x5906xx
        if (other === null)
            continue;
        if (other.id <= region.id                         // 0x5906xx the pair guard
            || other.level === region.level)
            continue;

        let attempts = 0;                                 // vanilla's n100 / v44
        let carved = 0;                                   // vanilla's v40

        let roll: number;
        do {
            roll = F2I64(                                 // 0x5907xx [RNG] 0..100
                r.rng.next()
                * 0.00000002351589501451605) >>> 0;
        } while (roll > 100);

        let ramps = 0;
        const gate = r.globalOptions.accessibility >>> 0; // n0x64 = this[27]
        if (roll >= gate) {
            ramps = 0;
        } else {
            do {
                ramps = F2I64(                            // 0x5907xx [RNG] 1..2
                    r.rng.next()
                    * 4.656612874161595e-10 + 1.0) >>> 0;
            } while (ramps > 2);
        }
        const want = ramps + 1;                           // 0x5907xx (v45)
        if (process.env.RMG_DEBUG_STAMP)
            diag(`RAMP-PAIR roll=${roll} gate=${gate} ramps=${ramps} want=${want} draws=${r.rng.drawCount()}`);
        const regionIsHigher = other.level <= region.level;   // 0x5907xx
        const higherId = regionIsHigher ? region.id : other.id;
        const lowerId = regionIsHigher ? other.id : region.id;

        const higher = findRegionById(r, higherId);       // 0x5907xx
        if (higher === null)
            continue;
        const list = collectRegionBoundary(r, higher);    // 0x5908cd

        // Port tuning (user request 2026-10-01): the roll gate above
        // (accessibility) already grants 2-3 ramp slots for most pairs; the
        // vanilla 100-try sampling budget is kept on purpose.
        const K_MAX_RAMP_ATTEMPTS = 100;
        while (carved < want) {
            if (attempts >= K_MAX_RAMP_ATTEMPTS)
                break;
            if (list.length > 0) {
                let idx: number;
                do {
                    idx = F2I64(                          // 0x5909xx [RNG]
                        r.rng.next()
                        * list.length * K_UNIT_SCALE);
                } while (idx > list.length - 1);

                const c = list[idx]!;
                const within = isWithinUsableArea(r, c, true);       // 0x59099x
                if (process.env.RMG_DEBUG_STAMP)
                    diag(`RAMP-TRY pair=${higherId}/${lowerId} att=${attempts} idx=${idx} n=${list.length} c=(${unpX(c)},${unpYS(c)}) within=${within ? 1 : 0} pre=${r.rng.drawCount()}`);
                if (within)
                    carved += (carveRampAt(r, higher, c, lowerId,
                        Math.fround(attempts * Math.fround(0.01))) !== 0) ? 1 : 0;   // 0x590970
            }
            ++attempts;                                   // v44 = ++n100
        }

        if (carved === 0)
            region.rampFlag = 0;                          // 0x590a4f (byte +27)
    }
}

// ---------------------------------------------------------------------------
// sub_590970 - try to carve one ramp at the given cell (0x590970 - 0x590fc8).
// A dispatcher over the RampMask pattern; the 0/1 draws are
// F2I64(Random() * 4.656612874161595e-10). Eight RNG draws in total on the
// deepest path.
// ---------------------------------------------------------------------------
export function carveRampAt(r: Rmg, owner: MapRegion, coords: number, regionId: number,
                            ratio: number): number {
    const x = unpX(coords);
    const y = unpYS(coords);

    const ok: Box<boolean> = { v: true };                 // 0x590974 (flag[0] = 1)
    const mask = rampMask(r, coords, ok, regionId, ratio);     // 0x590981 sub_590FD0
    if (process.env.RMG_DEBUG_STAMP)
        diag(`RAMP-MASK at=(${x},${y}) ok=${ok.v ? 1 : 0} mask=${mask} owner=${owner.id} tgt=${regionId} tgtL=${findRegionById(r, regionId)?.level}`);
    if (!ok.v)                                            // 0x59097e
        return 0;
    if (mask === 255)                                     // 0x59098a
        return 0;

    let carved = 0;                                       // vanilla's v7


    // ------------------------------------------------------------------
    // 刻完回头验（用户报障 2026-10-02：(94,126) 一带悬崖堵塞）
    //
    // 坡肩（builder 靠 owner 那一侧的台阶）是刻坡过程中才抬出来的高地，
    // 刻坡前根本不存在，所以 RampRectClear 那种"刻坡前量距离"的静态检查
    // 永远量不到它。这里改成刻完之后回头看一眼：owner 自己的高地格
    // （坡肩加本体）有没有被这次刻坡切成两块。切开了就整块撤销。
    // ------------------------------------------------------------------
    const side = r.size.workSide;
    const snapX0 = x - 20;                                // 本次刻坡会改到的范围
    const snapY0 = y - 20;
    const snapW = 41;
    const snapH = 41;

    // owner 高地格（编号是 owner、Level 不低于 owner->level 的格子）被分成了
    // 几块；只数跟快照窗口有交的块，窗口外那些本来就有的旧块不算数。
    const countOwnerHighBlocks = (): number => {
        const scanX0 = x - 28;                            // 比快照窗口再外扩 8 格
        const scanY0 = y - 28;
        const scanW = 57;
        const scanH = 57;
        const seen = new Uint8Array(scanW * scanH);
        const stack: number[] = [];
        let blocks = 0;
        for (let row = 0; row < scanH; ++row) {
            for (let col = 0; col < scanW; ++col) {
                const cx = scanX0 + col;
                const cy = scanY0 + row;
                if (seen[row * scanW + col] !== 0 || !r.cellExists(cx, cy))
                    continue;
                if (r.work.i(cx + side * cy, 14) !== owner.id)
                    continue;
                const mc = r.cellAt(cx, cy);
                if (mc.level < owner.level)
                    continue;

                let touchesSnapshot = false;
                ++blocks;
                seen[row * scanW + col] = 1;
                stack.push(row * scanW + col);
                while (stack.length > 0) {
                    const idx = stack.pop()!;
                    const px = scanX0 + (idx % scanW);
                    const py = scanY0 + Math.trunc(idx / scanW);
                    if (px >= snapX0 && px < snapX0 + snapW
                        && py >= snapY0 && py < snapY0 + snapH)
                        touchesSnapshot = true;
                    for (let d = 0; d < 8; ++d) {
                        const nx = px + K_DIR_X[d]!;
                        const ny = py + K_DIR_Y[d]!;
                        if (!r.cellExists(nx, ny))
                            continue;
                        const nc = nx - scanX0;
                        const nr = ny - scanY0;
                        if (nc < 0 || nc >= scanW || nr < 0 || nr >= scanH)
                            continue;
                        const nidx = nr * scanW + nc;
                        if (seen[nidx] !== 0)
                            continue;
                        if (r.work.i(nx + side * ny, 14) !== owner.id)
                            continue;
                        const nmc = r.cellAt(nx, ny);
                        if (nmc.level < owner.level)
                            continue;
                        seen[nidx] = 1;
                        stack.push(nidx);
                    }
                }
                if (!touchesSnapshot)
                    --blocks;                             // 窗口外的旧块不计入
            }
        }
        return blocks;
    };

    const ownerHighBlocksBefore = countOwnerHighBlocks();

    const snapCells: MapCell[] = new Array(snapW * snapH).fill(null).map(() => new MapCell());
    const snapHas = new Uint8Array(snapW * snapH);
    const snapMarks = new Int32Array(snapW * snapH);
    for (let row = 0; row < snapH; ++row) {
        for (let col = 0; col < snapW; ++col) {
            const cx = snapX0 + col;
            const cy = snapY0 + row;
            if (!r.cellExists(cx, cy))
                continue;
            const i = row * snapW + col;
            snapHas[i] = 1;
            snapMarks[i] = r.work.i(cx + side * cy, 14);
            const mc = r.rawSlot(cx + (cy << 9));
            snapCells[i] = mc !== null ? Object.assign(new MapCell(), mc) : new MapCell();
        }
    }

    const restoreSnapshot = (): void => {
        for (let row = 0; row < snapH; ++row) {
            for (let col = 0; col < snapW; ++col) {
                const i = row * snapW + col;
                if (snapHas[i] === 0)
                    continue;
                const cx = snapX0 + col;
                const cy = snapY0 + row;
                r.work.setI(cx + side * cy, 14, snapMarks[i]!);
                const mc = r.rawSlot(cx + (cy << 9));
                if (mc !== null)
                    Object.assign(mc, snapCells[i]!);
            }
        }
    };

    // ------------------------------------------------------------------
    // 刻完回头验②（用户报障 2026-10-02：(89,116) 与 (92,116) 距离不够展开
    // 两套 CliffSet，西木同款 bug）。
    //
    // 一条对接刻坡由三条坡带组成（R1..R10 = SlopeIndex 1..10）。坡带顶排
    // 贴着 owner 高台（坡格 Level = ownerLevel-1，其上沿即 Level=ownerLevel
    // 的纯高地顶面）。若某条坡带格的"侧向"（垂直于坡带走向、朝高台那一侧）
    // 两格以内存在一个【刻坡前就已是、刻坡后仍是】的等高高地顶面格
    // （SlopeIndex==0、Level == 坡格 Level+1），说明坡顶与旁边另一片高地
    // 贴得太近——之后 PlaceCliffs 会在中间再补一道悬崖，两套 CliffSet 在
    // 两三格内展不开，拼出白立面。命中就整块还原（三条对接坡带一起取消）。
    //
    // slope 朝向（用户给定，俯视）：
    //   R1/R5 -> 左上(-1,-1)   R2/R7 -> 右下(+1,+1)
    //   R3/R10-> 左下(-1,+1)   R4/R8 -> 右上(+1,-1)
    // ------------------------------------------------------------------
    const sideHighClash = (clash: { x: number, y: number, slope: number }): boolean => {
        if (r.rampBaseIndex < 0)
            return false;
        const K_SX = [0, -1, 1, -1, 1, -1, 0, 1, 1, 0, -1];
        const K_SY = [0, -1, 1, 1, -1, -1, 0, 1, -1, 0, 1];

        for (let row = 0; row < snapH; ++row) {
            for (let col = 0; col < snapW; ++col) {
                const i = row * snapW + col;
                if (snapHas[i] === 0)
                    continue;

                // [EXE-MATCH] 0x14001FF6D/0x14001FF75: the old cell comes from
                // [rsp+18h] which the column-loop bottom (0x1400200E9
                // `add r8,34h`) advances by one MapCell (52 B) per column, so
                // the exe tests the snapshot's own (col,row) cell - not the
                // row's first cell.
                const oldC = snapCells[i]!;
                const wx = snapX0 + col;
                const wy = snapY0 + row;
                const nowC = r.rawSlot(wx + (wy << 9));
                if (nowC === null)
                    continue;

                // 仅看"本次新刻"的坡带格：刻前不是 rampBase 坡，刻后是。
                const wasRamp = oldC.isoTileTypeIndex >= r.rampBaseIndex
                    && oldC.isoTileTypeIndex <= r.rampBaseIndex + 19;
                const isRamp = nowC.isoTileTypeIndex >= r.rampBaseIndex
                    && nowC.isoTileTypeIndex <= r.rampBaseIndex + 19;
                if (wasRamp || !isRamp || nowC.slopeIndex < 1
                    || nowC.slopeIndex > 10)
                    continue;

                const slope = nowC.slopeIndex;
                const sdx = K_SX[slope]!;
                const sdy = K_SY[slope]!;
                const needLevel = nowC.level + 1;         // 坡格上沿高台高度

                for (let step = 1; step <= 2; ++step) {
                    const qx = wx + sdx * step;
                    const qy = wy + sdy * step;
                    const qc = qx - snapX0;
                    const qr = qy - snapY0;
                    if (qc < 0 || qc >= snapW || qr < 0 || qr >= snapH)
                        break;
                    const qi = qr * snapW + qc;
                    if (snapHas[qi] === 0)
                        break;
                    const qNow = r.rawSlot(qx + (qy << 9));
                    if (qNow === null)
                        break;
                    const qOld = snapCells[qi]!;

                    // 刻前即纯高地顶面、等高；刻后仍未被本次刻坡改动（依旧
                    // 是同高度纯顶面）——即"旁边另一片没被纳入的高地"。
                    if (qOld.slopeIndex === 0 && qOld.level === needLevel
                        && qNow.slopeIndex === 0 && qNow.level === needLevel) {
                        clash.x = qx;
                        clash.y = qy;
                        clash.slope = slope;
                        return true;
                    }
                }
            }
        }
        return false;
    };

    // builder 报成功之后过一遍上面的检查；不合格就整块还原，当这次没刻过。
    const acceptBuilder = (builderResult: number): number => {
        if (builderResult === 0)
            return 0;

        if (process.env.RMG_DEBUG_STAMP) {
            const parts: string[] = [];
            let markDeltas = 0;
            let levelDeltas = 0;
            for (let row = 0; row < snapH; ++row) {
                for (let col = 0; col < snapW; ++col) {
                    const i = row * snapW + col;
                    if (snapHas[i] === 0)
                        continue;
                    const wx = snapX0 + col;
                    const wy = snapY0 + row;
                    const nowC = r.rawSlot(wx + (wy << 9));
                    if (nowC === null)
                        continue;
                    if (nowC.slopeIndex >= 1 && nowC.slopeIndex <= 10
                        && snapCells[i]!.slopeIndex !== nowC.slopeIndex)
                        parts.push(`(${wx},${wy})L${nowC.level}R${nowC.slopeIndex}`);
                    if (r.work.i(wx + side * wy, 14) !== snapMarks[i])
                        ++markDeltas;
                    if (nowC.level !== snapCells[i]!.level)
                        ++levelDeltas;
                }
            }
            diag(`RAMP-STAMP at=(${x},${y}) mask=${mask.toFixed(0)} ratio=${ratio} n=${parts.length} m=${markDeltas} l=${levelDeltas} ${parts.join(' ')}`);
        }

        const clash = { x: 0, y: 0, slope: 0 };
        if (sideHighClash(clash)) {
            diag(`RAMP-SIDE-CANCEL near=(${clash.x},${clash.y}) R${clash.slope} ownerL=${owner.level}`);
            if (process.env.RMG_DEBUG_STAMP)
                diag(`RAMP-ACC at=(${x},${y}) clash=(${clash.x},${clash.y})R${clash.slope}`);
            restoreSnapshot();
            return 0;
        }

        const blocksAfter = countOwnerHighBlocks();
        if (process.env.RMG_DEBUG_STAMP)
            diag(`RAMP-ACC at=(${x},${y}) blocks=${blocksAfter}/${ownerHighBlocksBefore}`);
        if (blocksAfter <= ownerHighBlocksBefore)
            return builderResult;
        restoreSnapshot();
        return 0;
    };

    let fromX: number, fromY: number, toX: number, toY: number;

    if (carved === 0 && (mask & 0x82) === 0x82 && (mask & 0x38) === 0) {
        fromX = i16(x - 1); fromY = i16(y - 5);
        toX = i16(x + 5); toY = i16(y + 1);
        if ((mask & 0x40) !== 0)
            ++fromY;                                      // 0x5909xx
        if ((mask & 0x04) !== 0)
            --toX;
        carved = acceptBuilder(rampBuilder1(r, owner, packXY(fromX, fromY), packXY(toX, toY), regionId));   // 0x590a0x sub_593AF0
    }

    if (carved === 0 && (mask & 0x0a) === 0x0a && (mask & 0x11) === 0) {
        fromX = i16(x + 5); fromY = i16(y - 1);
        toX = i16(x - 1); toY = i16(y + 5);
        if ((mask & 0x10) !== 0)
            --toY;
        if ((mask & 0x01) !== 0)
            --fromX;
        carved = acceptBuilder(rampBuilder2(r, owner, packXY(fromX, fromY), packXY(toX, toY), regionId));   // 0x590a5x sub_593550
    }

    if (carved === 0 && (mask & 0x28) === 0x28 && (mask & 0x83) === 0) {
        fromX = i16(x + 1); fromY = i16(y + 5);
        toX = i16(x - 5); toY = i16(y - 1);
        if ((mask & 0x40) !== 0)
            --toX;
        if ((mask & 0x04) !== 0)
            --fromY;
        carved = acceptBuilder(rampBuilder3(r, owner, packXY(fromX, fromY), packXY(toX, toY), regionId));   // 0x590axx sub_593030
    }

    if (carved === 0 && (mask & 0xa0) === 0xa0 && (mask & 0x0e) === 0) {
        fromX = i16(x - 5); fromY = i16(y + 1);
        toX = i16(x + 1); toY = i16(y - 5);
        if ((mask & 0x01) !== 0)
            ++toY;
        if ((mask & 0x10) !== 0)
            ++fromX;
        carved = acceptBuilder(rampBuilder3(r, owner, packXY(fromX, fromY), packXY(toX, toY), regionId));   // 0x590bxx sub_593030
    }

// ------------------------------------------------------------------
// [EXE-MATCH] 0x14001EDDB - 0x14001F50A: the four axis strips and the
// four ratio > 0.5 fallbacks are RANDOM-COUNT STRIP LOOPS in the oracle
// exe, not single fixed strips:
//   - helper 0x14001F510 draws twice: n = clamp(F2I64(next * K_UNIT_SCALE
//     * 4), 0, 3) and off = clamp(-n - F2I64((2n+1) * -(next2 *
//     K_UNIT_SCALE)), -n, n);
//   - helper 0x14001F660 draws once per row: with A2 = row + 5, half =
//     A2/2 (C trunc), B = A2 - half, the coin flip (F2I64(next * 2^-31))
//     picks (di, bx) = (half - A2, half) or (-half, B); the corners are
//     from = pack(C - trunc(D/2), base ± di), to = pack(D + C - trunc(D/2),
//     base ± bx) with D = the row's clamped offset and the sign per mode
//     bit 0 — the D/2 is C TRUNC division (cdq;sub;sar), not >>1;
//   - every row's builder result goes through acceptBuilder and the first
//     nonzero result wins.
// The fixed single-strip reading (with its two DrawZeroOrOne jitters) is a
// post-build rewrite of the reference project - the exe never runs it.
// ------------------------------------------------------------------
    const stripPlan = (): { n: number; off: number } => {
        let n = F2I64((r.rng.next() >>> 0) * K_UNIT_SCALE * 4.0);   // 0x14001F580-F5B5
        if (n < 0)
            n = 0;
        if (n > 3)
            n = 3;
        const d2 = r.rng.next() >>> 0;                              // 0x14001F5C6-F601
        let off = -n - F2I64((2 * n + 1) * -(d2 * K_UNIT_SCALE));   // 0x14001F60B-636
        if (off < -n)
            off = -n;
        if (off > n)
            off = n;
        return { n, off };
    };

    const stripCorners = (mode: number, base: number, c: number, a: number, d: number): { from: number; to: number } => {
        const a2 = a + 5;                                   // 0x14001F67B
        const half = a2 >> 1;                               // 0x14001F693-F69B
        const b = a2 - half;
        const coin = F2I64((r.rng.next() >>> 0) * 4.656612874161595e-10);   // 0x14001F702-F70F
        let di = i16(half - a2);                            // 0x14001F6E9-F6F3
        let bx = i16(half);
        if (coin === 0) {                                   // 0x14001F715-F71E
            di = i16(-half);
            bx = i16(b);
        }
        const c2 = i16(c - Math.trunc(d / 2));              // [EXE-MATCH] 0x14001F723-F72E: cdq;sub eax,edx;sar = C
        const d2 = i16(d + c2);                             //   TRUNC div, NOT >>1 (floor): d=-1 gives 0 vs -1.
        // out0 = eax | (C2 << 16): the mode-transformed base lands in the LOW
        // half (X) and C2 in the HIGH half (Y) — 0x14001F793-F7B4.
        const xf = (mode & 1) === 0 ? i16(di + base) : i16(base - di);   // 0x14001F747-F796
        const xt = (mode & 1) === 0 ? i16(bx + base) : i16(base - bx);
        return { from: packXY(xf, c2), to: packXY(xt, d2) };
    };

    // One axis/fallback entry: stripPlan + the row loop; the first accepted
    // strip wins (exe 0x14001F467 jumps to the tail with a nonzero result).
    const stripEntry = (mode: number, c: number, base: number, builder: (from: number, to: number) => number): number => {
        const plan = stripPlan();
        for (let i = plan.n; i >= 0; --i) {
            const d = Math.max(-i, Math.min(plan.off, i));
            const corners = stripCorners(mode, base, c, i, d);
            if (process.env.RMG_DEBUG_STAMP)
                diag(`RAMP-CORNERS mode=${mode} c=${c} base=${base} n=${plan.n} off=${plan.off} i=${i} d=${d} from=(${unpX(corners.from)},${unpYS(corners.from)}) to=(${unpX(corners.to)},${unpYS(corners.to)})`);
            const bres = builder(corners.from, corners.to);
            const r2 = acceptBuilder(bres);
            if (r2 !== 0)
                return r2;
        }
        return 0;
    };

    if (carved === 0 && (mask & 0x70) === 0 && (mask & 0x88) !== 0) {
        const jit = ((mask >>> 7) & 1) - ((mask & 0x08) !== 0 ? 1 : 0);   // 0x14001EDEF
        carved = stripEntry(2, i16(x - 1), i16(y + jit), (from, to) => rampBuilder4(r, owner, from, to, regionId));
    }

    if (carved === 0 && (mask & 0x07) === 0 && (mask & 0x88) !== 0) {
        const jit = ((mask >>> 7) & 1) - ((mask & 0x08) !== 0 ? 1 : 0);   // 0x14001EEC8
        carved = stripEntry(3, i16(x + 1), i16(y + jit), (from, to) => rampBuilder6(r, owner, from, to, regionId));
    }

    if (carved === 0 && (mask & 0xc1) === 0 && (mask & 0x22) !== 0) {
        const jit = ((mask >>> 5) & 1) - ((mask & 0x02) !== 0 ? 1 : 0);   // 0x14001EF98
        carved = stripEntry(1, i16(y - 1), i16(x + jit), (from, to) => rampBuilder5(r, owner, from, to, regionId));
    }

    if (carved === 0 && (mask & 0x1c) === 0 && (mask & 0x22) !== 0) {
        const jit = ((mask >>> 5) & 1) - ((mask & 0x02) !== 0 ? 1 : 0);   // 0x14001F06E
        carved = stripEntry(0, i16(y + 1), i16(x + jit), (from, to) => rampBuilder7(r, owner, from, to, regionId));
    }

    // The second sweep runs only for the later tries (ratio > 0.5), with the
    // same random-count strip loops.
    if (ratio > 0.5 && carved === 0) {                    // 0x590d7x / 0x14001F127
        if ((mask & 0x08) === 0) {                        // 0x14001F13C
            carved = stripEntry(0, i16(y + 1), i16(x), (from, to) => rampBuilder7(r, owner, from, to, regionId));
        }

        if (carved === 0) {
            if ((mask & 0x02) === 0) {                    // 0x14001F1FD
                carved = stripEntry(3, i16(x + 1), i16(y), (from, to) => rampBuilder6(r, owner, from, to, regionId));
            }

            if (carved === 0) {
                if ((mask & 0x08) === 0) {                // 0x14001F2C0
                    carved = stripEntry(1, i16(y - 1), i16(x), (from, to) => rampBuilder5(r, owner, from, to, regionId));
                }

                if (carved === 0 && (mask & 0x20) === 0) {   // 0x14001F37A
                    carved = stripEntry(2, i16(x - 1), i16(y), (from, to) => rampBuilder4(r, owner, from, to, regionId));
                }
            }
        }
    }

    return carved;
}

// ---------------------------------------------------------------------------
// F2I64(Random() * 4.656612874161595e-10) - the 0/1 draw sub_590970 jitters
// the ramp strips with (the value is below 2, so the vanilla's rejection loop
// never repeats).
// ---------------------------------------------------------------------------
export function drawZeroOrOne(r: Rmg): number {
    return F2I64(r.rng.next() * 4.656612874161595e-10);
}

// ---------------------------------------------------------------------------
// sub_590FD0 - the ramp direction mask (0x590fd0 - 0x5910e6).
// ---------------------------------------------------------------------------
export function rampMask(r: Rmg, coords: number, ok: Box<boolean>, regionId: number,
                         ratio: number): number {
    const cx = unpX(coords);
    const cy = unpYS(coords);
    // [EXE-MATCH] 0x14001E4F5-0x14001E51C: threshold = (int)((1-ratio)*10+5)
    // (cvtps2pd ratio; 1.0-ratio; *10.0; +5.0; cvttsd2si). WARNING: the
    // 2026-10-10 README note claims exe = ratio*10+5 — that reading is
    // INVERTED (it trusted the drifted text over the disasm). With ratio*10+5
    // the low-ratio attempts pass their mask and consume strip draws, which
    // desyncs the whole attempt stream from the exe (05CC51D7: exe cancel #1
    // (84,24)R4 needs (83,25) tried at att=30/threshold 12, not att=24/7).
    const threshold = F2I64((1.0 - ratio) * 10.0 + 5.0);           // 0x590ff5

    if (!rectHasRegionCells(r, cx - 2, cy - 2, 5, 5,      // 0x591031
        regionId, threshold)) {
        ok.v = false;                                     // 0x591052
        return 0;
    }

    const K_SAMPLE_BIT = [0x40, 0x80, 0x01,
        0x20, 0x00, 0x02,
        0x10, 0x08, 0x04];

    let mask = 0;
    for (let i = 0; i < 3; ++i) {                         // 0x59105f
        for (let j = 0; j < 3; ++j) {                     // 0x59106a
            if (i === 1 && j === 1)                       // 0x591074
                continue;
            const sx = cx - 7 + 5 * j;                    // 0x59106c / 0x5910cb
            const sy = cy - 7 + 5 * i;                    // 0x59108b
            if (rectHasRegionCells(r, sx, sy, 5, 5, regionId, threshold))   // 0x5910a9
                mask |= K_SAMPLE_BIT[3 * i + j]!;         // 0x5910bd dword_82AF18
        }
    }
    return mask;
}

// ---------------------------------------------------------------------------
// sub_5A1E50 - "does the region own enough of this rectangle?"
// (0x5a1e50 - 0x5a1f6d). W' is dword_ABED04 and W' + 2H' is dword_ABED08,
// i.e. the same diamond window CellExists tests.
// ---------------------------------------------------------------------------
export function rectHasRegionCells(r: Rmg, x: number, y: number, w: number, h: number,
                                   regionId: number, threshold: number): boolean {
    if (r.work.count === 0 || h <= 0)
        return false;

    const side = r.size.workSide;
    let count = 0;
    for (let row = 0; row < h; ++row) {                   // 0x5a1e5x
        for (let col = 0; col < w; ++col) {
            const cx = x + col;
            const cy = y + row;
            const sum = cx + cy;
            if (sum <= r.size.mapWidth                    // the diamond window
                || cx - cy >= r.size.mapWidth
                || cy - cx >= r.size.mapWidth
                || sum > r.size.mapWidth + 2 * r.size.mapHeight)
                continue;
            const mark = r.work.i(cx + side * cy, 14);
            if (mark === regionId && ++count >= threshold)    // 0x5a1f2x
                return true;
        }
    }
    return false;
}

// ---------------------------------------------------------------------------
// sub_58D070 - write the region-id mark (work[+56]) of one cell (0x58d070, 39
// bytes). Identical to sub_5A0090, which CliffPass inlines.
// ---------------------------------------------------------------------------
export function setWorkMark(r: Rmg, coords: number, value: number): void {
    if (r.work.count === 0)
        return;
    r.work.setI(r.workIndex(unpX(coords), unpYS(coords)), 14, value);   // 0x58d08a
}

// ---------------------------------------------------------------------------
// sub_594010 - the ramp builders' coverage precondition (0x594010 - 0x594183).
// The vanilla walks the rectangle row by row and leaves through the outer loop
// as soon as a cell fails either test.
// ---------------------------------------------------------------------------
export function rampRectClear(r: Rmg, owner: MapRegion | null, x: number, y: number,
                              w: number, h: number, targetId: number): boolean {
    if (owner === null || r.work.count === 0)
        return false;

    if (!isWithinUsableArea(r, packXY(i16(x), i16(y)), true)
        || !isWithinUsableArea(r, packXY(i16(x + w - 1), i16(y)), true)
        || !isWithinUsableArea(r, packXY(i16(x), i16(y + h - 1)), true)
        || !isWithinUsableArea(r, packXY(i16(x + w - 1), i16(y + h - 1)), true))
        return false;

    const side = r.size.workSide;
    for (let row = y; row < y + h; ++row) {
        for (let col = x; col < x + w; ++col) {
            const mark = r.work.i(col + side * row, 14);
            if (mark !== owner.id && mark !== targetId)   // 0x5941xx
                return false;
            if (!r.isPlaceholderTile(r.cellAt(i16(col), i16(row))))
                return false;   // sub_486380
        }
    }

    // [EXE-MATCH] 0x14002057E-0x140020690: the halo scan rejects a strip whose
    // ±2 neighbourhood holds a THIRD region's cell at or above the OWNER's
    // level + 1 (the earlier target-level+2 reading was a port guess that
    // rejected whole plateaus the exe happily carves past).
    {
        const highEnough = owner.level + 1;
        for (let row = y - 2; row <= y + h + 1; ++row) {
            for (let col = x - 2; col <= x + w + 1; ++col) {
                if (!r.cellExists(i16(col), i16(row)))
                    continue;
                const m = r.work.i(col + side * row, 14);
                if (m <= 0 || m === owner.id || m === targetId)
                    continue;
                const mc = r.cellAt(i16(col), i16(row));
                if (mc.level >= highEnough)
                    return false;
            }
        }
    }
    return true;
}

// ---------------------------------------------------------------------------
// sub_593AF0 - the first ramp builder: the module stamping plus the three ramp
// bands of one ramp (0x593af0 - 0x593ffe). No RNG.
// ---------------------------------------------------------------------------
export function rampBuilder1(r: Rmg, owner: MapRegion | null, from: number, to: number,
                             targetId: number): number {
    if (owner === null || r.work.count === 0)
        return 0;

    const fromX = unpX(from);
    const fromY = unpYS(from);
    const toX = unpX(to);
    const toY = unpYS(to);

    const w = toX - fromX;                                // 0x593af6
    if (w < 3)
        return 0;
    const h = toY - fromY;
    if (h < 3)
        return 0;

    const blockW = w + 10;                                // 0x593b1x
    const blockH = h + 10;
    const originX = fromX - 7;
    const originY = fromY - 4;
    if (!rampRectClear(r, owner, originX, originY, blockW, blockH, targetId))   // 0x593b4x
        return 0;

    const target = findRegionById(r, targetId);           // sub_5943E0
    const targetLevel = target !== null ? target.level : 0;

    // a) the block's first band: h + 10 rows from originY, 7 columns from originX
    for (let y = originY; y < originY + blockH; ++y) {
        for (let x = originX; x < originX + 7; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;                                 // sub_5AC230
            setWorkMark(r, packXY(x, y), targetId);       // 0x593cxx sub_58D070
            r.cellAt(i16(x), i16(y)).level = targetLevel;
        }
    }

    // b) rows to.Y + 1 .. to.Y + 7, columns originX .. originX + blockW - 1
    for (let y = toY + 1; y < toY + 8; ++y) {
        for (let x = originX; x < originX + blockW; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), targetId);
            r.cellAt(i16(x), i16(y)).level = targetLevel;
        }
    }

    const ownerLevel = owner.level;                       // *(this + 16)

    // c) row from.Y, columns from.X .. from.X + 1
    for (let y = fromY; y < fromY + 1; ++y) {
        for (let x = fromX; x < fromX + 2; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), owner.id);       // 0x593exx
            r.cellAt(i16(x), i16(y)).level = ownerLevel;
        }
    }

    // d) rows to.Y - 1 .. to.Y, column to.X
    for (let y = toY - 1; y < toY + 1; ++y) {
        for (let x = toX; x < toX + 1; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), owner.id);
            r.cellAt(i16(x), i16(y)).level = ownerLevel;
        }
    }

    // e) rows from.Y + 1 .. to.Y - 1, columns from.X + 1 .. to.X - 1
    for (let y = fromY + 1; y < toY; ++y) {
        for (let x = fromX + 1; x < toX; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), owner.id);
            r.cellAt(i16(x), i16(y)).level = ownerLevel;
        }
    }

    // 4. the two slope-set pieces (0x593f4x - 0x593f9x)
    placeWaterDetailTile(r, r.slopeSetPiecesIndex + 7,
        packXY(i16(fromX - 3), i16(fromY)),
        targetId, ownerLevel);
    placeWaterDetailTile(r, r.slopeSetPiecesIndex + 1,
        packXY(i16(toX - 2), i16(toY)),
        targetId, ownerLevel);

    // 5. band A - the diagonal run (0x593f9x)
    for (let n = 0; n < 4; ++n) {
        const cell = r.cellAt(i16(fromX - n), i16(toY + n));
        cell.slopeIndex = 8;
        cell.level = ownerLevel - n - 1;
        cell.isoTileTypeIndex = r.rampBaseIndex + 7;
        cell.height = 0;
    }

    // band B - the downward run (0x593fcx)
    for (let n = 0; n < 4; ++n) {
        for (let i = 0; i < h + n - 3; ++i) {
            const cell = r.cellAt(i16(fromX - n), i16(fromY + i + 3));
            cell.slopeIndex = 1;
            cell.level = ownerLevel - n - 1;
            cell.isoTileTypeIndex = r.rampBaseIndex;
            cell.height = 0;
        }
    }

    // band C - the sideways run (0x593fex)
    for (let n = 0; n < 4; ++n) {
        for (let j = 0; j < w + n - 3; ++j) {
            const cell = r.cellAt(i16(toX - j - 3), i16(toY + n));
            cell.slopeIndex = 4;
            cell.level = ownerLevel - n - 1;
            cell.isoTileTypeIndex = r.rampBaseIndex + 3;
            cell.height = 0;
        }
    }

    return 1;
}

// ---------------------------------------------------------------------------
// sub_593550 - the second ramp builder, the mirror of sub_593AF0
// (0x593550 - 0x593ae1). No RNG. `from` is the vanilla's a2 and `to` its
// p_pMapCoord_1: w = from.X - to.X and h = to.Y - from.Y, both at least 3.
// ---------------------------------------------------------------------------
export function rampBuilder2(r: Rmg, owner: MapRegion | null, from: number, to: number,
                             targetId: number): number {
    if (owner === null || r.work.count === 0)
        return 0;

    const fromX = unpX(from);
    const fromY = unpYS(from);
    const toX = unpX(to);
    const toY = unpYS(to);

    const w = fromX - toX;                                // 0x59355x
    if (w < 3)
        return 0;
    const h = toY - fromY;
    if (h < 3)
        return 0;

    const blockW = w + 10;
    const blockH = h + 10;
    const originX = toX - 7;                              // 0x59358x
    const originY = toY - 7;
    if (!rampRectClear(r, owner, originX, originY, blockW, blockH, targetId))   // 0x5935ax
        return 0;

    const target = findRegionById(r, targetId);           // sub_5943E0
    const targetLevel = target !== null ? target.level : 0;
    const ownerLevel = owner.level;

    // a) rows originY .. originY + 6, columns originX .. originX + blockW - 1
    for (let y = originY; y < originY + 7; ++y) {
        for (let x = originX; x < originX + blockW; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), targetId);       // sub_58D070
            r.cellAt(i16(x), i16(y)).level = targetLevel;
        }
    }

    // b) rows originY .. originY + blockH - 1, columns originX .. originX + 6
    for (let y = originY; y < originY + blockH; ++y) {
        for (let x = originX; x < originX + 7; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), targetId);
            r.cellAt(i16(x), i16(y)).level = targetLevel;
        }
    }

    // c) rows from.Y .. from.Y + 1, column from.X
    for (let y = fromY; y < fromY + 2; ++y) {
        for (let x = fromX; x < fromX + 1; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), owner.id);
            r.cellAt(i16(x), i16(y)).level = ownerLevel;
        }
    }

    // d) row to.Y, columns to.X .. to.X + 1
    for (let y = toY; y < toY + 1; ++y) {
        for (let x = toX; x < toX + 2; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), owner.id);
            r.cellAt(i16(x), i16(y)).level = ownerLevel;
        }
    }

    // e) rows from.Y + 1 .. to.Y - 1, columns to.X + 1 .. from.X - 1
    for (let y = fromY + 1; y < toY; ++y) {
        for (let x = toX + 1; x < fromX; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), owner.id);
            r.cellAt(i16(x), i16(y)).level = ownerLevel;
        }
    }

    // 3. the four slope-set pieces (0x5938xx - 0x5939xx)
    placeWaterDetailTile(r, r.slopeSetPiecesIndex + 5,
        packXY(i16(fromX - 2), i16(fromY - 3)),
        targetId, ownerLevel);
    placeWaterDetailTile(r, r.slopeSetPiecesIndex + 6,
        packXY(i16(fromX - 1), i16(fromY - 1)),
        targetId, ownerLevel);
    placeWaterDetailTile(r, r.slopeSetPiecesIndex + 8,
        packXY(i16(toX - 3), i16(toY - 2)),
        targetId, ownerLevel);
    placeWaterDetailTile(r, r.slopeSetPiecesIndex + 9,
        packXY(i16(toX - 1), i16(toY - 1)),
        targetId, ownerLevel);

    // 4. band A - the anti-diagonal run (0x593a0x)
    for (let n = 0; n < 4; ++n) {
        const cell = r.cellAt(i16(toX - n), i16(fromY - n));
        cell.slopeIndex = 5;
        cell.level = ownerLevel - n - 1;
        cell.isoTileTypeIndex = r.rampBaseIndex + 4;
        cell.height = 0;
    }

    // band B - the upward run (0x593a5x)
    for (let n = 0; n < 4; ++n) {
        for (let i = 0; i < w + n - 3; ++i) {
            const cell = r.cellAt(i16(fromX - i - 3), i16(fromY - n));
            cell.slopeIndex = 2;
            cell.level = ownerLevel - n - 1;
            cell.isoTileTypeIndex = r.rampBaseIndex + 1;
            cell.height = 0;
        }
    }

    // band C - the sideways run (0x593aax)
    for (let n = 0; n < 4; ++n) {
        for (let j = 0; j < h + n - 3; ++j) {
            const cell = r.cellAt(i16(toX - n), i16(toY - j - 3));
            cell.slopeIndex = 1;
            cell.level = ownerLevel - n - 1;
            cell.isoTileTypeIndex = r.rampBaseIndex;
            cell.height = 0;
        }
    }

    return 1;
}

// ---------------------------------------------------------------------------
// sub_593030 - the third ramp builder, shared by two cascade branches
// (0x593030 - 0x593546). No RNG. w = from.X - to.X and h = from.Y - to.Y,
// both at least 3.
// ---------------------------------------------------------------------------
export function rampBuilder3(r: Rmg, owner: MapRegion | null, from: number, to: number,
                             targetId: number): number {
    if (owner === null || r.work.count === 0)
        return 0;

    const fromX = unpX(from);
    const fromY = unpYS(from);
    const toX = unpX(to);
    const toY = unpYS(to);

    const w = fromX - toX;                                // 0x59303x
    if (w < 3)
        return 0;
    const h = fromY - toY;
    if (h < 3)
        return 0;

    const blockW = w + 10;
    const blockH = h + 10;
    const originX = toX - 2;                              // 0x59306x
    const originY = toY - 7;
    if (!rampRectClear(r, owner, originX, originY, blockW, blockH, targetId))   // 0x59308x
        return 0;

    const target = findRegionById(r, targetId);           // sub_5943E0
    const targetLevel = target !== null ? target.level : 0;
    const ownerLevel = owner.level;

    // a) rows originY .. originY + 6, columns originX .. originX + blockW - 1
    for (let y = originY; y < originY + 7; ++y) {
        for (let x = originX; x < originX + blockW; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), targetId);       // sub_58D070
            r.cellAt(i16(x), i16(y)).level = targetLevel;
        }
    }

    // b) rows originY .. originY + blockH - 1, columns from.X + 1 .. from.X + 7
    for (let y = originY; y < originY + blockH; ++y) {
        for (let x = fromX + 1; x < fromX + 8; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), targetId);
            r.cellAt(i16(x), i16(y)).level = targetLevel;
        }
    }

    // c) rows to.Y .. to.Y + 1, column to.X
    for (let y = toY; y < toY + 2; ++y) {
        for (let x = toX; x < toX + 1; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), owner.id);
            r.cellAt(i16(x), i16(y)).level = ownerLevel;
        }
    }

    // d) row from.Y, columns from.X - 1 .. from.X
    for (let y = fromY; y < fromY + 1; ++y) {
        for (let x = fromX - 1; x < fromX + 1; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), owner.id);
            r.cellAt(i16(x), i16(y)).level = ownerLevel;
        }
    }

    // e) rows to.Y + 1 .. from.Y - 1, columns to.X + 1 .. from.X - 1
    for (let y = toY + 1; y < fromY; ++y) {
        for (let x = toX + 1; x < fromX; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), owner.id);
            r.cellAt(i16(x), i16(y)).level = ownerLevel;
        }
    }

    // 3. the two slope-set pieces (0x5937xx)
    placeWaterDetailTile(r, r.slopeSetPiecesIndex + 2,
        packXY(i16(fromX), i16(fromY - 2)),
        targetId, ownerLevel);
    placeWaterDetailTile(r, r.slopeSetPiecesIndex + 4,
        packXY(i16(toX), i16(toY - 3)),
        targetId, ownerLevel);

    // 4. band A - the diagonal run (0x5937xx)
    for (let n = 0; n < 4; ++n) {
        const cell = r.cellAt(i16(fromX + n), i16(toY - n));
        cell.slopeIndex = 6;
        cell.level = ownerLevel - n - 1;
        cell.isoTileTypeIndex = r.rampBaseIndex + 5;
        cell.height = 0;
    }

    // band B - the downward run (0x59384x)
    for (let n = 0; n < 4; ++n) {
        for (let i = 0; i < h + n - 3; ++i) {
            const cell = r.cellAt(i16(fromX + n), i16(fromY - 3 - i));
            cell.slopeIndex = 3;
            cell.level = ownerLevel - n - 1;
            cell.isoTileTypeIndex = r.rampBaseIndex + 2;
            cell.height = 0;
        }
    }

    // band C - the sideways run (0x5938ax)
    for (let n = 0; n < 4; ++n) {
        for (let j = 0; j < w + n - 3; ++j) {
            const cell = r.cellAt(i16(toX + 3 + j), i16(toY - n));
            cell.slopeIndex = 2;
            cell.level = ownerLevel - n - 1;
            cell.isoTileTypeIndex = r.rampBaseIndex + 1;
            cell.height = 0;
        }
    }

    return 1;
}

// ---------------------------------------------------------------------------
// sub_592440 - the fourth ramp builder (0x592440 - 0x592ae3). Serves the fifth
// cascade branch (mask 0x70 == 0 && 0x88 set) and the tail sweep's last
// attempt. One RNG draw of 0/1 inside the dx != 0 gate.
// ---------------------------------------------------------------------------
export function rampBuilder4(r: Rmg, owner: MapRegion | null, from: number, to: number,
                             targetId: number): number {
    if (owner === null || r.work.count === 0)
        return 0;

    const fromX = unpX(from);
    const fromY = unpYS(from);
    const toX = unpX(to);
    const toY = unpYS(to);

    const minX = fromX <= toX ? fromX : toX;              // 0x59244x
    const maxX = fromX >= toX ? fromX : toX;
    const blockX = minX - 7;
    const blockY = fromY - 4;
    const blockW = maxX - minX + 11;
    const blockH = toY - fromY + 9;
    if (!rampRectClear(r, owner, blockX, blockY, blockW, blockH, targetId))   // 0x5924xx
        return 0;

    const dx = toX - fromX;                               // Y_12
    const dy = toY - fromY;                               // v12
    const adx = dx < 0 ? -dx : dx;                        // v83
    if (adx > dy - 5)                                     // 0x5924xx
        return 0;

    const target = findRegionById(r, targetId);           // sub_5943E0
    const targetLevel = target !== null ? target.level : 0;
    const ownerLevel = owner.level;
    const half = Math.trunc((dy + 1) / 2) + 2;            // v17

    // 1. rows blockY .. (loop 2's start row), columns blockX .. from.X - 1
    //
    // PORT FIX (ramp-into-cliff, NW-facing Builder4): for an EVEN dy the two
    // vanilla bounds leave exactly ONE row uncovered, which later gets stamped
    // as a cliff straight through the ramp. Run this stamp straight up to
    // loop 2's start row; for odd dy the new bound equals the old bound.
    for (let y = blockY; y < toY - half + 3; ++y) {
        for (let x = blockX; x < fromX; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), targetId);
            r.cellAt(i16(x), i16(y)).level = targetLevel;
        }
    }

    // 2. rows to.Y - half + 3 .. to.Y + 4, columns blockX .. to.X - 1
    for (let y = toY - half + 3; y < toY + 5; ++y) {
        for (let x = blockX; x < toX; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), targetId);
            r.cellAt(i16(x), i16(y)).level = targetLevel;
        }
    }

    // 3. rows from.Y .. half + from.Y - 2, columns from.X .. maxX + 2
    for (let y = fromY; y < half + fromY - 1; ++y) {
        for (let x = fromX; x < maxX + 3; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), owner.id);
            r.cellAt(i16(x), i16(y)).level = ownerLevel;
        }
    }

    // 4. rows to.Y - half + 3 .. to.Y, columns to.X .. maxX + 2
    for (let y = toY - half + 3; y < toY + 1; ++y) {
        for (let x = toX; x < maxX + 3; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), owner.id);
            r.cellAt(i16(x), i16(y)).level = ownerLevel;
        }
    }

    // 5. the three slope-set pieces (0x5926xx)
    placeWaterDetailTile(r, r.slopeSetPiecesIndex + 7,
        packXY(i16(fromX - 3), i16(fromY)),
        targetId, ownerLevel);
    placeWaterDetailTile(r, r.slopeSetPiecesIndex + 8,
        packXY(i16(toX - 3), i16(toY - 2)),
        targetId, ownerLevel);
    placeWaterDetailTile(r, r.slopeSetPiecesIndex + 9,
        packXY(i16(toX - 1), i16(toY - 1)),
        targetId, ownerLevel);

    // 6. the table-driven strip (0x5928xx).
    //
    // Vanilla sub_592440 zeroes v73 BEFORE `if (dx)` and runs the step-7 tail
    // strip OUTSIDE that gate: on a straight vertical strip (dx == 0) the
    // three big pieces are still placed, and the tail is what fills the
    // corridor between them. Keep the biases out here, zero-initialised.
    let tailBiasLow = 0;                                  // LOWORD(v73)
    let tailBiasHigh = 0;                                 // HIWORD(v73)
    if (dx !== 0) {
        const side = dx > 0 ? 1 : 0;                      // Y_9 / Y_1
        let draw: number;
        do {
            draw = drawZeroOrOne(r);                      // [RNG] 0/1
        } while (draw > 1);

        // Two different biases drive the two loops:
        //   - the strip loop adds (side, draw == 1 ? 0
        //                                            : to.Y - adx - from.Y - 5)
        //   - the tail loop adds v73 = (draw == 1) ? pack(dx, adx) : 0
        const stripBiasLow = side;
        const stripBiasHigh = draw === 1 ? 0 : toY - adx - fromY - 5;
        if (draw === 1) {
            tailBiasLow = i16(dx);
            tailBiasHigh = adx;
        }

        const K_LEVEL_OFFSETS = [3, 2, 1, 0, 0];               // 0x82AFF0 + 4i
        const K_SLOPE_OFFSETS = [                              // 0x82B004 / 0x82B018
            [9, 13, 13, 13, 5],
            [12, 16, 16, 16, 8],
        ];

        if (adx > 0) {
            let column = 0;                               // pMapCoord_.x, the ++ counter
            let mirror = 0;                               // X_1, decremented
            do {
                const columnPart = side !== 0 ? column : mirror;    // X_7
                for (let i = 0; i < 5; ++i) {
                    // cell.X = columnPart + (int16)(stripBiasLow + from.X - i)
                    // cell.Y = column + from.Y + 3 + stripBiasHigh
                    const cx = i16(
                        columnPart + i16(stripBiasLow + fromX - i));
                    const cy = i16(
                        column + fromY + 3 + stripBiasHigh);
                    const cell = r.cellAt(i16(cx), i16(cy));
                    cell.level = ownerLevel + K_LEVEL_OFFSETS[i]! - 4;   // 0x59297x
                    const slopeByte = K_SLOPE_OFFSETS[side]![i]!;
                    cell.slopeIndex = slopeByte;          // 0x592980
                    cell.height = 0;                      // 0x592999
                    cell.isoTileTypeIndex = slopeByte + r.rampBaseIndex - 1;
                }
                --mirror;
            } while (++column < adx);
        }
    }

    // 7. the tail strip (0x5929Dx - 0x592acx), 4 cells per row.
    // UNCONDITIONAL in vanilla: dx == 0 simply uses the zero biases above.
    const tailRows = toY - fromY - adx - 5;
    for (let row = 0; row < tailRows; ++row) {
        for (let n = 0; n < 4; ++n) {
            const cx = i16(tailBiasLow + fromX - n);
            const cy = i16(tailBiasHigh + fromY + 3 + row);
            setWorkMark(r, packXY(cx, cy), targetId);     // 0x5929xx (the mark)
            const cell = r.cellAt(cx, cy);
            cell.slopeIndex = 1;
            cell.level = ownerLevel - n - 1;
            cell.isoTileTypeIndex = r.rampBaseIndex;
            cell.height = 0;
        }
    }

    return 1;
}

// ---------------------------------------------------------------------------
// sub_591D80 - the fifth ramp builder, the vertical mirror of sub_592440
// (0x591d80 - 0x59243b). Serves the seventh cascade branch (mask 0xC1 == 0 &&
// 0x22 set). No RNG apart from the one strip draw.
// ---------------------------------------------------------------------------
export function rampBuilder5(r: Rmg, owner: MapRegion | null, from: number, to: number,
                             targetId: number): number {
    if (owner === null || r.work.count === 0)
        return 0;

    const fromX = unpX(from);
    const fromY = unpYS(from);
    const toX = unpX(to);
    const toY = unpYS(to);

    const minY = fromY <= toY ? fromY : toY;              // 0x591d9x
    const maxY = fromY >= toY ? fromY : toY;
    const blockX = toX - 4;
    const blockY = minY - 7;
    const blockW = fromX - toX + 8;
    const blockH = maxY - minY + 11;
    if (!rampRectClear(r, owner, blockX, blockY, blockW, blockH, targetId))   // 0x591dxx
        return 0;

    const dy = toY - fromY;
    const ady = dy < 0 ? -dy : dy;                        // p_pMapCoordb
    const dx = fromX - toX;                               // v13
    if (ady > dx - 5)                                     // 0x591dxx
        return 0;

    const target = findRegionById(r, targetId);           // sub_5943E0
    const targetLevel = target !== null ? target.level : 0;
    const ownerLevel = owner.level;
    const v17 = Math.trunc((dx + 1) / 2) + 3;             // 0x591dxx

    // 1. rows minY - 7 .. to.Y - 1, columns blockX .. blockX + v17 + 1
    for (let y = blockY; y < toY; ++y) {
        for (let x = blockX; x < blockX + v17 + 2; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), targetId);
            r.cellAt(i16(x), i16(y)).level = targetLevel;
        }
    }

    // 2. rows minY - 7 .. from.Y - 1, columns from.X - v17 + 2 .. from.X + 4
    for (let y = blockY; y < fromY; ++y) {
        for (let x = fromX - v17 + 2; x < fromX + 5; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), targetId);
            r.cellAt(i16(x), i16(y)).level = targetLevel;
        }
    }

    // 3. rows to.Y .. maxY + 1, columns to.X .. to.X + v17 - 3
    for (let y = toY; y < maxY + 2; ++y) {
        for (let x = toX; x < toX + v17 - 2; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), owner.id);
            r.cellAt(i16(x), i16(y)).level = ownerLevel;
        }
    }

    // 4. rows from.Y .. maxY + 1, columns from.X - v17 + 2 .. from.X
    for (let y = fromY; y < maxY + 2; ++y) {
        for (let x = fromX - v17 + 2; x < fromX + 1; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), owner.id);
            r.cellAt(i16(x), i16(y)).level = ownerLevel;
        }
    }

    // 5. the three slope-set pieces (0x5920xx)
    placeWaterDetailTile(r, r.slopeSetPiecesIndex + 4,
        packXY(i16(toX), i16(toY - 3)),
        targetId, ownerLevel);
    placeWaterDetailTile(r, r.slopeSetPiecesIndex + 5,
        packXY(i16(fromX - 2), i16(fromY - 3)),
        targetId, ownerLevel);
    placeWaterDetailTile(r, r.slopeSetPiecesIndex + 6,
        packXY(i16(fromX - 1), i16(fromY - 1)),
        targetId, ownerLevel);

    // 6. the table-driven strip (0x5921xx - 0x5923xx)
    let tailBiasLow = 0;
    let tailBiasHigh = 0;
    if (dy !== 0) {
        const side = dy > 0 ? 1 : 0;                      // pMapCoord___7
        let draw: number;
        do {
            draw = drawZeroOrOne(r);                      // [RNG] 0/1
        } while (draw > 1);

        const stripBias = draw === 1 ? 0 : fromX - ady - toX - 5;   // v70
        tailBiasLow = draw === 1 ? ady : 0;               // LOWORD(v68)
        tailBiasHigh = draw === 1 ? -dy : 0;              // HIWORD(v68)

        const K_LEVEL_OFFSETS = [3, 2, 1, 0, 0];               // 0x82AFB4 + 4i
        const K_SLOPE_OFFSETS = [                              // 0x82AFC8 / 0x82AFDC
            [10, 14, 14, 14, 6],
            [9, 13, 13, 13, 5],
        ];

        if (ady > 0) {
            // [EXE-MATCH] 0x140023105 - 0x140023247: the band rows use CHAINED
            // registers - X_i = prevY + stripBias + toX + 3 (ecx carries the
            // previous cell's Y; 0 for the first cell), and
            // Y_i = belowZero - i + (prevY > 0 ? rowCounter : prevY) + toY - 1
            // (r13d reloads [rsp+44h] = owner.level inside the loop, so the
            // level term stays ownerLevel + T1[i] - 4). The drifted text's
            // column/mirror geometry stamps the band one row too low.
            const belowZero = dy < 0 ? 1 : 0;             // v71 (r14w = sign of dy)
            let ecx = 0;                                  // chains the previous Y
            let rowCounter = 0;                           // r12d, -1 per row
            let row = 0;                                  // ebp
            do {
                for (let i = 0; i < 5; ++i) {
                    const cx = i16(ecx + stripBias + toX + 3);
                    const cy = i16(belowZero - i + (ecx > 0 ? rowCounter : ecx) + toY - 1);
                    const cell = r.cellAt(cx, cy);
                    cell.level = ownerLevel + K_LEVEL_OFFSETS[i]! - 4;   // 0x5922xx
                    const slopeByte = K_SLOPE_OFFSETS[side]![i]!;
                    cell.slopeIndex = slopeByte;          // 0x5922xx
                    cell.height = 0;
                    cell.isoTileTypeIndex = slopeByte + r.rampBaseIndex - 1;
                    ecx = cy;                             // mov ecx, r8d
                }
                --rowCounter;                             // dec r12d
                ++row;
            } while (row < ady);
        }
    }

    // 7. the tail strip (0x5923xx), 4 cells per row
    const tailRows = fromX - toX - ady - 5;
    for (let row = 0; row < tailRows; ++row) {
        for (let n = 0; n < 4; ++n) {
            const cx = i16(tailBiasLow + row + toX + 3);
            const cy = i16(tailBiasHigh + toY - n);
            setWorkMark(r, packXY(cx, cy), targetId);     // 0x5923xx (the mark)
            const cell = r.cellAt(cx, cy);
            cell.slopeIndex = 2;
            cell.level = ownerLevel - n - 1;
            cell.isoTileTypeIndex = r.rampBaseIndex + 1;
            cell.height = 0;
        }
    }

    return 1;
}

// ---------------------------------------------------------------------------
// sub_591740 - the sixth ramp builder (0x591740 - 0x591d7e). Serves the sixth
// cascade branch (mask 0x07 == 0 && 0x88 set) and the tail sweep's second
// attempt. One RNG draw of 0/1 inside the dx != 0 gate.
// ---------------------------------------------------------------------------
export function rampBuilder6(r: Rmg, owner: MapRegion | null, from: number, to: number,
                             targetId: number): number {
    if (owner === null || r.work.count === 0)
        return 0;

    const fromX = unpX(from);
    const fromY = unpYS(from);
    const toX = unpX(to);
    const toY = unpYS(to);

    const minX = fromX <= toX ? fromX : toX;              // 0x59175x
    const maxX = fromX >= toX ? fromX : toX;
    const blockX = minX - 3;
    const blockY = toY - 4;
    const blockW = maxX - minX + 11;
    const blockH = fromY - toY + 9;
    if (!rampRectClear(r, owner, blockX, blockY, blockW, blockH, targetId))   // 0x5917xx
        return 0;

    const dy = fromY - toY;                               // v13
    const dx2 = toX - fromX;                              // v72
    const adx = dx2 < 0 ? -dx2 : dx2;                     // v86
    if (adx > dy - 5)                                     // 0x5917xx
        return 0;

    const target = findRegionById(r, targetId);           // sub_5943E0
    const targetLevel = target !== null ? target.level : 0;
    const ownerLevel = owner.level;
    const q = Math.trunc((dy + 1) / 2);                   // (v13 + 1) / 2

    // 1. rows from.Y - q .. from.Y + 4, columns from.X + 1 .. from.X + 7
    for (let y = fromY - q; y < fromY + 5; ++y) {
        for (let x = fromX + 1; x < fromX + 8; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), targetId);
            r.cellAt(i16(x), i16(y)).level = targetLevel;
        }
    }

    // 2. rows to.Y - 4 .. to.Y + q - 1, columns to.X + 1 .. to.X + 7
    for (let y = toY - 4; y < toY + q; ++y) {
        for (let x = toX + 1; x < toX + 8; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), targetId);
            r.cellAt(i16(x), i16(y)).level = targetLevel;
        }
    }

    // 3. rows from.Y - q .. from.Y, columns blockX + 2 .. from.X
    for (let y = fromY - q; y < fromY + 1; ++y) {
        for (let x = blockX + 2; x < fromX + 1; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), owner.id);
            r.cellAt(i16(x), i16(y)).level = ownerLevel;
        }
    }

    // 4. rows to.Y .. to.Y + q - 1, columns blockX + 2 .. to.X
    for (let y = toY; y < toY + q; ++y) {
        for (let x = blockX + 2; x < toX + 1; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), owner.id);
            r.cellAt(i16(x), i16(y)).level = ownerLevel;
        }
    }

    // 5. the two slope-set pieces (0x591axx)
    placeWaterDetailTile(r, r.slopeSetPiecesIndex + 2,
        packXY(i16(fromX), i16(fromY - 2)),
        targetId, ownerLevel);
    placeWaterDetailTile(r, r.slopeSetPiecesIndex + 3,
        packXY(i16(toX), i16(toY)), targetId, ownerLevel);

    // 6. the table-driven strip (0x591bxx - 0x591cxx).
    // Same vanilla gate as sub_592440: sub_591740 zeroes v76 before `if (dx)`
    // and its step-7 tail strip sits OUTSIDE that gate.
    let tailLow = 0;                                      // LOWORD(v76)
    let tailHigh = 0;                                     // HIWORD(v76)
    if (dx2 !== 0) {
        const side = dx2 > 0 ? 1 : 0;                     // Y_9
        let draw: number;
        do {
            draw = drawZeroOrOne(r);                      // [RNG] 0/1
        } while (draw > 1);

        const sign = dx2 >= 0 ? 0 : -1;                   // LOWORD(v75)
        const v75Low = sign;
        const v75High = draw === 1 ? sign : -(fromY - adx - toY - 5);
        if (draw === 1) {
            tailLow = dx2;                                // LOWORD(v76)
            tailHigh = -adx;                              // HIWORD(v76)
        }

        const K_LEVEL_OFFSETS = [3, 2, 1, 0, 0];               // 0x82AF78 + 4i
        const K_SLOPE_OFFSETS = [                              // 0x82AF8C / 0x82AFA0
            [10, 14, 14, 14, 6],
            [11, 15, 15, 15, 7],
        ];

        if (adx > 0) {
            let counter = 0;                              // pMapCoord_
            let mirror = 0;                               // Y
            do {
                const columnPart = side !== 0 ? counter : mirror;   // X_6
                for (let i = 0; i < 5; ++i) {
                    const cx = i16(
                        columnPart + i16(v75Low + i + fromX));
                    const cy = i16(
                        -counter + fromY - 3 + v75High);
                    const cell = r.cellAt(i16(cx), i16(cy));
                    cell.level = ownerLevel + K_LEVEL_OFFSETS[i]! - 4;   // 0x591cxx
                    const slopeByte = K_SLOPE_OFFSETS[side]![i]!;
                    cell.slopeIndex = slopeByte;
                    cell.height = 0;
                    cell.isoTileTypeIndex = slopeByte + r.rampBaseIndex - 1;
                }
                ++counter;                                // 0x591dxx
                --mirror;
            } while (counter < adx);
        }
    }

    // 7. the tail strip (0x591dxx), 4 cells per row.
    // UNCONDITIONAL in vanilla: dx2 == 0 uses the zero biases above.
    const tailRows = fromY - toY - adx - 5;
    for (let row = 0; row < tailRows; ++row) {
        for (let n = 0; n < 4; ++n) {
            const cx = i16(n + fromX + tailLow);
            const cy = i16(-row + fromY - 3 + tailHigh);
            setWorkMark(r, packXY(cx, cy), targetId);     // 0x591dxx (the mark)
            const cell = r.cellAt(cx, cy);
            cell.slopeIndex = 3;
            cell.level = ownerLevel - n - 1;
            cell.isoTileTypeIndex = r.rampBaseIndex + 2;
            cell.height = 0;
        }
    }

    return 1;
}

// ---------------------------------------------------------------------------
// sub_5910F0 - the seventh ramp builder (0x5910f0 - 0x59173f). Serves the
// eighth cascade branch (mask 0x1C == 0 && 0x22 set) and the first attempt of
// the ratio > 0.5 tail sweep. The transposed twin of sub_591740 (builder 6):
// the 5-cell strip runs in Y while the columns advance in X.
// ---------------------------------------------------------------------------
export function rampBuilder7(r: Rmg, owner: MapRegion | null, from: number, to: number,
                             targetId: number): number {
    if (owner === null || r.work.count === 0)
        return 0;

    const fromX = unpX(from);
    const fromY = unpYS(from);
    const toX = unpX(to);
    const toY = unpYS(to);

    const minY = fromY <= toY ? fromY : toY;              // 0x59111x
    const maxY = fromY >= toY ? fromY : toY;
    const blockX = fromX - 5;
    const blockY = minY - 3;
    const blockW = toX - fromX + 9;
    const blockH = maxY - minY + 11;
    if (!rampRectClear(r, owner, blockX, blockY, blockW, blockH, targetId))   // 0x5911xx
        return 0;

    const dy = toY - fromY;                               // pMapCoord__1
    const ady = dy < 0 ? -dy : dy;                        // v78
    const dx = toX - fromX;                               // v13
    if (ady > dx - 5)                                     // 0x5914xx
        return 0;

    const target = findRegionById(r, targetId);           // sub_5943E0
    const targetLevel = target !== null ? target.level : 0;
    const ownerLevel = owner.level;
    const halfSlot = Math.trunc((dx + 1) / 2) + 3;        // X_12

    // 1. rows from.Y + 1 .. maxY + 9, columns blockX .. blockX + X_12 + 1
    for (let y = fromY + 1; y < maxY + 10; ++y) {
        for (let x = blockX; x < blockX + halfSlot + 2; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), targetId);       // sub_58D070
            r.cellAt(i16(x), i16(y)).level = targetLevel;
        }
    }

    // 2. rows to.Y + 1 .. maxY + 9, columns to.X - (dx + 1) / 2 .. to.X + 4
    for (let y = toY + 1; y < maxY + 10; ++y) {
        for (let x = toX - Math.trunc((dx + 1) / 2); x < toX + 5; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), targetId);
            r.cellAt(i16(x), i16(y)).level = targetLevel;
        }
    }

    // 3. rows blockY + 2 .. from.Y, columns blockX + 4 .. blockX + X_12 + 1
    for (let y = blockY + 2; y < fromY + 1; ++y) {
        for (let x = blockX + 4; x < blockX + halfSlot + 2; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), owner.id);
            r.cellAt(i16(x), i16(y)).level = ownerLevel;
        }
    }

    // 4. rows blockY + 2 .. to.Y, columns to.X - X_12 + 2 .. to.X
    for (let y = blockY + 2; y < toY + 1; ++y) {
        for (let x = toX - halfSlot + 2; x < toX + 1; ++x) {
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            setWorkMark(r, packXY(x, y), owner.id);
            r.cellAt(i16(x), i16(y)).level = ownerLevel;
        }
    }

    // 5. the two slope-set pieces (0x5914xx)
    placeWaterDetailTile(r, r.slopeSetPiecesIndex,
        packXY(i16(fromX), i16(fromY)), targetId, ownerLevel);
    placeWaterDetailTile(r, r.slopeSetPiecesIndex + 1,
        packXY(i16(toX - 2), i16(toY)),
        targetId, ownerLevel);

    // 6. the table-driven strip (0x5915xx) and 7. the tail strip (0x5916xx)
    let tailBiasLow = 0;                                  // LOWORD(X_10)
    let tailBiasHigh = 0;                                 // HIWORD(X_10)
    if (dy !== 0) {
        const side = dy > 0 ? 1 : 0;                      // X_11
        let draw: number;
        do {
            draw = drawZeroOrOne(r);                      // [RNG] 0/1
        } while (draw > 1);

        const stripBiasX = draw === 1 ? 0 : toX - ady - fromX - 5;   // v66
        const stripBiasY = dy >= 0 ? 0 : -1;              // v67
        if (draw === 1) {
            tailBiasLow = ady;
            tailBiasHigh = i16(dy);
        }

        const K_LEVEL_OFFSETS = [3, 2, 1, 0, 0];               // 0x82AF3C + 4i
        const K_SLOPE_OFFSETS = [                              // 0x82AF50 / 0x82AF64
            [11, 15, 15, 15, 7],
            [12, 16, 16, 16, 8],
        ];

        if (ady > 0) {
            let counter = 0;                              // pMapCoord_
            let mirror = 0;                               // Y, the column offset
            do {
                const column = side !== 0 ? counter : mirror;   // Y_1
                for (let i = 0; i < 5; ++i) {
                    const cx = i16(
                        counter + fromX + 3 + stripBiasX);
                    const cy = i16(
                        column + stripBiasY + i + fromY);
                    const cell = r.cellAt(i16(cx), i16(cy));
                    cell.level = ownerLevel + K_LEVEL_OFFSETS[i]! - 4;   // 0x5915xx
                    const slopeByte = K_SLOPE_OFFSETS[side]![i]!;
                    cell.slopeIndex = slopeByte;
                    cell.height = 0;
                    cell.isoTileTypeIndex = slopeByte + r.rampBaseIndex - 1;
                }
                ++counter;
                --mirror;
            } while (counter < ady);
        }
    }

    // 7. the tail strip (0x5916xx), 4 cells per row
    const tailRows = toX - fromX - ady - 5;
    for (let row = 0; row < tailRows; ++row) {
        for (let n = 0; n < 4; ++n) {
            const cx = i16(row + fromX + 3 + tailBiasLow);
            const cy = i16(n + fromY + tailBiasHigh);
            setWorkMark(r, packXY(cx, cy), targetId);     // 0x5916xx (the mark)
            const cell = r.cellAt(cx, cy);
            cell.slopeIndex = 4;
            cell.level = ownerLevel - n - 1;
            cell.isoTileTypeIndex = r.rampBaseIndex + 3;
            cell.height = 0;
        }
    }

    return 1;
}

// ---------------------------------------------------------------------------
// sub_5A7250 - "the rectangle carries nothing but pave / placeholder cells"
// (0x5a7250 - 0x5a73f2).
// ---------------------------------------------------------------------------
export function tileRectClear(r: Rmg, x: number, y: number, w: number, h: number,
                              allowPavedRoads: boolean,
                              allowPavedRoadEnds: boolean): boolean {
    if (r.work.count === 0)
        return false;

    if (!r.cellExists(i16(x), i16(y))
        || !r.cellExists(i16(x + w - 1), i16(y))
        || !r.cellExists(i16(x), i16(y + h - 1))
        || !r.cellExists(i16(x + w - 1), i16(y + h - 1)))
        return false;

    for (let row = y; row < y + h; ++row) {               // 0x5a725x
        for (let col = x; col < x + w; ++col) {
            const cell = r.cellAt(col, row);
            if (isPavedRoadTile(r, cell)) {               // 0x5a72xx sub_4866D0
                if (!allowPavedRoads)
                    return false;
            } else if (isPavedRoadEndTile(r, cell)) {     // 0x5a72xx sub_4866F0
                if (!allowPavedRoadEnds)
                    return false;
            } else if (!r.isPlaceholderTile(cell)         // sub_486380
                && !isMiscPaveTile(r, cell)               // sub_486650
                && !isPaveTile(r, cell)) {                // sub_486670
                return false;
            }
        }
    }
    return true;
}

// ---------------------------------------------------------------------------
// sub_5A7440 - the same test plus a uniform Level (0x5a7440 - 0x5a743f).
// ---------------------------------------------------------------------------
export function tileRectLevelClear(r: Rmg, x: number, y: number, w: number, h: number,
                                   allowRoads: boolean): boolean {
    if (r.work.count === 0)
        return false;

    if (!r.cellExists(i16(x), i16(y))
        || !r.cellExists(i16(x + w - 1), i16(y))
        || !r.cellExists(i16(x), i16(y + h - 1))
        || !r.cellExists(i16(x + w - 1), i16(y + h - 1)))
        return false;

    const level = r.cellAt(x, y).level;                   // 0x5a74xx
    for (let row = y; row < y + h; ++row) {               // 0x5a74xx
        for (let col = x; col < x + w; ++col) {
            const cell = r.cellAt(col, row);
            if (cell.level !== level)                     // 0x5a74xx
                return false;
            if (isPavedRoadTile(r, cell) || isPavedRoadEndTile(r, cell)) {
                if (!allowRoads)
                    return false;
            } else if (!r.isPlaceholderTile(cell)
                && !isMiscPaveTile(r, cell)
                && !isPaveTile(r, cell)) {
                return false;
            }
        }
    }
    return true;
}

// ---------------------------------------------------------------------------
// sub_5902C0 - "the rectangle is an untouched, uniformly levelled slot"
// (0x5902c0 - 0x5904af). The scan runs one cell wider/taller than the corner
// gate (col = x .. x + w, row = y .. y + h).
// ---------------------------------------------------------------------------
export function overlayRectClear(r: Rmg, x: number, y: number, w: number, h: number): boolean {
    if (r.work.count === 0)
        return false;

    const level = r.cellAt(x, y).level;                   // 0x5902f5
    if (!r.cellExists(i16(x), i16(y))
        || !r.cellExists(i16(x + w - 1), i16(y))
        || !r.cellExists(i16(x), i16(y + h - 1))
        || !r.cellExists(i16(x + w - 1), i16(y + h - 1)))
        return false;

    for (let row = y; row < y + h + 1; ++row) {           // 0x59041f
        for (let col = x; col < x + w + 1; ++col) {       // 0x590429
            const cell = r.cellAt(col, row);              // 0x59044c
            if (cell.overlayTypeIndex !== -1
                || cell.level !== level
                || (!r.isPlaceholderTile(cell)            // sub_486380
                    && !isWaterFamilyTile(r, cell)))      // sub_4865D0
                return false;
        }
    }
    return true;
}

// ---------------------------------------------------------------------------
// sub_5904B0 - the bridge repair hut placer (0x5904b0 - 0x5906cf).
// ---------------------------------------------------------------------------
export function placeBridgeRepairHut(r: Rmg, x: number, y: number, w: number, h: number): boolean {
    if (r.work.count === 0)
        return false;

    for (let row = y; row < y + h + 1; ++row) {           // 0x5904xx
        for (let col = x; col < x + w + 1; ++col) {
            const cell = r.cellAt(col, row);
            // vanilla: OverlayTypeIndex == -1 && placeholder tile && !FirstObject.
            // The port carries "occupied" in the cell's AltFlags instead.
            if (cell.overlayTypeIndex === -1 && r.isPlaceholderTile(cell)
                && (cell.altFlags & K_ALT_CELL_FLAGS_CONTAINS_BUILDING) === 0) {
                createNeutralBridgeRepairHut(r,
                    packXY(i16(col), i16(row)));          // 0x5905b2
                return true;                              // 0x5905bb
            }
        }
    }
    return false;
}

// ---------------------------------------------------------------------------
// The bridge repair hut of sub_5904B0 (0x590548 - 0x5905c6). Route B: the hut
// is recorded in the map's building list instead of instantiated.
// ---------------------------------------------------------------------------
export function createNeutralBridgeRepairHut(r: Rmg, coords: number): void {
    const cX = unpX(coords);
    const cY = unpYS(coords);
    if (!r.cellExists(cX, cY))
        return;

    r.structures.push({
        coords,
        typeName: 'CABHUT',
        houseName: 'Neutral House',
        facing: 0 /* North */,
    });

    // Unlimbo's side effect that the placer of sub_5904B0 depends on: the cell
    // now reads as occupied, so no second hut is dropped on it.
    r.cellAt(cX, cY).altFlags |= K_ALT_CELL_FLAGS_CONTAINS_BUILDING;
}

// ---------------------------------------------------------------------------
// The corridor cross-section gate of sub_58F2C0's four probe walks: the two
// cells that span the corridor must both lie in the usable area (checkLevel 1)
// and neither may carry a cliff-family tile (sub_4863D0).
// ---------------------------------------------------------------------------
export function corridorBandClear(r: Rmg, x: number, y: number, horizontal: boolean): boolean {
    const x2 = horizontal ? x + 2 : x;
    const y2 = horizontal ? y : y + 2;
    const c1 = packXY(i16(x), i16(y));
    const c2 = packXY(i16(x2), i16(y2));
    if (!isWithinUsableArea(r, c1, true) || !isWithinUsableArea(r, c2, true))
        return false;
    if (isCliffFamilyTile(r, r.cellAt(unpX(c1), unpYS(c1)))
        || isCliffFamilyTile(r, r.cellAt(unpX(c2), unpYS(c2))))
        return false;
    return true;
}

// ---------------------------------------------------------------------------
// sub_58F2C0 - the paved lateral-corridor builder (0x58f2c0 - 0x5902bf). Up to
// 200 attempts; the vanilla returns the success flag, the caller discards it.
// ---------------------------------------------------------------------------
export function linkSameLevelRegions(r: Rmg, water: MapRegion | null,
                                     regionA: MapRegion | null,
                                     regionB: MapRegion | null): void {
    if (water === null || regionA === null || regionB === null
        || r.work.count === 0)
        return;

    const idA = regionA.id;                               // 0x58f2d1 (v100)
    const idB = regionB.id;                               // 0x58f2c9 (v69)
    const side = r.size.workSide;                         // dword_89C2DC
    const workCount = side * side;                        // 0x58f31x (v7)
    const waterId = water.id;                             // this[2]

    for (let tries = 0; tries < 200; ++tries) {           // 0x58fa8x (v64)
        // 1. the random cell of the water region (0x58f31f - 0x58f3b6)
        let idx: number;
        for (;;) {
            do {
                idx = F2I64(                              // 0x58f347 [RNG]
                    r.rng.next()
                    * workCount
                    * 2.328306437080797e-10);             // dbl_7ED898
            } while (idx > workCount - 1);
            if (r.work.i(idx, 14) === waterId             // 0x58f389
                && r.work.i(idx, 0) !== 0)                // 0x58f3aa
                break;
        }

        const packed = r.work.i(idx, 0);                  // 0x58f3xx (v58)
        const cx = i16(unpX(packed));
        const cy = i16(unpYS(packed));

        let X_1 = cx - 1, Y_1 = cy;                       // the up corridor
        let X = X_1, Y = Y_1;                             // the down corridor
        let X_2 = cx, Y_2 = cy - 1;                       // the right corridor
        let X_3 = X_2, Y_3 = Y_2;                         // the left corridor

        let v49 = true;                                   // the vertical pair
        let v50 = true;                                   // the horizontal pair
        let v25 = v50;                                    // 0x58f8xx

        // 2a. the vertical pair: the up walk (0x58f450 / 0x58f4fb)
        if (!tileRectClear(r, X_1, Y_1, 3, 1, false, false)) {
            for (;;) {
                --Y_1;                                    // 0x58f476
                if (!corridorBandClear(r, X_1, Y_1, true))
                    break;
                if (tileRectClear(r, X_1, Y_1, 3, 1, false, false))
                    break;
            }
        }

        // 2b. the down walk (0x58f552 / 0x58f5fd) and the verdict
        if (tileRectClear(r, X_1, Y_1 - 3, 3, 3, false, false)) {      // 0x58f53a
            let reached = false;
            if (tileRectClear(r, X, Y, 3, 1, false, false)) {          // 0x58f552
                reached = true;
            } else {
                for (;;) {
                    ++Y;                                  // 0x58f5xx
                    if (!corridorBandClear(r, X, Y, true))
                        break;
                    if (tileRectClear(r, X, Y, 3, 1, false, false)) {
                        reached = true;
                        break;
                    }
                }
            }
            if (!reached || !tileRectClear(r, X, Y + 1, 3, 3, false, false))   // 0x58f640
                v49 = false;
        } else {
            v49 = false;                                  // 0x58f64e
        }

        // 2c. the horizontal pair: the left walk (0x58f701)
        if (!tileRectClear(r, X_3, Y_3, 1, 3, false, false)) {
            for (;;) {
                --X_3;
                if (!corridorBandClear(r, X_3, Y_3, false))
                    break;
                if (tileRectClear(r, X_3, Y_3, 1, 3, false, false))
                    break;
            }
        }

        // 2d. the right walk (0x58f803) and the verdict
        if (tileRectClear(r, X_3 - 3, Y_3, 3, 3, false, false)) {      // 0x58f740
            let reached = false;
            if (tileRectClear(r, X_2, Y_2, 1, 3, false, false)) {      // 0x58f803
                reached = true;
            } else {
                for (;;) {
                    ++X_2;
                    if (!corridorBandClear(r, X_2, Y_2, false))
                        break;
                    if (tileRectClear(r, X_2, Y_2, 1, 3, false, false)) {
                        reached = true;
                        break;
                    }
                }
            }
            if (!reached || !tileRectClear(r, X_2 + 1, Y_2, 3, 3, false, false))   // 0x58f846
                v50 = false;
        } else {
            v50 = false;                                  // 0x58f8xx
        }

        // 3. the marks at the corridor ends, the lengths and the choice
        let vLen = 999;                                   // 0x58f8xx (v58)
        let n999 = 999;
        let markV20 = -1, markV21 = -1, markH67 = -1, markH22 = -1;
        if (v49) {
            vLen = Y >= Y_1 ? Y - Y_1 : Y_1 - Y;          // abs32
            markV20 = r.work.i(X_1 + side * Y_1, 14);     // 0x58f9xx
            markV21 = r.work.i(X + side * Y, 14);
        }
        if (v50) {
            n999 = X_2 >= X_3 ? X_2 - X_3 : X_3 - X_2;
            markH67 = r.work.i(X_2 + side * Y_2, 14);
            markH22 = r.work.i(X_3 + side * Y_3, 14);
        }
        if (v49) {
            // the two ends must carry A's and B's marks, either way round
            if (!((markV20 === idA && markV21 === idB)
                || (markV20 === idB && markV21 === idA)))
                v49 = false;
        }
        if (v50) {
            if ((markH67 === idA && markH22 === idB)
                || (markH67 === idB && markH22 === idA)) {
                if (v49) {
                    if (vLen >= n999)
                        v49 = false;                      // the horizontal one wins
                    else {
                        v25 = false;                      // the vertical one wins
                        v50 = false;
                    }
                }
            } else {
                v25 = false;
                v50 = false;
            }
        }

        // 4. the corridor rectangle and the length budget (0x58f9xx)
        let X_4 = 0, Y_5 = 0, n3_8 = 0, n3_9 = 0;
        const budget = Math.trunc(tries / 25) + 8;        // n999_1
        if (v25 && n999 < budget) {
            X_4 = X_3;                                    // 0x58f9xx
            Y_5 = Y_3;
            n3_8 = X_2 - X_3 + 1;
            n3_9 = 3;
        } else {
            if (!v49 || vLen >= budget)                   // LABEL_128
                continue;
            X_4 = X_1;
            Y_5 = Y_1;
            n3_8 = 3;
            n3_9 = Y - Y_1 + 1;
        }
        if (n3_8 <= 0 || n3_9 <= 0)                       // LABEL_128
            continue;

        if (v50) {                                        // the horizontal corridor
            if (!overlayRectClear(r, X_4, Y_5, n3_8, n3_9))    // 0x58fa66
                continue;                                 // LABEL_128

            // the overlay strip: near edge 94, far edge 92, 74 + x % 4 between
            for (let row = Y_5; row < Y_5 + n3_9; ++row) {     // 0x58fa8x - 0x58fb5x
                for (let col = X_4; col < X_4 + n3_8; ++col) {
                    const cell = r.cellAt(col, row);
                    if (col === X_4)
                        cell.overlayTypeIndex = 94;       // 0x58fb95
                    else if (col === X_4 + n3_8 - 1)
                        cell.overlayTypeIndex = 92;       // 0x58fb99
                    else
                        cell.overlayTypeIndex = (col % 4) + 74;   // 0x58fb9d
                    cell.overlayData = row - Y_5;
                }
            }

            // the far end patch (0x58fbd2 - 0x58fc85)
            if (tileRectLevelClear(r, X_4 + n3_8, Y_5 - 2, 6, 6, false)) {
                let draw: number;
                do {
                    draw = drawZeroOrOne(r);              // 0x58fbe2 [RNG] 0/1
                } while (draw > 1);
                if (draw !== 0)
                    placeWaterDetailTile(r, r.pavedRoadsIndex + 10,   // 0x58fc85
                        packXY(i16(X_4 + n3_8), i16(Y_5)),
                        -1, -1);
                else
                    placeWaterDetailTile(r, r.pavedRoadEndsIndex,     // LABEL_90
                        packXY(i16(X_4 + n3_8), i16(Y_5)),
                        -1, -1);
            } else {
                placeWaterDetailTile(r, r.pavedRoadEndsIndex,
                    packXY(i16(X_4 + n3_8), i16(Y_5)),
                    -1, -1);
            }

            // the near end patch (0x58fcbd - 0x58fd57)
            if (tileRectLevelClear(r, X_4 - 6, Y_5 - 2, 6, 6, false)) {
                let draw: number;
                do {
                    draw = drawZeroOrOne(r);              // 0x58fccb [RNG] 0/1
                } while (draw > 1);
                if (draw !== 0)
                    placeWaterDetailTile(r, r.pavedRoadsIndex + 9,    // 0x58fd57
                        packXY(i16(X_4 - 4), i16(Y_5)),
                        -1, -1);
                else
                    placeWaterDetailTile(r, r.pavedRoadEndsIndex + 2, // LABEL_95
                        packXY(i16(X_4 - 1), i16(Y_5)),
                        -1, -1);
            } else {
                placeWaterDetailTile(r, r.pavedRoadEndsIndex + 2,
                    packXY(i16(X_4 - 1), i16(Y_5)),
                    -1, -1);
            }

            // the two bridge repair hut spots (0x58fd95 / 0x58fdd8 and 0x58fe14)
            if (!placeBridgeRepairHut(r, X_4, Y_5 - 1, 2, 5))
                placeBridgeRepairHut(r, X_4 - 1, Y_5 - 2, 3, 7);
            if (!placeBridgeRepairHut(r, n3_8 + X_4 - 2, Y_5 - 1, 2, 5))
                placeBridgeRepairHut(r, n3_8 + X_4 - 2, Y_5 - 2, 3, 7);

            return;                                       // LABEL_127 (v51 = 1)
        }

        if (v49) {                                        // the vertical corridor
            if (!overlayRectClear(r, X_4, Y_5, n3_8, n3_9))    // 0x58fe84
                continue;                                 // LABEL_128

            // the overlay strip: first row 96, last row 98, 83 + y % 4 between
            for (let row = Y_5; row < Y_5 + n3_9; ++row) {     // 0x58fecx - 0x5900xx
                for (let col = X_4; col < X_4 + n3_8; ++col) {
                    const cell = r.cellAt(col, row);
                    if (row === Y_5)
                        cell.overlayTypeIndex = 96;       // 0x5900xx
                    else if (row === Y_5 + n3_9 - 1)
                        cell.overlayTypeIndex = 98;
                    else
                        cell.overlayTypeIndex = (row % 4) + 83;
                    cell.overlayData = col - X_4;
                }
            }

            // the patch before the corridor (0x590003 - 0x5900b3)
            if (tileRectLevelClear(r, X_4 - 2, Y_5 - 6, 7, 6, false)) {
                let draw: number;
                do {
                    draw = drawZeroOrOne(r);              // 0x590013 [RNG] 0/1
                } while (draw > 1);
                if (draw !== 0)
                    placeWaterDetailTile(r, r.pavedRoadsIndex + 13,   // 0x5900b3
                        packXY(i16(X_4), i16(Y_5 - 4)),
                        -1, -1);
                else
                    placeWaterDetailTile(r, r.pavedRoadEndsIndex + 1, // LABEL_117
                        packXY(i16(X_4), i16(Y_5 - 1)),
                        -1, -1);
            } else {
                placeWaterDetailTile(r, r.pavedRoadEndsIndex + 1,
                    packXY(i16(X_4), i16(Y_5 - 1)),
                    -1, -1);
            }

            // the patch after the corridor (0x5900ee - 0x590191)
            if (tileRectLevelClear(r, X_4 - 2, Y_5 + n3_9, 7, 6, false)) {
                let draw: number;
                do {
                    draw = drawZeroOrOne(r);              // 0x5900fc [RNG] 0/1
                } while (draw > 1);
                if (draw !== 0)
                    placeWaterDetailTile(r, r.pavedRoadsIndex + 12,   // 0x590191
                        packXY(i16(X_4), i16(n3_9 + Y_5)),
                        -1, -1);
                else
                    placeWaterDetailTile(r, r.pavedRoadEndsIndex + 3, // LABEL_122
                        packXY(i16(X_4), i16(n3_9 + Y_5)),
                        -1, -1);
            } else {
                placeWaterDetailTile(r, r.pavedRoadEndsIndex + 3,
                    packXY(i16(X_4), i16(n3_9 + Y_5)),
                    -1, -1);
            }

            // the two bridge repair hut spots (0x5901cf / 0x59020e and 0x59024a / 0x590290)
            if (!placeBridgeRepairHut(r, X_4 - 1, Y_5, 5, 2))
                placeBridgeRepairHut(r, X_4 - 2, Y_5 - 1, 7, 3);
            if (!placeBridgeRepairHut(r, X_4 - 1, n3_9 + Y_5 - 2, 5, 2))
                placeBridgeRepairHut(r, X_4 - 2, n3_9 + Y_5 - 2, 7, 3);

            return;                                       // LABEL_127 (v51 = 1)
        }
    }
}

// ---------------------------------------------------------------------------
// The id -> record lookup the Making-regions helpers inline: a linear scan of
// the region array comparing +8 with the id. The vanilla walks one record past
// the array when the id is absent; the port answers null instead.
// ---------------------------------------------------------------------------
export function findRegionById(r: Rmg, id: number): MapRegion | null {
    for (let i = 0; i < r.regions.length; ++i) {
        const region = r.regions[i]!;
        if (region !== null && region.id === id)
            return region;
    }
    return null;
}

// ---------------------------------------------------------------------------
// MapClass::IsWithinUsableArea (0x578460 - 0x57852f).
// ---------------------------------------------------------------------------
export function isWithinUsableArea(r: Rmg, coordsPacked: number, checkLevel: boolean): boolean {
    return isWithinUsableRect(r, coordsPacked, checkLevel,
        K_VISIBLE_OFFSET_X, K_VISIBLE_OFFSET_Y,
        r.size.width, r.size.height);
}

// ---------------------------------------------------------------------------
// sub_578640 - the same test with the rectangle passed in: the only other
// caller in the generator is sub_594870, which inflates the rectangles by
// (4, 4, -8, -8).
// ---------------------------------------------------------------------------
export function isWithinUsableRect(r: Rmg, coordsPacked: number, checkLevel: boolean,
                                   visX: number, visY: number,
                                   visW: number, visH: number): boolean {
    if (r.cellSlots.length === 0)
        return false;

    const coordsX = unpX(coordsPacked);
    const coordsY = unpYS(coordsPacked);

    let level = 0;                                        // 0x578460
    if (checkLevel) {
        const cell = r.cellAt(coordsX, coordsY);
        level = cell.level;
        if (cell.slopeIndex !== 0                         // 0x5784a9
            && coordsY + coordsX
                < level + r.size.mapWidth + 2 * visY + 4)
            ++level;
    }

    const width = r.size.mapWidth;                        // 0x5784e0 MapRect.Width
    return coordsY + coordsX > level + width + 2 * visY
        && coordsY + coordsX
            <= level + width + 2 * (visY + visH) + 2
        && coordsX - coordsY < 2 * (visX + visW) - width
        && coordsY - coordsX < width - 2 * visX;
}

// ---------------------------------------------------------------------------
// sub_5A19E0 - cliff edge / corner Level fix-up.
//   131 = N|NE|E -> the EAST neighbour's Level -= 4
//    56 = S|SW|W -> the WEST neighbour's Level -= 4
//   224 = W|NW|N -> the cell ITSELF          += 4
// The 131 / 56 branches also need the SE neighbour's mask to match and a third
// cell to be a placeholder, and then win a 0/1 draw that must come out 0. The
// 224 branch has NO draw.
// ---------------------------------------------------------------------------
export function fixCliffLevels(r: Rmg): void {
    if (r.work.count === 0 || r.cellSlots.length === 0)
        return;

    // work[+56] of a cell - the 20 * X + 20 * W' * Y + 14 slot of the vanilla's
    // work array (dword_ABED10).
    const markOf = (c: MapCell): number => {
        const x = i16(unpX(c.mapCoords));
        const y = i16(unpYS(c.mapCoords));
        return r.work.i(r.workIndex(x, y), 14);
    };
    const setMark = (c: MapCell, value: number): void => {
        const x = i16(unpX(c.mapCoords));
        const y = i16(unpYS(c.mapCoords));
        r.work.setI(r.workIndex(x, y), 14, value);
    };

    const it = new CellIterator();                        // 0x5a19e9 sub_578350
    it.reset(r.cellSlots, r.size.mapWidth);
    for (let cell = it.next(); cell !== null; cell = it.next()) {   // 0x5a19f3
        const southWest = r.getNeighbourCell(cell, 5);    // 0x5a1a12
        const northEast = r.getNeighbourCell(cell, 1);    // 0x5a1a1f
        const southEast = r.getNeighbourCell(cell, 3);    // 0x5a1a2c
        const east = r.getNeighbourCell(cell, 2);         // 0x5a1a37
        const west = r.getNeighbourCell(cell, 6);         // 0x5a1a44

        const mask = cliffMask(r, cell);                  // 0x5a1a46 sub_579B70

        if (mask === 131) {
            if (cliffMask(r, southEast) !== 131 || !r.isPlaceholderTile(east))
                continue;                                 // 0x5a1a6e
            if (drawZeroOrOne(r) !== 0)                   // 0x5a1a85 - 0x5a1aa7
                continue;

            east.level -= 4;                              // 0x5a1ab6
            setMark(east, markOf(cell));                  // 0x5a1c45
        } else if (mask === 56) {
            if (cliffMask(r, southEast) !== 56 || !r.isPlaceholderTile(west))
                continue;                                 // 0x5a1b1f
            if (drawZeroOrOne(r) !== 0)                   // 0x5a1b36 - 0x5a1b58
                continue;

            west.level -= 4;                              // 0x5a1b67
            setMark(west, markOf(cell));                  // 0x5a1c45
        } else if (mask === 224) {
            if (cliffMask(r, southWest) !== 224 || cliffMask(r, northEast) !== 224
                || !r.isPlaceholderTile(cell))
                continue;                                 // 0x5a1bea

            cell.level += 4;                              // 0x5a1bfc
            setMark(cell, markOf(west));                  // 0x5a1c45
        }
    }
}

// ---------------------------------------------------------------------------
// sub_578E60 - cliff placement driver. The vanilla call is sub_578E60(0, -1);
// a1 = 0 is unused by the body and a2 = -1 is the mode, so both subordinate
// calls get mode = -1.
// ---------------------------------------------------------------------------
export function placeCliffs(r: Rmg): void {
    if (r.cellSlots.length === 0)
        return;

    // Port extension: fresh per-map footprint outcomes for RepairCliffPieces.
    r.cliffStamps.length = 0;

    const workCount = r.size.workSide * r.size.workSide;

    // ---- 1. Work array, on demand (0x578e6x) ------------------------------
    let allocatedHere = false;                            // vanilla v12
    if (r.work.count === 0) {
        r.work = new WorkArray(workCount);                // sub_58BDC0 per cell
        allocatedHere = true;
    }

    // ---- 2. Enable every work cell (0x578exx) -----------------------------
    for (let i = 0; i < workCount; ++i)
        r.work.setByte(i, 74, 1);                         // sub_58C2C0

    // ---- 3. Preview reset (sub_4A8BF0) ------------------------------------
    resetPreviewState(r);

    let pass = true;                                      // vanilla v2

    // ---- 4. Pass 1: fill the depressions (sub_579010) ---------------------
    {
        const it = new CellIterator();                    // sub_578350
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {
            if (!pass)
                break;
            pass = cliffPass(r, cell, -1);                // sub_579010
        }
    }

    // ---- 5. Pass 2: one cliff piece per placeholder cell (sub_579620) -----
    {
        const it = new CellIterator();
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {
            if (!pass)
                break;
            if (cell.slopeIndex === 0 && r.isPlaceholderTile(cell))
                pass = placeCliffPiece(r, cell, -1);      // sub_579620
        }
    }

    // ---- 6. Teardown (0x578f3x) -------------------------------------------
    // The vanilla also destroys MouseClass::CurrentBuilding here; the port
    // only clears the isotile selection cursor.
    r.currentBuildingType = 0;

    // ---- 7. Release the array if step 1 allocated it (0x578f4x) -----------
    if (allocatedHere) {
        r.work = new WorkArray(0);
    }
}

// ---------------------------------------------------------------------------
// sub_579620 - single cliff-piece placement (0x579620 - 0x579b68). Resolves
// which cliff tile the cell's neighbourhood calls for - the slot `slot`, 1..40,
// inside the CliffSet family - and stamps it through sub_57B440 (PlaceIsoTile).
// ---------------------------------------------------------------------------
export function placeCliffPiece(r: Rmg, cell: MapCell, genCode: number): boolean {
    const roll = r.rng.randomFloatRange(0, 5);            // 0x579630 sub_598030
    const mask = cliffMask(r, cell);                      // 0x579645 sub_579B70

    let slot = 0;                                         // vanilla n34
    let atPlace = false;

    if ((mask & 0xa0) === 0xa0) {                         // 0x579652
        const southMask = cliffMask(r, r.getNeighbourCell(cell, 4));   // (x, y+1)
        const eastMask = cliffMask(r, r.getNeighbourCell(cell, 2));    // (x+1, y)
        // 0x5796f9 test bl,20h ; 0x579702 test al,80h - the second probe is
        // the east neighbour's N bit, NOT a signed-byte test.
        if ((southMask & 0x20) !== 0 || (eastMask & 0x80) !== 0)
            slot = 34;
        else
            slot = (roll % 3) + 9;
        if (slot <= 0)                                    // LABEL_81
            return true;
        atPlace = true;                                   // goto place
    } else if ((mask & 0x82) === 0x82) { slot = 39; atPlace = true; }   // N | E
    else if ((mask & 0x0a) === 0x0a) { slot = 33; atPlace = true; }     // SE | S
    else if ((mask & 0x28) === 0x28) { slot = 40; atPlace = true; }     // S | W
    else if ((mask & 2) === 0) {                          // E bit clear
        let atTail = false;
        if ((mask & 0x20) !== 0) {                        // W set
            const southMask = cliffMask(r, r.getNeighbourCell(cell, 4));
            if ((mask & 0x10) === 0 || (mask & 0xc) !== 0
                || (southMask & 0x28) === 0x28) {
                slot = 18;
                atPlace = true;
            } else {
                slot = (roll % 3) + 15;
            }
        } else if ((mask & 8) !== 0) {                    // S set
            const eastMask = cliffMask(r, r.getNeighbourCell(cell, 2));
            const seMask = cliffMask(r, r.getNeighbourCell(cell, 3));
            if ((mask & 4) === 0 || (mask & 3) !== 0 || (eastMask & 0xa) === 0xa) {
                if ((mask & 6) !== 0 || (seMask & 8) !== 0 || (roll & 1) === 0)
                    slot = 26;
                else
                    slot = 21;
                atPlace = true;
            } else {
                slot = (roll % 3) + 23;
            }
        } else if ((mask & 0x80) !== 0) {                 // N set
            const eastMask = cliffMask(r, r.getNeighbourCell(cell, 2));
            if ((mask & 1) === 0 || (mask & 6) !== 0 || (eastMask & 0x82) === 0x82) {
                slot = 8;
                atPlace = true;
            } else {
                slot = (roll % 3) + 5;
            }
        } else {
            atTail = true;                                // goto tail (LABEL_73)
        }

        if (!atPlace && !atTail) {
            if (slot <= 0)                                // LABEL_44 -> LABEL_81
                return true;
            atPlace = true;
        }

        if (atTail) {
            // LABEL_73 - the shared tail for a cell with neither E, W, S nor N set.
            if ((mask & 1) !== 0) { slot = 2; }           // NE
            else if ((mask & 4) !== 0) {
                slot = (roll & 1) + 29;                   // SE
            } else {
                if ((mask & 0x10) !== 0) { slot = 22; }   // SW
                else {
                    if ((mask & 0x40) === 0)              // no NW either
                        return true;
                    slot = (roll % 3) + 12;
                }
            }
            if (slot <= 0)                                // LABEL_81
                return true;
            atPlace = true;
        }
    } else {
        // ---- E bit set ------------------------------------------------------
        const southMask = cliffMask(r, r.getNeighbourCell(cell, 4));
        const seMask = cliffMask(r, r.getNeighbourCell(cell, 3));
        if ((mask & 4) !== 0 && (mask & 0x18) === 0 && (southMask & 0xa) !== 0xa) {
            slot = (roll % 3) + 35;
            if (slot <= 0)                                // LABEL_44 -> LABEL_81
                return true;
        } else if ((mask & 0xc) !== 0 || (seMask & 2) !== 0 || (roll & 1) === 0) {
            slot = 38;
        } else {
            slot = 1;
        }
        atPlace = true;
    }

    // place:
    // 多格"纯墙条"只剩一格能落时，撞坡修剪会把幸存格换成内角片 C34，朝向
    // 不对、和两侧崖线接不上。这里在落片前直接改选与墙面同向的单格墙头片。
    {
        const sx = i16(unpX(cell.mapCoords));
        const sy = i16(unpYS(cell.mapCoords));
        if (slot >= 35 && slot <= 37) {
            const southY = i16(sy + 1);
            if (r.cellExists(sx, southY) && !r.isPlaceholderTile(r.cellAt(sx, southY)))
                slot = 38;
        } else if (slot >= 23 && slot <= 25) {
            const eastX = i16(sx + 1);
            if (r.cellExists(eastX, sy) && !r.isPlaceholderTile(r.cellAt(eastX, sy)))
                slot = 26;
        }
    }
    // Port guard: refuse a piece whose wall would ride down a ramp body. The
    // surviving footprint cells are still stamped as smaller CliffSet pieces
    // (C8 / C34 / C12-14), so a ramp-top seam keeps its facade instead of
    // being flattened to t0.
    if (cliffPieceHitsRamp(r, cell, slot)) {
        const trimmed = trimCliffPieceForRamp(r, cell, slot);
        if (trimmed > 0)
            return true;
        // Every wall cell of this piece rides a ramp or is already taken by
        // ramp art. Place nothing.
        const cx = i16(unpX(cell.mapCoords));
        const cy = i16(unpYS(cell.mapCoords));
        diag(`CLIFF-TRIM-SKIP slot=${slot} anchor=(${cx},${cy}) L${cell.level}`);
        return true;
    }
    r.currentBuildingType = r.shoreTileIndex + slot - 1;  // CliffSet + slot - 1
    setFoundationCenter(r, packXY(i16(unpX(cell.mapCoords)), i16(unpYS(cell.mapCoords))));
    {
        const placed: Box<boolean> = { v: true };         // LOBYTE(flag) = 1
        return placeIsoTile(r, 0, 0, cell.level, genCode, placed, 0) || placed.v;
    }
}

// ---------------------------------------------------------------------------
// sub_5A1350 - the corrected CliffSet tile for one cliff tile (0x5a1350 -
// 0x5a1775). Exactly one draw on slots 4-6, 8-10, 11-13, 14-16, 22-24 and
// 34-36, none on 28, 29 or the default branch.
// ---------------------------------------------------------------------------
export function resolveCliffVariant(r: Rmg, tile: number): number {
    const slot = tile - r.shoreTileIndex;                 // vanilla IsoTileTypeIndex_0

    // F2I64(Random() * 2^-31 + 1.0) - the {1, 2} draw the slots that add 1.0
    // use (truncated only after the +1.0).
    const drawOneOrTwo = (): number =>
        F2I64(r.rng.next() * 4.656612874161595e-10 + 1.0);

    switch (slot) {
        case 4: return r.shoreTileIndex + drawOneOrTwo() + 4;        // +5 / +6
        case 5: return r.shoreTileIndex + 2 * drawZeroOrOne(r) + 4;  // +4 / +6
        case 6: return r.shoreTileIndex + drawZeroOrOne(r) + 4;      // +4 / +5
        case 8: return r.shoreTileIndex + drawOneOrTwo() + 8;        // +9 / +10
        case 9: return r.shoreTileIndex + 2 * drawZeroOrOne(r) + 8;  // +8 / +10
        case 10: return r.shoreTileIndex + drawZeroOrOne(r) + 8;     // +8 / +9
        case 11: return r.shoreTileIndex + drawOneOrTwo() + 11;      // +12 / +13
        case 12: return r.shoreTileIndex + 2 * drawZeroOrOne(r) + 11;// +11 / +13
        case 13: return r.shoreTileIndex + drawZeroOrOne(r) + 11;    // +11 / +12
        case 14: return r.shoreTileIndex + drawOneOrTwo() + 14;      // +15 / +16
        case 15: return r.shoreTileIndex + 2 * drawZeroOrOne(r) + 14;// +14 / +16
        case 16: return r.shoreTileIndex + drawZeroOrOne(r) + 14;    // +14 / +15
        case 22: return r.shoreTileIndex + drawOneOrTwo() + 22;      // +23 / +24
        case 23: return r.shoreTileIndex + 2 * drawZeroOrOne(r) + 22;// +22 / +24
        case 24: return r.shoreTileIndex + drawZeroOrOne(r) + 22;    // +22 / +23
        case 28: return r.shoreTileIndex + 29;                       // plain swap
        case 29: return r.shoreTileIndex + 28;                       // plain swap
        case 34: return r.shoreTileIndex + r.rng.randomFloatRange(1, 2) + 34;     // +35 / +36
        case 35: return r.shoreTileIndex + 2 * r.rng.randomFloatRange(0, 1) + 34; // +34 / +36
        case 36: return r.shoreTileIndex + r.rng.randomFloatRange(0, 1) + 34;     // +34 / +35
        default: return tile;                                        // unchanged
    }
}

// ---------------------------------------------------------------------------
// sub_5A17F0 - cliff correction pass (0x5a17f0 - 0x5a19d3). The S and E
// neighbours are corrected independently and in that order.
// ---------------------------------------------------------------------------
export function correctCliffTiles(r: Rmg): void {
    if (r.cellSlots.length === 0)
        return;

    // One replacement: `neighbour` carries the same cliff tile but sits lower.
    const stamp = (_trigger: MapCell, _dir: number,
                   neighbour: MapCell, tile: number): void => {
        const newTile = resolveCliffVariant(r, tile);     // sub_5A1350
        if (newTile === tile)
            return;

        const cellsInX = cliffCellsInX(r, tile);          // Array.Items[tile]->CellsInX
        const baseX = i16(unpX(neighbour.mapCoords));
        const baseY = i16(unpYS(neighbour.mapCoords));
        const cellX = baseX - (neighbour.height % cellsInX);
        const cellY = baseY - Math.trunc(neighbour.height / cellsInX);

        const packed = ((cellX & 0xffff) | (cellY << 16)) | 0;
        let mark = -1;                                    // vanilla: dword_ABED10 ? ... : -1
        if (r.work.count !== 0) {
            // The vanilla indexes the work array raw here; the range is
            // checked rather than trusted.
            const index = cellX + r.size.workSide * cellY;
            if (index >= 0 && index < r.size.workSide * r.size.workSide)
                mark = r.work.i(index, 14);
        }

        placeWaterDetailTile(r, newTile, packed, mark, -1);   // sub_5A6C10
    };

    const it = new CellIterator();                        // sub_578350
    it.reset(r.cellSlots, r.size.mapWidth);
    for (let cell = it.next(); cell !== null; cell = it.next()) {
        const tile = cell.isoTileTypeIndex;
        if (tile < r.shoreTileIndex || tile >= r.shoreTileIndex + 40)
            continue;                                     // not a CliffSet tile

        const south = r.getNeighbourCell(cell, 4);        // (x, y+1)
        const east = r.getNeighbourCell(cell, 2);         // (x+1, y)

        if (tile === south.isoTileTypeIndex && cell.height > south.height)
            stamp(cell, 4, south, tile);
        if (tile === east.isoTileTypeIndex && cell.height > east.height)
            stamp(cell, 2, east, tile);
    }
}

// ---------------------------------------------------------------------------
// sub_59B740 - fill the leftover placeholders around green ground
// (0x59b740 - 0x59b938). The Making-regions tail: MakeRegions calls it for
// every land type (0x598e1a), after the five cliff steps. Exactly one RNG
// draw per filled cell.
// ---------------------------------------------------------------------------
export function fillGreenPlaceholders(r: Rmg): void {
    if (r.cellSlots.length === 0)
        return;

    // The vanilla's DynamicVectorClass<CellClass*> (sub_5AD820); no
    // de-duplication - a placeholder reachable from several green cells lands
    // in the list more than once.
    const pending: MapCell[] = [];

    // ---- 1. Seed the list from the green-ground cells ---------------------
    {
        const it = new CellIterator();                    // 0x59b7xx sub_578350
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {
            if (!isGreenGroundTile(r, cell))              // sub_4867B0
                continue;
            for (let facing = 0; facing < 8; facing += 2) {   // N, E, S, W
                const nb = r.getNeighbourCell(cell, facing);
                if (r.isPlaceholderTile(nb))              // sub_486380
                    pending.push(nb);
            }
        }
    }

    // ---- 2. How many to fill (0x59b8xx) -----------------------------------
    let target = Math.trunc(pending.length / 3);          // 0x59b8xx
    if (target > 1000)
        target = 1000;                                    // 0x59b8xx

    // ---- 3. Fill, spreading outwards (0x59b8xx) ---------------------------
    for (let n = 0; n < target; ++n) {
        const count = pending.length;

        let index: number;
        do {
            index = F2I64(r.rng.next()
                * count * K_UNIT_SCALE);                  // 0x59b8xx
        } while (index > count - 1);

        const cell = pending[index]!;
        pending.splice(index, 1);                         // order-preserving

        cell.isoTileTypeIndex = r.greenTileIndex;         // IsoTileTypeIndex_1 @0xAA0E18

        for (let facing = 0; facing < 8; facing += 2) {
            const nb = r.getNeighbourCell(cell, facing);
            if (r.isPlaceholderTile(nb))
                pending.push(nb);
        }
    }
}

// ---------------------------------------------------------------------------
// IsMorphableTile (MapGenHills.cpp) - TileSetFlags morphable test.
// ---------------------------------------------------------------------------
export function isMorphableTile(r: Rmg, tile: number): boolean {
    const index = tile >>> 0;
    if (index >= r.tileMorphable.length)
        return true;
    return r.tileMorphable[index] !== 0;
}

// ---------------------------------------------------------------------------
// CanHostSlope - sub_6B2520 (0x6B2520 - 0x6B2563). int16 x / y parameters.
// ---------------------------------------------------------------------------
export function canHostSlope(r: Rmg, x: number, y: number): boolean {
    if (!r.cellExists(x, y))
        return false;

    const cell = r.cellAt(x, y);
    if (cell.overlayTypeIndex !== -1)                     // sub_6B2520's this[17] (+0x44)
        return false;
    if ((cell.altFlags & K_ALT_CELL_FLAGS_CONTAINS_BUILDING) !== 0)
        return false;                                     // this[57] (+0xE4) FirstObject
    if (r.work.byte(r.workIndex(x, y), 69) !== 0)
        return false;

    return isMorphableTile(r, cell.isoTileTypeIndex);
}
