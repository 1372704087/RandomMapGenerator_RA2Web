/**
 * 把岛屿 MapUnit 的图块编号从温带改写成雪地（re-theater），供 SNOW_Islands 使用。
 *
 * 依据（已用 cncmaps 源码核对）：
 *   - 扁平索引语义：`cncmaps-ts/src/engine/game/TileCollection.ts:344` InitTilesets()
 *     逐个 [TileSetNNNN] 累加 TilesInSet，tileNum 就是这个扁平序号。
 *   - 温带 / 雪地在 set 0..30 的 TilesInSet 一致 ⇒ 扁平 base 一致，索引可直接沿用。
 *   - 从 31 起雪地插入了 Ice 系列，后面整体错位 ⇒ 必须按「同一套美术」重排。
 *
 * 用法：
 *   node scripts/mapunit-retheater.mjs --apply          # 写进 SNOW_Islands（源是 TEMPERATE_Islands）
 *   node scripts/mapunit-retheater.mjs                  # 只打印映射表/统计
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { decodeInto, encode } = require(path.join(ROOT, 'packages/core/dist/format/format5.js'));

const args = process.argv.slice(2);
const getArg = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const SOURCE = getArg('--source', 'TEMPERATE_Islands');
const TARGET = getArg('--target', 'SNOW_Islands');
const APPLY = args.includes('--apply');
const UNITS = path.join(ROOT, 'packages/server/resources/MapUnits');
const THEATER_DIR = path.join(ROOT, 'packages/server/resources/theater');
const SKIP = new Set([]);
// indicator.map 只有 1 个 tile 0（恒等），empty.map / cannotplacesmudge.map 里
// 有 Tunnel Floor（set 53→47）等非恒等 tile，必须一起重映射。

function parseSets(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const sets = [];
  let cur = null;
  for (const line of lines) {
    const t = line.trim();
    const m = /^\[TileSet(\d{4})\]/.exec(t);
    if (m) {
      cur = { index: Number(m[1]), name: '', file: '', tiles: 0 };
      sets.push(cur);
      continue;
    }
    if (!cur) continue;
    if (t.startsWith('[')) {
      cur = null;
      continue;
    }
    const kv = /^(\w+)\s*=\s*(.*)$/.exec(t);
    if (!kv) continue;
    if (kv[1] === 'SetName') cur.name = kv[2];
    else if (kv[1] === 'FileName') cur.file = kv[2];
    else if (kv[1] === 'TilesInSet') cur.tiles = Number(kv[2]);
  }
  let base = 0;
  for (const s of sets) {
    s.base = base;
    base += s.tiles;
  }
  return { sets, total: base, byIndex: new Map(sets.map(s => [s.index, s])) };
}

const temp = parseSets(path.join(THEATER_DIR, 'temperatmd.ini'));
const snow = parseSets(path.join(THEATER_DIR, 'snowmd.ini'));

const targetTheater =
  sectionKV(fs.readFileSync(path.join(UNITS, TARGET, 'settings.ini'), 'utf8'), 'settings')?.Theater || 'SNOW';

/**
 * 温带 set → 雪地 set。
 * 0..30：索引本来就对齐（TilesInSet 也一致），全部走恒等。
 * 31+：按 SetName/FileName + TilesInSet 手工配对。
 * 配不上的（温带有、雪地没有对应美术）落到最接近的雪地「地面」集合，宁可少细节也不要黑洞。
 */
