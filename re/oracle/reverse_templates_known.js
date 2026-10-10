/**
 * 从「已知参数 + 真机结果」反推模板元数据 —— 比基线反推可信得多。
 * 数据源：F:/YTLauncher/RandMap.Map（theater=0 温带，MapType=1，seed=40708）
 *
 * 优势 vs 上一版（`reverse_template_from_baseline.js`）：
 *  - 知道 theater 与 tile 集，可按族归类
 *  - 可以统计「每个 tile 实际用到哪些 subIndex」的**完整映射**
 *    （基线只给下界，这里因为图更大/更多样，覆盖更全）
 */
const fs = require('fs');
const path = require('path');
const CORE = path.join(__dirname, '..', '..', 'packages', 'core');
const { IniFile } = require(path.join(CORE, 'dist/io/iniFile.js'));
const { decompressRange } = require(path.join(CORE, 'dist/format/minilzo.js'));
const { parseTheaterIni } = require(path.join(CORE, 'dist/rmg/theater.js'));

const MAP = process.env.RMG_KNOWN_MAP ?? 'F:/YTLauncher/RandMap.Map';
const THEATER = 'G:/ra2-web-mapgen/packages/server/resources/theater/temperatmd.ini';
const t = parseTheaterIni(fs.readFileSync(THEATER, 'utf8'), 'TEMPERATE');

function parseIso(ini) {
  const sec = ini.GetSection('IsoMapPack5'); if (!sec) return null;
  const keys = sec.Keys.slice().sort((a, b) => Number(a) - Number(b));
  const raw = Buffer.from(keys.map((k) => sec.GetStringValue(k, '')).join(''), 'base64');
  let r = 0; const parts = [];
  while (r + 4 <= raw.length) {
    const si = raw.readUInt16LE(r), so = raw.readUInt16LE(r + 2);
    if (!si || !so) break; r += 4;
    const o = new Uint8Array(so + 1024);
    decompressRange(new Uint8Array(raw), r, si, o, 0);
    parts.push(Buffer.from(o.slice(0, so))); r += si;
  }
  return Buffer.concat(parts);
}
function fam(ti) {
  if (ti >= t.cliffSet && ti < t.cliffSet + 16 * 14) return 'cliff';
  if (ti >= t.waterSet && ti < t.waterSet + 14) return 'water';
  if (ti >= t.shorePieces && ti < t.shorePieces + 42) return 'shore';
  if (ti >= t.rampBase && ti < t.rampBase + 19) return 'ramp';
  return 'ground';
}

const buf = parseIso(new IniFile(fs.readFileSync(MAP, 'latin1')));
const byTile = new Map();
for (let o = 0; o + 11 <= buf.length - 4; o += 11) {
  const x = buf.readInt16LE(o), y = buf.readInt16LE(o + 2), ti = buf.readInt32LE(o + 4);
  if (x === 0 && y === 0 && ti === 0) break;
  let e = byTile.get(ti);
  if (!e) { e = { subs: new Set(), lvls: new Set(), fams: new Set(), n: 0 }; byTile.set(ti, e); }
  e.subs.add(buf[o + 8]); e.lvls.add(buf[o + 9]); e.fams.add(fam(ti)); e.n += 1;
}

const tiles = [...byTile.entries()].map(([tile, e]) => ({
  tile, family: [...e.fams][0], samples: e.n,
  subCount: e.subs.size, subIndex: [...e.subs].sort((a, b) => a - b),
  levelCount: e.lvls.size, minLevel: Math.min(...e.lvls), maxLevel: Math.max(...e.lvls),
})).sort((a, b) => a.tile - b.tile);

// 全图 SubIdx 集合（这是最直接的证据）
const allSubs = new Set();
for (const x of tiles) for (const s of x.subIndex) allSubs.add(s);
const byFam = {};
for (const x of tiles) {
  byFam[x.family] = byFam[x.family] || { n: 0, multi: 0, maxSub: 0 };
  byFam[x.family].n += 1;
  if (x.subCount > 1) byFam[x.family].multi += 1;
  byFam[x.family].maxSub = Math.max(byFam[x.family].maxSub, x.subCount);
}
const multi = tiles.filter((x) => x.subCount > 1);

const out = {
  source: 'F:/YTLauncher/RandMap.Map (theater=0 TEMPERATE, MapType=1, seed=40708, 8p)',
  caveat: 'subIndex 映射为实测集合；模板维度 w*h 是其上界（原生用 subtile % (w*h)）。',
  theater: { cliffSet: t.cliffSet, waterSet: t.waterSet, shorePieces: t.shorePieces, rampBase: t.rampBase },
  summary: {
    distinctTiles: tiles.length,
    globalSubIndex: [...allSubs].sort((a, b) => a - b),
    multiSubTiles: multi.length,
    maxSubCount: Math.max(...tiles.map((x) => x.subCount)),
    byFamily: byFam,
  },
  tiles,
};
const dst = path.join(__dirname, 'vectors', 'templates_known.json');
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.writeFileSync(dst, JSON.stringify(out, null, 2), 'utf8');

console.log('数据源 = RandMap.Map (theater=0 温带, MapType=1, seed=40708)');
console.log('不同 tileIndex = %d   全图 SubIndex 集合 = %s', tiles.length,
  JSON.stringify(out.summary.globalSubIndex));
console.log('多子格 tile = %d (%.0f%%)   最多子格 = %d',
  multi.length, multi.length / tiles.length * 100, out.summary.maxSubCount);
console.log('按族:', JSON.stringify(byFam));
console.log('\n多子格 tile（前 14）:');
for (const x of multi.slice(0, 14)) {
  console.log('  tile %d [%s] subIndex=%s level=%d..%d',
    x.tile, x.family, JSON.stringify(x.subIndex), x.minLevel, x.maxLevel);
}
console.log('\n输出 =', dst);
