/**
 * Transliteration of G:/MapGenerator MapGenTiberium.cpp - the "RMG: Creating
 * tiberium" stage (sub_598960 @ 0x598EE5 - 0x598FB7), its body sub_5A23A0,
 * the field grower sub_5A28C0 and the [port-only] archipelago ore pillars.
 *
 * Stage slice:
 *   sub_5A23A0(this)                       place the ore / gem fields
 *   [port-only] PlaceArchipelagoOrePillars (archipelago maps)
 *   -- region-system teardown (the stage tail, 0x598f04 - 0x598fbd) --
 *     for (every work cell) { data[14] = -1; data[15] = -1; }
 *     for (every region, reverse order) ReleaseRegionObject(r, true)
 *     regionIdCounter = 0
 *
 * Cross-module note: ToTiberiumIdx (MapGenRecalc.cpp, 0x5FDD20) and
 * IsOreClearArea (MapGenLAT.cpp, [port-only]) are duplicated here as module
 * locals because this module's runtime imports are limited to './making' /
 * './makingSub' (the recalc.ts / lat.ts homes would add forbidden edges).
 * The copies are 1:1 with the C++ originals.
 */

import type { Rmg } from './mapGen';
import { CellIterator, i16, packXY, unpX, unpYS, LandType } from './types';
import { F2I64, K_UNIT_SCALE } from './mathTables';
import { diag } from './diag';
import { releaseRegionObject } from './making';
import { isWithinUsableArea } from './makingSub';
import { msvcSort } from './msvcSort';

/** AltCellFlags_ContainsBuilding (MapGen.h 0x2) - the object-chain stand-in. */
const ALT_CONTAINS_BUILDING = 0x2;

/** PassabilityType_Passable / _Beach (values of the mapGen.ts Passability
 * enum; kept literal to avoid a runtime import cycle through mapGen). */
const PT_PASSABLE = 0;
const PT_BEACH = 3;

// Neighbours table order (CellClass::GetNeighbourCell), N first, clockwise.
const K_DIR_X = [0, 1, 1, 1, 0, -1, -1, -1];
const K_DIR_Y = [-1, -1, 0, 1, 1, 1, 0, -1];

// One 8-byte pool node: the packed cell coords and the float priority.
interface TiberiumNode {
    coords: number;   // packed CellStruct (low16 X, high16 Y)
    priority: number; // float store (Math.fround)
}

// TIBTRE decoration names - the C++ file defines the identical table inside
// both GrowTiberiumField (0x5a2bb0) and PlaceArchipelagoOrePillars.
const K_TIBTRE_NAMES = ['TIBTRE01', 'TIBTRE02', 'TIBTRE03'];

// ---------------------------------------------------------------------------
// ToTiberiumIdx - 0x5FDD20 (size 0xBE). (C++ source: MapGenRecalc.cpp; local
// copy - see the module header.)
//
//   if (overlayIndex == -1) return -1;
//   if (!OverlayTypeClass::Array[overlayIndex]->Tiberium) return -1;
//   for (i = 0; i < TiberiumClass::Array.Count; ++i)
//   {
//       start = Array[i]->Image->ArrayIndex;
//       if (overlayIndex in [start, start + NumImages))                     return Array[i]->ArrayIndex;
//       if (overlayIndex in [start + NumImages, start + NumImages + +0xEC)) return Array[i]->ArrayIndex;
//   }
//   return 0;                                    // ore, but no entry matched
//
// The caller only compares the answer against -1, so the "0" outcome and a
// real ore index are equivalent to it.
// ---------------------------------------------------------------------------
function toTiberiumIdx(r: Rmg, overlayIndex: number): number {
    if (overlayIndex === -1)
        return -1;
    if (overlayIndex < 0 || overlayIndex >= r.overlayTypes.length)
        return -1;
    if (!r.overlayTypes[overlayIndex]!.tiberium)
        return -1;

    for (let i = 0; i < r.tiberiums.length; ++i) {
        const t = r.tiberiums[i]!;
        const firstEnd = t.overlayStart + t.numImages;
        if (overlayIndex >= t.overlayStart && overlayIndex < firstEnd)
            return t.arrayIndex;
        if (overlayIndex >= firstEnd && overlayIndex < firstEnd + t.extra)
            return t.arrayIndex;
    }
    return 0;
}

