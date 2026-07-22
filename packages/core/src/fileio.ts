/**
 * MapFile - TypeScript port of the C# Mapfile.cs class.
 *
 * File I/O has been adapted: all methods that read a file in C# now accept the
 * INI file content as a string, and all methods that wrote a file in C# now
 * return the INI file content as a string. This keeps the core package free of
 * any filesystem dependency so it can run in browsers as well as Node.
 */

import { IniFile, IniSection } from './io/iniFile';
import { MemoryFile } from './io/memoryFile';
import * as Format5 from './format/format5';
import { IsoTile } from './tile/isoTile';
import { Overlay } from './tile/overlay';
import { Theater, Common } from './tile/enums';

/** Name of the INI section that stores the isometric tile pack. */
const MapPackName = 'IsoMapPack5';

/** Key/value pair used by the legacy IniFile helper helpers. */
export interface IniKeyValuePair {
    key: string;
    value: string;
}

/** Lightweight stand-in for System.IO.FileInfo used across the codebase. */
export interface FileInfoLike {
    name: string;
    fullName: string;
}

/**
 * Per-channel lighting ranges. Each value is a `[min, max)` tuple expressed
 * in the same 0-10000 integer scale used by the C# settings INI.
 */
export interface LightingSettings {
    Red: [number, number];
    Green: [number, number];
    Blue: [number, number];
    Level: [number, number];
    Ambient: [number, number];
    IonRed: [number, number];
    IonGreen: [number, number];
    IonBlue: [number, number];
    IonLevel: [number, number];
    IonAmbient: [number, number];
}

/** Raw preview/thumbnail image data (BGR byte order, 3 bytes per pixel). */
export interface PreviewImage {
    width: number;
    height: number;
    data: Uint8Array;
}

/** Settings consumed by {@link MapFile.SaveFullMap}. */
export interface SaveFullMapSettings {
    bottomSpace: number;
}

// ---------------------------------------------------------------------------
// Base64 helpers (standard alphabet, matches Convert.To/FromBase64String)
// ---------------------------------------------------------------------------

const BASE64_CHARS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const BASE64_LOOKUP: Int8Array = (() => {
    const table = new Int8Array(256).fill(-1);
    for (let i = 0; i < BASE64_CHARS.length; i++) {
        table[BASE64_CHARS.charCodeAt(i)] = i;
    }
    return table;
})();

/** Encode a byte array into a Base64 string (no inserted line breaks). */
function base64Encode(bytes: Uint8Array): string {
    let result = '';
    const len = bytes.length;
    for (let i = 0; i < len; i += 3) {
        const b1 = bytes[i];
        const b2 = i + 1 < len ? bytes[i + 1] : 0;
        const b3 = i + 2 < len ? bytes[i + 2] : 0;

        result += BASE64_CHARS[b1 >> 2];
        result += BASE64_CHARS[((b1 & 0x03) << 4) | (b2 >> 4)];
        result += i + 1 < len ? BASE64_CHARS[((b2 & 0x0f) << 2) | (b3 >> 6)] : '=';
        result += i + 2 < len ? BASE64_CHARS[b3 & 0x3f] : '=';
    }
    return result;
}

/** Decode a Base64 string into a byte array. Whitespace is ignored. */
function base64Decode(str: string): Uint8Array {
    const clean = str.replace(/[^A-Za-z0-9+/]/g, '');
    const maxLen = Math.floor(clean.length * 3 / 4);
    const result = new Uint8Array(maxLen);
    let j = 0;

    for (let i = 0; i < clean.length; i += 4) {
        const c1 = BASE64_LOOKUP[clean.charCodeAt(i)];
        const c2 = BASE64_LOOKUP[clean.charCodeAt(i + 1)];
        const c3 = i + 2 < clean.length ? BASE64_LOOKUP[clean.charCodeAt(i + 2)] : -1;
        const c4 = i + 3 < clean.length ? BASE64_LOOKUP[clean.charCodeAt(i + 3)] : -1;

        result[j++] = (c1 << 2) | (c2 >> 4);
        if (c3 >= 0) {
            result[j++] = ((c2 & 0x0f) << 4) | (c3 >> 2);
            if (c4 >= 0) {
                result[j++] = ((c3 & 0x03) << 6) | c4;
            }
        }
    }
    return result.subarray(0, j);
}

// ---------------------------------------------------------------------------
// Random helper (mirrors C# Random.Next(min, max) -> [min, max))
// ---------------------------------------------------------------------------

function randomNext(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min)) + min;
}

// ---------------------------------------------------------------------------
// MapFile
// ---------------------------------------------------------------------------

export class MapFile {
    public Width: number = 0;
    public Height: number = 0;
    public MapTheater: number = 0;
    public IsoTileList: IsoTile[] = [];
    public OverlayList: Overlay[] = [];

