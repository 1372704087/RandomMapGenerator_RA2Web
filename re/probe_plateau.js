/**
 * `probe_plateau.js` —— 阶段 7（台地/分裂）现状探针
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const fs = require('fs');
const { deriveDimensions } = require(B + '/dist/rmg/options.js');
const { loadSed } = require(B + '/dist/rmg/sed.js');
const { parseTheaterIni } = require(B + '/dist/rmg/theater.js');
const { RmgRng } = require(B + '/dist/rmg/rng.js');
const pipe = require(B + '/dist/rmg/pipeline.js');
const rsMod = require(B + '/dist/rmg/regions.js');
const tables = parseTheaterIni(
  fs.readFileSync('G:/ra2-web-mapgen/packages/server/resources/theater/temperatmd.ini', 'utf8'),
  'TEMPERATE');

for (const f of process.argv.slice(2)) {
  const sed = loadSed(fs.readFileSync(f).toString('latin1'));
  const st = pipe.mapPrep({
    seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
    numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
    tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
    theater: sed.theater, dimensions: deriveDimensions(sed), tables,
  }, RmgRng.fromSeed(sed.seed));
  pipe.runWaterStage(st);
  pipe.runRegionStage(st);
  const before = st.regions.regions.length;
  const lvBefore = st.regions.regions.map((r) => r.level);
  const tried = pipe.runPlateauStage(st);
  const after = st.regions.regions.length;
  // level 分布
  const lv = new Map();
  for (const c of st.ctx.cells.iterate()) lv.set(c.level, (lv.get(c.level) || 0) + 1);
  const lvs = [...lv.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => k + ':' + v).join(' ');
  console.log(f.split('/').pop() +
    ' 区域 ' + before + '→' + after +
    ' | 区域level=' + JSON.stringify([...new Set(lvBefore)]) +
    ' → ' + JSON.stringify([...new Set(st.regions.regions.map((r) => r.level))]) +
    ' | cell level: ' + lvs);
}
