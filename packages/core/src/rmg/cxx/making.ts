/**
 * Transliteration of G:/MapGenerator MapGenRegion.cpp (the "RMG: Init regions"
 * stage sub_598960 @ 0x598C24 and its subordinates sub_5AC290 / sub_58CF90 /
 * sub_58BF70 / sub_58C800 / sub_58E740 / sub_58D410 / sub_58E9B0 / sub_58D010)
 * plus MapGenMaking.cpp (the "RMG: Making regions" stage body @ 0x598D44).
 *
 * The Making-regions subordinates live in makingSub.ts (MapGenMakingSub.cpp).
 * The four river-side helpers this stage needs (isWaterFamilyTile /
 * isGreenGroundTile / buildWaterRing / repairCliffPieces) are re-exported
 * through makingSub.ts so the runtime import graph stays making -> makingSub
 * -> river (PORTING.md rule 5).
 *
 * NOTE: makingSub.ts imports releaseRegionObject / assignRemainingCells /
 * collectRegionBoundary / createRegionRecord back from this module - a
 * function-level import cycle that mirrors the C++ file layout (MapGenRegion
 * vs MapGenMakingSub). Safe at runtime: every use sits inside a function
 * body, so module late binding resolves it after both modules loaded.
 */

import type { Rmg } from './mapGen';

import {
    CellIterator,
    DIR_X,
    DIR_Y,
    MapCell,
    MapRegion,
    newRegion,
    packXY,
    unpX,
    unpY,
    unpYS,
    i16,
} from './types';
import { F2I64, K_UNIT_SCALE } from './mathTables';
import {
    // MapGenMaking.cpp stage calls (MapGenMakingSub.cpp)
    rebuildRegionBodies,
    reseedRegions,
    fixCliffLevels,
    placeCliffs,
    correctCliffTiles,
    fillGreenPlaceholders,
    // river.ts helpers routed through makingSub (see header note)
    isWaterFamilyTile,
    isGreenGroundTile,
    buildWaterRing,
    repairCliffPieces,
} from './makingSub';

// ---------------------------------------------------------------------------
// InitRegions - the "RMG: Init regions" stage of sub_598960, 0x598C24 ..
// 0x598D42. NOT gated by land type - every map runs it.
// ---------------------------------------------------------------------------
export function initRegions(r: Rmg): void {
    // ---- 1. Reset the work region marks (0x598c38 - 0x598c64) -------------
    if (r.work.count !== 0) {
        const workCount = r.size.workSide * r.size.workSide;    // 0x598c40
        for (let i = 0; i < workCount; ++i) {                   // 0x598c47
            r.work.setI(i, 14, -1);                             // 0x598c52 (byte 56)
            r.work.setI(i, 15, -1);                             // 0x598c5c (byte 60)
        }
    }

    // ---- 2. Tear the previous region objects down (0x598c71) -------------
    for (let i = r.regions.length - 1; i >= 0; --i) {
        const region = r.regions[i];
        if (region)
            releaseRegionObject(r, region, true);               // 0x598c81
    }

    // ---- 3. Region-id counter reset (0x598c89) ---------------------------
    r.regionIdCounter = 0;

    // ---- 4. Seed regions from the water-family / green-ground cells ------
    seedRegionsFromWaterCells(r);                               // 0x598c8f

    // ---- 5. Grow the body of every water region (0x598c9d - 0x598cfa) ----
    const landType = r.config.landType;
    const inlandOrMountain = landType === 3 || landType === 4;  // 0x598cc7

    for (let j = 0; j < r.regions.length; ++j) {                // 0x598c9d
        const region = r.regions[j]!;
        if (region === null)
            continue;
        if (!region.waterFamily)                                // 0x598cad (byte +0x14)
            continue;

        const passes = ((region.cellCount > 8000) ? 1 : 0)      // 0x598ce4
            + (inlandOrMountain ? 0 : 1) + 4;
        growRegionBody(r, region, passes);
        sweepRegionBody(r, region);                             // 0x598ceb
    }

    // ---- 6. Assign the leftover cells (0x598cfc) -------------------------
    assignRemainingCells(r, 0);
                                 // 0x598cfa/0x598cfc
}