// ---------------------------------------------------------------------------
// 矿石/矿柱净场：出生点 2x2 外扩 8 格 => 18x18（默认口径）。
// 群岛例外：外扩 3 格 => 8x8，这是群岛特有的规则。
// (C++ source: MapGenLAT.cpp IsOreClearArea; local copy - see the header.)
// ---------------------------------------------------------------------------
function isOreClearArea(r: Rmg, x: number, y: number): boolean {
    const kOreClearOuter = 8;              // 默认 18x18
    const kOreClearOuterIsles = 3;         // 群岛 8x8
    const outer = (r.config.landType === LandType.Archipelago)
        ? kOreClearOuterIsles
        : kOreClearOuter;
    for (let i = 0; i < r.startingPoints.length; ++i) {
        const c = r.startingPoints[i]!.coords;
        const sx = unpX(c);
        const sy = unpYS(c);
        if (x >= sx - outer
            && x <= sx + outer + 1
            && y >= sy - outer
            && y <= sy + outer + 1) {
            return true;
        }
    }
    return false;
}

// ---------------------------------------------------------------------------
// sub_5A23A0 (0x5A23A0 - 0x5A289D) - per-region ore / gem field placement,
// then the [port-only] archipelago ore pillars and the stage tail teardown.
//
//   Ore or gem (0x5a23b4):
//     landType 0          -> gems = (this[16] == 3)
//     landType 1 / 3 / 4  -> gems = (this[16] != 3)
//     landType 2          -> gems = 1
//     other               -> gems = 0
//
//   config.oreDensity is the RMG dialog's ore-amount combo (combo 0x408). The
//   related values, both verified in the exe:
//     this[21]  = 20 * oreDensity                    (0x59730b, sub_597260)
//     this[175] = [General] RMGMinimumTiberium       (0x5982bb, ctor 2500)
//     this[176] = [General] RMGMaximumTiberium       (0x5982d5, ctor 5500)
//   and the per-starting-point cell budget is
//     base = F2I64(this[21] * 0.01 * (this[176] - this[175]) + this[175])
//     n    = F2I64(base * max(startingPoints, 0.5))
//
//   `offset` (vanilla v45) walks the waypoint list: it advances only for the
//   regions that actually grow a field.
// ---------------------------------------------------------------------------
export function addTiberium(r: Rmg): void {
    if (r.work.count === 0)
        return;

    const landType = r.config.landType;                        // this[15]
    const control = r.config.oreDensity;                       // this[16]

    // 0x5a23b4 - 0x5a23e9
    let gems: boolean;
    switch (landType) {
        case LandType.Archipelago: gems = (control === 3); break;
        case LandType.Continent:
        case LandType.Inland:
        case LandType.Mountainous: gems = (control !== 3); break;
        case LandType.TeamContinent: gems = true; break;
        default: gems = false; break;
    }

    // 0x5a254c - 0x5a259e
    const this21 = 20 * control;                               // 0x59730b
    const base = F2I64(this21 * 0.01
        * (r.settings.MaxTiberium - r.settings.MinTiberium)
        + r.settings.MinTiberium);

    const side = r.size.workSide;
    let offset = 0;                                            // v45

    for (let i = 0; i < r.regions.length; ++i) {
        const region = r.regions[i]!;
        if (region === null || region.startPointPicks.length === 0)   // 0x5a240f
            continue;

        let chosen = -1;                                       // v50

        if (gems) {
            // Anchor (0x5a242e - 0x5a24cc). startingPoints > 0: the average of
            // the region's waypoints. Otherwise a random cell of the region's
            // own cell list - a path that cannot produce a field (n becomes
            // 0).
            let anchorX = 0;
            let anchorY = 0;
            if (region.startingPoints <= 0) {
                const cnt = region.cells.length;
                if (cnt <= 0)
                    continue;                                  // port guard
                let idx: number;
                do {
                    idx = F2I64(r.rng.next() * cnt * K_UNIT_SCALE);
                }
                while (idx > cnt - 1);
                const anchorCell = region.cells[idx]!;
                anchorX = unpX(anchorCell);
                anchorY = unpYS(anchorCell);
            }
            else {
                let sx = 0;
                let sy = 0;
                for (let w = 0; w < region.startingPoints; ++w) {
                    const wc = r.waypoints[offset + w]!;
                    sx += unpX(wc);
                    sy += unpYS(wc);
                }
                anchorX = i16(Math.trunc(sx / region.startingPoints));
                anchorY = i16(Math.trunc(sy / region.startingPoints));
            }

            // Nearest pick-list entry to the anchor (0x5a24cf - 0x5a2546).
            const anchor = packXY(anchorX, anchorY);
            let best = 500000;
            for (let c = 0; c < region.startPointPicks.length; ++c) {
                const p = region.startPointPicks[c]!;
                const dx = unpX(p) - unpX(anchor);
                const dy = unpYS(p) - unpYS(anchor);
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < best) {
                    best = F2I64(d);
                    chosen = c;
                }
            }
        }

        // Amount (0x5a2575 - 0x5a259e)
        const sp = region.startingPoints;
        const n = F2I64(base * ((sp < 0.5) ? 0.5 : sp));
        const count = region.startPointPicks.length;
        if (count === 0 || n === 0)                            // 0x5a25b4
            continue;

        // Pass 1 (0x5a25bd - 0x5a2638): one field per pick-list cell.
        const per = Math.trunc(n / count);
        for (let c = 0; c < count; ++c) {
            let jitter: number;
            do {
                jitter = r.rng.gaussian() * 50.0;
            }
            while (jitter < -100.0 || jitter > 100.0);         // 0x5a25e8/0x5a25f9

            const amount = F2I64(per + jitter);
            if (amount >= 0)                                   // 0x5a260a
                growTiberiumField(r, region.startPointPicks[c]!, amount,
                    offset + c + 1, c === chosen);
        }

        // Pass 2 (0x5a2643 - 0x5a2846): one field per starting point, its size
        // scaled by how far that waypoint sits from the field cluster.
        const avg: number[] = [];
        for (let w = 0; w < region.startingPoints; ++w) {
            const wc = r.waypoints[offset + w]!;
            let sum = 0.0;
            for (let c = 0; c < count; ++c) {
                const p = region.startPointPicks[c]!;
                const dx = unpX(p) - unpX(wc);
                const dy = unpYS(p) - unpYS(wc);
                sum += Math.sqrt(dx * dx + dy * dy);
            }
            avg.push(sum / count);                             // 0x5a2719
        }

        let minAvg = 9999999.0;                                // 0x5a2788
        for (let k = 0; k < avg.length; ++k) {
            if (avg[k]! < minAvg)
                minAvg = avg[k]!;
        }

        // 0x5a27c6 - 0x5a27da
        const variant = (control === 3 && (landType === LandType.Continent
            || landType === LandType.Inland
            || landType === LandType.Mountainous));

        for (let w = 0; w < region.startingPoints; ++w) {
            const amount = F2I64((avg[w]! - minAvg) * 15.0) + 500;
            growTiberiumField(r, r.waypoints[offset + w]!, amount,
                offset + w + 1, variant);                      // 0x5a2816
        }

        offset += region.startingPoints;                       // 0x5a2846
    }

    // [port-only] 群岛：矿柱改由 PlaceArchipelagoOrePillars 统一按"每点相同"
    // 放置，GrowTiberiumField 已不再往 terrainObjects_ 里塞 TIBTRE。
    if (landType === LandType.Archipelago)
        placeArchipelagoOrePillars(r);

    // ---- the stage tail (0x598f04 - 0x598fbd) -----------------------------
    // Clear the two work marks over the whole work square, free every region
    // object and reset the region-id counter. Same three steps the
    // Init-regions stage opens with.
    if (side > 0) {
        for (let k = 0; k < side * side; ++k) {
            r.work.setI(k, 14, -1);                            // 0x598f24
            r.work.setI(k, 15, -1);                            // 0x598f2e
        }
    }
    for (let k = r.regions.length; k-- > 0; )                  // 0x598f4a
        releaseRegionObject(r, r.regions[k]!, true);
    r.regionIdCounter = 0;                                     // 0x598fbd
}

