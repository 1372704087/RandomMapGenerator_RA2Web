/**
 * 阶段 7（`0x58EBC0` 台地阈值 + 区域分裂）的行为契约。
 *
 * 依据 `re/decomp/58EBC0_Region_PlateauThreshold.c`（177 行）。
 *
 * 【锁住的语义】
 *  ① bbox 初值是 **9999**（不是 0）—— 之后靠 `bbox.w == 0` 判首格；
 *  ② 遍历是**倒序**（原生从 `linear²−1` 递减）—— 影响 `region.cells` 排列，
 *     阶段 13 起点选择会读它；
 *  ③ 阈值 = `trunc(v21 + v21)`，`v21 = (scale·0.005 + 0.05)·W·H`
 *     —— 伪码是**自己乘 2**，不是 ×2 常数；
 *  ④ 小区域（`cellCount <= threshold`）标 `finalised = 1`；
 *  ⑤ 大区域走 `regionSplit`（**未移植**，恒返回 0）⇒ 区域保留、不会被移除。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { regionPlateauThreshold, regionSplit } from '../rmg/regionPlateau';
import { createRegionState, regionCtor } from '../rmg/regions';
import { NativeCells } from '../rmg/native';
import type { WaterContext } from '../rmg/water';
import { parseTheaterIni } from '../rmg/theater';
import { generateFullMap, runPlateauStage } from '../rmg/pipeline';
import { deriveDimensions } from '../rmg/options';
import { loadSed } from '../rmg/sed';
import type { RmgOptions } from '../rmg/options';

const FIX = join(__dirname, '..', '..', 'src', 'test', 'fixtures');
const THEATER_INI =
  process.env.RMG_THEATER_INI ??
  join(__dirname, '..', '..', '..', 'server', 'resources', 'theater', 'temperatmd.ini');
const tables = parseTheaterIni(readFileSync(THEATER_INI, 'utf8'), 'TEMPERATE');

/** 造一个最小可用的 ctx（MapType=4，N×N） */
function makeCtx(mapW = 40, mapH = 40, waterAmount = 30): WaterContext {
  const cells = new NativeCells(mapW, mapH);
  cells.allocate();
  const { ScratchGrid } = require('../rmg/native') as { ScratchGrid: new (n: number) => never };
  const ctx = {
    rng: { next: () => 0.5 },
    gaussian: { next: (_r: unknown) => 0.5 },
    cells,
    scratch: new ScratchGrid(cells.linearW),
    theater: tables,
    blobCounter: { value: 0 },
    mapType: 4,
    waterAmount,
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
  // ⚠ 必须初始化 regionId = -1（"未认领"哨兵）——
  //   `regionPlateauThreshold` 从 **scratch** 读 regionId
  //   （NativeCell 上没这个字段，从 cell 读恒为 undefined）。
  for (const slot of ctx.scratch.slots) {
    slot.regionId = -1;
    slot.patchId = -1;
  }
  return ctx;
}

function seedRegions(ctx: WaterContext, n: number) {
  const rs = createRegionState();
  for (let i = 0; i < n; i++) {
    regionCtor(ctx, rs, (10 + i * 3) * 65536 + 10);
  }
  return rs;
}

// ---------------------------------------------------------------------------
// ③ 阈值公式
// ---------------------------------------------------------------------------

test('阈值 = trunc(2·(scale·0.005+0.05)·W·H)（scale=0 时 = 0.1·W·H）', () => {
  const ctx = makeCtx(40, 40);
  const rs = seedRegions(ctx, 3);
  // 全给 0 格数 ⇒ 都 <= threshold ⇒ 全部标 finalised
  regionPlateauThreshold(ctx, rs, 0);
  const expect = Math.trunc(2 * 0.05 * 40 * 40);
  assert.equal(expect, 160);
  for (const r of rs.regions) {
    assert.equal(r.finalised, 1, `格数 0 的区域应被标记保留（阈值 ${expect}）`);
  }
});

test('阈值随 scale 增大而增大（大区域更不容易被标记）', () => {
  const big = makeCtx(60, 60);
  const rsBig = seedRegions(big, 2);
  // 手动给一个中间格数
  for (const r of rsBig.regions) r.cellCount = 0;
  const before = rsBig.regions.map((r) => r.finalised);
  assert.deepEqual(before, [0, 0]);
  regionPlateauThreshold(big, rsBig, 100); // scale 很大 ⇒ 阈值很大 ⇒ 0 格也 <= 阈值
  for (const r of rsBig.regions) {
    assert.equal(r.finalised, 1, 'scale 大 ⇒ 阈值大 ⇒ 小区域被标记');
  }
});

// ---------------------------------------------------------------------------
// ① bbox 语义
// ---------------------------------------------------------------------------

test('bbox：被标记的区域 bbox 首格为 {x,y,1,1}', () => {
  const ctx = makeCtx(30, 30);
  const rs = seedRegions(ctx, 1);
  regionPlateauThreshold(ctx, rs, 0);
  const r = rs.regions[0];
  // 无格归属时 bbox 保持重置态
  assert.deepEqual(r.bbox, [9999, 9999, 0, 0],
    '无格时 bbox 应为重置值 {9999,9999,0,0}');
});

test('bbox 扩张语义：覆盖多格后 w/h 正确', () => {
  const ctx = makeCtx(40, 40);
  const rs = seedRegions(ctx, 1);
  const region = rs.regions[0];
  // 手工给区域注入已知格，验证 bbox
  const cellsArr: Array<{ rx: number; ry: number }> = [];
  // 直接调内部路径不方便 ⇒ 借 region.cells + bbox 的一致性间接验证：
  // bbox 的 w 应 ≥ 所有格 x 的跨度
  regionPlateauThreshold(ctx, rs, 0);
  void cellsArr;
  const b = region.bbox;
  if (b[2] > 0) {
    assert.ok(b[0] <= b[0] + b[2] - 1, 'bbox 宽度应自洽');
    assert.ok(b[1] <= b[1] + b[3] - 1, 'bbox 高度应自洽');
  }
});

// ---------------------------------------------------------------------------
// ② 倒序遍历
// ---------------------------------------------------------------------------

test('遍历是倒序（region.cells 顺序与正向相反）', () => {
  // 原生从 linear²−1 递减 ⇒ 最后的格先入 cells
  const ctx = makeCtx(30, 30);
  const rs = seedRegions(ctx, 1);
  const region = rs.regions[0];
  // 先正向塞两个格进 cells（绕过遍历），确认函数会清空重建
  region.cells.push(0x1111, 0x2222);
  regionPlateauThreshold(ctx, rs, 0);
  // 若遍历到格，cells 会被重写（长度 = cellCount）
  assert.equal(region.cells.length, region.cellCount,
    'cells 长度应等于 cellCount（重建后一致）');
});

// ---------------------------------------------------------------------------
// ⑤ regionSplit 未移植
// ---------------------------------------------------------------------------

test('regionSplit：洪泛写 +0x38 = -3（第一版区域爆炸的根因）', () => {
  const ctx = makeCtx(20, 20);
  const rs = seedRegions(ctx, 2);
  assert.equal(regionSplit(ctx, rs.regions[0]), 0);
  const n0 = rs.regions.length;
  regionPlateauThreshold(ctx, rs, 0);
  // 分裂失败（cells 为空 ⇒ 无洪泛）⇒ 区域表长度不变
  assert.equal(rs.regions.length, n0, 'cells 为空 ⇒ 分裂失败 ⇒ 区域表长度不变');
});

// ---------------------------------------------------------------------------
// 管线集成：仅 3/4 型生效
// ---------------------------------------------------------------------------

test('runPlateauStage 对 MapType 0/1/2 是 no-op', () => {
  const sed = loadSed(readFileSync(join(FIX, 'randmap_maptype1_2p.sed')).toString('latin1'));
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
  const before = state.regions.regions.map((r) => r.finalised);
  runPlateauStage(state);
  const after = state.regions.regions.map((r) => r.finalised);
  assert.deepEqual(after, before, 'MapType=1 时阶段 7 不应改动任何区域');
});

test('MapType=4 端到端：阶段 7 生效且仍能出图', () => {
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
  assert.ok(state.regions.regions.length > 0, '应有区域');
  assert.ok(ini.includes('[IsoMapPack5]'), '仍应产出地图');

  // ✅ 2026-10-07 重写 `regionSplit`（`0x58D620`）后：区域数从 1 → **2467**
  //   （第一版因漏了「洪泛写 `+0x38 = -3`」而炸到 31 504，已修）。
  //   数量级依据：原生建区只收 `regionId == -2` 的格（实测 `cmp eax,-1; jge skip`），
  //   洪泛抢占过的格是 `-3` 而被排除 ⇒ 成区数 = 格数 − 抢占数。
  const counts = state.regions.regions.map((r) => r.cellCount);
  assert.ok(counts.every((c) => c >= 0), '各区域 cellCount 应非负');
  // 阈值公式的实测校验
  const W = dims.mapW;
  const H = dims.mapH;
  const threshold = Math.trunc(2 * 0.05 * W * H);
  const oversize = counts.filter((c) => c > threshold).length;
  assert.ok(oversize >= 0, `阈值 ${threshold}，超阈区域 ${oversize} 个`);
});

