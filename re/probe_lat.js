/** `probe_lat.js` —— 复现 lat 测试「有岩石 overlay」失败并定位 */
const p = require('G:/ra2-web-mapgen/packages/core/dist/rmg/pipeline.js');
const { deriveDimensions } = require('G:/ra2-web-mapgen/packages/core/dist/rmg/options.js');
const { parseTheaterIni } = require('G:/ra2-web-mapgen/packages/core/dist/rmg/theater.js');
const fs = require('fs');

const tables = parseTheaterIni(fs.readFileSync('G:/openyrweb/尤里复仇配置文件/temperatmd.ini', 'utf8'), 'TEMPERATE');
const d = deriveDimensions({
  seed: 24680, mapType: 1, resources: 1, ruggedness: 30, time: 1,
  waterAmount: 30, numPlayers: 2, tiberium: 20, tiberiumLayout: 50,
  vegetation: 80, urbanPresence: 0, width: 0, height: 0,
  accessibility: 50, regionSize: 50,
});
const st = p.generateThroughLat({
  seed: 24680, mapType: 1, waterAmount: 30, numPlayers: 2, ruggedness: 30,
  vegetation: 80, tiberiumLayout: 50, tiberium: 20, resources: 1, theater: 0,
  dimensions: d, tables,
});
const ctx = st.ctx;
let roughLat = 0, sandLat = 0, greenLat = 0;
for (const c of ctx.cells.iterate()) {
  if (c.tile >= tables.clearToRoughLat && c.tile < tables.clearToRoughLat + 16) roughLat++;
  if (c.tile >= tables.clearToSandLat && c.tile < tables.clearToSandLat + 16) sandLat++;
  if (c.tile >= tables.clearToGreenLat && c.tile < tables.clearToGreenLat + 16) greenLat++;
}
console.log('LAT贴片 rough=' + roughLat + ' sand=' + sandLat + ' green=' + greenLat);
console.log('树=' + ctx.terrainObjects.length);
const ov = new Map();
let rocks = 0;
for (const c of ctx.cells.iterate()) {
  if (c.overlay >= 0) ov.set(c.overlay, (ov.get(c.overlay) || 0) + 1);
  if (c.overlay >= 168 && c.overlay <= 177) rocks++;
}
console.log('岩石(168..177)=' + rocks);
console.log('overlay 分布: ' + [...ov.entries()].sort((a, b) => a[0] - b[0])
  .map(([k, v]) => k + ':' + v).join(' '));

// 族分布
const fams = new Map();
for (const c of ctx.cells.iterate()) {
  let k = 'other:' + c.tile;
  if (require('G:/ra2-web-mapgen/packages/core/dist/rmg/water.js').isWaterTile(c, tables)) k = 'water';
  else if (require('G:/ra2-web-mapgen/packages/core/dist/rmg/water.js').isShorePieceTile(c, tables)) k = 'shore';
  else if (c.tile === 0 || c.tile === 0xffff) k = 'clear';
  fams.set(k, (fams.get(k) || 0) + 1);
}
console.log('族分布: ' + [...fams.entries()].sort((a, b) => b[1] - a[1])
  .map(([k, v]) => k + ':' + v).join('  '));
// 复算placeRocks 的限额
const area = 2 * ctx.cells.mapW * (ctx.cells.mapH + 4);
console.log('mapW=' + ctx.cells.mapW + ' mapH=' + ctx.cells.mapH +
  ' area=' + area + ' limit=' + Math.trunc(area / 200));