// ---------------------------------------------------------------------------
// MakeRegions - the "RMG: Making regions" stage of sub_598960, 0x598D44 ..
// 0x598E1E. The gate is the only land-type dependency: LandType 3 (Inland) /
// 4 (Mountainous) run the whole cliff / region-merge / ramp chain, every other
// land type jumps straight to the placeholder fill. The vanilla UI / session
// tail between the gate and the last call is not ported (MapGenMaking.cpp
// header).
// ---------------------------------------------------------------------------
export function makeRegions(r: Rmg): void {
    // ---- 0x598d55 - 0x598d60: the LandType 3/4 gate ----------------------
    const landType = r.config.landType;

    if (landType === 3 || landType === 4) {
        if (process.env['TS_EXTRA_DRAW'] === 'beforefix') r.rng.next(); // TEMP PROBE
        rebuildRegionBodies(r);                      // 0x598d62  sub_58EBC0
        reseedRegions(r);                            // 0x598d67  sub_58EF10
        fixCliffLevels(r);                           // 0x598d6e  sub_5A19E0
        if (process.env['TS_EXTRA_DRAW'] === 'beforecliffs') r.rng.next(); // TEMP PROBE
        if (process.env['TS_EXTRA_K']) { const k = parseInt(process.env['TS_EXTRA_K']!) | 0; for (let q = 0; q < k; ++q) r.rng.next(); } // TEMP PROBE
        if (process.env['TS_REWIND'] === '1') { // TEMP PROBE: undo one draw
            const g = r.rng as unknown as { index1: number; index2: number; buffer: number[] };
            const i1o = (g.index1 - 1 + 250) % 250;
            const i2o = (g.index2 - 1 + 250) % 250;
            g.buffer[i1o] = (g.buffer[i1o] ^ g.buffer[i2o]) >>> 0;
            g.index1 = i1o;
            g.index2 = i2o;
        }
        placeCliffs(r);                              // 0x598d7b  sub_578E60
        correctCliffTiles(r);                        // 0x598d82  sub_5A17F0
        repairCliffPieces(r);                        // port-only swallowed-piece repair
    }

    // ---- 0x598e1a: runs for every land type ------------------------------
    fillGreenPlaceholders(r);                        // sub_59B740
}

// ---------------------------------------------------------------------------
// ReleaseRegionObject - sub_5AC290 - remove one region object from the global
// region array and, when `freeObject` is set, delete it.
// ---------------------------------------------------------------------------
export function releaseRegionObject(r: Rmg, region: MapRegion | null, freeObject: boolean): void {
    if (region === null)
        return;

    // ---- 2. array removal + tail compaction ------------------------------
    // Vanilla searches by pointer identity (FindIndex) and shifts the tail
    // down one slot; vector::erase is that same compaction.
    for (let i = 0; i < r.regions.length; ++i) {
        if (r.regions[i] !== region)
            continue;
        r.regions.splice(i, 1);
        break;
    }

    // ---- 3. embedded cell vector teardown: owned by the record itself ----
    // ---- 4. delete the object when the caller asked for it ---------------
    if (freeObject) {
        // route B: the record is garbage-collected here (0x5ac328).
    }
}

// ---------------------------------------------------------------------------
// SeedRegionsFromWaterCells - sub_58CF90 - seed the regions: linear sweep over
// the work square; every still-unmarked cell carrying a water-family or
// green-ground tile builds its region record through sub_58C800.
// ---------------------------------------------------------------------------
export function seedRegionsFromWaterCells(r: Rmg): void {
    if (r.work.count === 0)
        return;

    const workCount = r.size.workSide * r.size.workSide;        // 0x58cf96
    for (let i = 0; i < workCount; ++i) {                       // 0x58cfa7
        const packed = r.work.i(i, 0);                          // 0x58cfb6

        // The cell is fetched BEFORE the checks (0x58cfbf) - the InvalidCell
        // fallback's coords write is part of the vanilla order.
        const cell = r.cellAt(i16(unpX(packed)), i16(unpY(packed)));

        if (r.work.i(i, 14) !== -1)                             // 0x58cfd0
            continue;
        if (unpX(packed) === 0 && unpY(packed) === 0)
            continue;                                           // 0x58cfd4

        if (isWaterFamilyTile(r, cell) || isGreenGroundTile(r, cell))  // 0x58cfe9
            buildRegionFromCell(r, cell);                       // 0x58cff4
    }
}

