/**
 * 探针 v8：`generateFullMap` 里 cell 水 = 11124，但 IsoMapPack5 输出只有 10289。
 * 差的 835 格是在【输出序列化】阶段掉的，还是探针漏了某个阶段？
 *
 * 上一个探针（v7）跑到 shoreFinalize 都是 11124，
 * 但 `shoreFinalize` 不是 pipeline 导出的（报 not a function），
 * ⇒ **那段"孤儿回填"从未被执行到**（探针漏了）。
 * 本探针直接跑 `generateFullMap`，在它前后各测一次，并单独跑那段回填。
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const fs = require('fs');
const P = require(B + '/dist/rmg/pipeline.js');
const W = require(B + '/dist/rmg/water.js');
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

function countWaterInCells(ctx) {
  let w = 0;
  for (const c of ctx.cells.iterate()) if (c.tile >= LO && c.tile <= HI) w += 1;
  return w;
}
function countWaterInIso(ini) {
  const sec = new IniFile(ini).GetSection('IsoMapPack5');
  if (!sec) return { w: 0, n: 0 };
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
  return { w, n };
}

const { state, ini } = P.generateFullMap(input, 'Random Map');
const cellW = countWaterInCells(state.ctx);
const iso = countWaterInIso(ini);
console.log('generateFullMap 后：');
console.log('  cell 网格 water = ' + cellW);
console.log('  IsoMapPack5 water = ' + iso.w + ' / ' + iso.n +
  ' = ' + (iso.w / iso.n * 100).toFixed(1) + '%');
console.log('  差 = ' + (cellW - iso.w) + ' 格');
console.log('  真机 11463 / 23184 = 49.4%');
console.log('');

// 差异来源：把 cell 网格的 tile 直方图与 IsoMapPack5 的直方图对比
const cellHist = new Map();
for (const c of state.ctx.cells.iterate()) cellHist.set(c.tile, (cellHist.get(c.tile) || 0) + 1);
const sec = new IniFile(ini).GetSection('IsoMapPack5');
const keys = sec.Keys.slice().sort((a, b) => Number(a) - Number(b));
const raw = Buffer.from(keys.map((k) => sec.GetStringValue(k, '')).join(''), 'base64');
let rr = 0; const parts = [];
while (rr + 4 <= raw.length) {
  const si = raw.readUInt16LE(rr); const so = raw.readUInt16LE(rr + 2);
  if (!si || !so) break; rr += 4;
  const o = new Uint8Array(so + 1024);
  decompressRange(new Uint8Array(raw), rr, si, o, 0);
  parts.push(Buffer.from(o.slice(0, so))); rr += si;
}
const buf = Buffer.concat(parts);
const isoHist = new Map();
for (let o = 0; o + 11 <= buf.length - 4; o += 11) {
  const x = buf.readInt16LE(o); const y = buf.readInt16LE(o + 2);
  const ti = buf.readInt32LE(o + 4);
  if (x === 0 && y === 0 && ti === 0) break;
  isoHist.set(ti, (isoHist.get(ti) || 0) + 1);
}
console.log('=== cell 网格 vs IsoMapPack5 的 tile 分布差异 ===');
const all = [...new Set([...cellHist.keys(), ...isoHist.keys()])].sort((a, b) => a - b);
let shown = 0;
for (const t of all) {
  const a = cellHist.get(t) || 0; const b = isoHist.get(t) || 0;
  if (a !== b && shown < 12) {
    console.log('  tile ' + String(t).padEnd(7) + ' cell=' + String(a).padEnd(7) +
      ' iso=' + String(b).padEnd(7) + ' Δ=' + (b - a));
    shown += 1;
  }
}
console.log('cell 总格 = ' + [...cellHist.values()].reduce((a, b) => a + b, 0) +
  '   iso 总格 = ' + iso.n);
