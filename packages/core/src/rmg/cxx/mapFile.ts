/**
 * Transliteration of:
 *   G:/MapGenerator MapGenMapFile.cpp - SaveMapFile / SaveStageSnapshot
 *   G:/MapGenerator MapGenCleanup.cpp - Cleanup()  (sub_598960 @ 0x5993A5-0x59944C)
 *   G:/MapGenerator MapGenDone.cpp    - Done()     (sub_598960 @ 0x59947E-0x59951A)
 *   G:/MapGenerator MapGenRadar.cpp   - ComputeRadarImage (image only; the GDI+
 *                                       PNG writer has no TS counterpart - the
 *                                       pixels stay available via
 *                                       getRadarImage for later comparison)
 *
 * Byte-alignment notes (see the C++ file header, MapGenMapFile.cpp:1-72):
 *  - every text append is "\n" and the C++ writes with fopen("wb"), so the
 *    .map/.yrm text uses LF line endings only - reproduced here verbatim;
 *  - [IsoMapPack5]: 8192-byte sections of 11-byte cell records, each packed by
 *    a real LZO1X-1 stream (faithful port of LZO 2.03 lzo1x_1_compress,
 *    ending in the 0x11 0x00 0x00 end marker), prefixed by a 4-byte section
 *    header {size_in u16, size_out u16};
 *  - [OverlayPack] / [OverlayDataPack]: 32 sections each of {u24 payload
 *    length, 0x20, format-80 payload} - XCC's encode80 (literal runs, back
 *    references, fill runs, 0x80 stop byte);
 *  - all three packed sections are base64'd (XCC encode64 alphabet) into
 *    numbered 70-character INI keys (sub_526E80 layout);
 *  - the readable "<name>.isopack5.txt" dump is built exactly like the C++
 *    (which only writes it under !NDEBUG); the TS port keeps Release
 *    behaviour and does not write it unless WRITE_ISOPACK5_DUMP is set.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { diag } from './diag';
import { box, WorkArray } from './types';
import type { Box, TileCellAttr } from './types';
import type { Rmg } from './mapGen';

// ---------------------------------------------------------------------------
// byte helpers (MapGenMapFile.cpp:89-100)
// ---------------------------------------------------------------------------

function putU16(out: number[], value: number): void {
    out.push(value & 0xff);
    out.push((value >>> 8) & 0xff);
}

function putU24(out: number[], value: number): void {
    out.push(value & 0xff);
    out.push((value >>> 8) & 0xff);
    out.push((value >>> 16) & 0xff);
}

/** C++ integer division (truncates toward zero). */
const idiv = (a: number, b: number): number => Math.trunc(a / b);

// ---------------------------------------------------------------------------
// format 5: LZO1X-1 (MapGenMapFile.cpp:113-334)
//
// Faithful port of LZO 2.03's src/lzo1x_1.c / lzo1x_c.c (== minilzo's
// lzo1x_1_compress). The C++ keeps the dictionary as pointers; here the
// dictionary holds input indices with -1 as the "no match" bucket (the C++
// zeroes it, nullptr reads as empty). The output format is untouched: matches
// are coded M1/M2/M3/M4 and the stream ends with 0x11 0x00 0x00.
// ---------------------------------------------------------------------------

const LZO_D_BITS = 14;
const LZO_D_SIZE = 1 << LZO_D_BITS; // 16384
const LZO_D_MASK = LZO_D_SIZE - 1; // 0x3fff
const LZO_D_HIGH = ((LZO_D_MASK >>> 1) >>> 0) + 1; // 0x2000
const LZO_M2_MAX_LEN = 8;
const LZO_M2_MAX_OFFSET = 0x0800;
const LZO_M3_MAX_OFFSET = 0x4000;
const LZO_M4_MAX_OFFSET = 0xbfff;
const LZO_M3_MARKER = 32;
const LZO_M4_MARKER = 16;

/** LZO_DX3(p, 5, 5, 6) with p an index into inp. */
function lzoDx3(inp: Uint8Array, p: number): number {
    // ((((inp[p+3] << 6) ^ inp[p+2]) << 5) ^ inp[p+1]) << 5) ^ inp[p]
    return (((((inp[p + 3]! << 6) ^ inp[p + 2]!) << 5) ^ inp[p + 1]!) << 5) ^ inp[p]!;
}

/** LZO_D_INDEX1: d = DM(DMUL(0x21, DX3(p,5,5,6)) >> 5). */
function lzoDIndex1(inp: Uint8Array, p: number): number {
    // 0x21 * dx3 < 2^31, so imul is the exact product.
    return (Math.imul(0x21, lzoDx3(inp, p)) >>> 5) & LZO_D_MASK;
}

/** LZO_D_INDEX2: d = (d & (MASK & 0x7ff)) ^ (HIGH | 0x1f). */
function lzoDIndex2(d: number): number {
    return (d & (LZO_D_MASK & 0x7ff)) ^ (LZO_D_HIGH | 0x1f);
}

/**
 * Lzo1xDoCompress - writes matches and stores trailing literals into the
 * dictionary, then returns the number of bytes at the end of the input still
 * left to emit. `outLen.v` receives the number of bytes written to `out`.
 */
