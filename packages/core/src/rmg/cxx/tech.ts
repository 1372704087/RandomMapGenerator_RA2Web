/**
 * Transliteration of G:/MapGenerator MapGenTech.cpp - the "RMG: Adding tech
 * buildings" stage (sub_598960 @ 0x598EBF - 0x598EE4, body sub_5A95B0).
 *
 * The stage slice is a single gated call: skipped entirely for LandType 0
 * (Archipelago); TeamContinent (2) takes Branch A, every other land type
 * Branch B.
 *
 * Module split note: the C++ file contains only AddTechBuildings. The tech
 * subordinates - GiveRegionATechBuilding (sub_595400), FoundationFitsAt,
 * FoundationFitsAtFlat [port-only] and RecordPlacedBuilding - live at the
 * tail of MapGenStartpoint.cpp (0x595400 - 0x5A22xx) and are ported HERE per
 * the cxx/ module assignment. LoadNeutralTechBuildings / LoadMultiplayerHouses
 * (also MapGenStartpoint.cpp) belong to another port and are NOT defined in
 * this module; this code assumes r.neutralTechBuildings is already filled.
 *
 * Branch A - landType 2: rounds n = F2I64(Next() * (3 * kUnitScale)) in
 * {0,1,2}, then n passes over the whole region list handing every region with
 * startingPoints (+0x20) > 0 to GiveRegionATechBuilding.
 *
 * Branch B - other land types: building count n = F2I64(Next() * (5 *
 * kUnitScale)) in {0..4}; per building one type draw from
 * RulesClass::NeutralTechBuildings ("reject > count-1"), then up to 100
 * sampling attempts over random work slots (examined cells capped at 200,
 * overflow gives up with coords (0,0) and still runs the fit test, which can
 * never pass). [port-only] two passes: apron=1 (one flat ring around the
 * foundation, avoids cliff ramps carved by the region stage) first, then the
 * vanilla foundation-only rule as fallback, so the port never places fewer.
 *
 * RNG: one draw for the count, one per building for its type, one per sampled
 * work slot. Nothing else in this stage draws.
 */

import type { Rmg } from './mapGen';
import type { MapRegion } from './types';
import { i16, packXY, unpX, unpYS } from './types';
import { F2I64, K_UNIT_SCALE } from './mathTables';
import { diag } from './diag';
import { isWithinUsableArea } from './makingSub';

/** AltCellFlags_ContainsBuilding (MapGen.h) - the object-chain stand-in. */
const ALT_CONTAINS_BUILDING = 0x2;

/** PassabilityType_Passable / _Beach (values of the mapGen.ts Passability
 * enum; kept literal to avoid a runtime import cycle through mapGen). */
const PT_PASSABLE = 0;
const PT_BEACH = 3;