    public Unit: IniSection = new IniSection('Units');
    public Infantry: IniSection = new IniSection('Infantry');
    public Structure: IniSection = new IniSection('Structures');
    public Terrain: IniSection = new IniSection('Terrain');
    public Aircraft: IniSection = new IniSection('Aircraft');
    public Smudge: IniSection = new IniSection('Smudge');
    public Waypoint: IniSection = new IniSection('Waypoints');

    public LocalSize: number[] = [0, 0];

    /**
     * Parse the [IsoMapPack5] section of a map INI and populate
     * {@link IsoTileList}, {@link Width} and {@link Height}.
     */
    public CreateIsoTileList(iniContent: string): void {
        const mapFile = new IniFile(iniContent);
        const mapPackSection = mapFile.GetSection(MapPackName);
        if (mapPackSection === null) {
            this.IsoTileList = [];
            return;
        }

        const mapSize = mapFile.GetStringValue('Map', 'Size', '0,0,0,0');
        const sArray = mapSize.split(',');
        this.Width = parseInt(sArray[2], 10);
        this.Height = parseInt(sArray[3], 10);

        let isoMapPack5String = '';
        let sectionIndex = 1;
        while (mapPackSection.KeyExists(sectionIndex.toString())) {
            isoMapPack5String += mapPackSection.GetStringValue(sectionIndex.toString(), '');
            sectionIndex++;
        }

        const cells = (this.Width * 2 - 1) * this.Height;
        const lzoData = base64Decode(isoMapPack5String);
        const lzoPackSize = cells * 11 + 4;
        const isoMapPack = new Uint8Array(lzoPackSize);
        Format5.decodeInto(lzoData, isoMapPack);

        const mf = new MemoryFile(isoMapPack);
        this.IsoTileList = [];

        for (let i = 0; i < cells; i++) {
            const rx = mf.ReadUInt16();
            const ry = mf.ReadUInt16();
            const tilenum = mf.ReadInt16();
            mf.ReadInt16(); // zero1
            const subtile = mf.ReadByte();
            const z = mf.ReadByte();
            mf.ReadByte(); // zero2

            const dx = rx - ry + this.Width - 1;
            const dy = rx + ry - this.Width - 1;

            if (dx >= 0 && dx < 2 * this.Width &&
                dy >= 0 && dy < 2 * this.Height) {
                const tile = new IsoTile(dx, dy, rx, ry, z, tilenum, subtile);
                this.IsoTileList.push(tile);
            }
        }
    }

    /**
     * Serialise {@link IsoTileList} back into the [IsoMapPack5] section.
     * Returns the updated INI content.
     */
    public SaveIsoMapPack5(iniContent: string): string {
        const cells = (this.Width * 2 - 1) * this.Height;
        const lzoPackSize = cells * 11 + 4;
        const isoMapPack2 = new Uint8Array(lzoPackSize);

        let di = 0;
        for (const tile of this.IsoTileList) {
            const bs = tile.ToMapPack5Entry();
            for (let k = 0; k < 11; k++) {
                isoMapPack2[di + k] = bs[k];
            }
            di += 11;
        }

        const compressed = Format5.encode(isoMapPack2, 5);
        const compressed64 = base64Encode(compressed);

        const saveFile = new IniFile(iniContent);
        saveFile.AddSection(MapPackName);
        const saveMapPackSection = saveFile.GetSection(MapPackName)!;

        let j = 1;
        let idx = 0;
        while (idx < compressed64.length) {
            const adv = Math.min(74, compressed64.length - idx);
            saveMapPackSection.SetStringValue(j.toString(), compressed64.slice(idx, idx + adv));
            j++;
            idx += adv;
        }

        return saveFile.WriteIniFile();
    }

    /**
     * Produce a CSV-style "working" map pack used internally between
     * generation stages. Returns the INI content as a string.
     */
    public SaveWorkingMapPack(): string {
        const mapPack = new IniFile();
        const mapPackSection = mapPack.AddSection('mapPack');
        let mapPackIndex = 1;
        mapPackSection.SetStringValue('0', 'Dx,Dy,Rx,Ry,Z,TileNum,SubTile');
        mapPack.SetStringValue('Map', 'Size', `${this.Width},${this.Height}`);

        for (const isoTile of this.IsoTileList) {
            mapPackSection.SetStringValue(
                mapPackIndex.toString(),
                `${isoTile.Dx},${isoTile.Dy},${isoTile.Rx},${isoTile.Ry},${isoTile.Z},${isoTile.TileNum},${isoTile.SubTile}`,
            );
            mapPackIndex++;
        }

        return mapPack.WriteIniFile();
    }

