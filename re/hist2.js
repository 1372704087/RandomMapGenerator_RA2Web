/**
 * `hist2.js` —— 真机 vs 我们 的 tile 直方图（同口径，按族聚合 + 段内明细）
 *
 * 用法: node re/hist2.js <Map> <Sed> [族名...]
 *   族名 ∈ water shore cliff ramp cliffRamp；不给则全打
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
const WANT = process.argv.slice(4);
const NAMES = ['TEMPERATE', 'DESERT', 'SNOW', 'URBAN', 'URBAN_NIGHT'];

const sed = loadSed(fs.readFileSync(SED).toString('latin1'));
const t = parseTheaterIni(
  fs.readFileSync('G:/ra2-web-mapgen/packages/server/resources/theater/temperatmd.ini', 'utf8'),
  NAMES[sed.theater] || 'TEMPERATE');

function readIso(iniText, W, H) {
  const i2 = new IniFile(iniText);
  const sec = i2.GetSection('IsoMapPack5');
  const keys = sec.Keys.slice().sort((a, b) => Number(a) - Number(b));
  const raw = Buffer.from(keys.map((k) => sec.GetStringValue(k, '')).join(''), 'base64');
  let r = 0;
  const parts = [];
  while (r + 4 <= raw.length) {
    const si = raw.readUInt16LE(r), so = raw.readUInt16LE(r + 2);
    if (!si || !so) break;
    r += 4;
    const o = new Uint8Array(so + 1024);
    decompressRange(new Uint8Array(raw), r, si, o, 0);
    parts.push(Buffer.from(o.slice(0, so)));
    r += si;
  }
  // ⚠ 必须**先拼接再按 11 步遍历**：单个 chunk 的 so（典型 8192）不是 11 的倍数，
  // 逐 chunk 遍历会在每个 chunk 末尾丢弃 8 字节残留 ⇒ 后续全部错位。
  const buf = Buffer.concat(parts);
  const out = [];
  for (let o = 0; o + 11 <= buf.length - 4; o += 11) {
    const dx = buf.readInt16LE(o);
    const dy = buf.readInt16LE(o + 2);
    const ti = buf.readInt32LE(o + 4);
    if (dx === 0 && dy === 0 && ti === 0) break;
    out.push({ x: dx, y: dy, tile: ti, sub: buf[o + 8], level: buf[o + 9] });
  }
  return out;
}

// 真机
const mapIni = fs.readFileSync(MAP).toString('latin1');
const dims = deriveDimensions(sed);
const W = dims.width, H = dims.height;
const real = readIso(mapIni, W, H);

// 我们
const { ini } = generateFullMap({
  seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
  numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
  tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
  theater: sed.theater, dimensions: dims, tables: t,
}, 'Random Map');
const ours = readIso(ini, W, H);

const FAM = [
  ['water', t.waterSet, 14],
  ['shore', t.shorePieces, 42],
  ['cliff', t.cliffSet, 40],
  ['ramp', t.rampBase, 19],
  ['cliffRamp', t.cliffRamps, 20],
];

function histOf(rows) {
  const m = new Map();
  for (const c of rows) m.set(c.tile, (m.get(c.tile) || 0) + 1);
  return m;
}
const hr = histOf(real), ho = histOf(ours);

for (const [name, base, n] of FAM) {
  if (WANT.length && !WANT.includes(name)) continue;
  const keys = new Set();
  for (let i = 0; i < n; i++) keys.add(base + i);
  let tr = 0, to = 0;
  const det = [];
  for (const k of [...keys].sort((a, b) => a - b)) {
    const a = hr.get(k) || 0, b = ho.get(k) || 0;
    tr += a; to += b;
    if (a || b) det.push(k + ':' + a + '/' + b);
  }
  console.log(`${name} [${base}..${base + n - 1}]  真机=${tr}  我们=${to}`);
  console.log('   ' + det.join(' '));
}
