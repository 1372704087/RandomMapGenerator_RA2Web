/**
 * 探针 v4：管线级追踪 —— `waterBasic` 结束有 22981 格水，
 * 但最终输出只有 5731。定位是哪个阶段清掉的。
 *
 * 逐阶段统计 water 格数（tile ∈ [waterSet, waterSet+13]）。
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

const sed = loadSed(fs.readFileSync('F:/YTLauncher/RandMap.Sed').toString('latin1'));
const dims = deriveDimensions(sed);
const input = {
  seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
  numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
  tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
  theater: sed.theater, dimensions: dims, tables,
};

const st = P.generateWaterStage(input);
const ctx = st.ctx;
const snap = (tag) => {
  let w = 0, clear = 0, other = 0;
  for (const cell of ctx.cells.iterate()) {
    const t = cell.tile;
    if (t >= LO && t <= HI) w += 1;
    else if (t === 0) clear += 1;
    else other += 1;
  }
  console.log(tag.padEnd(26) + ' water=' + String(w).padEnd(6) +
    ' clear=' + String(clear).padEnd(6) + ' other=' + String(other).padEnd(6) +
    '   水占比=' + (w / (w + clear + other) * 100).toFixed(1) + '%');
  return w;
};

console.log('=== 管线各阶段 water 追踪（mapType=1, 真机最终 49.4%）===');
const rows = [];
rows.push(['generateWaterStage 后', snap('generateWaterStage 后')]);

// 逐个跑后续阶段（顺序按 pipeline.ts）
const stages = [
  ['runRegionStage', () => P.runRegionStage(st)],
  ['runPlateauStage', () => P.runPlateauStage(st)],
  ['runBridgeStage', () => P.runBridgeStage(st)],
  ['runCliffStage', () => P.runCliffStage(st)],
  ['runBridgeRampStage', () => P.runBridgeRampStage(st)],
  ['runRecalcStage', () => P.runRecalcStage(st)],
  ['runHillsStage', () => P.runHillsStage(st)],
];
for (const [name, fn] of stages) {
  let w = -1;
  try { fn(); } catch (e) { console.log('  (' + name + ' 抛异常: ' + String(e).slice(0, 60) + ')'); }
  try { w = snap(name); } catch (e) { console.log('  (snap 失败)'); }
  rows.push([name, w]);
}

// 找到输出
try {
  const { ini } = P.generateFullMap(input, 'Random Map');
  const sec = new IniFile(ini).GetSection('IsoMapPack5');
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
  let w = 0, n = 0;
  for (let o = 0; o + 11 <= buf.length - 4; o += 11) {
    const x = buf.readInt16LE(o); const y = buf.readInt16LE(o + 2);
    const ti = buf.readInt32LE(o + 4);
    if (x === 0 && y === 0 && ti === 0) break;
    n += 1;
    if (ti >= LO && ti <= HI) w += 1;
  }
  console.log('generateFullMap 输出      water=' + w + '/' + n + ' = ' +
    (w / n * 100).toFixed(1) + '%');
} catch (e) {
  console.log('generateFullMap 失败: ' + String(e).slice(0, 80));
}

console.log('');
console.log('=== 水量变化点 ===');
let prev = rows[0][1];
for (let i = 1; i < rows.length; i++) {
  const [name, w] = rows[i];
  if (w >= 0 && prev >= 0 && w !== prev) {
    console.log('  ' + name.padEnd(26) + prev + ' → ' + w + '  (' + (w - prev) + ')');
  }
  if (w >= 0) prev = w;
}