// ---------------------------------------------------------------------------
// sub_5A95B0 (0x5A95B0 - 0x5A9915)
// ---------------------------------------------------------------------------
export function addTechBuildings(r: Rmg): void {
    if (r.work.count === 0)
        return;

    const landType = r.config.landType;                        // 0x5a95b6

    // 0x598ecf: the stage slice is skipped entirely for LandType_Archipelago
    // (0). Every other land type reaches sub_5A95B0.
    if (landType === 0)
        return;

    // ---- Branch A: TeamContinent (0x5a95bf - 0x5a9626) --------------------
    if (landType === 2) {
        let rounds: number;
        do {
            rounds = F2I64(r.rng.next() * (3.0 * K_UNIT_SCALE));   // 0x5a95df
        }
        while (rounds > 2);                                        // 0x5a95e7

        for (let k = 0; k < rounds; ++k) {                         // 0x5a9626
            // The vanilla re-reads the region array and its count after every
            // call (0x5a9615 / 0x5a961b); GiveRegionATechBuilding never
            // changes either, so a straight pass over the vector is
            // equivalent.
            for (let i = 0; i < r.regions.length; ++i) {           // 0x5a9602
                const region = r.regions[i]!;
                if (region !== null && region.startingPoints > 0)  // +0x20
                    giveRegionATechBuilding(r, region);        // 0x5a9610
            }
        }
        return;
    }

    // ---- Branch B: every other land type (0x5a9630 - 0x5a9908) ------------
    // The vanilla resolves the owner first (HouseClass::FindByCountryIndex of
    // "Neutral", 0x5a9635 / 0x5a9641). It draws no RNG and the port records
    // the fixed owner name in the MapStructure, so nothing to resolve here.

    let count: number;
    do {
        count = F2I64(r.rng.next() * (5.0 * K_UNIT_SCALE));    // 0x5a9665
    }
    while (count > 4);                                         // 0x5a966d

    // Deviation: with no type list there is nothing to draw. The vanilla would
    // index Items[0] of an empty list; the shipped rulesmd.ini always has the
    // list. The count draw above is kept so the RNG stays aligned.
    if (r.neutralTechBuildings.length === 0) {
        diag(`TECH-DIAG enter landType=${landType} types=0 (list empty, returning)`);
        return;
    }

    // ---- [TECH-DIAG] temporary instrumentation: read-only, no behaviour ----
    diag(`TECH-DIAG enter landType=${landType} countDrawn=${count} types=${r.neutralTechBuildings.length}`);
    for (let ti = 0; ti < r.neutralTechBuildings.length; ++ti)
        diag(`TECH-DIAG type[${ti}]=${r.neutralTechBuildings[ti]!.name} ${r.neutralTechBuildings[ti]!.width}x${r.neutralTechBuildings[ti]!.height}`);
    {
        let nPH = 0, nPHSlope = 0, nWater = 0, nOther = 0;
        for (let sy = 0; sy < r.size.workSide; ++sy) {
            for (let sx = 0; sx < r.size.workSide; ++sx) {
                const packed = r.work.i(sx + r.size.workSide * sy, 0);  // MapCoords
                if (packed === 0)
                    continue;
                if (!isWithinUsableArea(r, packed, true))
                    continue;
                const c = r.cellAt(unpX(packed), unpYS(packed));
                const t = c.isoTileTypeIndex;
                if (t === 0 || t === 0xffff) {
                    if (c.slopeIndex !== 0) ++nPHSlope; else ++nPH;
                }
                else if (r.isWaterTile(c)) ++nWater;
                else ++nOther;
            }
        }
        diag(`TECH-DIAG usable cells: phFlat=${nPH} phSlope=${nPHSlope} water=${nWater} other=${nOther}`);

        for (let a = 0; a < r.neutralTechBuildings.length; ++a) {
            const tt = r.neutralTechBuildings[a]!;
            let fits = 0;
            for (let sy = 0; sy < r.size.workSide; ++sy) {
                for (let sx = 0; sx < r.size.workSide; ++sx) {
                    const packed = r.work.i(sx + r.size.workSide * sy, 0);
                    if (packed === 0)
                        continue;
                    const c = r.cellAt(unpX(packed), unpYS(packed));
                    if (!r.isPlaceholderTile(c) || c.slopeIndex !== 0)
                        continue;
                    if (foundationFitsAt(r, packed, c.level, tt.width, tt.height))
                        ++fits;
                }
            }
            diag(`TECH-DIAG feasible anchors ${tt.name} ${tt.width}x${tt.height} = ${fits}`);
        }
    }

    for (let k = 0; k < count; ++k) {                          // 0x5a9908
        // One draw for the building type (0x5a9690 - 0x5a96fd). In the vanilla
        // this is also where the BuildingClass is allocated and constructed.
        const typeCount = r.neutralTechBuildings.length;
        let typeIndex: number;
        do {
            typeIndex = F2I64(r.rng.next() * typeCount * K_UNIT_SCALE);
        }
        while (typeIndex > typeCount - 1);                     // 0x5a96df

        const type = r.neutralTechBuildings[typeIndex]!;

        let placed = false;                                    // v22
        // [TECH-DIAG] failure bookkeeping - 1 object, 2 not-placeholder,
        // 3 level, 4 rock, 5 usable area, 6 work byte +69.
        let gaveUp = 0;
        const rWhy: number[] = [0, 0, 0, 0, 0, 0, 0];
        let attemptsUsed = 0;
        // [port-only] 两道：先要求 1 格平坦围裙（避开刻区域时已经雕好的悬崖
        // 斜坡——实测 rmg_20261003_125504 的建筑虽地基平整，却紧贴 510/513
        // 坡带）；100 次仍找不到再用原版只看地基的规则，保证不少放。
        for (let apronPass = 0; apronPass < 2 && !placed; ++apronPass) {
            const apron = (apronPass === 0) ? 1 : 0;
            for (let attempt = 0; attempt < 100 && !placed; ++attempt) {  // 0x5a9718
                ++attemptsUsed;
                // Sampling (0x5a9726 - 0x5a9786). `examined` is the vanilla's
                // n200: a per-attempt counter of the cells looked at. It is
                // capped at 200, and on overflow the vanilla gives up with
                // coords (0,0) and still runs the fit test - which fails, the
                // (0,0) cell being outside the diamond.
                const slotCount = r.size.workSide * r.size.workSide;
                let coords = 0;                    // CellStruct{0, 0}, packed
                let examined = 0;                  // n200
                let timedOut = false;              // [TECH-DIAG]
                for (;;) {
                    const slot = r.rng.randomFloatRange(0, slotCount - 1);  // 0x5a973a
                    const packed = r.work.i(slot, 0);                       // 0x5a976f
                    if (packed === 0)               // (0,0) slot: no cell
                        continue;                   // 0x5a9750
                    ++examined;                     // 0x5a9765
                    coords = packed;
                    if (examined > 200) {           // 0x5a9773
                        coords = 0;                 // 0x5a979e
                        timedOut = true;            // [TECH-DIAG]
                        break;
                    }
                    if (r.isPlaceholderTile(r.cellAt(unpX(coords), unpYS(coords))))  // 0x5a9786
                        break;
                }
                if (timedOut)
                    ++gaveUp;

                // Fit test (0x5a97c1 - 0x5a987e): the same six clauses
                // sub_595400 uses, over the type's W x H foundation at the
                // sampled cell.
                // [port-only] 第一道再加一圈平坦围裙；第二道退回原版口径。
                const level = r.cellAt(unpX(coords), unpYS(coords)).level;  // 0x5a97c1
                if (foundationFitsAtFlat(r, coords, level,
                    type.width, type.height, apron)) {
                    // Vanilla Unlimbos here and answers 1 (0x5a98c2 / 0x5a98cc).
                    if (apron === 0)
                        diag(`TECH-DIAG building fell back to foundation-only rule: ${type.name}`);
                    recordPlacedBuilding(r, coords, type.name,
                        type.width, type.height);
                    placed = true;
                    ++rWhy[0]!;                     // [TECH-DIAG]
                }
                else {
                    // [TECH-DIAG] classify why the foundation was rejected.
                    let why = 0;
                    for (let row = 0; row < type.height && why === 0; ++row) {
                        for (let col = 0; col < type.width; ++col) {
                            const fx = i16(unpX(coords) + col);
                            const fy = i16(unpYS(coords) + row);
                            const fc = r.cellAt(fx, fy);
                            if ((fc.altFlags & ALT_CONTAINS_BUILDING) !== 0) {
                                why = 1; break;
                            }
                            if (!r.isPlaceholderTile(fc)) { why = 2; break; }
                            if (fc.level !== level) { why = 3; break; }
                            if (fc.landType === 3) { why = 4; break; }
                            if (!isWithinUsableArea(r, packXY(fx, fy), true)) {
                                why = 5; break;
                            }
                            if (r.work.byte(r.workIndex(fx, fy), 69) !== 0) {
                                why = 6; break;
                            }
                        }
                    }
                    ++rWhy[why]!;
                }
            }
        }

        diag(`TECH-DIAG building k=${k} idx=${typeIndex} ${type.name} ${type.width}x${type.height} placed=${placed ? 1 : 0} attempts=${attemptsUsed} gaveUp=${gaveUp} why[ok=${rWhy[0]} obj=${rWhy[1]} tile=${rWhy[2]} lvl=${rWhy[3]} rock=${rWhy[4]} area=${rWhy[5]} mark=${rWhy[6]}]`);

        // A failed run leaves nothing behind: the vanilla deletes the
        // BuildingClass (0x5a98fc), the port never created one. The type was
        // drawn before the attempts either way.
    }

    diag(`TECH-DIAG branchB done, structures on ledger=${r.structures.length}`);
}

