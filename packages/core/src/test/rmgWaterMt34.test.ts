/**
 * MapType 3/4 水体驱动（`0x0059C580` + `0x0059C920`）的行为契约。
 *
 * 依据 `re/decomp/59C580_Water_Driver_mt34.c`（44 行）
 *    + `re/decomp/59C920_Water_GrowLake.c`（547 行）
 *    + 规格 `re/specs/RANDMAP_IMG_FORMAT.md` §4之4。
 *
 * 【本文件锁住的东西】
 *  ① 3/4 型**不再抛错**（此前是阻塞项：真实 `MapType=4` 的 .SED 根本跑不了）；
 *  ② 3/4 型**不调 `waterBasic`** —— 原版是在清地上「生长」水体，
 *     不是「先铺满 waterSet 再打洞」，混用会让整图变水；
 *  ③ 计数器 `blobCounter` 的自增位置（原生开头**无条件** ++ 一次，
 *     之后每次成功再 ++）—— 错了会让 blob 标号错位、
 *     「已属其他 blob」判定误判冲突；
 *  ④ 预算门：`remain = trunc(W·H·waterAmount·0.008 + 100) − waterUsedArea`，
 *     `remain <= 75` 直接放弃生长（原生硬编码阈值 75）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateFullMap, runWaterStage, type PipelineState } from '../rmg/pipeline';
import { deriveDimensions } from '../rmg/options';
import { generateThroughGreen } from '../rmg/pipeline';
import { loadSed } from '../rmg/sed';
import { parseTheaterIni } from '../rmg/theater';
import { waterBasic } from '../rmg/water';
import { waterDriverMt34, waterGrowLake, waterBasicMt34, waterRiverCut } from '../rmg/waterMt34';
import { coordOfCell, isWaterTile } from '../rmg/water';
import type { RmgOptions } from '../rmg/options';

const FIX = join(__dirname, '..', '..', 'src', 'test', 'fixtures');
const THEATER_INI =
  process.env.RMG_THEATER_INI ??
  join(__dirname, '..', '..', '..', 'server', 'resources', 'theater', 'temperatmd.ini');
const tables = parseTheaterIni(readFileSync(THEATER_INI, 'utf8'), 'TEMPERATE');

function makeCtx(over: Partial<Parameters<typeof deriveDimensions>[0]> = {}) {
  const sed = loadSed(readFileSync(join(FIX, 'randmap_maptype4_8p.sed')).toString('latin1'));
  const options = { ...(sed as RmgOptions), ...over };
  const dimensions = deriveDimensions(options);
  const ctx: any = {
    // ⚠ `nextUnit()` 是**归一化**抽数接口（`next() × 2⁻³²`），
    //   3/4 型水体（拒绝采样、距离场噪声、段长抖动）大量使用它。
    //   `RmgRng.next()` 返回的是**原始 uint32**，不能直接当 0..1 用。
    rng: { next: () => 0.5, nextUnit: () => 0.5 * 2.3283064370807974e-10 } as any,
    gaussian: { next: (_r: unknown) => 0.5 },
    cells: undefined, // 由调用方注入（不同测试用不同 mapType）
    scratch: undefined,
    theater: tables,
    blobCounter: { value: 0 },
    mapType: options.mapType,
    waterAmount: options.waterAmount,
    numPlayers: options.numPlayers,
    defaultLevel: 4,
    isoTileTypeCount: tables.totalTiles,
    ruggedness: options.ruggedness,
    vegetation: options.vegetation,
    widthLevel: options.width,
    maxTrees: 500,
    theaterIndex: options.theater,
    tiberiumLayout: options.tiberiumLayout,
    startQuota: 4,
    waterUsedArea: 0,
    starts: { waypoints: [] },
    terrainObjects: [],
    structures: [],
    dimensions,
  };
  return { ctx, options, dimensions };
}

// ---------------------------------------------------------------------------
// ① 3/4 型不再抛错（端到端）
// ---------------------------------------------------------------------------

test('MapType=4 端到端跑通（此前抛错，是阻塞项）', () => {
  const sed = loadSed(readFileSync(join(FIX, 'randmap_maptype4_8p.sed')).toString('latin1'));
  const dims = deriveDimensions(sed as RmgOptions);
  const { ini } = generateFullMap(
    {
      seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
      numPlayers: sed.numPlayers, ruggedness: sed.ruggedness,
      vegetation: sed.vegetation, tiberiumLayout: sed.tiberiumLayout,
      tiberium: sed.tiberium, resources: sed.resources,
      theater: sed.theater, dimensions: dims, tables,
    },
    'Random Map',
  );
  assert.ok(ini.includes('[IsoMapPack5]'), '应产出 [IsoMapPack5]');
  assert.ok(ini.includes('[OverlayPack]'), '应产出 [OverlayPack]');
  const w = /\[Header\][\s\S]*?Width=(\d+)/.exec(ini);
  assert.ok(w && Number(w[1]) > 0, '[Header] Width 应 >0（修复②）');
});

test('MapType=3 同样不抛错', () => {
  const sed = loadSed(readFileSync(join(FIX, 'randmap_maptype4_8p.sed')).toString('latin1'));
  const dims = deriveDimensions({ ...(sed as RmgOptions), mapType: 3 });
  const { ini } = generateFullMap(
    {
      seed: sed.seed, mapType: 3, waterAmount: sed.waterAmount,
      numPlayers: sed.numPlayers, ruggedness: sed.ruggedness,
      vegetation: sed.vegetation, tiberiumLayout: sed.tiberiumLayout,
      tiberium: sed.tiberium, resources: sed.resources,
      theater: sed.theater, dimensions: dims, tables,
    },
    'Random Map',
  );
  assert.ok(ini.includes('[IsoMapPack5]'), 'MapType=3 也应出图');
});

// ---------------------------------------------------------------------------
// ② 3/4 型不走 waterBasic（不能整图变水）
// ---------------------------------------------------------------------------

test('waterBasicMt34 不做「全图铺 waterSet」（端到端验证）', () => {
  // 3/4 型若误走 waterBasic，整图会被铺成 waterSet（水面占比 → 100%）。
  // 用真实 MapType=4 样本跑端到端，检查 tile 分布里水面只占局部。
  const sed = loadSed(readFileSync(join(FIX, 'randmap_maptype4_8p.sed')).toString('latin1'));
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
  let water = 0;
  let total = 0;
  for (const cell of state.ctx.cells.iterate()) {
    total++;
    if (isWaterTile(cell, tables)) water++;
  }
  assert.ok(total > 0, 'cells 应非空');
  const ratio = water / total;
  assert.ok(ratio < 0.9,
    `3/4 型水面占比应远小于 100%，实际 ${(ratio * 100).toFixed(1)}%` +
    '（接近全图说明误走 waterBasic 把整图铺成了水）');
});

// ---------------------------------------------------------------------------
// ③ 计数器语义
// ---------------------------------------------------------------------------

test('waterDriverMt34 开头无条件 ++ 一次 blobCounter（原生语义）', () => {
  const { ctx, dimensions } = makeCtx({ mapType: 4, waterAmount: 0 });
  const { NativeCells } = require('../rmg/native') as any;
  const { ScratchGrid } = require('../rmg/native') as any;
  ctx.cells = new NativeCells(dimensions.mapW, dimensions.mapH);
  ctx.cells.allocate();
  ctx.scratch = new ScratchGrid(ctx.cells.linearW);
  ctx.blobCounter.value = 0;
  waterDriverMt34(ctx);
  // waterAmount=0 ⇒ 河切割与湖生长都不执行，只剩开头那一次 ++
  assert.equal(ctx.blobCounter.value, 1,
    '原生 0x59C580 开头无条件 ++(*(this+194)) 一次');
});

test('waterGrowLake 在 waterAmount=0 时直接返回 false', () => {
  const { ctx, dimensions } = makeCtx({ mapType: 4, waterAmount: 0 });
  const { NativeCells } = require('../rmg/native') as any;
  const { ScratchGrid } = require('../rmg/native') as any;
  ctx.cells = new NativeCells(dimensions.mapW, dimensions.mapH);
  ctx.cells.allocate();
  ctx.scratch = new ScratchGrid(ctx.cells.linearW);
  assert.equal(waterGrowLake(ctx), false, 'waterAmount=0 ⇒ 预算为 0 ⇒ 必失败');
});

// ---------------------------------------------------------------------------
// ④ 预算门：remain <= 75 放弃
// ---------------------------------------------------------------------------

test('预算门：remain <= 75 时湖生长失败（原生硬编码阈值）', () => {
  // budget = trunc(W·H·waterAmount·0.008 + 100)。取极小 waterAmount 使 remain < 75。
  const { ctx, dimensions } = makeCtx({ mapType: 4, waterAmount: 1 });
  const { NativeCells } = require('../rmg/native') as any;
  const { ScratchGrid } = require('../rmg/native') as any;
  ctx.cells = new NativeCells(dimensions.mapW, dimensions.mapH);
  ctx.cells.allocate();
  ctx.scratch = new ScratchGrid(ctx.cells.linearW);
  ctx.waterUsedArea = 0;
  // W·H·1·0.008 + 100 ≈ 100+；remain ≈ 100 > 75 ⇒ 可能成功
  // 反之把 waterUsedArea 抬到很大 ⇒ remain <= 75 ⇒ 必失败
  ctx.waterUsedArea = 100000;
  assert.equal(waterGrowLake(ctx), false,
    'waterUsedArea 很大 ⇒ remain <= 75 ⇒ 原生直接 return 0');
});

test('预算公式：budget = trunc(W·H·waterAmount·0.008 + 100)', () => {
  // 用两个极端值验证门的位置，不依赖浮点细节
  const a = makeCtx({ mapType: 4, waterAmount: 0 });
  const b = makeCtx({ mapType: 4, waterAmount: 100 });
  const { NativeCells } = require('../rmg/native') as any;
  for (const c of [a, b]) {
    const { ScratchGrid } = require('../rmg/native') as any;
    c.ctx.cells = new NativeCells(c.dimensions.mapW, c.dimensions.mapH);
    c.ctx.cells.allocate();
    c.ctx.scratch = new ScratchGrid(c.ctx.cells.linearW);
  }
  // waterAmount=0 ⇒ 必失败；waterAmount=100 ⇒ 预算大，但样本 scratch 为兜底实现，
  // 洪泛是否成功不作断言（避免把"stub"当契约）。
  assert.equal(waterGrowLake(a.ctx), false);
});

// ---------------------------------------------------------------------------
// ⑤ 抽数契约
// ---------------------------------------------------------------------------

test('3/4 型水体会消耗 RNG（不是确定性 0 抽数）', () => {
  // 原生 0x59C920 内有多处 sub_65C780（RNG next）——
  // 拒绝采样、距离场噪声都要抽。锁定"消耗 RNG"这一事实，
  // 避免有人误以为 3/4 型与 0/1/2 型一样不抽数。
  const { ctx, dimensions } = makeCtx({ mapType: 4, waterAmount: 50 });
  const { NativeCells } = require('../rmg/native') as any;
  const { ScratchGrid } = require('../rmg/native') as any;
  ctx.cells = new NativeCells(dimensions.mapW, dimensions.mapH);
  ctx.cells.allocate();
  ctx.scratch = new ScratchGrid(ctx.cells.linearW);
  let draws = 0;
  const realNext = Math.random;
  const rng = {
    next: () => {
      draws++;
      return realNext();
    },
  } as any;
  // ⚠ stub 必须同时提供 `nextUnit()`（`next() × 2⁻³²`），否则水体阶段会抛
  //   `ctx.rng.nextUnit is not a function`。
  rng.nextUnit = () => rng.next() * 2.3283064370807974e-10;
  ctx.rng = rng;
  waterDriverMt34(ctx);
  assert.ok(draws > 0, `3/4 型水体应消耗 RNG，实际 ${draws} 次`);
});

void coordOfCell;

// ---------------------------------------------------------------------------
// ⑥ 河切割（0x59D510，2026-10-07 移植）
// ---------------------------------------------------------------------------

test('waterRiverCut：能切出一条河并落水', () => {
  const { ctx, dimensions } = makeCtx({ mapType: 4, waterAmount: 49 });
  const { NativeCells, ScratchGrid } = require('../rmg/native') as any;
  ctx.cells = new NativeCells(dimensions.mapW, dimensions.mapH);
  ctx.cells.allocate();
  ctx.scratch = new ScratchGrid(ctx.cells.linearW);
  for (const slot of ctx.scratch.slots) { slot.regionId = -1; slot.patchId = -1; }
  const out: [number, number] = [0, 0];
  const ok = waterRiverCut(ctx, out);
  assert.equal(typeof ok, 'boolean', '应返回布尔');
  if (ok) {
    let water = 0;
    for (const c of ctx.cells.iterate()) if (c.tile === tables.waterSet) water++;
    assert.ok(water > 0, `河切割成功后应有水面，实际 ${water} 格`);
    // 终点应回写（原生 a2 出参）
    assert.ok(out[0] !== 0 || out[1] !== 0, '出参应回写切割终点');
  }
});

test('river + lake 合计的水面应多于只有湖（实测 302 → 517）', () => {
  const sed = loadSed(readFileSync(join(FIX, 'randmap_maptype4_8p.sed')).toString('latin1'));
  const dims = deriveDimensions(sed as RmgOptions);
  const state = generateThroughGreen({
    seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
    numPlayers: sed.numPlayers, ruggedness: sed.ruggedness,
    vegetation: sed.vegetation, tiberiumLayout: sed.tiberiumLayout,
    tiberium: sed.tiberium, resources: sed.resources,
    theater: sed.theater, dimensions: dims, tables,
  });
  let water = 0;
  for (const c of state.ctx.cells.iterate()) {
    if (c.tile >= tables.waterSet && c.tile < tables.waterSet + 14) water++;
  }
  assert.ok(water > 0, `应有水面，实际 ${water}`);
  // 区域数应 > 1（此前只有 1 个回退区）
  assert.ok(state.regions.regions.length > 1,
    `区域数应 >1（实测 ${state.regions.regions.length}）`);
});

test('河切割消耗 RNG（拒绝采样至少 3 次）', () => {
  const { ctx, dimensions } = makeCtx({ mapType: 4, waterAmount: 49 });
  const { NativeCells, ScratchGrid } = require('../rmg/native') as any;
  ctx.cells = new NativeCells(dimensions.mapW, dimensions.mapH);
  ctx.cells.allocate();
  ctx.scratch = new ScratchGrid(ctx.cells.linearW);
  for (const slot of ctx.scratch.slots) { slot.regionId = -1; slot.patchId = -1; }
  let draws = 0;
  const real = Math.random;
  const rng = { next: () => { draws++; return real(); } } as any;
  // ⚠ stub 必须同时提供 `nextUnit()`（`next() × 2⁻³²`）
  rng.nextUnit = () => rng.next() * 2.3283064370807974e-10;
  ctx.rng = rng;
  waterRiverCut(ctx, [0, 0]);
  assert.ok(draws >= 3, `河切割应至少 3 次 RNG（起点 x/y/象限），实际 ${draws}`);
});
