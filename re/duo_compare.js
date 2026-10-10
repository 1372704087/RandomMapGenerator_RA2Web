/**
 * 首次对拍：我们的 RMG 输出 vs 真机基线（`Random Map.yrm`）
 *
 * 目的不是"逐字节一致"（那需要同 seed 的 gamemd cell 网格 golden），
 * 而是量出**结构性差距**：段名集合、tile 流规模、坐标域、Level 分布。
 *
 * 用真实 `.SED`（8人/MapType=4/Theater=1/Seed=16730）驱动我们的管线，
 * 与基线（`[Basic] Author=Handama` 的产出）逐项比。
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const fs = require('fs');
const { generateFullMap } = require(B + '/dist/rmg/pipeline.js');
const { deriveDimensions } = require(B + '/dist/rmg/options.js');
const { loadSed } = require(B + '/dist/rmg/sed.js');
const { parseTheaterIni } = require(B + '/dist/rmg/theater.js');
const { IniFile } = require(B + '/dist/io/iniFile.js');
const { decompressRange } = require(B + '/dist/format/minilzo.js');

const TEMPERATE_INI = process.argv[2] || (B + '/../../../re/oracle/theater/TEMPERATEMD.INI');

function parseIso(ini) {
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
    const out = new Uint8Array(so + 1024);
    decompressRange(new Uint8Array(raw), r, si, out, 0);
    parts.push(Buffer.from(out.slice(0, so)));
    r += si;
  }
  return Buffer.concat(parts);
}

function tiles(buf) {
  const out = [];
  if (!buf) return out;
  for (let o = 0; o + 11 <= buf.length - 4; o += 11) {
    const x = buf.readInt16LE(o);
    const y = buf.readInt16LE(o + 2);
    const ti = buf.readInt32LE(o + 4);
    if (x === 0 && y === 0 && ti === 0) break;
    out.push({ x, y, ti, sub: buf[o + 8], lvl: buf[o + 9] });
  }
  return out;
}

function levelHist(ts) {
  const m = {};
  for (const t of ts) m[t.lvl] = (m[t.lvl] || 0) + 1;
  return m;
}

// ---------- 基线 ----------
const realIni = new IniFile(fs.readFileSync(B + '/src/test/fixtures/rmg_real_randommap.yrm', 'latin1'));
const realTiles = tiles(parseIso(realIni));
const realW = realIni.GetIntValue('Header', 'Width', 0);
const realH = realIni.GetIntValue('Header', 'Height', 0);
console.log('=== 基线（真机 Random Map.yrm）===');
console.log('  段数        = %d', realIni.GetSections().length);
console.log('  tile 数     = %d', realTiles.length);
console.log('  Header W/H  = %d / %d', realW, realH);
console.log('  X 范围      = %d .. %d', Math.min(...realTiles.map(t => t.x)), Math.max(...realTiles.map(t => t.x)));
console.log('  Y 范围      = %d .. %d', Math.min(...realTiles.map(t => t.y)), Math.max(...realTiles.map(t => t.y)));
console.log('  Level 分布  = %s', JSON.stringify(levelHist(realTiles)));
console.log('  TileIndex   = %d 种, %d..%d',
  new Set(realTiles.map(t => t.ti)).size,
  Math.min(...realTiles.map(t => t.ti)),
  Math.max(...realTiles.map(t => t.ti)));

// ---------- 我们 ----------
const sed = loadSed(fs.readFileSync(B + '/src/test/fixtures/randmap_maptype4_8p.sed', 'latin1').toString('latin1'));
const dims = deriveDimensions(sed);
const tables = parseTheaterIni(fs.readFileSync(TEMPERATE_INI, 'utf8'), 'TEMPERATE');
const input = {
  seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
  numPlayers: sed.numPlayers, ruggedness: sed.ruggedness,
  vegetation: sed.vegetation, tiberiumLayout: sed.tiberiumLayout,
  tiberium: sed.tiberium, resources: sed.resources,
  theater: sed.theater, dimensions: dims, tables,
};
const { ini } = generateFullMap(input, 'Random Map');
const ourIni = new IniFile(ini);
const ourTiles = tiles(parseIso(ourIni));
const ourW = ourIni.GetIntValue('Header', 'Width', 0);
const ourH = ourIni.GetIntValue('Header', 'Height', 0);

console.log();
console.log('=== 我们（真实 SED 驱动）===');
console.log('  输入        = seed=%d mapType=%d theater=%d players=%d water=%d',
  sed.seed, sed.mapType, sed.theater, sed.numPlayers, sed.waterAmount);
console.log('  派生尺寸    = genW=%d genH=%d mapW=%d mapH=%d', dims.genW, dims.genH, dims.mapW, dims.mapH);
console.log('  段数        = %d', ourIni.GetSections().length);
console.log('  tile 数     = %d', ourTiles.length);
console.log('  Header W/H  = %d / %d', ourW, ourH);
if (ourTiles.length) {
  console.log('  X 范围      = %d .. %d', Math.min(...ourTiles.map(t => t.x)), Math.max(...ourTiles.map(t => t.x)));
  console.log('  Y 范围      = %d .. %d', Math.min(...ourTiles.map(t => t.y)), Math.max(...ourTiles.map(t => t.y)));
  console.log('  Level 分布  = %s', JSON.stringify(levelHist(ourTiles)));
  console.log('  TileIndex   = %d 种, %d..%d',
    new Set(ourTiles.map(t => t.ti)).size,
    Math.min(...ourTiles.map(t => t.ti)),
    Math.max(...ourTiles.map(t => t.ti)));
}

// ---------- 差距 ----------
console.log();
console.log('=== 差距 ===');
const rs = realIni.GetSections();
const os = ourIni.GetSections();
const oset = new Set(os);
console.log('  基线独有段  : %s', rs.filter(s => !oset.has(s)).join(',') || '(无)');
const rset = new Set(rs);
console.log('  我们独有段  : %s', os.filter(s => !rset.has(s)).join(',') || '(无)');
console.log('  共同段      : %d / 基线 %d', rs.filter(s => rset.has(s) && oset.has(s)).length, rs.length);
console.log('  tile 数比   : 基线 %d vs 我们 %d', realTiles.length, ourTiles.length);
console.log('  尺寸比      : 基线 %dx%d vs 我们 %dx%d', realW, realH, ourW, ourH);
