/**
 * Transliteration of G:/MapGenerator MapGenRecalc.cpp - the
 * "RMG: Recalculating cell attributes" stage (sub_598960 @ 0x598e1f -
 * 0x598e9e) and the data layer it needs: the TMP art parsing
 * (LoadTileCellAttrs) and the overlay / ground / tiberium rule tables.
 *
 * Not part of this C++ file (transliterated elsewhere):
 *   - GetMoveError / RebuildMoveZones / FillZoneFromRow / RecordZonePair
 *     -> MapGenStartpoint.cpp (startpoint.ts)
 *   - LoadNeutralTechBuildings / LoadMultiplayerHouses
 *     -> MapGenStartpoint.cpp as well (startpoint.ts, despite the module-map
 *        row naming tech.ts)
 *
 * Port-local duplication (runtime import would close a cycle; the canonical
 * copies live in the modules named):
 *   - PassabilityType values          -> mapGen.ts `Passability`
 *   - K_VISIBLE_OFFSET_X / _Y         -> mapGen.ts
 *   - IsWithinUsableArea (0x578460)   -> makingSub.ts
 *   - DIR_X / DIR_Y and the cell model are imported from types.ts (no cycle).
 *
 * This file contains no DiagLog call sites (the C++ has none).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { F2I64 } from './mathTables';
import {
    Box,
    CellIterator,
    DIR_X,
    DIR_Y,
    GroundTypeInfo,
    MapCell,
    OverlayTypeInfo,
    TileCellAttr,
    box,
} from './types';
import {
    atoiPrefix,
    loadIni,
    profileInt,
    profileKeys,
    profileSectionNames,
    profileString,
} from './winapi';
import type { Rmg } from './mapGen';

// ---------------------------------------------------------------------------
// LandType - the 12 floor classes, in the exact order of the engine's string
// table off_81DA28 (read out of the image):
//   0 Clear, 1 Road, 2 Water, 3 Rock, 4 Wall, 5 Tiberium,
//   6 Beach, 7 Rough, 8 Ice, 9 Railroad, 10 Tunnel, 11 Weeds
// ---------------------------------------------------------------------------
const K_LAND_TYPE_NAMES = [
    'Clear', 'Road', 'Water', 'Rock', 'Wall', 'Tiberium',
    'Beach', 'Rough', 'Ice', 'Railroad', 'Tunnel', 'Weeds',
];

/** sub_48DF80 - string -> enum. Unknown name / "<none>" answer -1. */
function parseLandType(text: string | null): number {
    if (text === null || text.toLowerCase() === '<none>') return -1;
    const lower = text.toLowerCase();
    for (let i = 0; i < 12; ++i) {
        if (K_LAND_TYPE_NAMES[i]!.toLowerCase() === lower) return i;
    }
    return -1;
}

// CCINIClass::ReadBool (0x5295F0): the FIRST character of the value decides,
// case-insensitively - '0' / 'F' / 'N' answer false, '1' / 'T' / 'Y' answer
// true, anything else keeps the default.
function parseIniBool(text: string | null, defaultValue: boolean): boolean {
    if (text === null || text.length === 0) return defaultValue;
    switch (text.charAt(0).toUpperCase()) {
        case '0': case 'F': case 'N': return false;
        case '1': case 'T': case 'Y': return true;
        default: return defaultValue;
    }
}

