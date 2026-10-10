/**
 * ⭐ 对拍回归：我们的 RMG 输出 vs 真机基线的**结构性契约**。
 *
 * 基线：`rmg_real_randommap.yrm`（真机 RMG 产出，`[Basic] Author=Handama`）
 * 本文件把从基线**实测**得到的三条硬规则固化成断言，防止回归。
 *
 * 【2026-10-07 首次对拍发现并已修复的两个真 bug】
 * ① `IsoMapPack5` 混入 `TileIndex = 0xFFFF`（`TILE_UNASSIGNED` 哨兵）760 个。
 *    根因：`emitRmgMapFile` 无条件 `push`，把未触的格也写出且 tile 映射成 −1。
 *    基线实测 `TileIndex < 0` 的个数为 **0** ⇒ 原版是稀疏的，未触的格不出现。
 *    修复：`if (!cell || cell.tile === 0xffff) continue;`（emitRmg.ts）
 *    ⚠ 注意 `TileIndex == 0` 是**合法的 clear tile**（基线 5783 个），不是哨兵。
 * ② `[Header] Width/Height` 留 0。
 *    根因：`emitRmgMapIni` 没调 `CalculateStartingWaypoints`，
 *    而 Width/Height 正由它从 `[Map] LocalSize` 推导。
 *    口径（与基线实测一致）：`Width = localWidth − 1`、`Height = localHeight`。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { IniFile } from '../io/iniFile';
import { generateFullMap } from '../rmg/pipeline';
import { deriveDimensions } from '../rmg/options';
import { loadSed } from '../rmg/sed';
import { parseTheaterIni } from '../rmg/theater';
import { decompressRange } from '../format/minilzo';
import type { RmgOptions } from '../rmg/options';

const FIX = join(__dirname, '..', '..', 'src', 'test', 'fixtures');
const THEATER_INI =
  process.env.RMG_THEATER_INI ??
  join(__dirname, '..', '..', '..', 'server', 'resources', 'theater', 'temperatmd.ini');

interface Tile {
  x: number; y: number; ti: number; sub: number; lvl: number; ice: number;
}

/** 解 `[IsoMapPack5]`：base64 整流拼接 → Format5 分块 LZO → 11 字节 tile */
function readIsoTiles(ini: IniFile): Tile[] {
  const sec = ini.GetSection('IsoMapPack5');
  if (!sec) return [];
  const keys = sec.Keys.slice().sort((a, b) => Number(a) - Number(b));
  // ⚠ base64 跨行切断，必须拼接全部再整体解码
  const raw = Buffer.from(keys.map((k) => sec.GetStringValue(k, '')).join(''), 'base64');
  let r = 0;
  const parts: Buffer[] = [];
  while (r + 4 <= raw.length) {
    const si = raw.readUInt16LE(r);
    const so = raw.readUInt16LE(r + 2);
    if (si === 0 || so === 0) break;
    r += 4;
    const out = new Uint8Array(so + 1024);
    decompressRange(new Uint8Array(raw), r, si, out, 0);
    parts.push(Buffer.from(out.slice(0, so)));
    r += si;
  }
  const all = Buffer.concat(parts);
  const out: Tile[] = [];
  for (let o = 0; o + 11 <= all.length - 4; o += 11) {
    const x = all.readInt16LE(o);
    const y = all.readInt16LE(o + 2);
    const ti = all.readInt32LE(o + 4);
    if (x === 0 && y === 0 && ti === 0) break;
    out.push({ x, y, ti, sub: all[o + 8], lvl: all[o + 9], ice: all[o + 10] });
  }
  return out;
}

// ── 基线 ──
const realIni = new IniFile(readFileSync(join(FIX, 'rmg_real_randommap.yrm'), 'latin1'));
const realTiles = readIsoTiles(realIni);

