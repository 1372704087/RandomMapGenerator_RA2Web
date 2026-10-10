/**
 * 水体规模对比：真机 RandMap.Map vs 我们自己的输出。
 * ⚠ 口径统一：都用 theater 区间判 water 族，不混用 isWaterFamily（它要 subTile 等字段）。
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const fs = require('fs');
const { IniFile } = require(B + '/dist/io/iniFile.js');
const { decompressRange } = require(B + '/dist/format/minilzo.js');
const { parseTheaterIni } = require(B + '/dist/rmg/theater.js');
const { loadSed } = require(B + '/dist/rmg/sed.js');
const { deriveDimensions } = require(B + '/dist/rmg/options.js');
const { generateFullMap } = require(B + '/dist/rmg/pipeline.js');

const tables = parseTheaterIni(
  fs.readFileSync('G:/ra2-web-mapgen/packages/server/resources/theater/temperatmd.ini', 'utf8'),
  'TEMPERATE');

function parseIso(ini) {
  const sec = ini.GetSection('IsoMapPack5');
  if (!sec) return null;
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
  return Buffer.concat(parts);
}
function readTiles(ini) {
  const buf = parseIso(ini);
  const ts = [];
  for (let o = 0; o + 11 <= buf.length - 4; o += 11) {
    const x = buf.readInt16LE(o), y = buf.readInt16LE(o + 2), ti = buf.readInt32LE(o + 4);
    if (x === 0 && y === 0 && ti === 0) break;
    ts.push({ x, y, ti, sub: buf[o + 8], lvl: buf[o + 9] });
  }
  return ts;
}

/** 用 theater 区间做族分类（不依赖 cell 的其他字段） */
function fam(ti) {
  const t = tables;
  if (ti >= t.waterSet && ti < t.waterSet + 14) return 'water';
  if (ti >= t.shorePieces && ti < t.shorePieces + 42) return 'shore';
  if (ti >= t.cliffSet && ti < t.cliffSet + 16 * 14) return 'cliff';
  if (ti >= t.rampBase && ti < t.rampBase + 19) return 'ramp';
  if (ti === t.greenTile) return 'green';
  if (ti === t.sandTile) return 'sand';
  if (ti === 0) return 'clear';
  return 'other';
}
function report(tag, ts) {
  const by = {}; const wt = new Map();
  for (const c of ts) {
    const f = fam(c.ti);
    by[f] = (by[f] || 0) + 1;
    if (f === 'water') wt.set(c.ti, (wt.get(c.ti) || 0) + 1);
  }
  const n = ts.length;
  console.log('%s 总格=%d', tag, n);
  console.log('   族: ' + Object.entries(by).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => '%s=%d(%.1f%%)' % (k, v, v / n * 100)).join('  '));
  console.log('   water 细分: ' + [...wt.entries()].sort((a, b) => a[0] - b[0])
    .map(([k, v]) => k + ':' + v).join(' '));
  return { n, by, water: by.water || 0 };
}

console.log('theater: waterSet=%d shore=%d cliff=%d..%d ramp=%d green=%d sand=%d',
  tables.waterSet, tables.shorePieces, tables.cliffSet,
  tables.cliffSet + 223, tables.rampBase, tables.greenTile, tables.sandTile);

console.log('\n=== 真机（F:\\YTLauncher\\RandMap.Map）===');
const real = readTiles(new IniFile(fs.readFileSync('F:/YTLauncher/RandMap.Map', 'latin1')));
const rs = report('真机', real);

console.log('\n=== 我们（RandMap.Sed 参数）===');
const sed = loadSed(fs.readFileSync('F:/YTLauncher/RandMap.Sed').toString('latin1'));
const dims = deriveDimensions(sed);
const { ini } = generateFullMap({
  seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
  numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
  tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
  theater: sed.theater, dimensions: dims, tables,
}, 'Random Map');
const ours = readTiles(new IniFile(ini));
const os_ = report('我们', ours);

console.log('\n=== 差异 ===');
console.log('  water 格数:  真机 %d (%.1f%%)   我们 %d (%.1f%%)   倍数 %.1fx',
  rs.water, rs.water / rs.n * 100, os_.water, os_.water / os_.n * 100,
  os_.water > 0 ? rs.water / os_.water : Infinity);
console.log('  water%% 差: %.1f 个百分点', rs.water / rs.n * 100 - os_.water / os_.n * 100);
console.log('  SED 参数: WaterAmount=%d RegionSize=%d Players=%d MapType=%d',
  sed.waterAmount, sed.regionSize, sed.numPlayers, sed.mapType);
console.log('  推导尺寸: W=%d H=%d (mapW=%d mapH=%d)',
  dims.width || 0, dims.height || 0, dims.mapW || 0, dims.mapH || 0);
