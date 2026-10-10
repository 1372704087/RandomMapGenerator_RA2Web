/**
 * `probe_shore.js` —— 岸线盖章路径逐层探针
 *
 * 统计 shoreFinalize 四个趟里：
 *   - 每趟被调用的格数
 *   - Pass34 里 rawMask===0 提前返回的次数（掩码全 0 → 根本没识别出岸）
 *   - v12 选出的分布
 *   - shoreStampTile 的四种退出：盖章成功 / 兼容放行(true) / 冲突(false) / 跳过(true)
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const fs = require('fs');
const w = require(B + '/dist/rmg/water.js');
const { generateFullMap } = require(B + '/dist/rmg/pipeline.js');
const { deriveDimensions } = require(B + '/dist/rmg/options.js');
const { loadSed } = require(B + '/dist/rmg/sed.js');
const { parseTheaterIni } = require(B + '/dist/rmg/theater.js');
const { RmgRng } = require(B + '/dist/rmg/rng.js');

const SED = process.argv[2];
const NAMES = ['TEMPERATE', 'DESERT', 'SNOW', 'URBAN', 'URBAN_NIGHT'];
const sed = loadSed(fs.readFileSync(SED).toString('latin1'));
const t = parseTheaterIni(
  fs.readFileSync('G:/ra2-web-mapgen/packages/server/resources/theater/temperatmd.ini', 'utf8'),
  NAMES[sed.theater] || 'TEMPERATE');

console.log('SED: MapType=' + sed.mapType + ' Seed=' + sed.seed + ' Water=' + sed.waterAmount +
  ' Rugged=' + sed.ruggedness + ' RegionSize=' + sed.regionSize);

// 阶段推进到水体完成后，停在岸线终结前
const dims = deriveDimensions(sed);
const rng = RmgRng.fromSeed(sed.seed);
const pipe = require(B + '/dist/rmg/pipeline.js');
const state = pipe.mapPrep({
  seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
  numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
  tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
  theater: sed.theater, dimensions: dims, tables: t,
}, rng);
pipe.runWaterStage(state);

const ctx = state.ctx;

// 岸线掩码分布：先看探针能不能看到岸
const probeCount = { p0: 0, p1: 0, p2: 0 };
const maskHist = new Map();
let cells = 0;
for (const cell of ctx.cells.iterate()) {
  const [x, y] = w.coordOfCell(ctx, cell);
  cells++;
  const p2 = w.shoreMaskProbe(ctx, x, y, 2);
  if (p2 !== 0) {
    probeCount.p2++;
    maskHist.set(p2, (maskHist.get(p2) || 0) + 1);
  }
  const p0 = w.shoreMaskProbe(ctx, x, y, 0);
  if (p0 !== 0) probeCount.p0++;
  const p1 = w.shoreMaskProbe(ctx, x, y, 1);
  if (p1 !== 0) probeCount.p1++;
}
console.log('');
console.log('格数=' + cells);
console.log('掩码非零格: probe0(clear)=' + probeCount.p0 + '  probe1(非水)=' + probeCount.p1 +
  '  probe2(无过滤)=' + probeCount.p2);
const top = [...maskHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
console.log('probe2 掩码分布 top20: ' + top.map(([m, c]) => m.toString(16) + ':' + c).join(' '));

// 水格数
let water = 0, clear = 0, other = 0;
for (const cell of ctx.cells.iterate()) {
  if (w.isWaterTile(cell, t)) water++;
  else if (w.isClearTile(cell)) clear++;
  else other++;
}
console.log('水=' + water + ' clear=' + clear + ' 其它=' + other);

// 跑真正的岸线终结
const before = [];
for (const cell of ctx.cells.iterate()) before.push(cell.tile);
const rc = w.shoreFinalize(ctx, 0, 0);
let shore = 0, changed = 0;
let i = 0;
for (const cell of ctx.cells.iterate()) {
  if (cell.tile >= t.shorePieces && cell.tile < t.shorePieces + 42) shore++;
  if (cell.tile !== before[i]) changed++;
  i++;
}
console.log('');
console.log('shoreFinalize 返回=' + rc);
console.log('岸线片格数=' + shore + '  tile 变化格数=' + changed);