// ── 我们（真实 MapType=1 样本；MapType=3/4 的水体驱动尚未接线）──
const sed = loadSed(
  readFileSync(join(FIX, 'randmap_maptype1_2p.sed')).toString('latin1'),
);
const dims = deriveDimensions(sed as RmgOptions);
const tables = parseTheaterIni(readFileSync(THEATER_INI, 'utf8'), 'TEMPERATE');
const { ini: ourRaw } = generateFullMap(
  {
    seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
    numPlayers: sed.numPlayers, ruggedness: sed.ruggedness,
    vegetation: sed.vegetation, tiberiumLayout: sed.tiberiumLayout,
    tiberium: sed.tiberium, resources: sed.resources,
    theater: sed.theater, dimensions: dims, tables,
  },
  'Random Map',
);
const ourIni = new IniFile(ourRaw);
const ourTiles = readIsoTiles(ourIni);

// ---------------------------------------------------------------------------
// 基线自身的实测事实（作为对拍依据，先锁住）
// ---------------------------------------------------------------------------

test('基线：IsoMapPack5 无负 TileIndex（稀疏语义）', () => {
  assert.ok(realTiles.length > 1000, `基线应有大量 tile，实际 ${realTiles.length}`);
  const neg = realTiles.filter((t) => t.ti < 0);
  assert.equal(neg.length, 0, `基线不应有负 TileIndex，实际 ${neg.length} 个`);
  // TileIndex == 0 是合法 clear tile
  const zeros = realTiles.filter((t) => t.ti === 0);
  assert.ok(zeros.length > 100, `基线应有大量 clear tile(0)，实际 ${zeros.length}`);
});

test('基线：IceGrowth 全为 0', () => {
  const nz = realTiles.filter((t) => t.ice !== 0);
  assert.equal(nz.length, 0, `基线 IceGrowth 应全 0，实际 ${nz.length} 个非 0`);
});

// ---------------------------------------------------------------------------
// ① 回归：IsoMapPack5 不得混入 TILE_UNASSIGNED
// ---------------------------------------------------------------------------

test('我们：无负 TileIndex（修复① 回归）', () => {
  assert.ok(ourTiles.length > 100, `我们应产出 tile，实际 ${ourTiles.length}`);
  const neg = ourTiles.filter((t) => t.ti < 0);
  assert.equal(neg.length, 0,
    `IsoMapPack5 混入 ${neg.length} 个负 TileIndex（TILE_UNASSIGNED 哨兵）—— ` +
    '原版是稀疏的，未触的格不应出现');
  assert.ok(!ourTiles.some((t) => t.ti === 0xffff),
    '不得出现 0xFFFF 哨兵');
});

test('我们：TileIndex 落在 theater 表范围内（修复① 回归）', () => {
  // 0..509 实测合法；负值/超大值都说明 emit 把未分配格写进去了
  const max = Math.max(...ourTiles.map((t) => t.ti));
  assert.ok(max >= 0, `TileIndex 应 ≥0，实际最大 ${max}`);
  assert.ok(max < 5000, `TileIndex=${max} 超出 theater tileset 合理范围`);
});

// ---------------------------------------------------------------------------
// ② 回归：[Header] Width/Height 必须已推导
// ---------------------------------------------------------------------------

