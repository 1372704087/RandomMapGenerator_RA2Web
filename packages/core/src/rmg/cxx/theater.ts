/**
 * Theater table — the RMG's theater option index -> engine theater name, its
 * control INI, its TMP extension and the extracted tile-art folder the port
 * reads tile footprints from.
 *
 * Ported from VERA20k `src/map/theater.rs` (`THEATER_DEFS`) plus
 * `src/map/rmg/emit.rs` `theater_name()`. The index order is the engine's own
 * (0 Temperate / 1 Snow / 2 Urban / 3 Desert / 4 NewUrban), and it is what
 * `[Map] Theater=` gets written from.
 *
 * Lunar is deliberately absent, exactly as in VERA20k: the theater *data* layer
 * has a Lunar set (with the engine's ReadTheater545150 546C95 lunar zeroing of
 * cliffs / water / bridges), but the RMG option table stops at NewUrban and any
 * index outside it resolves to temperate.
 *
 * Leaf module: no imports, so mapGen/recalc/mapFile can share it without
 * closing an import cycle.
 */

export interface TheaterEntry {
    /** `[Map] Theater=` name. */
    name: string;
    /** Theater control INI, e.g. desertmd.ini. */
    iniName: string;
    /** Tile image extension the INI's tilesets point at. */
    extension: string;
    /** Folder under Tile资源/ that holds the unpacked TMPs. */
    artFolder: string;
    /**
     * Folder under the port's own TMP cache (resources/theater-tiles) used when
     * the game install has no unpacked Tile资源/<artFolder> for this theater.
     * Only temperate and snow ship one in the stock MapGenerator layout; the
     * other three theaters' tiles live in the game's theater mixes and are
     * extracted by scripts/extract-theater-tiles.mjs.
     */
    artCacheFolder: string;
}

export const THEATER_TABLE: readonly TheaterEntry[] = [
    { name: 'TEMPERATE', iniName: 'temperatmd.ini', extension: 'tem', artFolder: '温和', artCacheFolder: 'temperate' },
    { name: 'SNOW', iniName: 'snowmd.ini', extension: 'sno', artFolder: '雪地', artCacheFolder: 'snow' },
    { name: 'URBAN', iniName: 'urbanmd.ini', extension: 'urb', artFolder: '城市', artCacheFolder: 'urban' },
    { name: 'DESERT', iniName: 'desertmd.ini', extension: 'des', artFolder: '沙漠', artCacheFolder: 'desert' },
    { name: 'NEWURBAN', iniName: 'urbannmd.ini', extension: 'ubn', artFolder: '新城市', artCacheFolder: 'newurban' },
];

/** Highest option index the table accepts. */
export const MAX_THEATER_INDEX = THEATER_TABLE.length - 1;

/** Out-of-range indices fall back to temperate, like the original's lookup. */
export function theaterEntry(theater: number): TheaterEntry {
    return THEATER_TABLE[theater] ?? THEATER_TABLE[0]!;
}

/** `[Map] Theater=` for a theater index. */
export function theaterName(theater: number): string {
    return theaterEntry(theater).name;
}