function lzo1xDoCompress(
    inp: Uint8Array,
    inLen: number,
    out: Uint8Array,
    outLen: Box<number>,
    dict: Int32Array,
): number {
    let op = 0; // write index (C++ `op` pointer)
    let ip = 0; // read index (C++ `ip` pointer)
    let ii = 0; // start of the pending literal run
    const inEnd = inLen;
    const ipEnd = inLen - LZO_M2_MAX_LEN - 5;

    ip += 4;
    for (;;) {
        let mOff = 0;
        let mLen: number;
        let dindex: number;
        let mp: number;
        // The C++ goto ladder: probe 1 -> (bucket bad ? literal : B) ;
        // B true -> try_match ; B false -> INDEX2 + probe 2 -> literal /
        // try_match. The literal store must use the dindex current at the
        // goto, so the branch shape below preserves it exactly.
        let tryMatch = false;

        dindex = lzoDIndex1(inp, ip);
        mp = dict[dindex]!;
        const ip3 = inp[ip + 3]!;
        if (mp < 0 || mp >= ip || (mOff = ip - mp) > LZO_M4_MAX_OFFSET) {
            // goto literal (probe-1 dindex)
        } else if (mOff <= LZO_M2_MAX_OFFSET || inp[mp + 3] === ip3) {
            tryMatch = true;
        } else {
            dindex = lzoDIndex2(dindex);
            mp = dict[dindex]!;
            if (mp < 0 || mp >= ip || (mOff = ip - mp) > LZO_M4_MAX_OFFSET) {
                // goto literal (INDEX2 dindex)
            } else if (mOff <= LZO_M2_MAX_OFFSET || inp[mp + 3] === ip3) {
                tryMatch = true;
            } else {
                // goto literal (INDEX2 dindex)
            }
        }

        // try_match: only a full 3-byte head confirms the match.
        if (tryMatch && inp[mp] === inp[ip] && inp[mp + 1] === inp[ip + 1] && inp[mp + 2] === inp[ip + 2]) {
            // ---- match ----
            dict[dindex] = ip;
            if (ip - ii > 0) {
                let t = ip - ii;
                if (t <= 3) out[op - 2] = (out[op - 2]! | t) & 0xff;
                else if (t <= 18) out[op++] = t - 3;
                else {
                    let tt = t - 18;
                    out[op++] = 0;
                    while (tt > 255) {
                        tt -= 255;
                        out[op++] = 0;
                    }
                    out[op++] = tt & 0xff;
                }
                do {
                    out[op++] = inp[ii++]!;
                    --t;
                } while (t > 0);
            }
            ip += 3;
            // m_pos[3] != *ip++ || ... || m_pos[8] != *ip++  (short-circuits,
            // ip stays on the first mismatched byte after the --ip below)
            let mismatch = false;
            if (inp[mp + 3] !== inp[ip++]) mismatch = true;
            else if (inp[mp + 4] !== inp[ip++]) mismatch = true;
            else if (inp[mp + 5] !== inp[ip++]) mismatch = true;
            else if (inp[mp + 6] !== inp[ip++]) mismatch = true;
            else if (inp[mp + 7] !== inp[ip++]) mismatch = true;
            else if (inp[mp + 8] !== inp[ip++]) mismatch = true;

            if (mismatch) {
                --ip;
                mLen = ip - ii;
                if (mOff <= LZO_M2_MAX_OFFSET) {
                    mOff -= 1;
                    out[op++] = (((mLen - 1) << 5) | ((mOff & 7) << 2)) & 0xff;
                    out[op++] = (mOff >>> 3) & 0xff;
                } else if (mOff <= LZO_M3_MAX_OFFSET) {
                    mOff -= 1;
                    out[op++] = (LZO_M3_MARKER | (mLen - 2)) & 0xff;
                    // goto m3_m4_offset
                    out[op++] = ((mOff & 63) << 2) & 0xff;
                    out[op++] = (mOff >>> 6) & 0xff;
                } else {
                    mOff -= 0x4000;
                    out[op++] = (LZO_M4_MARKER | ((mOff & 0x4000) >>> 11) | (mLen - 2)) & 0xff;
                    // goto m3_m4_offset
                    out[op++] = ((mOff & 63) << 2) & 0xff;
                    out[op++] = (mOff >>> 6) & 0xff;
                }
            } else {
                // extended match: walk to the end of the run
                const end = inEnd;
                let m = mp + LZO_M2_MAX_LEN + 1;
                while (ip < end && inp[m] === inp[ip]) {
                    m++;
                    ip++;
                }
                mLen = ip - ii;
                let writeLen = false;
                if (mOff <= LZO_M3_MAX_OFFSET) {
                    mOff -= 1;
                    if (mLen <= 33) out[op++] = (LZO_M3_MARKER | (mLen - 2)) & 0xff;
                    else {
                        mLen -= 33;
                        out[op++] = LZO_M3_MARKER | 0;
                        writeLen = true; // goto m3_m4_len
                    }
                } else {
                    mOff -= 0x4000;
                    if (mLen <= 9) {
                        out[op++] = (LZO_M4_MARKER | ((mOff & 0x4000) >>> 11) | (mLen - 2)) & 0xff;
                    } else {
                        mLen -= 9;
                        out[op++] = (LZO_M4_MARKER | ((mOff & 0x4000) >>> 11)) & 0xff;
                        writeLen = true; // goto m3_m4_len
                    }
                }
                if (writeLen) {
                    // m3_m4_len
                    while (mLen > 255) {
                        mLen -= 255;
                        out[op++] = 0;
                    }
                    out[op++] = mLen & 0xff;
                }
                // m3_m4_offset
                out[op++] = ((mOff & 63) << 2) & 0xff;
                out[op++] = (mOff >>> 6) & 0xff;
            }
            ii = ip;
            if (ip >= ipEnd) break;
        } else {
            // ---- literal ----
            dict[dindex] = ip;
            ++ip;
            if (ip >= ipEnd) break;
        }
    }

    outLen.v = op;
    return inEnd - ii;
}

/**
 * Lzo1xCompress - returns the compressed size. `out` must be able to hold
 * inLen + inLen / 16 + 64 + 3 bytes; the result always ends in the LZO1X end
 * marker 0x11 0x00 0x00.
 */
function lzo1xCompress(inp: Uint8Array, inLen: number, out: Uint8Array): number {
    const dict = new Int32Array(LZO_D_SIZE).fill(-1);

    let op = 0;
    let t: number;

    if (inLen <= LZO_M2_MAX_LEN + 5) {
        t = inLen;
    } else {
        const outLen = box(0);
        t = lzo1xDoCompress(inp, inLen, out, outLen, dict);
        op += outLen.v;
    }

    if (t > 0) {
        let ii = inLen - t;
        if (op === 0 && t <= 238) out[op++] = (17 + t) & 0xff;
        else if (t <= 3) out[op - 2] = (out[op - 2]! | t) & 0xff;
        else if (t <= 18) out[op++] = t - 3;
        else {
            let tt = t - 18;
            out[op++] = 0;
            while (tt > 255) {
                tt -= 255;
                out[op++] = 0;
            }
            out[op++] = tt & 0xff;
        }
        do {
            out[op++] = inp[ii++]!;
            --t;
        } while (t > 0);
    }

    out[op++] = LZO_M4_MARKER | 1; // the LZO1X end-of-stream marker: 0x11
    out[op++] = 0;
    out[op++] = 0;
    return op;
}