test('我们：[Header] Width/Height 非 0 且口径同基线（修复② 回归）', () => {
  const w = ourIni.GetIntValue('Header', 'Width', 0);
  const h = ourIni.GetIntValue('Header', 'Height', 0);
  assert.ok(w > 0 && h > 0, `[Header] Width/Height 应 >0，实际 ${w}x${h}（修复② 回归）`);

  // 口径：Width = LocalSize宽 − 1（菱形带 x 上界）、Height = LocalSize 高
  const ls = /^(\d+),(\d+),(\d+),(\d+)$/.exec(ourIni.GetStringValue('Map', 'LocalSize', ''))!;
  assert.equal(w, Number(ls[3]) - 1, 'Width 应为 LocalSize 宽 − 1');
  assert.equal(h, Number(ls[4]), 'Height 应等于 LocalSize 高');

  // 与基线同口径：基线 116/107 对 LocalSize 117/107
  const rls = /^(\d+),(\d+),(\d+),(\d+)$/.exec(realIni.GetStringValue('Map', 'LocalSize', ''))!;
  assert.equal(realIni.GetIntValue('Header', 'Width', 0), Number(rls[3]) - 1,
    '基线自身也应满足 Width = LocalSize宽 − 1（口径一致性）');
  assert.equal(realIni.GetIntValue('Header', 'Height', 0), Number(rls[4]),
    '基线自身也应满足 Height = LocalSize 高');
});

// ---------------------------------------------------------------------------
// 段集合：已知缺 3 段（尚未实现）
// ---------------------------------------------------------------------------

test('我们：段集合覆盖基线的 37/40（缺 Preview/PreviewPack/Digest）', () => {
  const rs = realIni.GetSections();
  const os = ourIni.GetSections();
  const oset = new Set(os);
  const missing = rs.filter((s) => !oset.has(s));
  // 当前已知缺口：预览图两段 + 校验和段
  assert.deepEqual(missing.sort(), ['Digest', 'Preview', 'PreviewPack'],
    '已知缺口应恰为 Preview/PreviewPack/Digest 三段（多了或少了都要更新本断言）');
  // 我们不应产出基线没有的段
  const rset = new Set(rs);
  const extra = os.filter((s) => !rset.has(s));
  assert.deepEqual(extra, [], `我们不应产出基线没有的段：${extra.join(',')}`);
});

// ---------------------------------------------------------------------------
// 结构性规模（不是逐字节一致，只是量级合理性）
// ---------------------------------------------------------------------------

test('我们：tile 坐标域与基线同口径（不越界）', () => {
  const w = ourIni.GetIntValue('Header', 'Width', 0);
  const h = ourIni.GetIntValue('Header', 'Height', 0);
  const xs = ourTiles.map((t) => t.x);
  const ys = ourTiles.map((t) => t.y);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  assert.ok(minX >= 0, 'dx 应 ≥ 0');
  assert.ok(minY >= 0, 'dy 应 ≥ 0');
  // ⚠ **dx/dy 的上界不是 `2*Width`/`2*Height`**。
  // 实测真机基线（`F:\YTLauncher\RandMap.Map`，Header W=99 H=100）：
  //   dx 1..215   dy 1..215   ⇒ 远超 2*W=198 / 2*H=200
  // 真实上界由**菱形带的 (dx+dy) 约束**决定：dx 走 [0, 2W−2]，
  // dy 随行递增（`dy = y*2 + x%2`，y < H），故 dy 可达 ~2H。
  // 这里改用「与真机同量级」的口径：我们不该比基线更宽。
  const realXs = realTiles.map((t) => t.x);
  const realYs = realTiles.map((t) => t.y);
  const realMaxX = Math.max(...realXs);
  const realMaxY = Math.max(...realYs);
  assert.ok(maxX <= Math.max(2 * w, realMaxX),
    `dx 上界 ${maxX} 不应超过 max(2*Width=${2 * w}, 基线 ${realMaxX})`);
  assert.ok(maxY <= Math.max(2 * h, realMaxY),
    `dy 上界 ${maxY} 不应超过 max(2*Height=${2 * h}, 基线 ${realMaxY})`);
});

test('我们：Level 落在 RMG 合法范围（基线实测 0..12）', () => {
  const lv = new Set(ourTiles.map((t) => t.lvl));
  for (const v of lv) {
    assert.ok(v >= 0 && v <= 14, `Level=${v} 超出合法范围 0..14`);
  }
  assert.ok(lv.size > 1, `Level 应有多种取值（地形起伏），实际 ${[...lv].join(',')}`);
});