const PAIRS = new Map([
  // 恒等段（这些 set 的 TilesInSet 两边完全一致）
  ...[
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
    25, 26, 27, 28, 29, 30,
  ].map(i => [i, i]),
  // 错位段
  [33, 62], // LAT Grass Rough [Sandy] n=1        → LAT SnowyRock [sandy] n=1
  [34, 63], // GrassRough Individual [dlat] n=16  → Rock/Clear LAT [dlat] n=16
  [35, 40], // Farm Crops [Rough] n=10             → Farmland [Rough] n=10
  [36, 38], // Paved Road Ends [p_end] n=4         → Paved Road Ends [p_end] n=4
  [37, 39], // TrainBridges n=16                   → TrainBridges n=16
  [38, 69], // Pavement [Pave] n=14                → Pavement Detail [Pave] n=14
  [39, 70], // Pavement Individual [plat] n=16     → Pavement/Clear LAT [plat] n=16
  [40, 71], // Paved road bits [proadc] n=14      → Paved road bits [proadc] n=14
  [41, 64], // LAT Sand [Green] n=1                → LAT Icy [green] n=1
  [42, 65], // Sand Individual [glat] n=16         → Grey/Clear LAT [glat] n=16
  [43, 41], // Ramp edge fixup [Rmpfx] n=12        → Ramp edge fixup [Rmpfx] n=12
  [44, 42], // Ramp edge fixup MM [Mrmfx] n=12     → ZMM Ramp edge fixup [Mrmfx] n=12
  [45, 43], // Water slopes n=0                    → Water slopes n=0
  [46, 68], // LAT Pavement [Pvclr] n=1            → LAT Pavement [Pvclr] n=1
  [47, 44], // Paved Road Slopes [Prslpe] n=4      → Paved Road Slopes [Prslpe] n=4
  [48, 45], // Monorail Slopes n=0                 → Monorail Slopes n=0
  [49, 54], // Waterfalls-B [W-b-] n=4             → ZMM Waterfalls-B [MWb-] n=4
  [50, 55], // Waterfalls-C [W-c-] n=4             → ZMM Waterfalls-C [MWc-] n=4
  [51, 56], // Waterfalls-D [W-d-] n=4             → ZMM Waterfalls-D [MWd-] n=4
  [52, 46], // Newest MM Height [hyte] n=15        → ZMM Height Pieces [hyte] n=15
  [53, 47], // Tunnel Floor [tunnel] n=4           → Tunnels [tunnel] n=4
  [54, 48], // Tunnel Side [tunnex] n=2            → Tunnel Side [tunnex] n=2
  [55, 49], // TrackTunnel Floor n=0               → TrackTunnel Floor n=0
  [56, 61], // Destroyable Cliffs [dcliff] n=2     → Destroyable Cliffs [dcliff] n=2
  [57, 37], // Water Caves [Wcave] n=4（雪地无）   → Waterfalls-D n=4（降级）
  [58, 50], // ZMM Bendy Dirt Roads [MDrodc] n=24  → ZMM DirtRoads Bendy n=24
  [59, 51], // ZMM Dirt Road Junctions n=11       → ZMM DirtRoad Junctions n=11
  [60, 52], // ZMM Straight Dirt Roads n=66       → ZMM DirtRoads Straight n=66
  [61, 53], // ZMM Shore Pieces n=42              → ZMM Shore Pieces n=42
  [62, 54], // ZMM Waterfalls [MWa-] n=4          → ZMM Waterfalls-A n=4
  [63, 55], [64, 56], [65, 57], // ZMM Waterfalls-B/C/D
  [66, 58], // ZMM Water Caves [MWcave] n=4（雪地无） → ZMM Cliff/Water pieces n=28（只占前 4）
  [67, 58], // ZMMCliff/Water pieces n=28         → ZMM Cliff/Water pieces n=28
  [68, 59], // ZMM Water slopes n=0               → ZMM Water slopes n=0
  [69, 60], // ZMM Water [MWater] n=14            → ZMM Water [MWater] n=14
  [70, 70], // Scrin Wreckage n=0                 → n=0（无所谓）
  [72, 66], // DirtTrackTunnel Floor n=0          → DirtTrackTunnel Floor n=0
  [73, 67], // DirtTunnel Floor [dtunn] n=4       → DirtTunnel Floor [dtunn] n=4
  [74, 62], // Sand (beach) [Green] n=1           → LAT SnowyRock n=1
  [75, 65], // Sand (beach) Transitions [glat] 16 → Grey/Clear LAT [glat] n=16
  [76, 72], // Water bridge [wbrdge] n=2          → Water bridge [wbrdge] n=2
  [77, 40], // RA2 rubble farm n=8（雪地无）       → Farmland n=10（降级）
  [78, 67], // RA2 rubble mobile n=2（雪地无）     → DirtTunnel Floor n=4（降级）
  [79, 67], // RA2 rubble mexican n=5             → 同上
  [80, 73], // Wood Bridges [Ovrpsb] n=16         → Wood Bridges [Ovrpsb] n=16
  [81, 60], // RA2 uss arizona n=1（雪地无）       → （占位，实际走水面克隆，见 REPLACE_WITH_WATER）
]);

