/**
 * 探针：量测 `landBlobFlood` 每轮实际吃多少、为什么不铺满配额。
 * 逐轮打印 quota / 返回值 / 累计 / 是否触发 rollback。
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const path = require('path');
const DIST = B + '/dist/rmg/water.js';
const fs = require('fs');

// --- 注入探针：在 landBlobFlood 的返回处打印 ---
const orig = fs.readFileSync(DIST, 'utf8');
const anchor = "    if (shoreOk) {\n        ctx.blobCounter.value = blobId + 1;\n        return pops;";
if (!orig.includes(anchor)) {
  console.log('✗ 找不到注入锚点；改用替代方案');
  process.exit(1);
}
fs.writeFileSync(DIST, orig.replace(anchor,
  "    if (shoreOk) {\n" +
  "        ctx.blobCounter.value = blobId + 1;\n" +
  "        if (globalThis.__PROBE) globalThis.__PROBE.push({ quota: target, pops, ok: 1 });\n" +
  "        return pops;"));
fs.writeFileSync(DIST, fs.readFileSync(DIST, 'utf8').replace(
  "    // 回滚：本 blob 退回水底",
  "    if (globalThis.__PROBE) globalThis.__PROBE.push({ quota: target, pops, ok: 0 });\n" +
  "    // 回滚：本 blob 退回水底"));

globalThis.__PROBE = [];
try {
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(B + '/dist/rmg/')) delete require.cache[k];
  }
  const { generateFullMap } = require(B + '/dist/rmg/pipeline.js');
  const { loadSed } = require(B + '/dist/rmg/sed.js');
  const { deriveDimensions } = require(B + '/dist/rmg/options.js');
  const { parseTheaterIni } = require(B + '/dist/rmg/theater.js');
  const tables = parseTheaterIni(
    fs.readFileSync('G:/ra2-web-mapgen/packages/server/resources/theater/temperatmd.ini', 'utf8'), 'TEMPERATE');
  const sed = loadSed(fs.readFileSync('F:/YTLauncher/RandMap.Sed').toString('latin1'));
  const dims = deriveDimensions(sed);
  generateFullMap({
    seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
    numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
    tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
    theater: sed.theater, dimensions: dims, tables,
  }, 'Random Map');

  const p = globalThis.__PROBE;
  const ok = p.filter((x) => x.ok === 1);
  const bad = p.filter((x) => x.ok === 0);
  const sum = p.reduce((a, b) => a + b.pops, 0);
  console.log('landBlobFlood 调用次数 = ' + p.length);
  console.log('  成功 shoreOk = ' + ok.length + '   回滚 = ' + bad.length);
  console.log('  pops 累计 = ' + sum);
  console.log('  quota 范围 = ' + Math.min(...p.map((x) => x.quota)) + ' .. ' +
    Math.max(...p.map((x) => x.quota)));
  console.log('  每轮 pops: ' + p.map((x) => x.pops).join(' '));
  console.log('  每轮 ok  : ' + p.map((x) => x.ok).join(' '));
  console.log('');
  console.log('⇒ 若成功轮少（大部分 ok=0），说明洪泛被中途否决 ⇒ 不是配额问题');
  console.log('⇒ 若成功轮的 pops 远小于 quota，说明扩散受限 ⇒ 检查 isWaterFamily/regionId 判定');
} finally {
  fs.writeFileSync(DIST, orig);
}
