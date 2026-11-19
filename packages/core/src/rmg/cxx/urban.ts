/**
 * 城区 —— Ares「Create Urban Areas」的等价阶段（按 gamemd 0x5A5020 的算法重做）。
 *
 * 挂钩点与 Ares 一致：`RMG::UrbanAreas` 打开时，在 `0x598FB8` 那次
 * `recalculateCellAttributes` 之后 `CALL(0x5A5020)`（本仓库 cxx 管线同位置）。
 *
 * 引擎侧的城区由三个函数组成，本文件按它们的语义重写：
 *   `0x5A5360`  随机游走出一条街区脊线（8 邻域 best-first，键 = max(|dx|,|dy|) + rand*3），
 *               收集够长的路径后取包围盒，路径太「瘦」（count*1.6 <= w*h）就整条作废；
 *   `0x5A5B50`  在包围盒里按 10 格间距铺横/竖街道，两端各盖端头；
 *   `0x5A6510`  沿街放建筑。
 *
 * 街道的图块语义是这一版的关键（全部由手工城市块实测反推）：
 *   * 一条街 = 一串同向的 `Proad01/02`（温带 293/294）。它们不是 1 格图块：
 *     `Proad01` 的 TMP 画幅是 1852×952 像素（约 30 格长的一条完整街道，
 *     沥青 + 白边线 + 中线虚线 + 人行道），盖一次就画一整条街；
 *   * 因此必须走 `sub_5A6C10`（本仓库 `placeWaterDetailTile`）多格盖章，
 *     它会写 `cell.height = 子格序号`。上一版只写 `isoTileTypeIndex`、
 *     子格序号留着地形值，画出来就只有一条细边 —— 这是「效果太烂」的真因；
 *   * 端头 `p_end`（温带 445/446/447/448）：+0 横街远端、+1 竖街北端、
 *     +2 横街近端、+3 竖街南端（与 `MapGenMapFile` 桥面路段的端头编号一致）。
 *
 * 名单不读 rmgmd.ini（仓库里没有这个文件），直接硬编码 Ares 的默认值。
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { Rmg } from './mapGen';
import { i16, packXY, unpX, unpYS } from './types';
import { profileString } from './winapi';
import { diag } from './diag';
import { placeWaterDetailTile } from './river';
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

/** 竖街之间的间距：`0x5A5B50` 的横段步进是 10 行，竖段同理 */
const ROAD_SPACING = 10;

/** 街区内部：横街第一行距包围盒顶 2 格，竖街第一列距左边 5 格（同 0x5A5B50） */
const FIRST_ROW_OFFSET = 2;
const FIRST_COL_OFFSET = 5;

export interface UrbanAreaStats {
    areas: number;
    /** 盖出的街道格数（多格盖章下等于被写过的格子） */
    roadCells: number;
    /** 街道段数（横 + 竖） */
    streets: number;
    structures: number;
    attempts: number;
    rejections: Record<string, number>;
    locations: { x: number; y: number; w: number; h: number; streets: number }[];
}

export interface UrbanAreaOptions {
    /** 城区数量；`true` 由调用方按面积折算 */
    areas: number;
    /** 单个城区的包围盒尺寸区间（格） */
    sizeRange?: [number, number];
    /** 每个城区的建筑数量上限 */
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
        if (width > 3 || height > 3) continue; // 街区里放不下这么大的底座
        out.push({ name, width, height });
    }
    return out;
}

/**
 * 给街道 / 端头 / 铺装族补上 TMP 的真实画幅。
 *
 * `placeWaterDetailTile`（= `sub_5A6C10`）按「图块画幅」逐子格盖章，
 * 而本仓库的 `findFamilyFootprint` 只给悬崖 / 岸边等族备了静态表，
 * 街道族要靠 `tileFootprintOverrides`。画幅直接读已加载的 TMP 属性，
 * 不写死数字：`Proad01` 实测 1x3、`Proad02` 3x1、`p_end*` 1x3 / 3x1。
 */
function ensureRichFootprints(r: Rmg): void {
    const add = (base: number, span: number): void => {
        if (base < 0) return;
        for (let i = 0; i < span; i++) {
            const tile = base + i;
            if (r.tileFootprintOverrides.has(tile)) continue;
            const frames = r.tileCellAttrs[tile];
            if (frames === undefined || frames.length === 0) continue;
            const first = frames.find((a) => a !== undefined && a.hasFrame) ?? frames[0];
            if (first === undefined) continue;
            const w = first.cellsInX;
            const h = first.cellsInY;
            if (w > 0 && h > 0) r.tileFootprintOverrides.set(tile, { w, h });
        }
    };
    add(r.pavedRoadsIndex, 15);      // Proad01..15
    add(r.pavedRoadEndsIndex, 4);    // p_end01..04
    add(r.mediansIndex, 13);         // proadc / dlat
    add(r.paveTileIndex, 16);        // Pvclr
    add(r.miscPaveTileIndex, 13);    // Pave
}