/**
 * 雪地没有对应美术、又不能按 tile 平移解决的 set（多格大块美术 / 零售 MIX 缺 ZMM 系贴图）：
 *   57 = Water Caves（水洞口，多格）——41 文件实测渲染纯黑楔形
 *   81 = uss arizona 沉船（15+ subtile 的大块）——渲染纯黑矩形
 * 处理：整条记录改写成「邻域克隆 (tileNum,subtile,z)」，优先级：
 *   ① 同 z 水面（洞口水线格 / 沉船）② 同 z 悬崖系（水洞上排岩拱格，保持崖线连续）
 *   ③ 文件内水面众数（贴可用区边缘的格）。
 * 注意：岩拱格若直接落回 z=0 水面，身后 z=4 的悬崖会失去立面过渡 → 渲染黑洞。
 */
const REPLACE_WITH_WATER = new Set([57, 81, 49, 50, 51, 62, 65]);
// donor 候选的扁平范围（全部是温雪同构的恒等段 set）
const DONOR_RANGES = [
  [314, 327], // set 21 Water
  [148, 175], // set 15 Cliff/Water pieces
  [49, 88], // set 10 Cliff Set
  [89, 130], // set 12 Shore Pieces
];
const isDonorTile = (tn) => DONOR_RANGES.some(([lo, hi]) => tn >= lo && tn <= hi);

function setOf(t, flat) {
  for (const s of t.sets) if (s.tiles > 0 && flat >= s.base && flat < s.base + s.tiles) return s;
  return null;
}

function mapTile(tileNum) {
  const s = setOf(temp, tileNum);
  if (!s) return { out: tileNum, note: 'no-set' };
  if (REPLACE_WITH_WATER.has(s.index)) return { out: tileNum, note: `water-clone-${s.index}` };
  const off = tileNum - s.base;
  const target = PAIRS.get(s.index);
  if (target === undefined) return { out: tileNum, note: `unpaired-${s.index}` };
  const ts = snow.byIndex.get(target);
  if (!ts || ts.tiles === 0) return { out: tileNum, note: `snow-empty-${target}` };
  const clamped = Math.min(off, ts.tiles - 1);
  return { out: ts.base + clamped, note: `set ${s.index}->${target}${clamped !== off ? ' (clamp)' : ''}` };
}

/**
 * 对标记为克隆的记录，按 set 分策略借 donor 的 (tileNum,subtile,z)。
 *
 * 渲染器机制（cncmaps-ts TileCollection.PickVariant / TmpRenderer.Draw 已核对）：
 *   - 每条记录独立画 Images[st]，但 multi-variant tileset 按「piece 锚点 (x&3,y&3)」选变体文件；
 *   - st 超过所选变体的 Images.length ⇒ 整格不画 ⇒ 背景黑色。
 * 因此：
 *   - 水洞(set57)/瀑布(49,50,51,62,65)：同行西移整块克隆。西移量取 4 的倍数
 *     （相位 (x&3) 不变 ⇒ 变体与 donor 相同 ⇒ art 必然存在），崖线/水面剖面逐行保持。
 *   - 沉船(set81)：开阔水面上的多格大块，按邻域水面克隆（水面 tile 各变体图数一致，逐格克隆安全）。
 */
