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

/**
 * 目标 theater 的重映射配置。
 *
 * SNOW：温/雪 set 0..30 的 TilesInSet 一致（恒等段），31 起雪地插入 Ice 系列
 *       整体错位 ⇒ 按「同一套美术」手工配对（已用 cncmaps 源码核对扁平索引语义）。
 * DESERT：set 结构与温带完全同构（同名同 TilesInSet），只是 15 个水景装饰集为空
 *       （WCliff/瀑布/水洞/残骸）⇒ 全恒等；WCliff（岛屿入水悬崖）映射到普通
 *       Cliff Set，空集内容走水面克隆。
 */
const PROFILES = {
  SNOW: {
    donorIni: 'snowmd.ini',
    // 温带 set → 雪地 set（0..30 恒等 + 31 起错位配对）
    pairs: new Map([
      ...[
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
        24, 25, 26, 27, 28, 29, 30,
      ].map((i) => [i, i]),
      [33, 62], [34, 63], [35, 40], [36, 38], [37, 39], [38, 69], [39, 70], [40, 71],
      [41, 64], [42, 65], [43, 41], [44, 42], [45, 43], [46, 68], [47, 44], [48, 45],
      [49, 54], [50, 55], [51, 56], [52, 46], [53, 47], [54, 48], [55, 49], [56, 61],
      [57, 37], [58, 50], [59, 51], [60, 52], [61, 53], [62, 54], [63, 55], [64, 56],
      [65, 57], [66, 58], [67, 58], [68, 59], [69, 60], [70, 70], [72, 66], [73, 67],
      [74, 62], [75, 65], [76, 72], [77, 40], [78, 67], [79, 67], [80, 73], [81, 60],
    ]),
    // 雪地无对应美术（多格大块/零售 MIX 缺贴图）→ 邻域克隆：57 水洞、81 沉船、
    // 49/50/51/62/65 瀑布系（仅 cannotplacesmudge 用到，防御性）
    replaceWithWater: new Set([57, 81, 49, 50, 51, 62, 65]),
    waterfallCloneSets: new Set([49, 50, 51, 62, 65]),
    // 邻域克隆的 donor 扁平范围（温雪同构恒等段）
    donorRanges: [
      [314, 327], // set 21 Water
      [148, 175], // set 15 Cliff/Water pieces
      [49, 88], // set 10 Cliff Set
      [89, 130], // set 12 Shore Pieces
    ],
    waterRange: [314, 327], // set 21 Water
    deepWater: { tn: 318, st: 2, z: 0 },
    fold: (tn) => tn,
  },
  DESERT: {
    donorIni: 'desertmd.ini',
    // 沙漠 set 结构与温带同构（同名同数），全恒等；唯一例外：
    // set 15 Cliff/Water pieces（岛屿入水悬崖，n=28）沙漠为空集
    // ⇒ 映射到普通 Cliff Set（10，n=40，偏移保持）——沙漠版岛屿水线呈岩崖入海。
    pairs: new Map(
      Array.from({ length: 82 }, (_, i) => [i, i]).map(([i]) => [i, i === 15 ? 10 : i]),
    ),
    // 沙漠空集（无对应美术）→ 水面克隆：Waterfalls A-D、Water Caves、
    // ZMM Waterfalls/WaterCaves、RA2 rubble、uss arizona
    replaceWithWater: new Set([15, 30, 49, 50, 51, 57, 62, 63, 64, 65, 66, 67, 77, 78, 79, 81]),
    waterfallCloneSets: new Set([15, 49, 50, 51, 62, 63, 64, 65, 66, 67]),
    // donor 扁平范围（沙漠版恒等段；注意 set 15 空集使 16+ 的 base 前移）
    donorRanges: [
      [286, 299], // set 21 Water
      [49, 88], // set 10 Cliff Set
      [89, 130], // set 12 Shore Pieces
    ],
    waterRange: [286, 299], // set 21 Water
    deepWater: { tn: 290, st: 2, z: 0 },
    // 沙漠 Cliff Set 的 piece 22..27 无对应 subtile 美术（trace 实证：
    // 该区间格全部不绘制）⇒ 折叠到 16..21（tn 71..76 → 65..70）
    fold: (tn) => (tn >= 71 && tn <= 76 ? tn - 6 : tn),
  },
};

const PROFILE_KEY = getArg('--theater', TARGET.includes('DESERT') ? 'DESERT' : 'SNOW');
const profile = PROFILES[PROFILE_KEY];
if (!profile) {
  console.error(`未知 --theater ${PROFILE_KEY}（可选：${Object.keys(PROFILES).join('/')}）`);
  process.exit(1);
}
const donor = parseSets(path.join(THEATER_DIR, profile.donorIni));

const targetTheater =
  sectionKV(fs.readFileSync(path.join(UNITS, TARGET, 'settings.ini'), 'utf8'), 'settings')?.Theater || PROFILE_KEY;

const PAIRS = profile.pairs;
/**
 * 目标 theater 没有对应美术、又不能按 tile 平移解决的 set（多格大块美术 /
 * 零售 MIX 缺贴图）→ 邻域克隆 (tileNum,subtile,z)，优先级：
 *   ① 同 z 水面 ② 同 z 悬崖系（保持崖线连续）③ 文件内水面众数。
 * 注意：岩拱格若直接落回 z=0 水面，身后高台地会失去立面过渡 → 渲染黑洞。
 */
