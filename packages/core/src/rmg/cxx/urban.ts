/**
 * 城区 —— Ares「Create Urban Areas」的等价阶段。
 *
 * 原版 gamemd 的 RMG 有一个「城市区域」阶段（`MapSeedClass::PlacePavedRoads` +
 * `PlaceUrbanStructures`），Ares 只是加了一个复选框 `RMG::UrbanAreas`：
 * 在 `0x598FB8`（本仓库 cxx 管线的第一次 `recalculateCellAttributes`）处
 * `if (RMG::UrbanAreas) CALL(0x5A5020)`，顺手把名单换成 `rmgmd.ini [Urban]`
 * 的三段（默认值见下）。Ares 自己不画街道。
 *
 * 因此本阶段挂在 cxx 管线同一个位置（`0x598FB8` 与 `0x59912A` 两次 recalc 之间），
 * 做的事和引擎那套一致：
 *   1. 在已生成的地图上随机挑一块平整、可通行、无建筑的地面；
 *   2. 铺一条 **3 格宽** 的街道 —— 两条铺装路车道 + 中间一条带子
 *      （实图里没有 1 格宽的孤立街道：手工城市块的街一律是「车道 / 中间带 / 车道」）；
 *   3. 街道两侧按 Ares 默认名单放城区建筑（`foundationFitsAtFlat` 校验落位）。
 *
 * 图块号：
 *   * 车道取 theater 自己 INI 的 `Paved Roads` 族基址 —— 该族序号 0 是东西向直段、
 *     序号 1 是南北向直段（温带 293/294、沙漠 265/266，与手工城市块实测一致）；
 *   * 中间带用实图实测的图块（新城市 856 水泥带、沙漠 392），温带 / 雪地 / 城市
 *     在实图里是「两条车道夹一格原地形」，所以这两族不铺中隔、保留原地形。
 *
 * 名单不读 rmgmd.ini（仓库里没有这个文件），直接硬编码 Ares 的默认值。
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { Rmg } from './mapGen';
import { i16, packXY, unpX, unpYS } from './types';
import { profileString } from './winapi';
import { diag } from './diag';
import { foundationFitsAtFlat, recordPlacedBuilding } from './startpoint';

/** Ares 默认 `[Urban] Structures` */
export const ARES_URBAN_STRUCTURES: readonly string[] = [
    'CABUNK01', 'CABUNK02', 'CAARMY01', 'CAARMY02', 'CAARMY03', 'CAARMY04',
    'CACHIG03', 'CANEWY01', 'CANEWY14', 'CANWY09', 'CANWY26', 'CANWY25',
    'CATEXS07',
];

/** Ares 默认 `[Urban] Vehicles` —— cxx 的 .map 写出目前没有 [Units] 段，先只保留常量 */
export const ARES_URBAN_VEHICLES: readonly string[] = [
    'TRUCKA', 'TRUCKB', 'COP', 'EUROC', 'SUVW', 'SUVB', 'FTRK', 'AMBU',
];

/** Ares 默认 `[Urban] Infantry` —— 同上，[Infantry] 段也还没写出 */
export const ARES_URBAN_INFANTRY: readonly string[] = [
    'CIV1', 'CIV2', 'CIV3', 'CIVA', 'CIVB', 'CIVC',
];

/** PassabilityType（与 mapGen.ts 的 Passability 同值，这里用字面量避免循环依赖） */
const PT_PASSABLE = 0;
const PT_BEACH = 3;

/** AltCellFlags_ContainsBuilding */
const ALT_CONTAINS_BUILDING = 0x2;

/**
 * 街道中间带的实测图块（手工城市块里「车道 / 中间格 / 车道」三元组的统计结果）。
 * null = 该 theater 的街在实图里就是「两条车道夹一格原地形」，不铺中隔。
 */
const MEDIAN_TILES: Record<string, number | null> = {
    TEMPERATE: null,
    SNOW: null,
    URBAN: null, // 城市（旧城区）与温带同族编号，实图没有铺装中隔
    NEWURBAN: 856,
    DESERT: 392,
    LUNAR: null, // 月球没有城区素材
};

export interface UrbanAreaStats {
    areas: number;
    /** 铺出的车道 / 中隔格数 */
    roadCells: number;
    structures: number;
    attempts: number;
    rejections: Record<string, number>;
    locations: { x: number; y: number; dir: 'ew' | 'ns'; len: number }[];
}

export interface UrbanAreaOptions {
    /** 城区数量；`true` 由调用方按面积折算 */
    areas: number;
    /** 街道长度区间（格） */
    lengthRange?: [number, number];
    /** 每个城区的建筑数量区间 */
    structuresPerArea?: [number, number];
    /** 离出生点（starting point）的最小 Chebyshev 距离 */
    startingPointRadius?: number;
}

interface CatalogEntry {
    name: string;
    width: number;
    height: number;
}

