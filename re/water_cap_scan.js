/**
 * 参数扫描：`cap = area * K * target` 的系数 K。
 *
 * 已知（探针实测）：
 *   area = 2*mapW*(mapH+4) = 24128
 *   target = 0.4945（与真机 49.4% 吻合）
 *   cap 当前 = area*0.03*target = 357.9 ⇒ 每轮 quota 恒 357
 *   真需求 = target*area = 11931
 *
 * 目标：找 K 使 water 上升（→11463）且 blob 下降（→个位数）。
 * ⚠ 只改 dist，跑完复原，不动 src。
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const DIST = B + '/dist/rmg/water.js';
const fs = require('fs');
const { IniFile } = require(B + '/dist/io/iniFile.js');
const { decompressRange } = require(B + '/dist/format/minilzo.js');
const { parseTheaterIni } = require(B + '/dist/rmg/theater.js');
const { loadSed } = require(B + '/dist/rmg/sed.js');
const { deriveDimensions } = require(B + '/dist/rmg/options.js');

const tables = parseTheaterIni(
  fs.readFileSync('G:/ra2-web-mapgen/packages/server/resources/theater/temperatmd.ini', 'utf8'), 'TEMPERATE');
const isWater = (ti) => ti >= tables.waterSet && ti < tables.waterSet + 14;

function readTiles(ini) {
  const sec = ini.GetSection('IsoMapPack5');
  if (!sec) return [];
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
  const ts = [];
  for (let o = 0; o + 11 <= buf.length - 4; o += 11) {
    const x = buf.readInt16LE(o); const y = buf.readInt16LE(o + 2);
    const ti = buf.readInt32LE(o + 4);
    if (x === 0 && y === 0 && ti === 0) break;
    ts.push({ x, y, ti });
  }
  return ts;
}
function blobCount(ts) {
  const water = ts.filter((t) => isWater(t.ti));
  const at = new Map();
  for (const t of water) at.set(t.x * 4096 + t.y, t);
  const seen = new Set();
  const sizes = [];
  for (const p of water) {
    const k0 = p.x * 4096 + p.y;
    if (seen.has(k0)) continue;
    const stack = [p]; seen.add(k0);
    let n = 0;
    while (stack.length) {
      const c = stack.pop(); n += 1;
      for (let d = 0; d < 8; d++) {
        const nx = c.x + [1, -1, 0, 0, 1, 1, -1, -1][d];
        const ny = c.y + [0, 0, 1, -1, 1, -1, 1, -1][d];
        const kk = nx * 4096 + ny;
        if (seen.has(kk)) continue;
        const cell = at.get(kk);
        if (cell) { seen.add(kk); stack.push(cell); }
      }
    }
    sizes.push(n);
  }
  sizes.sort((a, b) => b - a);
  return { water: water.length, blobs: sizes.length, max: sizes[0] || 0, top5: sizes.slice(0, 5) };
}

const sed = loadSed(fs.readFileSync('F:/YTLauncher/RandMap.Sed').toString('latin1'));
const dims = deriveDimensions(sed);
const BASE = {
  seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
  numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
  tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
  theater: sed.theater, dimensions: dims, tables,
};
const area = 2 * dims.mapW * (dims.mapH + 4);
const target = (1 - sed.waterAmount * 0.01) * 0.05 + 0.45;
console.log('area = ' + area + '   target = ' + target.toFixed(4) +
  '   真机 water=11463 blobs=2 max=11356');
console.log('');

function run(tag) {
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(B + '/dist/rmg/')) delete require.cache[k];
  }
  const { generateFullMap } = require(B + '/dist/rmg/pipeline.js');
  const { ini } = generateFullMap(BASE, 'Random Map');
  const s = blobCount(readTiles(new IniFile(ini)));
  console.log(tag.padEnd(26) + ' water=' + String(s.water).padEnd(6) +
    '(' + (s.water / 23184 * 100).toFixed(1) + '%)  blobs=' + String(s.blobs).padEnd(5) +
    ' max=' + String(s.max).padEnd(6) + ' top5=' + s.top5.join(' '));
  return s;
}

const src = fs.readFileSync(DIST, 'utf8');
// cap 行：const cap = (0, x87_1.ftol)((0, x87_1.chopMul)((0, x87_1.chopMul)(area, 0.03), target));
const CAP_RE = /const cap = \(0, x87_1\.ftol\)\(\(0, x87_1\.chopMul\)\(\(0, x87_1\.chopMul\)\(area, ([\d.]+)\), target\)\);/;
if (!CAP_RE.test(src)) { console.log('✗ cap 行未匹配'); process.exit(1); }
console.log('[已匹配 cap 行] ' + src.match(CAP_RE)[0]);
console.log('');

try {
  for (const k of [0.03, 0.1, 0.2, 0.3, 0.5, 0.8, 1.0]) {
    const patched = src.replace(CAP_RE,
      'const cap = (0, x87_1.ftol)((0, x87_1.chopMul)((0, x87_1.chopMul)(area, ' + k + '), target));');
    fs.writeFileSync(DIST, patched);
    const capV = Math.floor(area * k * target);
    console.log('K=' + String(k).padEnd(5) + ' cap=' + String(capV).padEnd(6) +
      ' (首轮需 ' + Math.floor(target * area) + ')');
    run('   结果');
  }
  // 顺带：把 cap 整个关掉（quota = target*area - placed，不 clamp）
  fs.writeFileSync(DIST, src.replace(
    /if \(quota >= cap\)\s*\n\s*quota = cap;/, '// clamp removed'));
  console.log('\n[完全移除 cap clamp]');
  run('   结果');
} finally {
  fs.writeFileSync(DIST, src);
  console.log('\n(已复原 dist)');
}
