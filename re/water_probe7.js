/**
 * 探针 v7：定位 `generateFullMap` 后段那 5pp 水的流失点。
 *
 * 已知：
 *   generateThroughRecalc 后   water=11124 (48.2%)
 *   generateFullMap 输出      water=10289 (44.4%)   ← 差 835 格 (3.6pp)
 *
 * generateFullMap 的后续序列（pipeline.ts:400-406）：
 *   runStartStage → runTechStage → runOreStage → runRecalcStage
 *   → runHillsStage → runLatStage → runRecalcStage
 *   → shoreFinalize(0,0) → 孤儿 tile 回填清地
 *
 * ⚠ 重点怀疑：末尾的「孤儿 tile 回填」—— 若 `inFam` 的族定义不含水族，
 *   水格会被当成孤儿回填成 clear！
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const fs = require('fs');
const P = require(B + '/dist/rmg/pipeline.js');
const { parseTheaterIni } = require(B + '/dist/rmg/theater.js');
const { loadSed } = require(B + '/dist/rmg/sed.js');
const { deriveDimensions } = require(B + '/dist/rmg/options.js');

const tables = parseTheaterIni(
  fs.readFileSync('G:/ra2-web-mapgen/packages/server/resources/theater/temperatmd.ini', 'utf8'), 'TEMPERATE');
const LO = tables.waterSet, HI = tables.waterSet + 13;

const sed = loadSed(fs.readFileSync('F:/YTLauncher/RandMap.Sed').toString('latin1'));
const dims = deriveDimensions(sed);
const input = {
  seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
  numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
  tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
  theater: sed.theater, dimensions: dims, tables,
};

const st = P.generateThroughRecalc(input);
const ctx = st.ctx;
const cnt = () => {
  let w = 0;
  for (const c of ctx.cells.iterate()) if (c.tile >= LO && c.tile <= HI) w += 1;
  return w;
};
const top = (n = 4) => {
  const m = new Map();
  for (const c of ctx.cells.iterate()) m.set(c.tile, (m.get(c.tile) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([k, v]) => k + '#' + v).join(' ');
};

console.log('water 族 = ' + LO + '..' + HI + '   真机最终 11463 (49.4%)');
console.log('');
const rows = [];
let prev = cnt();
console.log('generateThroughRecalc 后'.padEnd(26) + ' water=' + String(prev).padEnd(6) +
  '  top: ' + top());
for (const [name, fn] of [
  ['runStartStage', () => P.runStartStage(st)],
  ['runTechStage', () => P.runTechStage(st)],
  ['runOreStage', () => P.runOreStage(st)],
  ['runRecalcStage(1)', () => P.runRecalcStage(st)],
  ['runHillsStage', () => P.runHillsStage(st)],
  ['runLatStage', () => P.runLatStage(st)],
  ['runRecalcStage(2)', () => P.runRecalcStage(st)],
  ['shoreFinalize(0,0)', () => P.shoreFinalize(ctx, 0, 0)],
]) {
  let err = '';
  try { fn(); } catch (e) { err = ' ✗ ' + String(e).slice(0, 40); }
  const now = cnt();
  const delta = now - prev;
  console.log(name.padEnd(26) + ' water=' + String(now).padEnd(6) +
    '  Δ=' + (delta >= 0 ? '+' + delta : delta) + '   ' +
    (delta !== 0 ? '★' : '') + err);
  rows.push([name, prev, now, delta]);
  prev = now;
}

console.log('');
console.log('=== 流失点 ===');
for (const [name, a, b, d] of rows) {
  if (d !== 0) console.log('  ' + name.padEnd(24) + a + ' → ' + b + '   (' + d + ')');
}
console.log('');
console.log('最终 tile top6: ' + top(6));
console.log('');
console.log('=== 孤儿回填检查 ===');
const t = tables;
const inFam = (v, base, len) => base !== undefined && base >= 0 && v >= base && v < base + len;
const FAMS = [
  ['clear', 0, 1], ['ramp', t.rampBase, 19], ['cliff', t.cliffSet, 16 * 14],
  ['shore', t.shorePieces, 42], ['water', t.waterSet, 14], ['green', t.greenTile, 1],
  ['sand', t.sandTile, 1], ['rough', t.roughTile, 1],
];
for (const [nm, base, len] of FAMS) {
  console.log('  ' + nm.padEnd(8) + ' [' + base + '..' + (base + len - 1) + ']' +
    (nm === 'water' ? '  ← ★ 是否在 pipeline 的 inFam 列表里？' : ''));
}
