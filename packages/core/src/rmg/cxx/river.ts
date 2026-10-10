/**
 * Transliteration of G:/MapGenerator MapGenRiver.cpp - river / water-body
 * subsystem of the random map generator (class methods become free functions
 * taking `r: Rmg` as the C++ `this`).
 *
 *   generateRiver        sub_59D510   river carving + post-processing chain
 *   rollbackRiver        LABEL_151    failed-river rollback
 *   findCandidateCenter  sub_5A08D0   candidate search / front growth
 *   generateDelta        sub_59E740   river-mouth delta fan
 *   smoothWaterBody      sub_57A0C0   four-pass water smoothing
 *   resetPreviewState    sub_4A8BF0   foundation preview reset
 *   markFoundation       sub_4A95A0   foundation footprint marking
 *   tileNeighbourMask    sub_57B210   8-direction connectivity mask
 *   floodFill            sub_57A430   smoothing pass 1
 *   cleanupTile          sub_57A320   smoothing pass 2
 *   selectShoreTile      sub_57ACF0   smoothing passes 3 / 4
 *   setFoundationCenter  sub_4A91B0   foundation-preview center move
 *   placeIsoTile         sub_57B440   isotile foundation stamping
 *   buildWaterRing       sub_5A0700   ring 0 of a water body
 *   isWaterFamilyTile    sub_4865D0   water / shore tile family test
 *   expandWaterBody      sub_5A0160   ring expansion / absorption
 *   decorateWaterTiles   sub_59C630   whole-map water-detail pass
 *   placeWaterDetailTile sub_5A6C10   water detail tile stamping
 *   loadTheaterTiles     [General] tile-range snapshots of sub_545150
 *   repairCliffPieces / cliffCellsInX / isRampArtCell / isBigRampPiece /
 *   isCliffWallRiding / cliffPieceHitsRamp / trimCliffPieceForRamp
 *
 * GenerateLake (sub_59C920) lives in lake.ts and is re-exported here because
 * MapGen.cpp's pipeline imports it from this module in the TS port.
 */

import type { Rmg } from './mapGen';
import {
    Box,
    CellIterator,
    DIR_X,
    DIR_Y,
    MapCell,
    i16,
    packXY,
    unpX,
    unpYS,
} from './types';
import { diag, f3, f4, x2 } from './diag';
import { F2I64, K_UNIT_SCALE, tableAtan } from './mathTables';
import { atoiPrefix, profileInt, profileString, profileSectionNames } from './winapi';
import { generateLake } from './lake';

export { generateLake };

// ---------------------------------------------------------------------------
// IsoFootprint - footprint of one isotile: the foundation size, the occupied
// cells (bit (row * w + col)) and the per-cell Z offsets (frame+0x28) of the
// OCCUPIED cells in row-major order (empty cells contribute no entry, so the
// Z array is indexed by the occupied-cell counter; C++ zero-fills the rest).
// ---------------------------------------------------------------------------
interface IsoFootprint {
    w: number;
    h: number;
    mask: number;
    z: number[];
}

/** Bit `b` of a >32-bit footprint mask (masks reach 2^49, exact in doubles). */
const maskBit = (mask: number, b: number): boolean =>
    Math.floor(mask / 2 ** b) % 2 === 1;

// 42 entries, k = tile - r.shorePieces (shore01 .. shore42). Tiles 41 and 42
// are the two irregular pieces; all the others are full rectangles. The whole
// shore set has Z = 0 on every cell, so the Z arrays stay empty.
const kShoreFootprints: IsoFootprint[] = [
    { w: 2, h: 2, mask: 0xf, z: [] }, { w: 2, h: 2, mask: 0xf, z: [] }, { w: 2, h: 2, mask: 0xf, z: [] },
    { w: 1, h: 2, mask: 0x3, z: [] }, { w: 2, h: 3, mask: 0x3f, z: [] }, { w: 2, h: 3, mask: 0x3f, z: [] },
    { w: 2, h: 2, mask: 0xf, z: [] }, { w: 2, h: 2, mask: 0xf, z: [] }, { w: 2, h: 2, mask: 0xf, z: [] },
    { w: 2, h: 2, mask: 0xf, z: [] }, { w: 2, h: 2, mask: 0xf, z: [] }, { w: 2, h: 1, mask: 0x3, z: [] },
    { w: 3, h: 2, mask: 0x3f, z: [] }, { w: 3, h: 2, mask: 0x3f, z: [] }, { w: 2, h: 2, mask: 0xf, z: [] },
    { w: 2, h: 2, mask: 0xf, z: [] }, { w: 2, h: 2, mask: 0xf, z: [] }, { w: 2, h: 2, mask: 0xf, z: [] },
    { w: 2, h: 2, mask: 0xf, z: [] }, { w: 1, h: 2, mask: 0x3, z: [] }, { w: 2, h: 3, mask: 0x3f, z: [] },
    { w: 2, h: 3, mask: 0x3f, z: [] }, { w: 2, h: 2, mask: 0xf, z: [] }, { w: 2, h: 2, mask: 0xf, z: [] },
    { w: 2, h: 2, mask: 0xf, z: [] }, { w: 2, h: 2, mask: 0xf, z: [] }, { w: 2, h: 2, mask: 0xf, z: [] },
    { w: 2, h: 1, mask: 0x3, z: [] }, { w: 3, h: 2, mask: 0x3f, z: [] }, { w: 3, h: 2, mask: 0x3f, z: [] },
    { w: 2, h: 2, mask: 0xf, z: [] }, { w: 2, h: 2, mask: 0xf, z: [] }, { w: 2, h: 2, mask: 0xf, z: [] },
    { w: 2, h: 2, mask: 0xf, z: [] }, { w: 2, h: 2, mask: 0xf, z: [] }, { w: 2, h: 2, mask: 0xf, z: [] },
    { w: 2, h: 2, mask: 0xf, z: [] }, { w: 2, h: 2, mask: 0xf, z: [] }, { w: 2, h: 2, mask: 0xf, z: [] },
    { w: 2, h: 2, mask: 0xf, z: [] }, { w: 6, h: 4, mask: 0xffffce, z: [] },
    { w: 9, h: 5, mask: 0x1feff7fc380c, z: [] },
];

// Waterfall pieces - generateDelta's river-mouth dressing. Family order
// matches the delta's direction switch and the nIdx_0..3 mapping:
// [0] East = W-b-, [1] West = W-d-, [2] South = W-a-, [3] North = W-c-.
// The four pieces are -01 .. -04, -02 being the thin one.
const kWaterfallFootprints: IsoFootprint[][] = [
    [   // [0] East - W-b-
        { w: 4, h: 2, mask: 0xff, z: [4, 4, 0, 0, 4, 4, 0, 0] },
        { w: 4, h: 1, mask: 0xf, z: [4, 4, 0, 0] },
        { w: 4, h: 2, mask: 0xff, z: [4, 4, 0, 0, 4, 4, 0, 0] },
        { w: 4, h: 2, mask: 0xff, z: [4, 4, 0, 0, 4, 4, 0, 0] },
    ],
    [   // [1] West - W-d-
        { w: 2, h: 2, mask: 0xf, z: [4, 4, 4, 4] },
        { w: 2, h: 1, mask: 0x3, z: [4, 4] },
        { w: 2, h: 2, mask: 0xf, z: [4, 4, 4, 4] },
        { w: 2, h: 2, mask: 0xf, z: [4, 4, 4, 4] },
    ],
    [   // [2] South - W-a-
        { w: 2, h: 4, mask: 0xff, z: [4, 4, 4, 4, 0, 0, 0, 0] },
        { w: 1, h: 4, mask: 0xf, z: [4, 4, 0, 0] },
        { w: 2, h: 4, mask: 0xff, z: [4, 4, 4, 4, 0, 0, 0, 0] },
        { w: 2, h: 4, mask: 0xff, z: [4, 4, 4, 4, 0, 0, 0, 0] },
    ],
    [   // [3] North - W-c-
        { w: 2, h: 2, mask: 0xf, z: [4, 4, 4, 4] },
        { w: 1, h: 2, mask: 0x3, z: [4, 4] },
        { w: 2, h: 2, mask: 0xf, z: [4, 4, 4, 4] },
        { w: 2, h: 2, mask: 0xf, z: [4, 4, 4, 4] },
    ],
];