    /** Build a flat empty map of the requested dimensions. */
    public CreateEmptyMap(width: number, height: number): void {
        this.Width = width;
        this.Height = height;
        this.IsoTileList = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width * 2 - 1; x++) {
                const dx = x;
                const dy = y * 2 + (x % 2);
                const rx = Math.floor((dx + dy) / 2) + 1;
                const ry = dy - rx + width + 1;
                this.IsoTileList.push(new IsoTile(dx, dy, rx, ry, 0, Common._000_Empty, 0));
            }
        }
    }

    /**
     * Render the IsoTile radar-color data into a PreviewImage (RGB byte order).
     *
     * Mirrors C# MapFile.CreateBitMapbyMap():
     *   1. Create a source buffer of Width*2 × Height (one pixel per IsoTile)
     *   2. Map each IsoTile to pixel (Dx, (Dy - Dx%2)/2) using tile.RadarLeft
     *   3. Fill last column from second-to-last
     *   4. Crop to LocalSize area starting from source offset (2, 6)
     *
     * Pixels are stored in RGB order (same as what C# InjectThumb produces).
     *
     * @param tileList     IsoTile array from WorkingMap.CreateTileList()
     * @param mapWidth     map grid width  (WorkingMap.Width)
     * @param mapHeight    map grid height (WorkingMap.Height)
     * @param bottomSpace  theater bottom space
     */
    public static RenderPreview(
        tileList: IsoTile[],
        mapWidth: number,
        mapHeight: number,
        bottomSpace: number,
    ): PreviewImage {
        const srcW = mapWidth * 2;
        const srcH = mapHeight;
        const srcStride = srcW * 3; // bytes per row

        // Step 1: source buffer, initialised to black (RGB 0,0,0)
        const src = new Uint8Array(srcW * srcH * 3);

        // Step 2: draw each tile as 1 pixel using RadarLeft (store as RGB order)
        const dstR = tileList.length;
        for (let ti = 0; ti < dstR; ti++) {
            const tile = tileList[ti];
            const x = tile.Dx;
            const y = (tile.Dy - (tile.Dx & 1)) / 2; // (Dy - Dx%2)/2
            if (x >= 0 && x < srcW && y >= 0 && y < srcH) {
                const off = (y * srcStride) + x * 3;
                // C# InjectThumb reads BGR from BitmapData and stores as RGB
                src[off]     = tile.RadarLeft.r;       // R
                src[off + 1] = tile.RadarLeft.g;       // G
                src[off + 2] = tile.RadarLeft.b;       // B
            }
        }

        // Step 3: fill last column (srcW-1) from second-to-last (srcW-2)
        for (let row = 0; row < srcH; row++) {
            const baseOff = row * srcStride;
            // copy RGB from column srcW-2 to srcW-1
            src[baseOff + (srcW - 1) * 3]     = src[baseOff + (srcW - 2) * 3];
            src[baseOff + (srcW - 1) * 3 + 1] = src[baseOff + (srcW - 2) * 3 + 1];
            src[baseOff + (srcW - 1) * 3 + 2] = src[baseOff + (srcW - 2) * 3 + 2];
        }

        // Step 4: crop to LocalSize area — offset (2, 6) in source
        // LocalSize = [Width-4, Height-11+4-bottomSpace]
        const outW = (mapWidth - 4) * 2;
        const outH = mapHeight - 11 + 4 - bottomSpace;
        const cropX = 2;
        const cropY = 6;
        const out = new Uint8Array(outW * outH * 3);

        for (let oy = 0; oy < outH; oy++) {
            const sy = cropY + oy;
            if (sy >= srcH) break;
            const srcRowBase = sy * srcStride + cropX * 3;
            const dstRowBase = oy * outW * 3;
            for (let ox = 0; ox < outW; ox++) {
                const si = srcRowBase + ox * 3;
                const di = dstRowBase + ox * 3;
                out[di]     = src[si];
                out[di + 1] = src[si + 1];
                out[di + 2] = src[si + 2];
            }
        }

        return { width: outW, height: outH, data: out };
    }

    /**
     * Compress and inject a preview thumbnail into the INI content.
     * The `preview.data` buffer must already be in BGR order.
     */
    public InjectThumb(preview: PreviewImage, iniContent: string): string {
        const image = preview.data;
        const imageCompressed = Format5.encode(image, 5);
        const imageBase64 = base64Encode(imageCompressed);

        const map = new IniFile(iniContent);
        map.SetStringValue('Preview', 'Size', `0,0,${preview.width},${preview.height}`);

        if (map.SectionExists('PreviewPack')) {
            map.RemoveSection('PreviewPack');
        }
        const section = map.AddSection('PreviewPack');

        let rowNum = 1;
        for (let i = 0; i < imageBase64.length; i += 70) {
            const adv = Math.min(70, imageBase64.length - i);
            section.SetStringValue(rowNum.toString(), imageBase64.slice(i, i + adv));
            rowNum++;
        }

        map.MoveSectionToFirst('PreviewPack');
        map.MoveSectionToFirst('Preview');
        map.MoveSectionToFirst('Header');

        return map.WriteIniFile();
    }

    /** Regenerate the [Digest] section with 20 random nibble-valued bytes. */
    public ChangeDigest(iniContent: string): string {
        const map = new IniFile(iniContent);
        if (map.SectionExists('Digest')) {
            map.RemoveSection('Digest');
        }
        const section = map.AddSection('Digest');

        const digest = new Uint8Array(20);
        for (let i = 0; i < 20; i++) {
            digest[i] = randomNext(0, 16);
        }
        section.SetStringValue('1', base64Encode(digest));

        return map.WriteIniFile();
    }

    /**
     * Assemble a complete map: set dimensions/theater, attach
     * the object sections, then append the tile and overlay packs.
     *
     * When `templateMapContent` is empty/falsy the map is built from scratch
     * with the minimal set of default sections (identical to what
     * templateMap.map would provide).
     */
    public SaveFullMap(
        templateMapContent: string | undefined,
        settings: SaveFullMapSettings,
    ): string {
        const fullMap =
            templateMapContent
                ? new IniFile(templateMapContent)
                : createDefaultMapIni();
        const bottomSpace = settings.bottomSpace;

        fullMap.SetStringValue('Map', 'Size', `0,0,${this.Width},${this.Height}`);
        this.LocalSize[0] = this.Width - 4;
        this.LocalSize[1] = this.Height - 11 + 4 - bottomSpace;
        fullMap.SetStringValue('Map', 'LocalSize', `2,5,${this.LocalSize[0]},${this.LocalSize[1]}`);
        fullMap.SetStringValue('Map', 'Theater', Theater[this.MapTheater]);

        fullMap.AddSection(this.Unit);
        fullMap.AddSection(this.Infantry);
        fullMap.AddSection(this.Structure);
        fullMap.AddSection(this.Terrain);
        fullMap.AddSection(this.Aircraft);
        fullMap.AddSection(this.Smudge);
        fullMap.AddSection(this.Waypoint);

        let content = fullMap.WriteIniFile();
        content = this.SaveIsoMapPack5(content);
        content = this.SaveOverlay(content);
        return content;
    }

    /** Load the CSV-style working map pack produced by {@link SaveWorkingMapPack}. */
    public LoadWorkingMapPack(iniContent: string): void {
        this.IsoTileList = [];
        const mapPack = new IniFile(iniContent);
        const mapPackSection = mapPack.GetSection('mapPack');
        if (mapPackSection === null) return;

        const size = mapPack.GetStringValue('Map', 'Size', '0,0').split(',');
        this.Width = parseInt(size[0], 10);
        this.Height = parseInt(size[1], 10);

        let i = 1;
        while (mapPackSection.KeyExists(i.toString())) {
            const isoTileInfo = mapPackSection.GetStringValue(i.toString(), '').split(',');
            const isoTile = new IsoTile(
                parseInt(isoTileInfo[0], 10),
                parseInt(isoTileInfo[1], 10),
                parseInt(isoTileInfo[2], 10),
                parseInt(isoTileInfo[3], 10),
                parseInt(isoTileInfo[4], 10),
                parseInt(isoTileInfo[5], 10),
                parseInt(isoTileInfo[6], 10),
            );
            this.IsoTileList.push(isoTile);
            i++;
        }
    }

    /**
     * Read [OverlayPack] / [OverlayDataPack] and rebuild {@link OverlayList}.
     * Returns null when the required sections are missing.
     */
    public ReadOverlay(iniContent: string): Overlay[] | null {
        this.OverlayList = [];
        const mapFile = new IniFile(iniContent);
        if (!mapFile.SectionExists('OverlayPack') || !mapFile.SectionExists('OverlayDataPack')) {
            return null;
        }

        const overlaySection = mapFile.GetSection('OverlayPack');
        if (overlaySection === null) return null;

        let overlayPackString = '';
        let sectionIndex = 1;
        while (overlaySection.KeyExists(sectionIndex.toString())) {
            overlayPackString += overlaySection.GetStringValue(sectionIndex.toString(), '');
            sectionIndex++;
        }

        const format80Data = base64Decode(overlayPackString);
        const overlayPack = new Uint8Array(1 << 18);
        Format5.decodeInto(format80Data, overlayPack, 80);

        const overlayDataSection = mapFile.GetSection('OverlayDataPack');
        if (overlayDataSection === null) return null;

        let overlayDataPackString = '';
        sectionIndex = 1;
        while (overlayDataSection.KeyExists(sectionIndex.toString())) {
            overlayDataPackString += overlayDataSection.GetStringValue(sectionIndex.toString(), '');
            sectionIndex++;
        }

        const format80Data2 = base64Decode(overlayDataPackString);
        const overlayDataPack = new Uint8Array(1 << 18);
        Format5.decodeInto(format80Data2, overlayDataPack, 80);

        for (const tile of this.IsoTileList) {
            const idx = tile.Rx + 512 * tile.Ry;
            const overlayId = overlayPack[idx];
            if (overlayId !== 0xff) {
                const overlayValue = overlayDataPack[idx];
                const ovl = new Overlay(overlayId, overlayValue);
                ovl.Tile = tile.Clone();
                this.OverlayList.push(ovl);
            }
        }
        return this.OverlayList;
    }

    /** Serialise {@link OverlayList} into [OverlayPack] / [OverlayDataPack]. */
    public SaveOverlay(iniContent: string): string {
        const overlayPack = new Uint8Array(1 << 18).fill(0xff);
        const overlayDataPack = new Uint8Array(1 << 18);

        for (const overlay of this.OverlayList) {
            if (overlay.Tile === null) continue;
            const index = overlay.Tile.Rx + 512 * overlay.Tile.Ry;
            overlayPack[index] = overlay.OverlayID;
            overlayDataPack[index] = overlay.OverlayValue;
        }

        const compressedPack = Format5.encode(overlayPack, 80);
        const compressedDataPack = Format5.encode(overlayDataPack, 80);
        const compressedPack64 = base64Encode(compressedPack);
        const compressedDataPack64 = base64Encode(compressedDataPack);

        const saveFile = new IniFile(iniContent);
        if (saveFile.SectionExists('OverlayPack')) saveFile.RemoveSection('OverlayPack');
        saveFile.AddSection('OverlayPack');
        if (saveFile.SectionExists('OverlayDataPack')) saveFile.RemoveSection('OverlayDataPack');
        saveFile.AddSection('OverlayDataPack');

        const overlayPackSection = saveFile.GetSection('OverlayPack')!;
        const overlayDataPackSection = saveFile.GetSection('OverlayDataPack')!;

        let j = 1;
        let idx = 0;
        while (idx < compressedPack64.length) {
            const adv = Math.min(70, compressedPack64.length - idx);
            overlayPackSection.SetStringValue(j.toString(), compressedPack64.slice(idx, idx + adv));
            j++;
            idx += adv;
        }

        let j2 = 1;
        let idx2 = 0;
        while (idx2 < compressedDataPack64.length) {
            const adv = Math.min(70, compressedDataPack64.length - idx2);
            overlayDataPackSection.SetStringValue(j2.toString(), compressedDataPack64.slice(idx2, idx2 + adv));
            j2++;
            idx2 += adv;
        }

        return saveFile.WriteIniFile();
    }

    /** Produce a CSV-style working overlay pack. */
    public SaveWorkingOverlay(): string {
        const overlayPackIni = new IniFile();
        const section = overlayPackIni.AddSection('overlayPack');
        let index = 1;
        for (const overlay of this.OverlayList) {
            section.SetStringValue(index.toString(), `${overlay.OverlayID},${overlay.OverlayValue}`);
            index++;
        }
        return overlayPackIni.WriteIniFile();
    }

    /**
     * Translate [Waypoints] player positions into [Header] Waypoint1..8
     * entries and update the player-count metadata.
     */
    public CalculateStartingWaypoints(iniContent: string): string {
        const mapFile = new IniFile(iniContent);
        const localSize = mapFile.GetStringValue('Map', 'LocalSize', '0,0,0,0');
        const localWidth = parseInt(localSize.split(',')[2], 10);
        const localHeight = parseInt(localSize.split(',')[3], 10);
        mapFile.SetStringValue('Header', 'Width', (localWidth - 1).toString());
        mapFile.SetStringValue('Header', 'Height', localHeight.toString());

        let playerNum = 0;
        while (mapFile.KeyExists('Waypoints', playerNum.toString()) && playerNum < 8) {
            const waypoint = mapFile.GetStringValue('Waypoints', playerNum.toString(), '000000');
            const length = waypoint.length;
            const x = parseInt(waypoint.slice(length - 3, length), 10);
            const y = parseInt(waypoint.slice(0, length - 3), 10);
            const former = (x - y - 1 + this.Width) / 2;
            const later = y + former - this.Width;
            const wpString = `${Math.trunc(256 - this.Width / 2 + former)},${Math.trunc(this.Width / 2 + later)}`;
            mapFile.SetStringValue('Header', `Waypoint${playerNum + 1}`, wpString);
            playerNum++;
        }

        mapFile.SetStringValue('Header', 'NumberStartingPoints', playerNum.toString());
        mapFile.SetStringValue('Basic', 'MaxPlayer', playerNum.toString());
        if (playerNum === 1) {
            mapFile.SetStringValue('Basic', 'MinPlayer', '1');
        } else if (playerNum === 0) {
            mapFile.SetStringValue('Basic', 'MinPlayer', '0');
        }

        return mapFile.WriteIniFile();
    }

    /** Recalculate [Preview] Size from [Map] LocalSize. */
    public CorrectPreviewSize(iniContent: string): string {
        const mapFile = new IniFile(iniContent);
        const localSize = mapFile.GetStringValue('Map', 'LocalSize', '0,0,0,0');
        const localWidth = parseInt(localSize.split(',')[2], 10);
        const localHeight = parseInt(localSize.split(',')[3], 10);
        mapFile.SetStringValue('Preview', 'Size', `0,0,${Math.trunc(localWidth * 1.975)},${localHeight}`);
        return mapFile.WriteIniFile();
    }

    /** Set the [Basic] Name key. */
    public ChangeName(iniContent: string, name: string): string {
        const mapFile = new IniFile(iniContent);
        mapFile.SetStringValue('Basic', 'Name', name);
        return mapFile.WriteIniFile();
    }

    /**
     * Randomise the [Lighting] section. Values are drawn from the ranges in
     * `settings` (0-10000 integer scale, divided by 10000 in the output).
     */
    public RandomSetLighting(iniContent: string, settings: LightingSettings): string {
        const mapFile = new IniFile(iniContent);
        let lighting = mapFile.GetSection('Lighting');
        if (lighting === null) {
            lighting = mapFile.AddSection('Lighting');
        }

        const [ambient1, ambient2] = settings.Ambient;
        const [level1, level2] = settings.Level;
        const [red1, red2] = settings.Red;
        const [green1, green2] = settings.Green;
        const [blue1, blue2] = settings.Blue;
        const [ionAmbient1, ionAmbient2] = settings.IonAmbient;
        const [ionLevel1, ionLevel2] = settings.IonLevel;
        const [ionRed1, ionRed2] = settings.IonRed;
        const [ionGreen1, ionGreen2] = settings.IonGreen;
        const [ionBlue1, ionBlue2] = settings.IonBlue;

        let ambient = randomNext(ambient1, ambient2) / 10000.0;
        if (randomNext(1, 1000) > 700) {
            ambient = randomNext(ambient1 - 1500, ambient2 - 500) / 10000.0;
        }
        const level = randomNext(level1, level2) / 10000.0;
        const red = randomNext(red1, red2) / 10000.0;
        const green = randomNext(green1, green2) / 10000.0;
        const blue = randomNext(blue1, blue2) / 10000.0;

        const wambient = randomNext(ionAmbient1, ionAmbient2) / 10000.0;
        const wlevel = randomNext(ionLevel1, ionLevel2) / 10000.0;
        const wred = randomNext(ionRed1, ionRed2) / 10000.0;
        const wgreen = randomNext(ionGreen1, ionGreen2) / 10000.0;
        const wblue = randomNext(ionBlue1, ionBlue2) / 10000.0;

        lighting.SetStringValue('Ambient', ambient.toFixed(6));
        lighting.SetStringValue('Level', level.toFixed(6));
        lighting.SetStringValue('Red', red.toFixed(6));
        lighting.SetStringValue('Green', green.toFixed(6));
        lighting.SetStringValue('Blue', blue.toFixed(6));

        lighting.SetStringValue('IonAmbient', wambient.toFixed(6));
        lighting.SetStringValue('IonLevel', wlevel.toFixed(6));
        lighting.SetStringValue('IonRed', wred.toFixed(6));
        lighting.SetStringValue('IonGreen', wgreen.toFixed(6));
        lighting.SetStringValue('IonBlue', wblue.toFixed(6));

        return mapFile.WriteIniFile();
    }

    /** Stamp the generator credit comment onto the INI content. */
    public AddComment(iniContent: string): string {
        const saveFile = new IniFile(iniContent);
        saveFile.comment =
            'This map is created by HFX\'s Random map generator.\n; Visit https://github.com/handama/RandomMapGenerator_RA2 to get the latest version.';
        return saveFile.WriteIniFile();
    }

    /** Set the [Basic] GameMode key. */
    public ChangeGamemode(iniContent: string, modes: string): string {
        if (modes === null || modes === '') return iniContent;
        const saveFile = new IniFile(iniContent);
        saveFile.SetStringValue('Basic', 'GameMode', modes);
        return saveFile.WriteIniFile();
    }

    /** Merge every section of `additionalIniContent` into `iniContent`. */
    public AddAdditionalINI(iniContent: string, additionalIniContent: string): string {
        if (!additionalIniContent) return iniContent;
        const saveFile = new IniFile(iniContent);
        const additional = new IniFile(additionalIniContent);
        const additionalSections = additional.GetSections();
        for (const section of additionalSections) {
            const newSection = additional.GetSection(section);
            if (newSection !== null) {
                saveFile.AddSection(newSection);
            }
        }
        return saveFile.WriteIniFile();
    }
}

