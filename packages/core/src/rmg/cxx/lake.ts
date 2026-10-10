/**
 * Transliteration of G:/MapGenerator MapGenLake.cpp.
 *
 *   GenerateLake            sub_59C920   standalone lake generation
 *   ClearPreviousGeneration sub_5A0410   ring-spread relabel
 *
 * plus the module-local LakeNode / LakeHeap (1-based min-heap over node
 * pointers, sift-down sub_5AD870) the C++ file defines in its anonymous
 * namespace.
 *
 * Two call sites share GenerateLake: the river exit phase (0x59e22c, seeded
 * with the river-mouth cell on natural termination) and the top-level lake
 * stage of GenerateSpecialTerrain (mapGen.ts, random start points, up to 10
 * tries). River-side subordinates (BuildWaterRing / SmoothWaterBody /
 * ExpandWaterBody) are runtime-imported from './river'.
 */

import type { Box } from './types';
import { CellIterator, i16, packXY, unpX, unpYS } from './types';
import type { Rmg } from './mapGen';
import { F2I64, K_UNIT_SCALE, yrSqrt } from './mathTables';
import { diag } from './diag';
import { buildWaterRing, expandWaterBody, smoothWaterBody } from './river';

// ---------------------------------------------------------------------------
// Direction offsets, Neighbours table order (0x89F688) - the same order as
// CellClass::GetNeighbourCell. GenerateLake walks only the four orthogonal
// steps 0 / 2 / 4 / 6 (0x59cef4: the direction index steps by 2).
// ---------------------------------------------------------------------------
const kLakeDirX = [0, 1, 1, 1, 0, -1, -1, -1];
const kLakeDirY = [-1, -1, 0, 1, 1, 1, 0, -1];

// (double)0.02f - the float32 literal promoted to double (priority cost term).
const K_002F = Math.fround(0.02);

// ---------------------------------------------------------------------------
// Priority-queue node (vanilla Block, allocated at 0x59c98e): the packed cell
// coordinates plus the float priority (0x59cfd0 / 0x59d053). Nodes are
// allocated in order and never recycled; the heap stores references into the
// node vector, which is therefore reserved once up front (cap entries) and
// never allowed to outgrow that reservation.
// ---------------------------------------------------------------------------
interface LakeNode {
    coords: number; // packed CellStruct (low16 X, high16 Y)
    priority: number; // float store (Math.fround)
}

// 1-based min-heap over LakeNode references (vanilla heap object, 0x14 bytes:
// { count, capacity, slots, maxSeen, minSeen }; the two "seen" pointers are
// dead stores in the vanilla code and are dropped here).
class LakeHeap {
    slots: (LakeNode | null)[] = []; // slots[0] unused; slots[1..count] live
    count = 0;

    // Sift-down (sub_5AD870): restore the heap order at `a2` after the root
    // was overwritten by the last slot. The children of node i are 2i / 2i+1;
    // the smaller-priority child bubbles up until both children are larger
    // (or absent). Index 0 is unused, so 1-based slots line up directly.
    siftDown(a2: number): void {
        let v2 = a2;
        let v3 = 2 * a2;
        const v4 = 2 * a2 + 1;
        // No left child, or the parent already wins -> stay at a2.
        if (!(2 * a2 <= this.count) ||
            this.slots[a2]!.priority <= this.slots[2 * a2]!.priority)
            v3 = a2;
        // The right child is smaller still -> pick it.
        if (v4 <= this.count && this.slots[v3]!.priority > this.slots[v4]!.priority)
            v3 = 2 * a2 + 1;
        if (v3 === a2)
            return;
        do {
            const v6 = 2 * v3 + 1;
            const v7 = this.slots[v2]!;
            this.slots[v2] = this.slots[v3];
            v2 = v3;
            this.slots[v3] = v7;
            if (2 * v3 <= this.count &&
                this.slots[v3]!.priority > this.slots[2 * v3]!.priority)
                v3 *= 2;
            if (v6 <= this.count && this.slots[v3]!.priority > this.slots[v6]!.priority)
                v3 = v6;
        } while (v3 !== v2);
    }

    // Sift-up insert (vanilla inline: seed push 0x59cdf0, neighbour push
    // 0x59d082). Silently dropped once count + 1 would reach the capacity.
    // Vanilla bookkeeping: count is set to the final insertion slot v (the
    // "++*v11" store), not to count + 1 - transliterated as-is.
    push(node: LakeNode): void {
        let v = this.count + 1;
        let parent = v >> 1;
        if (v >= this.slots.length)
            return;
        while (v > 1 && this.slots[parent]!.priority > node.priority) {
            this.slots[v] = this.slots[parent];
            v = parent;
            parent >>= 1;
        }
        this.slots[v] = node;
        this.count = v;
    }

