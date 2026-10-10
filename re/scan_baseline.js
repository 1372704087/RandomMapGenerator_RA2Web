/**
 * `scan_baseline.js` —— 扫一份「已知参数 + 真机结果」的 RMG 基线。
 *
 * 用法：
 *   node re/scan_baseline.js [Map路径] [Sed路径]
 * 默认 `F:/YTLauncher/RandMap.Map` + `RandMap.Sed`。
 *
 * 输出（与我们的输出同口径）：
 *   格数 / Level 档数与范围 / TileIndex 种 / SubIndex 种 / 族分布（cliff shore ramp water）
 *   + 崖族/岸线的 subIndex 模式（用于反推模板子格数）
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const fs = require('fs');
const path = require('path');
const { IniFile } = require(B + '/dist/io/iniFile.js');
const { decompressRange } = require(B + '/dist/format/minilzo.js');
const { parseTheaterIni } = require(B + '/dist/rmg/theater.js');
const { loadSed } = require(B + '/dist/rmg/sed.js');

const MAP = process.argv[2] || 'F:/YTLauncher/RandMap.Map';
const SED = process.argv[3] || 'F:/YTLauncher/RandMap.Sed';
const THEATER = 'G:/ra2-web-mapgen/packages/server/resources/theater/temperatmd.ini';

function parseTheaterIdx(idx) {
  const name = ['TEMPERATE', 'DESERT', 'SNOW', 'URBAN', 'URBAN_NIGHT'][idx] || 'TEMPERATE';
  return parseTheaterIni(fs.readFileSync(THEATER, 'utf8'), name);
}

function readIso(file) {
  const ini = new IniFile(fs.readFileSync(file, 'latin1'));
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
  return { ts, header: {
    W: ini.GetIntValue('Header', 'Width', 0),
    H: ini.GetIntValue('Header', 'Height', 0),
    local: ini.GetStringValue('Map', 'LocalSize', ''),
    theater: ini.GetIntValue('Map', 'Theater', 0),
  } };
}

const sed = fs.existsSync(SED) ? loadSed(fs.readFileSync(SED).toString('latin1')) : null;
const t = parseTheaterIdx(sed ? sed.theater : 0);
const got = readIso(MAP);
if (!got) { console.log('✗ 无法解析 ' + MAP); process.exit(1); }

console.log('=== 基线 ' + path.basename(MAP) + ' ===');
if (sed) {
  console.log('参数: MapType=' + sed.mapType + ' Seed=' + sed.seed +
    ' Players=' + sed.numPlayers + ' Water=' + sed.waterAmount +
    ' Rugged=' + sed.ruggedness + ' RegionSize=' + sed.regionSize +
    ' Theater=' + sed.theater);
} else {
  console.log('（无 ' + SED + '）');
}
console.log('Header: W=' + got.header.W + ' H=' + got.header.H +
  ' LocalSize=' + got.header.local);

const ts = got.ts;
const n = ts.length;
const CL = t.cliffSet, CLH = 40;
const SH = t.shorePieces, SHH = 42;
const RB = t.rampBase, RBH = 19;
const WS = t.waterSet, WSH = 14;

const lv = new Map(); const tis = new Set(); const subs = new Set();
const byTile = new Map();
let cliff = 0, shore = 0, ramp = 0, water = 0;
for (const x of ts) {
  lv.set(x.lvl, (lv.get(x.lvl) || 0) + 1);
  tis.add(x.ti);
  subs.add(x.sub);
  let e = byTile.get(x.ti);
  if (!e) { e = { n: 0, s: new Set(), l: new Set() }; byTile.set(x.ti, e); }
  e.n += 1; e.s.add(x.sub); e.l.add(x.lvl);
  if (x.ti >= CL && x.ti < CL + CLH) cliff++;
  else if (x.ti >= SH && x.ti < SH + SHH) shore++;
  else if (x.ti >= RB && x.ti < RB + RBH) ramp++;
  else if (x.ti >= WS && x.ti < WS + WSH) water++;
}
const lvk = [...lv.keys()].sort((a, b) => a - b);
console.log('');
console.log('格数 = ' + n);
console.log('Level 档 = ' + lvk.length + '  (' + lvk[0] + '..' + lvk[lvk.length - 1] + ')' +
  '  分布: ' + lvk.map((k) => k + ':' + lv.get(k)).join(' '));
console.log('TileIndex 种 = ' + tis.size + '   SubIndex 种 = ' + subs.size +
  '  ' + JSON.stringify([...subs].sort((a, b) => a - b)));
console.log('');
console.log('=== 族分布 ===');
console.log('  water(314..327) = ' + water + '  (' + (water / n * 100).toFixed(1) + '%)');
console.log('  shore(89..130)  = ' + shore + '  (' + (shore / n * 100).toFixed(1) + '%)');
console.log('  cliff(49..88)   = ' + cliff + '  (' + (cliff / n * 100).toFixed(1) + '%)' +
  '   ★ 崖族');
console.log('  ramp(29..47)    = ' + ramp + '  (' + (ramp / n * 100).toFixed(1) + '%)');

// 崖族/岸线的 subIndex 模式
for (const [nm, base, len] of [['cliff', CL, CLH], ['shore', SH, SHH]]) {
  const inFam = [...byTile.entries()].filter(([ti]) => ti >= base && ti < base + len);
  if (!inFam.length) { console.log('\n  ' + nm + ': 无 tile'); continue; }
  const pat = new Map();
  for (const [ti, e] of inFam) {
    const k = JSON.stringify([...e.s].sort((a, b) => a - b));
    pat.set(k, (pat.get(k) || 0) + 1);
  }
  console.log('\n=== ' + nm + ' 族（' + inFam.length + ' 个 tile）subIndex 模式 ===');
  [...pat.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log('  ' + k.padEnd(22) + ' × ' + v);
  });
  const multi = inFam.filter(([, e]) => e.s.size > 1).length;
  console.log('  ⇒ 多子格 tile: ' + multi + '/' + inFam.length +
    '  最长子格数 ' + Math.max(...inFam.map(([, e]) => e.s.size)));
}