// ---------------------------------------------------------------------------
// sub_595400 - the zero-share fallback: pick a random entry of
// RulesClass::NeutralTechBuildings, then try up to 100 times to drop it on a
// random cell of the region, answering true when one attempt worked. The
// vanilla creates a live BuildingClass and Unlimbos it; the port takes the
// same route B as the bridge repair hut and appends a MapStructure (owner
// "Neutral", facing North) instead. Callers ignore the answer.
//
//   1. one type draw, F2I64(Next() * count * kUnitScale), reject > count-1.
//   2. Up to 100 attempts (x2 with the [port-only] apron rule). Each attempt
//      draws one cell of the region (same formula, one draw), takes that
//      cell's Level and runs the fit test.
//   3. All attempts failed -> answer 0. (The caller ignores the answer.)
//
// Deviation: when the rules INI (or its [General] list) is missing the port
// has no type to draw, so it answers 0 WITHOUT consuming the type draw. The
// shipped rulesmd.ini always has the list.
// (C++ source: MapGenStartpoint.cpp, 0x595400 - 0x595647.)
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
    }
    while (typeIndex > typeCount - 1);

    const type = r.neutralTechBuildings[typeIndex]!;

    // ---- 2. up to 100 attempts (0x5954bb - 0x595647) ----------------------
    // [port-only] 先要求 1 格平坦围裙（避开刻区域阶段已存在的悬崖斜坡）；100
    // 次都找不到再用原版仅看地基的规则兜底，保证不比原版少放建筑。
    const cellCount = region.cells.length;
    for (let pass = 0; pass < 2; ++pass) {
        const apron = (pass === 0) ? 1 : 0;
        for (let attempt = 0; attempt < 100; ++attempt) {
            let index: number;
            do {
                index = F2I64(r.rng.next() * cellCount * K_UNIT_SCALE);
            }
            while (index > cellCount - 1);

            const cell = region.cells[index]!;                 // packed
            const level = r.cellAt(unpX(cell), unpYS(cell)).level;  // 0x595522

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
//
// The vanilla walks the cell list BuildingTypeClass::GetFoundationData answers
// and rejects the position on the first bad cell:
//     pCell->FirstObject                  -> an object is in the way
//     !sub_486380(pCell)                  -> not a placeholder tile
//     pCell->Level != anchorLevel         -> a different layer
//     pCell->LandType == LandType_Rock
//     !IsWithinUsableArea_2(pCell, true)
//     work[cell + 69]                     -> the cliff / shore protection mark
//
// Two mappings to note:
//   - FirstObject: the port has no object chain, so this is
//     AltCellFlags_ContainsBuilding - the same stand-in
//     CreateNeutralBridgeRepairHut uses.
//   - the cell list: the port walks the type's W x H rectangle anchored at the
//     position cell - (col, row), col in [0, W), row in [0, H) - which is what
//     the engine's table holds (sub_45B1C0 fills it row-major from (0,0)).
// (C++ source: MapGenStartpoint.cpp.)
// ---------------------------------------------------------------------------
export function foundationFitsAt(r: Rmg, base: number, level: number,
                                 width: number, height: number): boolean {
    const side = r.size.workSide;

    for (let row = 0; row < height; ++row) {
        for (let col = 0; col < width; ++col) {
            const x = i16(unpX(base) + col);
            const y = i16(unpYS(base) + row);

            const cell = r.cellAt(x, y);
            if ((cell.altFlags & ALT_CONTAINS_BUILDING) !== 0)
                return false;
            if (!r.isPlaceholderTile(cell))                    // 0x5955a6 sub_486380
                return false;
            if (cell.level !== level)                          // 0x5955b5
                return false;
            if (cell.landType === 3)                           // 0x5955bf LandType_Rock
                return false;
            if (!isWithinUsableArea(r, packXY(x, y), true))    // 0x5955c8
                return false;
            if (r.work.byte(r.workIndex(x, y), 69) !== 0)      // 0x5955d6
                return false;
        }
    }
    return true;
}

// ---------------------------------------------------------------------------
// FoundationFitsAtFlat [port-only]
//
// Vanilla fit on the foundation itself, plus every cell of an apron around it
// must be in the diamond, flat, land-walkable and at the same Level. Region
// ramps / cliff facades are slope tiles (SlopeIndex != 0) or non-walkable, so
// a building site wedged right against an existing ramp is rejected here.
// Already-tiled FLAT ground (the region body fills many cells with real clear
// textures, e.g. tiles 131/140) is accepted - only the tile kind matters, not
// whether it is still the placeholder. The usable-area / Rock / +69 / object
// clauses stay scoped to the foundation itself.
// (C++ source: MapGenStartpoint.cpp.)
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
            // Same elevation, no ramp tile, and land (plain or beach) only:
            // water / impassable cliff facades / outside cells keep the
            // building art away from slopes and shorelines.
            if (ring.level !== level || ring.slopeIndex !== 0)
                return false;
            if (ring.passability !== PT_PASSABLE
                && ring.passability !== PT_BEACH)
                return false;
        }
    }
    return true;
}

// ---------------------------------------------------------------------------
// Route B placement shared by sub_595400 and sub_5A95B0.
//
// Vanilla ends a successful placement with Unlimbo, which threads the new
// BuildingClass onto the object chain of EVERY foundation cell - that is what
// makes the FirstObject clause of FoundationFitsAt reject a later building
// that overlaps it. The port has no object chain, so each foundation cell of
// the W x H rectangle takes the same AltCellFlags_ContainsBuilding stand-in
// CreateNeutralBridgeRepairHut uses, and the building itself is appended to
// structures_ (the .map [Structures] source; see MapStructure).
// (C++ source: MapGenStartpoint.cpp.)
// ---------------------------------------------------------------------------
export function recordPlacedBuilding(r: Rmg, base: number, typeName: string,
                                     width: number, height: number): void {
    r.structures.push({
        coords: base,             // packed
        typeName,
        houseName: 'Neutral House',
        facing: 0,                // DirType_North
    });

    for (let row = 0; row < height; ++row) {
        for (let col = 0; col < width; ++col) {
            r.cellAt(i16(unpX(base) + col), i16(unpYS(base) + row)).altFlags
                |= ALT_CONTAINS_BUILDING;
        }
    }
}