const REPLACE_WITH_WATER = profile.replaceWithWater;
// donor 候选的扁平范围（目标 theater 里恒等/可用的立面集合）
const DONOR_RANGES = profile.donorRanges;
const isDonorTile = (tn) => DONOR_RANGES.some(([lo, hi]) => tn >= lo && tn <= hi);
const WATERFALL_CLONE_SETS = profile.waterfallCloneSets;
const WATER_TILE_RANGE = profile.waterRange;
const DEEP_WATER = profile.deepWater;

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
  const ts = donor.byIndex.get(target);
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
  const isWater = (r) => r && r.tn >= WATER_TILE_RANGE[0] && r.tn <= WATER_TILE_RANGE[1];
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
  if (!donor2) donor2 = { ...DEEP_WATER }; // 全局默认：深水
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

// 被 mapunit-retheater-verify.mjs 以模块方式 import 时跳过执行体
export function pairsForTarget(target) {
  return PROFILES[target.includes('DESERT') ? 'DESERT' : 'SNOW'];
}
const IS_MAIN = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.toLowerCase().endsWith('.map') && !SKIP.has(e.name)) files.push(p);
  }
})(path.join(UNITS, SOURCE));

console.log(`TEMP ${temp.total} tiles / ${PROFILE_KEY} ${donor.total} tiles`);
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
  // DESERT 沙滩岛：全图压平到水面（z→0）。沙漠 theater 没有"崖入水"美术，
  // 高台地与水面的交界必然黑面 ⇒ 岛屿整体落回海平面，水线用 Shore Pieces。
  if (PROFILE_KEY === 'DESERT') {
    for (let i = 0; i + 11 <= out.length; i += 11) out[i + 9] = 0;
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

// 目标 theater 的 fold 修正（DESERT：Cliff piece 22..27 无 subtile 美术 → 折叠 16..21）
if (PROFILE_KEY === 'DESERT') {
  let folded = 0;
  let grounded = 0;
  for (const rel of written) {
    const p = path.join(UNITS, TARGET, rel);
    const t = fs.readFileSync(p, 'utf8');
    const pack = sectionKV(t, 'IsoMapPack5');
    if (!pack) continue;
    const b64 = Object.keys(pack).sort((a, b) => Number(a) - Number(b)).map((k) => pack[k]).join('');
    const lzo = new Uint8Array(Buffer.from(b64.replace(/[^A-Za-z0-9+/]/g, ''), 'base64'));
    const size = (sectionKV(t, 'Map') || {}).Size || '0,0,0,0';
    const s4 = size.split(',').map(Number);
    const cells = (2 * s4[2] - 1) * s4[3];
    const big = new Uint8Array(cells * 11 + 4);
    const n = decodeInto(lzo, big);
    let fc = 0;
    for (let i = 0; i + 11 <= n; i += 11) {
      const tn = big[i + 4] | (big[i + 5] << 8);
      if (tn === 0xffff) continue;
      const f = profile.fold(tn);
      if (f !== tn) {
        big[i + 4] = f & 0xff;
        big[i + 5] = (f >>> 8) & 0xff;
        fc++;
      }
    }
    if (fc) {
      fs.writeFileSync(p, replaceIsoSection(t, Buffer.from(encode(big.subarray(0, n), 5)).toString('base64')), 'utf8');
      folded += fc;
    }

    // 悬崖/坡道格压平后无意义（崖壁立面在平地上渲染为黑色斜带）→
    // 向北（岛内）找最近的非崖/坡/水地面 tile 覆盖；北侧是水则向南找。
    const posIdx = new Map();
    for (let i = 0; i + 11 <= n; i += 11) {
      const rx = big[i] | (big[i + 1] << 8), ry = big[i + 2] | (big[i + 3] << 8);
      posIdx.set(`${rx},${ry}`, i);
    }
    const isCliffish = (tn) =>
      (tn >= 29 && tn <= 88) || (tn >= 356 && tn <= 375) || tn === 0xffff;
    const isWater = (tn) => tn >= 286 && tn <= 299;
    for (let i = 0; i + 11 <= n; i += 11) {
      const rx = big[i] | (big[i + 1] << 8), ry = big[i + 2] | (big[i + 3] << 8);
      const tn = big[i + 4] | (big[i + 5] << 8);
      if (!isCliffish(tn) || tn === 0xffff) continue;
      let donor = null;
      for (const dir of [-1, 1]) {
        for (let k = 1; k <= 40 && !donor; k++) {
          const c = posIdx.get(`${rx},${ry + dir * k}`);
          if (c === undefined) break;
          const ntn = big[c + 4] | (big[c + 5] << 8);
          if (!isCliffish(ntn) && !isWater(ntn) && !(ntn >= 522 && ntn <= 527) && !(ntn >= 687 && ntn <= 690) && !(ntn >= 710 && ntn <= 725)) donor = c;
        }
        if (donor) break;
      }
      if (donor !== null) {
        big[i + 4] = big[donor + 4];
        big[i + 5] = big[donor + 5];
        big[i + 8] = big[donor + 8];
        grounded++;
      } else {
        big[i + 4] = 0;
        big[i + 5] = 0;
        big[i + 8] = 0;
        grounded++;
      }
    }
    if (grounded) {
      fs.writeFileSync(p, replaceIsoSection(t, Buffer.from(encode(big.subarray(0, n), 5)).toString('base64')), 'utf8');
    }
  }
  console.log(`  cliff fold(71..76 → 65..70): ${folded} tiles / 悬崖坡道落地: ${grounded} tiles`);
}

console.log(`\n${files.length} files / ${total} tiles / ${changed} remapped`);
console.log('\n映射命中：');
for (const [k, v] of [...notes.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(6)}  ${k}`);
}
if (APPLY) console.log(`\n写入 ${written.length} 个文件到 ${TARGET}`);
}
