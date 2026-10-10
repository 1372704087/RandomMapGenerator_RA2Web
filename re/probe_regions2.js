/** `probe_regions2.js` —— 逐阶段看区域划分 */
const w = require('G:/ra2-web-mapgen/packages/core/dist/rmg/water.js');
const { NativeCells, ScratchGrid } = require('G:/ra2-web-mapgen/packages/core/dist/rmg/native.js');
const { parseTheaterIni } = require('G:/ra2-web-mapgen/packages/core/dist/rmg/theater.js');
const { RmgRng, RmgGaussian } = require('G:/ra2-web-mapgen/packages/core/dist/rmg/rng.js');
const rg = require('G:/ra2-web-mapgen/packages/core/dist/rmg/regions.js');
const fs = require('fs');

const tables = parseTheaterIni(fs.readFileSync('G:/openyrweb/尤里复仇配置文件/temperatmd.ini', 'utf8'), 'TEMPERATE');
const cells = new NativeCells(24, 30);
cells.allocate();
const scratch = new ScratchGrid(cells.linearW);
for (let y = 0; y < cells.mapW + cells.mapH + 4; y++) {
  for (let x = 0; x < cells.mapW + cells.mapH + 4; x++) {
    if (cells.slotAt(x, y) !== null) scratch.at(x, y).coord = ((y & 0xffff) << 16) | (x & 0xffff);
  }
}
const ctx = {
  rng: RmgRng.fromSeed(1234), gaussian: new RmgGaussian(),
  cells, scratch, theater: tables, blobCounter: { value: 0 },
  mapType: 1, waterAmount: 40, numPlayers: 2, defaultLevel: 4, ruggedness: 30,
  vegetation: 60, widthLevel: 0, maxTrees: 600, theaterIndex: 0,
  tiberiumLayout: 50, resources: 1, tiberiumPercent: 20, startQuota: 4,
  starts: { waypoints: [] }, isoTileTypeCount: tables.totalTiles,
  terrainObjects: [], structures: [],
};
w.waterBasic(ctx);
w.waterFinalize(ctx);

const rs = rg.createRegionState();
rg.regionPartition(ctx, rs);
console.log('partition 后: 区域数=' + rs.regions.length +
  ' counts=[' + rs.regions.map((r) => r.cellCount).join(',') + ']');
let unclaimed = 0, claimed = 0;
for (const s of scratch.slots) {
  if (s.coord === 0) continue;
  if (s.regionId === -1) unclaimed++; else claimed++;
}
console.log('  已认领=' + claimed + ' 未认领=' + unclaimed);
rg.regionFallback(ctx, rs, 0);
console.log('fallback 后: 区域数=' + rs.regions.length +
  ' counts=[' + rs.regions.map((r) => r.cellCount).join(',') + ']');
let unclaimed2 = 0;
for (const s of scratch.slots) { if (s.coord !== 0 && s.regionId === -1) unclaimed2++; }
console.log('  仍未认领=' + unclaimed2);
//加 BFS 两趟
const before = rs.regions.map(r=>({id:r.id,water:r.water,count:r.cellCount}));
for (const region of rs.regions) {
  if (region.water === 0) continue;
  rg.regionBfs1(ctx, region, (region.cellCount > 8000 ? 1 : 0) + 1 + 4);
  rg.regionBfs2(ctx, region);
}
console.log('BFS 后: 区域数=' + rs.regions.length + ' counts=[' + rs.regions.map(r=>r.cellCount).join(',') + ']');
console.log('BFS 前: ' + JSON.stringify(before));