    // Pop the minimum-priority node (vanilla inline: swap root with the last
    // slot, shrink, then sub_5AD870).
    pop(): LakeNode | null {
        if (this.count === 0)
            return null;
        const root = this.slots[1]!;
        this.slots[1] = this.slots[this.count]!;
        this.slots[this.count] = null;
        --this.count;
        this.siftDown(1);
        return root;
    }
}

// ---------------------------------------------------------------------------
// ClearPreviousGeneration - sub_5A0410 - ring-spread relabel.
//
// Called once by the lake auto-seed pass as clearPreviousGeneration(r, 0, 2, -2)
// (0x59ca9a). Takes ring 0 of the body carrying `genCode` (BuildWaterRing,
// sub_5A0700) and then walks `rings` successive rings:
//   (1) every cell of the current ring has its generation mark stamped with
//       `mark` (data[14]) and its tile reset to bare land at baseLevel;
//   (2) the next ring is the set of in-diamond 8-neighbours of the current
//       ring that still carry the generation mark and were not claimed by this
//       round - their visited dword (data[15]) holds the round number r + 1.
// The visited dword is cleared over the whole diamond before and after the
// walk when more than one ring is requested.
//
// Vanilla returns 1; the call site ignores the value, so this stays void.
// ---------------------------------------------------------------------------
export function clearPreviousGeneration(r: Rmg, genCode: number, rings: number,
                                        mark: number): void {
    let ring: number[] = buildWaterRing(r, genCode); // 0x5a0422 (packed coords)

    const clearVisited = rings > 1; // 0x5a042d
    if (clearVisited) {
        const it = new CellIterator(); // 0x5a043b
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {
            const x = cell.mapCoords & 0xffff;
            const y = cell.mapCoords >>> 16;
            r.work.setI(r.workIndex(x, y), 15, 0); // byte 60
        }
    }

    for (let round = 0; round < rings; ++round) {
        // (1) Stamp the current ring (vanilla walks it back to front).
        for (let j = ring.length - 1; j >= 0; --j) { // 0x5a0499
            const c = ring[j]!;
            const cx = unpX(c);
            const cy = unpYS(c);
            r.work.setI(r.workIndex(cx, cy), 14, mark); // 0x5a04ca
            const cell = r.cellAt(cx, cy);
            cell.isoTileTypeIndex = 0; // 0x5a04dd
            cell.height = 0; // 0x5a04e0
            cell.level = r.baseLevel; // 0x5a04ee
        }

        // (2) Grow the next ring, for every round but the last.
        if (round < rings - 1) { // 0x5a0501
            const next: number[] = [];
            for (let j = ring.length - 1; j >= 0; --j) { // 0x5a0540
                const c = ring[j]!;
                const cx = unpX(c);
                const cy = unpYS(c);
                for (let dir = 0; dir < 8; ++dir) { // 0x5a055c
                    const nx = i16(cx + kLakeDirX[dir]!);
                    const ny = i16(cy + kLakeDirY[dir]!);

                    if (!r.cellExists(nx, ny)) // 0x5a05b9
                        continue;

                    const wi = r.workIndex(nx, ny);
                    if (r.work.i(wi, 14) !== genCode) // 0x5a05d6
                        continue;
                    if (r.work.i(wi, 15) === round + 1) // 0x5a05e7 - claimed already
                        continue;

                    next.push(packXY(nx, ny)); // 0x5a0625
                    r.work.setI(wi, 15, (round + 1) & 0xff); // 0x5a0628 (unsigned char store)
                }
            }
            ring = next;
        }
    }

    if (clearVisited) { // 0x5a0696
        const it = new CellIterator();
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {
            const x = cell.mapCoords & 0xffff;
            const y = cell.mapCoords >>> 16;
            r.work.setI(r.workIndex(x, y), 15, 0); // byte 60
        }
    }
}

