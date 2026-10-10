/**
 * 探针 v2：确认「水」是 waterShape* 挖出来的**剩余区**，而不是 blobFlood 造出来的。
 *
 * 模型修正（`water.ts:756` `waterBasic`）：
 *   ① 全图 tile := waterSet      ← 整个菱形带先变成水
 *   ② waterShape0/1/2            ← **把水打成陆**（landBlobFlood 是挖洞工具！）
 *   ③ 孤立水清除（全 clear 邻 ⇒ 变回 0）
 *   ④ shoreFinalize(0,0) + regionId/patchId = -1
 *   ⑤ 岸→绿
 *
 * ⇒ 之前查「blob 被卡住」方向全反：`landBlobFlood` 不产水，它产**陆地**。
 *
 * 本探针在 waterShape1 的返回处打印配额命中情况，
 * 并统计「挖掉了多少陆地 / 剩多少水」。
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const DIST = B + '/dist/rmg/water.js';
const fs = require('fs');

const orig = fs.readFileSync(DIST, 'utf8');
// waterShape1 的末尾（`if (placed / area >= target) break;` 之后）
const ANCHOR = "        seedX = bx;\n        seedY = by;\n        if (placed / area >= target)\n            break;";
if (!orig.includes(ANCHOR)) {
  console.log('✗ 锚点未匹配，打印 waterShape1 尾部：');
  const i = orig.indexOf('function waterShape1');
  console.log(orig.slice(i, i + 1800).split('\n').slice(-22).join('\n'));
  process.exit(1);
}
fs.writeFileSync(DIST, orig.replace(ANCHOR, ANCHOR + '\n' +
  '    if (globalThis.__P2) globalThis.__P2.push({ iter: iter, quota: quota, placed: placed, target: target, area: area, cap: cap });'));

globalThis.__P2 = [];
try {
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(B + '/dist/rmg/')) delete require.cache[k];
  }
  const { generateFullMap } = require(B + '/dist/rmg/pipeline.js');
  const { loadSed } = require(B + '/dist/rmg/sed.js');
  const { deriveDimensions } = require(B + '/dist/rmg/options.js');
  const { parseTheaterIni } = require(B + '/dist/rmg/theater.js');
  const { IniFile } = require(B + '/dist/io/iniFile.js');
  const { decompressRange } = require(B + '/dist/format/minilzo.js');
  const tables = parseTheaterIni(
    fs.readFileSync('G:/ra2-web-mapgen/packages/server/resources/theater/temperatmd.ini', 'utf8'), 'TEMPERATE');

  const sed = loadSed(fs.readFileSync('F:/YTLauncher/RandMap.Sed').toString('latin1'));
  const dims = deriveDimensions(sed);
  const base = {
    seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
    numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
    tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
    theater: sed.theater, dimensions: dims, tables,
  };
  const { ini } = generateFullMap(base, 'Random Map');

  const p = globalThis.__P2;
  console.log('waterShape1 轮数 = ' + p.length);
  if (p.length) {
    console.log('target = ' + p[0].target.toFixed(4) + '   area = ' + p[0].area +
      '   cap = ' + Math.floor(p[0].cap));
    console.log('真需求 target*area = ' + Math.floor(p[0].target * p[0].area));
    console.log('');
    console.log('iter  quota   placed   placed/area');
    for (const r of p) {
      console.log(String(r.iter).padStart(3) + '  ' +
        String(Math.floor(r.quota)).padEnd(7) + ' ' +
        String(r.placed).padEnd(8) + ' ' +
        (r.placed / r.area).toFixed(4));
    }
    console.log('');
    console.log('⇒ placed 是【挖掉的陆地格数】。最终 placed/area = ' +
      (p[p.length - 1].placed / p[p.length - 1].area).toFixed(4) +
      ' ⇒ 留水 ' + (1 - p[p.length - 1].placed / p[p.length - 1].area).toFixed(4));
    console.log('⇒ 真机留水 0.4945（target）⇒ 应当挖掉 ' +
      (1 - p[0].target).toFixed(4) + ' = ' +
      Math.floor((1 - p[0].target) * p[0].area) + ' 格陆');
  }

  // 统计最终输出
  const sec = new IniFile(ini).GetSection('IsoMapPack5');
  const keys = sec.Keys.slice().sort((a, b) => Number(a) - Number(b));
  const raw = Buffer.from(keys.map((k) => sec.GetStringValue(k, '')).join(''), 'base64');
  let r2 = 0; const parts = [];
  while (r2 + 4 <= raw.length) {
    const si = raw.readUInt16LE(r2); const so = raw.readUInt16LE(r2 + 2);
    if (!si || !so) break; r2 += 4;
    const o = new Uint8Array(so + 1024);
    decompressRange(new Uint8Array(raw), r2, si, o, 0);
    parts.push(Buffer.from(o.slice(0, so))); r2 += si;
  }
  const buf = Buffer.concat(parts);
  let water = 0;
  for (let o = 0; o + 11 <= buf.length - 4; o += 11) {
    const x = buf.readInt16LE(o); const y = buf.readInt16LE(o + 2);
    const ti = buf.readInt32LE(o + 4);
    if (x === 0 && y === 0 && ti === 0) break;
    if (ti >= tables.waterSet && ti < tables.waterSet + 14) water += 1;
  }
  console.log('');
  console.log('最终输出 water = ' + water + ' / 23184 = ' + (water / 23184 * 100).toFixed(1) + '%');
  console.log('真机 11463 = 49.4%');
} finally {
  fs.writeFileSync(DIST, orig);
  console.log('\n(已复原 dist)');
}