/** AppendPack5Section (MapGenMapFile.cpp:354-363). */
function appendPack5Section(out: number[], data: Uint8Array): void {
    const size = data.length;
    const payload = new Uint8Array(size + Math.floor(size / 16) + 64 + 3);
    const compressed = lzo1xCompress(data, size, payload);

    putU16(out, compressed); // size_in
    putU16(out, size); // size_out
    for (let i = 0; i < compressed; ++i) out.push(payload[i]!);
}

// ---------------------------------------------------------------------------
// format 80: OverlayPack / OverlayDataPack (MapGenMapFile.cpp:373-516)
//
// Faithful port of XCC's encode80 (shp_decode.cpp): literal runs, back
// reference copies and fill runs, ending in a bare 0x80 stop byte.
// ---------------------------------------------------------------------------

/** RunLength (MapGenMapFile.cpp:373). */
function runLength80(s: Uint8Array, r: number, sEnd: number): number {
    let count = 1;
    const v = s[r++]!;
    while (r < sEnd && s[r++]! === v) ++count;
    return count;
}

/**
 * XCC's get_same(): the longest prefix shared by s[r..] and any earlier
 * position s[q..], q < r; ties go to the LAST candidate (the `>=` below, as
 * in the original inline asm). Out via boxes p / cbP.
 * (Fast path: a q whose first byte differs always has len 0, which updates
 * p only while best is still 0 - provably identical, and it keeps the
 * uniform-0xFF overlay grids from walking every candidate.)
 */
function getSame80(
    s: Uint8Array,
    r: number,
    sEnd: number,
    p: Box<number>,
    cbP: Box<number>,
): void {
    let best = 0;
    p.v = 0;
    for (let q = 0; q < r; ++q) {
        if (s[q] !== s[r]) {
            if (best === 0) p.v = q;
            continue;
        }
        let a = q;
        let b = r;
        let len = 0;
        while (b < sEnd && s[a] === s[b]) {
            ++a;
            ++b;
            ++len;
        }
        if (len >= best) {
            best = len;
            p.v = q;
        }
    }
    cbP.v = best;
}

/** Encode80 (MapGenMapFile.cpp:464-505). Returns the packed size. */
function encode80(s: Uint8Array, d: Uint8Array, cbS: number): number {
    // A section made of a single repeated byte always encodes to
    // 0xFE, len lo, len hi, value, 0x80 - the general loop below would emit
    // exactly that (t == cb_p at r = 0, so the C3 fill branch runs and r
    // jumps past the whole section). Spelling it out keeps the uniform
    // 0xFF/0x00 overlay grids from paying get_same's O(n^2).
    if (cbS > 3) {
        const v0 = s[0]!;
        let uniform = true;
        for (let i = 1; i < cbS; ++i) {
            if (s[i] !== v0) {
                uniform = false;
                break;
            }
        }
        if (uniform) {
            d[0] = 0xfe;
            d[1] = cbS & 0xff;
            d[2] = (cbS >> 8) & 0xff;
            d[3] = v0;
            d[4] = 0x80;
            return 5;
        }
    }

    const sEnd = cbS;
    let r = 0;
    let w = 0;
    let copyFrom = -1; // null

    const write80c0 = (count: number, p: number): void => {
        d[w++] = (((count - 3) << 4) | (p >>> 8)) & 0xff;
        d[w++] = p & 0xff;
    };
    const write80c1 = (count: number, rFrom: number): void => {
        do {
            const cWrite = count < 0x40 ? count : 0x3f;
            d[w++] = (0x80 | cWrite) & 0xff;
            if (cWrite > 0) {
                for (let k = 0; k < cWrite; ++k) d[w + k] = s[rFrom + k]!;
            }
            rFrom += cWrite;
            w += cWrite;
            count -= cWrite;
        } while (count !== 0);
    };
    const write80c2 = (count: number, p: number): void => {
        d[w++] = (0xc0 | (count - 3)) & 0xff;
        d[w++] = p & 0xff;
        d[w++] = (p >>> 8) & 0xff;
    };
    const write80c3 = (count: number, v: number): void => {
        d[w++] = 0xfe;
        d[w++] = count & 0xff;
        d[w++] = (count >>> 8) & 0xff;
        d[w++] = v & 0xff;
    };
    const write80c4 = (count: number, p: number): void => {
        d[w++] = 0xff;
        d[w++] = count & 0xff;
        d[w++] = (count >>> 8) & 0xff;
        d[w++] = p & 0xff;
        d[w++] = (p >>> 8) & 0xff;
    };
    const flush80c1 = (rTo: number): void => {
        if (copyFrom >= 0) {
            write80c1(rTo - copyFrom, copyFrom);
            copyFrom = -1;
        }
    };

    const pBox = box(0);
    const cbBox = box(0);

    while (r < sEnd) {
        const t = runLength80(s, r, sEnd);
        getSame80(s, r, sEnd, pBox, cbBox);
        const p = pBox.v;
        const cbP = cbBox.v;
        if (t < cbP && cbP > 2) {
            flush80c1(r);
            if (cbP - 3 < 8 && r - p < 0x1000) write80c0(cbP, r - p);
            else if (cbP - 3 < 0x3e) write80c2(cbP, p);
            else write80c4(cbP, p);
            r += cbP;
        } else {
            if (t < 3) {
                if (copyFrom < 0) copyFrom = r;
            } else {
                flush80c1(r);
                write80c3(t, s[r]!);
            }
            r += t;
        }
    }
    flush80c1(r);
    write80c1(0, 0);
    return w;
}

/** AppendPack80Section (MapGenMapFile.cpp:507-516). */
function appendPack80Section(out: number[], data: Uint8Array): void {
    const size = data.length;
    const payload = new Uint8Array(size + Math.floor(size / 30) + 16);
    const packed = encode80(data, payload, size);

    putU24(out, packed);
    out.push(0x20);
    for (let i = 0; i < packed; ++i) out.push(payload[i]!);
}

