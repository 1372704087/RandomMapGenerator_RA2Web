/**
 * 端到端验证：更新源码中的地图拆解功能
 *
 * 1. 加载 theater 资源
 * 2. 用 generator 生成一张完整地图
 * 3. splitFullMap 拆解
 * 4. 校验：切片可被 AbstractMapUnit 读回、相邻连接 ID 一致、对象平移正确、skipEmpty 生效
 */
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import {
  WorkingMap,
  AbstractMapUnit,
  MapFile,
  IniFile,
  splitMap,
} from '../packages/core/dist/index.js';
import {
  loadAllResources,
  getTheaterResources,
  getTheaterInfoList,
} from '../packages/server/dist/resourceLoader.js';
import { splitFullMap } from '../packages/server/dist/splitter.js';
import { generateMap } from '../packages/server/dist/generator.js';

let pass = 0;
let fail = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    fail++;
    failures.push({ name, err });
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err && err.message ? err.message : err}`);
  }
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

// ---------------------------------------------------------------------------
section('加载资源');
loadAllResources();
const theaters = getTheaterInfoList().map((t) => t.name);
console.log('theaters:', theaters.join(', '));
check('至少 4 个 theater', () => assert.ok(theaters.length >= 4));

// ---------------------------------------------------------------------------
section('生成完整地图 (TEMPERATE)');
const tempRes = getTheaterResources('TEMPERATE');
assert.ok(tempRes, 'TEMPERATE resources');

const genResult = await generateMap({
  theaterType: 'TEMPERATE',
  width: 78,
  height: 78,
  totalRandom: true,
});
console.log('generated file:', genResult.fileName, 'bytes:', genResult.mapContent.length);
check('生成成功且非空', () => assert.ok(genResult.mapContent.length > 100));

// ---------------------------------------------------------------------------
section('拆解 TEMP 78x78');
const slicesTrue = splitFullMap('TEMPERATE', genResult.mapContent, { skipEmpty: true });
const slicesFalse = splitFullMap('TEMPERATE', genResult.mapContent, { skipEmpty: false });
console.log('skipEmpty=true  count:', slicesTrue.length);
console.log('skipEmpty=false count:', slicesFalse.length);

check('产生切片', () => assert.ok(slicesTrue.length > 0));
check('skipEmpty 应过滤空块', () => {
  assert.ok(
    slicesTrue.length < slicesFalse.length,
    `skipEmpty 无效：true=${slicesTrue.length} false=${slicesFalse.length}`,
  );
  assert.ok(slicesTrue.length > 0, 'skipEmpty=true 后不应为空');
  // true 的每一片都必须在 false 里且同名
  const falseNames = new Set(slicesFalse.map((s) => s.name));
  for (const s of slicesTrue) {
    assert.ok(falseNames.has(s.name), `missing in false: ${s.name}`);
  }
});

// ---------------------------------------------------------------------------
section('切片文件名与 manifest');
check('名称格式 split_i_j', () => {
  for (const s of slicesTrue) {
    assert.match(s.name, /^split_\d+_\d+$/, s.name);
  }
});

// ---------------------------------------------------------------------------
section('AbstractMapUnit 读回连接 ID / 权重 / 对象');
// 初始化 WorkingMap 到 TEMPERATE 参数
WorkingMap.Initialize(60, 60, tempRes.config);
WorkingMap.SterilizeMapUnit(tempRes.config);

const indicatorNum = WorkingMap.IndicatorNum;
console.log('IndicatorNum:', indicatorNum);
console.log(
  'MapUnit:',
  WorkingMap.MapUnitWidth,
  'x',
  WorkingMap.MapUnitHeight,
  'Top:',
  WorkingMap.StartingX,
  WorkingMap.StartingY,
);

const W = WorkingMap.MapUnitWidth;
const H = WorkingMap.MapUnitHeight;
const SX = WorkingMap.StartingX;
const SY = WorkingMap.StartingY;

const units = [];
for (const s of slicesTrue) {
  const amu = new AbstractMapUnit();
  amu.Initialize({ name: `${s.name}.map`, fullName: s.name }, s.content);
  units.push({ slice: s, amu });
}

check('所有切片连接 ID 均在 [0, W)', () => {
  for (const { slice, amu } of units) {
    for (const [label, v] of [
      ['NW', amu.NWConnectionType],
      ['NE', amu.NEConnectionType],
      ['SW', amu.SWConnectionType],
      ['SE', amu.SEConnectionType],
    ]) {
      assert.ok(
        Number.isInteger(v) && v >= 0 && v < W,
        `${slice.name} ${label}=${v} not in [0,${W})`,
      );
    }
  }
});

check('所有切片权重 > 0', () => {
  for (const { slice, amu } of units) {
    assert.ok(amu.Weight > 0, `${slice.name} Weight=${amu.Weight}`);
    assert.ok(amu.Weight <= 8, `${slice.name} Weight=${amu.Weight} too large`);
  }
});

// 相邻连接一致性
function gridOf(list) {
  const g = new Map();
  for (const u of list) g.set(`${u.slice.gridX},${u.slice.gridY}`, u);
  return g;
}
const grid = gridOf(units);

check('相邻切片连接 ID 一致 (NW↔SE, NE↔SW)', () => {
  let pairs = 0;
  for (const { slice, amu } of units) {
    const right = grid.get(`${slice.gridX + 1},${slice.gridY}`);
    if (right) {
      pairs++;
      assert.equal(
        amu.SEConnectionType,
        right.amu.NWConnectionType,
        `H ${slice.name}.SE=${amu.SEConnectionType} != ${right.slice.name}.NW=${right.amu.NWConnectionType}`,
      );
    }
    const down = grid.get(`${slice.gridX},${slice.gridY + 1}`);
    if (down) {
      pairs++;
      assert.equal(
        amu.SWConnectionType,
        down.amu.NEConnectionType,
        `V ${slice.name}.SW=${amu.SWConnectionType} != ${down.slice.name}.NE=${down.amu.NEConnectionType}`,
      );
    }
  }
  console.log('  adjacent pairs checked:', pairs);
  assert.ok(pairs > 0, 'no adjacent pairs');
});

// ---------------------------------------------------------------------------
section('对象平移校验');
// 源地图对象
const srcIni = new IniFile(genResult.mapContent);

function parseObjects(ini, sectionName, xi, yi) {
  const sec = ini.GetSection(sectionName);
  if (!sec) return [];
  const out = [];
  for (const key of sec.Keys) {
    const raw = sec.GetStringValue(key, '');
    const parts = raw.split(',');
    if (parts.length <= Math.max(xi, yi)) continue;
    const x = parseInt(parts[xi], 10);
    const y = parseInt(parts[yi], 10);
    if (isNaN(x) || isNaN(y)) continue;
    out.push({ key, raw, x, y, parts });
  }
  return out;
}

const srcUnits = parseObjects(srcIni, 'Units', 3, 4);
const srcInf = parseObjects(srcIni, 'Infantry', 3, 4);
const srcStruct = parseObjects(srcIni, 'Structures', 3, 4);
const srcSmudge = parseObjects(srcIni, 'Smudge', 1, 2);
const srcTerrainSec = srcIni.GetSection('Terrain');
const srcTerrain = srcTerrainSec
  ? srcTerrainSec.Keys.map((key) => {
      const value = srcTerrainSec.GetStringValue(key, '');
      const x = parseInt(key.slice(-3), 10);
      const y = parseInt(key.slice(0, key.length - 3), 10);
      return { key, value, x, y };
    }).filter((t) => !isNaN(t.x) && !isNaN(t.y))
  : [];
const srcWpSec = srcIni.GetSection('Waypoints');
const srcWps = srcWpSec
  ? srcWpSec.Keys.map((key) => {
      const value = srcWpSec.GetStringValue(key, '');
      const x = parseInt(value.slice(-3), 10);
      const y = parseInt(value.slice(0, value.length - 3), 10);
      return { key, value, x, y };
    }).filter((t) => !isNaN(t.x) && !isNaN(t.y))
  : [];

console.log(
  `source objects: units=${srcUnits.length} inf=${srcInf.length} struct=${srcStruct.length} smudge=${srcSmudge.length} terrain=${srcTerrain.length} wp=${srcWps.length}`,
);

// 重建切片网格覆盖的绝对范围（与 splitMap 相同算法）
{
  const sm = new MapFile();
  sm.CreateIsoTileList(genResult.mapContent);
  let minRx = Infinity, maxRx = -Infinity, minRy = Infinity, maxRy = -Infinity;
  for (const t of sm.IsoTileList) {
    if (t.Rx < minRx) minRx = t.Rx;
    if (t.Rx > maxRx) maxRx = t.Rx;
    if (t.Ry < minRy) minRy = t.Ry;
    if (t.Ry > maxRy) maxRy = t.Ry;
  }
  const OX = Math.floor(minRx / W) * W;
  const OY = Math.floor(minRy / H) * H;
  const gx = Math.floor((maxRx - OX) / W) + 1;
  const gy = Math.floor((maxRy - OY) / H) + 1;
  console.log(`grid: origin=(${OX},${OY}) cells=${gx}x${gy}`);

  function collectFromSlices(sectionName, xi, yi) {
    const found = [];
    for (const s of slicesTrue) {
      const ini = new IniFile(s.content);
      const sec = ini.GetSection(sectionName);
      if (!sec) continue;
      for (const key of sec.Keys) {
        const raw = sec.GetStringValue(key, '');
        const parts = raw.split(',');
        if (parts.length <= Math.max(xi, yi)) continue;
        const lx = parseInt(parts[xi], 10);
        const ly = parseInt(parts[yi], 10);
        if (isNaN(lx) || isNaN(ly)) continue;
        // local = abs - blockOrigin + SX
        const absX = lx - SX + OX + s.gridX * W;
        const absY = ly - SY + OY + s.gridY * H;
        found.push({ name: s.name, key, absX, absY, lx, ly, raw });
      }
    }
    return found;
  }

  check('Units 对象全部落入某块且坐标可还原', () => {
    const got = collectFromSlices('Units', 3, 4);
    console.log(`  slices units=${got.length} src=${srcUnits.length}`);
    // 源中落在网格范围内的对象应都能找到
    const inGrid = srcUnits.filter(
      (u) => u.x >= OX && u.x < OX + gx * W && u.y >= OY && u.y < OY + gy * H,
    );
    const gotKeys = new Set(got.map((g) => `${g.absX},${g.absY},${g.raw}`));
    // raw 在切片里坐标已被改写，只比绝对坐标
    const gotCoords = new Set(got.map((g) => `${g.absX},${g.absY}`));
    const missing = inGrid.filter((u) => !gotCoords.has(`${u.x},${u.y}`));
    if (missing.length) {
      throw new Error(
        `missing ${missing.length} units, e.g. ${JSON.stringify(missing[0])}`,
      );
    }
    assert.equal(got.length, inGrid.length, `got ${got.length} != inGrid ${inGrid.length}`);
  });

  check('Terrain 键还原', () => {
    const got = [];
    for (const s of slicesTrue) {
      const ini = new IniFile(s.content);
      const sec = ini.GetSection('Terrain');
      if (!sec) continue;
      for (const key of sec.Keys) {
        const value = sec.GetStringValue(key, '');
        const x = parseInt(key.slice(-3), 10);
        const y = parseInt(key.slice(0, key.length - 3), 10);
        if (isNaN(x) || isNaN(y)) continue;
        const absX = x - SX + OX + s.gridX * W;
        const absY = y - SY + OY + s.gridY * H;
        got.push({ absX, absY, value, name: s.name });
      }
    }
    const inGrid = srcTerrain.filter(
      (t) => t.x >= OX && t.x < OX + gx * W && t.y >= OY && t.y < OY + gy * H,
    );
    const gotSet = new Set(got.map((g) => `${g.absX},${g.absY},${g.value}`));
    const missing = inGrid.filter((t) => !gotSet.has(`${t.x},${t.y},${t.value}`));
    console.log(`  slices terrain=${got.length} src=${srcTerrain.length} inGrid=${inGrid.length}`);
    if (missing.length) {
      throw new Error(`missing ${missing.length} terrain, e.g. ${JSON.stringify(missing[0])}`);
    }
  });

  check('Smudge 坐标还原', () => {
    const got = collectFromSlices('Smudge', 1, 2);
    const inGrid = srcSmudge.filter(
      (u) => u.x >= OX && u.x < OX + gx * W && u.y >= OY && u.y < OY + gy * H,
    );
    console.log(`  slices smudge=${got.length} src=${srcSmudge.length} inGrid=${inGrid.length}`);
    const gotSet = new Set(got.map((g) => `${g.absX},${g.absY}`));
    const missing = inGrid.filter((u) => !gotSet.has(`${u.x},${u.y}`));
    if (missing.length) {
      throw new Error(`missing ${missing.length} smudge, e.g. ${JSON.stringify(missing[0])}`);
    }
  });

  check('Waypoints 还原', () => {
    const got = [];
    for (const s of slicesTrue) {
      const ini = new IniFile(s.content);
      const sec = ini.GetSection('Waypoints');
      if (!sec) continue;
      for (const key of sec.Keys) {
        const value = sec.GetStringValue(key, '');
        const x = parseInt(value.slice(-3), 10);
        const y = parseInt(value.slice(0, value.length - 3), 10);
        if (isNaN(x) || isNaN(y)) continue;
        const absX = x - SX + OX + s.gridX * W;
        const absY = y - SY + OY + s.gridY * H;
        got.push({ key, absX, absY, value, name: s.name });
      }
    }
    const inGrid = srcWps.filter(
      (t) => t.x >= OX && t.x < OX + gx * W && t.y >= OY && t.y < OY + gy * H,
    );
    console.log(`  slices wp=${got.length} src=${srcWps.length} inGrid=${inGrid.length}`);
    const gotBy = new Map(got.map((g) => [g.key, g]));
    const missing = [];
    for (const w of inGrid) {
      const g = gotBy.get(w.key);
      if (!g || g.absX !== w.x || g.absY !== w.y) {
        missing.push(w);
      }
    }
    if (missing.length) {
      throw new Error(`missing/mismatch ${missing.length} waypoints, e.g. ${JSON.stringify(missing[0])}`);
    }
  });
}

// skipEmpty=false 应保留全部网格块；true 应更少
{
  const gxFalse = Math.max(...slicesFalse.map((s) => s.gridX)) + 1;
  const gyFalse = Math.max(...slicesFalse.map((s) => s.gridY)) + 1;
  check('skipEmpty=false 覆盖完整网格', () => {
    assert.equal(slicesFalse.length, gxFalse * gyFalse);
  });
  console.log(`  grid ${gxFalse}x${gyFalse}, true=${slicesTrue.length}, false=${slicesFalse.length}`);
}

// ---------------------------------------------------------------------------
section('内容区图块完整性（切片内容区应覆盖源块）');
{
  const sm = new MapFile();
  sm.CreateIsoTileList(genResult.mapContent);
  const tileBy = new Map();
  let minRx = Infinity, maxRx = -Infinity, minRy = Infinity, maxRy = -Infinity;
  for (const t of sm.IsoTileList) {
    tileBy.set(`${t.Rx},${t.Ry}`, t);
    if (t.Rx < minRx) minRx = t.Rx;
    if (t.Rx > maxRx) maxRx = t.Rx;
    if (t.Ry < minRy) minRy = t.Ry;
    if (t.Ry > maxRy) maxRy = t.Ry;
  }
  const OX = Math.floor(minRx / W) * W;
  const OY = Math.floor(minRy / H) * H;
  const gx = Math.floor((maxRx - OX) / W) + 1;
  const gy = Math.floor((maxRy - OY) / H) + 1;

  let checked = 0;
  let mismatch = 0;
  let examples = [];
  for (const s of slicesTrue) {
    const smap = new MapFile();
    smap.CreateIsoTileList(s.content);
    const local = new Map();
    for (const t of smap.IsoTileList) local.set(`${t.Rx},${t.Ry}`, t);

    const b0x = OX + s.gridX * W;
    const b0y = OY + s.gridY * H;
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        const abs = tileBy.get(`${b0x + x},${b0y + y}`);
        if (!abs) continue;
        const lrx = b0x + x - b0x + SX;
        const lry = b0y + y - b0y + SY;
        // wait: absRX - blockRX0 + SX = x + SX
        const loc = local.get(`${x + SX},${y + SY}`);
        checked++;
        if (!loc || loc.TileNum !== abs.TileNum || loc.SubTile !== abs.SubTile) {
          mismatch++;
          if (examples.length < 3) {
            examples.push({
              slice: s.name,
              cell: [x, y],
              expect: { t: abs.TileNum, s: abs.SubTile },
              got: loc ? { t: loc.TileNum, s: loc.SubTile } : null,
            });
          }
        }
      }
    }
  }
  console.log(`checked content cells=${checked} mismatch=${mismatch}`);
  check('内容区图块与源一致', () => {
    if (mismatch > 0) {
      throw new Error(`${mismatch} mismatches, e.g. ${JSON.stringify(examples)}`);
    }
    assert.ok(checked > 0, 'no cells checked');
  });

  // skipEmpty=true 时，每个切片内容区至少有一格非空源图块
  let emptyKept = 0;
  for (const s of slicesTrue) {
    const b0x = OX + s.gridX * W;
    const b0y = OY + s.gridY * H;
    let real = 0;
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        const abs = tileBy.get(`${b0x + x},${b0y + y}`);
        if (abs && abs.TileNum !== -1) real++;
      }
    }
    if (real === 0) emptyKept++;
  }
  check('skipEmpty=true 不保留空块', () => {
    assert.equal(emptyKept, 0, `kept ${emptyKept} empty slices`);
  });
}

// ---------------------------------------------------------------------------
section('其他 theater 拆解冒烟');
for (const name of theaters) {
  check(`theater ${name} split`, () => {
    const res = getTheaterResources(name);
    assert.ok(res);
    const r = splitFullMap(name, genResult.mapContent, { skipEmpty: true });
    assert.ok(r.length > 0, 'no slices');
    const rAll = splitFullMap(name, genResult.mapContent, { skipEmpty: false });
    assert.ok(r.length <= rAll.length, 'skipEmpty should not increase count');
    // 连接可读回
    WorkingMap.Initialize(40, 40, res.config);
    WorkingMap.SterilizeMapUnit(res.config);
    const muW = WorkingMap.MapUnitWidth;
    for (const s of r) {
      const amu = new AbstractMapUnit();
      amu.Initialize({ name: `${s.name}.map`, fullName: s.name }, s.content);
      for (const v of [amu.NWConnectionType, amu.NEConnectionType, amu.SWConnectionType, amu.SEConnectionType]) {
        assert.ok(Number.isInteger(v) && v >= 0 && v < muW, `${s.name} conn=${v}`);
      }
      assert.ok(amu.Weight > 0, `${s.name} weight`);
    }
    // 相邻
    const g = new Map(r.map((s) => [`${s.gridX},${s.gridY}`, s]));
    // rebuild amu map
    const amuGrid = new Map();
    for (const s of r) {
      const amu = new AbstractMapUnit();
      amu.Initialize({ name: `${s.name}.map`, fullName: s.name }, s.content);
      amuGrid.set(`${s.gridX},${s.gridY}`, amu);
    }
    for (const s of r) {
      const right = amuGrid.get(`${s.gridX + 1},${s.gridY}`);
      if (right) {
        const a = amuGrid.get(`${s.gridX},${s.gridY}`);
        assert.equal(a.SEConnectionType, right.NWConnectionType, `${s.name} H`);
      }
      const down = amuGrid.get(`${s.gridX},${s.gridY + 1}`);
      if (down) {
        const a = amuGrid.get(`${s.gridX},${s.gridY}`);
        assert.equal(a.SWConnectionType, down.NEConnectionType, `${s.name} V`);
      }
    }
    console.log(`  ${name}: ${r.length}/${rAll.length} slices OK`);
  });
}

// ---------------------------------------------------------------------------
section('错误输入');
check('空内容抛错', () => {
  assert.throws(() => splitFullMap('TEMPERATE', ''), /non-empty/);
});
check('未知 theater 抛错', () => {
  assert.throws(() => splitFullMap('NOPE', genResult.mapContent), /not found/);
});
check('无图块源地图抛错', () => {
  assert.throws(() => splitFullMap('TEMPERATE', '[Map]\nSize=0,0,10,10'), /IsoTileList/);
});

// ---------------------------------------------------------------------------
console.log('\n========================================');
console.log(`RESULT: pass=${pass} fail=${fail}`);
if (failures.length) {
  console.log('Failures:');
  for (const f of failures) console.log(` - ${f.name}: ${f.err.message}`);
}
process.exit(fail ? 1 : 0);