const WATERFALL_CLONE_SETS = new Set([49, 50, 51, 62, 65]);
function cloneFromWater(out, affected) {
  const recs = [];
  for (let i = 0; i + 11 <= out.length; i += 11) {
    recs.push({
      i,
      rx: out[i] | (out[i + 1] << 8),
      ry: out[i + 2] | (out[i + 3] << 8),
      tn: out[i + 4] | (out[i + 5] << 8),
      st: out[i + 8],
      z: out[i + 9],
    });
  }
  const byPos = new Map(recs.map((r) => [`${r.rx},${r.ry}`, r]));
  const isWater = (r) => r && r.tn >= 314 && r.tn <= 327;
  const isDonor = (r) => r && isDonorTile(r.tn);
  // 文件内水面 (tileNum,subtile,z) 众数，作为环搜失败时的兜底
  const waterMode = new Map();
  for (const r of recs) {
    if (isWater(r)) {
      const k = `${r.tn}/${r.st}/${r.z}`;
      waterMode.set(k, (waterMode.get(k) || 0) + 1);
    }
  }
  let donor2 = null;
  for (const [k] of [...waterMode.entries()].sort((x, y) => y[1] - x[1])) {
    const [tn, st, z] = k.split('/').map(Number);
    donor2 = { tn, st, z };
    break;
  }
  if (!donor2) donor2 = { tn: 318, st: 2, z: 0 }; // 全局默认：深水（温雪同构 set 21）
  let cloned = 0;
  let defaulted = 0;
  let failed = 0;
  const passes = [
    (c, a) => isWater(c) && c.z === a.z, // ① 同 z 水面
    (c, a) => isDonor(c) && c.z === a.z, // ② 同 z 悬崖/岸（保崖线连续）
    (c) => isWater(c), // ③ 任意 z 水面
  ];
  for (const a of affected) {
    let donor = null;
    if (WATERFALL_CLONE_SETS.has(Number(a.set)) || a.set === '57') {
      // 同行西移克隆：优先 8 格（4 的倍数保变体相位 (x&3)），逐步放宽
      for (const k of [8, 4, 12, 16, 2, 6, 10, 14, 20, 24]) {
        const cand = byPos.get(`${a.rx - k},${a.ry}`);
        if (cand && isDonor(cand)) { donor = cand; break; }
      }
    } else {
      for (const accept of passes) {
        for (let ring = 1; ring <= 8 && !donor; ring++) {
          for (let dx = -ring; dx <= ring && !donor; dx++) {
            for (let dy = -ring; dy <= ring && !donor; dy++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
              const cand = byPos.get(`${a.rx + dx},${a.ry + dy}`);
              if (accept(cand, a)) donor = cand;
            }
          }
        }
        if (donor) break;
      }
    }
    if (!donor && waterMode.size > 0) {
      // 环搜失败：该格贴着单元可用区边缘（邻格是哨兵），退化为文件内水面众数
      donor = donor2;
      defaulted++;
    }
    if (donor) {
      out[a.i + 4] = donor.tn & 0xff;
      out[a.i + 5] = (donor.tn >>> 8) & 0xff;
      out[a.i + 8] = donor.st;
      out[a.i + 9] = donor.z;
      cloned++;
    } else {
      failed++;
      if (process.env.WC_DEBUG) console.log(`  [FAIL] rx=${a.rx} ry=${a.ry} z=${a.z}`);
    }
  }
  return { cloned, defaulted, failed };
}

function sectionKV(text, name) {
  const lines = text.split(/\r?\n/);
  const i = lines.findIndex(l => l.trim() === `[${name}]`);
  if (i < 0) return null;
  const kv = {};
  for (let j = i + 1; j < lines.length; j++) {
    const t = lines[j].trim();
    if (!t) continue;
    if (t.startsWith('[')) break;
    const eq = t.indexOf('=');
    if (eq > 0) kv[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return kv;
}

function decodeIso(text) {
  const pack = sectionKV(text, 'IsoMapPack5');
  if (!pack) return null;
  const b64 = Object.keys(pack)
    .sort((a, b) => Number(a) - Number(b))
    .map(k => pack[k])
    .join('');
  const lzo = new Uint8Array(Buffer.from(b64.replace(/[^A-Za-z0-9+/]/g, ''), 'base64'));
  // 真实记录数 = decodeInto 的返回值 / 11。
  // 不能用 Header W*H：单元包按 [Map] Size 的菱形 (2W-1)*H 存（40x40 ⇒ 3160 条），
  // 33x29 的 Header 只有 957，会漏掉 70% 记录不重映射。
  const big = new Uint8Array(1 << 20);
  const n = decodeInto(lzo, big);
  if (!(n > 0)) return null;
  return { out: big.subarray(0, n), cells: Math.floor(n / 11) };
}

/** 把单元内嵌 [Map] Theater= 改写成目标 theater（否则 FA2/检测按温带解读）。 */
function rewriteTheater(text, theater) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(l => l.trim() === '[Map]');
  if (start < 0) return text;
  for (let i = start + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('[')) break;
    if (/^Theater\s*=/i.test(t)) {
      lines[i] = `Theater=${theater}`;
      break;
    }
  }
  return lines.join('\r\n');
}