// ---------------------------------------------------------------------------
// GenerateLake - sub_59C920 - one standalone lake attempt.
//
// Phases (doc §6.1 - §6.7), with the vanilla addresses they mirror:
//   1  budget gate         0x59c92e - 0x59c970
//   2  node block + heap   0x59c976 - 0x59ca07
//   3  qualification       0x59ca10 - 0x59cc83   (+ auto-mode seed sampling)
//   4  area sampling       0x59cca7 - 0x59cd76
//   5  seed push + growth  0x59cd95 - 0x59d147
//   6  heap drain + gates  0x59d14d - 0x59d259
//   7  finish / rollback   0x59d25e - 0x59d418
//
//   startXY     packed seed cell (low16 X, high16 Y); (0,0) = automatic mode
//               (the routine samples and qualifies its own start point)
// Returns true on success (the grown cell count is added to the water-cell
// budget); a failure rolls the stamped cells back to plain land.
// ---------------------------------------------------------------------------
export function generateLake(r: Rmg, startXY: Box<number>): boolean {
    const genCode = r.genCode;
    const autoMode = startXY.v === 0;

    // ---- 1. Budget gate (0x59c92e - 0x59c970) ----------------------------
    // budget = F2I64(H * W * waterAmount * 0.008 + 100). With waterAmount 0 the
    // integer product stays 0 and the gate always fails (no water -> no lake).
    // remaining = budget - usedWaterCells; 75 or less gives up.
    let budget = r.waterAmount;
    if (r.waterAmount !== 0)
        budget = F2I64((r.size.height * r.size.width * r.waterAmount) * 0.008 + 100.0);
    const remaining = budget - r.usedWaterCells;
    if (remaining <= 75) // 0x59c970
        return false;

    let ok = true; // v75

    // [TEMP DIAG] lake attempt that passed the budget gate.
    diag(`LAKE g=${genCode} auto=${autoMode ? 1 : 0} remaining=${remaining}`);

    // ---- 2. Node block + min-heap (0x59c976 - 0x59ca07) ------------------
    let cap = 2 * remaining + 2; // 0x59c976
    if (cap <= 100)
        cap = 100; // 0x59c981

    const nodes: LakeNode[] = []; // vanilla reserves `cap` up front, never outgrows it
    const heap = new LakeHeap();
    heap.slots = new Array<LakeNode | null>(cap + 1).fill(null);

    // ---- 3a. Clear the enqueue mark over the diamond (0x59ca21) ----------
    // Iterator order; byte 60 = WorkCell data[15].
    {
        const it = new CellIterator();
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {
            const x = cell.mapCoords & 0xffff;
            const y = cell.mapCoords >>> 16;
            r.work.setI(r.workIndex(x, y), 15, 0);
        }
    }

    // ---- 3b. Qualification (0x59ca7b - 0x59cadc) -------------------------
    // Linear sweep of the whole work square (side * side cells). data[17]
    // (byte 68) is the "may host lake water" flag.
    const side = r.size.workSide;
    const workCount = side * side; // 0x59ca61

    if (!autoMode) {
        // Specified seed (river mouth): every cell may host the lake.
        for (let i = 0; i < workCount; ++i) // 0x59cc89
            r.work.setI(i, 17, 1);
    } else {
        for (let i = 0; i < workCount; ++i) // 0x59ca7b
            r.work.setI(i, 17, 0);

        clearPreviousGeneration(r, 0, 2, -2); // 0x59ca9a sub_5A0410

        for (let i = 0; i < workCount; ++i) { // 0x59caaa
            const mark = r.work.i(i, 14); // byte 56
            if (mark === 0 || mark === genCode)
                r.work.setI(i, 17, 1); // free, or ours
            else if (mark === -2)
                r.work.setI(i, 14, 0); // drop stale marker
        }
    }

    // ---- 3c. Auto-mode seed sampling (0x59caf1 - 0x59cc83) ---------------
    // x = rand % W', y = rand % H' (rejection sampling), remapped onto the
    // diamond as (x + y + 1, W' - x + y). Accept only a free, placeholder,
    // qualified cell; 200 tries and the attempt fails.
    let seedPacked: number; // pMapCoord_
    if (autoMode) {
        const Wp = r.size.mapWidth; // W'
        const Hp = r.size.mapHeight; // H'
        let tries = 0; // n200
        for (;;) {
            let x: number;
            do { // 0x59cb09
                x = F2I64(r.rng.next() * Wp * K_UNIT_SCALE);
            } while (x > Wp - 1);

            let y: number;
            do { // 0x59cb4a
                y = F2I64(r.rng.next() * Hp * K_UNIT_SCALE);
            } while (y > Hp - 1);

            const sx = i16(x + y + 1); // 0x59cbc9
            const sy = i16(Wp - x + y); // 0x59cbcb
            seedPacked = (sx & 0xffff) | ((sy & 0xffff) << 16);

            if (++tries >= 200) // 0x59cbee
                return false;

            if (r.work.i(r.workIndex(sx, sy), 14) !== 0) // 0x59cc17
                continue;
            if (!r.isPlaceholderTile(r.cellAt(sx, sy))) // 0x59cc34
                continue;
            if (r.work.i(r.workIndex(sx, sy), 17) !== 0) // 0x59cc60 -> LABEL_50
                break;
        }
    } else {
        seedPacked = startXY.v; // 0x59cca3
    }

    // [TEMP DIAG] resolved lake seed cell.
    diag(`LAKE-SEED g=${genCode} (${seedPacked & 0xffff},${seedPacked >>> 16})`);

    // ---- 4. Area sampling (0x59cca7 - 0x59cd76) --------------------------
    // lower = max(76, remaining); sigma = remaining / 6 (integer division),
    // mu = remaining / 3. If the mu +/- sigma window leaves [75, lower],
    // recentre sigma on the 75 floor. Gaussian rejection keeps the drawn area
    // inside [75, lower]; target = F2I64(area).
    let lower = remaining; // n76_1
    if (lower < 76) // 0x59ccbc
        lower = 76;
    let sigma = Math.trunc(remaining / 6); // 0x59cce7 (v88) - int division, then double
    let mu = Math.trunc(remaining / 3); // 0x59ccfa (v87)
    if (mu - sigma > lower || mu + sigma < 75.0) { // 0x59cd20
        sigma = (lower - 75.0) * 0.5; // 0x59cd32
        mu = sigma + 75.0; // 0x59cd3c
    }
    let area: number;
    do { // 0x59cd70
        do { // 0x59cd61
            area = r.rng.gaussian() * sigma + mu; // sub_5980C0
        } while (area < 75.0);
    } while (area > lower);
    const target = F2I64(area); // n76 (0x59cd76)

    // ---- 5. Seed push + growth (0x59cd95 - 0x59d147) ---------------------
    // Reset the heap, plant the seed as node 0, push it and pop it straight
    // back (0x59cd9f - 0x59ce64): the seed becomes the first current cell.
    heap.count = 0;
    let expanded = 0; // n76_4
    let seedX = seedPacked & 0xffff; // sign-agnostic low16
    let seedY = seedPacked >>> 16;
    if (seedX >= 0x8000) seedX -= 0x10000;
    if (seedY >= 0x8000) seedY -= 0x10000;

    // vanilla Block[0] - the seed node.
    const seedNode: LakeNode = { coords: packXY(seedX, seedY), priority: 0.0 }; // 0x59cda9
    nodes.push(seedNode);
    r.work.setI(r.workIndex(seedX, seedY), 15, genCode); // 0x59cdd4 (occupies)

    heap.push(seedNode); // 0x59cddd - 0x59ce18
    let current: LakeNode | null = heap.pop(); // 0x59ce32 - 0x59ce64

    if (target > 0) { // 0x59ce6a
        while (current !== null && ok) { // 0x59ce84
            const cx = unpX(current.coords);
            const cy = unpYS(current.coords);

            // (1) Stamp the current cell as water of this generation.
            r.work.setI(r.workIndex(cx, cy), 14, genCode); // 0x59ceba
            const cell = r.cellAt(cx, cy);
            cell.isoTileTypeIndex = r.waterTileIndex; // 0x59ced3 (nIdx)
            cell.height = 0; // 0x59ced6

            // (2) Look at the four orthogonal neighbours.
            for (let step = 0; step < 8; step += 2) { // 0x59cef4 - 0x59d0f8
                const dir = step & 7;
                const nx = i16(cx + kLakeDirX[dir]!);
                const ny = i16(cy + kLakeDirY[dir]!);

                if (!r.cellExists(nx, ny)) // 0x59cf60 (diamond)
                    continue;

                const wi = r.workIndex(nx, ny);
                const nCell = r.cellAt(nx, ny);

                if (r.work.i(wi, 14) !== 0 || // taken tile
                    r.work.i(wi, 15) === genCode || // already enqueued
                    !r.isPlaceholderTile(nCell) || // not a free tile
                    r.work.i(wi, 17) === 0) { // not qualified
                    // Foreign generation code is fatal; anything else is just
                    // skipped (0x59d0d2 - 0x59d0e5).
                    const mark = r.work.i(wi, 14);
                    if (mark !== 0 && mark !== genCode) // 0x59d0e3
                        ok = false;
                    continue;
                }

                // (3) Accept: allocate a node and push it. Priority draws one
                // RNG value either way (the draw happens before the capacity
                // test, 0x59d010 - 0x59d053):
                //   priority = 10 * rand * kUnitScale
                //            + 0.5 * dist(neighbour, seed)
                //            - 0.02 * expanded
                // The distance term is the vanilla YRMath::sqrt (0x4cac40
                // table-lookup fast sqrt, float result) - see MapGenFastSqrt.h.
                const dx = seedX - nx; // 0x59cfda
                const dy = seedY - ny; // 0x59cfe1
                const d2 = dx * dx + dy * dy;
                const randUnit = r.rng.next() * K_UNIT_SCALE;
                const dist = yrSqrt(d2); // 0x59cff3 (MapGenFastSqrt::Sqrt, float)
                // Vanilla x87 chain, stored to float at the end; SSE2 double
                // math matches it, with the 0.02 literal taken as float.
                const priority = Math.fround(
                    10.0 * randUnit + 0.5 * dist - K_002F * expanded);

                r.work.setI(wi, 15, genCode); // 0x59d05c (occupies)
                if (nodes.length < cap) {
                    const node: LakeNode = { coords: packXY(nx, ny), priority };
                    nodes.push(node);
                    heap.push(node); // 0x59d082 sift-up
                }
                // else: vanilla overruns its fixed block; the node is dropped.
            }

            // (4) Advance: count the cell and pop the next candidate.
            ++expanded; // 0x59d103
            current = heap.pop();
            if (expanded >= target) // 0x59d147
                break;
        }
    }

    // ---- 6. Heap drain (0x59d14d - 0x59d23f) -----------------------------
    // Leftover candidates are stamped if still free + qualified; an
    // unacceptable cell only clears the success flag (no neighbours added).
    {
        let node = heap.pop();
        while (node !== null && ok) {
            const nx = unpX(node.coords);
            const ny = unpYS(node.coords);
            const wi = r.workIndex(nx, ny);
            const c = r.cellAt(nx, ny);
            if (r.work.i(wi, 14) === 0 && r.isPlaceholderTile(c) && r.work.i(wi, 17) !== 0) {
                c.isoTileTypeIndex = r.waterTileIndex; // 0x59d1de
                c.height = 0; // 0x59d1e1
                r.work.setI(wi, 14, genCode); // 0x59d1ee
            } else {
                ok = false; // 0x59d1f3
            }
            ++expanded; // 0x59d22f
            node = heap.pop();
        }
    }

    // ---- 6b. Size gate (0x59d23f - 0x59d259) -----------------------------
    if (ok && (expanded <= 75 || expanded <= Math.trunc(target / 4)))
        ok = false;

    // ---- 7a. Finish (0x59d25e - 0x59d3ac) --------------------------------
    // Auto mode only: smooth, then lakeshore-expand, then stamp the green
    // ground tile over the cells the expansion left as placeholders. A
    // specified-seed lake (river exit) skips all of it - the river caller
    // post-processes.
    if (ok && autoMode) {
        if (smoothWaterBody(r, genCode, 0)) { // 0x59d289 sub_57A0C0
            if (expandWaterBody(r, genCode, 1, 0, 0, 512, 512, 0, 0)) { // 0x59d32a
                const it = new CellIterator();
                it.reset(r.cellSlots, r.size.mapWidth);
                for (let c = it.next(); c !== null; c = it.next()) {
                    const wx = c.mapCoords & 0xffff;
                    const wy = c.mapCoords >>> 16;
                    if (r.work.i(r.workIndex(wx, wy), 14) !== genCode) // 0x59d384
                        continue;
                    const tile = c.isoTileTypeIndex; // 0x59d386
                    if (tile === 0 || tile === 0xffff) // 0x59d393
                        c.isoTileTypeIndex = r.greenTileIndex; // 0x59d39b (dword_AA0E18)
                }
            } else {
                ok = false;
            }
        } else {
            ok = false;
        }
    }

    // ---- 7b. Result (0x59d2c3 - 0x59d2e3) --------------------------------
    if (ok) {
        r.usedWaterCells += expanded; // 0x59d2d5
        diag(`LAKE-OK g=${genCode} expanded=${expanded}`);
        return true; // 0x59d2e3
    }

    // ---- 7c. Rollback (0x59d3b6 - 0x59d418) ------------------------------
    // Undo every cell this attempt stamped, back to plain land.
    {
        const it = new CellIterator();
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let c = it.next(); c !== null; c = it.next()) {
            const wx = c.mapCoords & 0xffff;
            const wy = c.mapCoords >>> 16;
            const wi = r.workIndex(wx, wy);
            if (r.work.i(wi, 14) !== genCode) // 0x59d3fc
                continue;
            r.work.setI(wi, 14, 0); // 0x59d401
            r.work.setByte(wi, 75, 0); // 0x59d404
            c.isoTileTypeIndex = 0; // 0x59d408
            c.height = 0; // 0x59d40b
            c.level = r.baseLevel; // 0x59d418
        }
    }
    return false;
}
