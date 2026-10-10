/**
 * 探针 v3（简版）：`waterBasic` 各步骤的 tile 快照。
 *
 * 【关键模型修正】`waterBasic`（`water.ts:756`）是「先铺满水，再打洞」：
 *   ① 全图 tile := waterSet      ← 24128 格全变水
 *   ② waterShape0/1/2            ← landBlobFlood 把水**挖成陆**
 *   ③ 孤立水清除
 *   ④ shoreFinalize(0,0) + regionId/patchId = -1
 *   ⑤ 岸→绿
 * 探针 v2 实测：挖陆 placed=8315 ⇒ 理论剩水 15813，但最终输出只 5731 ⇒ 少了 10082 格。
 * ⇒ 本探针定位是**哪一步**清掉的。
 *
 * 做法：临时给 dist/rmg/water.js 注入一个 __snap(tag) 函数并 export，
 *      再在外部调用 W2.__snap()。
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const DIST = B + '/dist/rmg/water.js';
const fs = require('fs');
const { parseTheaterIni } = require(B + '/dist/rmg/theater.js');
const { loadSed } = require(B + '/dist/rmg/sed.js');
const { deriveDimensions } = require(B + '/dist/rmg/options.js');
const { NativeCells, ScratchGrid } = require(B + '/dist/rmg/native.js');

const tables = parseTheaterIni(
  fs.readFileSync('G:/ra2-web-mapgen/packages/server/resources/theater/temperatmd.ini', 'utf8'), 'TEMPERATE');
const LO = tables.waterSet, HI = tables.waterSet + 13;

const orig = fs.readFileSync(DIST, 'utf8');
const SNAPPER = [
  'function __snap(tag) {',
  '  const c = globalThis.__CTX.cells;',
  '  let w = 0, clear = 0, other = 0;',
  '  const hist = new Map();',
  '  for (const cell of c.iterate()) {',
  '    const t = cell.tile;',
  '    if (t >= ' + LO + ' && t <= ' + HI + ') w++;',
  '    else if (t === 0) clear++;',
  '    else other++;',
  '    hist.set(t, (hist.get(t) || 0) + 1);',
  '  }',
  '  globalThis.__SNAPS.push({ tag: tag, w: w, clear: clear, other: other,',
  '    top: [...hist.entries()].sort(function (a, b) { return b[1] - a[1]; }).slice(0, 4)',
  '      .map(function (e) { return e[0] + "#" + e[1]; }).join(" ") });',
  '}',
  'exports.__snap = __snap;',
].join('\n');

const MARKS = [
  ['    // 1. 全图 tile := waterSet', '    __snap("1 铺水后");'],
  ['    // 2. 形状派发', '    __snap("2 形状派发后 (=水变陆完成)");'],
  ['    // 3. 孤立水清除', '    __snap("3 孤立水清除后");'],
  ['    // 4. 区域重置', '    __snap("4 区域重置后");'],
  ['    // 5. 岸→绿', '    __snap("5 岸→绿后");'],
];
let patched = SNAPPER + '\n' + orig;
let ok = true;
for (const [anchor, ins] of MARKS) {
  if (!patched.includes(anchor)) { console.log('✗ 未找到: ' + anchor.trim()); ok = false; break; }
  patched = patched.replace(anchor, ins + '\n' + anchor);
}
if (ok) {
  const endAnchor = '}\n// ─── 水体终结器';
  if (patched.includes(endAnchor)) {
    patched = patched.replace(endAnchor, '    __snap("6 waterBasic 结束");\n' + endAnchor);
  } else { console.log('✗ 未找到 waterBasic 结尾'); ok = false; }
}
if (!ok) process.exit(1);

globalThis.__SNAPS = [];
globalThis.__CTX = null;
fs.writeFileSync(DIST, patched);
try {
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(B + '/dist/rmg/')) delete require.cache[k];
  }
  const W2 = require(B + '/dist/rmg/water.js');
  const sed = loadSed(fs.readFileSync('F:/YTLauncher/RandMap.Sed').toString('latin1'));
  const dims = deriveDimensions(sed);

  const cells = new NativeCells(dims.mapW, dims.mapH);
  cells.allocate();
  const scratch = new ScratchGrid(cells.linearW);
  for (const s of scratch.slots) { s.regionId = -1; s.patchId = -1; }

  let rnd = 987654321;
  const ctx = {
    rng: { next: () => { rnd = (rnd * 1103515245 + 12345) & 0x7fffffff; return rnd / 0x7fffffff; } },
    gaussian: { next: () => 0.5 },
    cells, scratch, theater: tables,
    blobCounter: { value: 0 }, mapType: sed.mapType, waterAmount: sed.waterAmount,
    numPlayers: sed.numPlayers, defaultLevel: 4, isoTileTypeCount: tables.totalTiles,
    ruggedness: sed.ruggedness, vegetation: sed.vegetation, widthLevel: 3, maxTrees: 500,
    theaterIndex: 0, tiberiumLayout: sed.tiberiumLayout, startQuota: 4, waterUsedArea: 0,
    starts: { waypoints: [] }, terrainObjects: [], structures: [],
    diamondMin: cells.mapW, diamondMax: cells.mapW + 2 * cells.mapH,
  };
  globalThis.__CTX = ctx;

  W2.__snap('0 初始（全 clear）');
  W2.waterBasic(ctx);
  W2.__snap('7 waterFinalize 前');
  W2.waterFinalize(ctx);
  W2.__snap('8 waterFinalize 后');

  const area = 2 * dims.mapW * (dims.mapH + 4);
  console.log('=== waterBasic 分步快照（mapType=1, 菱形 area=' + area + '）===');
  for (const s of globalThis.__SNAPS) {
    console.log(s.tag.padEnd(28) + ' water=' + String(s.w).padEnd(6) +
      ' clear=' + String(s.clear).padEnd(6) + ' other=' + String(s.other).padEnd(6) +
      '   top4: ' + s.top);
  }
  console.log('');
  console.log('真机最终 water = 11463 / 23184 = 49.4%');
} finally {
  fs.writeFileSync(DIST, orig);
  console.log('(已复原 dist)');
}
