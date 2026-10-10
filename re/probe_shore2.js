/**
 * `probe_shore2.js` —— 定位 shoreFinalize 的中止点
 *
 * 分趟统计：每一趟被调用多少格、返回 0 的时刻、以及 mode=0/1 的差异。
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const fs = require('fs');
const w = require(B + '/dist/rmg/water.js');
const { loadSed } = require(B + '/dist/rmg/sed.js');
const { parseTheaterIni } = require(B + '/dist/rmg/theater.js');
const { deriveDimensions } = require(B + '/dist/rmg/options.js');
const { RmgRng } = require(B + '/dist/rmg/rng.js');
const pipe = require(B + '/dist/rmg/pipeline.js');

const SED = process.argv[2];
const NAMES = ['TEMPERATE', 'DESERT', 'SNOW', 'URBAN', 'URBAN_NIGHT'];
const sed = loadSed(fs.readFileSync(SED).toString('latin1'));
const t = parseTheaterIni(
  fs.readFileSync('G:/ra2-web-mapgen/packages/server/resources/theater/temperatmd.ini', 'utf8'),
  NAMES[sed.theater] || 'TEMPERATE');
const dims = deriveDimensions(sed);

function build() {
  const rng = RmgRng.fromSeed(sed.seed);
  const st = pipe.mapPrep({
    seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
    numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
    tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
    theater: sed.theater, dimensions: dims, tables: t,
  }, rng);
  pipe.runWaterStage(st);
  return st.ctx;
}

function snap(ctx) {
  const a = [];
  for (const c of ctx.cells.iterate()) a.push(c.tile);
  return a;
}
function count(ctx, snapA) {
  let shore = 0, changed = 0, i = 0;
  for (const c of ctx.cells.iterate()) {
    if (c.tile >= t.shorePieces && c.tile < t.shorePieces + 42) shore++;
    if (c.tile !== snapA[i]) changed++;
    i++;
  }
  return { shore, changed };
}

// regionId 分布（决定 Pass1 的 `regionId > 0 && !== tag` 中止条件）
const ctx0 = build();
const rid = new Map();
for (const s of ctx0.scratch.slots) rid.set(s.regionId, (rid.get(s.regionId) || 0) + 1);
console.log('scratch.regionId 分布: ' + [...rid.entries()].sort((a, b) => a[0] - b[0])
  .map(([k, v]) => k + ':' + v).join('  '));

for (const mode of [0, 1]) {
  const ctx = build();
  const a = snap(ctx);
  const rc = w.shoreFinalize(ctx, 0, mode);
  const r = count(ctx, a);
  console.log('mode=' + mode + '  返回=' + rc + '  岸线片=' + r.shore + '  tile变化=' + r.changed);
}