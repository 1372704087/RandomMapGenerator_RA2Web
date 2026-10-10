/**
 * 决定性实验 v7：`recalcCell` 里 `if (!valid) { cell.tile = TILE_NONE; ... }`
 * 到底是谁把 `valid` 弄成 false 的。
 *
 * 事实（前面实验）：
 *   ✗ 改 `FlatTemplateProvider.subExists` 实现（放行 4 子格）⇒ 38.5% 一字不变
 *     ⇒ 说明 pipeline 用的**不是** dist/recalc.js 里那个类
 *       （或 Provider 是每格 new 的，缓存了旧实例）
 *   ✓ probe5 显示 `#8: 314 -> 65535 × 6837` ⇒ 就是第 8 处赋值
 *
 * 本实验：在 `!valid` 分支**之前**插入 log，打印 valid 值 / tile / subtile /
 *        tp 构造表达式，直接看现场。
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const DIST = B + '/dist/rmg/recalc.js';
const fs = require('fs');
const { parseTheaterIni } = require(B + '/dist/rmg/theater.js');
const { loadSed } = require(B + '/dist/rmg/sed.js');
const { deriveDimensions } = require(B + '/dist/rmg/options.js');

const tables = parseTheaterIni(
  fs.readFileSync('G:/ra2-web-mapgen/packages/server/resources/theater/temperatmd.ini', 'utf8'), 'TEMPERATE');
const LO = tables.waterSet, HI = tables.waterSet + 13;

const orig = fs.readFileSync(DIST, 'utf8');
const lines = orig.split('\n');
let n = 0;
const out = lines.map((l) => {
  const m = l.match(/^(\s*)if \(!valid\) \{$/);
  if (!m) return l;
  n += 1;
  return m[1] + 'if (!valid) {\n' + m[1] +
    '    if (cell.tile >= ' + LO + ' && cell.tile <= ' + HI + ') {' +
    ' globalThis.__VL.push({ tile: cell.tile, sub: cell.subTile, slope: cell.slope,' +
    ' valid: valid, tpName: tp.constructor.name }); }';
});
if (n === 0) { console.log('✗ 未找到 if (!valid)'); process.exit(1); }
console.log('包裹 ' + n + ' 处 if (!valid)');

globalThis.__VL = [];
fs.writeFileSync(DIST, out.join('\n'));
try {
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(B + '/dist/rmg/')) delete require.cache[k];
  }
  const P = require(B + '/dist/rmg/pipeline.js');
  const sed = loadSed(fs.readFileSync('F:/YTLauncher/RandMap.Sed').toString('latin1'));
  const dims = deriveDimensions(sed);
  const st = P.generateWaterStage({
    seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
    numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
    tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
    theater: sed.theater, dimensions: dims, tables,
  });
  globalThis.__VL = [];
  P.runRecalcStage(st);
  const log = globalThis.__VL;
  console.log('水格进入 !valid 分支的次数 = ' + log.length);
  const bySub = new Map();
  const byTp = new Map();
  for (const e of log) {
    const k = 'sub=' + e.sub + ' slope=' + e.slope;
    bySub.set(k, (bySub.get(k) || 0) + 1);
    byTp.set(e.tpName, (byTp.get(e.tpName) || 0) + 1);
  }
  console.log('');
  console.log('按 (subtile, slope):');
  for (const [k, v] of [...bySub.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log('  ' + k.padEnd(20) + ' × ' + v);
  }
  console.log('');
  console.log('Provider 实例类型: ' + JSON.stringify([...byTp.entries()]));
  console.log('');
  console.log('⇒ 若 tpName 是 FlatTemplateProvider 且改它无效，');
  console.log('  说明改的 dist 文件不是被 require 的那个（或 Provider 被闭包缓存）');
} finally {
  fs.writeFileSync(DIST, orig);
  console.log('\n(已复原 dist)');
}
