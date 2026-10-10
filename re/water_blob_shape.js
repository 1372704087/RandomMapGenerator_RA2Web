/**
 * 水体形态的几何分析 —— 真机大湖 vs 我们的 blob。
 *
 * 关心两个问题：
 *  1. 真机那个 11356 格的巨水是什么形状？（圆？沿河谷？还是被地形挤出来的）
 *  2. 我们的 239 个 blob 的**尺寸分布** —— 是"每块都小"还是"有一块大+很多小"？
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
const isWater = (ti) => ti >= tables.waterSet && ti < tables.waterSet + 14;

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
    const x = buf.readInt16LE(o); const y = buf.readInt16LE(o + 2);
    const ti = buf.readInt32LE(o + 4);
    if (x === 0 && y === 0 && ti === 0) break;
    ts.push({ x, y, ti });
  }
  return ts;
}

function blobStats(ts) {
  const water = ts.filter((t) => isWater(t.ti));
  const at = new Map();
  for (const t of water) at.set(t.x * 4096 + t.y, t);
  const seen = new Set();
  const out = [];
  for (const p of water) {
    const k0 = p.x * 4096 + p.y;
    if (seen.has(k0)) continue;
    const stack = [p]; seen.add(k0);
    const cells = [];
    while (stack.length) {
      const c = stack.pop(); cells.push(c);
      for (let d = 0; d < 8; d++) {
        const nx = c.x + [1, -1, 0, 0, 1, 1, -1, -1][d];
        const ny = c.y + [0, 0, 1, -1, 1, -1, 1, -1][d];
        const kk = nx * 4096 + ny;
        if (seen.has(kk)) continue;
        const cell = at.get(kk);
        if (cell) { seen.add(kk); stack.push(cell); }
      }
    }
    const xs = cells.map((c) => c.x); const ys = cells.map((c) => c.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    out.push({ n: cells.length, x0, y0, x1, y1, w, h,
      fill: cells.length / (w * h) });
  }
  return out.sort((a, b) => b.n - a.n);
}

function show(tag, ts) {
  const bl = blobStats(ts);
  const water = ts.filter((t) => isWater(t.ti));
  const allX = ts.map((t) => t.x), allY = ts.map((t) => t.y);
  console.log('\n===== ' + tag + ' =====');
  console.log('全图 ' + ts.length + ' 格   坐标 x' + Math.min(...allX) + '..' + Math.max(...allX) +
    ' y' + Math.min(...allY) + '..' + Math.max(...allY));
  console.log('water ' + water.length + ' 格   blob 数 = ' + bl.length);
  console.log('尺寸分布: 最大 ' + bl[0].n + '  前10 = ' + bl.slice(0, 10).map((b) => b.n).join(' '));
  // 分档
  const buckets = { '>2000': 0, '1000-2000': 0, '500-1000': 0, '100-500': 0, '<100': 0 };
  for (const b of bl) {
    if (b.n > 2000) buckets['>2000']++;
    else if (b.n > 1000) buckets['1000-2000']++;
    else if (b.n > 500) buckets['500-1000']++;
    else if (b.n > 100) buckets['100-500']++;
    else buckets['<100']++;
  }
  console.log('分档: ' + JSON.stringify(buckets));
  console.log('前 5 大 blob 的形状（填充率 = 格数/包围盒面积，接近圆≈0.785）:');
  for (const b of bl.slice(0, 5)) {
    console.log('   n=' + String(b.n).padEnd(6) + ' bbox ' + b.w + 'x' + b.h +
      '  中心(' + (b.x0 + ((b.w - 1) >> 1)) + ',' + (b.y0 + ((b.h - 1) >> 1)) + ')' +
      '  填充率=' + b.fill.toFixed(3));
  }
  return bl;
}

const realTs = readTiles(new IniFile(fs.readFileSync('F:/YTLauncher/RandMap.Map', 'latin1')));
const realBl = show('真机', realTs);

const sed = loadSed(fs.readFileSync('F:/YTLauncher/RandMap.Sed').toString('latin1'));
const dims = deriveDimensions(sed);
const { ini } = generateFullMap({
  seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
  numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
  tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
  theater: sed.theater, dimensions: dims, tables,
}, 'Random Map');
const ourBl = show('我们', readTiles(new IniFile(ini)));

console.log('\n===== 结论 =====');
console.log('真机 blob 数 ' + realBl.length + '  最大 ' + realBl[0].n +
  '  总量 ' + realBl.reduce((a, b) => a + b.n, 0));
console.log('我们 blob 数 ' + ourBl.length + '  最大 ' + ourBl[0].n +
  '  总量 ' + ourBl.reduce((a, b) => a + b.n, 0));
console.log('⇒ 我们是「碎片多」，还是「每块都小」？看分档与总量/块数：');
console.log('   真机 平均 blob = ' + Math.round(realBl.reduce((a, b) => a + b.n, 0) / realBl.length));
console.log('   我们 平均 blob = ' + Math.round(ourBl.reduce((a, b) => a + b.n, 0) / ourBl.length));