// ---------------------------------------------------------------------------
// CreateRegionRecord - sub_58BF70 - the region record constructor
// (0x58bf70 - 0x58c067), shared by BuildRegionFromCell (which then overwrites
// level / waterFamily with the seed cell's) and by SplitOrDropRegion (which
// keeps them).
// ---------------------------------------------------------------------------
export function createRegionRecord(r: Rmg, packedCoords: number): MapRegion {
    const anchor = r.cellAt(i16(unpX(packedCoords)), i16(unpYS(packedCoords)));

    const region = newRegion();
    region.id = r.regionIdCounter;                 // 0x58bf8a
    ++r.regionIdCounter;                           // 0x58c014
    region.cellCount = 0;                          // 0x58bf8d
    region.level = anchor.level;                   // 0x58bfa6
    region.waterFamily = isWaterFamilyTile(r, anchor);  // 0x58bfb0
    region.mergeSettled = 0;                       // 0x58bfc1
    region.rampFlag = 1;                           // 0x58bfc4
    region.consumed = 0;                           // 0x58be0e
    region.bounds.X = 0;                           // 0x58bff3
    region.bounds.Y = 0;
    region.bounds.Width = 0;
    region.bounds.Height = 0;

    r.regions.push(region);                        // 0x58c05d
    return region;
}

