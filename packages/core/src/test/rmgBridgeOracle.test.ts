/**
 * gamemd 原生桥接刻坡 conformance harness.
 *
 * 基准来源：vera20k `tools/rmg_oracle/bridge_pass.json` —— 由 unicorn 直接执行
 * 零售 gamemd.exe 的 BridgeAndConnectorPass（0x0058EF10）产生，每个场景记录
 * 初始地形、每一格刻后状态、区域表、下一区域 id 与退出 RNG 状态。
 *
 * 对端：本仓库 `reseedRegions`（0x58EF10 的移植），在 gamemdStrict 模式下
 * 跳过移植期自造的 quality-fix。
 *
 * 场景构造：24×24 地图（mapWidth/mapHeight=24、workSide=49），菱形带内的格子
 * 按 (y,x) 升序铺 `terrain` run-length（tile, level），scratch marks 复位为 -1，
 * 区域表为空、next id = 0，RNG 用场景 seed 初始化。
 */

import { test } from 'node:test';
import * as fs from 'node:fs';
import { strict as assert } from 'node:assert';
import { Rmg } from '../rmg/cxx/mapGen';
import { reseedRegions, setGamemdStrict } from '../rmg/cxx/makingSub';
import { buffer as diagBuffer } from '../rmg/cxx/diag';

const FIXTURE = 'G:/_ref/vera20k/tools/rmg_oracle/bridge_pass.json';
const W = 24;
const H = 24;
const SIDE = 49;

/** Fixture rows that逐格全等 —— 用硬断言锁住，防止回退。 */
const EXACT_CASES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

interface Fixture {
    scene: { tiles: Record<string, number>; gen: number[]; size: number; cell_count: number };
    rows: Array<{
        input: { seed: number; gen: number[]; kind: number; accessibility: number };
        terrain: Array<[number, number, number]>; // [runLength, tile, level]
        changed: Array<[number, number, number, number, number, number, number, number, number]>;
        regions: Array<[number, number, number, number]>; // [runLength, regionId, ...]
        next_region_id: number;
        listed: Array<[number, number, number, number]>; // [id, cellCount, level, waterFlag]
    }>;
}

/** Build the fixture's declared scene as an Rmg ready for reseedRegions. */
function buildScene(fx: Fixture, row: Fixture['rows'][number]): Rmg {
    const rmg = new Rmg();
    rmg.size = { width: 22, height: 16, mapWidth: W, mapHeight: H, workSide: SIDE };
    rmg.baseLevel = 0;
    rmg.initCells();
    rmg.initWorkArray();
    rmg.fillWorkCoords();

    // theater globals the pass reads (declared by the fixture's scene block)
    const t = fx.scene.tiles;
    rmg.rampBaseIndex = t.ramp_base!;
    rmg.slopeSetPiecesIndex = t.slope_set_pieces!;
    rmg.pavedRoadsIndex = t.paved_roads!;
    rmg.pavedRoadEndsIndex = t.paved_road_ends!;
    rmg.miscPaveTileIndex = t.misc_pave!;
    rmg.paveTileIndex = t.pave!;
    rmg.greenTileIndex = t.green!;
    rmg.clearTileIndex = t.clear!;
    rmg.clearToGreenLatIndex = t.green_lat!;
    // water class: WaterSet (314) only. The four waterfall families are separate
    // theater globals (oracle: East 539, West 547, South 414, North 543) and play
    // no part in this scene — synthesising them as water+1..+4 made every river
    // cell read as a waterfall and killed the deck walk.
    rmg.waterTileIndex = t.water!;
    const fg = ((fx as unknown as { inputs: { family_globals: Record<string, number> } })
        .inputs.family_globals) ?? {};
    rmg.waterFamily4Base = [
        fg['00AA073C'] ?? -1,   // East
        fg['00ABB110'] ?? -1,   // West
        fg['00AA1050'] ?? -1,   // South
        fg['00AA10A0'] ?? -1,   // North
    ];
    rmg.shoreTileIndex = t.shore!;
    rmg.shorePieces = t.shore!;

    // Every tile the oracle registered with a physical TMP: the generator reads
    // width/height from the image, so the harness supplies the same numbers.
    const reg = ((fx as unknown as {
        inputs: {
            registered_tiles?: Array<{
                tile: number, width: number, height: number,
                subtiles?: Array<{ height: number, slope: number } | null>,
            }>
        }
    }).inputs?.registered_tiles) ?? [];
    for (const entry of reg) {
        rmg.tileFootprintOverrides.set(entry.tile, { w: entry.width, h: entry.height });
        if (entry.subtiles !== undefined)
            rmg.tileSubtileOverrides.set(entry.tile, entry.subtiles);
    }

    rmg.config.global.accessibility = row.input.accessibility;
    rmg.globalOptions.accessibility = row.input.accessibility;

    // terrain: the fixture writes (tile, level) per diamond cell in (y,x) order
    let cursor = 0;
    let runLeft = 0;
    let tile = 0;
    let level = 0;
    for (let y = 0; y < SIDE; ++y) {
        for (let x = 0; x < SIDE; ++x) {
            if (!rmg.cellExists(x, y)) continue;
            while (runLeft === 0) {
                const run = row.terrain[cursor++];
                if (run === undefined) throw new Error('terrain runs exhausted');
                runLeft = run[0];
                tile = run[1];
                level = run[2];
            }
            const cell = rmg.cellAt(x, y);
            cell.isoTileTypeIndex = tile;
            cell.level = level;
            cell.slopeIndex = 0;
            cell.overlayTypeIndex = -1;
            --runLeft;
        }
    }

    // scratch marks start at -1 (native prepare writes +0x38/-1,-1 per slot)
    const side = rmg.size.workSide;
    for (let idx = 0; idx < side * side; ++idx) {
        rmg.work.setI(idx, 14, -1);
        rmg.work.setI(idx, 15, -1);
    }

    rmg.regions = [];
    rmg.regionIdCounter = 0;
    rmg.rng.seed(row.input.seed);
    return rmg;
}

