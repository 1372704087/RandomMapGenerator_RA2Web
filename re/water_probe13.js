/**
 * 探针 v13（可信）：按 **原始 (dx,dy)** 对比真机与我们 IsoMapPack5。
 *
 * ⚠ 前面的 v9 出错原因是拿 cellAt 的键去比；
 *    本版用 IsoMapPack5 的**原生坐标 (dx,dy)** 做 key —— 无歧义。
 *
 * 已确定的事实：
 *   - emit 的双重循环（dx<2W-1, dy<2H）产生 34720 次 push，
 *     但 IsoMapPack5 只写 23184 条 ⇒ 序列化层有去重
 *   - cell 网格 water=11409，输出 water=10289，差 1120
 *   - 每格被 push 约 2 次（同一 (rx,ry) 由 (dx,dy) 与 (dx+1,dy-1) 命中）
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const fs = require('fs');
const P = require(B + '/dist/rmg/pipeline.js');
const { parseTheaterIni } = require(B + '/dist/rmg/theater.js');
const { loadSed } = require(B + '/dist/rmg/sed.js');
const { deriveDimensions } = require(B + '/dist/rmg/options.js');
const { IniFile } = require(B + '/dist/io/iniFile.js');
const { decompressRange } = require(B + '/dist/format/minilzo.js');

const tables = parseTheaterIni(
  fs.readFileSync('G:/ra2-web-mapgen/packages/server/resources/theater/temperatmd.ini', 'utf8'), 'TEMPERATE');
const LO = tables.waterSet, HI = tables.waterSet + 13;
const isWater = (v) => v >= LO && v <= HI;

function readIso(path) {
  const sec = new IniFile(fs.readFileSync(path, 'latin1')).GetSection('IsoMapPack5');
  const keys = sec.Keys.slice().sort((a, b) => Number(a) - Number(b));
  const raw = Buffer.from(keys.map((k) => sec.GetStringValue(k, '')).join(''), 'base64');
  let r = 0; const parts = [];
  while (r + 4 <= raw.length) {
    const si = raw.readUInt16LE(r); const so = raw.readUInt16LE(r + 2);
    if (!si || !so) break; r += 4;
    const o = new Uint8Array(so + 1024);
    decompressRange(new Uint8Array(raw), r, si, o, 0);
    parts.push(Buffer.from(o.slice(0, so))); r += si;
  }
  const buf = Buffer.concat(parts);
  const map = new Map();
  const dupKeys = new Map();
  for (let o = 0; o + 11 <= buf.length - 4; o += 11) {
    const dx = buf.readInt16LE(o); const dy = buf.readInt16LE(o + 2);
    const ti = buf.readInt32LE(o + 4);
    if (dx === 0 && dy === 0 && ti === 0) break;
    const k = dx + ',' + dy;
    if (map.has(k)) dupKeys.set(k, (dupKeys.get(k) || 1) + 1);
    map.set(k, { ti, sub: buf[o + 8], lvl: buf[o + 9] });
  }
  return { map, dupKeys, total: map.size };
}

const real = readIso('F:/YTLauncher/RandMap.Map');

const sed = loadSed(fs.readFileSync('F:/YTLauncher/RandMap.Sed').toString('latin1'));
const dims = deriveDimensions(sed);
const { ini } = P.generateFullMap({
  seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
  numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
  tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
  theater: sed.theater, dimensions: dims, tables,
}, 'Random Map');
const secO = new IniFile(ini).GetSection('IsoMapPack5');
const kO = secO.Keys.slice().sort((a, b) => Number(a) - Number(b));
const rawO = Buffer.from(kO.map((k) => secO.GetStringValue(k, '')).join(''), 'base64');
let rO = 0; const pO = [];
while (rO + 4 <= rawO.length) {
  const si = rawO.readUInt16LE(rO); const so = rawO.readUInt16LE(rO + 2);
  if (!si || !so) break; rO += 4;
  const o = new Uint8Array(so + 1024);
  decompressRange(new Uint8Array(rawO), rO, si, o, 0);
  pO.push(Buffer.from(o.slice(0, so))); rO += si;
}
const bufO = Buffer.concat(pO);
const ours = new Map();
const oursDup = new Map();
for (let o = 0; o + 11 <= bufO.length - 4; o += 11) {
  const dx = bufO.readInt16LE(o); const dy = bufO.readInt16LE(o + 2);
  const ti = bufO.readInt32LE(o + 4);
  if (dx === 0 && dy === 0 && ti === 0) break;
  const k = dx + ',' + dy;
  if (ours.has(k)) oursDup.set(k, (oursDup.get(k) || 1) + 1);
  ours.set(k, { ti, sub: bufO[o + 8], lvl: bufO[o + 9] });
}

let wReal = 0; for (const v of real.map.values()) if (isWater(v.ti)) wReal += 1;
let wOurs = 0; for (const v of ours.values()) if (isWater(v.ti)) wOurs += 1;

console.log('=== (dx,dy) 集合对比 ===');
console.log('真机 格数 = ' + real.total + '   水 = ' + wReal +
  ' (' + (wReal / real.total * 100).toFixed(1) + '%)');
console.log('我们 格数 = ' + ours.size + '   水 = ' + wOurs +
  ' (' + (wOurs / ours.size * 100).toFixed(1) + '%)');
console.log('真机 (dx,dy) 重复 = ' + real.dupKeys.size + '   我们 = ' + oursDup.size);
console.log('');
const common = [];
for (const k of real.map.keys()) if (ours.has(k)) common.push(k);
console.log('共有 (dx,dy) = ' + common.length);
const onlyReal = [...real.map.keys()].filter((k) => !ours.has(k)).length;
const onlyOurs = [...ours.keys()].filter((k) => !real.map.keys().has ? false : !real.map.has(k)).length;
console.log('只有真机有 = ' + onlyReal + '   只有我们有 = ' + onlyOurs);
console.log('');
let bothW = 0, realWOnly = 0, oursWOnly = 0, same = 0;
const wSamples = [];
for (const k of common) {
  const a = real.map.get(k); const b = ours.get(k);
  const aw = isWater(a.ti); const bw = isWater(b.ti);
  if (aw && bw) bothW++;
  else if (aw && !bw) { realWOnly++; if (wSamples.length < 6) wSamples.push('真机水→我们' + b.ti + ' @' + k); }
  else if (!aw && bw) oursWOnly++;
  if (a.ti === b.ti) same++;
}
console.log('=== 共有格上的水分布 ===');
console.log('  都是水 = ' + bothW);
console.log('  真机水 / 我们不是 = ' + realWOnly + '   ★');
console.log('  我们水 / 真机不是 = ' + oursWOnly);
console.log('  tile 完全相同 = ' + same + ' / ' + common.length +
  ' (' + (same / common.length * 100).toFixed(1) + '%)');
if (wSamples.length) { console.log('  样本:'); wSamples.forEach((s) => console.log('    ' + s)); }