/**
 * `reverse_template_from_baseline.js` —— **从基线地图反推真实模板元数据**。
 *
 * 动机（2026-10-07）：
 *  - `TemplateProvider` 的**语义已完全破解**（`0x544BE0` / `0x5471B0` / `0x544C20`）：
 *    ```c
 *    tmpl = vtable[156](this);
 *    e = tmpl[ subtile % (tmpl[0] * tmpl[1]) + 4 ];
 *    // tmpl[0]=width  tmpl[1]=height  tmpl[4..]=TileFrame*
 *    // TileFrame: +40 height / +41 terrainIndex / +42 slope
 *    ```
 *  - 但 **`.TMP` 资产不存在**（`MIXFILES/` 整个目录缺失），
 *    填表者在未反编译的 `0x42xxxx` / `0x45xxxx` 段，
 *    单点仿真跑不动完整 theater 加载链。
 *
 * ⇒ 换一条路：**基线 `.yrm` 的 `IsoMapPack5` 里含
 *   `(tileIndex, subIndex, level, slope)` 四元组**，
 *   可**统计出每个 tile 的真实子格数与 level 分布**。
 *   这是**逆向**（不是取证），覆盖度有限，但零外部依赖、立即可用。
 *
 * 用法：node re/oracle/reverse_template_from_baseline.js
 * 输出：re/oracle/vectors/template_from_baseline.json
 */
const fs = require('fs');
const path = require('path');

const CORE = path.join(__dirname, '..', '..', 'packages', 'core');
const { IniFile } = require(path.join(CORE, 'dist/io/iniFile.js'));
const { decompressRange } = require(path.join(CORE, 'dist/format/minilzo.js'));

const BASELINE =
  process.env.RMG_BASELINE ??
  path.join(CORE, 'src/test/fixtures/rmg_real_randommap.yrm');

/** 解 IsoMapPack5 → 11 字节/tile 的原始缓冲 */
function parseIso(ini) {
  const sec = ini.GetSection('IsoMapPack5');
  if (!sec) return null;
  const keys = sec.Keys.slice().sort((a, b) => Number(a) - Number(b));
  const raw = Buffer.from(keys.map((k) => sec.GetStringValue(k, '')).join(''), 'base64');
  let r = 0;
  const parts = [];
  while (r + 4 <= raw.length) {
    const si = raw.readUInt16LE(r);
    const so = raw.readUInt16LE(r + 2);
    if (!si || !so) break;
    r += 4;
    const o = new Uint8Array(so + 1024);
    decompressRange(new Uint8Array(raw), r, si, o, 0);
    parts.push(Buffer.from(o.slice(0, so)));
    r += si;
  }
  return Buffer.concat(parts);
}

function main() {
  const buf = parseIso(new IniFile(fs.readFileSync(BASELINE, 'latin1')));
  if (!buf) throw new Error('基线无 IsoMapPack5');

  // 11 字节/tile：x(i16) y(i16) tileIndex(i32) subIndex(u8) level(u8) slope(u8)
  const byTile = new Map();
  for (let o = 0; o + 11 <= buf.length - 4; o += 11) {
    const x = buf.readInt16LE(o);
    const y = buf.readInt16LE(o + 2);
    const ti = buf.readInt32LE(o + 4);
    if (x === 0 && y === 0 && ti === 0) break;
    const sub = buf[o + 8];
    const lvl = buf[o + 9];
    const slope = buf[o + 10];
    let e = byTile.get(ti);
    if (!e) {
      e = { subs: new Set(), lvls: new Set(), slopes: new Set(), n: 0 };
      byTile.set(ti, e);
    }
    e.subs.add(sub);
    e.lvls.add(lvl);
    e.slopes.add(slope);
    e.n += 1;
  }

  // 反推：tile 的模板维度。真值是 w*h，本反推只能给下界（出现过的 subIndex 覆盖范围）
  const tiles = [...byTile.entries()]
    .map(([ti, e]) => ({
      tile: ti,
      samples: e.n,
      subCount: e.subs.size,
      maxSub: Math.max(...e.subs),
      levelCount: e.lvls.size,
      minLevel: Math.min(...e.lvls),
      maxLevel: Math.max(...e.lvls),
      slopeCount: e.slopes.size,
      maxSlope: Math.max(...e.slopes),
    }))
    .sort((a, b) => a.tile - b.tile);

  const multi = tiles.filter((t) => t.subCount > 1);
  const lvlSpan = tiles.map((t) => t.maxLevel - t.minLevel);
  const summary = {
    baseline: BASELINE,
    distinctTiles: tiles.length,
    multiSubTiles: multi.length,
    multiSubPct: +((multi.length / tiles.length) * 100).toFixed(1),
    maxSubCount: Math.max(...tiles.map((t) => t.subCount)),
    maxLevelSpan: Math.max(...lvlSpan),
    slopeAllZero: tiles.every((t) => t.slopeCount <= 1 && t.maxSlope === 0),
  };

  const out = {
    source: 'reverse-engineered from baseline IsoMapPack5 (NOT oracle-forensics)',
    caveat:
      'subCount/maxSub 是【下界】—— 基线只记录实际用到的子格，' +
      '真实模板可能有更多子格未被采样。level/slope 同理。',
    summary,
    tiles,
  };

  const dst = path.join(__dirname, 'vectors', 'template_from_baseline.json');
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, JSON.stringify(out, null, 2), 'utf8');

  console.log('基线 =', path.basename(BASELINE));
  console.log('不同 tileIndex = %d，其中有多子格的 = %d (%.0f%%)',
    summary.distinctTiles, summary.multiSubTiles, summary.multiSubPct);
  console.log('最多子格数 = %d   level 最大跨度 = %d   slope 全为 0 = %s',
    summary.maxSubCount, summary.maxLevelSpan, summary.slopeAllZero);
  console.log('前 8 个多子格 tile:');
  for (const t of multi.slice(0, 8)) {
    console.log('  tile %d: 采样 %d 次, subIndex %d 种(最大 %d), level %d..%d',
      t.tile, t.samples, t.subCount, t.maxSub, t.minLevel, t.maxLevel);
  }
  console.log('输出 =', dst);
}

main();