/** C atof: strtod prefix parse; 0.0 when no conversion. */
function atofPrefix(s: string): number {
    const m = /^\s*[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?/.exec(s);
    if (m === null) return 0;
    return parseFloat(m[0]);
}

/** ParseIniPercent - the rules INI's "100%" / "50%" / "0%" spelling. */
function parseIniPercent(text: string | null): number {
    if (text === null) return 0;
    return Math.fround(atofPrefix(text) / 100.0);
}

/** sprintf "%04d" (zero-pad to width 4, sign kept outside the padding). */
function sprintf04d(v: number): string {
    const s = String(Math.trunc(v));
    if (s.startsWith('-')) {
        return s.length >= 4 ? s : '-' + s.slice(1).padStart(3, '0');
    }
    return s.padStart(4, '0');
}

// The winapi INI cache keys on the normalized (forward-slash, lower-cased)
// path, so every loader below hands the helpers this canonical form; openIni
// both primes the cache and stands in for the C++ GetFileAttributesW probe.
function openIni(path: string | null): string | null {
    if (path === null) return null;
    const ini = path.replace(/\\/g, '/').toLowerCase();
    return loadIni(ini) === null ? null : ini;
}

// PassabilityType values (mapGen.ts exports the same table as `Passability`;
// a runtime import would close the mapGen <-> recalc cycle, so the constants
// are mirrored here).
const PT = {
    Passable: 0,
    Crushable: 1,
    Destroyable: 2,
    Beach: 3,
    Water: 4,
    Impassable: 6,
    OutsideMap: 7,
} as const;

// [Map] LocalSize offsets (VisibleRect.X / .Y; mirrored from mapGen.ts - see
// the PT note).
const K_VISIBLE_OFFSET_X = 2;
const K_VISIBLE_OFFSET_Y = 5;

// MapClass::IsWithinUsableArea (0x578460 - 0x57852f) -> IsWithinUsableRect
// (sub_578640) with the canonical LocalSize {2, 5, W, H}. The canonical TS
// copy lives in makingSub.ts; recalc may not import it at runtime (rule:
// recalc -> none), so the body is duplicated here.
function isWithinUsableArea(r: Rmg, x: number, y: number, checkLevel: boolean): boolean {
    if (r.cellSlots.length === 0) return false;

    const visX = K_VISIBLE_OFFSET_X;
    const visY = K_VISIBLE_OFFSET_Y;
    const visW = r.size.width;
    const visH = r.size.height;

    let level = 0; // 0x578460
    if (checkLevel) {
        const cell = r.cellAt(x, y);
        level = cell.level;
        if (cell.slopeIndex !== 0 && y + x < level + r.size.mapWidth + 2 * visY + 4)
            ++level;
    }

    const width = r.size.mapWidth; // 0x5784e0 MapRect.Width
    return y + x > level + width + 2 * visY
        && y + x <= level + width + 2 * (visY + visH) + 2
        && x - y < 2 * (visX + visW) - width
        && y - x < width - 2 * visX;
}

// ---------------------------------------------------------------------------
// Table factories (C++ default-construction semantics for the port's
// interface records).
// ---------------------------------------------------------------------------
const newTileCellAttr = (): TileCellAttr => ({
    hasFrame: false,
    terrainType: 0,
    rampType: 0,
    flags36: 0,
    cellsInX: 0,
    cellsInY: 0,
    extra4: 0,
    extra24: 0,
    radarRedLeft: 0,
    radarGreenLeft: 0,
    radarBlueLeft: 0,
    radarRedRight: 0,
    radarGreenRight: 0,
    radarBlueRight: 0,
});

const newOverlayTypeInfo = (): OverlayTypeInfo => ({
    present: false,
    landType: 0, // LandType_Clear - what the consumers read while absent
    tiberium: false,
    noUseTileLandType: false,
    crushable: false,
    wall: false,
    isARock: false,
    isRubble: false,
});

const newGroundTypeInfo = (): GroundTypeInfo => ({
    cost: [0, 0, 0, 0, 0, 0, 0, 0], // 8 float slots, only 0..6 are written
    buildable: false,
});

// ---------------------------------------------------------------------------
// dword_8288E4 @ 0x8288E4 - the 16-entry TMP terrain type -> LandType table
// sub_544BE0 indexes with a tile cell's terrain byte (extra[+41]). TMP terrain
// 15 (the cliff art) answers 3 = LandType_Rock.
// ---------------------------------------------------------------------------
const K_LAND_TYPE_FROM_TERRAIN_TYPE = [
    0, 8, 8, 8, 8, 10, 9, 3, 3, 2, 6, 1, 1, 0, 7, 3,
];

/** The TMP terrain byte -> LandType; out of range answers Clear. */
export function landTypeFromTerrainType(r: Rmg, terrainType: number): number {
    if (terrainType < 0 || terrainType >= 16) return 0; // LandType_Clear
    return K_LAND_TYPE_FROM_TERRAIN_TYPE[terrainType]!;
}

// ---------------------------------------------------------------------------
// PassabilityIndex - sub_56D3F0 (0x56d3f0 - 0x56d426).
//
//   index = x + y * (W' + H' + 1)
//   clamped to [0, count - 1] (count = workSide * workSide) so a raw
//   (possibly out-of-diamond) MapCoords still lands inside the arrays.
// ---------------------------------------------------------------------------
export function passabilityIndex(r: Rmg, x: number, y: number): number {
    const side = r.size.workSide; // W' + H' + 1
    const count = side * side;

    const index = x + y * side;
    if (index < 0) return 0;
    if (index >= count) return count - 1;
    return index;
}

// ---------------------------------------------------------------------------
// TileCellAttrAt - the TMP record of tile `tile` at cell offset `cell` (the
// cell's Height). null means "no image", which is the answer every vanilla
// helper gives for a tile it has no art for.
// ---------------------------------------------------------------------------
export function tileCellAttrAt(r: Rmg, tile: number, cell: number): TileCellAttr | null {
    if (tile < 0 || tile >= r.tileCellAttrs.length) return null;
    const cells = r.tileCellAttrs[tile]!;
    if (cell < 0 || cell >= cells.length) return null;
    return cells[cell]!;
}

// sub_544C20 - "does tile `tile` carry an image frame at cell `cell`?" A zero
// offset entry in the TMP is that same "no frame" answer.
export function tileCellHasFrame(r: Rmg, tile: number, cell: number): boolean {
    const a = tileCellAttrAt(r, tile, cell);
    return a !== null && a.hasFrame;
}

// sub_544BE0 - the cell's LandType: its TMP terrain type through
// dword_8288E4. Answers 0 when the tile has no image.
export function tileCellLandType(r: Rmg, tile: number, cell: number): number {
    const a = tileCellAttrAt(r, tile, cell);
    if (a === null) return 0;
    return landTypeFromTerrainType(r, a.terrainType);
}

// sub_5471B0 - the cell's ramp type (extra[+42]); 0 without an image.
export function tileCellRampType(r: Rmg, tile: number, cell: number): number {
    const a = tileCellAttrAt(r, tile, cell);
    return a === null ? 0 : a.rampType;
}

// sub_547150 - the CellsInX and the Y adjustment RecalcAttributes stores as
// the cell's ZAdjust:
//     *cellsInX = image[2]                                   (CellsInX)
//     y         = image[3]                                   (CellsInY)
//     if (image[cell] && (extra[+36] & 1))
//         y = CellsInY + extra[+4] - extra[+24]
// Answers false when the tile has no image (vanilla returns 0 there).
export function tileCellImageInfo(
    r: Rmg,
    tile: number,
    cell: number,
    cellsInX: Box<number> | null,
    yAdjust: Box<number> | null,
): boolean {
    const a = tileCellAttrAt(r, tile, cell);
    if (a === null) return false;

    if (cellsInX !== null) cellsInX.v = a.cellsInX;

    let y = a.cellsInY;
    if (a.hasFrame && (a.flags36 & 1) !== 0)
        y = a.cellsInY + a.extra4 - a.extra24;

    if (yAdjust !== null) yAdjust.v = y;
    return true;
}

// ---------------------------------------------------------------------------
// ParseTmpInto - read one TMP file into `out`, one entry per cell.
//
// Layout (see TileCellAttr):
//     +0   int32 CellsInX          +16  int32 offset[CellsInX * CellsInY]
//     +4   int32 CellsInY          extra[+36] dword flags
//     +8   int32 cellWidth         extra[+41] byte terrain type
//     +12  int32 cellHeight        extra[+42] byte ramp type
// Any failure leaves `out` empty, which the helpers read as "no image"
// ("missing file => empty entry").
// ---------------------------------------------------------------------------
function parseTmpInto(out: TileCellAttr[], path: string): void {
    out.length = 0;

    let data: Buffer;
    try {
        data = readFileSync(path);
    } catch {
        return;
    }
    if (data.length < 16 || data.length > 16 * 1024 * 1024) return;

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const cellsInX = view.getInt32(0, true);
    const cellsInY = view.getInt32(4, true);
    if (cellsInX <= 0 || cellsInY <= 0 || cellsInX > 64 || cellsInY > 64) return;

    const count = cellsInX * cellsInY;
    if (16 + 4 * count > data.length) return;

    for (let cell = 0; cell < count; ++cell) {
        const attr = newTileCellAttr();
        attr.cellsInX = cellsInX;
        attr.cellsInY = cellsInY;

        const offset = view.getInt32(16 + 4 * cell, true);
        if (offset > 0 && offset + 43 <= data.length) {
            attr.hasFrame = true;
            attr.flags36 = data[offset + 36];
            attr.terrainType = data[offset + 41];
            attr.rampType = data[offset + 42];
            attr.extra4 = view.getInt32(offset + 4, true);
            attr.extra24 = view.getInt32(offset + 24, true);

            // The frame's two radar pixels (the RA2 image header, 52 bytes).
            // A header that stops before them keeps the zeroed defaults.
            if (offset + 49 <= data.length) {
                attr.radarRedLeft = data[offset + 43];
                attr.radarGreenLeft = data[offset + 44];
                attr.radarBlueLeft = data[offset + 45];
                attr.radarRedRight = data[offset + 46];
                attr.radarGreenRight = data[offset + 47];
                attr.radarBlueRight = data[offset + 48];
            }
        }
        out[cell] = attr;
    }
}

// ---------------------------------------------------------------------------
// LoadTileCellAttrs - the port's stand-in for the tiles' TMP images.
//
// Walks the theater INI's tile sets - the same [TileSetNNNN] walk
// LoadTheaterTiles performs - derives each tile's file name from the set's
// FileName plus the tile's position inside the set ("<base><NN>.tem/.sno",
// %02d of 1-based position), and parses the TMP from r.artDir(theater)
// ("温和" for theater 0, "雪地" for theater 1). Tiles whose file is missing
// keep an empty entry, which reads as "no image".
// ---------------------------------------------------------------------------
export function loadTileCellAttrs(r: Rmg, theater: number): void {
    r.tileCellAttrs = [];

    const iniPath = openIni(r.theaterIniPath(theater));
    if (iniPath === null) return;

    // ---- [TileSetNNNN] sections in numeric order --------------------------
    const sets: Array<[number, number]> = []; // (section number, TilesInSet)
    for (const name of profileSectionNames(iniPath)) {
        if (name.slice(0, 7).toLowerCase() !== 'tileset') continue;
        const tiles = profileInt(iniPath, name, 'TilesInSet', 0);
        sets.push([atoiPrefix(name.slice(7)), tiles]);
    }
    sets.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    // ---- the theater's art folder ----------------------------------------
    const artDir = r.artDir(theater);
    const ext = theater === 1 ? 'sno' : 'tem';

    // ---- one TMP per tile -------------------------------------------------
    let running = 0;
    for (let i = 0; i < sets.length; ++i) {
        const tilesInSet = sets[i]![1];
        if (tilesInSet <= 0) continue;

        while (r.tileCellAttrs.length < running + tilesInSet)
            r.tileCellAttrs.push([]);

        const section = 'TileSet' + sprintf04d(sets[i]![0]);
        const fileName = profileString(iniPath, section, 'FileName', '');

        if (fileName.length !== 0) {
            for (let k = 0; k < tilesInSet; ++k) {
                const file = join(
                    artDir,
                    `${fileName}${String(k + 1).padStart(2, '0')}.${ext}`,
                );
                parseTmpInto(r.tileCellAttrs[running + k]!, file);
            }
        }
        running += tilesInSet;
    }
}

// ---------------------------------------------------------------------------
// LoadOverlayTypes - build the port's OverlayTypeClass::Array.
//
// Mirrors OverlayTypeClass::LoadFromINI (0x5FE770) for the fields
// RecalcAttributes / RecalcCellPassability touch. The index -> name list is
// the rules INI's [OverlayTypes] section (r.rulesIniPath). Nothing is fatal:
// a missing file leaves every entry absent, which the consumers read as
// LandType_Clear with both flags off. An unparsable "Land=" stores -1
// straight into the field, exactly as vanilla does.
// ---------------------------------------------------------------------------
export function loadOverlayTypes(r: Rmg): void {
    r.overlayTypes = [];

    const iniPath = openIni(r.rulesIniPath());
    if (iniPath === null) return;

    // ---- every key of [OverlayTypes] --------------------------------------
    const keys = profileKeys(iniPath, 'OverlayTypes');
    if (keys.length === 0) return; // no section / no file

    // ---- size the table to the highest index the file names ---------------
    let maxIndex = 0;
    for (const key of keys) {
        const index = atoiPrefix(key);
        if (index > maxIndex) maxIndex = index;
    }
    r.overlayTypes = Array.from({ length: maxIndex + 1 }, () => newOverlayTypeInfo());

    // ---- one entry per named index ----------------------------------------
    for (const key of keys) {
        const index = atoiPrefix(key);
        if (index <= 0) continue; // the shipped lists start at 1

        const name = profileString(iniPath, 'OverlayTypes', key, '');
        if (name.length === 0) continue;

        const info = r.overlayTypes[index]!;
        info.present = true;

        info.landType = parseLandType(profileString(iniPath, name, 'Land', 'Clear')); // may be -1
        info.tiberium = parseIniBool(profileString(iniPath, name, 'Tiberium', ''), false);
        info.noUseTileLandType = parseIniBool(
            profileString(iniPath, name, 'NoUseTileLandType', ''), false);

        // The four flags sub_483C80 consults.
        info.crushable = parseIniBool(profileString(iniPath, name, 'Crushable', ''), false);
        info.wall = parseIniBool(profileString(iniPath, name, 'Wall', ''), false);
        info.isARock = parseIniBool(profileString(iniPath, name, 'IsARock', ''), false);
        info.isRubble = parseIniBool(profileString(iniPath, name, 'IsRubble', ''), false);

        // LoadFromINI's fix-up: ore floors that claim Clear really are ore.
        if (info.tiberium && info.landType === 0) info.landType = 5; // LandType_Tiberium
    }

    // RulesClass::LoadFromINI reads this from [General] (0x66E7xx); the shipped
    // value is 2, which is the only setting that rewrites a floor to Rock.
    r.cliffBackImpassability = profileInt(iniPath, 'General', 'CliffBackImpassability', -1);
}

// ---------------------------------------------------------------------------
// LoadGroundTypes - build GroundType::Array (0x89EA40, 12 entries).
//
// Every floor section is named after its LandType and carries one percentage
// per speed type (Foot Track Wheel Float Hover Amphibious FloatBeach, kept in
// Cost[0..6] of an 8-slot array in that same order), plus Buildable. Cost[2]
// is the WHEEL column - the one sub_483C80 tests.
// ---------------------------------------------------------------------------
const K_SPEED_KEYS = ['Foot', 'Track', 'Wheel', 'Float', 'Hover', 'Amphibious', 'FloatBeach'];

export function loadGroundTypes(r: Rmg): void {
    r.groundTypes = Array.from({ length: 12 }, () => newGroundTypeInfo());

    const iniPath = openIni(r.rulesIniPath());
    if (iniPath === null) return;

    for (let landType = 0; landType < 12; ++landType) {
        const section = K_LAND_TYPE_NAMES[landType]!;
        const gt = r.groundTypes[landType]!;

        for (let s = 0; s < 7; ++s) {
            gt.cost[s] = parseIniPercent(profileString(iniPath, section, K_SPEED_KEYS[s]!, '0'));
        }

        gt.buildable = parseIniBool(profileString(iniPath, section, 'Buildable', ''), false);
    }
}

// GroundTypeFor's out-of-range answer (the C++ static const kAbsent).
const K_ABSENT_GROUND: GroundTypeInfo = newGroundTypeInfo();

/** GroundType::Array[landType], or the shared absent record. */
export function groundTypeFor(r: Rmg, landType: number): GroundTypeInfo {
    if (landType < 0 || landType >= r.groundTypes.length) return K_ABSENT_GROUND;
    return r.groundTypes[landType]!;
}

// ---------------------------------------------------------------------------
// LoadTiberiums - build TiberiumClass::Array.
//
// [Tiberiums] names the ore types in order; each one's own section carries an
// "Image=" NUMBER that LoadFromINI (0x721A50) maps to a hard-coded overlay
// start (2 -> gems at 27, 3 -> 127, 4 -> 147, anything else -> 102), plus
// NumImages = 12 and the +0xEC field = 8. A section without an "Image" key is
// skipped here (the engine's Image stays unusable).
// ---------------------------------------------------------------------------
export function loadTiberiums(r: Rmg): void {
    r.tiberiums = [];

    const kImageToOverlayStart = [102, 102, 27, 127, 147];

    const iniPath = openIni(r.rulesIniPath());
    if (iniPath === null) return;

    const keys = profileKeys(iniPath, 'Tiberiums');
    if (keys.length === 0) return;

    for (const key of keys) {
        const name = profileString(iniPath, 'Tiberiums', key, '');
        if (name.length === 0) continue;

        const image = profileInt(iniPath, name, 'Image', -1);
        if (image < 0) continue; // no Image key: unusable

        r.tiberiums.push({
            overlayStart: image <= 4 ? kImageToOverlayStart[image]! : 102,
            numImages: 12,
            extra: 8,
            arrayIndex: atoiPrefix(key),
        });
    }
}

// ---------------------------------------------------------------------------
// ToTiberiumIdx - 0x5FDD20 (size 0xBE). The caller only compares the answer
// against -1, so the "0" outcome and a real ore index are equivalent to it.
// ---------------------------------------------------------------------------
export function toTiberiumIdx(r: Rmg, overlayIndex: number): number {
    if (overlayIndex === -1) return -1;
    if (overlayIndex < 0 || overlayIndex >= r.overlayTypes.length) return -1;
    if (!r.overlayTypes[overlayIndex]!.tiberium) return -1;

    for (let i = 0; i < r.tiberiums.length; ++i) {
        const t = r.tiberiums[i]!;
        const firstEnd = t.overlayStart + t.numImages;
        if (overlayIndex >= t.overlayStart && overlayIndex < firstEnd)
            return t.arrayIndex;
        if (overlayIndex >= firstEnd && overlayIndex < firstEnd + t.extra)
            return t.arrayIndex;
    }
    return 0; // ore, but no entry matched
}

// ---------------------------------------------------------------------------
// RecalcCellPassability - sub_483C80 (0x483c80 - 0x483e29).
//
// The object walk (FirstObject != null) is unreachable here: the generator
// never attaches an object to a cell, so control falls straight through to
// Passable - which is also the answer the walk gives for an empty list.
// ---------------------------------------------------------------------------
export function recalcCellPassability(r: Rmg, cell: MapCell): void {
    const x = (cell.mapCoords & 0xffff) << 16 >> 16;
    const y = ((cell.mapCoords >>> 16) << 16) >> 16;

    if (!isWithinUsableArea(r, x, y, true)) {
        cell.passability = PT.OutsideMap;
        return;
    }

    const overlayIndex = cell.overlayTypeIndex;
    if (overlayIndex >= 0 && overlayIndex < r.overlayTypes.length) {
        const ov = r.overlayTypes[overlayIndex]!;

        if (ov.crushable) {
            cell.passability = PT.Crushable;
            return;
        }
        if (ov.wall) {
            cell.passability = PT.Destroyable;
            return;
        }
        if (groundTypeFor(r, ov.landType).cost[2] === 0) {
            cell.passability = PT.Impassable;
            return;
        }
        if (ov.isARock) {
            cell.passability = PT.Impassable;
            return;
        }
        if (ov.isRubble) {
            cell.passability = PT.Passable;
            return;
        }
    }

    const landType = cell.landType;
    if (landType === 2) {
        // LandType_Water
        cell.passability = PT.Water;
        return;
    }
    if (landType === 6) {
        // LandType_Beach
        cell.passability = PT.Beach;
        return;
    }
    if (groundTypeFor(r, landType).cost[2] <= Math.fround(0.01)) {
        cell.passability = PT.Impassable;
        return;
    }

    // FirstObject is always null during generation.
    cell.passability = PT.Passable;
}

// ---------------------------------------------------------------------------
// SetupLAT - CellClass::SetupLAT (0x47CA80 - 0x47D209, size 0x78A).
//
// Four mask-style LAT blocks (neighbour mask -> familyBase + mask, plain tile
// when the mask is 0), then the RampBase / RampSmooth slope-piece selection.
// ---------------------------------------------------------------------------
export function setupLAT(r: Rmg, cell: MapCell): void {
    const cx = (cell.mapCoords & 0xffff) << 16 >> 16;
    const cy = ((cell.mapCoords >>> 16) << 16) >> 16;

    // A neighbour by Neighbours index. Off-map reads give the sentinel cell,
    // whose tile index is 0 and so never matches a family.
    const at = (dir: number): MapCell => {
        const nx = ((cx + DIR_X[dir]!) << 16) >> 16;
        const ny = ((cy + DIR_Y[dir]!) << 16) >> 16;
        if (!r.cellExists(nx, ny)) return r.invalidCell;
        return r.cellAt(nx, ny);
    };

    // One mask-style block. `plain` is the plain tile of the material, `base`
    // the family base and `span` its last piece. Each extra pair is another
    // family that also counts as "ours" (blocks 3 and 4 need those).
    const lat = (
        base: number,
        span: number,
        plain: number,
        extraOwn: Array<[number, number]>,
    ): void => {
        if (base === -1) return;
        const cur = cell.isoTileTypeIndex;
        if (cur !== plain && (cur < base || cur > base + span)) return;

        const ours = (t: number): boolean => {
            if (t === plain || (t >= base && t <= base + span)) return true;
            for (const own of extraOwn) {
                if (own[0] !== -1 && t >= own[0] && t <= own[0] + own[1]) return true;
            }
            return false;
        };

        let mask = 0;
        for (let n4 = 0; n4 < 4; ++n4) {
            const dir = (n4 * 2) & 7; // 0, 2, 4, 6 = N, E, S, W
            if (!ours(at(dir).isoTileTypeIndex)) mask |= 1 << n4;
        }
        cell.isoTileTypeIndex = mask !== 0 ? base + mask : plain;
    };

    lat(r.clearToRoughLatIndex, 15, r.roughTileIndex, []); // 0xABC2B8 / 0xAA1134
    lat(r.clearToSandLatIndex, 15, r.sandTileIndex, []); // 0xABB104 / 0xAA0E24
    lat(r.clearToGreenLatIndex, 15, r.greenTileIndex, // 0xAA0E18 / 0xAA0748
        [[r.shorePieces, 41], [r.waterBridgeIndex, 1]]);
    lat(r.clearToPaveLatIndex, 15, r.paveTileIndex, // 0xABC2B0 / 0xAA10A8
        [[r.miscPaveTileIndex, 13], [r.mediansIndex, 13], [r.pavedRoadsIndex, 20]]);

    // ---- 5. RampBase / RampSmooth: slope piece selection (0x47cc80) --------
    if (r.rampBaseIndex !== -1 && r.rampSmoothIndex !== -1) {
        const cur = cell.isoTileTypeIndex;
        if ((cur >= r.rampBaseIndex && cur <= r.rampBaseIndex + 19)
            || (cur >= r.rampSmoothIndex && cur <= r.rampSmoothIndex + 11)) {
            let mask = 0;
            if (cell.slopeIndex === 1) // W, NE
            {
                mask = at(6).slopeIndex === 0 ? 1 : 0;
                if (at(1).slopeIndex === 0) mask |= 2;
                if (mask !== 0) cell.isoTileTypeIndex = mask + r.rampSmoothIndex - 1;
            }
            if (cell.slopeIndex === 2) // N, E
            {
                if (at(0).slopeIndex === 0) mask |= 1;
                if (at(2).slopeIndex === 0) mask |= 2;
                if (mask !== 0) cell.isoTileTypeIndex = mask + r.rampSmoothIndex + 2;
            }
            if (cell.slopeIndex === 3) // NE, W
            {
                if (at(1).slopeIndex === 0) mask |= 1;
                if (at(6).slopeIndex === 0) mask |= 2;
                if (mask !== 0) cell.isoTileTypeIndex = mask + r.rampSmoothIndex + 5;
            }
            if (cell.slopeIndex === 4) // E, N
            {
                if (at(2).slopeIndex === 0) mask |= 1;
                if (at(0).slopeIndex === 0) mask |= 2;
                if (mask !== 0) cell.isoTileTypeIndex = mask + r.rampSmoothIndex + 8;
            }
            if (mask === 0)
                cell.isoTileTypeIndex = cell.slopeIndex + r.rampBaseIndex - 1;
        }
    }

    // Tail (0x47d1f4): vanilla loads the new tile's image here. Our tile-cell
    // attribute table is index-addressed and loaded on demand, so there is no
    // step to mirror.
}

// ---------------------------------------------------------------------------
// RecalcAttributes - CellClass::RecalcAttributes (sub_47D2B0 @ 0x47D2B0, size
// 0xab4). Three entry shapes, in vanilla order:
//   A. the overlay is a Wall / Railroad / "NoUseTileLandType" one (0x47d2f0)
//   B. the cell has a tile index (0x47d3xx)
//   C. the cell has no tile (0x47d6xx)
// Not modelled (the port has neither): the TubeClass branch for
// LandType_Tunnel, the tile-animation attach (AnimClass), and the
// shadow-caster stamp that sets CellsFlags bit 0x10000.
// ---------------------------------------------------------------------------
export function recalcAttributes(r: Rmg, cell: MapCell, cellLevel: number): void {
    if (cell === r.invalidCell) return;

    const x = (cell.mapCoords & 0xffff) << 16 >> 16;
    const y = ((cell.mapCoords >>> 16) << 16) >> 16;

    const passIndex = passabilityIndex(r, x, y);
    const pass = (passIndex >= 0 && passIndex < r.levelAndPassability.length)
        ? r.levelAndPassability[passIndex]!
        : null;

    // The overlay type behind cell.overlayTypeIndex, or null when there is
    // none / it is out of range.
    const overlay = (index: number): OverlayTypeInfo | null => {
        if (index < 0 || index >= r.overlayTypes.length) return null;
        return r.overlayTypes[index]!;
    };

    // "Cliff back" probe (0x47d399 - 0x47d52d): is any of the six neighbours
    // at least one level higher (cell.Level + 4)? The offsets are vanilla's,
    // the odd (x+2, y+2) included.
    const K_PROBE_X = [0, -1, 2, 1, -1, 1];
    const K_PROBE_Y = [-1, 0, 2, 1, 1, -1];
    const cliffBack = (): boolean => {
        if (r.cliffBackImpassability === 0) return false;
        const higher = cell.level + 4;

        for (let i = 0; i < 6; ++i) {
            const nx = ((x + K_PROBE_X[i]!) << 16) >> 16;
            const ny = ((y + K_PROBE_Y[i]!) << 16) >> 16;
            if (!r.cellExists(nx, ny)) continue;
            if (higher <= r.cellAt(nx, ny).level) return true;
        }
        return false;
    };

    const storePassability = (): void => {
        if (pass !== null) {
            pass.cellLevel = cell.level & 0xff; // static_cast<uint8_t>
            pass.cellPassability = cell.passability & 0xff;
        }
    };

    const overlayIndex = cell.overlayTypeIndex;
    const ov = overlay(overlayIndex);

    // ---- A. Wall / Railroad / NoUseTileLandType overlay (0x47d2f0) --------
    if (overlayIndex !== -1 && ov !== null) {
        cell.landType = ov.landType;

        if (ov.landType === 4 || ov.landType === 9 || ov.noUseTileLandType) {
            if (cell.isoTileTypeIndex !== 0xffff
                && cell.isoTileTypeIndex >= 0
                && cell.isoTileTypeIndex < r.tileCellAttrs.length) {
                cell.slopeIndex =
                    tileCellRampType(r, cell.isoTileTypeIndex, cell.height) & 0xff;
            }
            if (cell.slopeIndex !== 0 && ov.tiberium) {
                cell.overlayTypeIndex = -1;
                cell.overlayData = 0;
            }
            if (cliffBack() && r.cliffBackImpassability === 2)
                cell.landType = 3; // LandType_Rock

            setupLAT(r, cell);
            recalcCellPassability(r, cell);
            storePassability();
            return;
        }
    }

    // ---- the tile index is out of the tile array --------------------------
    if (cell.isoTileTypeIndex >= r.tileCellAttrs.length)
        cell.isoTileTypeIndex = 0xffff;

    // ---- C. no tile: land class from the overlay alone (0x47d6xx) ---------
    if (cell.isoTileTypeIndex === 0xffff || cell.isoTileTypeIndex < 0) {
        if (overlayIndex === -1 || ov === null || ov.noUseTileLandType)
            cell.landType = 0; // LandType_Clear
        else
            cell.landType = ov.landType;
        cell.slopeIndex = 0;
    } else {
        // ---- B. the cell has a tile (0x47d3xx) ---------------------------
        const tile = cell.isoTileTypeIndex;
        const height = cell.height;

        let hasFrame = tileCellHasFrame(r, tile, height);
        if (cell.slopeIndex !== 0) {
            // A cell that is already a ramp piece also accepts the tile's
            // cell 1 (vanilla probes sub_544C20 with a2 = 1).
            hasFrame = hasFrame || tileCellHasFrame(r, tile, 1);
        }

        if (!hasFrame) {
            // The tile has no frame here: wipe the cell down to a bare floor.
            cell.isoTileTypeIndex = 0xffff;
            cell.height = 0;
            cell.landType = 0;
            cell.slopeIndex = 0;
            if (cliffBack() && r.cliffBackImpassability === 2 && cell.landType === 0)
                cell.landType = 3;

            recalcCellPassability(r, cell);
            storePassability();
            return;
        }

        cell.slopeIndex = tileCellRampType(r, tile, height) & 0xff;
        setupLAT(r, cell);

        // ---- overlay / ore reconciliation (0x47d4xx LABEL_40) ------------
        let landType: number;
        const ovIdx = cell.overlayTypeIndex;
        if (ovIdx !== -1 && toTiberiumIdx(r, ovIdx) !== -1) {
            const oreOv = overlay(ovIdx);
            if (cell.slopeIndex <= 4) {
                if (oreOv !== null && oreOv.landType === 0) landType = 5; // Tiberium
                else landType = cell.landType;
            } else {
                // A ramp under ore: the ore is wiped and the floor's own land
                // class (from the TMP terrain type) takes over.
                landType = tileCellLandType(r, tile, height);
                cell.overlayTypeIndex = -1;
                cell.overlayData = 0;
            }
        } else {
            const plainOv = overlay(ovIdx);
            if (ovIdx !== -1 && plainOv !== null && plainOv.noUseTileLandType)
                landType = cell.landType;
            else
                landType = tileCellLandType(r, tile, height);
        }
        cell.landType = landType;

        // LandType_Tunnel would build a TubeClass here; the generator never
        // places tubes, so vanilla's branch cannot be reached.

        if (cellLevel !== -1) cell.level = cellLevel;

        const cellsInX = box(0);
        const yAdjust = box(0);
        if (tileCellImageInfo(r, tile, height, cellsInX, yAdjust))
            cell.zAdjust = F2I64((yAdjust.v - 30) / 15); // C++ int division
        // vanilla reads cellsInX too, but only ZAdjust is stored

        // The tile-animation attach and the shadow-caster stamp follow here
        // in vanilla; neither has a counterpart in this port.
    }

    // ---- LABEL_82: the shared tail ----------------------------------------
    if (cliffBack() && r.cliffBackImpassability === 2) {
        const lt = cell.landType;
        if (lt === 0 || lt === 2 || lt === 6 || lt === 8) // Clear, Water, Beach, Ice
            cell.landType = 3; // LandType_Rock
    }

    recalcCellPassability(r, cell);
    storePassability();
}

// ---------------------------------------------------------------------------
// The "RMG: Recalculating cell attributes" stage (0x598e1f - 0x598e9e).
// The identical walk runs three more times later in the flow - 0x598fb8
// (after tiberium), 0x59912a (before the hills), 0x599354 (after the LATs) -
// always with cellLevel = -1 ("do not change the level"). The progress-bar /
// session tail the C++ drops is dropped here too.
// ---------------------------------------------------------------------------
export function recalculateCellAttributes(r: Rmg): void {
    if (r.cellSlots.length === 0) return;

    const it = new CellIterator();
    it.reset(r.cellSlots, r.size.mapWidth);
    for (let cell = it.next(); cell !== null; cell = it.next())
        recalcAttributes(r, cell, -1);
}
