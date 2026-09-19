/**
 * S1/S2 测试：`.SED` 读写、RMGMD.INI、cell 网格、emit 往返
 *
 * S1 验收（逆向规格 §S1）：
 *   - NumPlayers=8, Width=Height=3, MapType∈{0,3} 尺寸已在 rmg.test.ts
 *   - `.SED` carry-default、Description hex-CSV、键序 round-trip
 *   - RMGMD 无文件=构造器缺省；零售文本=900/1050/600
 *
 * S2 验收：
 *   - 方向偏移次序 N..NW
 *   - 菱形带内外读写
 *   - emit 往返：既有 map INI → grid → emit 与源 tile/overlay 一致
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  loadSed,
  saveSed,
  encodeSedDescription,
  decodeSedDescription,
  SED_INT_KEYS,
} from '../rmg/sed';
import {
  loadRmgmd,
  defaultRmgSettings,
  DEFAULT_MIN_TIBERIUM,
  DEFAULT_MAX_TIBERIUM,
  DEFAULT_MAX_TREES,
  vegetationRange,
  levelLightAt,
} from '../rmg/rmgmd';
import {
  DIRECTION_OFFSETS,
  TILE_UNASSIGNED,
  DEFAULT_GROUND_LEVEL,
  RmgGrid,
  defaultRmgCell,
  isInDiamond,
} from '../rmg/cell';
import {
  emitMapIni,
  loadGridFromMapIni,
  emitRoundTrip,
  rmgTheaterToMapName,
  rmgTheaterToEnum,
} from '../rmg/emit';
import { defaultOptions, deriveDimensions } from '../rmg/options';
import { MapFile } from '../fileio';
import { IniFile } from '../io/iniFile';
import { Theater } from '../tile/enums';

// ---------------------------------------------------------------------------
// S1 — Description 编码
// ---------------------------------------------------------------------------

test('SED Description - hex-CSV UTF-16 round-trip（Random Map 示例）', () => {
  const text = 'Random Map';
  const enc = encodeSedDescription(text);
  // 语料示例：52,61,6e,64,6f,6d,20,4d,61,70,
  assert.equal(enc, '52,61,6e,64,6f,6d,20,4d,61,70,');
  assert.equal(decodeSedDescription(enc), text);
  assert.equal(encodeSedDescription(''), '');
  assert.equal(decodeSedDescription(''), '');
});

test('SED Description - 中文与代理对按 UTF-16 code unit 编码', () => {
  const text = '随机图';
  const enc = encodeSedDescription(text);
  assert.equal(decodeSedDescription(enc), text);
  // 每个 BMP 字符一个 code unit
  assert.equal(enc.split(',').filter(Boolean).length, 3);
});

// ---------------------------------------------------------------------------
// S1 — .SED 读写
// ---------------------------------------------------------------------------

test('SED - 写出键序与原生 writer 一致（Description 首 + 16 整数键）', () => {
  const o = { ...defaultOptions(), seed: 1234, numPlayers: 4, mapType: 1 };
  const text = saveSed(o);
  const ini = new IniFile(text);
  const sec = ini.GetSection('RandomMap');
  assert.ok(sec, 'must have [RandomMap]');
  const keys = sec.Keys;
  assert.equal(keys[0], 'Description');
  assert.deepEqual(keys.slice(1), [...SED_INT_KEYS]);
  // 十进制
  assert.equal(sec.GetStringValue('Seed', ''), '1234');
});

test('SED - carry-default：缺键保留 current，非法整数不覆盖', () => {
  const current = { ...defaultOptions(), seed: 42, numPlayers: 6, tiberium: 77 };
  const partial = [
    '[RandomMap]',
    'Width=3',
    'Seed=not-a-number',
    // 缺 NumPlayers / Tiberium
  ].join('\n');
  const out = loadSed(partial, current);
  assert.equal(out.width, 3, '存在的键覆盖');
  assert.equal(out.seed, 42, '非法整数保留 current');
  assert.equal(out.numPlayers, 6, '缺键保留 current');
  assert.equal(out.tiberium, 77, '缺键保留 current');
  // 构造器默认在无 current 时生效
  const fresh = loadSed(partial);
  assert.equal(fresh.numPlayers, 2);
  assert.equal(fresh.seed, -1);
});

test('SED - load/save round-trip 保字段', () => {
  const original = {
    ...defaultOptions(),
    theater: 3, // DESERT (RMG 序)
    mapType: 4,
    resources: 2,
    ruggedness: 55,
    time: 2,
    waterAmount: 30,
    numPlayers: 8,
    tiberium: 90,
    tiberiumLayout: 10,
    vegetation: 40,
    urbanPresence: 5,
    width: 3,
    height: 3,
    accessibility: 66,
    regionSize: 70,
    seed: 0xabcd,
    description: 'Hello, YR',
  };
  const text = saveSed(original);
  const back = loadSed(text);
  const fieldOf: Record<string, keyof typeof original> = {
    Width: 'width',
    Height: 'height',
    NumPlayers: 'numPlayers',
    Seed: 'seed',
    MapType: 'mapType',
    Theater: 'theater',
    Time: 'time',
    RegionSize: 'regionSize',
    Ruggedness: 'ruggedness',
    Accessibility: 'accessibility',
    WaterAmount: 'waterAmount',
    Tiberium: 'tiberium',
    TiberiumLayout: 'tiberiumLayout',
    Vegetation: 'vegetation',
    UrbanPresence: 'urbanPresence',
    Resources: 'resources',
  };
  for (const key of SED_INT_KEYS) {
    const field = fieldOf[key];
    assert.equal(back[field], original[field], key);
  }
  assert.equal(back.description, original.description);
  assert.equal(back.theater, 3, 'Theater 不被 clamp 规则改写（load 不 clamp）');
});

test('SED - 空 Description 写出后读回保留 undefined/空', () => {
  const o = defaultOptions();
  assert.equal(o.description, undefined);
  const text = saveSed(o);
  const back = loadSed(text);
  // 写出 Description= 空；load 见空串不覆盖 → 仍为构造器默认（undefined）
  assert.equal(back.description, undefined);
});

// ---------------------------------------------------------------------------
// S1 — RMGMD.INI
// ---------------------------------------------------------------------------

test('RMGMD - 无文件使用构造器缺省 2500/5500/500', () => {
  const s = loadRmgmd(null);
  assert.equal(s.minTiberium, DEFAULT_MIN_TIBERIUM);
  assert.equal(s.minTiberium, 2500);
  assert.equal(s.maxTiberium, DEFAULT_MAX_TIBERIUM);
  assert.equal(s.maxTiberium, 5500);
  assert.equal(s.maxTrees, DEFAULT_MAX_TREES);
  assert.equal(s.maxTrees, 500, '缺省不能是 0 棵树');
  assert.deepEqual(s.levelLight, [0, 0, 0, 0]);
  assert.deepEqual(defaultRmgSettings().vegetationMin, [0, 0, 0, 0, 0]);
});

test('RMGMD - 零售文本逐键生效', () => {
  const retail = [
    '[General]',
    'RMGMinimumTiberium=900',
    'RMGMaximumTiberium=1050',
    'RMGLevelLightSettings=3,3,3,3',
    'RMGVegetationMinimums=60,60,60,60,60',
    'RMGVegetationMaximums=100,100,100,100,100',
    'MaxTrees=600',
    'TemperateAmbientLight=75,100,75,35',
  ].join('\n');
  const s = loadRmgmd(retail);
  assert.equal(s.minTiberium, 900);
  assert.equal(s.maxTiberium, 1050);
  assert.equal(s.maxTrees, 600);
  assert.deepEqual(s.levelLight, [3, 3, 3, 3]);
  assert.deepEqual(s.vegetationMin, [60, 60, 60, 60, 60]);
  assert.deepEqual(s.vegetationMax, [100, 100, 100, 100, 100]);
  assert.deepEqual(s.temperateAmbientLight, [75, 100, 75, 35]);
  // 缺键字段保持缺省
  assert.equal(s.snowAmbientLight[0], 0);
});

test('RMGMD - 过短列表整键无效（不部分应用）', () => {
  const s = loadRmgmd('[General]\nRMGLevelLightSettings=1,2');
  assert.deepEqual(s.levelLight, [0, 0, 0, 0], '长度 < 4 → 保留缺省');
});

test('RMGMD - vegetationRange / levelLightAt 夹取 mapType/time', () => {
  const s = loadRmgmd(
    '[General]\nRMGVegetationMinimums=10,20,30,40,50\nRMGVegetationMaximums=60,70,80,90,100\nRMGLevelLightSettings=1,2,3,4',
  );
  assert.deepEqual(vegetationRange(s, 3), { min: 40, max: 90 });
  assert.deepEqual(vegetationRange(s, 99), { min: 50, max: 100 });
  assert.deepEqual(vegetationRange(s, -1), { min: 10, max: 60 });
  assert.equal(levelLightAt(s, 0), 1);
  assert.equal(levelLightAt(s, 3), 4);
  assert.equal(levelLightAt(s, 9), 4);
});

// ---------------------------------------------------------------------------
// Theater 映射
// ---------------------------------------------------------------------------

test('RMG theater → 引擎名/枚举（3=DESERT, 4=NEWURBAN）', () => {
  assert.equal(rmgTheaterToMapName(0), 'TEMPERATE');
  assert.equal(rmgTheaterToMapName(3), 'DESERT');
  assert.equal(rmgTheaterToMapName(4), 'NEWURBAN');
  assert.equal(rmgTheaterToMapName(99), 'TEMPERATE');
  assert.equal(rmgTheaterToEnum(3), Theater.DESERT);
  assert.equal(rmgTheaterToEnum(4), Theater.NEWURBAN);
  // 与 enums 的 DESERT=5 / NEWURBAN=3 不同
  assert.notEqual(rmgTheaterToEnum(3), 3);
});

// ---------------------------------------------------------------------------
// S2 — cell 网格
// ---------------------------------------------------------------------------

test('cell - DIRECTION_OFFSETS 次序 N,NE,E,SE,S,SW,W,NW', () => {
  assert.deepEqual(
    [...DIRECTION_OFFSETS],
    [
      [0, -1],
      [1, -1],
      [1, 0],
      [1, 1],
      [0, 1],
      [-1, 1],
      [-1, 0],
      [-1, -1],
    ],
  );
  assert.equal(DIRECTION_OFFSETS.length, 8);
});

test('cell - 默认态：tile 未分配、level=4、overlay=-1、shoreEnabled=1', () => {
  const c = defaultRmgCell();
  assert.equal(c.tile, TILE_UNASSIGNED);
  assert.equal(c.level, DEFAULT_GROUND_LEVEL);
  assert.equal(c.level, 4);
  assert.equal(c.overlay, -1);
  assert.equal(c.shoreEnabled, 1);
  assert.equal(c.regionId, -1);
});

test('cell - 菱形带判定与邻居', () => {
  const d = deriveDimensions({
    ...defaultOptions(),
    numPlayers: 2,
    width: 0,
    height: 0,
  });
  const grid = RmgGrid.fromDerived(d);
  let found: [number, number] | null = null;
  for (const p of grid.nativeCells()) {
    found = p;
    break;
  }
  assert.ok(found, '至少一格在带内');
  const [frx, fry] = found;
  assert.ok(grid.get(frx, fry));
  assert.equal(grid.inBand(-1, 0), false);
  assert.equal(grid.inBand(0, -1), false);

  // 带外 get → null；set no-op
  assert.equal(grid.get(-1, 0), null);
  const before = grid.countInBand();
  grid.set(-1, 0, defaultRmgCell());
  assert.equal(grid.countInBand(), before);

  // 数组包围盒大于 map Size 矩形（带内 rx 可超出 mapW）
  assert.ok(grid.arraySize >= d.mapW + d.mapH);

  const n = grid.neighbor(frx, fry, 0);
  if (n) assert.ok(typeof n.tile === 'number');
});

test('cell - isInDiamond 与 CreateIsoTileList 过滤一致（抽样）', () => {
  const w = 80;
  const h = 92;
  const geom = { width: w, height: h, diamondMin: w, diamondMax: w + 2 * h };
  // 角点：rx=0,ry=0 → dx=w-1, dy=-w-1 < 0 → 外
  assert.equal(isInDiamond(0, 0, geom), false);
  // 中心附近
  assert.equal(isInDiamond(w >> 1, h >> 1, geom), true);
  // dx 越界：rx 很大 ry 很小
  assert.equal(isInDiamond(2 * w, 0, geom), false);
});

// ---------------------------------------------------------------------------
// S2 — emit 往返
// ---------------------------------------------------------------------------

test('emit - 手工小网格写出后 load 回 tile/overlay 一致', () => {
  const grid = new RmgGrid({
    width: 20,
    height: 20,
    diamondMin: 20,
    diamondMax: 20 + 40,
  });
  // 取带内前若干格填 tile
  let n = 0;
  for (const [x, y] of grid.nativeCells()) {
    const c = grid.get(x, y)!;
    c.tile = 100 + (n % 7);
    c.subTile = n % 3;
    c.level = (4 + n) & 0xff;
    if (n % 5 === 0) {
      c.overlay = 11;
      c.density = 7;
    }
    n++;
    if (n >= 30) break;
  }
  assert.ok(n >= 30);

  const ini = emitMapIni(grid, { theater: 0 }, undefined, 0);
  const grid2 = loadGridFromMapIni(ini);

  assert.equal(grid2.width, grid.width);
  assert.equal(grid2.height, grid.height);

  let compared = 0;
  let mismatch = 0;
  for (const [x, y] of grid.nativeCells()) {
    const a = grid.get(x, y)!;
    const b = grid2.get(x, y);
    if (!b) {
      mismatch++;
      continue;
    }
    // 只比我们写过的字段
    if (a.tile !== TILE_UNASSIGNED || a.overlay >= 0) {
      compared++;
      if (
        a.tile !== b.tile ||
        a.subTile !== b.subTile ||
        a.level !== b.level ||
        a.overlay !== b.overlay ||
        a.density !== b.density
      ) {
        mismatch++;
      }
    }
  }
  assert.ok(compared > 0, '应比较到已填格');
  assert.equal(mismatch, 0, `mismatch=${mismatch}`);
});

test('emit - Theater 写入 [Map] Theater', () => {
  const grid = new RmgGrid({
    width: 20,
    height: 20,
    diamondMin: 20,
    diamondMax: 60,
  });
  const ini = emitMapIni(grid, { theater: 3 }, undefined, 0); // RMG DESERT
  const m = /Theater\s*=\s*(\w+)/.exec(ini);
  assert.ok(m, 'must have Theater');
  assert.equal(m![1], 'DESERT');
});

test('emit - 既有成功图 round-trip：tile/subTile/Z/overlay 逐格一致', () => {
  // 手工造图后先经 SaveFullMap→CreateIsoTileList 落到「真实文件形态」
  // （CreateEmptyMap 的格数多于 IsoMapPack 过滤后的带内格，不能直接比长度）。
  const src = new MapFile();
  src.MapTheater = Theater.TEMPERATE;
  src.Width = 40;
  src.Height = 48;
  src.CreateEmptyMap(40, 48);

  let i = 0;
  for (const t of src.IsoTileList) {
    if (t.TileNum === -1) {
      t.TileNum = 50 + (i % 5);
      t.SubTile = i % 2;
      t.Z = 4 + (i % 3);
      if (i % 11 === 0) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Overlay } = require('../tile/overlay') as typeof import('../tile/overlay');
        const ov = new Overlay(3, 9);
        ov.Tile = t;
        src.OverlayList.push(ov);
      }
      i++;
    }
  }
  assert.ok(src.OverlayList.length > 0, '源应含 overlay');
  assert.ok(i > 0);

  const fileIni = src.SaveFullMap(undefined, { bottomSpace: 0 });

  // 文件形态的源（带内）
  const source = new MapFile();
  source.CreateIsoTileList(fileIni);
  source.ReadOverlay(fileIni);
  assert.ok(source.IsoTileList.length > 0);
  assert.ok(source.OverlayList.length > 0);

  const grid = loadGridFromMapIni(fileIni);
  assert.equal(grid.width, 40);
  assert.equal(grid.height, 48);

  const outIni = emitRoundTrip(fileIni, 0);
  const back = new MapFile();
  back.CreateIsoTileList(outIni);
  const backOv = back.ReadOverlay(outIni) ?? [];

  const srcByKey = new Map(source.IsoTileList.map((t) => [`${t.Rx},${t.Ry}`, t]));
  const backByKey = new Map(back.IsoTileList.map((t) => [`${t.Rx},${t.Ry}`, t]));

  assert.equal(back.IsoTileList.length, source.IsoTileList.length, '格数一致');

  let mismatch = 0;
  for (const [key, a] of srcByKey) {
    const b = backByKey.get(key);
    if (!b) {
      mismatch++;
      continue;
    }
    if (a.TileNum !== b.TileNum || a.SubTile !== b.SubTile || a.Z !== b.Z) {
      mismatch++;
    }
  }
  assert.equal(mismatch, 0, `tile mismatch=${mismatch}`);

  const srcOv = new Set(
    source.OverlayList
      .filter((o) => o.Tile)
      .map((o) => `${o.Tile!.Rx},${o.Tile!.Ry},${o.OverlayID},${o.OverlayValue}`),
  );
  const backOvSet = new Set(
    backOv
      .filter((o) => o.Tile)
      .map((o) => `${o.Tile!.Rx},${o.Tile!.Ry},${o.OverlayID},${o.OverlayValue}`),
  );
  assert.deepEqual([...backOvSet].sort(), [...srcOv].sort());
});

test('emit - 带外格不进入 IsoMapPack', () => {
  const grid = new RmgGrid({
    width: 30,
    height: 30,
    diamondMin: 30,
    diamondMax: 90,
  });
  const ini = emitMapIni(grid, { theater: 0 });
  const mf = new MapFile();
  mf.CreateIsoTileList(ini);
  // 格数必须等于 IsoMapPack 定长缓冲 (2W−1)·H
  assert.equal(mf.IsoTileList.length, grid.countPackCells());
  assert.equal(mf.IsoTileList.length, (30 * 2 - 1) * 30);
  // 回读后的 (rx,ry) 都应在代数带内（CreateEmptyMap 枚举 ⊆ 近似带）
  for (const t of mf.IsoTileList) {
    assert.ok(
      isInDiamond(t.Rx, t.Ry, { width: 30, height: 30 }),
      `not in diamond ${t.Rx},${t.Ry}`,
    );
  }
  assert.ok(mf.IsoTileList.length > 0);
});
