/**
 * 城区 —— Ares「Create Urban Areas」的等价阶段（按 gamemd 0x5A5020 的算法重做）。
 *
 * 挂钩点与 Ares 一致：`RMG::UrbanAreas` 打开时，在 `0x598FB8` 那次
 * `recalculateCellAttributes` 之后 `CALL(0x5A5020)`（本仓库 cxx 管线同位置）。
 *
 * 引擎侧的城区由三个函数组成，本文件按它们的语义重写：
 *   `0x5A5360`  从锚点长出一条路径（8 邻域 best-first，键 = max(|dx|,|dy|) + rand*3，
 *               已访问格标 `work[+15]`），收满目标长度后取包围盒；路径太「瘦」
 *               （`count*1.6 <= w*h`）就整条作废；
 *   `0x5A5B50`  在包围盒里按 10 格间距铺横/竖街道，两端各盖端头；
 *   `0x5A6510`  沿街放建筑。
 * 每个城区最多 10 轮（`cmp ebp,0xA`），每轮重新取锚点长路径、重新取包围盒。
 *
 * 街道图块语义（theater 全局素材，与切片 / 手工单元那套没有关系）：
 *   * 一条街 = 一串同向的 `Proad01/02`（温带 293/294）。它们不是 1 格图块：
 *     `Proad01.tem` 的 TMP 头是 `cellsInX=1 cellsInY=3`，子帧 1852×952 像素
 *     （约 30 格长的一条完整街道：沥青 + 白边线 + 中线虚线 + 人行道），
 *     盖一次就画一整条街；
 *   * 因此必须走 `sub_5A6C10`（本仓库 `placeWaterDetailTile`）多格盖章，
 *     它会写 `cell.height = 子格序号`。只写 `isoTileTypeIndex`、子格序号留着
 *     地形值的写法画出来只有一条细边；
 *   * 端头号取自 theater INI 的 `[General] PavedRoadEnds`（温带 445..448）：
 *     +0 横街远端、+1 竖街北端、+2 横街近端、+3 竖街南端，
 *     与 `MapGenMapFile.cpp` 桥面路段的端头编号一致；中隔取 `[General] Medians`。
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
    /** [Units] 里的载具数 */
    vehicles: number;
    /** [Infantry] 里的步兵数 */
    infantry: number;
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
        areas: 0, roadCells: 0, streets: 0, structures: 0, vehicles: 0, infantry: 0,
        attempts: 0, rejections: {}, locations: [],
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
    const [stMin, stMax] = options.structuresPerArea ?? [6, 14];
    const safeRadius = options.startingPointRadius ?? 10;

    const randRange = (lo: number, hi: number): number => r.rng.randomRanged(lo, hi);

    const nearStart = (x: number, y: number): boolean =>
        r.startingPoints.some((sp) => {
            const sx = unpX(sp.coords);
            const sy = unpYS(sp.coords);
            return Math.max(Math.abs(sx - x), Math.abs(sy - y)) <= safeRadius;
        });

    /** 已铺过街的格子（建筑不能压上去；引擎查的是格子本身清不清，不是「离街几格」） */
    const roadSet = new Set<number>();
    const cellKey = (x: number, y: number): number => x * 8192 + y;

    const stamp = (tile: number, x: number, y: number): void => {
        placeWaterDetailTile(r, tile, packXY(i16(x), i16(y)), -1, -1);
        roadSet.add(cellKey(x, y));
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

    /**
     * `0x5A5360` 的生长：8 邻域 best-first，键 = `max(|dx|,|dy|) + rand*3`
     * （dx/dy 相对起点）。键随距离单调增长，所以长出来的是一团带抖动的菱形，
     * 正是城区需要的块状；访问过的格子只入堆一次（对应 `work[+15] = 1`）。
     */
    const growPath = (sx: number, sy: number, level: number, target: number): { x: number; y: number }[] => {
        const key = (x: number, y: number): number => x * 8192 + y;
        const seen = new Set<number>();
        const heap: { x: number; y: number; k: number }[] = [];

        const push = (x: number, y: number): void => {
            const k = Math.max(Math.abs(x - sx), Math.abs(y - sy)) + r.rng.unit() * 3;
            heap.push({ x, y, k });
            let i = heap.length - 1;
            while (i > 0) {
                const p = (i - 1) >> 1;
                if (heap[p]!.k <= heap[i]!.k) break;
                const t = heap[p]!;
                heap[p] = heap[i]!;
                heap[i] = t;
                i = p;
            }
        };
        const pop = (): { x: number; y: number; k: number } | null => {
            if (heap.length === 0) return null;
            const top = heap[0]!;
            const last = heap.pop()!;
            if (heap.length !== 0) {
                heap[0] = last;
                let i = 0;
                for (;;) {
                    const l = i * 2 + 1;
                    const rr = l + 1;
                    let m = i;
                    if (l < heap.length && heap[l]!.k < heap[m]!.k) m = l;
                    if (rr < heap.length && heap[rr]!.k < heap[m]!.k) m = rr;
                    if (m === i) break;
                    const t = heap[m]!;
                    heap[m] = heap[i]!;
                    heap[i] = t;
                    i = m;
                }
            }
            return top;
        };

        seen.add(key(sx, sy));
        push(sx, sy);
        const path: { x: number; y: number }[] = [];
        while (path.length < target) {
            const node = pop();
            if (node === null) break;
            path.push({ x: node.x, y: node.y });
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = node.x + dx;
                    const ny = node.y + dy;
                    if (seen.has(key(nx, ny))) continue;
                    if (cellOkForRoad(r, nx, ny, level) !== null) continue;
                    seen.add(key(nx, ny));
                    push(nx, ny);
                }
            }
        }
        return path;
    };

    const maxAttempts = Math.max(80, options.areas * 200);
    const placedBoxes: { x: number; y: number; w: number; h: number }[] = [];
    const rowTaken: number[] = [];
    const colTaken: number[] = [];
    const nearTaken = (list: number[], v: number): boolean => list.some((n) => Math.abs(n - v) <= 3);

    /**
     * 一个包围盒里的 `PlacePavedRoads`：横街自顶 +2 行、竖街自左 +5 列，
     * 步进 10；每段取最长可通行连续段（<7 格不要），两端盖端头。
     * 返回铺出的街段数。
     */
    const placeRoadGrid = (bx: number, by: number, bw: number, bh: number, level: number): number => {
        const laneEW = r.pavedRoadsIndex;
        const laneNS = r.pavedRoadsIndex + 1;
        const ends = r.pavedRoadEndsIndex;
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
            return bestLen >= 7 ? [bestStart, bestStart + bestLen - 1] : null;
        };

        let streets = 0;
        for (let y = by + FIRST_ROW_OFFSET; y <= by + bh - 3; y += ROAD_SPACING) {
            if (nearTaken(rowTaken, y)) continue;               // 与已有街相距 <= 3 会出碎路
            const run = longestRun(bx, bx + bw - 1, y, true);
            if (run === null) continue;
            const [x0, x1] = run;
            for (let x = x0; x <= x1; x++) stamp(laneEW, x, y);
            if (r.mediansIndex >= 0) {
                for (let x = x0; x <= x1; x++) stamp(r.mediansIndex, x, y + 1);
            }
            if (ok(x0 - 1, y)) stamp(ends + 2, x0 - 1, y);      // 西端（近端）
            if (ok(x1 + 1, y)) stamp(ends + 0, x1 + 1, y);      // 东端（远端）
            rowTaken.push(y);
            streets++;
        }
        for (let x = bx + FIRST_COL_OFFSET; x <= bx + bw - 5; x += ROAD_SPACING) {
            if (nearTaken(colTaken, x)) continue;
            const run = longestRun(by, by + bh - 1, x, false);
            if (run === null) continue;
            const [y0, y1] = run;
            for (let y = y0; y <= y1; y++) stamp(laneNS, x, y);
            if (r.mediansIndex >= 0) {
                for (let y = y0; y <= y1; y++) stamp(r.mediansIndex, x + 1, y);
            }
            if (ok(x, y0 - 1)) stamp(ends + 1, x, y0 - 1);      // 北端
            if (ok(x, y1 + 1)) stamp(ends + 3, x, y1 + 1);      // 南端
            colTaken.push(x);
            streets++;
        }
        return streets;
    };

    type Box = { x: number; y: number; w: number; h: number };

    /** 在城区任一包围盒内随便取一格（引擎是从城区格子表里随机取一格） */
    const pickCellIn = (boxes: Box[]): [number, number] | null => {
        if (boxes.length === 0) return null;
        const b = boxes[randRange(0, boxes.length - 1)]!;
        if (b.w < 4 || b.h < 4) return null;
        return [randRange(b.x + 1, b.x + b.w - 2), randRange(b.y + 1, b.y + b.h - 2)];
    };

    /**
     * `PlaceUrbanStructures`（`0x5A6510`）：名单随机取一条、用掉就删，
     * 所以一个名字在同一城区最多出现一次；每条最多试 60 格。
     */
    const placeStructures = (boxes: Box[], level: number): void => {
        if (catalog.length === 0 || boxes.length === 0) return;
        const names = catalog.slice();
        for (let i = names.length - 1; i > 0; i--) {
            const j = randRange(0, i);
            const t = names[i]!;
            names[i] = names[j]!;
            names[j] = t;
        }
        const count = Math.min(names.length, randRange(stMin, stMax));
        for (let n = 0; n < count; n++) {
            const type = catalog.length === 0 ? null : names[n]!;
            if (type === null) return;
            for (let tries = 0; tries < 60; tries++) {
                const cell = pickCellIn(boxes);
                if (cell === null) return;
                const [px, py] = cell;
                const maxX = px + type.width;
                const maxY = py + type.height;
                if (maxX > cols || maxY > rows) continue;
                // 建筑不能压到街上（引擎查格子本身，不查「离街几格」）
                let onRoad = false;
                for (let dy = 0; dy < type.height && !onRoad; dy++) {
                    for (let dx = 0; dx < type.width; dx++) {
                        if (roadSet.has(cellKey(px + dx, py + dy))) {
                            onRoad = true;
                            break;
                        }
                    }
                }
                if (onRoad) continue;
                const base = packXY(i16(px), i16(py));
                if (!foundationFitsAtFlat(r, base, level, type.width, type.height, 1)) continue;
                recordPlacedBuilding(r, base, type.name, type.width, type.height);
                stats.structures++;
                break;
            }
        }
    };

    /**
     * `0x5A6920`（加减员）：一个城区只放 1..5 个对象，最多试 2n 轮。
     * 每轮在 0..6 里取一个号 —— 引擎那张表前三条是步兵、后几条是载具；
     * 落点从城区格子里随机取，朝向是 32 的整数倍（8 个方向）。
     */
    const crowdTaken = new Set<number>();
    const placeCrowd = (boxes: Box[], level: number): void => {
        if (boxes.length === 0) return;
        const total = randRange(1, 5);
        let placed = 0;
        let rounds = 0;

        while (placed < total && rounds < 2 * total) {
            rounds++;
            const slot = randRange(0, 6);
            const isInfantry = slot <= 2;
            const list = isInfantry ? ARES_URBAN_INFANTRY : ARES_URBAN_VEHICLES;
            if (list.length === 0) break;
            const type = list[randRange(0, list.length - 1)]!;
            const facing = 32 * randRange(0, 7);

            for (let tries = 0; tries < 60; tries++) {
                const cell = pickCellIn(boxes);
                if (cell === null) break;
                const [px, py] = cell;
                if (crowdTaken.has(cellKey(px, py))) continue;
                if (cellOkForRoad(r, px, py, level) !== null) continue;
                const coords = packXY(i16(px), i16(py));
                if (isInfantry) {
                    r.infantry.push({
                        coords, typeName: type, houseName: '', facing, subCell: randRange(0, 4),
                    });
                    stats.infantry++;
                } else {
                    r.units.push({
                        coords, typeName: type, houseName: '', facing, subCell: 0,
                    });
                    stats.vehicles++;
                }
                crowdTaken.add(cellKey(px, py));
                placed++;
                break;
            }
        }
    };

    /**
     * 一个城区 = 最多 10 轮（`cmp ebp,0xA`）：每轮重新取锚点、长路径、取包围盒、铺路。
     * 10 轮是同一个城区的重复落脚，所以锚点都围着城区中心取，铺出的包围盒允许互相重叠
     * （同一城区的街可以咬合），只有跨城区时才强制留 3 格空隙。
     */
    const ROUNDS_PER_AREA = 10;
    const BOXES_PER_AREA = ROUNDS_PER_AREA;   // 引擎的 10 轮都能落脚，没有「最多几块」的上限

    /** 在中心附近取一个可铺路的点（先按给定半径，找不到就逐级放宽） */
    const randomNear = (cx: number, cy: number, radius: number, level: number): [number, number] | null => {
        for (const factor of [1, 1.6, 2.4]) {
            const rad = Math.max(3, Math.round(radius * factor));
            for (let i = 0; i < 16; i++) {
                const x = cx + randRange(-rad, rad);
                const y = cy + randRange(-rad, rad);
                if (!r.cellExists(x, y)) continue;
                if (r.cellAt(x, y).level !== level) continue;
                if (cellOkForRoad(r, x, y, level) !== null) continue;
                return [x, y];
            }
        }
        return null;
    };

    while (stats.areas < options.areas && stats.attempts < maxAttempts) {
        let boxes = 0;
        let centerX = -1;
        let centerY = -1;
        let centerLevel = 0;
        const areaStart = placedBoxes.length;   // 本城区之前的盒子（跨城区间距只跟它们比）
        const areaBoxes: Box[] = [];            // 本城区已落下的包围盒（建筑 / 加人从这里取格）

        for (let round = 0; round < ROUNDS_PER_AREA && boxes < BOXES_PER_AREA; round++) {
            stats.attempts++;

            // 路径目标长度：引擎是 `(2*w*h)/15`，再夹进 [100,2000]；城区第二轮起短一些
            const baseLen = (2 * cols * rows) / 15;
            const scale = round === 0 ? 1.0 : 0.55;
            const length = Math.round(scale * randRange(
                Math.max(100, baseLen * 0.5), Math.min(2000, baseLen)));

            // 首轮：全图随便挑一个空位当城区中心；后续轮：围着这个中心找锚点
            let ax: number;
            let ay: number;
            let level: number;
            if (round === 0) {
                const span = Math.min(sizeMax, Math.max(8, Math.round(Math.sqrt(length) * 1.6)));
                const corner = randomCorner(span);
                if (corner === null) {
                    reject('anchor');
                    continue;
                }
                [ax, ay] = corner;
                level = r.cellAt(ax, ay).level;

                const anchorWhy = cellOkForRoad(r, ax, ay, level);
                if (anchorWhy !== null) {
                    reject(anchorWhy);
                    continue;
                }
                if (nearStart(ax, ay)) {
                    reject('startingpoint');
                    continue;
                }
                centerX = ax;
                centerY = ay;
                centerLevel = level;
            } else {
                const near = randomNear(centerX, centerY, Math.round(sizeMax * 0.6), centerLevel);
                if (near === null) {
                    reject('nearanchor');
                    continue;
                }
                [ax, ay] = near;
                level = centerLevel;
            }

            const path = growPath(ax, ay, level, length);
            if (path.length < 20) {
                reject('path');
                continue;
            }

            let bx = ax;
            let by = ay;
            let bx1 = ax;
            let by1 = ay;
            for (const c of path) {
                if (c.x < bx) bx = c.x;
                if (c.x > bx1) bx1 = c.x;
                if (c.y < by) by = c.y;
                if (c.y > by1) by1 = c.y;
            }
            const bw = Math.min(bx1 - bx + 1, sizeMax);
            const bh = Math.min(by1 - by + 1, sizeMax);

            // 太瘦：路径填不满包围盒（0x5A5360 的整条作废条件）
            if (path.length * 1.6 <= bw * bh) {
                reject('thin');
                continue;
            }
            // 跨城区留 3 格空隙：只跟本城区之前的盒子比（同城区的盒子允许咬合）
            if (round === 0 && placedBoxes.slice(0, areaStart).some((b) => !(
                bx + bw + 3 < b.x || bx > b.x + b.w + 3
                || by + bh + 3 < b.y || by > b.y + b.h + 3))) {
                reject('overlap');
                continue;
            }

            const streets = placeRoadGrid(bx, by, bw, bh, level);
            stats.streets += streets;
            if (streets === 0) {
                reject('norooms');
                continue;
            }
            placedBoxes.push({ x: bx, y: by, w: bw, h: bh });
            areaBoxes.push({ x: bx, y: by, w: bw, h: bh });
            boxes++;
            stats.locations.push({ x: bx, y: by, w: bw, h: bh, streets });
        }
        if (boxes === 0) {
            reject('emptyarea');
            continue;
        }
        // 0x5A6510 / 0x5A6920 都是每个城区收尾各跑一次（不是每块包围盒一次）
        placeStructures(areaBoxes, centerLevel);
        placeCrowd(areaBoxes, centerLevel);
        stats.areas++;
    }

    diag(
        `URBAN: ${theaterName} ${stats.areas} 区 / ${stats.streets} 条街 / 街格 ${stats.roadCells}`
        + ` / 建筑 ${stats.structures} / 载具 ${stats.vehicles} / 步兵 ${stats.infantry}`
        + ` (尝试 ${stats.attempts} 次)`
        + (stats.areas < options.areas ? ` 失败原因 ${JSON.stringify(stats.rejections)}` : '')
        + (stats.locations.length !== 0
            ? ' 位置 ' + stats.locations.map((l) => `${l.w}x${l.h}@${l.x},${l.y}/${l.streets}街`).join(' ')
            : ''),
    );

    return stats;
}
