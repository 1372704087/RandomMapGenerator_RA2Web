/**
 * `ascii_map.js` —— 把 IsoMapPack5 渲染成 ASCII 缩略图（真机 / 我们 同参数对照）
 *
 * 用法: node re/ascii_map.js <Map> <Sed> [mode]
 *   mode=level  → 按 level 渲染（0-9, A=10+）
 *   mode=fam    → 按族渲染（.=clear/water/其他, C=cliff, R=ramp, r=cliffRamp, S=shore, W=water）
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const fs = require('fs');
const { generateFullMap } = require(B + '/dist/rmg/pipeline.js');
const { deriveDimensions } = require(B + '/dist/rmg/options.js');
const { loadSed } = require(B + '/dist/rmg/sed.js');
const { parseTheaterIni } = require(B + '/dist/rmg/theater.js');
const { IniFile } = require(B + '/dist/io/iniFile.js');
const { decompressRange } = require(B + '/dist/format/minilzo.js');

const MAP = process.argv[2];
const SED = process.argv[3];
const MODE = process.argv[4] || 'level';
const NAMES = ['TEMPERATE', 'DESERT', 'SNOW', 'URBAN', 'URBAN_NIGHT'];

function readIso(iniText) {
  const ini = new IniFile(iniText);
  const sec = ini.GetSection('IsoMapPack5');
  const keys = sec.Keys.slice().sort((a, b) => Number(a) - Number(b));
  const raw = Buffer.from(keys.map((k) => sec.GetStringValue(k, '')).join(''), 'base64');
  let r = 0; const parts = [];
  while (r + 4 <= raw.length) {
    const si = raw.readUInt16LE(r), so = raw.readUInt16LE(r + 2);
    if (!si || !so) break; r += 4;
    const o = new Uint8Array(so + 1024); decompressRange(new Uint8Array(raw), r, si, o, 0);
    parts.push(Buffer.from(o.slice(0, so))); r += si;
  }
  const buf = Buffer.concat(parts); const out = [];
  for (let o = 0; o + 11 <= buf.length - 4; o += 11) {
    const dx = buf.readInt16LE(o), dy = buf.readInt16LE(o + 2), ti = buf.readInt32LE(o + 4);
    if (dx === 0 && dy === 0 && ti === 0) break;
    out.push({ dx, dy, ti, sub: buf[o + 8], lvl: buf[o + 9] });
  }
  return out;
}

const sed = loadSed(fs.readFileSync(SED).toString('latin1'));
const t = parseTheaterIni(
  fs.readFileSync('G:/ra2-web-mapgen/packages/server/resources/theater/temperatmd.ini', 'utf8'),
  NAMES[sed.theater] || 'TEMPERATE');
const dims = deriveDimensions(sed);

const real = readIso(fs.readFileSync(MAP, 'latin1'));
const { ini } = generateFullMap({
  seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
  numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
  tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
  theater: sed.theater, dimensions: dims, tables: t,
}, 'Random Map');
const ours = readIso(ini);

// IsoMapPack5 的 (dx,dy) 是菱形 2x 坐标：真实格 x=dx/2, y=dy/2 (偶数格)
// 转笛卡尔显示：col = (dx+dy)/2, row = (dy-dx)/2 偏移
function build(rows) {
  let maxDx = 0, maxDy = 0;
  for (const c of rows) { if (c.dx > maxDx) maxDx = c.dx; if (c.dy > maxDy) maxDy = c.dy; }
  const w = Math.floor(maxDx / 2) + 2, h = Math.floor(maxDy / 2) + 2;
  const g = new Array(w * h).fill(null);
  for (const c of rows) {
    const x = c.dx >> 1, y = c.dy >> 1;
    if (x < w && y < h) g[y * w + x] = c;
  }
  return { g, w, h };
}

function famChar(c, t) {
  const v = c.ti;
  if (v >= t.waterSet && v < t.waterSet + 14) return '~';
  if (v >= t.shorePieces && v < t.shorePieces + 42) return ':';
  if (v >= t.cliffSet && v < t.cliffSet + 40) return 'C';
  if (v >= t.rampBase && v < t.rampBase + 19) return 'R';
  if (v >= t.cliffRamps && v < t.cliffRamps + 20) return 'r';
  if (v === 0) return '.';
  if (v === 0xffff || v === 65535) return ' ';
  return '#';
}
function lvlChar(c) {
  const l = c.lvl;
  if (l === 0) return '.';
  return l < 10 ? String(l) : String.fromCharCode(65 + l - 10);
}

function render(tag, rows) {
  const { g, w, h } = build(rows);
  // 降采样到 ~110 列
  const step = Math.max(1, Math.ceil(w / 110));
  console.log('=== ' + tag + ' (' + MODE + ')  格=' + w + 'x' + h + ' step=' + step + ' ===');
  const ch = MODE === 'fam' ? (c) => famChar(c, t) : lvlChar;
  for (let y = 0; y < h; y += step * 2) {
    let line = '';
    for (let x = 0; x < w; x += step) {
      const c = g[y * w + x];
      line += c ? ch(c) : ' ';
    }
    console.log(line);
  }
  console.log('');
}

render('真机', real);
render('我们', ours);
