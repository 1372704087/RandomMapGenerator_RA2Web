/**
 * `compare_baseline.js` —— 真机基线 vs 我们（同参数）的逐项对拍。
 *
 * 用法：node re/compare_baseline.js [Map] [Sed]
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const fs = require('fs');
const { generateFullMap } = require(B + '/dist/rmg/pipeline.js');
const { deriveDimensions } = require(B + '/dist/rmg/options.js');
const { loadSed } = require(B + '/dist/rmg/sed.js');
const { parseTheaterIni } = require(B + '/dist/rmg/theater.js');
const { IniFile } = require(B + '/dist/io/iniFile.js');
const { decompressRange } = require(B + '/dist/format/minilzo.js');

const MAP = process.argv[2] || 'F:/YTLauncher/RandMap.Map';
const SED = process.argv[3] || 'F:/YTLauncher/RandMap.Sed';
const NAMES = ['TEMPERATE', 'DESERT', 'SNOW', 'URBAN', 'URBAN_NIGHT'];

function readIso(iniText) {
  const ini = new IniFile(iniText);
  const sec = ini.GetSection('IsoMapPack5');
  if (!sec) return null;
  const keys = sec.Keys.slice().sort((a, b) => Number(a) - Number(b));
  const raw = Buffer.from(keys.map((k) => sec.GetStringValue(k, '')).join(''), 'base64');
  let r = 0;
  const parts = [];
  while (r + 4 <= raw.length) {
    const si = raw.readUInt16LE(r);
    const so = raw.readUInt16LE(r + 2);
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
    const dx = buf.readInt16LE(o);
    const dy = buf.readInt16LE(o + 2);
    const ti = buf.readInt32LE(o + 4);
    if (dx === 0 && dy === 0 && ti === 0) break;
    ts.push({ dx, dy, ti, sub: buf[o + 8], lvl: buf[o + 9] });
  }
  return ts;
}

const sed = loadSed(fs.readFileSync(SED).toString('latin1'));
const t = parseTheaterIni(
  fs.readFileSync('G:/ra2-web-mapgen/packages/server/resources/theater/temperatmd.ini', 'utf8'),
  NAMES[sed.theater] || 'TEMPERATE');

const FAMS = [
  ['water', t.waterSet, 14],
  ['shore', t.shorePieces, 42],
  ['cliff', t.cliffSet, 40],
  ['ramp', t.rampBase, 19],
  ['cliffRamp', t.cliffRamps, 20],
];

function stat(ts) {
  const lv = new Map(); const tis = new Set(); const subs = new Set();
  const byFam = {}; const byTile = new Map();
  for (const x of ts) {
    lv.set(x.lvl, (lv.get(x.lvl) || 0) + 1);
    tis.add(x.ti);
    subs.add(x.sub);
    let fam = 'other';
    for (const [nm, base, len] of FAMS) {
      if (x.ti >= base && x.ti < base + len) { fam = nm; break; }
    }
    byFam[fam] = (byFam[fam] || 0) + 1;
    let e = byTile.get(x.ti);
    if (!e) { e = { n: 0, s: new Set() }; byTile.set(x.ti, e); }
    e.n += 1; e.s.add(x.sub);
  }
  const lvk = [...lv.keys()].sort((a, b) => a - b);
  return { n: ts.length, lvCount: lvk.length, lvMin: lvk[0], lvMax: lvk[lvk.length - 1],
    lv, ti: tis.size, sub: subs.size, byFam, byTile };
}

function show(tag, s) {
  console.log(tag.padEnd(8) + ' 格=' + String(s.n).padEnd(7) +
    ' Level=' + s.lvCount + '档(' + s.lvMin + '..' + s.lvMax + ')'.padEnd(4) +
    ' TileIdx=' + String(s.ti).padEnd(5) + ' SubIdx=' + String(s.sub).padEnd(3) +
    '  ' + FAMS.map(([nm]) => nm + ':' + (s.byFam[nm] || 0)).join(' '));
}

console.log('参数: MapType=' + sed.mapType + ' Seed=' + sed.seed +
  ' Players=' + sed.numPlayers + ' Water=' + sed.waterAmount +
  ' Rugged=' + sed.ruggedness + ' RegionSize=' + sed.regionSize);
console.log('');

const realTs = readIso(fs.readFileSync(MAP, 'latin1'));
if (!realTs) { console.log('✗ 无法解析基线'); process.exit(1); }

const dims = deriveDimensions(sed);
const t0 = Date.now();
const { ini } = generateFullMap({
  seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
  numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
  tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
  theater: sed.theater, dimensions: dims, tables: t,
}, 'Random Map');
const ourTs = readIso(ini);
const ms = Date.now() - t0;

const rs = stat(realTs);
const os_ = stat(ourTs);
show('真机', rs);
show('我们', os_);
console.log('（我们耗时 ' + ms + 'ms）');
console.log('');

const row = (k, a, b, note) => console.log('  ' + k.padEnd(14) +
  String(a).padEnd(12) + String(b).padEnd(12) + (note || ''));
console.log('=== 差异 ===');
row('格数', rs.n, os_.n, rs.n === os_.n ? '✅ 一致' : '');
row('Level 档', rs.lvCount + '(' + rs.lvMin + '..' + rs.lvMax + ')',
  os_.lvCount + '(' + os_.lvMin + '..' + os_.lvMax + ')', '');
row('TileIdx 种', rs.ti, os_.ti, '');
row('SubIdx 种', rs.sub, os_.sub, rs.sub === os_.sub ? '✅' : '');
for (const [nm] of FAMS) {
  const a = rs.byFam[nm] || 0;
  const b = os_.byFam[nm] || 0;
  row(nm, a, b, a === b ? '✅' : (b === 0 ? '★ 我们为 0' : ''));
}
console.log('');
console.log('=== Level 分布对比 ===');
const lvk = [...new Set([...rs.lv.keys(), ...os_.lv.keys()])].sort((a, b) => a - b);
console.log('  lvl   真机     我们');
for (const k of lvk) {
  const a = rs.lv.get(k) || 0; const b = os_.lv.get(k) || 0;
  console.log('  ' + String(k).padStart(3) + '  ' + String(a).padEnd(8) + b +
    (a === b ? '' : '   Δ' + (b - a)));
}