interface CellState {
    tile: number;
    level: number;
    slope: number;
    overlay: number;
    object: number;
}

const stateOf = (rmg: Rmg, x: number, y: number): CellState => {
    const c = rmg.cellAt(x, y);
    return {
        tile: c.isoTileTypeIndex,
        level: c.level,
        slope: c.slopeIndex,
        overlay: c.overlayTypeIndex,
        // native's cell +0xE4 FirstObject; the port records occupancy in AltFlags
        object: (c.altFlags & 0x2) !== 0 ? 1 : 0,
    };
};

test('gamemd bridge_pass: 场景骨架自检（地形铺放与菱形一致）', (t) => {
    if (!fs.existsSync(FIXTURE)) return t.skip('requires G:/_ref/vera20k');
    const fx = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Fixture;
    const rmg = buildScene(fx, fx.rows[0]!);
    let count = 0;
    for (let y = 0; y < SIDE; ++y)
        for (let x = 0; x < SIDE; ++x)
            if (rmg.cellExists(x, y)) ++count;
    t.diagnostic(`diamond cells=${count} expected=${fx.scene.cell_count}`);
    if (count !== fx.scene.cell_count)
        t.diagnostic('WARNING: diamond cell count differs from the fixture scene');
});

test('gamemd bridge_pass: changed 格逐场对比（信息性，先量化差距）', (t) => {
    if (!fs.existsSync(FIXTURE)) return t.skip('requires G:/_ref/vera20k');
    const fx = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Fixture;
    setGamemdStrict(true);
    process.env.RMG_DEBUG_STAMP = '1';
    process.env.RMG_DEBUG_NB = '1';

    fx.rows.forEach((row, index) => {
        const rmg = buildScene(fx, row);
        const before = new Map<string, CellState>();
        for (let y = 0; y < SIDE; ++y)
            for (let x = 0; x < SIDE; ++x)
                if (rmg.cellExists(x, y)) before.set(`${x},${y}`, stateOf(rmg, x, y));

        reseedRegions(rmg);
        if (index === 0 && process.env.RMG_DEBUG_REGIONS) {
            for (let y = 15; y <= 19; ++y) {
                const parts: string[] = [];
                for (let x = 20; x <= 28; ++x) {
                    const st = before.get(`${x},${y}`);
                    parts.push(st ? `${st.tile}/${st.level}` : 'none');
                }
                t.diagnostic(`  pre y=${y}: ` + parts.join(' '));
            }
        }

        const rampStats: Record<string, number> = {};
        const nbLines: string[] = [];
        for (const line of diagBuffer) {
            const tag = line.split(' ')[0]!;
            if (tag === 'REGION-NB') {
                nbLines.push(line);
            } else if (tag === 'DECK-MARK') {
                if (nbLines.length < 6) nbLines.push(line);
            } else if (tag === 'RAMP-MASK') {
                const m = /ok=(\d) mask=(\d+)/.exec(line);
                if (m) rampStats[`mask(ok=${m[1]},v=${m[2]})`] = (rampStats[`mask(ok=${m[1]},v=${m[2]})`] ?? 0) + 1;
            } else if (tag === 'RAMP-RECT' || tag === 'RAMP-BUILD') {
                if (nbLines.length < 12) nbLines.push(line);
            } else if (tag.startsWith('RESEED-')) {
                if (nbLines.length < 12) nbLines.push(line);
            } else if (tag.startsWith('DISSOLVE-')) {
                if (nbLines.length < 8) nbLines.push(line);
            } else if (tag.startsWith('DECK-')) {
                if (nbLines.length < 8) nbLines.push(line);
            } else if (tag.startsWith('RAMP-') || tag.startsWith('DECK-')) {
                rampStats[tag] = (rampStats[tag] ?? 0) + 1;
            }
        }
        diagBuffer.length = 0;
        if (process.env.RMG_DEBUG_REGIONS && nbLines.length)
            t.diagnostic(`  case ${index} ${nbLines.join(' ; ')}`);
        if (process.env.RMG_DEBUG_REGIONS)
            t.diagnostic(`  case ${index} ramps: ` + JSON.stringify(rampStats)
                + ` draws=${rmg.rng.drawCount()}`);

        if (process.env.RMG_DEBUG_REGIONS) {
            t.diagnostic(`  case ${index} regions: ` + rmg.regions.map((g) =>
                `id${g.id}(z${g.level}${g.waterFamily ? ',water' : ''},cells${g.cellCount},nb[${g.neighbours.join('/')}])`).join(' '));
        }

        if (index === 4 && process.env.RMG_DEBUG_REGIONS) {
            for (const [x, y] of [[28, 16], [29, 16], [30, 16], [26, 23], [24, 25]]) {
                const was = before.get(`${x},${y}`);
                const now = rmg.cellExists(x, y) ? stateOf(rmg, x, y) : null;
                t.diagnostic(`  case4 (${x},${y}) before=${JSON.stringify(was)} now=${JSON.stringify(now)}`
                    + ` region=${rmg.work.i(rmg.workIndex(x, y), 14)}`);
            }
        }
        const ours: Array<[number, number, CellState]> = [];
        for (let y = 0; y < SIDE; ++y) {
            for (let x = 0; x < SIDE; ++x) {
                if (!rmg.cellExists(x, y)) continue;
                const now = stateOf(rmg, x, y);
                const was = before.get(`${x},${y}`)!;
                if (now.tile !== was.tile || now.level !== was.level
                    || now.slope !== was.slope || now.overlay !== was.overlay
                    || now.object !== was.object)
                    ours.push([x, y, now]);
            }
        }

        const expected = new Map<string, CellState>();
        for (const e of row.changed) {
            const [x, y, tile, , level, slope, overlay] = e;
            expected.set(`${x},${y}`, {
                tile, level, slope, overlay,
                object: (e[8] as number | undefined) ?? 0,
            });
        }

        let hit = 0;
        let missField = 0;
        let extra = 0;
        const samples: string[] = [];
        for (const [x, y, s] of ours) {
            const want = expected.get(`${x},${y}`);
            if (!want) { ++extra; if (samples.length < 3) samples.push(`extra (${x},${y})`); continue; }
            const same = want.tile === s.tile && want.level === s.level
                && want.slope === s.slope && want.overlay === s.overlay
                && want.object === s.object;
            if (same) ++hit;
            else {
                ++missField;
                if (samples.length < 6)
                    samples.push(`(${x},${y}) want t${want.tile} z${want.level} s${want.slope} o${want.overlay} obj${want.object}`
                        + ` / got t${s.tile} z${s.level} s${s.slope} o${s.overlay} obj${s.object}`);
            }
        }
        const missing = [...expected.keys()].filter((k) => !ours.some(([x, y]) => `${x},${y}` === k)).length;

        // region ids per cell: the fixture stores them as [runLength, regionId]
        // runs over the same (y,x) cell order, so this isolates "did the flood
        // assign the same regions" from "did the carve write the same tiles".
        const wantRegions: number[] = [];
        for (const r of row.regions) {
            const count = r[0]!;
            const id = r[1]!;
            for (let i = 0; i < count; ++i) wantRegions.push(id);
        }
        let regionOrder: number[] = [];
        const regionCoords: Array<[number, number]> = [];
        for (let y = 0; y < SIDE; ++y)
            for (let x = 0; x < SIDE; ++x)
                if (rmg.cellExists(x, y)) {
                    regionOrder.push(rmg.work.i(rmg.workIndex(x, y), 14));
                    regionCoords.push([x, y]);
                }
        let regionMismatch = 0;
        const mismatchCells: string[] = [];
        for (let i = 0; i < wantRegions.length; ++i)
            if (wantRegions[i] !== regionOrder[i]) {
                ++regionMismatch;
                if (mismatchCells.length < 12)
                    mismatchCells.push(`(${regionCoords[i]!.join(',')})g${regionOrder[i]}w${wantRegions[i]}`);
            }

        // Cases proven cell-exact against the native oracle. They are hard
        // assertions so a later change cannot silently regress them; the rest
        // stay diagnostic until their attempt stream is aligned.
        if (EXACT_CASES.has(index)) {
            assert.equal(extra, 0, `case ${index}: ${extra} cells the exe never writes`);
            assert.equal(missing, 0, `case ${index}: ${missing} cells the exe writes are absent`);
            assert.equal(missField, 0, `case ${index}: ${missField} cells differ in a field`);
            assert.equal(hit, row.changed.length, `case ${index}: exact cells`);
            assert.equal(regionMismatch, 0, `case ${index}: region ids per cell`);
            assert.equal(rmg.regionIdCounter, row.next_region_id, `case ${index}: next region id`);
        }

        t.diagnostic(
            `case ${index}: expected=${row.changed.length} ours=${ours.length} `
            + `exact=${hit} fieldDiff=${missField} extra=${extra} missing=${missing} `
            + `regions=${rmg.regions.length} regionCellMismatch=${regionMismatch}/${wantRegions.length} `
            + `nextId=${rmg.regionIdCounter}(want ${row.next_region_id})`,
        );
        if (mismatchCells.length)
            t.diagnostic(`  case ${index} region cells: ${mismatchCells.join(' ')}`);

        // The fixture's `listed` is the rebuilt region vector itself:
        // [id, cellCount, level, waterFlag]. Compare it to ours field by field.
        const ourListed = rmg.regions
            .map((g) => [g.id, g.cellCount, g.level, g.waterFamily ? 1 : 0] as const)
            .sort((a, b) => a[0] - b[0]);
        const wantListed = [...row.listed].sort((a, b) => a[0] - b[0]);
        if (ourListed.length !== wantListed.length) {
            t.diagnostic(`  listed length ${ourListed.length} vs want ${wantListed.length}`);
        } else {
            const diffs = ourListed
                .map((g, i) => [g, wantListed[i]!] as const)
                .filter(([g, w]) => g[0] !== w[0] || g[1] !== w[1] || g[2] !== w[2] || g[3] !== w[3]);
            if (diffs.length) {
                t.diagnostic(`  listed diffs: ${diffs.slice(0, 3).map(([g, w]) =>
                    `got(${g.join(',')}) want(${w.join(',')})`).join(' | ')}`);
            } else {
                t.diagnostic(`  listed: exact ${wantListed.length}/${wantListed.length}`);
            }
        }
        if (samples.length) t.diagnostic(`  ${samples.join(' | ')}`);
    });
});