/** 在 exe 目录 / 相关INI 附近找一份 INI（与 rulesIniPath 的候选目录一致） */
function findIni(r: Rmg, fileName: string): string | null {
    const d = r.resourceDir.replace(/\/?$/, '/');
    const candidates = [
        join(d, fileName),
        join(d, '..', fileName),
        join(d, '..', '..', fileName),
        join(d, '相关INI', fileName),
    ];
    for (const p of candidates) if (existsSync(p)) return p;
    return null;
}

/** 从 rulesmd.ini / artmd.ini 读出 Ares 名单里那些建筑的底座尺寸 */
function loadCatalogs(r: Rmg): CatalogEntry[] {
    const rulesPath = r.rulesIniPath();
    if (rulesPath === null) return [];
    const artPath = findIni(r, 'artmd.ini');
    const out: CatalogEntry[] = [];
    for (const name of ARES_URBAN_STRUCTURES) {
        const present = profileString(rulesPath, name, 'Name', '');
        const strength = profileString(rulesPath, name, 'Strength', '');
        if (present.length === 0 && strength.length === 0) continue;

        let width = 1;
        let height = 1;
        const candidates: string[] = [];
        const image = artPath === null ? '' : profileString(artPath, name, 'Image', '');
        if (image.length !== 0) candidates.push(image);
        candidates.push(name);
        for (const sec of candidates) {
            const artVal = artPath === null ? '' : profileString(artPath, sec, 'Foundation', '');
            const rulesVal = profileString(rulesPath, sec, 'Foundation', '');
            const value = artVal.length !== 0 ? artVal : rulesVal;
            if (value.length === 0) continue;
            const m = /^\s*([+-]?\d+)x\s*([+-]?\d+)/.exec(value);
            if (m === null) continue;
            const w = parseInt(m[1]!, 10) | 0;
            const h = parseInt(m[2]!, 10) | 0;
            if (w > 0 && h > 0) {
                width = w;
                height = h;
                break;
            }
        }
        if (width > 3 || height > 3) continue; // 街道两侧留不出这么大的空地
        out.push({ name, width, height });
    }
    return out;
}

/** 该格在城市街道里能不能压过去（同高、可通行、无建筑） */
function corridorCellOk(r: Rmg, x: number, y: number, level: number): string | null {
    if (!r.cellExists(x, y)) return 'offmap';
    const c = r.cellAt(x, y);
    if (c.level !== level) return 'z';
    if (c.slopeIndex !== 0) return 'slope';
    if ((c.altFlags & ALT_CONTAINS_BUILDING) !== 0) return 'occupied';
    if (c.passability !== PT_PASSABLE && c.passability !== PT_BEACH) return 'unpassable';
    if (c.isoTileTypeIndex === 0xffff) return 'notile';
    return null;
}

/**
 * 铺一批城区。RNG 只用 `r.rng`（和 cxx 管线其它阶段同一路），
 * 所以同种子可复现。
 */
