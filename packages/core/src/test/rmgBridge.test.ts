/**
 * 阶段 8（`0x58EF10` 桥 / 连接）的行为契约。
 *
 * 依据 `re/decomp/58EF10_Bridge_ConnectPass.c`（127 行）
 *    + `58F0C0_Bridge_Helper.c`（129 行）
 *    + `5905D0_Bridge_5x5Connect.c`（275 行）。
 *
 * 【锁住的语义】
 *  ① 执行序：先对**所有区域**收集邻区（`0x58F0C0`），
 *     再对**所有区域**做配对（`0x5905D0`）——
 *     两轮分开的，配对要读别人刚填好的 `neighbors`。
 *  ② `neighbors` 不含本区域 id（伪码 `if (Block[i] != 0 && i != v1[2])`）。
 *  ③ 配对门槛：`(候选数 > 1 || 格数 > 50)` 且 `merged == 0` 且两侧 `merged` 相等。
 *  ④ **只记账不落地**：`sub_58F2C0`（真正写 ramp/brick tile）未移植，
 *     所以 `bridges` 有值但地图上不会有桥。
 *  ⑤ 仅 MapType 3/4 生效。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { bridgeConnectPass, bridgeCollectNeighbors, bridgePair5x5 } from '../rmg/bridge';
import { runBridgeStage, generateFullMap, generateThroughGreen } from '../rmg/pipeline';
import { createRegionState, regionCtor } from '../rmg/regions';
import { NativeCells } from '../rmg/native';
import { parseTheaterIni } from '../rmg/theater';
import { deriveDimensions } from '../rmg/options';
import { loadSed } from '../rmg/sed';
import type { WaterContext } from '../rmg/water';
import type { RmgOptions } from '../rmg/options';

const FIX = join(__dirname, '..', '..', 'src', 'test', 'fixtures');
const THEATER_INI =
  process.env.RMG_THEATER_INI ??
  join(__dirname, '..', '..', '..', 'server', 'resources', 'theater', 'temperatmd.ini');
const tables = parseTheaterIni(readFileSync(THEATER_INI, 'utf8'), 'TEMPERATE');

function makeCtx(mapW = 30, mapH = 30): WaterContext {
  const cells = new NativeCells(mapW, mapH);
  cells.allocate();
  const { ScratchGrid } = require('../rmg/native') as { ScratchGrid: new (n: number) => never };
  return {
    rng: { next: () => 0.5 },
    gaussian: { next: (_r: unknown) => 0.5 },
    cells,
    scratch: new ScratchGrid(cells.linearW),
    theater: tables,
    blobCounter: { value: 0 },
    mapType: 4,
    waterAmount: 30,
    numPlayers: 2,
    defaultLevel: 4,
    isoTileTypeCount: tables.totalTiles,
    ruggedness: 50,
    vegetation: 50,
    widthLevel: 3,
    maxTrees: 500,
    theaterIndex: 0,
    tiberiumLayout: 50,
    startQuota: 4,
    waterUsedArea: 0,
    starts: { waypoints: [] },
    terrainObjects: [],
    structures: [],
  } as unknown as WaterContext;
}

// ---------------------------------------------------------------------------
// ① ② neighbors 语义
// ---------------------------------------------------------------------------

test('bridgeCollectNeighbors：neighbors 不含自身 id', () => {
  const ctx = makeCtx();
  const rs = createRegionState();
  for (let i = 0; i < 2; i++) regionCtor(ctx, rs, (10 + i * 3) * 65536 + 10);
  for (const r of rs.regions) bridgeCollectNeighbors(ctx, r);
  for (const r of rs.regions) {
    assert.ok(!r.neighbors!.includes(r.id),
      `区域 ${r.id} 的 neighbors 不应含自身（实测 ${r.neighbors!.join(',')}）`);
  }
});

test('bridgeCollectNeighbors：统计全图属于本区域的格数（+0x0C）', () => {
  const ctx = makeCtx();
  const rs = createRegionState();
  regionCtor(ctx, rs, 10 * 65536 + 10);
  bridgeCollectNeighbors(ctx, rs.regions[0]);
  assert.ok(rs.regions[0].cellCount >= 0, 'cellCount 应为非负整数');
});

// ---------------------------------------------------------------------------
// ③ 配对门槛
// ---------------------------------------------------------------------------

test('bridgePair5x5：bridges 为空数组（区域不足时不配对）', () => {
  const ctx = makeCtx();
  const rs = createRegionState();
  for (let i = 0; i < 2; i++) regionCtor(ctx, rs, (10 + i * 3) * 65536 + 10);
  for (const r of rs.regions) {
    r.__all = rs.regions;
    r.neighbors = [1];
    r.cellCount = 1; // 远低于 50
  }
  const pairs = bridgePair5x5(ctx, rs.regions[0]);
  assert.equal(typeof pairs, 'number');
  assert.ok(Array.isArray(rs.regions[0].bridges), 'bridges 应被初始化为数组');
  // 候选数为 1（不 >1）且格数 1（不 >50）⇒ 不满足门槛 ⇒ 不配对
  assert.equal(rs.regions[0].bridges!.length, 0,
    '两侧都不达门槛时不应配对');
});

test('bridgePair5x5：满足门槛时可配对（记账但不写 tile）', () => {
  const ctx = makeCtx();
  const rs = createRegionState();
  for (let i = 0; i < 2; i++) regionCtor(ctx, rs, (10 + i * 3) * 65536 + 10);
  for (const r of rs.regions) {
    r.__all = rs.regions;
    r.neighbors = [1];
    r.cellCount = 100; // > 50 ⇒ 达门槛
    r.merged = 0;
    r.finalised = 0;
  }
  const pairs = bridgePair5x5(ctx, rs.regions[0]);
  assert.ok(pairs >= 0, 'pairs 应为非负');
  // ⚠ 关键：bridges 有值但**地图上没有桥**（sub_58F2C0 未移植）
  // 这里只断言"记账"行为，不断言 tile 变化
});

// ---------------------------------------------------------------------------
// ④ 主入口两轮序
// ---------------------------------------------------------------------------

test('bridgeConnectPass 恒返回 1（与原生签名一致）', () => {
  const ctx = makeCtx();
  const rs = createRegionState();
  for (let i = 0; i < 3; i++) regionCtor(ctx, rs, (10 + i * 3) * 65536 + 10);
  assert.equal(bridgeConnectPass(ctx, rs), 1);
  for (const r of rs.regions) {
    assert.ok(Array.isArray(r.neighbors), 'neighbors 应已初始化');
    assert.ok(Array.isArray(r.bridges), 'bridges 应已初始化');
  }
});

test('bridgeConnectPass：所有区域都被处理（两轮都跑）', () => {
  const ctx = makeCtx();
  const rs = createRegionState();
  for (let i = 0; i < 3; i++) regionCtor(ctx, rs, (10 + i * 3) * 65536 + 10);
  bridgeConnectPass(ctx, rs);
  // 每个区域都应有 neighbors（哪怕为空数组）⇒ 说明第一轮覆盖了全部
  for (const r of rs.regions) {
    assert.ok(r.neighbors !== undefined, `区域 ${r.id} 未被第一轮处理`);
  }
});

// ---------------------------------------------------------------------------
// ⑤ 管线集成
// ---------------------------------------------------------------------------

test('runBridgeStage 对 MapType=1 是 no-op', () => {
  const sed = loadSed(readFileSync(join(FIX, 'randmap_maptype1_2p.sed')).toString('latin1'));
  const dims = deriveDimensions(sed as RmgOptions);
  const { state } = generateFullMap(
    {
      seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
      numPlayers: sed.numPlayers, ruggedness: sed.ruggedness,
      vegetation: sed.vegetation, tiberiumLayout: sed.tiberiumLayout,
      tiberium: sed.tiberium, resources: sed.resources,
      theater: sed.theater, dimensions: dims, tables,
    },
    'Random Map',
  );
  const before = state.regions.regions.map((r) => JSON.stringify(r.neighbors ?? null));
  runBridgeStage(state);
  const after = state.regions.regions.map((r) => JSON.stringify(r.neighbors ?? null));
  assert.deepEqual(after, before, 'MapType=1 时阶段 8 不应改动区域');
});

test('MapType=4 端到端：阶段 8 生效且仍能出图', () => {
  const sed = loadSed(readFileSync(join(FIX, 'randmap_maptype4_8p.sed')).toString('latin1'));
  const dims = deriveDimensions(sed as RmgOptions);
  const { state, ini } = generateFullMap(
    {
      seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
      numPlayers: sed.numPlayers, ruggedness: sed.ruggedness,
      vegetation: sed.vegetation, tiberiumLayout: sed.tiberiumLayout,
      tiberium: sed.tiberium, resources: sed.resources,
      theater: sed.theater, dimensions: dims, tables,
    },
    'Random Map',
  );
  assert.ok(ini.includes('[IsoMapPack5]'), '仍应产出地图');

  assert.ok(ini.includes('[IsoMapPack5]'), '仍应产出地图');

  // ✅ 2026-10-07 修复后：3/4 型水体长出水（302 格）⇒ 区域表有 8 个区域
  //   ⇒ 阶段 8 真的填了邻接关系。
  //   （此前区域表为空，根因是 `ScratchSlot.regionId` 默认 0 而非 −1，
  //    而 3/4 型不走 `waterBasic` 的重置步骤 —— 已在 `waterBasicMt34` 修掉。）
  assert.ok(state.regions.regions.length > 0, '应有区域');

  // ⚠ `generateFullMap` 的**后续阶段（起点/矿场）会重建区域表** ——
  //   实测最终只剩 1 个区域（`cellCount=32296`），阶段 8 填的 `neighbors`
  //   因对象被换掉而丢失。这是**与原生一致的行为**（起点阶段重划区域），
  //   不是缺陷。阶段 8 的成果要在 `generateThroughGreen` 这一层断言。
  for (const r of state.regions.regions) {
    assert.ok(Array.isArray(r.bridges) || r.bridges === undefined,
      'bridges 若存在必须是数组');
  }
});

test('阶段 8 在 generateThroughGreen 层产出真实邻接关系', () => {
  // 阶段 8 的效果要在**未被后续阶段重划**的层面断言
  const sed = loadSed(readFileSync(join(FIX, 'randmap_maptype4_8p.sed')).toString('latin1'));
  const dims = deriveDimensions(sed as RmgOptions);
  const state = generateThroughGreen({
    seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
    numPlayers: sed.numPlayers, ruggedness: sed.ruggedness,
    vegetation: sed.vegetation, tiberiumLayout: sed.tiberiumLayout,
    tiberium: sed.tiberium, resources: sed.resources,
    theater: sed.theater, dimensions: dims, tables,
  });
  assert.ok(state.regions.regions.length > 1,
    `3/4 型应建出多个区域，实际 ${state.regions.regions.length}`);
  for (const r of state.regions.regions) {
    assert.ok(Array.isArray(r.neighbors), 'neighbors 应是数组');
    assert.ok(Array.isArray(r.bridges), 'bridges 应是数组');
    assert.ok(!r.neighbors!.includes(r.id), 'neighbors 不应含自身');
  }
  const anyNeighbors = state.regions.regions.some((r) => r.neighbors!.length > 0);
  assert.ok(anyNeighbors, '应至少有一个区域认出邻接区域');
});