// ---------------------------------------------------------------------------
// base64 (XCC's encode64_table) + the numbered-key section writer
// (MapGenMapFile.cpp:520-581)
// ---------------------------------------------------------------------------

const K_BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function encodeBase64(data: ArrayLike<number>): string {
    let out = '';
    const n = data.length;

    let i = 0;
    while (i + 3 <= n) {
        const v = ((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!) >>> 0;
        out += K_BASE64[(v >>> 18) & 0x3f];
        out += K_BASE64[(v >>> 12) & 0x3f];
        out += K_BASE64[(v >>> 6) & 0x3f];
        out += K_BASE64[v & 0x3f];
        i += 3;
    }
    if (n - i === 1) {
        const v = (data[i]! << 16) >>> 0;
        out += K_BASE64[(v >>> 18) & 0x3f];
        out += K_BASE64[(v >>> 12) & 0x3f];
        out += '=';
        out += '=';
    } else if (n - i === 2) {
        const v = ((data[i]! << 16) | (data[i + 1]! << 8)) >>> 0;
        out += K_BASE64[(v >>> 18) & 0x3f];
        out += K_BASE64[(v >>> 12) & 0x3f];
        out += K_BASE64[(v >>> 6) & 0x3f];
        out += '=';
    }
    return out;
}

/** A packed blob becomes numbered 70-character INI lines (sub_526E80). */
function appendPackedSection(text: string, name: string, packed: number[]): string {
    const b64 = encodeBase64(packed);

    text += '[';
    text += name;
    text += ']\n';

    let line = 1;
    for (let pos = 0; pos < b64.length; pos += 70) {
        text += String(line++);
        text += '=';
        text += b64.substr(pos, 70);
        text += '\n';
    }
    text += '\n';
    return text;
}

// ---------------------------------------------------------------------------
// text helpers (MapGenMapFile.cpp:583-629)
// ---------------------------------------------------------------------------

/** std::snprintf("%d"). */
const Int = (v: number): string => String(v | 0);

/** std::snprintf("%f") - six decimals. */
const Real = (v: number): string => v.toFixed(6);

/** One entry of the RMG's per-time-of-day light lists, as a 0..1 factor. */
function lightFactor(list: number[], index: number, fallback: number): number {
    if (index < 0 || index >= list.length) return fallback;
    return list[index]! / 100.0;
}

// FA2's MapCode.cpp calcXPos / calcYPos. Every division is an integer
// division (truncates toward zero). The caller passes the cell's (Y, X):
// FA2's header and waypoint loops work in the swapped "WS" order.
function headerX(x: number, y: number): number {
    const x1 = x * 256 + 128;
    const y1 = y * 256 + 128;
    const x2 = (x1 - y1) * 30;
    return idiv(idiv(x2, 256) + 512 * 30, 60);
}

function headerY(x: number, y: number): number {
    const x1 = x * 256 + 128;
    const y1 = y * 256 + 128;
    const y2 = (x1 + y1) * 15;
    return idiv(idiv(y2, 256), 30);
}

/** [port-only] Debug switch for the "<name>.isopack5.txt" dump (C++: !NDEBUG). */
const WRITE_ISOPACK5_DUMP = false;

/** [port-only] Where saveStageSnapshot puts its files (the C++ outputDir_). */
let snapshotOutputDir: string | null = null;

/** [port-only] Set the snapshot output folder (the C++ SetOutputDir). */
export function setSnapshotOutputDir(dir: string): void {
    snapshotOutputDir = dir;
}

// ---------------------------------------------------------------------------
// SaveMapFile (MapGenMapFile.cpp:640-1183)
// ---------------------------------------------------------------------------

export function saveMapFile(r: Rmg, path: string): boolean {
    if (!path) return false;

    const slots = r.cellSlots;
    if (slots.length === 0) return false;

    // The port's slot array is slotRows * 512, slotRows = mapWidth + mapHeight
    // + 1 (AllocateCells). Walk it whole and skip the empty slots.
    const rows = r.size.mapWidth + r.size.mapHeight + 1;

    // ---- 1. [IsoMapPack5]: 11 bytes per cell ------------------------------
    // record: +0/+2 X/Y (int16), +4 tile (u16), +6 bMapData (0),
    //         +8 Height (the TMP Z slice), +9 Level, +10 IsIceGrowthAllowed.
    const iso: number[] = [];
    let dump = '';

    dump += '; IsoMapPack5 uncompressed data - one line per cell, in pack order.\n';
    dump += '; X Y tile bMapData bSubTile bHeight bMapData2 = Height Level LandType SlopeIndex Passability | hex\n';

    let cellCount = 0;
    let foundationTilesStamped = 0; // [port-only] 地基占位瓦替换计数
    for (let y = 0; y < rows; ++y) {
        for (let x = 0; x < 512; ++x) {
            const cell = slots[512 * y + x];
            if (!cell) continue;

            const cellX = (cell.mapCoords << 16) >> 16; // int16 low half
            const cellY = (((cell.mapCoords >>> 16) & 0xffff) << 16) >> 16; // int16 high half

            // Write the raw tile index; tile 0 stays 0 (the loader fills it).
            let tile = cell.isoTileTypeIndex;

            // [port-only] a tech-building foundation cell must carry a real,
            // flat clear tile in the saved file (FA2's minimap skips tile 0).
            if ((cell.altFlags & 0x2) !== 0 && (tile === 0 || tile === 0xffff) && r.clearTileIndex >= 0) {
                tile = r.clearTileIndex;
                ++foundationTilesStamped;
            }

            const record: number[] = [
                cellX & 0xff, // +0 X
                (cellX >>> 8) & 0xff,
                cellY & 0xff, // +2 Y
                (cellY >>> 8) & 0xff,
                tile & 0xff, // +4 tile
                (tile >>> 8) & 0xff,
                0, // +6 bMapData
                0,
                cell.height & 0xff, // +8 Height
                cell.level & 0xff, // +9 Level
                0, // +10 IsIceGrowthAllowed
            ];

            for (let i = 0; i < 11; ++i) iso.push(record[i]!);
            ++cellCount;

            let hex = '';
            for (let i = 0; i < 11; ++i) hex += record[i]!.toString(16).toUpperCase().padStart(2, '0');

            dump +=
                `${cellX}\t${cellY}\t${tile}\t${record[6]! | (record[7]! << 8)}\t` +
                `${record[8]!}\t${record[9]!}\t${record[10]!}\t` +
                `${cell.height}\t${cell.level}\t${cell.landType}\t${cell.slopeIndex}\t${cell.passability}\t${hex}\n`;
        }
    }
    dump += `; cells = ${Int(cellCount)}\n`;
    diag(`SAVE-FILE clearTileIndex=${r.clearTileIndex} foundation placeholder cells stamped=${foundationTilesStamped}`);

    const isoPack: number[] = [];
    const isoBytes = Uint8Array.from(iso);
    for (let off = 0; off < isoBytes.length; off += 8192) {
        const len = Math.min(8192, isoBytes.length - off);
        appendPack5Section(isoPack, isoBytes.subarray(off, off + len));
    }

    // ---- 2. [OverlayPack] / [OverlayDataPack]: 512 x 512, X + 512 * Y -----
    const kGridSize = 512 * 512;
    const overlay = new Uint8Array(kGridSize).fill(0xff); // 0xFF = no overlay
    const overlayData = new Uint8Array(kGridSize); // 0x00

    for (let y = 0; y < rows; ++y) {
        for (let x = 0; x < 512; ++x) {
            const cell = slots[512 * y + x];
            if (!cell) continue;
            if (cell.overlayTypeIndex < 0 || cell.overlayTypeIndex > 0xfe) continue;

            const index = x + 512 * y;
            if (index >= kGridSize) continue;

            overlay[index] = cell.overlayTypeIndex & 0xff;
            overlayData[index] = cell.overlayData & 0xff;
        }
    }

    const overlayPack: number[] = [];
    const overlayDataPack: number[] = [];
    for (let section = 0; section < 32; ++section) {
        // 262144 / 8192
        appendPack80Section(overlayPack, overlay.subarray(section * 8192, section * 8192 + 8192));
        appendPack80Section(overlayDataPack, overlayData.subarray(section * 8192, section * 8192 + 8192));
    }

    // ---- 2b. the multiplayer [Header] rectangle ---------------------------
    // FA2's MC_GetHeaderRect walk: loop x is the cell's Y, loop y the cell's X
    // ("WS coordinate system"); cells outside the diamond read as height 0.
    let headerStartX = 0;
    let headerStartY = 0;
    let headerWidth = 0;
    let headerHeight = 0;
    if (r.config.multiplayer) {
        const localLeft = 2; // [Map] LocalSize left
        const localTop = 5; // [Map] LocalSize top
        const localWidth = r.size.width; // [Map] LocalSize width
        const localHeight = r.size.height; // [Map] LocalSize height
        const playWidth = r.size.mapWidth; // [Map] Size width
        const isoSize = r.size.mapWidth + r.size.mapHeight;

        let leastX = 10000;
        let leastY = 10000;
        let mostX = 0;
        let mostY = 0;

        for (let loopX = 0; loopX < isoSize; ++loopX) {
            for (let loopY = 0; loopY < isoSize; ++loopY) {
                const cellX = loopY;
                const cellY = loopX;
                const cell =
                    cellX < 512 && cellY < rows ? slots[512 * cellY + cellX] ?? null : null;
                const height = cell ? cell.height : 0;

                if (!(loopX + loopY > playWidth + 2 * localTop + height)) continue;
                if (!(loopX + loopY <= playWidth + 2 * (localTop + localHeight + 1) + height)) continue;
                if (!(loopX - loopY < 2 * (localLeft + localWidth) - playWidth)) continue;
                if (!(loopY - loopX < playWidth - 2 * localLeft)) continue;

                const rx = headerX(loopX, loopY);
                const ry = headerY(loopX, loopY);
                if (rx < leastX) leastX = rx;
                if (rx > mostX) mostX = rx;
                if (ry < leastY) leastY = ry;
                if (ry > mostY) mostY = ry;
            }
        }

        headerStartX = leastX;
        headerStartY = leastY;
        headerWidth = mostX - leastX;
        headerHeight = mostY - leastY;
    }

    // ---- 3. the text -------------------------------------------------------
    const timeOfDay = r.config.timeOfDay;
    const snow = r.config.theater !== 0;

    let text = '';
    text += '; Generated by the MapGenerator random map generator (RMG port)\n';
    text += '; IsoMapPack5 / OverlayPack / OverlayDataPack follow the engine\'s\n';
    text += '; own save path (MapClass writer sub_4AD7E0).\n\n';

    text += '[Header]\n';
    if (r.config.multiplayer) {
        // FA2 writes this block for multiplayer maps only. Starts beyond the
        // eighth read 0,0, as FA2 leaves them.
        text += `Width=${Int(headerWidth)}\n`;
        text += `Height=${Int(headerHeight)}\n`;
        text += `StartX=${Int(headerStartX)}\n`;
        text += `StartY=${Int(headerStartY)}\n`;
        for (let i = 0; i < 8; ++i) {
            text += `Waypoint${Int(i + 1)}=`;
            if (i < r.startingPoints.length) {
                const sp = r.startingPoints[i]!;
                const cX = (sp.coords << 16) >> 16; // CellStruct::X
                const cY = (((sp.coords >>> 16) & 0xffff) << 16) >> 16; // CellStruct::Y
                text += Int(headerX(cY, cX)); // FA2 passes the cell's (Y, X)
                text += ',';
                text += Int(headerY(cY, cX));
            } else {
                text += '0,0';
            }
            text += '\n';
        }
    }
    text += `NumberStartingPoints=${Int(r.startingPoints.length)}\n\n`;

    text += '[Basic]\n';
    text += 'Name=No name\n';
    // A multiplayer map carries no [Basic] Player key.
    if (!r.config.multiplayer) text += 'Player=Neutral House\n';
    text += 'Percent=0\n';
    text += 'GameMode=standard\n';
    // Multiplayer maps keep the shipped maps' placeholders (98 / 99).
    if (r.config.multiplayer) {
        text += 'HomeCell=98\n';
        text += 'AltHomeCell=99\n';
    } else {
        text += `HomeCell=${Int(r.startingPoints.length === 0 ? 98 : r.startingPoints[0]!.index)}\n`;
        text += `AltHomeCell=${Int(r.startingPoints.length > 1 ? r.startingPoints[1]!.index : 99)}\n`;
    }
    text += 'InitTime=10000\n';
    text += 'Official=no\n';
    text += 'EndOfGame=no\n';
    text += 'FreeRadar=no\n';
    text += `MaxPlayer=${Int(r.config.playerCount)}\n`;
    text += 'MinPlayer=2\n';
    text += 'SkipScore=no\n';
    text += 'TrainCrate=no\n';
    text += 'TruckCrate=no\n';
    text += 'OneTimeOnly=no\n';
    text += 'CarryOverCap=0\n';
    text += 'NewINIFormat=4\n';
    text += 'NextScenario=\n';
    text += 'AltNextScenario=\n';
    text += 'SkipMapSelect=no\n';
    text += 'CarryOverMoney=0.000000\n';
    text += 'MultiplayerOnly=';
    text += Int(r.config.multiplayer ? 1 : 0);
    text += '\n';
    text += 'IceGrowthEnabled=yes\n';
    text += 'VeinGrowthEnabled=yes\n';
    text += 'TiberiumGrowthEnabled=yes\n';
    text += 'IgnoreGlobalAITriggers=no\n';
    text += 'TiberiumDeathToVisceroid=no\n\n';

    text += '[Map]\n';
    text += `Size=0,0,${Int(r.size.mapWidth)},${Int(r.size.mapHeight)}\n`;
    text += 'Theater=';
    text += snow ? 'SNOW' : 'TEMPERATE';
    text += '\n';
    text += `LocalSize=2,5,${Int(r.size.width)},${Int(r.size.height)}\n\n`;

    text += '[Lighting]\n';
    text += `Ambient=${Real(lightFactor(snow ? r.settings.SnowAmbientLight : r.settings.TemperateAmbientLight, timeOfDay, 1.0))}\n`;
    text += `Red=${Real(lightFactor(snow ? r.settings.SnowAmbientRed : r.settings.TemperateAmbientRed, timeOfDay, 1.0))}\n`;
    text += `Green=${Real(lightFactor(snow ? r.settings.SnowAmbientGreen : r.settings.TemperateAmbientGreen, timeOfDay, 1.0))}\n`;
    text += `Blue=${Real(lightFactor(snow ? r.settings.SnowAmbientBlue : r.settings.TemperateAmbientBlue, timeOfDay, 1.0))}\n`;
    text += `Level=${Real(lightFactor(r.settings.LevelLightSettings, timeOfDay, 0.0))}\n\n`;

    // ---- 4. the three packed sections -------------------------------------
    text = appendPackedSection(text, 'IsoMapPack5', isoPack);
    text = appendPackedSection(text, 'OverlayDataPack', overlayDataPack);
    text = appendPackedSection(text, 'OverlayPack', overlayPack);

    // ---- 5. the object ledgers --------------------------------------------
    const neutralOwner = r.config.multiplayer ? 'Neutral' : 'Neutral House';

    if (r.config.multiplayer) {
        if (r.multiplayerHouses.length !== 0) {
            text += '[Houses]\n';
            for (let i = 0; i < r.multiplayerHouses.length; ++i) {
                text += Int(i);
                text += '=';
                text += r.multiplayerHouses[i]!.country;
                text += '\n';
            }
            text += '\n';

            for (let i = 0; i < r.multiplayerHouses.length; ++i) {
                const h = r.multiplayerHouses[i]!;
                text += '[';
                text += h.country;
                text += ']\n';
                text += 'IQ=0\n';
                text += 'Edge=North\n';
                text += 'Color=';
                text += h.color;
                text += '\n';
                text += 'Allies=';
                text += h.country;
                text += '\n';
                text += 'Country=';
                text += h.country;
                text += '\n';
                text += 'Credits=0\n';
                text += 'NodeCount=0\n';
                text += 'TechLevel=1\n';
                text += 'PercentBuilt=0\n';
                text += 'PlayerControl=no\n\n';
            }
        } else {
            // Rules INI missing or empty: fall back to the neutral house alone.
            text += '[Houses]\n';
            text += '12=Neutral\n\n';

            text += '[Neutral]\n';
            text += 'IQ=0\n';
            text += 'Edge=North\n';
            text += 'Color=Grey\n';
            text += 'Allies=Neutral\n';
            text += 'Country=Neutral\n';
            text += 'Credits=0\n';
            text += 'NodeCount=0\n';
            text += 'TechLevel=1\n';
            text += 'PercentBuilt=0\n';
            text += 'PlayerControl=no\n\n';
        }
    } else if (r.structures.length !== 0) {
        text += '[Countries]\n';
        text += '12=Neutral\n\n';

        text += '[Houses]\n';
        text += '12=Neutral House\n\n';

        text += '[Neutral House]\n';
        text += 'IQ=5\n';
        text += 'Edge=North\n';
        text += 'Color=Grey\n';
        text += 'Allies=Neutral House\n';
        text += 'Country=Neutral\n';
        text += 'Credits=0\n';
        text += 'NodeCount=0\n';
        text += 'TechLevel=10\n';
        text += 'PercentBuilt=100\n';
        text += 'PlayerControl=no\n\n';
    }

    // [Waypoints] keys on the waypoint number, values X + 1000*Y.
    text += '[Waypoints]\n';
    for (let i = 0; i < r.startingPoints.length; ++i) {
        const sp = r.startingPoints[i]!;
        const cX = (sp.coords << 16) >> 16;
        const cY = (((sp.coords >>> 16) & 0xffff) << 16) >> 16;
        text += Int(sp.index);
        text += '=';
        text += Int(cX + 1000 * cY);
        text += '\n';
    }
    text += '\n';

    // [Terrain] keys on the packed cell, values are the type name.
    if (r.terrainObjects.length !== 0) {
        text += '[Terrain]\n';
        for (let i = 0; i < r.terrainObjects.length; ++i) {
            const t = r.terrainObjects[i]!;
            if (!t.typeName) continue;
            const cX = (t.coords << 16) >> 16;
            const cY = (((t.coords >>> 16) & 0xffff) << 16) >> 16;
            text += Int(cX + 1000 * cY);
            text += '=';
            text += t.typeName;
            text += '\n';
        }
        text += '\n';
    }

    // [Structures]: the 17-field line the shipped maps use.
    // house,type,strength,Y,X,direction,... - field 3 is coords.X (the pack's
    // row) and field 4 coords.Y (the column); see MapGenMapFile.cpp:1131-1147.
    if (r.structures.length !== 0) {
        text += '[Structures]\n';
        let line = 0;
        for (let i = 0; i < r.structures.length; ++i) {
            const s = r.structures[i]!;
            if (!s.typeName) continue;
            text += Int(line++);
            text += '=';
            text += r.config.multiplayer
                ? neutralOwner
                : s.houseName
                  ? s.houseName
                  : 'Neutral House';
            text += ',';
            text += s.typeName;
            text += ',256,';
            text += Int((s.coords << 16) >> 16); // coords.X
            text += ',';
            text += Int((((s.coords >>> 16) & 0xffff) << 16) >> 16); // coords.Y
            text += ',';
            text += Int(s.facing);
            text += ',None,0,0,1,0,0,None,None,None,1,0\n';
        }
        text += '\n';
    }

    // ---- 6. write the map out ---------------------------------------------
    try {
        // Windows-ANSI INI text: byte-oriented, so latin1 chars -> bytes.
        writeFileSync(path, Buffer.from(text, 'latin1'));
    } catch {
        return false;
    }

    // ---- 7. the readable dump (C++ writes it under !NDEBUG only) ----------
    if (WRITE_ISOPACK5_DUMP) {
        const dot = path.lastIndexOf('.');
        const dumpPath = (dot >= 0 ? path.slice(0, dot) : path) + '.isopack5.txt';
        try {
            writeFileSync(dumpPath, Buffer.from(dump, 'latin1'));
        } catch {
            // fopen failure in the C++ leaves the dump silently unwritten too.
        }
    }

    return true;
}

// ---------------------------------------------------------------------------
// SaveStageSnapshot (MapGenMapFile.cpp:1199-1221) - [port-only diagnostic]
//
// Writes "<YYYYMMDD_HHMMSS>_<stageName>.map" (local time, GetLocalTime) into
// the snapshot output folder via SaveMapFile. The folder defaults to the
// process working directory; set it with setSnapshotOutputDir().
// ---------------------------------------------------------------------------

export function saveStageSnapshot(r: Rmg, stageName: string): void {
    if (!stageName) return;

    const dir = snapshotOutputDir ?? process.cwd();
    try {
        mkdirSync(dir, { recursive: true }); // CreateDirectoryW: exists -> ignored
    } catch {
        // ignore, like the C++
    }

    const now = new Date();
    const p2 = (v: number): string => String(v).padStart(2, '0');
    const stamp =
        `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}_` +
        `${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}_${stageName}.map`;

    saveMapFile(r, join(dir, stamp));
}

// ---------------------------------------------------------------------------
// Cleanup (MapGenCleanup.cpp, sub_598960 @ 0x5993A5 - 0x59944C)
//
// Pure teardown: touches no cell, no tile, no RNG. Every container released
// here is re-created at the head of the next Generate call, so on the port's
// ledger model this drops the storage explicitly.
// ---------------------------------------------------------------------------

export function cleanupStage(r: Rmg): void {
    // ---- 0x5993BB - 0x5993D0: the work array ------------------------------
    r.work = new WorkArray(0); // delete[] workCells_; workCells_ = nullptr

    // ---- 0x5993D6 - 0x59943C: every region object -------------------------
    // The vanilla walks the list backwards, visiting each region exactly once;
    // the port's ledger holds plain records, so pop from the back.
    while (r.regions.length > 0) r.regions.pop();

    // ---- 0x599446: the region-id counter ----------------------------------
    r.regionIdCounter = 0;

    // ---- 0x59944C: MouseClass's per-cell attribute arrays -----------------
    // std::vector<>().swap(...) releases the capacity too.
    r.levelAndPassability = [];
    r.levelAndPassability2 = [];
    r.passabilityCopy = new Uint8Array(0);
    for (let i = 0; i < 256; ++i) r.zoneConnections[i] = [];

    // ---- the elevation grid -----------------------------------------------
    r.elevGrid = [];
}

// ---------------------------------------------------------------------------
// Done (MapGenDone.cpp, sub_598960 @ 0x59947E - 0x59951A)
//
// Progress / dialog bookkeeping, not map data: the 100 % tick
// (sub_643C50(&progress, 0, 100.0, NAN) on the local path), then the teardown
// (the bar back to zero + the sink detached, sub_643E70's progress->hWnd = 0).
// ---------------------------------------------------------------------------

/** The port's progressSink_ / progressContext_ (module-local stand-ins). */
let progressSink: ((context: unknown, percent: number) => void) | null = null;
let progressContext: unknown = null;

/** SetProgressSink (MapGenDone.cpp:49-53). */
export function setProgressSink(sink: ((context: unknown, percent: number) => void) | null, context: unknown): void {
    progressSink = sink;
    progressContext = context;
}

/** ReportProgress (MapGenDone.cpp:55-67): sub_643C50 clamps to the 0..100 bar. */
function reportProgress(r: Rmg, percent: number): void {
    if (percent < 0) percent = 0;
    else if (percent > 100) percent = 100;

    r.progressPercent = percent;
    if (progressSink !== null) progressSink(progressContext, percent);
}

export function doneStage(r: Rmg): void {
    // ---- 0x59947E: the 100 % tick -----------------------------------------
    reportProgress(r, 100);

    // ---- 0x5994BA: the teardown, local path only ---------------------------
    r.progressPercent = 0; // sub_643C50(0, 0.0)
    progressSink = null; // sub_643E70 (detach)
    progressContext = null;
}

// ---------------------------------------------------------------------------
// ComputeRadarImage (MapGenRadar.cpp:148-284)
//
// FinalAlert 2's minimap, not the engine's RadarClass: InitMinimap sizing
// (2 pixels per cell, white background), GetMiniMapPos placement (integer
// truncation term for term) and Mini_UpdatePos colouring (the TMP frame's
// rgbLeft / rgbRight bytes, overlay overrides, red starting-point marks).
// The port-only horizontal mirror fix (px -> mirrorBase - px) is kept.
// The image is stored in a module-local WeakMap; no PNG is written.
// ---------------------------------------------------------------------------

export class RadarImage {
    width = 0;
    height = 0;
    pixels: Uint32Array = new Uint32Array(0);

    empty(): boolean {
        return this.width <= 0 || this.height <= 0;
    }
}

const radarImages = new WeakMap<Rmg, RadarImage>();

/** GetRadarImage (MapGen.h:1624) - the last computed image, or an empty one. */
export function getRadarImage(r: Rmg): RadarImage {
    return radarImages.get(r) ?? new RadarImage();
}

/** 0xAARRGGBB, the layout RadarImage::pixels uses (MapGenRadar.cpp:79-83). */
function rgb(r: number, g: number, b: number): number {
    return (0xff000000 | (r << 16) | (g << 8) | b) >>> 0;
}

/** FA2's ovrlinline.h:26 helper, verbatim (MapGenRadar.cpp:86-89). */
function isGreenTiberium(type: number): boolean {
    return (type > 0x65 && type <= 0x79) || (type > 0x82 && type < 0xa7);
}

/** TileCellAttrAt (MapGenRecalc.cpp:254) - nullptr means "no image". */
function tileCellAttrAt(r: Rmg, tile: number, cell: number): TileCellAttr | null {
    if (tile < 0 || tile >= r.tileCellAttrs.length) return null;
    const cells = r.tileCellAttrs[tile]!;
    if (cell < 0 || cell >= cells.length) return null;
    return cells[cell] ?? null;
}

export function computeRadarImage(r: Rmg): void {
    radarImages.set(r, new RadarImage()); // radarImage_ = RadarImage()

    if (r.cellSlots.length === 0 || r.size.mapWidth <= 0 || r.size.mapHeight <= 0) return;

    // FA2 reads GetWidth()/GetHeight() out of the .map's [Map] Size.
    const width = r.size.mapWidth;
    const height = r.size.mapHeight;
    const isoSize = width + height;

    const image = new RadarImage();
    image.width = width * 2; // two pixels per cell
    image.height = height;
    image.pixels = new Uint32Array(image.width * image.height).fill(0xffffffff); // white

    // ---- the starting-point marks -----------------------------------------
    // Red over every cell within a Chebyshev distance of 1 from a waypoint
    // below 8 (MapData.h:939 - the 3 x 3 scan around the cell).
    const startMark = new Uint8Array(isoSize * isoSize);
    for (let i = 0; i < r.startingPoints.length; ++i) {
        const sp = r.startingPoints[i]!;
        if (sp.index < 0 || sp.index >= 8) continue;

        const cX = (sp.coords << 16) >> 16;
        const cY = (((sp.coords >>> 16) & 0xffff) << 16) >> 16;
        for (let dy = -1; dy <= 1; ++dy) {
            for (let dx = -1; dx <= 1; ++dx) {
                const mx = cX + dx;
                const my = cY + dy;
                if (mx < 0 || my < 0 || mx >= isoSize || my >= isoSize) continue;
                startMark[my * isoSize + mx] = 1;
            }
        }
    }

    // ---- the field walk ----------------------------------------------------
    // i = map X, e = map Y, both over [0, isoSize) - FA2's Mini_UpdatePos loop.
    const tx = isoSize - width + height;
    const ty = idiv(height, 2) + idiv(width, 2);

    // [port-only] 水平镜像修正：以"格"为单位镜像，每格仍是左 rgbLeft、右
    // rgbRight，只是格的落点从 px 搬到 2*(W-1)-px（MapGenRadar.cpp:203）。
    const mirrorBase = 2 * (width - 1);

    for (let e = 0; e < isoSize; ++e) {
        for (let i = 0; i < isoSize; ++i) {
            // GetMiniMapPos, term for term, so the integer truncation matches.
            let px = isoSize - i + e;
            let py = idiv(e, 2) + idiv(i, 2);
            px -= tx;
            py -= ty;
            px += height;
            py += idiv(height, 2);
            px = mirrorBase - px; // [port-only] 左右反转回来

            if (px < 0 || py < 0 || px >= image.width || py >= image.height) continue;

            // The cell (CellAt never returns null; outside the diamond it is
            // the invalid sentinel, whose tile 0 paints the diamond corners).
            const cell = r.cellAt(i, e);

            let ground = cell.isoTileTypeIndex;
            if (ground < 0 || ground >= r.tileCellAttrs.length) ground = 0;

            const attr = tileCellAttrAt(r, ground, cell.height);
            if (attr === null) continue; // "subt >= wTileCount" -> skip

            let left = rgb(attr.radarRedLeft, attr.radarGreenLeft, attr.radarBlueLeft);
            let right = rgb(attr.radarRedRight, attr.radarGreenRight, attr.radarBlueRight);

            // The overlay overrides, in FA2's order. -1 is the port's "no
            // overlay", which FA2 spells 0xFF.
            const overlay =
                cell.overlayTypeIndex < 0 || cell.overlayTypeIndex > 0xff
                    ? 0xff
                    : cell.overlayTypeIndex;
            if (isGreenTiberium(overlay)) {
                left = right = rgb(250, 250, 0);
            } else if (overlay === 0x7e) {
                left = right = rgb(190, 180, 120); // OVRL_VEINS
            } else if (overlay === 0xa7 || overlay === 0xb2) {
                left = right = rgb(165, 160, 120); // VEINHOLE / BORDER
            } else if (overlay !== 0xff) {
                left = right = rgb(20, 20, 20);
            }

            if (startMark[e * isoSize + i] !== 0) left = right = rgb(255, 0, 0);

            const row = py * image.width;
            image.pixels[row + px] = left;
            // FA2 writes the second pixel right after the first and lets it
            // fall off the buffer only at the very end; here it is clipped to
            // the row.
            if (px + 1 < image.width) image.pixels[row + px + 1] = right;
        }
    }

    radarImages.set(r, image);

    // The C++ tail writes radar_preview.png through GDI+ (SaveRadarPng);
    // the TS port keeps only the pixel data (available via getRadarImage).
}