// ---------------------------------------------------------------------------
// sub_5A28C0 (0x5A28C0 - 0x5A2ECB) - one field.
//
// Grows a best-first flood over placeholder cells until `target` cells carry
// ore:
//   pool   = 10 * target 8-byte nodes (coords + float priority)
//   heap   = min-heap over pool indices, capacity 10 * target (sub_5AD870's
//            shape: 1-based, sift-up inline, sift-down on pop)
//   at most 10 seed rounds; a round re-seeds when the heap runs dry
//   priority = |cell - anchor| + Next() * 5 * kUnitScale
//   work byte +0x3C (data[15]) is stamped with `mark` for every covered cell
//
// `variant` picks the overlay family - true -> 27 (the gem floor), false ->
// 102 (the ore floor), each 12 variants - AND gates the ore decoration tree.
//
// NOTE the quirk that the two call sites give the 4th argument DIFFERENT
// meanings (verified in the disassembly at 0x5a262d and 0x5a2827):
//   pass 1 (pick-list cells)  passes `c == chosen`
//   pass 2 (starting points)  passes the gem flag
// `chosen` is only computed when gems is set, so pass 1 passes 0 for every
// cell on an ore map. This is vanilla behaviour, reproduced as-is.
//
// Route B: the ore decoration tree is an engine object vanilla creates with a
// sub_71DD80 name lookup plus the sub_71BB90 constructor; the port records a
// MapTerrainObject instead (the .map [Terrain] source).
// ---------------------------------------------------------------------------
export function growTiberiumField(r: Rmg, seed: number, target: number,
                                  mark: number, variant: boolean): void {
    if (r.work.count === 0 || target <= 0)
        return;

    const overlayBase = variant ? 27 : 102;                    // 0x5a296e

    // [port-only] 群岛的矿柱由 PlaceArchipelagoOrePillars 统一放，矿田这里不撒。
    const archipelago = (r.config.landType === LandType.Archipelago);

    const capacity = 10 * target;
    const pool: TiberiumNode[] = new Array(capacity);

    const heap: number[] = [-1];                               // 1-based

    const side = r.size.workSide;

    // sift-up insert (0x5a2a6d - 0x5a2ab2); the vanilla refuses a node that
    // would push count+1 onto the capacity.
    const push = (node: number): void => {
        if (heap.length >= capacity)
            return;
        heap.push(node);
        let i = heap.length - 1;
        while (i > 1 && pool[heap[i >> 1]!]!.priority > pool[heap[i]!]!.priority) {
            const t = heap[i >> 1]!;
            heap[i >> 1] = heap[i]!;
            heap[i] = t;
            i >>= 1;
        }
    };

    // pop the root, then sift down (sub_5AD870(1))
    const pop = (): number => {
        if (heap.length <= 1)
            return -1;
        const root = heap[1]!;
        heap[1] = heap[heap.length - 1]!;
        heap.pop();
        let i = 1;
        const last = heap.length - 1;
        for (;;) {
            let m = i;
            const l = 2 * i;
            const rr = 2 * i + 1;
            if (l <= last && pool[heap[l]!]!.priority < pool[heap[m]!]!.priority)
                m = l;
            if (rr <= last && pool[heap[rr]!]!.priority < pool[heap[m]!]!.priority)
                m = rr;
            if (m === i)
                break;
            const t = heap[i]!;
            heap[i] = heap[m]!;
            heap[m] = t;
            i = m;
        }
        return root;
    };

    let nextNode = 0;               // v53: next free pool slot
    let placed = 0;                 // v54: cells that took ore
    let round = 0;                  // n10
    let cur = -1;                   // current pool slot, -1 = none
    let first = false;              // v48
    let anchor = 0;                 // v52, packed CellStruct

    while (round < 10) {                                        // 0x5a29a6
        if (cur < 0) {
            // Re-seed (0x5a29bc - 0x5a2b02): clear the marks over the whole
            // diamond, push the seed with priority 0, stamp it and take it
            // back.
            heap.length = 0;
            heap.push(-1);

            const it = new CellIterator();
            it.reset(r.cellSlots, r.size.mapWidth);
            for (let c = it.next(); c !== null; c = it.next()) {   // 0x5a29e4
                const x = c.mapCoords & 0xffff;
                const y = c.mapCoords >>> 16;
                r.work.setOccupancy(r.workIndex(x, y), 0);          // 0x5a2a0a
            }

            nextNode = 1;
            pool[0] = { coords: seed, priority: Math.fround(0.0) }; // 0x5a2a2f/31
            r.work.setOccupancy(r.workIndex(unpX(seed), unpYS(seed)), mark);  // 0x5a2a56
            push(0);
            cur = pop();                                            // 0x5a2ae2
            first = false;
            ++round;
            anchor = seed;                                          // 0x5a2b02
        }

        const cc = pool[cur]!.coords;
        const cell = r.cellAt(unpX(cc), unpYS(cc));

        // 0x5a2b39: the +69 protection mark skips the overlay / decoration
        // work for this node but still lets it feed its neighbours.
        // [移植侧] 出生点净场 10x10 跳过矿石覆盖与 TIBTRE 矿柱（但仍喂邻
        // 居，矿田会绕过净场继续生长），出生点在本阶段之前已确定。
        // [移植侧] 科技建筑的地基格同样跳过：科技建筑在本阶段之前已经放好，
        // 矿石覆盖或矿柱压到地基上会让建筑在游戏里无法使用/显示异常。
        const skipOverlay =
            (r.work.byte(r.workIndex(unpX(cc), unpYS(cc)), 69) !== 0)
            || isOreClearArea(r, unpX(cc), unpYS(cc))
            || ((cell.altFlags & ALT_CONTAINS_BUILDING) !== 0);

        if (!skipOverlay) {
            if (!first) {                                           // 0x5a2b4a
                first = true;
                anchor = cc;                                        // 0x5a2b57
                heap.length = 0;
                heap.push(-1);
                nextNode = 0;

                if (!variant && !archipelago) {                     // 0x5a2b88
                    // Ore decoration tree (0x5a2b98 - 0x5a2c05). Vanilla
                    // builds a live object; the port records it (route B).
                    let n3: number;
                    do {
                        n3 = F2I64(r.rng.next() * (3.0 * K_UNIT_SCALE) + 1.0);
                    }
                    while (n3 > 3);
                    r.terrainObjects.push({
                        coords: cc,
                        typeName: K_TIBTRE_NAMES[(n3 % 10) - 1]!,
                    });
                }
            }

            // The cell itself (0x5a2c16 - 0x5a2c63)
            if (cell.overlayTypeIndex === -1) {
                let n0xB: number;
                do {
                    n0xB = F2I64(r.rng.next() * (12.0 * K_UNIT_SCALE));  // 0x5a2c38
                }
                while (n0xB > 11);
                cell.overlayTypeIndex = overlayBase + n0xB;         // 0x5a2c4c
                ++placed;
            }
            else if (cell.overlayData < 11) {                       // 0x5a2c59
                ++cell.overlayData;
                ++placed;
            }
        }

        // Neighbours (0x5a2c67 - 0x5a2e54)
        for (let d = 0; d < 8; ++d) {
            const nb = packXY(i16(unpX(cc) + K_DIR_X[d]!),
                i16(unpYS(cc) + K_DIR_Y[d]!));
            if (!isWithinUsableArea(r, nb, true))                   // 0x5a2cbc
                continue;
            const ncell = r.cellAt(unpX(nb), unpYS(nb));
            if (!r.isPlaceholderTile(ncell))                        // 0x5a2cd9
                continue;
            // [移植侧] 矿田不把科技建筑地基格纳入扩散候选，矿石不会盖到建筑
            // 底下；地基外侧的格仍可由其他节点喂到，矿田绕着地基长。
            if ((ncell.altFlags & ALT_CONTAINS_BUILDING) !== 0)
                continue;

            let accept = false;
            if (ncell.overlayTypeIndex === -1)
                accept = (r.work.occupancy(r.workIndex(unpX(nb), unpYS(nb))) !== mark);
            if (!accept && ncell.overlayData < 11
                && toTiberiumIdx(r, ncell.overlayTypeIndex) !== -1)   // 0x5a2d31
                accept = true;
            if (!accept)
                continue;

            if (nextNode >= capacity)                               // pool guard
                continue;

            const dx = unpX(anchor) - unpX(nb);
            const dy = unpYS(anchor) - unpYS(nb);
            const dist = Math.sqrt(dx * dx + dy * dy);
            pool[nextNode] = {
                coords: nb,
                priority: Math.fround(r.rng.next() * 5.0 * K_UNIT_SCALE + dist),
            };
            r.work.setOccupancy(r.workIndex(unpX(nb), unpYS(nb)), mark);  // 0x5a2dd1
            push(nextNode);
            ++nextNode;
        }

        const popped = pop();                                       // 0x5a2e87
        if (placed < target) {                                      // 0x5a2e99
            cur = popped;
            continue;
        }
        break;
    }
}