export function addUrbanAreas(r: Rmg, options: UrbanAreaOptions): UrbanAreaStats {
    const stats: UrbanAreaStats = {
        areas: 0, roadCells: 0, structures: 0, attempts: 0, rejections: {}, locations: [],
    };
    const theater = r.config.theater;
    const theaterName = ['TEMPERATE', 'SNOW', 'URBAN', 'DESERT', 'NEWURBAN', 'LUNAR'][theater] ?? 'TEMPERATE';
    if (r.pavedRoadsIndex < 0) {
        diag(`URBAN: theater ${theaterName} 没有 Paved Roads 族，跳过`);
        return stats;
    }
    const medianTile = MEDIAN_TILES[theaterName] ?? null;

    const catalog = loadCatalogs(r);
    const rows = r.size.mapHeight;
    const cols = r.size.mapWidth;

    const reject = (why: string): void => {
        stats.rejections[why] = (stats.rejections[why] ?? 0) + 1;
    };

    const [lenMin, lenMax] = options.lengthRange ?? [6, 10];
    const [stMin, stMax] = options.structuresPerArea ?? [2, 5];
    const safeRadius = options.startingPointRadius ?? 10;

    const randRange = (lo: number, hi: number): number => r.rng.randomRanged(lo, hi);

    const nearStart = (x: number, y: number): boolean =>
        r.startingPoints.some((sp) => {
            const sx = unpX(sp.coords);
            const sy = unpYS(sp.coords);
            return Math.max(Math.abs(sx - x), Math.abs(sy - y)) <= safeRadius;
        });

    const maxX = r.size.mapWidth + r.size.mapHeight;
    const maxY = r.size.mapWidth + r.size.mapHeight;

    /**
     * 取一个能装下整条街的锚点。
     *
     * 这张图是按菱形存的：合法格满足 `mapWidth < x+y <= mapWidth+2*mapHeight`
     * 且 `|x-y| < mapWidth`，所以直接在 (s, d) 上取样再反解 x/y，
     * 比在大网格里碰运气稳（引擎各找点阶段那种随机 slot 取法在这里命中率太低）。
     */
    const randomCell = (len: number): [number, number] | null => {
        const mw = r.size.mapWidth;
        const mh = r.size.mapHeight;
        // 两边各留出 2 格余量：街道本体 + 中间带 + 建筑
        const sLo = mw + len + 3;
        const sHi = mw + 2 * mh - len - 3;
        if (sHi <= sLo) return null;
        const dMaxAllowed = Math.min(mw - 2, mw - len - 4);
        if (dMaxAllowed <= 0) return null;
        for (let i = 0; i < 8; i++) {
            const s = randRange(sLo, sHi);
            let d = randRange(0, dMaxAllowed - 1);
            if (((s + d) & 1) !== 0) d += 1; // x/y 必须是整数
            if (d >= mw) continue;
            const sign = r.rng.unit() < 0.5 ? 1 : -1;
            const x = (s + sign * d) / 2;
            const y = (s - sign * d) / 2;
            if (!r.cellExists(x, y)) continue;
            return [x, y];
        }
        return null;
    };

    const maxAttempts = Math.max(40, options.areas * 60);
    while (stats.areas < options.areas && stats.attempts < maxAttempts) {
        stats.attempts++;
        const dir: 'ew' | 'ns' = r.rng.unit() < 0.5 ? 'ew' : 'ns';
        const len = randRange(lenMin, lenMax);
        const anchor = randomCell(len);
        if (anchor === null) {
            reject('anchor');
            continue;
        }
        const [ax, ay] = anchor;
        const x0 = ax;
        const y0 = ay;
        if (x0 - 1 < 0 || y0 - 1 < 0 || x0 + len + 1 >= maxX || y0 + len + 1 >= maxY) {
            reject('bounds');
            continue;
        }
        if (!r.cellExists(x0, y0)) {
            reject('offmap');
            continue;
        }
        const level = r.cellAt(x0, y0).level;

        const cells: { x: number; y: number; kind: 'lane' | 'band' }[] = [];
        if (dir === 'ew') {
            for (let i = 0; i < len; i++) {
                cells.push({ x: x0 + i, y: y0 - 1, kind: 'lane' });
                cells.push({ x: x0 + i, y: y0, kind: 'band' });
                cells.push({ x: x0 + i, y: y0 + 1, kind: 'lane' });
            }
        } else {
            for (let i = 0; i < len; i++) {
                cells.push({ x: x0 - 1, y: y0 + i, kind: 'lane' });
                cells.push({ x: x0, y: y0 + i, kind: 'band' });
                cells.push({ x: x0 + 1, y: y0 + i, kind: 'lane' });
            }
        }

        let problem: string | null = null;
        for (const c of cells) {
            if (nearStart(c.x, c.y)) {
                problem = 'startingpoint';
                break;
            }
            const why = corridorCellOk(r, c.x, c.y, level);
            if (why !== null) {
                problem = why;
                break;
            }
        }
        if (problem !== null) {
            reject(problem);
            continue;
        }

        // ---- 铺街道 ----
        const laneTile = r.pavedRoadsIndex + (dir === 'ew' ? 0 : 1);
        for (const c of cells) {
            if (c.kind === 'band' && medianTile === null) continue;
            const cell = r.cellAt(c.x, c.y);
            cell.isoTileTypeIndex = c.kind === 'band' ? (medianTile as number) : laneTile;
            cell.slopeIndex = 0;
            cell.overlayTypeIndex = -1;
            cell.overlayData = 0;
            stats.roadCells++;
        }

        // ---- 两侧放建筑 ----
        const count = catalog.length === 0 ? 0 : randRange(stMin, stMax);
        for (let n = 0; n < count; n++) {
            const type = catalog[randRange(0, catalog.length - 1)]!;
            const side = r.rng.unit() < 0.5 ? 0 : 1;
            for (let tries = 0; tries < 10; tries++) {
                let bx: number;
                let by: number;
                if (dir === 'ew') {
                    bx = x0 + randRange(-2, len - type.width + 1);
                    by = side === 0 ? y0 - type.height - 1 : y0 + 2;
                } else {
                    bx = side === 0 ? x0 - type.width - 1 : x0 + 2;
                    by = y0 + randRange(-2, len - type.height + 1);
                }
                if (bx < 1 || by < 1 || bx + type.width >= cols || by + type.height >= rows) continue;
                const base = packXY(i16(bx), i16(by));
                if (!foundationFitsAtFlat(r, base, level, type.width, type.height, 1)) continue;
                recordPlacedBuilding(r, base, type.name, type.width, type.height);
                stats.structures++;
                break;
            }
        }

        stats.areas++;
        stats.locations.push({ x: x0, y: y0, dir, len });
    }

    diag(
        `URBAN: ${theaterName} ${stats.areas} 区 / 街道 ${stats.roadCells} 格 / 建筑 ${stats.structures}`
        + ` (尝试 ${stats.attempts} 次)`
        + (stats.areas === 0 ? ` 失败原因 ${JSON.stringify(stats.rejections)}` : '')
        + (stats.locations.length !== 0
            ? ' 位置 ' + stats.locations.map((l) => `${l.dir}@${l.x},${l.y}/${l.len}`).join(' ')
            : ''),
    );

    return stats;
}




