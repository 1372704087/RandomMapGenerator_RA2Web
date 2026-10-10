/**
 * 验证实验：`FlatTemplateProvider.subExists` 只认 subtile===0，
 * 而 `waterFinalize` 用 `placeTileBlock` 写的 subtile = j*w+i（≠0）
 * ⇒ `runRecalcStage`（0x47D2B0）把这些水格全抹成 tile=0。
 *
 * 实测（探针 v4）：
 *   generateWaterStage 后  water=11124 (48.2%)  ← 与真机 49.4% 吻合
 *   runRecalcStage       water=4287  (18.6%)  ← 单阶段掉 6837 格
 *
 * 本实验：让 subExists 对水/崖/岸族一律返回 true，看 water 是否保住。
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const DIST = B + '/dist/rmg/recalc.js';
const fs = require('fs');
const { parseTheaterIni } = require(B + '/dist/rmg/theater.js');
const { loadSed } = require(B + '/dist/rmg/sed.js');
const { deriveDimensions } = require(B + '/dist/rmg/options.js');
const { IniFile } = require(B + '/dist/io/iniFile.js');
const { decompressRange } = require(B + '/dist/format/minilzo.js');

const tables = parseTheaterIni(
  fs.readFileSync('G:/ra2-web-mapgen/packages/server/resources/theater/temperatmd.ini', 'utf8'), 'TEMPERATE');
const LO = tables.waterSet, HI = tables.waterSet + 13;

const orig = fs.readFileSync(DIST, 'utf8');
const i0 = orig.indexOf('subExists(_tile, subtile)');
if (i0 < 0) { console.log('✗ 未找到 subExists'); process.exit(1); }
const bodyStart = orig.indexOf('{', i0);
const bodyEnd = orig.indexOf('}', bodyStart);
console.log('[原实现] ' + orig.slice(i0, bodyEnd + 1).replace(/\s+/g, ' '));
console.log('');

// 找到 this 引用方式
const usesThis = orig.slice(bodyStart, bodyEnd + 1).includes('this');
console.log('[是否用 this] ' + usesThis);
console.log('');

const sed = loadSed(fs.readFileSync('F:/YTLauncher/RandMap.Sed').toString('latin1'));
const dims = deriveDimensions(sed);
const input = {
  seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
  numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
  tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
  theater: sed.theater, dimensions: dims, tables,
};

function runWithDist(tag) {
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(B + '/dist/rmg/')) delete require.cache[k];
  }
  const P = require(B + '/dist/rmg/pipeline.js');
  const st = P.generateWaterStage(input);
  const ctx = st.ctx;
  const cnt = () => {
    let w = 0;
    for (const cell of ctx.cells.iterate()) {
      const t = cell.tile;
      if (t >= LO && t <= HI) w += 1;
    }
    return w;
  };
  const a = cnt();
  P.runRecalcStage(st);
  const b = cnt();
  console.log(tag.padEnd(30) + ' recalc前=' + String(a).padEnd(6) +
    ' recalc后=' + String(b).padEnd(6) + '  变化=' + (b - a));
  return { a, b };
}

try {
  // A: 现状
  runWithDist('A 现状（subExists 只认 0）');

  // B: 让 subExists 对所有 tile 都返回 true
  const patched = orig.slice(0, bodyStart + 1) +
    ' return subtile === 0 || true;' + orig.slice(bodyEnd);
  fs.writeFileSync(DIST, patched);
  runWithDist('B subExists 全 true');

  // C: 只对水/崖/岸族放行（更贴近原生语义）
  const patched2 = orig.slice(0, bodyStart + 1) +
    ' const t = arguments.length > 0 ? arguments[0] : 0;' +
    ' return subtile === 0 || true;' + orig.slice(bodyEnd);
  // 用 this 更可靠：先看类里怎么存的 theater
  fs.writeFileSync(DIST, patched2);
  runWithDist('C (同 B，备用)');
} finally {
  fs.writeFileSync(DIST, orig);
  console.log('\n(已复原 dist/recalc.js)');
}
