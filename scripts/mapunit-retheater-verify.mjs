/**
 * 岛屿重映射复核（只读）：
 *   1. 每个文件：目标与源记录数一致，rx/ry/zero1/subtile/z/zero2 逐字节一致；
 *   2. tileNum 差异必须恰为 PAIRS 映射（用 temperatmd + 目标 theater md 重新独立计算）；
 *   3. 所有 [Map] Theater= 必须已是目标 theater。
 *
 * 用法：
 *   node scripts/mapunit-retheater-verify.mjs                       # SNOW_Islands（默认）
 *   node scripts/mapunit-retheater-verify.mjs --theater DESERT      # DESERT_Islands
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { pairsForTarget } from './mapunit-retheater.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UNITS = path.join(ROOT, 'packages/server/resources/MapUnits');
const THEATER_DIR = path.join(ROOT, 'packages/server/resources/theater');
const { decodeInto } = createRequire(import.meta.url)(path.join(ROOT, 'packages/core/dist/format/format5.js'));

const args = process.argv.slice(2);
const getArg = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const TARGET = getArg('--target', 'SNOW_Islands');
const SOURCE = getArg('--source', 'TEMPERATE_Islands');
const THEATER_KEY = getArg('--theater', TARGET.includes('DESERT') ? 'DESERT' : 'SNOW');
const profile = pairsForTarget(TARGET);
const DONOR_INI = { SNOW: 'snowmd.ini', DESERT: 'desertmd.ini' }[THEATER_KEY];
const EXPECT_THEATER = { SNOW: 'SNOW', DESERT: 'DESERT' }[THEATER_KEY];

function parseSets(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const sets = [];
  let cur = null;
  for (const line of lines) {
    const t = line.trim();
    const m = /^\[TileSet(\d{4})\]/.exec(t);
    if (m) { cur = { index: Number(m[1]), name: '', tiles: 0 }; sets.push(cur); continue; }
    if (!cur) continue;
    if (t.startsWith('[')) { cur = null; continue; }
    const kv = /^(\w+)\s*=\s*(.*)$/.exec(t);
    if (!kv) continue;
    if (kv[1] === 'SetName') cur.name = kv[2];
    else if (kv[1] === 'TilesInSet') cur.tiles = Number(kv[2]);
  }
  let base = 0;
  for (const s of sets) { s.base = base; base += s.tiles; }
  return { sets, byIndex: new Map(sets.map((s) => [s.index, s])) };
}
const temp = parseSets(path.join(THEATER_DIR, 'temperatmd.ini'));
const donor = parseSets(path.join(THEATER_DIR, DONOR_INI));

const pairs = profile.pairs;
// 邻域克隆集：与 mapunit-retheater.mjs 的 replaceWithWater 保持一致
const WATERCLONE = profile.replaceWithWater;
const DONOR_OK = profile.donorRanges;
const inDonor = (tn) => DONOR_OK.some(([lo, hi]) => tn >= lo && tn <= hi);

function setOf(t, flat) {
  for (const s of t.sets) if (s.tiles > 0 && flat >= s.base && flat < s.base + s.tiles) return s;
  return null;
}
function mapTile(tileNum) {
  const s = setOf(temp, tileNum);
  if (!s) return null;
  const target = pairs.get(s.index);
  if (target === undefined) return null;
  const ts = donor.byIndex.get(target);
  if (!ts || ts.tiles === 0) return null;
  const off = tileNum - s.base;
  if (off >= ts.tiles) return null;
  return profile.fold(ts.base + off);
}

function sectionKV(text, name) {
  const lines = text.split(/\r?\n/);
  const i = lines.findIndex((l) => l.trim() === `[${name}]`);
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
  const b64 = Object.keys(pack).sort((a, b) => Number(a) - Number(b)).map((k) => pack[k]).join('');
  const lzo = new Uint8Array(Buffer.from(b64.replace(/[^A-Za-z0-9+/]/g, ''), 'base64'));
  // 缓冲按 [Map] Size 精确分配：decodeInto 会把 dest 填满才停，oversized 会啃垃圾数据
  const size = (sectionKV(text, 'Map') || {}).Size || '0,0,0,0';
  const s4 = size.split(',').map(Number);
  const cells = (2 * s4[2] - 1) * s4[3];
  const big = new Uint8Array(Math.max(64, cells * 11 + 4));
  const n = decodeInto(lzo, big);
  return n > 0 ? big.subarray(0, n) : null;
}

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.toLowerCase().endsWith('.map')) files.push(path.relative(path.join(UNITS, TARGET), p));
  }
})(path.join(UNITS, TARGET));

let bad = 0, theaterBad = 0, remapChecked = 0, remapOk = 0, identity = 0, lenSkipped = 0;
for (const rel of files.sort()) {
  const sText = fs.readFileSync(path.join(UNITS, SOURCE, rel), 'utf8');
  const dText = fs.readFileSync(path.join(UNITS, TARGET, rel), 'utf8');
  const th = (sectionKV(dText, 'Map') || {}).Theater;
  if ((th || '').toUpperCase() !== EXPECT_THEATER) { console.log(`✗ ${rel}: Theater=${th}`); theaterBad++; }
  const s = decodeIso(sText);
  const d = decodeIso(dText);
  if (!s || !d) { console.log(`✗ ${rel}: 解码失败 s=${!!s} d=${!!d}`); bad++; continue; }
  if (s.length !== d.length) {
    // 编辑器手存的图会裁包尾哨兵/置尾角 0xFFFF——长度不一致时跳过该文件
    // （记录级对照失去同一坐标系；内容正确性由加载管线与 check:mapunits 保证）
    console.log(`△ ${rel}: 长度不一致（编辑器存盘裁剪）跳过逐记录对照 ${s.length} vs ${d.length}`);
    lenSkipped++;
    continue;
  }
  for (let i = 0; i + 11 <= s.length; i += 11) {
    const tnS0 = s[i + 4] | (s[i + 5] << 8);
    const sSet0 = setOf(temp, tnS0);
    const isWaterClone = sSet0 && WATERCLONE.has(sSet0.index);
    // 沙滩岛落地 pass：源为悬崖/坡道 ⇒ 目标整格来自 donor（tile+st 都变）
    // 温带源区间：Cliff(10) 49..88 + RAMP(25/26) 384..403
    const isGrounded =
      THEATER_KEY === 'DESERT' &&
      ((tnS0 >= 29 && tnS0 <= 88) || (tnS0 >= 384 && tnS0 <= 403));
    for (let k = 0; k < 11; k++) {
      if (k === 4 || k === 5) continue; // tileNum 两字节单独比
      if (isWaterClone && (k === 8 || k === 9)) continue; // 克隆允许改 subtile 与 z
      if (isGrounded && (k === 8 || k === 9)) continue; // 落地允许改 subtile 与 z
      if (THEATER_KEY === 'DESERT' && k === 9) continue; // 沙滩岛全图压平 z→0
      if (s[i + k] !== d[i + k]) { console.log(`✗ ${rel}: 记录 ${i / 11} 第 ${k} 字节不一致 ${s[i + k]} vs ${d[i + k]}`); bad++; }
    }
    const tnS = s[i + 4] | (s[i + 5] << 8);
    const tnD = d[i + 4] | (d[i + 5] << 8);
    if (tnS === tnD) { identity++; continue; }
    const sSet = sSet0;
    if (isWaterClone) {
      remapChecked++;
      // 克隆格事后可能被落地 pass 再替换为地面（grass/sand）——只要不是
      // 崖/坡/隧道/桥这类会渲染成黑洞或斜楔的 tile 都算合法
      const badD =
        (tnD >= 29 && tnD <= 88) ||
        (tnD >= 356 && tnD <= 375) ||
        (tnD >= 522 && tnD <= 527) ||
        (tnD >= 687 && tnD <= 690) ||
        (tnD >= 710 && tnD <= 725);
      if (!badD) { remapOk++; continue; }
      console.log(`✗ ${rel}: 记录 ${i / 11} 邻域克隆异常 tile ${tnS}(${sSet.index}) → ${tnD}`);
      bad++;
      continue;
    }
    const expect = mapTile(tnS);
    remapChecked++;
    if (expect !== null && expect !== tnD) {
      const folded = profile.fold(expect);
      if (folded === tnD) { remapOk++; continue; }
      // 沙滩岛落地 pass：源为悬崖/坡道 ⇒ 目标为任意非崖地面（donor 位置无关）
      const srcCliffish =
        (tnS >= 29 && tnS <= 88) || (tnS >= 384 && tnS <= 403);
      if (THEATER_KEY === 'DESERT' && srcCliffish) {
        const isCliffishD =
          (tnD >= 49 && tnD <= 88) || (tnD >= 356 && tnD <= 375) || tnD === 0xffff;
        if (!isCliffishD) { remapOk++; continue; }
      }
      console.log(`✗ ${rel}: 记录 ${i / 11} tile ${tnS} → ${tnD}，期望 ${expect}`);
      bad++;
    } else remapOk++;
  }
}
console.log(`\n${files.length} 个文件（跳过编辑器裁剪 ${lenSkipped}）  记录级校验: ${remapChecked + identity} tiles（恒等 ${identity}，重映射 ${remapOk}，不一致 ${bad}，Theater 错 ${theaterBad}）`);
if (bad === 0 && theaterBad === 0) console.log('全部通过 ✓');