export default MapFile;

// ---------------------------------------------------------------------------
// Default map INI (replaces templateMap.map)
// ---------------------------------------------------------------------------

const DEFAULT_COUNTRIES = [
  'Americans', 'Alliance', 'French', 'Germans', 'British', 'Africans',
  'Arabs', 'Confederation', 'Russians', 'YuriCountry', 'GDI', 'Nod',
];

const NEUTRAL_COUNTRIES = ['Neutral', 'Special'];

const AI_TRIGGER_IDS = [
  '0A31295C-G', '0A44F17C-G', '0A44F2CC-G', '0A452C6C-G', '0A452E5C-G',
  '0AA845AC-G', '0AA846FC-G', '0AD2BAEC-G', '0C0C7AEC-G', '0C0D184C-G',
  '0C0D251C-G', '0C1245AC-G', '0C1246FC-G', '0C32599C-G', '0C32D84C-G',
  '0C87B45C-G', '0C87B99C-G', '0C87E5AC-G', '0C8B81BC-G', '0C8BC5AC-G',
  '0C8C2AEC-G', '0C8C2C3C-G', '0C8C430C-G', '0C8C4C3C-G', '0C8C51BC-G',
  '0C8C56FC-G', '0C8C645C-G', '0C8C6EDC-G', '0C8C71BC-G', '0C8E2C3C-G',
  '0C8EE1BC-G', '0C8EEAEC-G', '0C8EEEDC-G', '0C91D45C-G', '0C92C1BC-G',
  '0C92C45C-G', '0C955AEC-G', '0C955C3C-G', '0C9561BC-G', '0C9565AC-G',
  '0C96F45C-G', '0C96F5AC-G', '0CA1F84C-G', '0CA24D8C-G', '0CA2A04C-G',
  '0CA2B06C-G', '0CA2D99C-G', '0CA2FEDC-G', '0CA5945C-G', '0CA6621C-G',
  '0CA6AEDC-G', '0CAD0B2C-G', '0CAD0C7C-G', '0CAD0DCC-G', '0CAD130C-G',
  '0CAD145C-G', '0CAD25AC-G', '0CAD2AEC-G', '0CAD2C3C-G', '0CAD5AEC-G',
  '0CADD99C-G', '0CADDEDC-G', '0CB29EDC-G', '0CB2CEDC-G', '0CDF899C-G',
  '0CDF8D8C-G', '0CDF8EDC-G', '0CE2395C-G', '0CE23AAC-G', '0CE26B5C-G',
  '0CE26CAC-G', '0CE2E8DC-G', '0CE2EA2C-G', '0CE44D0C-G', '0D022B1C-G',
  '0D022C6C-G', '0D052AEC-G', '0D0803CC-G', '0D08461C-G', '0D0848BC-G',
  '0D084A0C-G', '0D084B5C-G', '0D0873DC-G', '0D087D8C-G', '0D0B3B9C-G',
  '0D2769BC-G', '0D2C41EC-G', '0D2C448C-G', '0D2C45DC-G', '0D53099C-G',
  '0D53130C-G', '0D53430C-G', '0D535EDC-G', '0D62145C-G', '0D6215AC-G',
  '0D6216FC-G', '0D62199C-G', '0ECCB2BC-G', '0ECCB40C-G', '0ECCB55C-G',
  '0ECCB7FC-G', '0ECCBC3C-G', '0ECCF14C-G', '0ECCF29C-G', '0ECCF68C-G',
  '0ECCFA7C-G', '0ECCFCAC-G',
];

