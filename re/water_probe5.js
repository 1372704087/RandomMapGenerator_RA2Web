/**
 * 探针 v5（修正）：定位 `runRecalcStage` 里把水格改掉的**语句**。
 *
 * 已排除（改 dist 实验，输出均无变化）：
 *   ✗ `cell.tile >= isoTileTypeCount`（838 > 314，不触发）
 *   ✗ `tp.subExists` 只认 subtile===0（放开后 -6837 一模一样）
 *   ✗ LAT auto-mask 四族（rough 132..147 / sand 419..434 / green 494..509 / pave 463..478
 *     与水族 314..327 **完全不重叠**）
 *
 * 做法：把 recalc.js 里**所有** `cell.tile = …` 改写成探针包装，
 *      记录「改写前 tile 是否为水格」。
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
const patchedLines = lines.map((l) => {
  const m = l.match(/^(\s*)cell\.tile = (.+);(\s*)$/);
  if (!m) return l;
  n += 1;
  const indent = m[1]; const rhs = m[2]; const tail = m[3];
  const tag = n;
  return indent + 'cell.tile = (globalThis.__WR(cell, ' + rhs + ', ' + tag + '));' + tail;
});
if (n === 0) { console.log('✗ 未找到任何 cell.tile 写入'); process.exit(1); }
console.log('包裹 ' + n + ' 处 cell.tile 赋值');
const patched = patchedLines.join('\n');

globalThis.__WATERWR = [];
// ⚠ 注入的 `__WR` 在 dist 模块作用域内能见到 globalThis.__WR，
//   所以必须在 require 之前定义好。
globalThis.__WR = function (cell, val, tag) {
  const t = cell.tile;
  if (t >= LO && t <= HI) globalThis.__WATERWR.push({ tag: tag, from: t, to: val });
  return val;
};
fs.writeFileSync(DIST, patched);
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
  const ctx = st.ctx;
  const cnt = () => {
    let w = 0;
    for (const c of ctx.cells.iterate()) if (c.tile >= LO && c.tile <= HI) w += 1;
    return w;
  };
  const before = cnt();
  globalThis.__WATERWR = [];
  P.runRecalcStage(st);
  const after = cnt();
  console.log('recalc 前 water=' + before + '   后 water=' + after + '   差=' + (after - before));
  const log = globalThis.__WATERWR;
  console.log('');
  console.log('=== 被改写的水格写入记录（共 ' + log.length + ' 条）===');
  const byTag = new Map();
  for (const e of log) {
    const k = e.tag + ': ' + e.from + ' -> ' + (typeof e.to === 'number' ? e.to : 'expr');
    byTag.set(k, (byTag.get(k) || 0) + 1);
  }
  const sorted = [...byTag.entries()].sort((a, b) => b[1] - a[1]);
  for (const [k, v] of sorted.slice(0, 14)) console.log('  #' + k + '   × ' + v);
  console.log('');
  console.log('⇒ 差额 ' + (before - after) + '，上表合计 ' + log.length);
  if (log.length === 0) {
    console.log('⚠ waterRecalc 的 cellRecalc 里没有改写水格 ⇒ 水是在**别的函数**里丢的');
  }
} finally {
  fs.writeFileSync(DIST, orig);
  console.log('\n(已复原 dist)');
}