// ---------------------------------------------------------------------------
// BuildRegionFromCell - sub_58C800 - "cell -> region record" builder, the
// shared core of SeedRegionsFromWaterCells and AssignRemainingCells
// (0x58c816 - 0x58ce7f). See MapGenRegion.cpp for the full walkthrough of the
// flood and the two reset paths.
// ---------------------------------------------------------------------------
export function buildRegionFromCell(r: Rmg, cell: MapCell | null): MapRegion | null {
    if (cell === null || r.work.count === 0)
        return null;

    const side = r.size.workSide;

    // ---- 1. Seed the flood list (0x58c816 - 0x58c89c) ---------------------
    const seedPacked = cell.mapCoords;
    const seedX = i16(unpX(seedPacked));
    const seedY = i16(unpYS(seedPacked));

    const pending: number[] = [];                    // temp DynamicVectorClass<Cell>
    pending.push(packXY(seedX, seedY));              // 0x58c872

    const seedFamily = isWaterFamilyTile(r, cell)
        || isGreenGroundTile(r, cell);               // 0x58c882 (vanilla v48)
    const seedLevel = cell.level;                    // 0x58c89c (vanilla pBuffer)
    const mark = r.regionIdCounter;                  // dword_ABED14, saved on entry

    // ---- 2. DFS flood (0x58c8aa - 0x58caa7) -------------------------------
    let passes = 0;                                  // vanilla pMapCoord__1
    while (pending.length > 0) {
        const cur = pending.pop()!;                  // 0x58c8b8 / 0x58c8c7
        const curX = unpX(cur);
        const curY = unpYS(cur);

        const own = r.workIndex(curX, curY);
        r.work.setI(own, 14, mark);                  // 0x58c906 (region id)
        r.work.setI(own, 15, mark);                  // 0x58c8f4 (visited)

        for (let dir = 0; dir < 8; ++dir) {          // 0x58c931
            const nx = i16(curX + DIR_X[dir]!);
            const ny = i16(curY + DIR_Y[dir]!);
            if (!r.cellExists(nx, ny))               // 0x58c9bf
                continue;

            const wi = r.workIndex(nx, ny);
            if (r.work.i(wi, 14) !== -1)             // 0x58c9c5
                continue;
            if (r.work.i(wi, 15) === mark)           // 0x58c9c5
                continue;
            r.work.setI(wi, 15, mark);               // stamped before the tests

            const neighbour = r.cellAt(nx, ny);
            if (neighbour.level !== seedLevel)       // 0x58c9e2
                continue;
            const nbFamily = isWaterFamilyTile(r, neighbour)
                || isGreenGroundTile(r, neighbour);  // 0x58ca13
            if (nbFamily !== seedFamily)             // 0x58ca60
                continue;
            pending.push(packXY(nx, ny));            // 0x58ca7a
        }
        ++passes;                                    // 0x58ca95
    }

    // ---- 3. Gate / reset paths (0x58caa7 - 0x58cc7f) ----------------------
    let keep = passes >= 75 || seedFamily;           // 0x58caa7 / fall-through
    if (!keep) {
        if (mark !== 0) {
            // (a) hand the tentative cells over to a neighbouring region
            //     (0x58cca4 - 0x58cdef).
            let cx = i16(seedX - 1);
            let cy = seedY;
            if (!r.cellExists(cx, cy)) {             // 0x58cce6 -> fall back
                cx = seedX;
                cy = i16(seedY - 1);
            }

            if (!r.cellExists(cx, cy)) {             // 0x58cd34
                keep = true;                         // -> LABEL_84
            } else {
                const handOver = r.work.i(r.workIndex(cx, cy), 14);  // vanilla v34
                const handLevel = r.cellAt(cx, cy).level;               // 0x58cd6d

                const it = new CellIterator();       // 0x58cd79
                it.reset(r.cellSlots, r.size.mapWidth);
                for (let c = it.next(); c !== null; c = it.next()) {
                    const x = i16(unpX(c.mapCoords));
                    const y = i16(unpYS(c.mapCoords));
                    const wi = r.workIndex(x, y);
                    if (r.work.i(wi, 14) !== mark)   // 0x58cdbd
                        continue;
                    r.work.setI(wi, 14, handOver);   // 0x58cdbf
                    r.work.setByte(wi, 75, 0);       // 0x58cdc2
                    c.isoTileTypeIndex = 0;          // 0x58cdc6
                    c.height = 0;                    // 0x58cdc9
                    c.level = handLevel !== -1 ? handLevel       // 0x58cddd
                        : r.baseLevel;               // ::Level = this[195]
                }
                return null;                         // LABEL_63 (0x58cc9f)
            }
        } else {
            // (b) first region of the run: pick a random boundary cell of the
            //     tentative body and look for a neighbour on another Level
            //     (0x58cadc - 0x58cc7f).
            const ring = buildWaterRing(r, 0);       // 0x58cadc
            const ringCount = ring.length;

            let index: number;
            do {
                index = F2I64(r.rng.next()           // 0x58cb03
                    * ringCount * K_UNIT_SCALE);     // 0x58cb13
            } while (index > ringCount - 1);         // 0x58cb20

            const pick = ring[index]!;               // 0x58cb2a
            const pickX = unpX(pick);
            const pickY = unpYS(pick);
            let handedOver = false;                  // vanilla v16
            for (let dir = 0; dir < 8 && !handedOver; ++dir) {   // 0x58cb51
                const nx = i16(pickX + DIR_X[dir]!);
                const ny = i16(pickY + DIR_Y[dir]!);
                if (!r.cellExists(nx, ny))           // 0x58cb66
                    continue;

                const neighbour = r.cellAt(nx, ny);
                if (neighbour.level === r.cellAt(pickX, pickY).level)  // 0x58cbac
                    continue;
                if (isWaterFamilyTile(r, neighbour)) // 0x58cbc6 (sub_4865D0 only)
                    continue;

                const nbLevel = neighbour.level;     // 0x58cbea
                handedOver = true;                   // 0x58cc6e

                const it = new CellIterator();       // 0x58cbf6
                it.reset(r.cellSlots, r.size.mapWidth);
                for (let c = it.next(); c !== null; c = it.next()) {
                    const x = i16(unpX(c.mapCoords));
                    const y = i16(unpYS(c.mapCoords));
                    const wi = r.workIndex(x, y);
                    if (r.work.i(wi, 14) !== 0)      // 0x58cc34
                        continue;
                    r.work.setI(wi, 14, -1);         // 0x58cc39
                    r.work.setByte(wi, 75, 0);       // 0x58cc3c
                    c.isoTileTypeIndex = 0;          // 0x58cc40
                    c.height = 0;                    // 0x58cc43
                    c.level = nbLevel !== -1 ? nbLevel       // 0x58cc56
                        : r.baseLevel;               // ::Level = this[195]
                }
            }

            if (handedOver)
                return null;                         // LABEL_63 (0x58cc85)
            keep = true;                             // LABEL_60 -> LABEL_84
        }
    }

    // ---- 4. Build the region record (0x58cdf6 - 0x58ce7f) -----------------
    // sub_58BF70 constructs it; sub_58C800 then overwrites the Level (+16)
    // and the family byte (+20) with the seed cell's values.
    const region = createRegionRecord(r, seedPacked);    // 0x58ce0e / 0x58bf70
    region.level = seedLevel;                        // 0x58ce21 (+16)
    region.waterFamily = seedFamily;                 // 0x58ce24 (byte +20)

    // Count the cells carrying the region id; work cells that never received
    // diamond coords (data[0] == 0) are skipped (sub_5AC370 against {0, 0}).
    const workCount = side * side;                   // 0x58ce38
    for (let i = 0; i < workCount; ++i) {            // 0x58ce71
        if (r.work.i(i, 14) !== region.id)           // 0x58ce50
            continue;
        if (r.work.i(i, 0) !== 0)                    // 0x58ce61
            ++region.cellCount;                      // 0x58ce6a
    }

    // Deliberately NO second append: createRegionRecord already pushed the
    // record onto the array (0x58c05d).
    return region;
}