const COUNTRY_COLORS: Record<string, string> = {
  Americans: 'Gold', Alliance: 'Gold', French: 'Gold', Germans: 'Gold',
  British: 'Gold', Africans: 'DarkRed', Arabs: 'DarkRed', Confederation: 'DarkRed',
  Russians: 'DarkRed', YuriCountry: 'DarkRed', GDI: 'Gold', Nod: 'Gold',
  Neutral: 'Grey', Special: 'Grey',
};

/** Build a minimal default map INI (used when no template is provided). */
function createDefaultMapIni(): IniFile {
  const ini = new IniFile();

  // [Header]
  const header = ini.AddSection('Header');
  header.SetStringValue('Width', '0');
  header.SetStringValue('Height', '0');
  header.SetStringValue('StartX', '0');
  header.SetStringValue('StartY', '0');
  header.SetStringValue('NumberStartingPoints', '0');

  // [Basic]
  const basic = ini.AddSection('Basic');
  basic.SetStringValue('Name', 'Random Map');
  basic.SetStringValue('Author', 'Handama');
  basic.SetStringValue('Percent', '0');
  basic.SetStringValue('GameMode', 'standard');
  basic.SetStringValue('HomeCell', '98');
  basic.SetStringValue('InitTime', '10000');
  basic.SetStringValue('Official', 'no');
  basic.SetStringValue('EndOfGame', 'no');
  basic.SetStringValue('FreeRadar', 'no');
  basic.SetStringValue('MaxPlayer', '8');
  basic.SetStringValue('MinPlayer', '2');
  basic.SetStringValue('SkipScore', 'no');
  basic.SetStringValue('TrainCrate', 'no');
  basic.SetStringValue('TruckCrate', 'no');
  basic.SetStringValue('AltHomeCell', '99');
  basic.SetStringValue('OneTimeOnly', 'no');
  basic.SetStringValue('CarryOverCap', '0');
  basic.SetStringValue('NewINIFormat', '4');
  basic.SetStringValue('MultiplayerOnly', '1');
  basic.SetStringValue('IceGrowthEnabled', 'yes');
  basic.SetStringValue('VeinGrowthEnabled', 'yes');
  basic.SetStringValue('TiberiumGrowthEnabled', 'yes');
  basic.SetStringValue('IgnoreGlobalAITriggers', 'no');
  basic.SetStringValue('TiberiumDeathToVisceroid', 'no');

  // [AITriggerTypesEnable]
  const aiTrig = ini.AddSection('AITriggerTypesEnable');
  for (const id of AI_TRIGGER_IDS) {
    aiTrig.SetStringValue(id, 'yes');
  }

  // Country sections
  for (const c of DEFAULT_COUNTRIES) {
    const sec = ini.AddSection(c);
    sec.SetStringValue('IQ', '0');
    sec.SetStringValue('Edge', 'North');
    sec.SetStringValue('Color', COUNTRY_COLORS[c] || 'Gold');
    sec.SetStringValue('Allies', c);
    sec.SetStringValue('Country', c);
    sec.SetStringValue('Credits', '0');
    sec.SetStringValue('NodeCount', '0');
    sec.SetStringValue('TechLevel', '1');
    sec.SetStringValue('PercentBuilt', '0');
    sec.SetStringValue('PlayerControl', 'no');
  }
  for (const c of NEUTRAL_COUNTRIES) {
    const sec = ini.AddSection(c);
    sec.SetStringValue('IQ', '0');
    sec.SetStringValue('Edge', 'North');
    sec.SetStringValue('Color', COUNTRY_COLORS[c] || 'Grey');
    sec.SetStringValue('Allies', c);
    sec.SetStringValue('Country', c);
    sec.SetStringValue('Credits', '0');
    sec.SetStringValue('NodeCount', '0');
    sec.SetStringValue('TechLevel', '1');
    sec.SetStringValue('PercentBuilt', '0');
    sec.SetStringValue('PlayerControl', 'no');
  }

  // [Houses]
  const houses = ini.AddSection('Houses');
  houses.SetStringValue('0', 'Americans');
  houses.SetStringValue('1', 'Alliance');
  houses.SetStringValue('2', 'French');
  houses.SetStringValue('3', 'Germans');
  houses.SetStringValue('4', 'British');
  houses.SetStringValue('5', 'Africans');
  houses.SetStringValue('6', 'Arabs');
  houses.SetStringValue('7', 'Confederation');
  houses.SetStringValue('8', 'Russians');
  houses.SetStringValue('9', 'YuriCountry');
  houses.SetStringValue('10', 'GDI');
  houses.SetStringValue('11', 'Nod');
  houses.SetStringValue('12', 'Neutral');
  houses.SetStringValue('13', 'Special');

  // [General]
  const general = ini.AddSection('General');
  general.SetStringValue('PrismSupportModifier', '150%');
  general.SetStringValue('DefaultMirageDisguises', 'TREE28,TREE29,TREE30');

  // [NAYARD] / [GAYARD] / [YAYARD]
  for (const y of ['NAYARD', 'GAYARD', 'YAYARD']) {
    const sec = ini.AddSection(y);
    sec.SetStringValue('TechLevel', '11');
  }

  // [Lighting] defaults
  const lighting = ini.AddSection('Lighting');
  lighting.SetStringValue('Red', '1.000000');
  lighting.SetStringValue('Blue', '1.000000');
  lighting.SetStringValue('Green', '1.000000');
  lighting.SetStringValue('Level', '0.032000');
  lighting.SetStringValue('Ground', '0.000000');
  lighting.SetStringValue('IonRed', '0.695000');
  lighting.SetStringValue('Ambient', '1.000000');
  lighting.SetStringValue('IonBlue', '0.775000');
  lighting.SetStringValue('IonGreen', '0.445000');
  lighting.SetStringValue('IonLevel', '0.032000');
  lighting.SetStringValue('IonGround', '0.000000');
  lighting.SetStringValue('IonAmbient', '0.650000');
  lighting.SetStringValue('DominatorRed', '0.850000');
  lighting.SetStringValue('DominatorBlue', '0.300000');
  lighting.SetStringValue('DominatorGreen', '0.200000');
  lighting.SetStringValue('DominatorLevel', '0.000000');
  lighting.SetStringValue('DominatorGround', '0.000000');
  lighting.SetStringValue('DominatorAmbient', '1.500000');
  lighting.SetStringValue('DominatorAmbientChangeRate', '0.009000');

  // [SpecialFlags]
  const sf = ini.AddSection('SpecialFlags');
  sf.SetStringValue('Inert', 'no');
  sf.SetStringValue('FogOfWar', 'no');
  sf.SetStringValue('IonStorms', 'no');
  sf.SetStringValue('MCVDeploy', 'no');
  sf.SetStringValue('Meteorites', 'no');
  sf.SetStringValue('Visceroids', 'yes');
  sf.SetStringValue('FixedAlliance', 'no');
  sf.SetStringValue('TiberiumGrows', 'yes');
  sf.SetStringValue('InitialVeteran', 'no');
  sf.SetStringValue('HarvesterImmune', 'no');
  sf.SetStringValue('TiberiumSpreads', 'yes');
  sf.SetStringValue('TiberiumExplosive', 'no');
  sf.SetStringValue('DestroyableBridges', 'yes');

  // [CellTags] / [Tags] — empty
  ini.AddSection('CellTags');
  ini.AddSection('Tags');

  return ini;
}
