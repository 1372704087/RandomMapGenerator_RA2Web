/**
 * `water_tile_shape.js` —— 诊断「水的 tile/subIndex 细分」与真实基线对照。
 *
 * 真实基线：`F:\YTLauncher\RandMap.Map`（theater=0 温带, MapType=1, seed=40708, 8p）
 * 用法：node re/water_tile_shape.js
 *
 * 【实测结论（2026-10-08）】
 * 真机水体只有 **1 个连通块（10160 格 = 44%）**，但它的**细分方式**是：
 *   tile     314/315/316/317/318/319 各 ~1700 格（均匀）
 *   subIndex 0/1/2/3 各占 1/4
 *   level    **恒为 4**（全部水格）
 * ⇒ 6 个 water tile 是**同一水体的 6 种形态**（按菱形坐标 4 象限/旋转），
 *    4 个 subIndex 是**该 tile 模板内 2×2 的 4 个子格**。
 *
 * ⚠ 我们当前实现：`dilateRingsToWater` 一律写 `cell.tile = theater.waterSet`（=314）
 *   且 subIndex 恒 0 ⇒ 形态退化（这是**形态缺口**，不是水量缺口）。
 *
 * 【另一条被纠正的错误指标】
 * 之前说"真机 water 49% vs 我们 2%"是**拿 MapType=4 样本比的**。
 * 同参数（RandMap.Sed）真身对比是 **49.4% vs 24.7%**（差 2 倍，不是 15 倍）。
 * ⇒ 水**量**差约 2 倍（真机 11463 vs 我们 5731 格），而**形态**缺 6×4=24 种。
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const fs = require('fs');
const { IniFile } = require(B + '/dist/io/iniFile.js');
const { decompressRange } = require(B + '/dist/format/minilzo.js');
const { parseTheaterIni } = require(B + '/dist/rmg/theater.js');
const { loadSed } = require(B + '/dist/rmg/sed.js');
const { deriveDimensions } = require(B + '/dist/rmg/options.js');
const { generateFullMap } = require(B + '/dist/rmg/pipeline.js');

const REAL = 'F:/YTLauncher/RandMap.Map';
const SED = 'F:/YTLauncher/RandMap.Sed';
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
    const x = buf.readInt16LE(o); const y = buf.readInt16LE(o + 2);
    const ti = buf.readInt32LE(o + 4);
    if (x === 0 && y === 0 && ti === 0) break;
    ts.push({ x, y, ti, sub: buf[o + 8], lvl: buf[o + 9] });
  }
  return ts;
}
const isWaterTile = (ti) => ti >= tables.waterSet && ti < tables.waterSet + 14;

/** 按 8 邻接统计水体连通块 */
function blobs(water) {
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
        if (cell && isWaterTile(cell.ti)) { seen.add(kk); stack.push(cell); }
      }
    }
    sizes.push(n);
  }
  return sizes.sort((a, b) => b - a);
}

function detail(tag, ts) {
  const water = ts.filter((t) => isWaterTile(t.ti));
  const byTile = new Map();
  for (const t of water) {
    let e = byTile.get(t.ti);
    if (!e) { e = { n: 0, subs: new Set(), lvls: new Set() }; byTile.set(t.ti, e); }
    e.n += 1; e.subs.add(t.sub); e.lvls.add(t.lvl);
  }
  const sizes = blobs(water);
  console.log('\n=== %s ===', tag);
  console.log('  总格 = ' + ts.length + '   water 格 = ' + water.length +
    ' (' + (water.length / ts.length * 100).toFixed(1) + '%)');
  console.log('  独立水体数 = ' + sizes.length + '   最大块 = ' + (sizes[0] || 0) +
    '   前 8 = ' + sizes.slice(0, 8).join(' '));
  console.log('  用到的 water tile = ' + byTile.size + ' 种:');
  for (const [ti, e] of [...byTile.entries()].sort((a, b) => a[0] - b[0])) {
    console.log('    ' + ti + ': n=' + String(e.n).padEnd(6) +
      ' subIndex=' + JSON.stringify([...e.subs].sort((a, b) => a - b)) +
      '  level=' + JSON.stringify([...e.lvls].sort((a, b) => a - b)));
  }
  return { total: ts.length, water: water.length, blobs: sizes.length, maxBlob: sizes[0] || 0,
    tileKinds: byTile.size,
    subKinds: new Set(water.map((t) => t.sub)).size };
}

console.log('theater: waterSet=' + tables.waterSet +
  '  水族区间 = ' + tables.waterSet + '..' + (tables.waterSet + 13));
console.log('基线 = %s', REAL);

const rs = detail('真机', readTiles(new IniFile(fs.readFileSync(REAL, 'latin1'))));

const sed = loadSed(fs.readFileSync(SED).toString('latin1'));
const dims = deriveDimensions(sed);
const { ini } = generateFullMap({
  seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
  numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
  tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
  theater: sed.theater, dimensions: dims, tables,
}, 'Random Map');
const os_ = detail('我们（RandMap.Sed 同参数）', readTiles(new IniFile(ini)));

console.log('\n=== 差异汇总 ===');
const row = (k, a, b) => console.log('  ' + k.padEnd(18) +
    '真机 ' + String(a).padEnd(12) + '我们 ' + String(b));
row('water 格数', `${rs.water} (${(rs.water / rs.total * 100).toFixed(1)}%)`,
  `${os_.water} (${(os_.water / os_.total * 100).toFixed(1)}%)`);
row('独立水体数', rs.blobs, os_.blobs);
row('最大水体', rs.maxBlob, os_.maxBlob);
row('water tile 种', rs.tileKinds, os_.tileKinds);
row('water subIndex 种', rs.subKinds, os_.subKinds);
console.log('\n  ⇒ 量差 ' +
  (os_.water > 0 ? (rs.water / os_.water).toFixed(1) + 'x' : 'Inf') +
  '   形态缺 ' + (rs.tileKinds - os_.tileKinds) + ' tile x ' +
  (rs.subKinds - os_.subKinds) + ' subIndex');
