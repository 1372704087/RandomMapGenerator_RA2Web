/**
 * Minimal Win32 GetPrivateProfile* replicas over an INI file on disk.
 * Semantics needed by the port (see MapGen.cpp ReInitMapData and the
 * Load* family in MapGenRecalc.cpp / MapGenTech.cpp / MapGenRiver.cpp):
 *   - GetPrivateProfileIntA: prefix-parse an integer; missing key / empty /
 *     non-numeric start returns the default.
 *   - GetPrivateProfileStringA: raw string value or the default.
 *   - key listing (null key name): all keys of a section, NUL-separated.
 *   - section listing: all section names.
 * Matching the Win32 quirks that matter: keys/values are trimmed of leading
 * and trailing whitespace by GetPrivateProfileString; the value may carry a
 * trailing comment (; or # is NOT stripped by Windows - only a null char
 * ends it) - Windows does NOT strip inline comments, so we don't either.
 */

import { readFileSync } from 'node:fs';

interface IniFile {
    sections: Map<string, Map<string, string>>;
    keyOrder: Map<string, string[]>;
}

const cache = new Map<string, IniFile>();

export function loadIni(path: string): IniFile | null {
    const cached = cache.get(strip(path));
    if (cached) return cached;
    let text: string;
    try {
        text = readFileSync(path, 'latin1');
    } catch {
        return null;
    }
    const sections = new Map<string, Map<string, string>>();
    const keyOrder = new Map<string, string[]>();
    let curName = '';
    let cur: Map<string, string> | null = null;
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line.length === 0) continue;
        if (line.startsWith('[')) {
            const end = line.indexOf(']');
            if (end < 0) continue;
            curName = line.slice(1, end).trim();
            const lower = curName.toLowerCase();
            if (!sections.has(lower)) {
                sections.set(lower, new Map());
                keyOrder.set(lower, []);
            }
            cur = sections.get(lower)!;
            continue;
        }
        if (line.startsWith(';')) continue;
        const eq = line.indexOf('=');
        if (eq < 0) continue;
        const key = line.slice(0, eq).trim();
        const value = line.slice(eq + 1).trim();
        if (!cur) continue;
        const lower = curName.toLowerCase();
        if (!cur.has(key.toLowerCase())) keyOrder.get(lower)!.push(key);
        cur.set(key.toLowerCase(), value);
    }
    const parsed: IniFile = { sections, keyOrder };
    cache.set(strip(path), parsed);
    return parsed;
}

const strip = (path: string): string => path.replace(/\\/g, '/').toLowerCase();

function find(path: string): IniFile | null {
    const key = strip(path);
    const cached = cache.get(key);
    if (cached) return cached;
    // lazy load on first access (GetPrivateProfile* read on demand)
    return loadIni(path);
}

/** GetPrivateProfileIntA replica. */
export function profileInt(path: string, section: string, key: string, def: number): number {
    const ini = find(path);
    if (!ini) return def;
    const v = ini.sections.get(section.toLowerCase())?.get(key.toLowerCase());
    if (v === undefined) return def;
    return atoiPrefix(v, def);
}

/** atoi prefix parse ("12abc" -> 12, "" -> 0, "-3x" -> -3). */
export function atoiPrefix(s: string, def = 0): number {
    const t = s.trim();
    const m = /^([+-]?[0-9]+)/.exec(t);
    if (!m) return def === undefined ? 0 : def;
    const v = parseInt(m[1], 10);
    return Number.isNaN(v) ? def : v | 0;
}

/** GetPrivateProfileStringA replica (single value). */
export function profileString(path: string, section: string, key: string, def: string): string {
    const ini = find(path);
    if (!ini) return def;
    const v = ini.sections.get(section.toLowerCase())?.get(key.toLowerCase());
    return v === undefined ? def : v;
}

/** GetPrivateProfileStringA with null lpKeyName: the section's keys in order. */
export function profileKeys(path: string, section: string): string[] {
    const ini = find(path);
    if (!ini) return [];
    return ini.keyOrder.get(section.toLowerCase()) ?? [];
}

/** GetPrivateProfileSectionNamesA replica, file order. */
export function profileSectionNames(path: string): string[] {
    const ini = find(path);
    if (!ini) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const name of ini.keyOrder.keys()) {
        // keyOrder is keyed by lower-case section; recover original casing is
        // unnecessary - the C++ consumers do case-insensitive TileSet matches.
        if (!seen.has(name)) {
            seen.add(name);
            out.push(name);
        }
    }
    return out;
}

/** ReadIntList (MapGen.cpp): comma-separated ints, empty token terminates. */
export function readIntList(path: string, key: string, out: number[]): number[] {
    out.length = 0;
    // GetPrivateProfileStringA reads into a 512-byte buffer (511 chars).
    const raw = profileString(path, 'General', key, '').slice(0, 511);
    if (raw.length === 0) return out;
    for (const tok of raw.split(',')) {
        if (tok.length === 0) break;
        out.push(atoiPrefix(tok));
    }
    return out;
}

/** ReadNameList (MapGen.cpp): comma-separated names, empty token terminates. */
export function readNameList(path: string, key: string, out: string[]): string[] {
    out.length = 0;
    // 128-byte buffer (127 chars) - ReadNameList in MapGen.cpp.
    const raw = profileString(path, 'General', key, '').slice(0, 127);
    if (raw.length === 0) return out;
    for (const tok of raw.split(',')) {
        if (tok.length === 0) break;
        out.push(tok);
    }
    return out;
}

export const iniCacheClear = (): void => cache.clear();
