/**
 * 确认性实验 v6：让 `subExists` 对水 tile 放行，看 recalc 是否保住水。
 *
 * 原生语义（`0x544C20` 实测）：
 *   return v4 != null && subtile < v4[0]*v4[1] && v4[subtile+4] != 0
 *   ⇒ 判据是「**模板里该子格是否存在**」，不是「subtile===0」
 * 真机水格实测 subIndex = {0,1,2,3} 各占 1/4 ⇒ 模板里水 tile 有 4 个有效子格
 * ⇒ 原生不会抹掉；我们的占位 `subtile === 0` 抹掉 = **占位实现的必然后果**
 *
 * 本实验：按 theater 反推给水/崖/岸族分配合理的子格数，看 recalc 后 water。
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
const sed = loadSed(fs.readFileSync('F:/YTLauncher/RandMap.Sed').toString('latin1'));
const dims = deriveDimensions(sed);
const INPUT = {
  seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
  numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
  tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
  theater: sed.theater, dimensions: dims, tables,
};

const orig = fs.readFileSync(DIST, 'utf8');
// 精确定位：subExists(_tile, subtile) {\n <indent> return ...; \n <indent>}
const RE = /(subExists\(_tile, subtile\) \{\s*\n)(\s*)(return subtile === 0;)/;
const m = orig.match(RE);
if (!m) {
  console.log('✗ subExists 未匹配，打印附近：');
  const i = orig.indexOf('subExists(_tile');
  console.log(orig.slice(i, i + 160));
  process.exit(1);
}
console.log('[已匹配] ' + JSON.stringify(m[0]));

function runWithDist(tag) {
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(B + '/dist/rmg/')) delete require.cache[k];
  }
  const P = require(B + '/dist/rmg/pipeline.js');
  const st = P.generateWaterStage(INPUT);
  const ctx = st.ctx;
  const cnt = () => {
    let w = 0;
    for (const c of ctx.cells.iterate()) if (c.tile >= LO && c.tile <= HI) w += 1;
    return w;
  };
  const a = cnt();
  P.runRecalcStage(st);
  const b = cnt();
  console.log(tag.padEnd(34) + ' recalc前=' + String(a).padEnd(6) +
    ' recalc后=' + String(b).padEnd(6) + '  保住=' + (b / a * 100).toFixed(1) + '%');
  return b;
}

try {
  // A: 现状
  runWithDist('A 现状（subtile===0）');

  // B: 水族放行 4 子格（真机实测 {0,1,2,3}）
  fs.writeFileSync(DIST, orig.replace(RE,
    m[1] + m[2] +
    'const __t = _tile;\n' + m[2] +
    'if (__t >= ' + LO + ' && __t <= ' + HI + ') return subtile < 4;\n' +
    'return subtile === 0;'));
  runWithDist('B 水族放行 4 子格');

  // C: 全 tile 都放行 4 子格
  fs.writeFileSync(DIST, orig.replace(RE, m[1] + m[2] + 'return subtile < 4;'));
  const c2 = runWithDist('C 全 tile 放行 4 子格');

  // D: 全放行 + 跑完 generateFullMap 看最终形态
  {
    for (const k of Object.keys(require.cache)) {
      if (k.startsWith(B + '/dist/rmg/')) delete require.cache[k];
    }
    const P = require(B + '/dist/rmg/pipeline.js');
    const { ini } = P.generateFullMap(INPUT, 'Random Map');
    const sec = new IniFile(ini).GetSection('IsoMapPack5');
    const keys = sec.Keys.slice().sort((a, b) => Number(a) - Number(b));
    const raw = Buffer.from(keys.map((k) => sec.GetStringValue(k, '')).join(''), 'base64');
    let r = 0; const parts = [];
    while (r + 4 <= raw.length) {
      const si = raw.readUInt16LE(r); const so = raw.readUInt16LE(r + 2);
      if (!si || !so) break; r += 4;
      const o = new Uint8Array(so + 1024);
      decompressRange(new Uint8Array(raw), r, si, o, 0);
      parts.push(Buffer.from(o.slice(0, so))); r += si;
    }
    const buf = Buffer.concat(parts);
    const ts = [];
    for (let o = 0; o + 11 <= buf.length - 4; o += 11) {
      const x = buf.readInt16LE(o); const y = buf.readInt16LE(o + 2);
      const ti = buf.readInt32LE(o + 4);
      if (x === 0 && y === 0 && ti === 0) break;
      ts.push({ x, y, ti, sub: buf[o + 8] });
    }
    const water = ts.filter((t) => t.ti >= LO && t.ti <= HI);
    const tiles = new Map(); const subs = new Set();
    for (const t of water) { tiles.set(t.ti, (tiles.get(t.ti) || 0) + 1); subs.add(t.sub); }
    // blob
    const at = new Map();
    for (const t of water) at.set(t.x * 4096 + t.y, t);
    const seen = new Set(); const sizes = [];
    for (const p of water) {
      const k0 = p.x * 4096 + p.y;
      if (seen.has(k0)) continue;
      const stk = [p]; seen.add(k0); let n = 0;
      while (stk.length) {
        const cc = stk.pop(); n += 1;
        for (let d = 0; d < 8; d++) {
          const nx = cc.x + [1, -1, 0, 0, 1, 1, -1, -1][d];
          const ny = cc.y + [0, 0, 1, -1, 1, -1, 1, -1][d];
          const kk = nx * 4096 + ny;
          if (seen.has(kk)) continue;
          const cl = at.get(kk);
          if (cl) { seen.add(kk); stk.push(cl); }
        }
      }
      sizes.push(n);
    }
    sizes.sort((a, b) => b - a);
    console.log('');
    console.log('=== D: 全放行后的 generateFullMap 输出 ===');
    console.log('  总格=' + ts.length + '  water=' + water.length + ' (' +
      (water.length / ts.length * 100).toFixed(1) + '%)   真机 11463 (49.4%)');
    console.log('  blob 数=' + sizes.length + '  最大=' + (sizes[0] || 0) +
      '   真机 2 / 11356');
    console.log('  water tile 种=' + tiles.size + '  subIndex 种=' + subs.size +
      '   真机 14 / 4');
    console.log('  tile 细分: ' + [...tiles.entries()].sort((a, b) => a[0] - b[0])
      .map(([k, v]) => k + ':' + v).join(' '));
  }
} finally {
  fs.writeFileSync(DIST, orig);
  console.log('\n(已复原 dist)');
}
