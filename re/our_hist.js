/**
 * `our_hist.js` —— 打印「我们」输出的 tile 直方图（与 re/tile_hist.js 同口径）
 *
 * 用法: node re/our_hist.js <Sed>
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const fs = require('fs');
const { generateFullMap } = require(B + '/dist/rmg/pipeline.js');
const { deriveDimensions } = require(B + '/dist/rmg/options.js');
const { loadSed } = require(B + '/dist/rmg/sed.js');
const { parseTheaterIni } = require(B + '/dist/rmg/theater.js');
const { IniFile } = require(B + '/dist/io/iniFile.js');
const { decompressRange } = require(B + '/dist/format/minilzo.js');

const SED = process.argv[2];
const NAMES = ['TEMPERATE', 'DESERT', 'SNOW', 'URBAN', 'URBAN_NIGHT'];
const sed = loadSed(fs.readFileSync(SED).toString('latin1'));
const t = parseTheaterIni(
  fs.readFileSync('G:/ra2-web-mapgen/packages/server/resources/theater/temperatmd.ini', 'utf8'),
  NAMES[sed.theater] || 'TEMPERATE');
const dims = deriveDimensions(sed);
const { ini } = generateFullMap({
  seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
  numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
  tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
  theater: sed.theater, dimensions: dims, tables: t,
}, 'Random Map');

function readIso(iniText) {
  const i2 = new IniFile(iniText);
  const sec = i2.GetSection('IsoMapPack5');
  const keys = sec.Keys.slice().sort((a, b) => Number(a) - Number(b));
  const raw = Buffer.from(keys.map((k) => sec.GetStringValue(k, '')).join(''), 'base64');
  let r = 0; const parts = [];
  while (r + 4 <= raw.length) {
    const si = raw.readUInt16LE(r), so = raw.readUInt16LE(r + 2);
    if (!si || !so) break;
    r += 4;
    const o = new Uint8Array(so + 1024);
    decompressRange(new Uint8Array(raw), r, si, o, 0);
    parts.push(Buffer.from(o.slice(0, so)));
    r += si;
  }
  const buf = Buffer.concat(parts);
  const ts = [];
  for (let o = 0; o + 11 <= buf.length - 4; o += 11) {
    const dx = buf.readInt16LE(o), dy = buf.readInt16LE(o + 2), ti = buf.readInt32LE(o + 4);
    if (dx === 0 && dy === 0 && ti === 0) break;
    ts.push({ dx, dy, ti, sub: buf[o + 8], lvl: buf[o + 9] });
  }
  return ts;
}

const FAMS = [
  ['water', t.waterSet, 14],
  ['shore', t.shorePieces, 42],
  ['cliff', t.cliffSet, 40],
  ['ramp', t.rampBase, 19],
  ['cliffRamp', t.cliffRamps, 20],
  ['bridge', t.bridges, 16],
];
const ts = readIso(ini);
const famCount = {}; const famTiles = {};
for (const x of ts) {
  let fam = 'other';
  for (const [nm, base, len] of FAMS) if (x.ti >= base && x.ti < base + len) { fam = nm; break; }
  famCount[fam] = (famCount[fam] || 0) + 1;
  if (!famTiles[fam]) famTiles[fam] = new Map();
  famTiles[fam].set(x.ti, (famTiles[fam].get(x.ti) || 0) + 1);
}
console.log('=== 我们的输出 ' + SED + ' ===');
console.log('族计数: ' + JSON.stringify(famCount));
for (const [nm] of FAMS) {
  const m = famTiles[nm];
  if (!m) { console.log('  ' + nm + ': 无'); continue; }
  const ent = [...m.entries()].sort((a, b) => a[0] - b[0]);
  console.log('  ' + nm + '（' + ent.length + ' 种）: ' + ent.map(([ti, c]) => ti + ':' + c).join(' '));
}
const o = famTiles.other;
if (o) {
  const ent = [...o.entries()].sort((a, b) => b[1] - a[1]);
  console.log('  other（' + ent.length + ' 种，前 40）: ' + ent.slice(0, 40).map(([ti, c]) => ti + ':' + c).join(' '));
}