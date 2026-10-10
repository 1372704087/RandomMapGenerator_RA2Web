/**
 * 验证性实验：放开 `landBlobFlood` 的扩展判定，看 blob 数是否从 239 掉下来。
 *
 * 背景（探针 `water_probe_flood.js` 实测）：
 *   landBlobFlood 调用 100 次，全部 shoreOk=1（无回滚）
 *   quota 恒为 357（被 cap = area*0.03*target 卡死，正确值应是 11960）
 *   每轮 pops = 357 357 1 1 357 1 1 1 357 …  ⇒ 多数轮只吃到 1 格
 *
 * 两个独立问题：
 *   ① cap 太小（每轮 3%）—— 但 100 轮 × 357 = 35700 远够 11463，
 *      所以**不是轮数不够**，而是
 *   ② 多数轮吃不到 —— 扩展判定 `nslot.regionId !== 0 → continue`
 *      撞上一轮 shoreFinalize 打的标记。
 *
 * 本实验只改 ②，保留 ①，看 blob 数变化。
 * ⚠ 不改 src，只临时改 dist，跑完复原。
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const DIST = B + '/dist/rmg/water.js';
const fs = require('fs');
const { IniFile } = require(B + '/dist/io/iniFile.js');
const { decompressRange } = require(B + '/dist/format/minilzo.js');
const { parseTheaterIni } = require(B + '/dist/rmg/theater.js');

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

const sed = require(B + '/dist/rmg/sed.js').loadSed(
  fs.readFileSync('F:/YTLauncher/RandMap.Sed').toString('latin1'));
const dims = require(B + '/dist/rmg/options.js').deriveDimensions(sed);
const BASE = {
  seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
  numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
  tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
  theater: sed.theater, dimensions: dims, tables,
};

function run(tag) {
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(B + '/dist/rmg/')) delete require.cache[k];
  }
  const { generateFullMap } = require(B + '/dist/rmg/pipeline.js');
  const { ini } = generateFullMap(BASE, 'Random Map');
  const s = blobCount(readTiles(new IniFile(ini)));
  console.log(tag.padEnd(34) + ' water=' + String(s.water).padEnd(6) +
    ' blobs=' + String(s.blobs).padEnd(5) + ' max=' + String(s.max).padEnd(6) +
    ' top5=' + s.top5.join(' '));
  return s;
}

console.log('真机                           ' +
  'water=11463  blobs=2      max=11356  top5=11356 107');
run('A 现状');

// 找到扩展判定那一行
const src = fs.readFileSync(DIST, 'utf8');
const lines = src.split('\n');
const idx = lines.findIndex((l) =>
  l.includes('nslot.regionId !== 0 || nslot.patchId === blobId'));
if (idx < 0) { console.log('✗ 未找到扩展判定'); process.exit(1); }
console.log('  [扩展判定] ' + lines[idx].trim());

try {
  // B: 允许进入"已落水"的格（上一轮 shoreFinalize 打过标记的）
  const l2 = lines.slice();
  l2[idx] = l2[idx].replace(
    'nslot.regionId !== 0 || nslot.patchId === blobId',
    '(nslot.regionId !== 0 && !isWaterTile(ncell2, theater)) || nslot.patchId === blobId');
  // 需要把 ncell 提到前面：注入一个提前取 cell 的语句
  l2[idx] = 'const ncell2 = cells.slotAt(nx, ny); ' + l2[idx];
  fs.writeFileSync(DIST, l2.join('\n'));
  run('B 允许扩进已落水格');
} finally {
  fs.writeFileSync(DIST, src);
  console.log('\n(已复原 dist)');
}