// ---------------------------------------------------------------------------
// GrowRegionBody - sub_58E740 - build the body of one region, `passes`
// successive fan-out passes starting from the boundary list sub_58D410
// returns. The abort covers BOTH "the neighbour already belongs to another
// region" and "the neighbour is unassigned but carries a real tile"; the
// caller ignores the return, so the abort only ends this region's growth.
// ---------------------------------------------------------------------------
export function growRegionBody(r: Rmg, region: MapRegion | null, passes: number): void {
    if (region === null || r.work.count === 0)
        return;

    const side = r.size.workSide;

    let current = collectRegionBoundary(r, region);  // 0x58e750

    for (let pass = 0; pass < passes; ++pass) {      // 0x58e760
        const grown: number[] = [];                  // the pass's new list

        for (let i = 0; i < current.length; ++i) {   // 0x58e7ab
            const base = current[i]!;                // 0x58e7d2
            const baseX = unpX(base);
            const baseY = unpYS(base);
            for (let dir = 0; dir < 8; ++dir) {      // 0x58e7d2
                const nx = i16(baseX + DIR_X[dir]!);
                const ny = i16(baseY + DIR_Y[dir]!);
                if (!r.cellExists(nx, ny))           // 0x58e828
                    continue;

                const neighbour = r.cellAt(nx, ny);
                if (neighbour.level !== region.level)    // 0x58e848
                    continue;

                const wi = r.workIndex(nx, ny);
                const mark = r.work.i(wi, 14);       // 0x58e872

                if (mark === -1
                    && (r.isPlaceholderTile(neighbour)
                        || isGreenGroundTile(r, neighbour))) {   // 0x58e88f / 0x58e8a9
                    grown.push(packXY(nx, ny));      // 0x58e8ef
                    r.work.setI(wi, 14, region.id);  // 0x58e903
                    neighbour.level = region.level;  // 0x58e90e
                } else if (mark !== region.id) {     // 0x58e91d
                    return;                          // 0x58e986 abort
                }
            }
        }

        current = grown;                             // 0x58e95c (list = next)
    }
}

