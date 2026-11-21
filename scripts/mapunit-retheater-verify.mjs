/**
 * SNOW_Islands 重映射复核（只读）：
 *   1. 每个文件：目标与源记录数一致，rx/ry/zero1/subtile/z/zero2 逐字节一致；
 *   2. tileNum 差异必须恰为 PAIRS 映射（用 temperatmd/snowmd 重新独立计算）；
 *   3. 所有 [Map] Theater= 必须已是 SNOW。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UNITS = path.join(ROOT, 'packages/server/resources/MapUnits');
const THEATER_DIR = path.join(ROOT, 'packages/server/resources/theater');
const { decodeInto } = createRequire(import.meta.url)(path.join(ROOT, 'packages/core/dist/format/format5.js'));

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
const snow = parseSets(path.join(THEATER_DIR, 'snowmd.ini'));

const src = fs.readFileSync(path.join(ROOT, 'scripts/mapunit-retheater.mjs'), 'utf8');
const pairs = new Map();
for (let i = 0; i <= 30; i++) pairs.set(i, i);
// 只在 PAIRS = new Map([ ... ]) 块内抽配对行，避免误吃 DONOR_RANGES 之类的数组
const pairBlock = /const PAIRS = new Map\(\[([\s\S]*?)\]\);/.exec(src);
const re = /\[(\d+),\s*(\d+)\],/g;
let m;
if (pairBlock) while ((m = re.exec(pairBlock[1]))) pairs.set(Number(m[1]), Number(m[2]));
// 邻域克隆集：与 island-retheater.mjs 的 REPLACE_WITH_WATER 保持一致
const WATERCLONE = new Set([57, 81, 49, 50, 51, 62, 65]);
const DONOR_OK = [[314, 327], [148, 175], [49, 88], [89, 130]];
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
  const ts = snow.byIndex.get(target);
  if (!ts || ts.tiles === 0) return null;
  const off = tileNum - s.base;
  if (off >= ts.tiles) return null;
  return ts.base + off;
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
  const big = new Uint8Array(1 << 20);
  const n = decodeInto(lzo, big);
  return n > 0 ? big.subarray(0, n) : null;
}

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.toLowerCase().endsWith('.map')) files.push(path.relative(path.join(UNITS, 'SNOW_Islands'), p));
  }
})(path.join(UNITS, 'SNOW_Islands'));

let bad = 0, theaterBad = 0, remapChecked = 0, remapOk = 0, identity = 0;
for (const rel of files.sort()) {
  const sText = fs.readFileSync(path.join(UNITS, 'TEMPERATE_Islands', rel), 'utf8');
  const dText = fs.readFileSync(path.join(UNITS, 'SNOW_Islands', rel), 'utf8');
  const th = (sectionKV(dText, 'Map') || {}).Theater;
  if ((th || '').toUpperCase() !== 'SNOW') { console.log(`✗ ${rel}: Theater=${th}`); theaterBad++; }
  const s = decodeIso(sText);
  const d = decodeIso(dText);
  if (!s || !d) { console.log(`✗ ${rel}: 解码失败 s=${!!s} d=${!!d}`); bad++; continue; }
  if (s.length !== d.length) { console.log(`✗ ${rel}: 长度不一致 ${s.length} vs ${d.length}`); bad++; continue; }
  for (let i = 0; i + 11 <= s.length; i += 11) {
    const tnS0 = s[i + 4] | (s[i + 5] << 8);
    const sSet0 = setOf(temp, tnS0);
    const isWaterClone = sSet0 && WATERCLONE.has(sSet0.index);
    for (let k = 0; k < 11; k++) {
      if (k === 4 || k === 5) continue; // tileNum 两字节单独比
      if (isWaterClone && (k === 8 || k === 9)) continue; // 水面克隆允许改 subtile 与 z（落回海平面）
      if (s[i + k] !== d[i + k]) { console.log(`✗ ${rel}: 记录 ${i / 11} 第 ${k} 字节不一致 ${s[i + k]} vs ${d[i + k]}`); bad++; }
    }
    const tnS = s[i + 4] | (s[i + 5] << 8);
    const tnD = d[i + 4] | (d[i + 5] << 8);
    if (tnS === tnD) { identity++; continue; }
    const sSet = sSet0;
    if (isWaterClone) {
      remapChecked++;
      if (inDonor(tnD)) { remapOk++; continue; }
      console.log(`✗ ${rel}: 记录 ${i / 11} 邻域克隆异常 tile ${tnS}(${sSet.index}) → ${tnD}`);
      bad++;
      continue;
    }
    const expect = mapTile(tnS);
    remapChecked++;
    if (expect === null || expect !== tnD) {
      console.log(`✗ ${rel}: 记录 ${i / 11} tile ${tnS} → ${tnD}，期望 ${expect}`);
      bad++;
    } else remapOk++;
  }
}
console.log(`\n${files.length} 个文件  记录级校验: ${remapChecked + identity} tiles（恒等 ${identity}，重映射 ${remapOk}，不一致 ${bad}，Theater 错 ${theaterBad}）`);
if (bad === 0 && theaterBad === 0) console.log('全部通过 ✓');