/** 该格能不能被街道压过去（同高、平、无建筑、可通行、无 overlay） */
function cellOkForRoad(r: Rmg, x: number, y: number, level: number): string | null {
    if (!r.cellExists(x, y)) return 'offmap';
    const c = r.cellAt(x, y);
    if (c.level !== level) return 'z';
    if (c.slopeIndex !== 0) return 'slope';
    if ((c.altFlags & ALT_CONTAINS_BUILDING) !== 0) return 'occupied';
    if (c.overlayTypeIndex >= 0) return 'overlay';
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
        areas: 0, roadCells: 0, streets: 0, structures: 0, attempts: 0, rejections: {}, locations: [],
    };
    const theater = r.config.theater;
    const theaterName = ['TEMPERATE', 'SNOW', 'URBAN', 'DESERT', 'NEWURBAN', 'LUNAR'][theater] ?? 'TEMPERATE';
    if (r.pavedRoadsIndex < 0 || r.pavedRoadEndsIndex < 0) {
        diag(`URBAN: theater ${theaterName} 没有 Paved Roads / PavedRoadEnds 族，跳过`);
        return stats;
    }
    ensureRichFootprints(r);

    const catalog = loadCatalogs(r);
    const rows = r.size.mapHeight;
    const cols = r.size.mapWidth;

    const reject = (why: string): void => {
        stats.rejections[why] = (stats.rejections[why] ?? 0) + 1;
    };

    const [sizeMin, sizeMax] = options.sizeRange ?? [22, 32];
    const [stMin, stMax] = options.structuresPerArea ?? [4, 10];
    const safeRadius = options.startingPointRadius ?? 10;

    const randRange = (lo: number, hi: number): number => r.rng.randomRanged(lo, hi);

    const nearStart = (x: number, y: number): boolean =>
        r.startingPoints.some((sp) => {
            const sx = unpX(sp.coords);
            const sy = unpYS(sp.coords);
            return Math.max(Math.abs(sx - x), Math.abs(sy - y)) <= safeRadius;
        });

    const stamp = (tile: number, x: number, y: number): void => {
        placeWaterDetailTile(r, tile, packXY(i16(x), i16(y)), -1, -1);
        stats.roadCells++;
    };

    /**
     * 取一个包围盒左上角。
     *
     * 这张图是按菱形存的：合法格满足 `mapWidth < x+y <= mapWidth+2*mapHeight`
     * 且 `|x-y| < mapWidth`，所以直接在 (s, d) 上取样再反解 x/y，
     * 比在大网格里碰运气稳（引擎那种随机 slot 取法命中率太低）。
     */
    const randomCorner = (span: number): [number, number] | null => {
        const mw = r.size.mapWidth;
        const mh = r.size.mapHeight;
        const sLo = mw + span + 3;
        const sHi = mw + 2 * mh - span - 3;
        if (sHi <= sLo) return null;
        const dMaxAllowed = Math.min(mw - 2, mw - span - 4);
        if (dMaxAllowed <= 0) return null;
        for (let i = 0; i < 8; i++) {
            const s = randRange(sLo, sHi);
            let d = randRange(0, dMaxAllowed - 1);
            if (((s + d) & 1) !== 0) d += 1;
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
    const placedBoxes: { x: number; y: number; w: number; h: number }[] = [];
    while (stats.areas < options.areas && stats.attempts < maxAttempts) {
        stats.attempts++;
        const bw = randRange(sizeMin, sizeMax);
        const bh = randRange(sizeMin, sizeMax);
        const corner = randomCorner(Math.max(bw, bh));
        if (corner === null) {
            reject('anchor');
            continue;
        }
        const [bx, by] = corner;
        const level = r.cellAt(bx, by).level;

        // 城区之间留 3 格空隙：两套栅格叠在一起会出现 1 格宽的碎路
        if (placedBoxes.some((b) => !(bx + bw + 3 < b.x || bx > b.x + b.w + 3
            || by + bh + 3 < b.y || by > b.y + b.h + 3))) {
            reject('overlap');
            continue;
        }

        // ---- 校验锚点：逐段校验交给下面的「最长可通行段」剪裁 --------------
        const anchorWhy = cellOkForRoad(r, bx, by, level);
        if (anchorWhy !== null) {
            reject(anchorWhy);
            continue;
        }
        if (nearStart(bx, by)) {
            reject('startingpoint');
            continue;
        }

        // ---- 街道栅格：横街 / 竖街各按 10 格间距铺满包围盒 ----------------
        //
        // gamemd 的 0x5A5B50 对每段都先做 TileRectClear，不清就不铺；
        // 这里等价地取「区间内最长的可通行连续段」，段长 < 6 就整段不要。
        const laneEW = r.pavedRoadsIndex;      // Proad01：东西向
        const laneNS = r.pavedRoadsIndex + 1;  // Proad02：南北向
        const ends = r.pavedRoadEndsIndex;
        let streets = 0;
        const roadRows: number[] = [];
        const roadCols: number[] = [];

        const ok = (x: number, y: number): boolean => cellOkForRoad(r, x, y, level) === null;

        const longestRun = (from: number, to: number, fixed: number, horizontal: boolean): [number, number] | null => {
            let bestStart = -1;
            let bestLen = 0;
            let curStart = -1;
            let curLen = 0;
            for (let i = from; i <= to; i++) {
                const good = horizontal ? ok(i, fixed) : ok(fixed, i);
                if (good) {
                    if (curStart < 0) curStart = i;
                    curLen++;
                    if (curLen > bestLen) {
                        bestLen = curLen;
                        bestStart = curStart;
                    }
                } else {
                    curStart = -1;
                    curLen = 0;
                }
            }
            return bestLen >= 6 ? [bestStart, bestStart + bestLen - 1] : null;
        };

        for (let y = by + FIRST_ROW_OFFSET; y <= by + bh - 3; y += ROAD_SPACING) {
            const run = longestRun(bx, bx + bw - 1, y, true);
            if (run === null) continue;
            const [x0, x1] = run;
            for (let x = x0; x <= x1; x++) stamp(laneEW, x, y);
            // 两条车行道之间的中央带：theater 有 Medians 族就填铺装，否则留原地形
            if (r.mediansIndex >= 0) {
                for (let x = x0; x <= x1; x++) stamp(r.mediansIndex, x, y + 1);
            }
            if (ok(x0 - 1, y)) stamp(ends + 2, x0 - 1, y);   // 西端（近端）
            if (ok(x1 + 1, y)) stamp(ends + 0, x1 + 1, y);   // 东端（远端）
            roadRows.push(y);
            streets++;
        }
        for (let x = bx + FIRST_COL_OFFSET; x <= bx + bw - 5; x += ROAD_SPACING) {
            const run = longestRun(by, by + bh - 1, x, false);
            if (run === null) continue;
            const [y0, y1] = run;
            for (let y = y0; y <= y1; y++) stamp(laneNS, x, y);
            if (r.mediansIndex >= 0) {
                for (let y = y0; y <= y1; y++) stamp(r.mediansIndex, x + 1, y);
            }
            if (ok(x, y0 - 1)) stamp(ends + 1, x, y0 - 1);   // 北端
            if (ok(x, y1 + 1)) stamp(ends + 3, x, y1 + 1);   // 南端
            roadCols.push(x);
            streets++;
        }

        stats.streets += streets;
        if (streets === 0) {
            reject('norooms');
            stats.areas++;
            stats.locations.push({ x: bx, y: by, w: bw, h: bh, streets: 0 });
            continue;
        }
        placedBoxes.push({ x: bx, y: by, w: bw, h: bh });

        // ---- 建筑：只落在街道之间的街区内（离任一条街 >= 4 格）-----------
        const count = catalog.length === 0 ? 0 : randRange(stMin, stMax);
        for (let n = 0; n < count; n++) {
            const type = catalog[randRange(0, catalog.length - 1)]!;
            for (let tries = 0; tries < 12; tries++) {
                const px = randRange(bx + 2, bx + bw - type.width - 2);
                const py = randRange(by + 2, by + bh - type.height - 2);
                // 离街道太近会压到路面 / 端头
                if (roadRows.some((ry) => Math.abs(py - ry) < 4 && py !== ry)) continue;
                if (roadCols.some((cx) => Math.abs(px - cx) < 4)) continue;
                const base = packXY(i16(px), i16(py));
                if (!foundationFitsAtFlat(r, base, level, type.width, type.height, 1)) continue;
                recordPlacedBuilding(r, base, type.name, type.width, type.height);
                stats.structures++;
                break;
            }
        }

        stats.areas++;
        stats.locations.push({ x: bx, y: by, w: bw, h: bh, streets });
    }

    diag(
        `URBAN: ${theaterName} ${stats.areas} 区 / ${stats.streets} 条街 / 街格 ${stats.roadCells}`
        + ` / 建筑 ${stats.structures} (尝试 ${stats.attempts} 次)`
        + (stats.areas === 0 ? ` 失败原因 ${JSON.stringify(stats.rejections)}` : '')
        + (stats.locations.length !== 0
            ? ' 位置 ' + stats.locations.map((l) => `${l.w}x${l.h}@${l.x},${l.y}/${l.streets}街`).join(' ')
            : ''),
    );

    return stats;
}