// Cliff set - 40 pieces, k = tile - r.shoreTileIndex (CliffSet). Measured from
// the released cliff01 .. cliff40 tiles.
// [EXE-MATCH] table @0x14005E8A8 in the oracle exe (40B/slot: w,h,mask u64,z[16])
// - the drifted text's first entry was wrong, shifting every slot by one.
// Cliff set - 40 pieces, k = tile - r.shoreTileIndex (CliffSet).
// [EXE-MATCH] extracted from the oracle exe .rdata @0x14005E8A8 (40B/slot:
// w, h, mask u64, z[16]) with the +1 slot offset the exe's callers use -
// the drifted text's table had a wrong first entry shifting every slot.
const kCliffFootprints: IsoFootprint[] = [
    { w: 2, h: 3, mask: 0x2d, z: [4, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff01
    { w: 1, h: 2, mask: 0x3, z: [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff02
    { w: 2, h: 3, mask: 0x2d, z: [4, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff03
    { w: 2, h: 3, mask: 0x2d, z: [4, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff04
    { w: 2, h: 2, mask: 0xf, z: [4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff05
    { w: 2, h: 2, mask: 0xf, z: [4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff06
    { w: 2, h: 2, mask: 0xf, z: [4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff07
    { w: 1, h: 2, mask: 0x3, z: [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff08
    { w: 2, h: 2, mask: 0x7, z: [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff09
    { w: 2, h: 2, mask: 0x7, z: [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff10
    { w: 2, h: 2, mask: 0x7, z: [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff11
    { w: 1, h: 1, mask: 0x1, z: [0] },        // cliff12
    { w: 1, h: 1, mask: 0x1, z: [0] },        // cliff13
    { w: 1, h: 1, mask: 0x1, z: [0] },        // cliff14
    { w: 2, h: 2, mask: 0xf, z: [4, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff15
    { w: 2, h: 2, mask: 0xf, z: [4, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff16
    { w: 2, h: 2, mask: 0xf, z: [4, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff17
    { w: 2, h: 1, mask: 0x3, z: [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff18
    { w: 3, h: 2, mask: 0x33, z: [4, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff19
    { w: 3, h: 2, mask: 0x33, z: [4, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff20
    { w: 3, h: 2, mask: 0x33, z: [4, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff21
    { w: 2, h: 1, mask: 0x3, z: [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff22
    { w: 2, h: 1, mask: 0x3, z: [4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff23
    { w: 2, h: 1, mask: 0x3, z: [4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff24
    { w: 2, h: 1, mask: 0x3, z: [4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff25
    { w: 1, h: 1, mask: 0x1, z: [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff26
    { w: 2, h: 2, mask: 0x7, z: [4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff27
    { w: 2, h: 2, mask: 0xe, z: [4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff28
    { w: 1, h: 1, mask: 0x1, z: [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff29
    { w: 1, h: 1, mask: 0x1, z: [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff30
    { w: 2, h: 2, mask: 0x7, z: [4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff31
    { w: 2, h: 2, mask: 0xe, z: [4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff32
    { w: 1, h: 1, mask: 0x1, z: [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff33
    { w: 1, h: 1, mask: 0x1, z: [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff34
    { w: 1, h: 2, mask: 0x3, z: [4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff35
    { w: 1, h: 2, mask: 0x3, z: [4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff36
    { w: 1, h: 2, mask: 0x3, z: [4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff37
    { w: 1, h: 1, mask: 0x1, z: [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff38
    { w: 1, h: 1, mask: 0x1, z: [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff39
    { w: 1, h: 1, mask: 0x1, z: [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },        // cliff40
];

// Cliff/Water pieces - 28, k = tile - r.waterCliffsIndex (WaterCliffs).
const kCliffWaterFootprints: IsoFootprint[] = [
    { w: 2, h: 3, mask: 0x2d, z: [4, 0, 4, 0] },        // wcliff01
    { w: 1, h: 2, mask: 0x3, z: [4, 0] },               // wcliff02
    { w: 2, h: 3, mask: 0x2d, z: [4, 0, 4, 0] },        // wcliff03
    { w: 2, h: 3, mask: 0x2d, z: [4, 0, 4, 0] },        // wcliff04
    { w: 2, h: 2, mask: 0xf, z: [4, 4, 0, 0] },         // wcliff05
    { w: 2, h: 2, mask: 0xf, z: [4, 4, 0, 0] },         // wcliff06
    { w: 2, h: 2, mask: 0xf, z: [4, 4, 0, 0] },         // wcliff07
    { w: 1, h: 2, mask: 0x3, z: [4, 0] },               // wcliff08
    { w: 2, h: 2, mask: 0x7, z: [4, 0, 0] },            // wcliff09
    { w: 2, h: 2, mask: 0xf, z: [4, 0, 0, 0] },         // wcliff10
    { w: 2, h: 2, mask: 0x7, z: [4, 0, 0] },            // wcliff11
    { w: 1, h: 1, mask: 0x1, z: [0] },                  // wcliff12
    { w: 1, h: 1, mask: 0x1, z: [0] },                  // wcliff13
    { w: 1, h: 1, mask: 0x1, z: [0] },                  // wcliff14
    { w: 2, h: 2, mask: 0xf, z: [4, 0, 4, 0] },         // wcliff15
    { w: 2, h: 2, mask: 0xf, z: [4, 0, 4, 0] },         // wcliff16
    { w: 2, h: 2, mask: 0xf, z: [4, 0, 4, 0] },         // wcliff17
    { w: 2, h: 1, mask: 0x3, z: [4, 0] },               // wcliff18
    { w: 3, h: 2, mask: 0x33, z: [4, 0, 4, 0] },        // wcliff19
    { w: 3, h: 2, mask: 0x33, z: [4, 0, 4, 0] },        // wcliff20
    { w: 3, h: 2, mask: 0x33, z: [4, 0, 4, 0] },        // wcliff21
    { w: 2, h: 1, mask: 0x3, z: [4, 0] },               // wcliff22
    { w: 2, h: 3, mask: 0x3d, z: [4, 0, 4, 0, 0] },     // wcliff23
    { w: 1, h: 3, mask: 0x7, z: [0, 0, 0] },            // wcliff24
    { w: 3, h: 1, mask: 0x7, z: [0, 0, 0] },            // wcliff25
    { w: 2, h: 2, mask: 0xf, z: [4, 0, 0, 0] },         // wcliff26
    { w: 2, h: 2, mask: 0xf, z: [4, 0, 0, 0] },         // wcliff27
    { w: 3, h: 2, mask: 0x37, z: [4, 0, 0, 4, 0] },     // wcliff28
];

// Destroyable Cliffs - 2, k = tile - r.destroyableCliffsIndex.
const kDestroyableCliffFootprints: IsoFootprint[] = [
    {
        w: 6, h: 4, mask: 0x7bffde,
        z: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],   // dcliff01
    },
    {
        w: 4, h: 6, mask: 0x6ffff6,
        z: [4, 0, 4, 4, 0, 0, 4, 4, 0, 0, 4, 4, 0, 0, 4, 4, 0, 0, 4, 0],   // dcliff02
    },
];

// The eight water-detail pieces (waterTileIndex + 0..7): plain 2x2
// rectangles with Z = 0 on every cell.
const k2x2Footprint: IsoFootprint = { w: 2, h: 2, mask: 0xf, z: [] };

// TileSet0025 is BOTH [General] SlopeSetPieces and CliffRamps - the
// multi-cell cliff-ramp pieces every RampBuilder1..7 stamps. Measured
// straight out of the TMPs - grid, non-empty sub-cell mask and each
// occupied cell's frame[+0x28] z.
const kSlopeSetPieceFootprints: IsoFootprint[] = [
    { w: 3, h: 4, mask: 0xdfe, z: [3, 3, 4, 3, 2, 0, 0, 1, 0, 0] }, // ramp01 .##/###/###/.##
    { w: 3, h: 4, mask: 0x7fb, z: [3, 3, 2, 3, 4, 1, 0, 0, 0, 0] }, // ramp02 ##./###/###/##.
    { w: 4, h: 3, mask: 0x6ff, z: [3, 2, 1, 0, 3, 3, 0, 0, 4, 0] }, // ramp03 ####/####/.##.
    { w: 4, h: 3, mask: 0xff6, z: [4, 0, 3, 3, 0, 0, 3, 2, 1, 0] }, // ramp04 .##./####/####
    { w: 3, h: 4, mask: 0xdfe, z: [0, 0, 0, 0, 1, 4, 3, 2, 3, 3] }, // ramp05 .##/###/###/.##
    { w: 3, h: 4, mask: 0x27b, z: [0, 0, 1, 0, 0, 2, 3] },          // ramp06 ##./###/#../#..
    { w: 2, h: 2, mask: 0x7, z: [3, 4, 3] },                        // ramp07 ##/#.
    { w: 4, h: 3, mask: 0xff6, z: [0, 4, 0, 0, 3, 3, 0, 1, 2, 3] }, // ramp08 .##./####/####
    { w: 4, h: 3, mask: 0x23f, z: [0, 1, 2, 3, 0, 0, 0] },          // ramp09 ####/##../.#..
    { w: 2, h: 2, mask: 0x7, z: [3, 3, 4] },                        // ramp10 ##/#.
];

// The two 42-entry variant tables placeIsoTile consults when an existing
// shore piece and the one being placed share a cell: kShoreVariantSide
// ("side" id per shore variant) and kShoreVariantTurn (turn id), both
// read straight out of the image.
const kShoreVariantSide: number[] = [
    0, 0, 0, 1, 2, 3, 4, 4, 5, 5, 5, 6, 7, 8, 9, 9, 10, 10, 10, 11, 12,
    13, 14, 14, 15, 15, 15, 16, 17, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23,
    23, 24, 25,
];
const kShoreVariantTurn: number[] = [
    4, 4, 4, 4, 4, 4, 3, 3, 2, 2, 2, 2, 2, 2, 1, 1, 0, 0, 0, 0, 0,
    0, 7, 7, 6, 6, 6, 6, 6, 6, 5, 5, 3, 3, 1, 1, 7, 7, 5, 5, 4, 4,
];

// Family bases for the gate helpers below (all filled from the theater INI;
// -1 = the key was missing, which the helpers treat as "family absent").
interface TileFamilyBases {
    cliff: number;          // CliffSet          (40 wide)
    waterCliffs: number;    // WaterCliffs       (28 wide)
    destroyable: number;    // DestroyableCliffs  (2 wide)
    ramps: number;          // CliffRamps        (20 wide)
    caves: number;          // WaterCaves         (4 wide)
    bridge: number;         // BridgeSet         (16 wide)
    woodBridge: number;     // WoodBridgeSet     (16 wide)
    waterfall: number[];    // East, West, South, North (4 each)
}

const tileFamilyBases = (r: Rmg): TileFamilyBases => ({
    cliff: r.shoreTileIndex,
    waterCliffs: r.waterCliffsIndex,
    destroyable: r.destroyableCliffsIndex,
    ramps: r.cliffRampsIndex,
    caves: r.waterCavesIndex,
    bridge: r.bridgeSetIndex,
    woodBridge: r.woodBridgeSetIndex,
    waterfall: [r.waterFamily4Base[0]!, r.waterFamily4Base[1]!, r.waterFamily4Base[2]!, r.waterFamily4Base[3]!],
});

// ---------------------------------------------------------------------------
// GenerateRiver - sub_59D510 river carving (one attempt).
// ---------------------------------------------------------------------------
export function generateRiver(r: Rmg, startXY: Box<number>, initialAngle: number,
                              isTributary: boolean): boolean {
    // Entry snapshot of the tributary flag: the 5.6 post-processing gate
    // reads THIS value, not the live parameter.
    const enteredAsTributary = isTributary;

    let start = 0;   // packed start cell, low16 = X, high16 = Y
    let angle: number; // current flow direction theta (radians)

    if (startXY.v !== 0) {
        // Specified-start branch (tributary recursion, 0x59d7f3).
        start = startXY.v;
        angle = initialAngle;
    } else {
        // ---- Automatic mode: random edge start (0x59d556 - 0x59d7e2) ----
        const W = r.size.mapWidth;
        const H = r.size.mapHeight;

        // (1) Pick one of the four diamond edges, edge in [0, 3].
        const edge = r.rng.randomFloatRange(0, 3);

        // (2) Two free edge parameters, both drawn unconditionally.
        const u = r.rng.randomFloatRange(0, W - 1);
        const v = r.rng.randomFloatRange(0, H - 1);

        // (3) Start cell from the 4-entry candidate table.
        switch (edge) {
            case 0: start = ((u + 1) | ((W - u) << 16)) | 0; break;
            case 1: start = ((W + H - 1 - v) | ((H - v) << 16)) | 0; break;
            case 2: start = ((W + H - 1 - u) | ((H + u) << 16)) | 0; break;
            default: start = ((v + 1) | ((W + v) << 16)) | 0; break;
        }

        // (4) Edge inward base angle: thetaEdge = 7*pi/4 - edge * pi/2.
        const thetaEdge = 5.497787143782138 - edge * 1.5707963267948966;

        // (5) Initial flow angle: gaussian rejection sampling inside
        //     [thetaEdge - pi/4, thetaEdge + pi/4], sigma = pi/6.
        let lo = thetaEdge - 0.7853981633974483;
        let hi = thetaEdge + 0.7853981633974483;
        let sigma = 0.5235987755982988;
        let center = thetaEdge;
        if (center - sigma > hi || center + sigma < lo) {
            sigma = (hi - lo) * 0.5;
            center = sigma + lo;
        }
        do {
            do {
                angle = r.rng.gaussian() * sigma + center;
            } while (angle < lo);
        } while (angle > hi);
    }

    // Start cell must be a valid diamond cell; outside -> the attempt fails.
    if (!r.cellExists(start & 0xffff, start >>> 16))
        return false;

    // ---- River width (0x59d84f - 0x59d8b6) ----
    let maxWidthF = r.waterAmount * 0.07;
    if (maxWidthF < 1.0)
        maxWidthF = 1.0;
    const maxWidth = F2I64(maxWidthF);
    const width = r.rng.randomFloatRange(1, maxWidth);

    // ---- Target length in [35, 125] cells ----
    const targetLength = r.rng.randomFloatRange(35, 125);

    diag(`RIVER g=${r.genCode} start=(${start & 0xffff},${start >>> 16}) angle=${f3(angle)} width=${width} target=${targetLength} tributary=${isTributary ? 1 : 0}`);

    // ---- Pre-loop state (0x59d940 - 0x59d9a3) ----
    const theta0 = angle;
    let curWidth = width; // lives as a double (width jitter adds gaussian deltas)
    let cx = (start & 0xffff) + 0.5;
    let cy = (start >>> 16) + 0.5;
    const angleLo = theta0 - 1.5707963267948966;
    const angleHi = theta0 + 1.5707963267948966;
    // Integer-division half: w0 = 5 gives [3, 7]. widthHalf doubles as the
    // step-7 gate (w0 >= 2 - a width-1 river never jitters).
    const widthHalf = Math.trunc(width / 2);
    const widthLo = curWidth - widthHalf;
    const widthHi = curWidth + widthHalf;

    let alive = true;
    let steps = 0;
    let termRand = 1.0;
    let deltaCount = 0;

    // ---- Main loop (0x59d9a3 - 0x59e18d) ----
    do {
        // (1) Center diamond check.
        if (!r.cellExists(F2I64(cx), F2I64(cy)) || !alive)
            break;

        // (2) Cross-section carve: one row of cells perpendicular to the flow.
        const sinT = Math.sin(angle);
        const cosT = Math.cos(angle);
        const count = F2I64(curWidth + 0.5);

        let px = cx - (count - 1) * sinT * 0.5;
        let py = cy - (count - 1) * cosT * 0.5;

        // Per-section collinearity flags: still set after the section means
        // every carved cell shared one F2I64 coordinate.
        let xCollinear = true;
        let yCollinear = true;

        for (let i = count; i > 0; --i) {
            const X = F2I64(px);
            const Y = F2I64(py);

            if (r.cellExists(X, Y)) {
                const wi = X + r.size.workSide * Y;
                const cell = r.cellSlots[512 * Y + X]!;
                const mark = r.work.i(wi, 14);

                let carve: boolean;
                if (mark === 0) {
                    // Free cell: carvable only while the tile is still plain
                    // land (sub_486380: IsoTileTypeIndex 0 or 0xFFFF).
                    const tile = cell.isoTileTypeIndex;
                    carve = tile === 0 || tile === 0xffff;
                } else {
                    carve = mark === r.genCode; // own pass: re-carve
                }

                if (carve) {
                    r.work.setI(wi, 14, r.genCode);
                    cell.height = 0;
                    cell.isoTileTypeIndex = r.waterTileIndex;
                } else {
                    // Another (older) water pass -> pollution; the whole
                    // attempt fails, but the rest of this cross-section is
                    // still carved.
                    diag(`RIVER-POLLUTE step=${steps} cell=(${X},${Y}) mark=${mark}`);
                    alive = false;
                }
            }

            px += sinT;
            py += cosT;
            if (F2I64(px) !== X) xCollinear = false;
            if (F2I64(py) !== Y) yCollinear = false;
        }

        // Post-section collinearity resolve: the flag on the section's
        // dominant axis is always dropped.
        if (Math.abs(sinT) >= Math.abs(cosT))
            xCollinear = false;
        else
            yCollinear = false;

        // (3) River-mouth delta trigger (0x59dca1 - 0x59de18): no RNG.
        if (!isTributary && (xCollinear || yCollinear) && deltaCount < 1) {
            // Angle-drift gate: the drift is truncated to an integer first,
            // so the effective gate is |angle - theta0| < 1 radian.
            if (Math.abs(F2I64(angle - theta0)) < 0.7853981633974483
                && r.random25Flag
                && steps > targetLength) {
                // Fan heading: quantize the flow direction onto the cardinal
                // axis of the surviving flag.
                const direction = xCollinear
                    ? (cosT <= 0.0 ? 6 : 2)
                    : (sinT <= 0.0 ? 4 : 0);

                const endX = F2I64(px - sinT);   // last section cell
                const endY = F2I64(py - cosT);
                const startX = F2I64(cx - (count - 1) * sinT * 0.5);
                const startY = F2I64(cy - (count - 1) * cosT * 0.5);

                const deltaOk: Box<boolean> = { v: false };
                const mouthX: Box<number> = { v: cx };
                const mouthY: Box<number> = { v: cy };
                generateDelta(r, r.genCode,
                    ((startX & 0xffff) | ((startY & 0xffff) << 16)) | 0,
                    ((endX & 0xffff) | ((endY & 0xffff) << 16)) | 0,
                    direction, deltaOk, mouthX, mouthY);
                cx = mouthX.v;
                cy = mouthY.v;

                if (deltaOk.v) {
                    ++deltaCount;
                    ++r.genCode; // fresh code for the continued channel
                }
            }
        }

        // (4) Center advance: one cell-step along the flow.
        cx += cosT;
        cy -= sinT;

        // (5) Tributary fork. The Random() roll is consumed EVERY step,
        //     before the 1% gate.
        const forkRoll = r.rng.unit();
        if (forkRoll < 0.01 && alive && !isTributary && deltaCount === 0) {
            // Demote this river: after one fork it can neither fork again
            // nor place a delta.
            isTributary = true;

            // Branch angle window: center = theta + pi/2, [theta + pi/6,
            // theta + 5*pi/6], sigma = pi/6.
            let branchCenter = angle + 1.5707963267948966;
            let branchLo = angle + 0.5235987755982988;
            let branchHi = angle + 2.6179938779914944;
            let branchSigma = 0.5235987755982988;

            // Degenerate-window fallback (unreachable, kept verbatim).
            if (branchCenter - branchSigma > branchHi
                || branchCenter + branchSigma < branchLo) {
                branchSigma = (branchHi - branchLo) * 0.5;
                branchCenter = branchSigma + branchLo;
            }

            let branchAngle: number;
            do {
                do {
                    branchAngle = r.rng.gaussian() * branchSigma + branchCenter;
                } while (branchAngle < branchLo);
            } while (branchAngle > branchHi);

            // F2I64 of the raw post-walk section coordinates - one full step
            // PAST the last carved cell. Packed through 16-bit words.
            const branchStart = ((F2I64(px) & 0xffff) | ((F2I64(py) & 0xffff) << 16)) | 0;

            // The return value OVERWRITES the alive flag: a failed tributary
            // poisons the main river, a successful one leaves it running.
            alive = generateRiver(r, { v: branchStart }, branchAngle, true);
            diag(`RIVER-FORK step=${steps} start=(${branchStart & 0xffff},${branchStart >>> 16}) angle=${f3(branchAngle)} result=${alive ? 1 : 0}`);
        }

        // (6) Angle jitter: once more than 5 cells have been advanced, every
        //     step adds a gaussian delta to the flow angle (sigma = pi/10,
        //     rejection-clamped into theta0 +/- pi/2).
        if (steps > 5) {
            const relHi = angleHi - angle;
            const relLo = angleLo - angle;
            let sigma = 0.3141592653589793;
            let center = 0.0;

            if (relHi < -0.3141592653589793 || relLo > 0.3141592653589793) {
                sigma = (relHi - relLo) * 0.5;
                center = sigma + relLo;
            }

            let jitter: number;
            do {
                do {
                    jitter = r.rng.gaussian() * sigma + center;
                } while (jitter < relLo);
            } while (jitter > relHi);
            angle += jitter;
        }

        // (7) Width jitter: sigma = 0.5 around the CURRENT width, clamped by
        //     rejection into the FIXED init-time bounds. Gate: widthHalf > 0.
        if (widthHalf > 0) {
            const relHi = widthHi - curWidth;
            const relLo = widthLo - curWidth;
            let sigma = 0.5;
            let center = 0.0;

            if (relHi < -0.5 || relLo > 0.5) {
                sigma = (relHi - relLo) * 0.5;
                center = sigma + relLo;
            }

            let jitter: number;
            do {
                do {
                    jitter = r.rng.gaussian() * sigma + center;
                } while (jitter < relLo);
            } while (jitter > relHi);
            curWidth += jitter;
        }

        // (8) Natural termination roll: 0.5% chance per step.
        termRand = r.rng.unit();
        ++steps;
    } while (termRand >= 0.005);

    diag(`RIVER-END steps=${steps} alive=${alive ? 1 : 0} term=${f4(termRand)}`);

    // ---- 5.5 Exit gates + terminal lake (0x59e1a2 - 0x59e235) ----
    if (steps < 40)
        alive = false;

    // Terminal lake: natural termination only. The lake itself is
    // GenerateLake (sub_59C920), seeded with the river-mouth cell.
    if (termRand < 0.005) {
        const endX = F2I64(cx);
        const endY = F2I64(cy);
        if (r.cellExists(endX, endY) && alive) {
            const lakeStart = ((endX & 0xffff) | ((endY & 0xffff) << 16)) | 0;
            if (!generateLake(r, { v: lakeStart }))
                alive = false;
        }
    }

    // ---- 5.6 Top-level post-processing (0x59e241 - 0x59e307) ----
    if (!enteredAsTributary && alive) {
        // Stage 1 - four full-map smoothing passes; failure kills the river.
        alive = smoothWaterBody(r, r.genCode, 0);


        if (alive) {
            // Stage 2 - ring expansion, lakeshore mode. May bump genCode.
            alive = expandWaterBody(r, r.genCode, 1, 0, 0, 512, 512, 0, 0);


            // Stage 3 - shore tile correction. The comparison uses genCode
            // RE-READ after the expansion. Runs regardless of the expansion's
            // own result (this block is gated on the SMOOTHING result only).
            for (let Y = 0; Y < r.size.workSide; ++Y) {
                for (let X = 0; X < r.size.workSide; ++X) {
                    if (r.work.i(X + r.size.workSide * Y, 14) !== r.genCode)
                        continue;
                    const cell = r.cellSlots[512 * Y + X];
                    if (cell === null)
                        continue; // non-diamond cell - never marked
                    const tile = cell.isoTileTypeIndex;
                    if (tile === 0 || tile === 0xffff)
                        cell.isoTileTypeIndex = r.greenTileIndex;
                }
            }
        }
    }

    // ---- 5.7 canyon branch / 5.8 finish expansion / 5.9 rollback ----
    let canyonLifted = false;

    // A canyon is only cut by a top-level, still-living river whose base
    // ground level is still the pristine 4, and only when no delta was placed.
    const canyonGate = (deltaCount !== 0 || !alive || r.baseLevel !== 4);

    if (!canyonGate && !enteredAsTributary) {
        // One main-RNG draw normalised to [0,1).
        const roll = r.rng.unit();
        if (roll < 0.7) {
            const rect = [0, 0, 512, 512];
            const anchor = packXY(start & 0xffff, start >>> 16);
            if (!findCandidateCenter(r, r.genCode, 0.01, rect, anchor, 1))
                return rollbackRiver(r, r.genCode, deltaCount);
            alive = expandWaterBody(r, r.genCode, 6, 0, 0, 512, 512, 0, 0);
            if (!alive)
                return rollbackRiver(r, r.genCode, deltaCount);

            // Raise every cell that does NOT belong to this river by 4
            // levels - the carved channel becomes a canyon.
            for (let Y = 0; Y < r.size.workSide; ++Y) {
                for (let X = 0; X < r.size.workSide; ++X) {
                    const cell = r.cellSlots[512 * Y + X];
                    if (cell === null)
                        continue;
                    if (r.work.i(X + r.size.workSide * Y, 14) !== r.genCode)
                        cell.level += 4;
                }
            }
            canyonLifted = true;
        }
    }

    if (!enteredAsTributary) {
        // A dead top-level river always rolls back.
        if (!alive)
            return rollbackRiver(r, r.genCode, deltaCount);

        if (deltaCount === 0) {
            // Riverside expansion, skipped when the canyon just ran.
            if (!canyonLifted) {
                alive = expandWaterBody(r, r.genCode, 2, 0, 0, 512, 512, 0, 0);
                if (!alive)
                    return rollbackRiver(r, r.genCode, deltaCount);
            }
        } else {
            // Delta present, so the ring is lifted by baseLevel.
            alive = expandWaterBody(r, r.genCode, 2, 0, 0, 512, 512, 1, r.baseLevel);
            if (!alive)
                return rollbackRiver(r, r.genCode, deltaCount);
        }
    } else if (canyonGate) {
        // Tributary path. deltaCount is always 0 here (the delta trigger is
        // trunk-only); the branch keeps the delta case 1:1 anyway.
        if (!alive)
            return rollbackRiver(r, r.genCode, deltaCount);
        if (deltaCount > 0) {
            alive = expandWaterBody(r, r.genCode, 2, 0, 0, 512, 512, 1, r.baseLevel);
            if (!alive)
                return rollbackRiver(r, r.genCode, deltaCount);
        }
    }
    // else: tributary with a passing gate -> straight to the budget tail.

    if (!alive)
        return rollbackRiver(r, r.genCode, deltaCount);
    if (canyonLifted)
        r.baseLevel += 4;
    r.usedWaterCells += steps;
    return true;
}

// ---------------------------------------------------------------------------
// RollbackRiver - sub_59D510 LABEL_151 (0x59e538 - 0x59e629).
// Puts a failed river back to plain land: pass 1 for genCode, pass 2 (only
// when the river placed a delta) for genCode - 1. The generation code itself
// is NOT decremented. Returns false for `return RollbackRiver(...)` sites.
// ---------------------------------------------------------------------------
export function rollbackRiver(r: Rmg, genCode: number, deltaCount: number): boolean {
    for (let pass = 0; pass < 2; ++pass) {
        if (pass === 1 && deltaCount <= 0)
            break;
        const code = (pass === 0) ? genCode : genCode - 1;

        for (let Y = 0; Y < r.size.workSide; ++Y) {
            for (let X = 0; X < r.size.workSide; ++X) {
                // Vanilla walks the diamond iterator, so non-diamond cells
                // are never visited.
                const cell = r.cellSlots[512 * Y + X];
                if (cell === null)
                    continue;
                const wi = X + r.size.workSide * Y;
                if (r.work.i(wi, 14) !== code)
                    continue;
                r.work.setI(wi, 14, 0);
                r.work.setByte(wi, 75, 0);
                cell.isoTileTypeIndex = 0;
                cell.height = 0;
                cell.level = r.baseLevel;
            }
        }
    }
    return false;
}

// ---------------------------------------------------------------------------
// FindCandidateCenter - sub_5A08D0 - candidate search / front growth.
// ---------------------------------------------------------------------------
interface Candidate {
    coords: number; // packed CellStruct
    priority: number; // float
}

// Min-heap over candidate records (vanilla 1-based slots; a push is silently
// dropped once count + 1 >= capacity).
class CandidateHeap {
    slots: (Candidate | null)[]; // slots[0] unused
    count = 0;

    constructor(capacity: number) {
        this.slots = new Array<Candidate | null>(capacity + 1).fill(null);
    }

    /** sub_5AD870 sift-down. */
    private siftDown(a2: number): void {
        let v2 = a2;
        let v3 = 2 * a2;
        const v4 = 2 * a2 + 1;
        if (!(2 * a2 <= this.count) || this.slots[a2]!.priority <= this.slots[2 * a2]!.priority)
            v3 = a2;
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
            if (2 * v3 <= this.count && this.slots[v3]!.priority > this.slots[2 * v3]!.priority)
                v3 *= 2;
            if (v6 <= this.count && this.slots[v3]!.priority > this.slots[v6]!.priority)
                v3 = v6;
        } while (v3 !== v2);
    }

    /** 0x5a0ba7 - 0x5a0c14. */
    push(c: Candidate): void {
        let v32 = this.count + 1;
        let v33 = v32 >> 1;
        if (v32 < this.slots.length) {
            while (v32 > 1 && this.slots[v33]!.priority > c.priority) {
                this.slots[v32] = this.slots[v33];
                v32 = v33;
                v33 >>= 1;
            }
            this.slots[v32] = c;
            this.count = v32; // ++*v11: the insert position, not count+1 (vanilla quirk -
            // the C++ heap here is NOT the GrowPatch heap, which does ++count)
        }
    }

    /** 0x5a0cdc - 0x5a0cf7. */
    pop(): Candidate | null {
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

export function findCandidateCenter(r: Rmg, genCode: number, density: number,
                                    rect: number[], anchor: number, flag: number): boolean {
    // ---- 1. Work buffers (0x5a08de - 0x5a0987) ----
    let capacity = 2 * r.size.width * r.size.height;
    if (capacity <= 100)
        capacity = 100;

    const records: Candidate[] = [];
    const heap = new CandidateHeap(capacity);

    // ---- 2. Base direction from the rect (0x5a0995 - 0x5a09f3) ----
    let referenceAngle = 0.0;
    if (rect[0] === 0 && rect[2] !== 512)
        referenceAngle = 3.141592653589793;
    if (rect[1] !== 0)
        referenceAngle = 4.71238898038469;
    else if (rect[3] !== 512)
        referenceAngle = 1.5707963267948966;

    const success = true;

    // ---- 3. Clear the visited marker (0x5a0a19) ----
    for (let Y = 0; Y < r.size.workSide; ++Y) {
        for (let X = 0; X < r.size.workSide; ++X) {
            if (r.cellSlots[512 * Y + X] === null)
                continue; // iterator walks cells
            r.work.setByte(X + r.size.workSide * Y, 15, 0);
        }
    }

    // ---- 4. Seed sweep over the body's ring 0 (0x5a0a58 - 0x5a0c2e) ----
    const ring = buildWaterRing(r, genCode);

    for (let k = 0; k < ring.length; ++k) {
        const c = ring[k]!;
        const x = unpX(c);
        const y = unpYS(c);

        if (x < rect[0] || x >= rect[0] + rect[2])
            continue;
        if (y < rect[1] || y >= rect[1] + rect[3])
            continue;

        // Angle from the anchor, measured against the base direction.
        const dx = x - unpX(anchor);
        const dy = y - unpYS(anchor);
        let angle: number;
        if (dx !== 0) {
            angle = tableAtan(-(dy / dx));
            if (dx < 0)
                angle += 3.141592653589793;
        } else {
            angle = 1.570796326794897;
        }

        let delta = Math.abs(angle - referenceAngle);
        while (delta >= 6.283185307179586)
            delta -= 6.283185307179586;
        if (delta > 3.141592653589793)
            delta = 6.283185307179586 - delta;

        if (records.length >= capacity)
            break; // vanilla would overrun
        records.push({ coords: c, priority: 0.0 });
        const record = records[records.length - 1]!;
        record.priority = Math.fround(delta * 1.5 + r.rng.next() * K_UNIT_SCALE * 2.0);
        heap.push(record);
    }

    // ---- 5. Step budget (0x5a0c40 - 0x5a0cc8) ----
    // The log argument is the 4-byte success-flag slot (0x01xxxxxx), making
    // the budget a function of the density alone.
    const logArg = 0x01000000;
    let v37 = Math.log(logArg);
    if (v37 < 1.0)
        v37 = 1.0;
    let steps = F2I64(1.0 / ((1.0 / v37) * density) * 0.5);
    const halfSteps = Math.trunc(steps / 2);

    let offset: number;
    do {
        offset = F2I64((r.rng.next() >>> 0) * (halfSteps + 1) * (1.0 / 4294967295.0));
    } while (offset > halfSteps);
    steps += offset;

    let current = heap.pop();

    // ---- 6. Growth loop (0x5a0d06 - 0x5a1045) ----
    let ok = success;
    for (let taken = 0; taken < steps && ok && current !== null; ++taken) {
        const cx = unpX(current.coords);
        const cy = unpYS(current.coords);

        const ownWi = cx + r.size.workSide * cy;
        if (r.work.i(ownWi, 14) === 0) {
            const ownCell = r.cellSlots[512 * cy + cx];
            if (ownCell !== null && r.isPlaceholderTile(ownCell)) {
                r.work.setByte(ownWi, 75, 1);
                r.work.setI(ownWi, 14, genCode);
            }
        }

        for (let dirStep = 0; dirStep < 8; dirStep += 2) {
            const dir = dirStep & 7;
            const nx = i16(cx + DIR_X[dir]!);
            const ny = i16(cy + DIR_Y[dir]!);

            if (!r.cellExists(nx, ny))
                continue;

            const nwi = nx + r.size.workSide * ny;
            const nCode = r.work.i(nwi, 14);
            const inRect = (nx >= rect[0] && nx < rect[0] + rect[2] &&
                ny >= rect[1] && ny < rect[1] + rect[3]);
            const nCell = r.cellSlots[512 * ny + nx];

            if (nCode === 0 && r.work.byte(nwi, 15) !== genCode && inRect) {
                if (nCell !== null && r.isPlaceholderTile(nCell)) {
                    const dx = nx - unpX(anchor);
                    const dy = ny - unpYS(anchor);
                    let angle: number;
                    if (dx !== 0) {
                        angle = tableAtan(-(dy / dx));
                        if (dx < 0)
                            angle += 3.141592653589793;
                    } else {
                        angle = 1.570796326794897;
                    }

                    let delta = Math.abs(angle - referenceAngle);
                    while (delta >= 6.283185307179586)
                        delta -= 6.283185307179586;
                    if (delta > 3.141592653589793)
                        delta = 6.283185307179586 - delta;

                    if (records.length < capacity) {
                        records.push({ coords: (nx & 0xffff) | ((ny & 0xffff) << 16), priority: 0.0 });
                        const record = records[records.length - 1]!;
                        record.priority = Math.fround(delta * 1.5 + r.rng.next() * K_UNIT_SCALE * 2.0);
                        r.work.setByte(nwi, 15, genCode);
                        heap.push(record);
                    }
                    continue; // LABEL_108
                }
            }

            if (nCode !== genCode)
                ok = false; // foreign water
        }

        // One gaussian * pi/4 per step keeps the fan from locking up.
        referenceAngle += r.rng.gaussian() * 0.7853981633974483;
        current = heap.pop();
    }

    // ---- 7. Leftover-heap sweep (0x5a10aa - 0x5a115b) ----
    if (flag !== 0) {
        for (let leaf = heap.pop(); leaf !== null && ok; leaf = heap.pop()) {
            const wi = unpX(leaf.coords) + r.size.workSide * unpYS(leaf.coords);
            const code = r.work.i(wi, 14);
            if (code === 0)
                r.work.setI(wi, 14, genCode);
            else if (code !== genCode)
                ok = false;
        }
    }

    return ok;
}

// ---------------------------------------------------------------------------
// GenerateDelta - sub_59E740 river-mouth delta fan.
// On success it also advances the river mouth center 12 cells along the fan
// heading (X += [0,12,0,-12][dir/2], Y += [-12,0,12,0][dir/2]).
// ---------------------------------------------------------------------------
export function generateDelta(r: Rmg, genCode: number, startXY: number, endXY: number,
                              direction: number, success: Box<boolean>,
                              centerX: Box<number>, centerY: Box<number>): void {
    const startX = unpX(startXY);
    const startY = unpYS(startXY);
    const endX = unpX(endXY);
    const endY = unpYS(endXY);

    success.v = false;

    // ---- A. Per-direction frame (0x59e7a7 - 0x59e9f4) ----
    let scanX = 0, scanY = 0, scanSpanX = 0, scanCountY = 0;
    let bandX = 0, bandY = 0, bandSpanX = 0, bandCountY = 0;
    let waveX = 0, waveY = 0, waveSpanX = 0, waveCountY = 0;
    let fanX = 0, fanY = 0, fanW = 0, fanH = 0;
    let anchorX = 0, anchorY = 0;
    let family = -1;

    switch (direction) {
        case 0: // heading -y (0x59e7bc)
        {
            const span = endX - startX;
            scanY = startY - 12; scanCountY = 12; scanX = startX - 2; scanSpanX = span + 5;
            bandY = startY - 4; bandCountY = 4; bandX = startX; bandSpanX = span + 1;
            waveY = startY - 12; waveCountY = 8; waveX = startX; waveSpanX = span + 1;
            fanX = 0; fanY = startY - 4; fanW = 512; fanH = 512 - (startY - 4);
            anchorX = startX; anchorY = startY - 4;
            family = r.waterFamily4Base[3]!; // WaterfallNorth
            break;
        }
        case 2: // heading +x (0x59e8e1)
        {
            const span = endY - startY;
            scanY = startY - 2; scanCountY = span + 5; scanX = startX + 1; scanSpanX = 12;
            bandY = startY; bandCountY = span + 1; bandX = startX + 1; bandSpanX = 4;
            waveY = startY; waveCountY = 8; waveX = startX + 5; waveSpanX = span + 1;
            fanX = 0; fanY = 0; fanW = startX + 4; fanH = 512;
            anchorX = startX + 5; anchorY = startY;
            family = r.waterFamily4Base[0]!; // WaterfallEast
            break;
        }
        case 4: // heading +y (0x59e855)
        {
            const span = startX - endX;
            scanY = endY + 1; scanCountY = 12; scanX = endX - 2; scanSpanX = span + 5;
            bandY = endY + 1; bandCountY = 4; bandX = endX; bandSpanX = span + 1;
            waveY = endY + 5; waveCountY = 8; waveX = endX; waveSpanX = span + 1;
            fanX = 0; fanY = 0; fanW = 512; fanH = endY + 4;
            anchorX = endX; anchorY = endY + 1;
            family = r.waterFamily4Base[2]!; // WaterfallSouth
            break;
        }
        case 6: // heading -x (0x59e975)
        {
            const span = startY - endY;
            scanY = endY - 2; scanCountY = span + 5; scanX = endX - 12; scanSpanX = 12;
            bandY = endY; bandCountY = span + 1; bandX = endX - 4; bandSpanX = 4;
            waveY = endY; waveCountY = span + 1; waveX = endX - 12; waveSpanX = 8;
            fanX = endX - 4; fanY = 0; fanW = 512 - (endX - 4); fanH = 512;
            anchorX = endX - 4; anchorY = endY;
            family = r.waterFamily4Base[1]!; // WaterfallWest
            break;
        }
        default:
            return; // vanilla: empty arm
    }

    // ---- B. Occupancy screen (0x59e9fa - 0x59eadc) ----
    // Any occupied or non-placeholder cell inside the scan band aborts the
    // fan (the caller sees "no delta").
    for (let y = scanY; y < scanY + scanCountY; ++y) {
        for (let x = scanX; x < scanX + scanSpanX; ++x) {
            if (!r.cellExists(x, y))
                continue;
            if (r.work.i(x + r.size.workSide * y, 14) !== 0)
                return;
            if (!r.isPlaceholderTile(r.cellSlots[512 * y + x]!))
                return;
        }
    }

    // ---- C + D-second-band fan fill (0x59eadc - 0x59ec43 / 0x59ed53) ----
    // Each cell gets a random water variant (6-way) and a random Height
    // (4-way), both by rejection sampling, then the generation code.
    const fillBand = (y0: number, countY: number, x0: number, spanX: number): void => {
        for (let y = y0; y < y0 + countY; ++y) {
            for (let x = x0; x < x0 + spanX; ++x) {
                if (!r.cellExists(x, y))
                    continue;
                let variant: number;
                do {
                    variant = F2I64((r.rng.next() >>> 0) * 6.0 * K_UNIT_SCALE);
                } while (variant > 5);
                const cell = r.cellSlots[512 * y + x]!;
                cell.isoTileTypeIndex = r.waterTileIndex + variant;
                let height: number;
                do {
                    height = F2I64((r.rng.next() >>> 0) * 4.0 * K_UNIT_SCALE);
                } while (height > 3);
                cell.height = height;
                r.work.setI(x + r.size.workSide * y, 14, genCode);
            }
        }
    };

    fillBand(bandY, bandCountY, bandX, bandSpanX);

    // ---- D. Search / smoothing / expansion (0x59ec6a - 0x59ed60) ----
    const anchor = packXY(i16(anchorX), i16(anchorY));
    const rect = [fanX, fanY, fanW, fanH];
    let ok = findCandidateCenter(r, genCode, 0.003, rect, anchor, 0);
    if (ok) {
        ok = smoothWaterBody(r, r.genCode, 0);
        if (ok) {
            ok = expandWaterBody(r, r.genCode, 2, fanX, fanY, fanW, fanH, 0, 0);
            if (ok) {
                // Raise every cell of THIS fan.
                for (let Y = 0; Y < r.size.workSide; ++Y) {
                    for (let X = 0; X < r.size.workSide; ++X) {
                        const cell = r.cellSlots[512 * Y + X];
                        if (cell === null)
                            continue;
                        if (r.work.i(X + r.size.workSide * Y, 14) === genCode)
                            cell.level += 4;
                    }
                }

                // The second band, same recipe.
                fillBand(waveY, waveCountY, waveX, waveSpanX);

                // ---- E. Waterfall dressing (0x59eee1 - 0x59ffd4) ----
                const stamp = (x: number, y: number, tileIndex: number, level: number): void => {
                    r.currentBuildingType = tileIndex;
                    setFoundationCenter(r, packXY(i16(x), i16(y)));
                    const placed: Box<boolean> = { v: true };
                    placeIsoTile(r, 0, 0x10000, level, genCode, placed, 0);
                };
                const markCorner = (x: number, y: number): void => {
                    if (!r.cellExists(x, y))
                        return;
                    const cell = r.cellSlots[512 * y + x]!;
                    cell.isoTileTypeIndex = 0xffff;
                    cell.level += 4;
                    cell.height = 0;
                    r.work.setI(x + r.size.workSide * y, 14, genCode);
                };

                let baseX: number, baseY: number, level: number;
                switch (direction) {
                    case 0:
                        baseX = bandX - 2; baseY = bandY - 2; // 0x59fb4d
                        level = r.cellSlots[512 * (bandY - 4) + (bandX - 2)]!.level;
                        stamp(baseX, baseY, family, level);
                        stamp(baseX + waveSpanX + 2, baseY, family + 3, level);
                        r.cellSlots[512 * baseY + (baseX + 1)]!.isoTileTypeIndex = 0xffff;
                        r.cellSlots[512 * baseY + (baseX + waveSpanX + 2)]!.isoTileTypeIndex = 0xffff;
                        for (let k = 0; k < waveSpanX + 2; ++k)
                            r.cellSlots[512 * baseY + (baseX + k + 1)]!.level -= 4;
                        markCorner(baseX - 1, baseY + 1);
                        markCorner(baseX + waveSpanX + 4, baseY + 1);
                        for (let k = 0; k < waveSpanX;) {
                            if ((waveSpanX - k) % 2 !== 0) { stamp(baseX + k + 2, baseY + 1, family + 1, level); k += 1; }
                            else { stamp(baseX + k + 2, baseY + 1, family + 2, level); k += 2; }
                        }
                        break;
                    case 2:
                        baseX = waveX; baseY = waveY + waveCountY; // 0x59eef4
                        level = r.cellSlots[512 * (baseY + 2) + (baseX + 2)]!.level;
                        stamp(baseX, baseY, family, level);
                        stamp(baseX, baseY - (waveCountY + 2), family + 3, level);
                        r.cellSlots[512 * (baseY - (waveCountY + 3)) + baseX]!.isoTileTypeIndex = 0xffff;
                        r.cellSlots[512 * (baseY + 2) + baseX]!.isoTileTypeIndex = 0xffff;
                        for (let k = 0; k < waveCountY + 2; ++k)
                            r.cellSlots[512 * (baseY - k) + baseX]!.level -= 4;
                        markCorner(baseX, baseY + 2);
                        markCorner(baseX + 1, baseY - (waveCountY + 3));
                        for (let k = 0; k < waveCountY;) {
                            if ((waveCountY - k) % 2 !== 0) { stamp(baseX, baseY - (k + 1), family + 1, level); k += 1; }
                            else { stamp(baseX, baseY - (k + 2), family + 2, level); k += 2; }
                        }
                        break;
                    case 4:
                        baseX = bandX - 2; baseY = waveY; // 0x59f784
                        level = r.cellSlots[512 * (baseY + 2) + (baseX + 2)]!.level;
                        stamp(baseX, baseY, family, level);
                        stamp(baseX + waveSpanX + 2, baseY, family + 3, level);
                        r.cellSlots[512 * baseY + (baseX - 1)]!.isoTileTypeIndex = 0xffff;
                        r.cellSlots[512 * baseY + (baseX + waveSpanX + 4)]!.isoTileTypeIndex = 0xffff;
                        for (let k = 0; k < waveSpanX + 2; ++k)
                            r.cellSlots[512 * baseY + (baseX + k + 1)]!.level -= 4;
                        markCorner(baseX - 1, baseY);
                        markCorner(baseX + waveSpanX + 4, baseY);
                        for (let k = 0; k < waveSpanX;) {
                            if ((waveSpanX - k) % 2 !== 0) { stamp(baseX + k + 2, baseY, family + 1, level); k += 1; }
                            else { stamp(baseX + k + 2, baseY, family + 2, level); k += 2; }
                        }
                        break;
                    default: // 6
                        baseX = waveX - 2; baseY = waveY + waveCountY; // 0x59f2d5
                        level = r.cellSlots[512 * (baseY + 2) + (baseX - 2)]!.level;
                        stamp(baseX, baseY, family, level);
                        stamp(baseX, baseY - (waveCountY + 2), family + 3, level);
                        r.cellSlots[512 * (baseY + 2) + baseX]!.isoTileTypeIndex = 0xffff;
                        r.cellSlots[512 * (baseY - (waveCountY + 2)) + baseX]!.isoTileTypeIndex = 0xffff;
                        for (let k = 0; k < waveCountY + 2; ++k)
                            r.cellSlots[512 * (baseY - k) + baseX]!.level -= 4;
                        markCorner(baseX + 1, baseY + 2);
                        markCorner(baseX + 1, baseY - (waveCountY + 3));
                        for (let k = 0; k < waveCountY;) {
                            if ((waveCountY - k) % 2 !== 0) { stamp(baseX + 1, baseY - (k + 1), family + 1, level); k += 1; }
                            else { stamp(baseX + 1, baseY - (k + 2), family + 2, level); k += 2; }
                        }
                        break;
                }
            }
        }
        // ok = ok (0x59ffd4, no-op)
    }

    // ---- F. River-mouth advance (0x59ffe4 - 0x5a003f) ----
    if (ok) {
        const kMouthX = [0, 12, 0, -12];
        const kMouthY = [-12, 0, 12, 0];
        centerX.v += kMouthX[direction / 2]!;
        centerY.v += kMouthY[direction / 2]!;
    }
    success.v = ok;
}

// ---------------------------------------------------------------------------
// SmoothWaterBody - sub_57A0C0 four full-map smoothing passes.
// ---------------------------------------------------------------------------
export function smoothWaterBody(r: Rmg, genCode: number, flag: number): boolean {
    diag(`SMOOTH g=${genCode} flag=${flag}`);
    resetPreviewState(r);

    if (r.work.count === 0)
        r.initWorkArray();

    // Reset every work cell's processing marker (data[16]) to -1.
    const workCount = r.size.workSide * r.size.workSide;
    for (let i = 0; i < workCount; ++i)
        r.work.setI(i, 16, -1);

    // One success flag shared by all four passes.
    let ok = true;

    // Pass 1: recursive flood fill of the water body.
    {
        const it = new CellIterator();
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {
            if (!ok)
                break;
            ok = floodFill(r, cell, genCode, flag);
        }
    }

    // Pass 2: placeholder tile cleanup (return value deliberately ignored).
    {
        const it = new CellIterator();
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {
            if (!ok)
                break;
            cleanupTile(r, cell, genCode);
        }
    }

    // [FIX] Carve staircase-bend inner tips before shore pieces are chosen.
    if (ok)
        fillStaircaseBends(r, genCode);

    // [FIX] 铺岸片前把"2x2 岸片无解"的对角水角填回陆地（每处 1 格）。
    if (ok)
        fillUnsolvableShoreCorners(r, genCode);

    // Pass 3: shore tile selection, first round.
    {
        const it = new CellIterator();
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {
            if (!ok)
                break;
            ok = selectShoreTile(r, cell, 1, genCode, flag);
        }
    }

    // Pass 4: shore tile selection, second round - its result is the return.
    {
        const it = new CellIterator();
        it.reset(r.cellSlots, r.size.mapWidth);
        for (let cell = it.next(); cell !== null; cell = it.next()) {
            if (!ok)
                break;
            ok = selectShoreTile(r, cell, 2, genCode, flag);
        }
    }

    return ok;
}

// ---------------------------------------------------------------------------
// FillStaircaseBends - staircase river-bend repair (transplant-side fix).
// ---------------------------------------------------------------------------
export function fillStaircaseBends(r: Rmg, genCode: number): void {
    const side = r.size.workSide;

    const realWater = (x: number, y: number): boolean => {
        if (x < 0 || y < 0 || x >= side || y >= side)
            return false;
        const c = r.cellSlots[512 * y + x];
        return c !== null && r.isWaterTile(c);
    };

    // Collect every bend's inner-tip cell first, then carve them as one batch.
    const tips: Array<[number, number]> = [];

    for (let y = 0; y < side; ++y) {
        for (let x = 0; x < side; ++x) {
            const a = r.cellExists(x, y) ? r.cellSlots[512 * y + x] : null;
            if (a === null || r.isWaterTile(a))
                continue;

            // Direction + : B = (x+1,y+1). Water at NW,N,NE,E of A and at the
            // shared E cell plus E,SE of B.
            if (realWater(x - 1, y - 1) && realWater(x, y - 1) &&
                realWater(x + 1, y - 1) && realWater(x + 1, y) &&
                realWater(x + 2, y + 1) && realWater(x + 2, y + 2)) {
                const b = r.cellExists(x + 1, y + 1)
                    ? r.cellSlots[512 * (y + 1) + (x + 1)] : null;
                if (b !== null && !r.isWaterTile(b))
                    tips.push([x + 1, y + 1]);
            }

            // Direction - (mirror): B = (x-1,y+1). Water at NE,N,NW,W of A and
            // at the shared W cell plus W,SW of B.
            if (realWater(x + 1, y - 1) && realWater(x, y - 1) &&
                realWater(x - 1, y - 1) && realWater(x - 1, y) &&
                realWater(x - 2, y + 1) && realWater(x - 2, y + 2)) {
                const b = r.cellExists(x - 1, y + 1)
                    ? r.cellSlots[512 * (y + 1) + (x - 1)] : null;
                if (b !== null && !r.isWaterTile(b))
                    tips.push([x - 1, y + 1]);
            }
        }
    }

    for (let k = 0; k < tips.length; ++k) {
        const tx = tips[k]![0];
        const ty = tips[k]![1];

        // Flatten the tip and make it real water of this body.
        const tip = r.cellSlots[512 * ty + tx]!;
        tip.height = 0;
        tip.isoTileTypeIndex = r.waterTileIndex;
        r.work.setI(r.workIndex(tx, ty), 14, genCode);

        // Invalidate the neighbour masks so passes 3/4 recompute.
        for (let dy = -1; dy <= 1; ++dy) {
            for (let dx = -1; dx <= 1; ++dx) {
                const nx = tx + dx;
                const ny = ty + dy;
                if (r.cellExists(nx, ny))
                    r.work.setI(r.workIndex(nx, ny), 16, -1);
            }
        }

        diag(`BEND-FILL tip=(${tx},${ty}) g=${genCode}`);
    }
}

// ---------------------------------------------------------------------------
// FillUnsolvableShoreCorners - 铺岸片前抹掉"2x2 岸片无解"的单格水角
// （移植侧修形，非原版逻辑）。
// ---------------------------------------------------------------------------
export function fillUnsolvableShoreCorners(r: Rmg, genCode: number): void {
    const side = r.size.workSide;

    const land = (x: number, y: number): boolean => {
        if (x < 0 || y < 0 || x >= side || y >= side)
            return false;
        const c = r.cellSlots[512 * y + x];
        return c !== null && !r.isWaterTile(c);
    };
    const water = (x: number, y: number): boolean => {
        if (x < 0 || y < 0 || x >= side || y >= side)
            return false;
        const c = r.cellSlots[512 * y + x];
        return c !== null && r.isWaterTile(c);
    };

    // 候选陆格只取占位格（与 SelectShoreTile 的 mode-0 门同源）。
    const placeholder = (x: number, y: number): boolean => {
        if (x < 0 || y < 0 || x >= side || y >= side)
            return false;
        const c = r.cellSlots[512 * y + x];
        return c !== null && r.isPlaceholderTile(c);
    };

    // 收集需要填回陆地的"对角水角"坐标（去重）。
    const fills: Array<[number, number]> = [];
    const addFill = (x: number, y: number): void => {
        for (const f of fills) {
            if (f[0] === x && f[1] === y)
                return;
        }
        fills.push([x, y]);
    };

    for (let y = 0; y < side; ++y) {
        for (let x = 0; x < side; ++x) {
            if (!placeholder(x, y))
                continue;

            // 正交四邻必须全是陆地。
            if (water(x, y - 1) || water(x + 1, y) ||
                water(x, y + 1) || water(x - 1, y))
                continue;

            const nw = water(x - 1, y - 1);
            const ne = water(x + 1, y - 1);
            const sw = water(x - 1, y + 1);
            const se = water(x + 1, y + 1);
            const diagCount = (nw ? 1 : 0) + (ne ? 1 : 0)
                + (sw ? 1 : 0) + (se ? 1 : 0);
            if (diagCount !== 1)
                continue;

            // ---- B 型：背靠背角岸对。a 为偏南那侧角格，优先处理 ----
            if (sw && placeholder(x + 1, y - 1) && land(x + 1, y - 1)
                && !water(x + 1, y - 2) && !water(x + 2, y - 1) // b 的 N/E
                && !water(x + 1, y) && !water(x, y - 1)         // b 的 S/W
                && water(x + 2, y - 2)                          // b 仅 NE 对角水
                && !water(x, y - 2) && !water(x + 2, y)) {
                addFill(x - 1, y + 1); // 填 a 的 SW 水角
                continue;
            }
            // SE 角格 a=(x,y) 与 NW 角格 b=(x-1,y-1) 配对。
            if (se && placeholder(x - 1, y - 1) && land(x - 1, y - 1)
                && !water(x - 1, y - 2) && !water(x, y - 1)     // b 的 N/E
                && !water(x - 1, y) && !water(x - 2, y - 1)     // b 的 S/W
                && water(x - 2, y - 2)                          // b 仅 NW 对角水
                && !water(x, y - 2) && !water(x - 2, y)) {
                addFill(x + 1, y + 1); // 填 a 的 SE 水角
                continue;
            }

            // ---- A 型：拐角片展开侧整列/整行贴着正交深水墙 ----
            if (nw && water(x + 2, y) && water(x + 2, y + 1))
                addFill(x - 1, y - 1); // 填 NW 水角
            else if (ne && water(x, y + 2) && water(x + 1, y + 2))
                addFill(x + 1, y - 1); // 填 NE 水角
            else if (sw && water(x + 2, y) && water(x + 2, y + 1))
                addFill(x - 1, y + 1); // 填 SW 水角
            else if (se && water(x, y - 2) && water(x + 1, y - 2))
                addFill(x + 1, y + 1); // 填 SE 水角
        }
    }

    // 统一把命中的水角填回陆地（与湖体失败回滚同款还原）。
    for (let k = 0; k < fills.length; ++k) {
        const fx = fills[k]![0];
        const fy = fills[k]![1];
        const c = r.cellSlots[512 * fy + fx];
        if (c === null)
            continue;

        c.isoTileTypeIndex = 0;
        c.height = 0;
        c.level = r.baseLevel;
        r.work.setI(r.workIndex(fx, fy), 14, 0);
        r.work.setByte(r.workIndex(fx, fy), 75, 0);

        for (let dy = -1; dy <= 1; ++dy) {
            for (let dx = -1; dx <= 1; ++dx) {
                if (r.cellExists(fx + dx, fy + dy))
                    r.work.setI(r.workIndex(fx + dx, fy + dy), 16, -1);
            }
        }

        diag(`SHORE-CORNER-FILL water=(${fx},${fy}) g=${genCode}`);
    }
}

// ---------------------------------------------------------------------------
// ResetPreviewState - sub_4A8BF0 - DisplayClass foundation-preview reset.
// ---------------------------------------------------------------------------
export function resetPreviewState(r: Rmg): void {
    if (r.fpData !== null) {
        const base = packXY(unpX(r.fpCenter) + unpX(r.fpTopLeft),
            unpYS(r.fpCenter) + unpYS(r.fpTopLeft));
        markFoundation(r, base, false);
    }

    r.fpTopLeft = packXY(0, 0);
    r.fpData = null;
}

// ---------------------------------------------------------------------------
// MarkFoundation - sub_4A95A0 (YRpp DisplayClass::MarkFoundation).
// baseCell: packed; mark: true to stamp, false to un-stamp. Walks the
// foundation list (packed CellStruct entries terminated by (0x7FFF, 0x7FFF)).
// ---------------------------------------------------------------------------
export function markFoundation(r: Rmg, baseCell: number, mark: boolean): void {
    if (unpX(baseCell) === 0 && unpYS(baseCell) === 0)
        return;

    const data = r.fpData;
    if (data === null)
        return;

    for (let i = 0; i < data.length; ++i) {
        const entry = data[i]!;
        if (unpX(entry) === 0x7fff && unpYS(entry) === 0x7fff)
            break;

        const x = unpX(baseCell) + unpX(entry);
        const y = unpYS(baseCell) + unpYS(entry);

        if (!r.cellExists(x, y))
            continue;

        const cell = r.cellSlots[512 * y + x]!;
        if (mark)
            cell.altFlags |= 0x2; // AltCellFlags_ContainsBuilding
        else
            cell.altFlags &= ~0x2;
    }
}

// ---------------------------------------------------------------------------
// TileNeighbourMask - sub_57B210 - 8-direction connectivity mask.
// Bit <-> direction:
//   0x40 NW  0x80 N  0x01 NE
//   0x20 W   0x02 E
//   0x10 SW  0x08 S  0x04 SE
// ---------------------------------------------------------------------------
export function tileNeighbourMask(r: Rmg, cell: MapCell, mode: number): number {
    const x = cell.mapCoords & 0xffff;
    const y = cell.mapCoords >>> 16;

    if (!r.cellExists(x, y))
        return 0;

    if (mode === 1) {
        const tile = cell.isoTileTypeIndex;
        if (tile >= r.waterTileIndex && tile < r.waterTileIndex + 14)
            return 0;
    } else if (mode === 0) {
        if (!r.isPlaceholderTile(cell))
            return 0;
    }

    const wi = r.workIndex(x, y);
    if (r.work.byte(wi, 74) === 0)
        return 0;
    const cached = r.work.i(wi, 16);
    if (cached >= 0)
        return cached;

    let mask = 0;
    const selfWater = r.isWaterTile(cell);
    const base = x + (y << 9);

    const setBit = (index: number, bit: number): void => {
        const n = r.rawSlot(index);
        if (n !== null ? r.isWaterTile(n) : selfWater)
            mask |= bit;
    };

    setBit(base - 513, 0x40); // NW
    setBit(base - 512, 0x80); // N
    setBit(base - 511, 0x01); // NE
    setBit(base - 1, 0x20);   // W
    setBit(base + 1, 0x02);   // E
    setBit(base + 511, 0x10); // SW
    setBit(base + 512, 0x08); // S
    setBit(base + 513, 0x04); // SE
    return mask;
}

// ---------------------------------------------------------------------------
// FloodFill - sub_57A430 - pass 1, recursive flood fill of one water body.
// ---------------------------------------------------------------------------
export function floodFill(r: Rmg, cell: MapCell, genCode: number, flag: number): boolean {
    const cx = cell.mapCoords & 0xffff;
    const cy = cell.mapCoords >>> 16;

    // 1. Stamp the morphology code as the work marker.
    r.work.setI(r.workIndex(cx, cy), 16, tileNeighbourMask(r, cell, 2));

    // 2. Connectivity mask.
    const mask = tileNeighbourMask(r, cell, 0);
    if (mask <= 0)
        return true;

    // 3. Fall-back / absorb flag (vanilla v44).
    let fallback = (mask === 11 || mask === 26);

    if (((mask & 0xa0) === 0xa0 && (mask & 0x11) === 0)
        || ((mask & 0x82) === 0x82 && (mask & 0x44) === 0)
        || ((mask & 0x0a) === 0x0a && (mask & 0x11) === 0)
        || ((mask & 0x28) === 0x28 && (mask & 0x44) === 0))
        fallback = true;

    // Axis probes: a connection on one side whose opposite side is still
    // connected one and two cells out marks a one-wide bridge.
    if ((mask & 0x20) !== 0) { // W set -> probe E and EE, test their E bit
        if ((tileNeighbourMask(r, r.cellAt(cx + 1, cy), 0) & 0x02) !== 0
            || (tileNeighbourMask(r, r.cellAt(cx + 2, cy), 0) & 0x02) !== 0)
            fallback = true;
    }
    if ((mask & 0x02) !== 0) { // E set -> probe W and WW, test their W bit
        if ((tileNeighbourMask(r, r.cellAt(cx - 1, cy), 0) & 0x20) !== 0
            || (tileNeighbourMask(r, r.cellAt(cx - 2, cy), 0) & 0x20) !== 0)
            fallback = true;
    }
    if ((mask & 0x08) !== 0) { // S set -> probe N and NN, test their N bit
        if ((tileNeighbourMask(r, r.cellAt(cx, cy - 1), 0) & 0x80) !== 0
            || (tileNeighbourMask(r, r.cellAt(cx, cy - 2), 0) & 0x80) !== 0)
            fallback = true;
    }
    if ((mask & 0x80) !== 0) { // N set -> probe S and SS, test their S bit
        if ((tileNeighbourMask(r, r.cellAt(cx, cy + 1), 0) & 0x08) !== 0
            || (tileNeighbourMask(r, r.cellAt(cx, cy + 2), 0) & 0x08) !== 0)
            fallback = true;
    }

    // 4. Straight-through or absorbed?
    if ((mask & 0x88) !== 0x88 && (mask & 0x22) !== 0x22 && !fallback)
        return true;

    // 4a. Foreign-water pollution test.
    const owner = r.work.i(r.workIndex(cx, cy), 14);
    if (owner > 0 && owner !== genCode && flag === 0)
        return false;

    // 4b. Flatten and set the water base tile.
    cell.height = 0;
    cell.isoTileTypeIndex = r.waterTileIndex;

    // 4c. Write the generation code (flag ? 0 : genCode).
    r.work.setI(r.workIndex(cx, cy), 14, flag !== 0 ? 0 : genCode);

    // 4d. Recurse into the 8 in-diamond neighbours.
    for (let facing = 0; facing < 8; ++facing) {
        const nb = r.getNeighbourCell(cell, facing);
        const nx = nb.mapCoords & 0xffff;
        const ny = nb.mapCoords >>> 16;
        if (!r.cellExists(nx, ny))
            continue;
        r.work.setI(r.workIndex(nx, ny), 16, -1);
        floodFill(r, nb, genCode, flag);
    }

    return true;
}

// ---------------------------------------------------------------------------
// CleanupTile - sub_57A320 - pass 2, placeholder tile reclaim.
// ---------------------------------------------------------------------------
export function cleanupTile(r: Rmg, cell: MapCell, genCode: number): number {
    // genCode is only used by the unreachable work data[14] store (dead flag).

    const tile = cell.isoTileTypeIndex;
    if (tile < r.waterTileIndex || tile >= r.waterTileIndex + 12)
        return tile;

    const code = tileNeighbourMask(r, cell, 2);
    if (code !== 199 && code !== 124 && code !== 241 && code !== 31
        && code !== 198 && code !== 108 && code !== 177 && code !== 27)
        return code;

    // Reclaim the leftover placeholder tile.
    cell.isoTileTypeIndex = 0xffff;
    cell.height = 0;

    // Refresh the 8 neighbours' processing markers.
    for (let facing = 0; facing < 8; ++facing) {
        const nb = r.getNeighbourCell(cell, facing);
        const nx = nb.mapCoords & 0xffff;
        const ny = nb.mapCoords >>> 16;
        if (!r.cellExists(nx, ny))
            continue;

        const wi = r.workIndex(nx, ny);
        r.work.setI(wi, 16, -1);
        r.work.setI(wi, 16, tileNeighbourMask(r, nb, 2));
    }

    return code;
}

// ---------------------------------------------------------------------------
// SelectShoreTile - sub_57ACF0 - passes 3/4, shore-tile selection.
// mode 1 = pass 3 (first round), mode 2 = pass 4 (second round).
// ---------------------------------------------------------------------------
export function selectShoreTile(r: Rmg, cell: MapCell, mode: number, genCode: number,
                                flag: number): boolean {
    // 0. One RNG draw per visited cell.
    const roll = r.rng.randomFloatRange(0, 5);

    // Trigger coordinates, used by the shore anchor / placement tail.
    const cellX = cell.mapCoords & 0xffff;
    const cellY = cell.mapCoords >>> 16;

    // 1. Connectivity mask (mode 1 -> reject water, mode 0 -> require placeholder).
    const mask = (mode === 2) ? tileNeighbourMask(r, cell, 1)
        : tileNeighbourMask(r, cell, 0);
    if (mask === 0)
        return true;

    let n12: number;

    if (mode === 2) {
        if ((mask & 0xa0) === 0xa0)
            n12 = ((mask & 0x11) === 0x11) ? (roll & 1) + 23
                : ((mask & 1) !== 0 ? 21 : 30);
        else if ((mask & 0x82) === 0x82)
            n12 = ((mask & 0x44) === 0x44) ? (roll & 1) + 15
                : ((mask & 4) !== 0 ? 14 : 22);
        else if ((mask & 0x0a) === 0x0a)
            n12 = ((mask & 0x11) === 0x11) ? (roll & 1) + 7
                : ((mask & 1) !== 0 ? 13 : 6);
        else if ((mask & 0x28) === 0x28)
            n12 = ((mask & 0x44) === 0x44) ? (roll & 1) + 31
                : ((mask & 4) !== 0 ? 5 : 29);
        else
            return true;
    } else {
        // Walk the edge: from `cell`, step dirA to n1, then dirB to n2, then
        // advance both by dirA while n1 stays land and n2 stays water. The
        // run length counts from 1.
        const edgeRun = (dirA: number, dirB: number): number => {
            let count = 1;
            let n1 = r.getNeighbourCell(cell, dirA);
            let n2 = r.getNeighbourCell(n1, dirB);
            let land = !r.isWaterTile(n1);
            let water = r.isWaterTile(n2);

            while (land) {
                if (!water)
                    break;
                ++count;
                n1 = r.getNeighbourCell(n1, dirA);
                n2 = r.getNeighbourCell(n2, dirA);
                land = !r.isWaterTile(n1);
                water = r.isWaterTile(n2);
            }
            return count;
        };

        if ((mask & 0x02) !== 0) {
            const n = edgeRun(4, 2); // +Y then +X
            n12 = (((n & 1) !== 0 && (mask & 0x80) === 0)
                || (mask & 0x04) === 0 || (mask & 0x18) !== 0)
                ? 12 : (roll % 3) + 9;
        } else if ((mask & 0x20) !== 0) {
            const n = edgeRun(4, 6); // +Y then -X
            n12 = (((n & 1) !== 0 && (mask & 0x80) === 0)
                || (mask & 0x10) === 0 || (mask & 0x0c) !== 0)
                ? 28 : (roll % 3) + 25;
        } else if ((mask & 0x08) !== 0) {
            const n = edgeRun(2, 4); // +X then +Y
            n12 = (((n & 1) !== 0 || (mask & 0x04) === 0 || (mask & 0x03) !== 0))
                ? 4 : (roll % 3) + 1;
        } else if ((mask & 0x80) !== 0) {
            const n = edgeRun(2, 0); // +X then -Y
            n12 = (((n & 1) !== 0 || (mask & 0x01) === 0 || (mask & 0x06) !== 0))
                ? 20 : (roll % 3) + 17;
        } else {
            // LABEL_61 fallback: no side bit matched.
            if ((mask & 0x01) !== 0) n12 = (roll & 1) + 35;
            else if ((mask & 0x04) !== 0) n12 = (roll & 1) + 33;
            else if ((mask & 0x10) !== 0) n12 = (roll & 1) + 39;
            else if ((mask & 0x40) !== 0) n12 = (roll & 1) + 37;
            else return true;
        }
    }

    // 2. Reject (vanilla 0x57b125); unreachable as every n12 above is > 0.
    if (n12 <= 0)
        return true;

    // 3. Placement tail (LABEL_71).
    r.currentBuildingType = r.shorePieces + n12 - 1;

    const pull = shoreStampOffset(n12, mask);
    const target = packXY(cellX + unpX(pull), cellY + unpYS(pull));
    setFoundationCenter(r, target);

    const placed: Box<boolean> = { v: true };
    if (mode === 1)
        placeIsoTile(r, 0, 0, cell.level, genCode, placed, flag);
    else
        placeIsoTile(r, r.shorePieces, r.shorePieces + 41, cell.level, genCode, placed, flag);

    diag(`SHORE mode=${mode} g=${genCode} cell=(${cellX},${cellY}) mask=0x${x2(mask)} n12=${n12} off=(${unpX(pull)},${unpYS(pull)}) placed=${placed.v ? 1 : 0}`);

    return placed.v;
}

// ---------------------------------------------------------------------------
// SetFoundationCenter - sub_4A91B0 - move the foundation-preview center.
// ---------------------------------------------------------------------------
export function setFoundationCenter(r: Rmg, target: number): number {
    const previous = r.fpCenter;
    r.fpCenter = target;
    return previous;
}

// ---------------------------------------------------------------------------
// ShoreStampOffset - where selectShoreTile puts the shore stamp's origin
// (packed CellStruct return). See MapGenRiver.cpp 0x2409-0x2552.
// ---------------------------------------------------------------------------

// Does the rectangle [dx, dx+w-1] x [dy, dy+h-1], taken relative to the
// trigger cell, cover any of the trigger's water neighbours?
const kMaskNeighbours: ReadonlyArray<{ bit: number; ox: number; oy: number }> = [
    { bit: 0x80, ox: 0, oy: -1 }, { bit: 0x01, ox: 1, oy: -1 },
    { bit: 0x02, ox: 1, oy: 0 }, { bit: 0x04, ox: 1, oy: 1 },
    { bit: 0x08, ox: 0, oy: 1 }, { bit: 0x10, ox: -1, oy: 1 },
    { bit: 0x20, ox: -1, oy: 0 }, { bit: 0x40, ox: -1, oy: -1 },
];

function footprintCoversWater(mask: number, dx: number, dy: number, w: number, h: number): boolean {
    for (let i = 0; i < 8; ++i) {
        const nb = kMaskNeighbours[i]!;
        if ((mask & nb.bit) === 0)
            continue;
        const ox = nb.ox;
        const oy = nb.oy;
        if (ox >= dx && ox <= dx + w - 1 && oy >= dy && oy <= dy + h - 1)
            return true;
    }
    return false;
}

// Which edge of the piece its art is drawn against water on, read straight
// off the n12 dispatch in selectShoreTile.
function shoreFacesEast(n12: number): boolean {
    switch (n12) {
        case 6: case 7: case 8: case 9: case 10: case 11: case 12: case 13:
        case 14: case 15: case 16: case 22:
        case 33: case 34: case 35: case 36:
            return true;
        default:
            return false;
    }
}

function shoreFacesSouth(n12: number): boolean {
    switch (n12) {
        case 1: case 2: case 3: case 4: case 5: case 6: case 7: case 8:
        case 13: case 29: case 31: case 32: case 33: case 34:
        case 39: case 40:
            return true;
        default:
            return false;
    }
}

function shoreStampOffset(n12: number, mask: number): number {
    let offsetX = 0;
    let offsetY = 0;

    const idx = n12 - 1;
    if (idx < 0 || idx >= 42)
        return packXY(offsetX, offsetY);

    const w = kShoreFootprints[idx]!.w;
    const h = kShoreFootprints[idx]!.h;

    // Anchor 1: the piece's own facing - the trigger cell sits on the piece's
    // water edge, so the stamp (which only grows +X/+Y) is pulled back.
    const facingX = shoreFacesEast(n12) ? -(w - 1) : 0;
    const facingY = shoreFacesSouth(n12) ? -(h - 1) : 0;
    if ((facingX !== 0 || facingY !== 0)
        && !footprintCoversWater(mask, facingX, facingY, w, h))
        return packXY(facingX, facingY);

    // Anchor 2: the least displaced water-clear placement.
    let bestScore = 0;
    let found = false;

    for (let iy = 0; iy < 2; ++iy) {
        for (let ix = 0; ix < 2; ++ix) {
            const dx = (ix !== 0) ? -(w - 1) : 0;
            const dy = (iy !== 0) ? -(h - 1) : 0;
            if (footprintCoversWater(mask, dx, dy, w, h))
                continue;

            const score = ((dx < 0) ? -dx : dx) + ((dy < 0) ? -dy : dy);
            if (!found || score < bestScore) {
                found = true;
                bestScore = score;
                offsetX = dx;
                offsetY = dy;
            }
        }
    }

    // Water on both sides of a piece this wide: no placement is clear, so
    // fall back to the trigger cell itself, exactly as a zero anchor would.
    return packXY(offsetX, offsetY);
}

// sub_578D80 (0x578D80) - may `tile` be placed on foundation cell `h`?
// The four waterfall families only restrict their FIRST and LAST piece, by
// the cell's position inside the foundation.
function tileFitsFoundation(b: TileFamilyBases, tile: number, h: number): boolean {
    if (b.cliff >= 0 && tile >= b.cliff && tile < b.cliff + 40)
        return true; // 0x578d8f
    if (b.waterfall[0]! >= 0 && tile >= b.waterfall[0]! && tile < b.waterfall[0]! + 4)
        return (tile === b.waterfall[0]! || tile === b.waterfall[0]! + 3)
            ? (h !== 0 && h !== 4) : true; // East 0x578dae
    if (b.waterfall[1]! >= 0 && tile >= b.waterfall[1]! && tile < b.waterfall[1]! + 4)
        return (tile === b.waterfall[1]! || tile === b.waterfall[1]! + 3)
            ? (h !== 1 && h !== 3) : true; // West 0x578de2
    if (b.waterfall[2]! >= 0 && tile >= b.waterfall[2]! && tile < b.waterfall[2]! + 4)
        return (tile === b.waterfall[2]! || tile === b.waterfall[2]! + 3)
            ? (h >= 2) : true; // South 0x578e0b
    if (b.waterfall[3]! >= 0 && tile >= b.waterfall[3]! && tile < b.waterfall[3]! + 4)
        return (tile === b.waterfall[3]! || tile === b.waterfall[3]! + 3)
            ? (h !== 2 && h !== 3) : true; // North 0x578e33
    return b.ramps >= 0 && tile >= b.ramps && tile < b.ramps + 20; // 0x578d93
}

// sub_4863D0 (0x4863D0) - does the cell already carry a tile of one of the
// cliff-like families? Same waterfall arms as above, but read off the CELL.
function isCliffFamilyCellBases(b: TileFamilyBases, cell: MapCell): boolean {
    const t = cell.isoTileTypeIndex;
    if (b.cliff >= 0 && t >= b.cliff && t < b.cliff + 40)
        return true; // 0x4863dc
    if (b.waterfall[0]! >= 0 && t >= b.waterfall[0]! && t < b.waterfall[0]! + 4)
        return (t === b.waterfall[0]! || t === b.waterfall[0]! + 3)
            ? (cell.height !== 0 && cell.height !== 4) : true;
    if (b.waterfall[1]! >= 0 && t >= b.waterfall[1]! && t < b.waterfall[1]! + 4)
        return (t === b.waterfall[1]! || t === b.waterfall[1]! + 3)
            ? (cell.height !== 1 && cell.height !== 3) : true;
    if (b.waterfall[2]! >= 0 && t >= b.waterfall[2]! && t < b.waterfall[2]! + 4)
        return (t === b.waterfall[2]! || t === b.waterfall[2]! + 3)
            ? (cell.height >= 2) : true;
    if (b.waterfall[3]! >= 0 && t >= b.waterfall[3]! && t < b.waterfall[3]! + 4)
        return (t === b.waterfall[3]! || t === b.waterfall[3]! + 3)
            ? (cell.height !== 2 && cell.height !== 3) : true;
    if (b.ramps >= 0 && t >= b.ramps && t < b.ramps + 20) return true;
    if (b.caves >= 0 && t >= b.caves && t < b.caves + 4) return true;
    if (b.bridge >= 0 && t >= b.bridge && t < b.bridge + 16) return true;
    if (b.woodBridge >= 0 && t >= b.woodBridge && t < b.woodBridge + 16) return true;
    if (b.destroyable >= 0 && t >= b.destroyable && t < b.destroyable + 2) return true;
    return b.waterCliffs >= 0 && t >= b.waterCliffs && t < b.waterCliffs + 28;
}

/** sub_4863D0 over the Rmg's own family bases. */
export function isCliffFamilyTile(r: Rmg, cell: MapCell | null): boolean {
    if (cell === null)
        return false;
    return isCliffFamilyCellBases(tileFamilyBases(r), cell);
}

// ---------------------------------------------------------------------------
// PlaceIsoTile - sub_57B440 - isotile foundation stamping.
// ---------------------------------------------------------------------------
export function placeIsoTile(r: Rmg, lo: number, hi: number, level: number, genCode: number,
                             placed: Box<boolean>, flag: number): boolean {
    if (flag !== 0)
        genCode = 0; // 0x57b463

    // 1. Geometry lookup by tile index.
    const tile = r.currentBuildingType;
    let fp: IsoFootprint | null = null;
    if (r.shorePieces >= 0 && tile >= r.shorePieces && tile < r.shorePieces + 42)
        fp = kShoreFootprints[tile - r.shorePieces]!;
    else if (r.shoreTileIndex >= 0 && tile >= r.shoreTileIndex &&
        tile < r.shoreTileIndex + 40)
        fp = kCliffFootprints[tile - r.shoreTileIndex]!;
    else if (r.waterCliffsIndex >= 0 && tile >= r.waterCliffsIndex &&
        tile < r.waterCliffsIndex + 28)
        fp = kCliffWaterFootprints[tile - r.waterCliffsIndex]!;
    else if (r.destroyableCliffsIndex >= 0 && tile >= r.destroyableCliffsIndex &&
        tile < r.destroyableCliffsIndex + 2)
        fp = kDestroyableCliffFootprints[tile - r.destroyableCliffsIndex]!;
    else {
        for (let f = 0; f < 4 && fp === null; ++f) {
            if (r.waterFamily4Base[f]! >= 0 && tile >= r.waterFamily4Base[f]! &&
                tile < r.waterFamily4Base[f]! + 4)
                fp = kWaterfallFootprints[f]![tile - r.waterFamily4Base[f]!]!;
        }
    }
    if (fp === null)
        return false; // no image: 0x57b486
    if (fp.h <= 0)
        return true; // 0x57b49c

    const families = tileFamilyBases(r);

    const cx = unpX(r.fpCenter);
    const cy = unpYS(r.fpCenter);
    let zIndex = 0; // occupied-cell counter

    // 2. Foundation loop (0x57b4a2): rows [0, h) then cols [0, w).
    for (let row = 0; row < fp.h; ++row) {
        for (let col = 0; col < fp.w; ++col) {
            if (!maskBit(fp.mask, row * fp.w + col))
                continue; // frame == null
            const z = fp.z[zIndex] ?? 0;
            ++zIndex;

            const x = cx + col;
            const y = cy + row;
            if (!r.cellExists(x, y))
                continue; // 0x57b516
            const cell = r.cellSlots[512 * y + x]!;
            const h = col + row * fp.w; // 0x57b555

            // 3. Occupancy preamble (0x57b571 - 0x57b628).
            const wi = x + r.size.workSide * y;
            const wc = (flag !== 0) ? 0 : r.work.i(wi, 14);

            // Port extension: record per-footprint-cell stamp/block outcomes
            // for CliffSet pieces so repairCliffPieces can fix swallowed pieces.
            const recordCliff = (okx: number): void => {
                if (genCode === -1 && r.shoreTileIndex >= 0
                    && tile >= r.shoreTileIndex && tile < r.shoreTileIndex + 40) {
                    r.cliffStamps.push({
                        ox: i16(cx),
                        oy: i16(cy),
                        x: i16(x),
                        y: i16(y),
                        slot: (tile - r.shoreTileIndex + 1) & 0xff,
                        h: h & 0xff,
                        z: (z << 24) >> 24,
                        ok: okx & 0xff,
                    });
                }
            };

            if (flag === 0 && wc > 0 && wc !== genCode && genCode !== -1) {
                if (!r.isPlaceholderTile(cell)) {
                    const nOld = cell.isoTileTypeIndex - r.shorePieces;
                    const nNew = tile - r.shorePieces;
                    if (nOld < 0 || nNew < 0 || nOld > 41 || nNew > 41 ||
                        kShoreVariantSide[nOld] !== kShoreVariantSide[nNew]) {
                        placed.v = false; // 0x57b718
                        return false;
                    }
                    return true; // 0x57b703
                }
                r.work.setI(wi, 14, genCode); // 0x57b623
            } else if (wc === genCode) { // LABEL_19 -> LABEL_20
                const nOld = cell.isoTileTypeIndex - r.shorePieces;
                const nNew = tile - r.shorePieces;
                if (nOld >= 0 && nNew >= 0 && nOld <= 41 && nNew <= 41) {
                    let d = kShoreVariantTurn[nOld] - kShoreVariantTurn[nNew];
                    if (d < 0)
                        d = -d;
                    if (d >= 3 && d <= 5) {
                        placed.v = false; // 0x57b72b
                        return false;
                    }
                }
            } else if (!r.isPlaceholderTile(cell)) {
                if (genCode !== -1) {
                    placed.v = false; // LABEL_58 / 0x57b77d
                    return false;
                }
                if (r.shoreTileIndex >= 0 && tile >= r.shoreTileIndex
                    && tile < r.shoreTileIndex + 40)
                    recordCliff(0);
                continue; // LABEL_36: leave it be
            } else {
                r.work.setI(wi, 14, genCode); // 0x57b6cc
            }

            // 4. LABEL_32 - the per-cell acceptance gate (0x57b64a).
            if (r.isPlaceholderTile(cell) ||
                (cell.isoTileTypeIndex >= lo && cell.isoTileTypeIndex <= hi)) {
                // Keep the image sub-index only when the tile really has that
                // cell (see the C++ comment on RecalcAttributes wiping).
                let subCell = h;
                const first = (tile >= 0 && tile < r.tileCellAttrs.length
                    && r.tileCellAttrs[tile]!.length > 0)
                    ? r.tileCellAttrs[tile]![0]!
                    : null;
                if (first !== null) {
                    const cells = first.cellsInX * first.cellsInY;
                    if (cells > 0 && h >= cells)
                        subCell = 0;
                }

                cell.isoTileTypeIndex = tile;
                cell.height = subCell;
                cell.level = level + z;
                if (r.shoreTileIndex >= 0 && tile >= r.shoreTileIndex &&
                    tile < r.shoreTileIndex + 40)
                    recordCliff(1);
                continue; // LABEL_36
            }

            // 5. Rejection (0x57b774).
            const existingIsShore =
                (cell.isoTileTypeIndex >= r.shorePieces &&
                    cell.isoTileTypeIndex < r.shorePieces + 42);
            if ((existingIsShore && tileFitsFoundation(families, tile, h)) ||
                (tile >= r.shorePieces && tile < r.shorePieces + 42 &&
                    isCliffFamilyCellBases(families, cell))) {
                placed.v = false; // 0x57b77d
            }
            if (r.shoreTileIndex >= 0 && tile >= r.shoreTileIndex
                && tile < r.shoreTileIndex + 40)
                recordCliff(0);
            return false; // 0x57b6aa
        }
    }

    placed.v = true;
    return true; // 0x57b6b3
}

// ---------------------------------------------------------------------------
// RepairCliffPieces - PORT-ONLY post pass (runs right after CorrectCliffTiles).
// ---------------------------------------------------------------------------
export function repairCliffPieces(r: Rmg): void {
    if (r.shoreTileIndex < 0) {
        r.cliffStamps.length = 0;
        return;
    }

    const isCliffTile = (t: number): boolean =>
        t >= r.shoreTileIndex && t < r.shoreTileIndex + 40;

    // CorrectCliffTiles swaps pieces inside these slot clusters, so a
    // surviving cell of a damaged piece may carry any cluster mate afterwards.
    // Arguments are 0-BASED family indices (tile - shoreTileIndex, 0..39).
    const clusterOf = (s: number): number => {
        if (s >= 3 && s <= 5) return 1;
        if (s >= 7 && s <= 9) return 2;
        if (s >= 10 && s <= 12) return 3;
        if (s >= 13 && s <= 15) return 4;
        if (s >= 21 && s <= 23) return 5;
        if (s >= 33 && s <= 35) return 6;
        return 0;
    };

    const stillHoldsPiece = (c: MapCell | null, slot1: number): boolean => {
        if (c === null || !isCliffTile(c.isoTileTypeIndex))
            return false;
        const idx = c.isoTileTypeIndex - r.shoreTileIndex;
        // Slots 4-7 (1-based) end up as indices 3..6 (slot 7 never swaps);
        // every other damaged piece only needs its own swap cluster to match.
        if (slot1 >= 4 && slot1 <= 7)
            return idx >= 3 && idx <= 6;
        return clusterOf(idx) === clusterOf(slot1 - 1);
    };

    const writeTile = (x: number, y: number, tile: number, height: number): void => {
        if (!r.cellExists(i16(x), i16(y)))
            return;
        const c = r.cellAt(i16(x), i16(y));
        diag(`CLIFF-REPAIR (${x},${y}) t${c.isoTileTypeIndex}/h${c.height} -> t${tile}/h${height} L${c.level}`);
        c.isoTileTypeIndex = tile;
        c.height = height & 0xff;
    };

    const tWallCap = r.shoreTileIndex + 33;  // C34  1x1 inner corner, z4
    const tVStrip = r.shoreTileIndex + 7;    // C8   1x2 vertical wall
    const tFlatBase = r.shoreTileIndex + 11; // C12..C14 flat caps, z0

    // ---- A. damaged multi-cell pieces (outcomes are contiguous per piece) ---
    let i = 0;
    while (i < r.cliffStamps.length) {
        const first = r.cliffStamps[i]!;
        let j = i;
        let blockedMask = 0;
        while (j < r.cliffStamps.length
            && r.cliffStamps[j]!.ox === first.ox
            && r.cliffStamps[j]!.oy === first.oy
            && r.cliffStamps[j]!.slot === first.slot) {
            if (r.cliffStamps[j]!.ok === 0)
                blockedMask |= 1 << r.cliffStamps[j]!.h;
            ++j;
        }

        if (blockedMask !== 0) {
            const slot = first.slot;

            // A1: 2x2 wall whose east column (h1/h3) is the only blocked part.
            const eastColumnBlocked =
                (blockedMask === ((1 << 1) | (1 << 3)));
            let haveH0 = false, haveH2 = false;
            for (let k = i; k < j; ++k) {
                const o = r.cliffStamps[k]!;
                if (o.ok === 0)
                    continue;
                if (o.h === 0) haveH0 = true;
                if (o.h === 2) haveH2 = true;
            }

            if (slot >= 4 && slot <= 7 && eastColumnBlocked && haveH0 && haveH2) {
                const top = r.cellAt(i16(first.ox), i16(first.oy));
                const foot = r.cellAt(i16(first.ox), i16(first.oy + 1));
                if (stillHoldsPiece(top, slot) && top.level >= 7
                    && stillHoldsPiece(foot, slot) && foot.level <= 5) {
                    writeTile(first.ox, first.oy, tVStrip, 0);
                    writeTile(first.ox, first.oy + 1, tVStrip, 1);
                }
            } else {
                // A2: take the surviving cells apart into 1x1 pieces.
                for (let k = i; k < j; ++k) {
                    const o = r.cliffStamps[k]!;
                    if (o.ok === 0)
                        continue;
                    const c = r.cellAt(i16(o.x), i16(o.y));
                    if (!stillHoldsPiece(c, slot))
                        continue;
                    if (o.z >= 4) {
                        writeTile(o.x, o.y, tWallCap, 0);
                    } else {
                        const pick = (o.ox + o.oy + o.h) % 3;
                        writeTile(o.x, o.y, tFlatBase + pick, 0);
                    }
                }
            }
        }

        i = j;
    }

    r.cliffStamps.length = 0;
}

// ---------------------------------------------------------------------------
// CliffCellsInX - Array.Items[tile]->CellsInX for a CliffSet tile.
// ---------------------------------------------------------------------------
export function cliffCellsInX(r: Rmg, tile: number): number {
    const slot = tile - r.shoreTileIndex;
    if (slot < 0 || slot >= 40)
        return 1;
    return kCliffFootprints[slot]!.w;
}

// ---------------------------------------------------------------------------
// IsRampArtCell / IsBigRampPiece / IsCliffWallRiding / CliffPieceHitsRamp /
// TrimCliffPieceForRamp - port-only pre-stamp ramp-collision handling.
// ---------------------------------------------------------------------------
export function isRampArtCell(r: Rmg, n: MapCell | null): boolean {
    if (n === null)
        return false;
    if (n.slopeIndex !== 0)
        return true;
    const t = n.isoTileTypeIndex;
    return (r.cliffRampsIndex >= 0
        && t >= r.cliffRampsIndex && t < r.cliffRampsIndex + 20)
        || (r.rampBaseIndex >= 0
            && t >= r.rampBaseIndex && t < r.rampBaseIndex + 15)
        || (r.slopeSetPiecesIndex >= 0
            && t >= r.slopeSetPiecesIndex && t < r.slopeSetPiecesIndex + 10);
}

export function isBigRampPiece(r: Rmg, n: MapCell | null): boolean {
    if (n === null)
        return false;
    const t = n.isoTileTypeIndex;
    return r.slopeSetPiecesIndex >= 0
        && t >= r.slopeSetPiecesIndex && t < r.slopeSetPiecesIndex + 10;
}

export function isCliffWallRiding(r: Rmg, wx: number, wy: number, wallLevel: number): boolean {
    // Step 1: sum the direction vectors of every high neighbour (Level >=
    // wallLevel) to get the "high ground direction" (the facade points the
    // opposite way). Step 2: the 8-direction index closest to the facade
    // direction. Step 3: only check that direction (orthogonal: any ramp) and
    // its diagonal (big multi-cell ramp pieces).
    let highX = 0, highY = 0;
    for (let d = 0; d < 8; ++d) {
        const nx = i16(wx + DIR_X[d]!);
        const ny = i16(wy + DIR_Y[d]!);
        if (!r.cellExists(nx, ny))
            continue;
        const n = r.cellAt(nx, ny);
        if (n.level >= wallLevel) {
            highX += DIR_X[d]!;
            highY += DIR_Y[d]!;
        }
    }
    const faceX = -highX;
    const faceY = -highY;

    let bestDir = -1;
    let bestDot = -1000;
    for (let d = 0; d < 8; ++d) {
        const dot = DIR_X[d]! * faceX + DIR_Y[d]! * faceY;
        if (dot > bestDot) {
            bestDot = dot;
            bestDir = d;
        }
    }
    if (bestDir < 0)
        return false;

    let lowRamp = false;
    let topRamp = false;
    // Only the cell directly in front of the facade can be ridden by the wall.
    {
        const d = bestDir;
        const nx = i16(wx + DIR_X[d]!);
        const ny = i16(wy + DIR_Y[d]!);
        if (r.cellExists(nx, ny)) {
            const n = r.cellAt(nx, ny);
            const isRamp = (d % 2 === 0) ? isRampArtCell(r, n)
                : isBigRampPiece(r, n);
            if (isRamp) {
                if (n.level <= wallLevel - 2) {
                    lowRamp = true;
                    // 斜对角的大坡格只有在坡面真的伸到墙立面下方时才算骑坡
                    // （详见 C++ 注释）。
                    if ((d & 1) !== 0) {
                        const gx = r.cellAt(i16(wx + DIR_X[d]!), i16(wy));
                        const gy = r.cellAt(i16(wx), i16(wy + DIR_Y[d]!));
                        const rl = n.level;
                        if ((!isRampArtCell(r, gx) && gx.level <= rl)
                            || (!isRampArtCell(r, gy) && gy.level <= rl)) {
                            lowRamp = false;
                        }
                    }
                }
                if (n.level >= wallLevel - 1)
                    topRamp = true;
            }
        }
    }
    diag(`RIDING (${wx},${wy}) L${wallLevel} faceDir=${bestDir} low=${lowRamp ? 1 : 0} top=${topRamp ? 1 : 0}`);
    return lowRamp && !topRamp;
}

export function cliffPieceHitsRamp(r: Rmg, anchor: MapCell | null, slot: number): boolean {
    if (anchor === null || slot < 1 || slot > 40)
        return false;

    const fp = kCliffFootprints[slot - 1]!;
    const ax = i16(anchor.mapCoords & 0xffff);
    const ay = i16(anchor.mapCoords >>> 16);
    const baseLevel = anchor.level;

    let zIndex = 0;
    for (let row = 0; row < fp.h; ++row) {
        for (let col = 0; col < fp.w; ++col) {
            if (!maskBit(fp.mask, row * fp.w + col))
                continue;
            const z = fp.z[zIndex] ?? 0;
            ++zIndex;
            const x = ax + col;
            const y = ay + row;
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            const c = r.cellAt(i16(x), i16(y));
            if (z >= 4) {
                // Wall cell: riding the ramp facade is the original conflict.
                if (isCliffWallRiding(r, x, y, baseLevel + z))
                    return true;
            } else {
                // Foot cell: if it lands on ramp art the wall has no base and
                // floats over the ramp body.
                if (isRampArtCell(r, c))
                    return true;
            }
        }
    }
    return false;
}

// Re-stamp the footprint cells of a rejected piece as smaller CliffSet art.
// Only placeholder cells are written, so ramp / plateau art is never touched.
export function trimCliffPieceForRamp(r: Rmg, anchor: MapCell, slot: number): number {
    const fp = kCliffFootprints[slot - 1]!;
    const ax = i16(anchor.mapCoords & 0xffff);
    const ay = i16(anchor.mapCoords >>> 16);
    const baseLevel = anchor.level;

    interface CellRef { x: number; y: number; h: number; level: number; }
    const walls: CellRef[] = [];
    const feet: CellRef[] = [];
    let zIndex = 0;
    for (let row = 0; row < fp.h; ++row) {
        for (let col = 0; col < fp.w; ++col) {
            if (!maskBit(fp.mask, row * fp.w + col))
                continue;
            const z = fp.z[zIndex] ?? 0;
            ++zIndex;
            const x = ax + col;
            const y = ay + row;
            if (!r.cellExists(i16(x), i16(y)))
                continue;
            const c = r.cellAt(i16(x), i16(y));
            if (!r.isPlaceholderTile(c))
                continue; // ramp / art: keep it
            const newLevel = baseLevel + z;
            if (z >= 4 && isCliffWallRiding(r, x, y, newLevel))
                continue; // the rejected side
            const ref: CellRef = { x, y, h: row * fp.w + col, level: newLevel };
            if (z >= 4) walls.push(ref);
            else feet.push(ref);
        }
    }

    let written = 0;
    // Nothing has been stamped yet, so like placeIsoTile the wall cells must
    // also be RAISED to their piece level (anchor L4 + z4 = L8); feet keep
    // the anchor level.
    const write = (x: number, y: number, tile: number, height: number, level: number): void => {
        const c = r.cellAt(i16(x), i16(y));
        if (!r.isPlaceholderTile(c))
            return;
        diag(`CLIFF-TRIM slot=${slot} (${x},${y}) -> t${tile}/h${height} L${level}`);
        c.isoTileTypeIndex = tile;
        c.height = height & 0xff;
        c.level = level;
        ++written;
    };

    const tVStrip = r.shoreTileIndex + 7;   // C8
    const tWallCap = r.shoreTileIndex + 33; // C34
    const tFlatBase = r.shoreTileIndex + 11; // C12..C14

    // C8: surviving west column h0 (wall z4) + h2 (foot z0) of a 2x2 wall.
    if (slot >= 4 && slot <= 7 && baseLevel + 4 >= 7 && baseLevel <= 5) {
        const has = (hh: number): boolean => {
            for (const w of walls) if (w.h === hh) return true;
            for (const f of feet) if (f.h === hh) return true;
            return false;
        };
        if (has(0) && has(2)) {
            write(ax, ay, tVStrip, 0, baseLevel + 4);
            write(ax, ay + 1, tVStrip, 1, baseLevel);
            return written;
        }
    }

    for (const w of walls)
        write(w.x, w.y, tWallCap, 0, w.level);
    for (const f of feet)
        write(f.x, f.y, tFlatBase + (ax + ay + f.h) % 3, 0, f.level);
    return written;
}

// ---------------------------------------------------------------------------
// BuildWaterRing - sub_5A0700 - ring 0 of a water body. Returns packed
// CellStruct coords, one entry per outside neighbour (never de-duplicated).
// ---------------------------------------------------------------------------
export function buildWaterRing(r: Rmg, genCode: number): number[] {
    const ring: number[] = [];
    const side = r.size.workSide;

    for (let idx = 0; idx < side * side; ++idx) {
        const coords = r.work.i(idx, 0); // MapCoords
        if (coords === 0)
            continue;
        const x = unpX(coords);
        const y = unpYS(coords);
        if (r.work.i(x + side * y, 14) !== genCode)
            continue;

        for (let dir = 0; dir < 8; ++dir) {
            const nx = i16(x + DIR_X[dir]!);
            const ny = i16(y + DIR_Y[dir]!);
            if (!r.cellExists(nx, ny))
                continue;
            if (r.work.i(nx + side * ny, 14) === genCode)
                continue; // still ours
            ring.push(packXY(x, y));
        }
    }
    return ring;
}

// ---------------------------------------------------------------------------
// IsWaterFamilyTile - sub_4865D0 - water / shore tile family test.
// ---------------------------------------------------------------------------
export function isWaterFamilyTile(r: Rmg, cell: MapCell | null): boolean {
    if (cell === null)
        return false;

    const tile = cell.isoTileTypeIndex;
    if (tile >= r.shorePieces && tile < r.shorePieces + 42)
        return true;
    if (tile >= r.waterTileIndex && tile < r.waterTileIndex + 14)
        return true;
    for (let i = 0; i < 4; ++i) {
        if (tile >= r.waterFamily4Base[i]! && tile < r.waterFamily4Base[i]! + 4)
            return true;
    }
    return false;
}

// ---------------------------------------------------------------------------
// IsShoreTile - sub_4865B0 - the shore family test alone.
// ---------------------------------------------------------------------------
export function isShoreTile(r: Rmg, cell: MapCell | null): boolean {
    if (cell === null)
        return false;

    const tile = cell.isoTileTypeIndex;
    return (r.shorePieces >= 0 && tile >= r.shorePieces && tile < r.shorePieces + 42);
}

// ---------------------------------------------------------------------------
// IsGreenGroundTile - sub_4867B0 - green-ground family test.
// ---------------------------------------------------------------------------
export function isGreenGroundTile(r: Rmg, cell: MapCell | null): boolean {
    if (cell === null)
        return false;

    const tile = cell.isoTileTypeIndex;
    return tile === r.greenTileIndex
        || (tile >= r.clearToGreenLatIndex
            && tile < r.clearToGreenLatIndex + 16);
}

// ---------------------------------------------------------------------------
// The four pave-family tile tests of the lateral-corridor builder (sub_58F2C0).
// ---------------------------------------------------------------------------
export function isPavedRoadTile(r: Rmg, cell: MapCell | null): boolean {
    if (cell === null)
        return false;
    const tile = cell.isoTileTypeIndex;
    return tile >= r.pavedRoadsIndex && tile < r.pavedRoadsIndex + 15;
}

export function isPavedRoadEndTile(r: Rmg, cell: MapCell | null): boolean {
    if (cell === null)
        return false;
    const tile = cell.isoTileTypeIndex;
    return tile >= r.pavedRoadEndsIndex && tile < r.pavedRoadEndsIndex + 4;
}

export function isMiscPaveTile(r: Rmg, cell: MapCell | null): boolean {
    if (cell === null)
        return false;
    const tile = cell.isoTileTypeIndex;
    return tile >= r.miscPaveTileIndex && tile < r.miscPaveTileIndex + 14;
}

export function isPaveTile(r: Rmg, cell: MapCell | null): boolean {
    if (cell === null)
        return false;
    const tile = cell.isoTileTypeIndex;
    return tile >= r.paveTileIndex && tile < r.paveTileIndex + 16;
}

// ---------------------------------------------------------------------------
// ExpandWaterBody - sub_5A0160 - ring expansion / absorption. No RNG.
// ---------------------------------------------------------------------------
export function expandWaterBody(r: Rmg, genCode: number, mode: number, centerX: number,
                                centerY: number, rangeX: number, rangeY: number,
                                flag: number, level: number): boolean {
    let ring = buildWaterRing(r, genCode);

    for (let step = 0; step < mode; ++step) {
        const next: number[] = [];

        for (let k = 0; k < ring.length; ++k) {
            const src = ring[k]!;
            const sx = unpX(src);
            const sy = unpYS(src);
            for (let dir = 0; dir < 8; ++dir) {
                const nx = i16(sx + DIR_X[dir]!);
                const ny = i16(sy + DIR_Y[dir]!);

                if (!r.cellExists(nx, ny))
                    continue;
                if (nx < centerX || nx >= centerX + rangeX ||
                    ny < centerY || ny >= centerY + rangeY)
                    continue; // rect window

                const wi = nx + r.size.workSide * ny;
                const code = r.work.i(wi, 14);
                const previousGeneration = (flag !== 0 && code === genCode - 1);
                const cell = r.cellSlots[512 * ny + nx]!;

                if ((code === 0 || previousGeneration) &&
                    (r.isPlaceholderTile(cell) ||
                        (previousGeneration && isWaterFamilyTile(r, cell)))) {
                    next.push(packXY(nx, ny));
                    r.work.setI(wi, 14, genCode);
                    if (flag !== 0 && r.isPlaceholderTile(cell))
                        cell.level = level;
                } else if (code !== genCode) {
                    return false; // pollution 0x5a03fd
                }
            }
        }
        ring = next;
    }
    return true;
}

// ---------------------------------------------------------------------------
// DecorateWaterTiles - sub_59C630 - water-detail pass over open water.
// ---------------------------------------------------------------------------
export function decorateWaterTiles(r: Rmg): void {
    const it = new CellIterator();
    it.reset(r.cellSlots, r.size.mapWidth);
    for (let cell = it.next(); cell !== null; cell = it.next()) {
        // Plain open water only: WaterSet base tile, flat (Height 0).
        if (cell.isoTileTypeIndex !== r.waterTileIndex || cell.height !== 0)
            continue;

        const nE = r.getNeighbourCell(cell, 2);
        const nS = r.getNeighbourCell(cell, 4);
        const nSE = r.getNeighbourCell(cell, 3);

        const plain =
            nE.isoTileTypeIndex === r.waterTileIndex && nE.height === 0 &&
            nS.isoTileTypeIndex === r.waterTileIndex && nS.height === 0 &&
            nSE.isoTileTypeIndex === r.waterTileIndex && nSE.height === 0;

        let variant = !plain;
        if (plain) {
            let n10: number;
            do {
                n10 = F2I64((r.rng.next() >>> 0) * 10.0 * K_UNIT_SCALE + 1.0);
            } while (n10 > 10);
            variant = (n10 === 1);
        }

        if (variant) {
            let n200: number;
            do {
                n200 = F2I64((r.rng.next() >>> 0) * 201.0 * K_UNIT_SCALE);
            } while (n200 > 200);
            cell.isoTileTypeIndex = Math.trunc(n200 / 40) + r.waterTileIndex + 8;
        } else {
            let n242: number;
            do {
                n242 = F2I64((r.rng.next() >>> 0) * 242.0 * K_UNIT_SCALE);
            } while (n242 > 241);
            const sub = (n242 < 240) ? Math.trunc(n242 / 40) : (247 - n242);

            const packedCoords = cell.mapCoords;
            const genCode =
                r.work.i(r.workIndex(packedCoords & 0xffff, packedCoords >>> 16), 14);
            placeWaterDetailTile(r, r.waterTileIndex + sub, packedCoords, genCode, -1);
        }
    }
}

// ---------------------------------------------------------------------------
// sub_5A6C10 - multi-cell tile stamping anchored at an explicit cell.
// ---------------------------------------------------------------------------
export function placeWaterDetailTile(r: Rmg, tileIndex: number, packedCoords: number,
                                     genCode: number, level: number): void {
    // Geometry lookup: the eight water-detail pieces, the ten SlopeSetPieces,
    // then the same family tables placeIsoTile applies.
    let fp: IsoFootprint | null = null;
    if (r.waterTileIndex >= 0 && tileIndex >= r.waterTileIndex &&
        tileIndex < r.waterTileIndex + 8)
        fp = k2x2Footprint;
    else if (r.slopeSetPiecesIndex >= 0 && tileIndex >= r.slopeSetPiecesIndex &&
        tileIndex < r.slopeSetPiecesIndex + 10)
        fp = kSlopeSetPieceFootprints[tileIndex - r.slopeSetPiecesIndex]!;
    else
        fp = findFamilyFootprint(r, tileIndex);
    if (fp === null)
        return; // no image: 0x5a6c32

    const anchorX = unpX(packedCoords);
    const anchorY = unpYS(packedCoords);
    let zIndex = 0; // occupied-cell counter

    for (let row = 0; row < fp.h; ++row) { // CellsInY
        for (let col = 0; col < fp.w; ++col) { // CellsInX
            if (!maskBit(fp.mask, row * fp.w + col))
                continue; // frame == null: 0x5a6ce2
            const z = fp.z[zIndex] ?? 0;
            ++zIndex;

            const x = i16(anchorX + col);
            const y = i16(anchorY + row);
            if (!r.cellExists(x, y))
                continue; // 0x5a6cb4

            const cell = r.cellAt(x, y);
            cell.height = col + row * fp.w;   // 0x5a6cea
            cell.isoTileTypeIndex = tileIndex; // 0x5a6cf4
            if (level !== -1)                  // 0x5a6cfa
                cell.level = level + z - 4;    // + frame[+0x28]
            cell.slopeIndex = 0;               // frame[+0x2A]: not tabulated
            r.work.setI(r.workIndex(x, y), 14, genCode); // 0x5a6d3a
        }
    }
}

// The footprint of one isotile, resolved from the family tables by the very
// rule placeIsoTile applies: the shore set (42), the cliff set (40), the
// cliff/water pieces (28), the destroyable cliffs (2) and the four waterfall
// sets (4 each). null for a tile that is none of them.
function findFamilyFootprint(r: Rmg, tile: number): IsoFootprint | null {
    if (r.shorePieces >= 0 && tile >= r.shorePieces && tile < r.shorePieces + 42)
        return kShoreFootprints[tile - r.shorePieces]!;
    if (r.shoreTileIndex >= 0 && tile >= r.shoreTileIndex && tile < r.shoreTileIndex + 40)
        return kCliffFootprints[tile - r.shoreTileIndex]!;
    if (r.waterCliffsIndex >= 0 && tile >= r.waterCliffsIndex &&
        tile < r.waterCliffsIndex + 28)
        return kCliffWaterFootprints[tile - r.waterCliffsIndex]!;
    if (r.destroyableCliffsIndex >= 0 && tile >= r.destroyableCliffsIndex &&
        tile < r.destroyableCliffsIndex + 2)
        return kDestroyableCliffFootprints[tile - r.destroyableCliffsIndex]!;
    for (let f = 0; f < 4; ++f) {
        if (r.waterFamily4Base[f]! >= 0 && tile >= r.waterFamily4Base[f]! &&
            tile < r.waterFamily4Base[f]! + 4)
            return kWaterfallFootprints[f]![tile - r.waterFamily4Base[f]!]!;
    }
    return null;
}

// ---------------------------------------------------------------------------
// LoadTheaterTiles - the [General] tile-range snapshots of
// IsometricTileTypeClass::ReadINI (0x545150). Walks the [TileSetNNNN]
// sections in numeric order, accumulates TilesInSet, and takes the running
// total just before the named section.
// ---------------------------------------------------------------------------
export function loadTheaterTiles(r: Rmg, theater: number): void {
    // r.theaterIniPath mirrors the C++ candidate paths
    // (exe dir / parent / 相关INI) for TEMPERATMD.INI / SNOWMD.INI.
    const path = r.theaterIniPath(theater) ?? '';

    // Section numbers named by [General].
    const shoreSection = profileInt(path, 'General', 'ShorePieces', -1);
    const waterSection = profileInt(path, 'General', 'WaterSet', -1);
    const cliffSection = profileInt(path, 'General', 'CliffSet', -1);
    const greenTileSection = profileInt(path, 'General', 'GreenTile', -1);
    const clearToGreenLatSection = profileInt(path, 'General', 'ClearToGreenLat', -1);
    const eastSection = profileInt(path, 'General', 'WaterfallEast', -1);
    const westSection = profileInt(path, 'General', 'WaterfallWest', -1);
    const southSection = profileInt(path, 'General', 'WaterfallSouth', -1);
    const northSection = profileInt(path, 'General', 'WaterfallNorth', -1);
    const waterCliffsSection = profileInt(path, 'General', 'WaterCliffs', -1);
    const destroyableCliffsSection = profileInt(path, 'General', 'DestroyableCliffs', -1);
    const cliffRampsSection = profileInt(path, 'General', 'CliffRamps', -1);
    const waterCavesSection = profileInt(path, 'General', 'WaterCaves', -1);
    const bridgeSetSection = profileInt(path, 'General', 'BridgeSet', -1);
    const woodBridgeSetSection = profileInt(path, 'General', 'WoodBridgeSet', -1);
    const rampBaseSection = profileInt(path, 'General', 'RampBase', -1);
    const slopeSetPiecesSection = profileInt(path, 'General', 'SlopeSetPieces', -1);

    // The rest of the tile-family keys (SetupLAT sub_47CA80 is the consumer).
    const rampSmoothSection = profileInt(path, 'General', 'RampSmooth', -1);
    const mmRampBaseSection = profileInt(path, 'General', 'MMRampBase', -1);
    const clearTileSection = profileInt(path, 'General', 'ClearTile', -1);
    const roughTileSection = profileInt(path, 'General', 'RoughTile', -1);
    const sandTileSection = profileInt(path, 'General', 'SandTile', -1);
    const clearToRoughLatSection = profileInt(path, 'General', 'ClearToRoughLat', -1);
    const clearToSandLatSection = profileInt(path, 'General', 'ClearToSandLat', -1);
    const clearToPaveLatSection = profileInt(path, 'General', 'ClearToPaveLat', -1);
    const heightBaseSection = profileInt(path, 'General', 'HeightBase', -1);
    const blackTileSection = profileInt(path, 'General', 'BlackTile', -1);
    const slopeSetPieces2Section = profileInt(path, 'General', 'SlopeSetPieces2', -1);
    const monorailSlopesSection = profileInt(path, 'General', 'MonorailSlopes', -1);
    const tunnelsSection = profileInt(path, 'General', 'Tunnels', -1);
    const trackTunnelsSection = profileInt(path, 'General', 'TrackTunnels', -1);
    const dirtTunnelsSection = profileInt(path, 'General', 'DirtTunnels', -1);
    const dirtTrackTunnelsSection = profileInt(path, 'General', 'DirtTrackTunnels', -1);
    const mediansSection = profileInt(path, 'General', 'Medians', -1);
    const roughGroundSection = profileInt(path, 'General', 'RoughGround', -1);
    const dirtRoadJunctionSection = profileInt(path, 'General', 'DirtRoadJunction', -1);
    const dirtRoadCurveSection = profileInt(path, 'General', 'DirtRoadCurve', -1);
    const dirtRoadStraightSection = profileInt(path, 'General', 'DirtRoadStraight', -1);
    const pavedRoadSlopesSection = profileInt(path, 'General', 'PavedRoadSlopes', -1);
    const dirtRoadSlopesSection = profileInt(path, 'General', 'DirtRoadSlopes', -1);
    const rocksSection = profileInt(path, 'General', 'Rocks', -1);
    const waterBridgeSection = profileInt(path, 'General', 'WaterBridge', -1);
    // The four pave families sub_4866D0 / sub_4866F0 / sub_486650 / sub_486670
    // test and sub_58F2C0 stamps with.
    const pavedRoadsSection = profileInt(path, 'General', 'PavedRoads', -1);
    const pavedRoadEndsSection = profileInt(path, 'General', 'PavedRoadEnds', -1);
    const miscPaveTileSection = profileInt(path, 'General', 'MiscPaveTile', -1);
    const paveTileSection = profileInt(path, 'General', 'PaveTile', -1);

    // Collect every [TileSetNNNN] section with its TilesInSet.
    const sets: Array<{ section: number; tiles: number }> = [];
    const sectionNames = profileSectionNames(path);
    for (const s of sectionNames) {
        if (s.slice(0, 7).toUpperCase() !== 'TILESET')
            continue; // _strnicmp(s, "TileSet", 7)
        const section = atoiPrefix(s.slice(7));
        const tiles = profileInt(path, s, 'TilesInSet', 0);
        sets.push({ section, tiles });
    }
    sets.sort((a, b) => (a.section - b.section) || (a.tiles - b.tiles));

    // ---- per-tile Morphable flag -----------------------------------------
    // CCINIClass::ReadBool decides on the uppercased FIRST character of the
    // value: '0'/'F'/'N' -> false, '1'/'T'/'Y' -> true, anything else
    // (including a missing value) -> the default, false.
    {
        let total = 0;
        for (let i = 0; i < sets.length; ++i)
            total += sets[i]!.tiles;

        r.tileMorphable = new Uint8Array(total);

        let running = 0;
        for (let i = 0; i < sets.length; ++i) {
            const sectionName = 'TileSet' + String(sets[i]!.section).padStart(4, '0');
            const value = profileString(path, sectionName, 'Morphable', '');

            const lead = value.length > 0 ? value.charAt(0).toUpperCase() : '';
            if (lead === '1' || lead === 'T' || lead === 'Y') {
                for (let k = 0; k < sets[i]!.tiles; ++k)
                    r.tileMorphable[running + k] = 1;
            }

            running += sets[i]!.tiles;
        }
    }

    // Running tile count in section order, up to (excluding) `section`.
    const startOf = (section: number): number => {
        if (section < 0)
            return -1;
        let cum = 0;
        for (let i = 0; i < sets.length; ++i) {
            if (sets[i]!.section >= section)
                break;
            cum += sets[i]!.tiles;
        }
        return cum;
    };

    r.shorePieces = startOf(shoreSection);
    r.waterTileIndex = startOf(waterSection);
    r.shoreTileIndex = startOf(cliffSection);
    r.greenTileIndex = startOf(greenTileSection);
    r.rampBaseIndex = startOf(rampBaseSection);
    r.slopeSetPiecesIndex = startOf(slopeSetPiecesSection);
    r.rampSmoothIndex = startOf(rampSmoothSection);
    r.mmRampBaseIndex = startOf(mmRampBaseSection);
    r.clearTileIndex = startOf(clearTileSection);
    r.roughTileIndex = startOf(roughTileSection);
    r.sandTileIndex = startOf(sandTileSection);
    r.clearToRoughLatIndex = startOf(clearToRoughLatSection);
    r.clearToSandLatIndex = startOf(clearToSandLatSection);
    r.clearToPaveLatIndex = startOf(clearToPaveLatSection);
    if (process.env.RMG_DEBUG_STAMP)
        diag(`TILE-FAMILY clear=${r.clearTileIndex} green=${r.greenTileIndex} rough=${r.roughTileIndex} sand=${r.sandTileIndex} `
            + `latRough=${r.clearToRoughLatIndex} latSand=${r.clearToSandLatIndex} latGreen=${r.clearToGreenLatIndex} latPave=${r.clearToPaveLatIndex} `
            + `rampBase=${r.rampBaseIndex} shore=${r.shoreTileIndex} shorePieces=${r.shorePieces} pave=${r.paveTileIndex}`);
    r.heightBaseIndex = startOf(heightBaseSection);
    r.blackTileIndex = startOf(blackTileSection);
    r.slopeSetPieces2Index = startOf(slopeSetPieces2Section);
    r.monorailSlopesIndex = startOf(monorailSlopesSection);
    r.tunnelsIndex = startOf(tunnelsSection);
    r.trackTunnelsIndex = startOf(trackTunnelsSection);
    r.dirtTunnelsIndex = startOf(dirtTunnelsSection);
    r.dirtTrackTunnelsIndex = startOf(dirtTrackTunnelsSection);
    r.mediansIndex = startOf(mediansSection);
    r.roughGroundIndex = startOf(roughGroundSection);
    r.dirtRoadJunctionIndex = startOf(dirtRoadJunctionSection);
    r.dirtRoadCurveIndex = startOf(dirtRoadCurveSection);
    r.dirtRoadStraightIndex = startOf(dirtRoadStraightSection);
    r.pavedRoadSlopesIndex = startOf(pavedRoadSlopesSection);
    r.dirtRoadSlopesIndex = startOf(dirtRoadSlopesSection);
    r.rocksIndex = startOf(rocksSection);
    r.waterBridgeIndex = startOf(waterBridgeSection);
    r.pavedRoadsIndex = startOf(pavedRoadsSection);
    r.pavedRoadEndsIndex = startOf(pavedRoadEndsSection);
    r.miscPaveTileIndex = startOf(miscPaveTileSection);
    r.paveTileIndex = startOf(paveTileSection);
    r.clearToGreenLatIndex = startOf(clearToGreenLatSection);
    r.waterCliffsIndex = startOf(waterCliffsSection);
    r.destroyableCliffsIndex = startOf(destroyableCliffsSection);
    r.cliffRampsIndex = startOf(cliffRampsSection);
    r.waterCavesIndex = startOf(waterCavesSection);
    r.bridgeSetIndex = startOf(bridgeSetSection);
    r.woodBridgeSetIndex = startOf(woodBridgeSetSection);
    r.waterFamily4Base[0] = startOf(eastSection);
    r.waterFamily4Base[1] = startOf(westSection);
    r.waterFamily4Base[2] = startOf(southSection);
    r.waterFamily4Base[3] = startOf(northSection);
}
