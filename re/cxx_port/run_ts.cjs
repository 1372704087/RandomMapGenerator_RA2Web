// TS-side oracle runner: one generation with explicit seeds + params.
// Writes the .map and a diag log formatted identically to the exe's
// rmg_diag.log (GLOBAL-SEED line included).
//
// Usage: node re/cxx_port/run_ts.cjs --global-seed 0x00FF01EB [options]
//   --env 0..4 --time 0..3 --theater 0..1 --size 0..3 --ore 0..3
//   --players 0..6 (index) --gametype 0..1 --map-seed N
//   --out <path.map> (default .tmp_oracle/ts_<seed>.map)
//   --log <path>   (default .tmp_oracle/ts_diag.log)
//   --res <dir>    (default G:/MapGenerator/x64/Release)
'use strict';
const fs = require('fs');
const path = require('path');

function arg(name, def) {
  const a = process.argv;
  const i = a.indexOf('--' + name);
  if (i < 0 || i + 1 >= a.length) return def;
  return a[i + 1];
}
const num = (name, def) => {
  const v = arg(name, undefined);
  if (v === undefined) return def;
  return v.startsWith('0x') ? parseInt(v, 16) : parseInt(v, 10);
};

const globalSeed = num('global-seed', 0) >>> 0;
const mapSeed = num('map-seed', 0) >>> 0;
const params = {
  environment: num('env', 0),
  timeOfDay: num('time', 0),
  theater: num('theater', 0),
  mapSize: num('size', 0),
  oreDensity: num('ore', 0),
  playerIndex: num('players', 0),
  gameType: num('gametype', 0),
  globalSeed,
  mapSeed,
};

const outDir = '.tmp_oracle';
fs.mkdirSync(outDir, { recursive: true });
const outPath = arg('out', path.join(outDir, `ts_${globalSeed.toString(16)}.map`));
const logPath = arg('log', path.join(outDir, 'ts_diag.log'));
const resDir = arg('res', 'G:/MapGenerator/x64/Release');

const { setDiagSink } = require(path.join(__dirname, '../../packages/core/dist/rmg/cxx/diag.js'));
const logLines = [];
setDiagSink((line) => logLines.push(line));

const { generateMap } = require(path.join(__dirname, '../../packages/core/dist/rmg/cxx/generate.js'));

// WinMain emits the GLOBAL-SEED line before the body starts. The exe's
// source labels: tickcount (seed boxes removed from the UI) / default0.
const x8 = (v) => (v >>> 0).toString(16).toUpperCase().padStart(8, '0');
logLines.push(`GLOBAL-SEED ${x8(globalSeed)} source=tickcount MAP-SEED ${mapSeed >>> 0} source=${mapSeed ? 'input' : 'default0'}`);

const t0 = Date.now();
const { rmg, result } = generateMap(params, outPath, resDir);
const elapsed = Date.now() - t0;

fs.writeFileSync(logPath, logLines.join('\n') + '\n');

if (!result.ok) {
  console.log('GENERATION FAILED');
  process.exit(1);
}
console.log(`ok seed=${x8(globalSeed)} water=${result.waterAmount} cells=${result.cellCount} ` +
  `elapsed=${elapsed}ms map=${result.mapPath ?? '(not written)'}`);