// ---------------------------------------------------------------------------
// CollectRegionBoundary - sub_58D410 - boundary-cell collector for one region:
// the cells carrying the region's id that have at least one IN-DIAMOND
// neighbour with a different region mark. Only in-diamond neighbours count.
// Returned as packed coords in diamond-iterator order.
// ---------------------------------------------------------------------------
export function collectRegionBoundary(r: Rmg, region: MapRegion | null): number[] {
    const boundary: number[] = [];
    if (region === null || r.work.count === 0 || r.cellSlots.length === 0)
        return boundary;

    const side = r.size.workSide;

    const it = new CellIterator();                   // 0x58d458
    it.reset(r.cellSlots, r.size.mapWidth);
    for (let cell = it.next(); cell !== null; cell = it.next()) {   // 0x58d467
        const x = i16(unpX(cell.mapCoords));
        const y = i16(unpYS(cell.mapCoords));
        if (r.work.i(r.workIndex(x, y), 14) !== region.id)      // 0x58d4a7
            continue;

        let onBoundary = false;                      // vanilla v16
        for (let dir = 0; dir < 8; ++dir) {          // 0x58d4b7
            const nx = i16(x + DIR_X[dir]!);
            const ny = i16(y + DIR_Y[dir]!);
            if (!r.cellExists(nx, ny))               // 0x58d4d7 - 0x58d4f1
                continue;
            if (r.work.i(r.workIndex(nx, ny), 14) !== region.id)   // 0x58d519
                onBoundary = true;                   // 0x58d51e
        }

        if (onBoundary)
            boundary.push(packXY(x, y));             // 0x58d570
    }

    return boundary;
}

// ---------------------------------------------------------------------------
// SweepRegionBody - sub_58E9B0 - second body pass: drain a worklist built from
// the boundary list sub_58D410 returns, absorbing unassigned neighbours one
// ring at a time. Tests NO tile and NO level - only the unused region mark
// (+56) plus work byte 75.
// ---------------------------------------------------------------------------
export function sweepRegionBody(r: Rmg, region: MapRegion | null): void {
    if (region === null || r.work.count === 0)
        return;

    const side = r.size.workSide;

    const worklist = collectRegionBoundary(r, region);   // 0x58e9ba

    while (worklist.length > 0) {                    // 0x58ea5c
        const cur = worklist.pop()!;                 // 0x58ea6e / 0x58ea7a
        const curX = unpX(cur);
        const curY = unpYS(cur);

        for (let dir = 0; dir < 8; ++dir) {          // 0x58ea9b
            const nx = i16(curX + DIR_X[dir]!);
            const ny = i16(curY + DIR_Y[dir]!);
            if (!r.cellExists(nx, ny))               // 0x58ead2 - 0x58eafc
                continue;

            const wi = r.workIndex(nx, ny);
            if (r.work.i(wi, 14) !== -1)             // 0x58eb15
                continue;
            if (r.work.byte(wi, 75) === 0)           // 0x58eb1b (byte +0x4B)
                continue;

            r.work.setI(wi, 14, region.id);          // 0x58eb29
            worklist.push(packXY(nx, ny));           // 0x58eb71
        }
    }
}

// ---------------------------------------------------------------------------
// AssignRemainingCells - sub_58D010 - assign the cells the seeding pass left
// unassigned; `flag` is written into byte +26 (mergeSettled) of every region
// record produced.
// ---------------------------------------------------------------------------
export function assignRemainingCells(r: Rmg, flag: number): void {
    if (r.work.count === 0)
        return;

    const workCount = r.size.workSide * r.size.workSide;   // 0x58d016
    for (let i = 0; i < workCount; ++i) {                  // 0x58d025
        const packed = r.work.i(i, 0);                     // work[+0]

        if (r.work.i(i, 14) !== -1)                        // 0x58d02c
            continue;
        if (unpX(packed) === 0 && unpY(packed) === 0)
            continue;                                      // 0x58d032 / 0x58d038

        const cell = r.cellAt(i16(unpX(packed)), i16(unpY(packed)));

        const region = buildRegionFromCell(r, cell);       // 0x58d04c
        if (region !== null)
            region.mergeSettled = flag;                    // 0x58d055 (byte +26)
    }
}