function replaceIsoSection(text, newB64) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(l => l.trim() === '[IsoMapPack5]');
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length && !lines[end].trim().startsWith('[')) end += 1;
  const chunks = [];
  for (let i = 0; i < newB64.length; i += 70) chunks.push(`${i / 70 + 1}=${newB64.slice(i, i + 70)}`);
  return [...lines.slice(0, start + 1), ...chunks, ...lines.slice(end)].join('\r\n');
}

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.toLowerCase().endsWith('.map') && !SKIP.has(e.name)) files.push(p);
  }
})(path.join(UNITS, SOURCE));

console.log(`TEMP ${temp.total} tiles / SNOW ${snow.total} tiles`);
let total = 0;
let changed = 0;
const notes = new Map();
const written = [];

for (const srcFile of files) {
  const text = fs.readFileSync(srcFile, 'utf8');
  const dec = decodeIso(text);
  if (!dec) {
    console.log(`skip ${path.basename(srcFile)}`);
    continue;
  }
  const { out } = dec;
  let fileChanged = 0;
  const affected = [];
  for (let i = 0; i + 11 <= out.length; i += 11) {
    const tileNum = out[i + 4] | (out[i + 5] << 8);
    if (tileNum === 0xffff) continue; // 菱形外的空格子哨兵，保持不动
    if (tileNum === 0) continue; // set 0 走恒等，跳过只为统计干净
    total += 1;
    const m = mapTile(tileNum);
    notes.set(m.note, (notes.get(m.note) || 0) + 1);
    if (m.note.startsWith('water-clone-')) {
      affected.push({
        i,
        set: m.note.slice('water-clone-'.length),
        rx: out[i] | (out[i + 1] << 8),
        ry: out[i + 2] | (out[i + 3] << 8),
        z: out[i + 9],
      });
      continue;
    }
    if (m.out !== tileNum) {
      out[i + 4] = m.out & 0xff;
      out[i + 5] = (m.out >>> 8) & 0xff;
      fileChanged += 1;
      changed += 1;
    }
  }
  if (affected.length) {
    const { cloned, defaulted, failed } = cloneFromWater(out, affected);
    changed += cloned;
    fileChanged += cloned;
    notes.set('water-clone-done', (notes.get('water-clone-done') || 0) + cloned);
    if (defaulted) notes.set('water-clone-defaulted', (notes.get('water-clone-defaulted') || 0) + defaulted);
    if (failed) notes.set('water-clone-FAILED', (notes.get('water-clone-FAILED') || 0) + failed);
  }
  if (!APPLY) continue;
  const enc = encode(out, 5);
  const b64 = Buffer.from(enc).toString('base64');
  const newText = rewriteTheater(replaceIsoSection(text, b64), targetTheater);
  if (!newText) {
    console.log(`no IsoMapPack5 in ${path.basename(srcFile)}`);
    continue;
  }
  const rel = path.relative(path.join(UNITS, SOURCE), srcFile);
  const dst = path.join(UNITS, TARGET, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, newText, 'utf8');
  written.push(rel);
  if (fileChanged) console.log(`  ${rel}: ${fileChanged} tiles remapped`);
}

console.log(`\n${files.length} files / ${total} tiles / ${changed} remapped`);
console.log('\n映射命中：');
for (const [k, v] of [...notes.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(6)}  ${k}`);
}
if (APPLY) console.log(`\n写入 ${written.length} 个文件到 ${TARGET}`);