// ---------------------------------------------------------------------------
// [port-only] PlaceArchipelagoOrePillars
//
// 群岛专用：矿柱（TIBTRE 装饰物）改成"每个出生点持有的数量完全相同"。
//
//   1) 目标数量 N = 1..5 随机一个；
//   2) 对每个出生点，从它出发按可走陆地（Passable / Beach）4 向泛洪找出它所在
//      的岛；同一座岛上的出生点归成一组共用一份候选格（有矿石的排前面，同档
//      按离该岛第一个出生点的距离升序）。候选格 = 不在矿石净场里、在可用区内、
//      当前没有矿柱的格子；
//   3) N 按"每岛可用格数 ÷ 该岛出生点数"取最小值兜底，保证每座岛上的每个出生
//      点都放得下 N 个（N 归零则说明有岛一个格子都放不下，此时整图不放矿柱）；
//   4) 每座岛放"该岛出生点数 × N"个矿柱，于是每个出生点持有的数量必然相同。
//
// 名称与矿田原本的取法一致（1..3 随机）；矿柱落在矿石格上时就是常见的矿树，
// 落在普通陆地格上则是裸矿柱。
// ---------------------------------------------------------------------------
export function placeArchipelagoOrePillars(r: Rmg): void {
    const side = r.size.workSide;
    const pointCount = r.startingPoints.length;
    if (r.work.count === 0 || side <= 0 || pointCount <= 0)
        return;

    const kDX4 = [0, 1, 0, -1];
    const kDY4 = [-1, 0, 1, 0];

    // 已经被矿柱占住的格子（含本进程早先留下的 TIBTRE）。
    const occupied = new Uint8Array(side * side);
    const isTibTre = (n: string): boolean =>
        n.charCodeAt(0) === 84   // 'T'
        && n.charCodeAt(1) === 73 // 'I'
        && n.charCodeAt(2) === 66 // 'B'
        && n.charCodeAt(3) === 84 // 'T'
        && n.charCodeAt(4) === 82 // 'R'
        && n.charCodeAt(5) === 69; // 'E'
    for (let i = 0; i < r.terrainObjects.length; ++i) {
        const obj = r.terrainObjects[i]!;
        if (!isTibTre(obj.typeName))
            continue;
        const cx = unpX(obj.coords);
        const cy = unpYS(obj.coords);
        if (cx >= 0 && cy >= 0 && cx < side && cy < side)
            occupied[cx + side * cy] = 1;
    }

    // ---- 逐岛归并：同一座岛上的出生点共用一份候选格 -------------------------
    interface IslandSlot {
        repIdx: number;       // 岛的极小索引，用来判同一座岛
        points: number[];     // 这座岛上的出生点序号
        oreCells: number[];   // 岛上有矿石的可用格（packed）
        plainCells: number[]; // 岛上普通可用格（packed）
    }
    const islands: IslandSlot[] = [];

    const seen = new Int32Array(side * side);
    let stamp = 0;
    const stack: number[] = [];
    const islandCells: number[] = [];

    for (let p = 0; p < pointCount; ++p) {
        const sp = r.startingPoints[p]!.coords;                 // packed
        const spX = unpX(sp);
        const spY = unpYS(sp);
        if (spX < 0 || spY < 0 || spX >= side || spY >= side) {
            // 点的坐标不合法就没法保证数量一致，整图不放。
            diag('ORE-PILLAR archipelago: 出生点坐标非法，整图不放矿柱');
            return;
        }

        // 该出生点所在岛的整片可走陆地。
        ++stamp;
        islandCells.length = 0;
        stack.length = 0;
        const spIdx = spX + side * spY;
        let repIdx = spIdx;
        seen[spIdx] = stamp;
        stack.push(spIdx);
        while (stack.length > 0) {
            const idx = stack.pop()!;
            if (idx < repIdx)
                repIdx = idx;
            const px = idx % side;
            const py = Math.trunc(idx / side);
            islandCells.push(packXY(px, py));
            for (let d = 0; d < 4; ++d) {
                const nx = px + kDX4[d]!;
                const ny = py + kDY4[d]!;
                if (nx < 0 || ny < 0 || nx >= side || ny >= side)
                    continue;
                const ni = nx + side * ny;
                if (seen[ni] === stamp)
                    continue;
                if (!r.cellExists(nx, ny))
                    continue;
                const c = r.cellAt(nx, ny);
                if (c.passability !== PT_PASSABLE
                    && c.passability !== PT_BEACH)
                    continue;
                seen[ni] = stamp;
                stack.push(ni);
            }
        }

        // 找同一座岛（代表格相同）的已有分组。
        let isl = -1;
        for (let k = 0; k < islands.length; ++k) {
            if (islands[k]!.repIdx === repIdx) {
                isl = k;
                break;
            }
        }
        if (isl < 0) {
            islands.push({ repIdx: 0, points: [], oreCells: [], plainCells: [] });
            isl = islands.length - 1;
            islands[isl]!.repIdx = repIdx;
        }
        const slot = islands[isl]!;
        const firstOnIsland = slot.points.length === 0;
        slot.points.push(p);

        // 候选格每座岛只收集一次：不在矿石净场里、在可用区内、当前没有矿柱。
        if (firstOnIsland) {
            for (let i = 0; i < islandCells.length; ++i) {
                const c = islandCells[i]!;
                const cx = unpX(c);
                const cy = unpYS(c);
                if (occupied[cx + side * cy] !== 0)
                    continue;
                if (isOreClearArea(r, cx, cy))
                    continue;
                if (!isWithinUsableArea(r, c, true))
                    continue;
                const cell = r.cellAt(cx, cy);
                // 科技建筑地基格不能在候选里：写盘前的剪枝会删掉地基上的任何
                // 地形对象，若这里允许选中就会让该出生点少一个矿柱。
                if ((cell.altFlags & ALT_CONTAINS_BUILDING) !== 0)
                    continue;
                if (toTiberiumIdx(r, cell.overlayTypeIndex) !== -1)
                    slot.oreCells.push(c);
                else
                    slot.plainCells.push(c);
            }

            // 有矿石的排前面；同档按到本岛第一个出生点的距离升序。
            // (C++ comparator: ax*ax+ay*ay < bx*bx+by*by; the difference is
            // the same ordering. NOTE std::sort is unstable while the JS sort
            // is stable - ties keep flood order here, see the port report.)
            const nearFirst = (a: number, b: number): boolean => {
                const ax = unpX(a) - spX;
                const ay = unpYS(a) - spY;
                const bx = unpX(b) - spX;
                const by = unpYS(b) - spY;
                return ax * ax + ay * ay < bx * bx + by * by;
            };
            msvcSort(slot.oreCells, nearFirst);
            msvcSort(slot.plainCells, nearFirst);
        }
    }

    // ---- 统一数量：1..5 随机，再按"每岛可用格数 ÷ 该岛点数"兜底 ------------
    let target = r.rng.randomFloatRange(1, 5);
    for (let k = 0; k < islands.length; ++k) {
        const pts = islands[k]!.points.length;
        const avail = islands[k]!.oreCells.length
            + islands[k]!.plainCells.length;
        const cap = (pts > 0) ? Math.trunc(avail / pts) : 0;
        if (cap < target)
            target = cap;
    }
    if (target <= 0) {
        diag('ORE-PILLAR archipelago: 有出生点所在岛没有可用格，整图不放矿柱');
        return;
    }

    // ---- 每座岛放"该岛点数 × target"个，各点数量因此必然相同 ----------------
    for (let k = 0; k < islands.length; ++k) {
        const slot = islands[k]!;
        const need = slot.points.length * target;

        let placed = 0;
        for (let i = 0; i < slot.oreCells.length && placed < need; ++i) {
            const c = slot.oreCells[i]!;
            const ci = unpX(c) + side * unpYS(c);
            if (occupied[ci] !== 0)
                continue;
            occupied[ci] = 1;
            const n3 = r.rng.randomFloatRange(1, 3);
            r.terrainObjects.push({ coords: c, typeName: K_TIBTRE_NAMES[n3 - 1]! });
            ++placed;
        }
        for (let i = 0; i < slot.plainCells.length && placed < need; ++i) {
            const c = slot.plainCells[i]!;
            const ci = unpX(c) + side * unpYS(c);
            if (occupied[ci] !== 0)
                continue;
            occupied[ci] = 1;
            const n3 = r.rng.randomFloatRange(1, 3);
            r.terrainObjects.push({ coords: c, typeName: K_TIBTRE_NAMES[n3 - 1]! });
            ++placed;
        }
        if (placed < need) {
            diag(`ORE-PILLAR archipelago: 岛${k} 只放下 ${placed}/${need} 个矿柱`);
        }
    }

    diag(`ORE-PILLAR archipelago: 每个出生点 ${target} 个矿柱，共 ${pointCount} 个点 ${islands.length} 座岛`);
}
