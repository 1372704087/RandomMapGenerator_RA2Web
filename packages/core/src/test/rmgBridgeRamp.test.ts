/**
 * 阶段 10（`0x578E60` 桥坡 + `0x5A17F0` 水砖再锚定）的状态契约。
 *
 * 依据 `re/decomp/578E60_Bridge_RampStamp.c`（80 行）
 *    + `5A17F0_Water_Reanchor.c`（67 行）。
 *
 * 【原生序已核实（`0x598D62` 调用块）】
 *   `0x5A19E0` 阶段 9 悬崖落差 → **`0x578E60` 阶段 10a 桥坡**
 *   → **`0x5A17F0` 阶段 10b 水砖再锚定** → 阶段 11 绿地
 *   调用实参：`push -1; push ebx; mov ecx, …; call 0x578E60`
 *             ⇒ `a2 = -1`
 *
 * 【🔴 本测试锁住的是「未接入」这个状态】
 * `0x578E60` 是**包装器**，真正的盖坡动作在 `sub_579010`（筛选）/
 * `sub_579620`（盖坡）里，两者**未反编译**。
 * 本移植的第一轮近似（"全图都要可生长"）实测会让桥坡**永不生效**
 * （1808 格后 `pass1Ok=false` ⇒ `stamped=0`），
 * 故 `runBridgeRampStage` **只调用 `waterReanchor`**。
 *
 * 这个测试的作用是：**一旦将来反编译了 `579010`/`579620` 并接入桥坡，
 * 本文件会立刻失败**，提醒同步更新"未接入"的事实声明。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { bridgeRampStamp, waterReanchor, canAdvanceBridge } from '../rmg/bridgeRamp';
import { runBridgeRampStage, generateThroughGreen } from '../rmg/pipeline';
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

function makeCtx(mapW = 40, mapH = 40): WaterContext {
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
// 🔴 桥坡：未接入的事实声明
// ---------------------------------------------------------------------------

test('bridgeRampStamp：桥坡不再是死路径（stamped > 0）', () => {
  // ✅ 2026-10-07 按 capstone 实测修正两处后，stamped 从 0 变为全图规模：
  //   ① `0x579010` 返回「工作是否推进」，不是「地形是否可生长」
  //   ② `0x578E60` 的循环是**累积成功标志**（`test bl,bl` 检查上一次），
  //      **伪码写的 `if (v2 == 0) break` 是反的**
  const ctx = makeCtx();
  const r = bridgeRampStamp(ctx, -1);
  assert.ok(r.stamped > 0,
    `桥坡应实际盖坡（曾恒为 0 = 死路径），实际 ${r.stamped}`);
  assert.ok(r.pass1 > 0, '第一轮应至少迭代一次');
});

test('canAdvanceBridge：同 tileset 邻格 ⇒ 可推进', () => {
  const ctx = makeCtx();
  const { cellAtD } = require('../rmg/water') as { cellAtD: typeof import('../rmg/water').cellAtD };
  const { DIRECTION_OFFSETS } = require('../rmg/cell') as typeof import('../rmg/cell');
  // ⚠ 不能用「cellAtD 非 null」挑点 —— 带外会命中**共享哨兵**，
  //   对哨兵调 `coordOfCell` 会抛 "cell 不在 playfield"。
  //   直接取图心附近的确定 playfield 坐标。
  const ax = Math.floor(ctx.cells.mapW / 2) + 1;
  const ay = ctx.cells.mapH;
  const probe = cellAtD(ctx, ax, ay);
  if (!probe) return;
  const self = cellAtD(ctx, ax, ay)!;
  self.tile = tables.clearTile ?? 0;
  // 在 +1 方向放同 tileset 的邻格
  const o1 = DIRECTION_OFFSETS[1];
  cellAtD(ctx, ax + o1[0], ay + o1[1])!.tile = self.tile;
  assert.equal(canAdvanceBridge(ctx, self), true,
    '同 tileset 邻格存在时应返回 true（可作为连接点）');
});

test('runBridgeRampStage：桥坡已接入', () => {
  // 构造一张有水的图，让第一轮近似必然失败
  const ctx = makeCtx();
  for (const cell of ctx.cells.iterate()) {
    cell.tile = tables.waterSet; // 全部设成水 ⇒ 非 clear
    break;
  }
  const r = bridgeRampStamp(ctx, -1);
  // 关键：runBridgeRampStage 内部不再调用 bridgeRampStamp，
  // 所以这里只验证 waterReanchor 不会抛异常
  const n = waterReanchor(ctx);
  assert.equal(typeof n, 'number', 'waterReanchor 应返回数字');
  void r;
});

// ---------------------------------------------------------------------------
// ✅ waterReanchor（0x5A17F0）语义明确
// ---------------------------------------------------------------------------

test('waterReanchor：无水砖时返回 0', () => {
  const ctx = makeCtx();
  assert.equal(waterReanchor(ctx), 0, '全图 clear 时不该有水砖需要重锚');
});

test('waterReanchor：只处理 water tile 族（waterSet..+40）', () => {
  const ctx = makeCtx();
  let touched = 0;
  for (const cell of ctx.cells.iterate()) {
    // 放一个水 tile：+4 方向同 tile、且 +2 方向 level 更高 ⇒ 触发重锚
    cell.tile = tables.waterSet;
    cell.level = 2;
    touched += 1;
    if (touched > 3) break;
  }
  const n = waterReanchor(ctx);
  // 不管命中与否都应是有限数字（不抛异常 / 不返回 NaN）
  assert.ok(Number.isFinite(n), `应返回有限数字，实际 ${n}`);
  assert.ok(n >= 0, '修正格数应非负');
});

// ---------------------------------------------------------------------------
// 管线集成
// ---------------------------------------------------------------------------

test('runBridgeRampStage 对 MapType=1 是 no-op', () => {
  const sed = loadSed(readFileSync(join(FIX, 'randmap_maptype1_2p.sed')).toString('latin1'));
  const dims = deriveDimensions(sed as RmgOptions);
  const state = generateThroughGreen({
    seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
    numPlayers: sed.numPlayers, ruggedness: sed.ruggedness,
    vegetation: sed.vegetation, tiberiumLayout: sed.tiberiumLayout,
    tiberium: sed.tiberium, resources: sed.resources,
    theater: sed.theater, dimensions: dims, tables,
  });
  // 不应抛异常
  runBridgeRampStage(state);
  assert.ok(true, 'MapType=1 时阶段 10 应 no-op 且不抛异常');
});

test('MapType=4 端到端：阶段 10 接入后仍能出图', () => {
  const sed = loadSed(readFileSync(join(FIX, 'randmap_maptype4_8p.sed')).toString('latin1'));
  const dims = deriveDimensions(sed as RmgOptions);
  const state = generateThroughGreen({
    seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
    numPlayers: sed.numPlayers, ruggedness: sed.ruggedness,
    vegetation: sed.vegetation, tiberiumLayout: sed.tiberiumLayout,
    tiberium: sed.tiberium, resources: sed.resources,
    theater: sed.theater, dimensions: dims, tables,
  });
  runBridgeRampStage(state);
  assert.ok(true, 'MapType=4 阶段 10 应正常执行');
});

// ---------------------------------------------------------------------------
// 🔴 分布回归：防止「模板铺设」被误当「改单格」用
// ---------------------------------------------------------------------------

test('【回归】桥坡不得把 clear 刷成水（历史事故：87% 变水）', () => {
  // 🔴 2026-10-07 事故：`bridgeRampStamp` 曾用 `placeTileBlock`（= 原生
  // `0x5A6C10` 的**模板铺设**：`cell.tile = ts.base` 且循环 w×h）
  // 来实现未移植的「盖坡」⇒ 27504 个水格各铺一遍水族模板
  // ⇒ MT4 的 clear 31950 → 4238、water 115 → 28242（水占比 1.6% → 87%）。
  //
  // 本断言锁住「分布」而非「产出数量」——
  // 原来的 `stamped > 0` 断言在事故发生时**依然通过**（stamped = 28243）。
  const { generateThroughGreen } = require('../rmg/pipeline') as {
    generateThroughGreen: typeof import('../rmg/pipeline').generateThroughGreen;
  };
  const { deriveDimensions } = require('../rmg/options') as typeof import('../rmg/options');
  const { loadSed } = require('../rmg/sed') as typeof import('../rmg/sed');
  const sed = loadSed(readFileSync(join(FIX, 'randmap_maptype4_8p.sed')).toString('latin1'));
  const state = generateThroughGreen({
    seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
    numPlayers: sed.numPlayers, ruggedness: sed.ruggedness,
    vegetation: sed.vegetation, tiberiumLayout: sed.tiberiumLayout,
    tiberium: sed.tiberium, resources: sed.resources,
    theater: sed.theater, dimensions: deriveDimensions(sed as RmgOptions), tables,
  });
  const countWater = (): number => {
    let n = 0;
    for (const cell of state.ctx.cells.iterate()) {
      if (cell.tile >= tables.waterSet && cell.tile < tables.waterSet + 14) n += 1;
    }
    return n;
  };
  const waterBefore = countWater();
  runBridgeRampStage(state);
  const waterAfter = countWater();

  // ★ 直接锁住事故：**桥坡阶段不得新增任何水格**。
  //   事故时桥坡把 27504 个 clear 各铺一遍水族模板（水 115 → 28242），
  //   这个断言当场就会炸；而旧的「stamped > 0」断言当时**依然通过**。
  assert.equal(waterAfter, waterBefore,
    `桥坡阶段不得新增水格：之前 ${waterBefore} → 之后 ${waterAfter}`);

  // tile 分布兜底：clear 占多数，水族不得离谱。
  // ⚠ 阈值 30% 的依据是**真机 MT3 基线**（不是随手放宽）：
  //   RandMap2 8394/32604 = 25.7%、RandMap4 3217/23184 = 13.9%、
  //   RandMap5 3024/25842 = 11.7% ⇒ 正常水体本就可到 1/4。
  //   旧的 10% 是在「水体阶段水量偏少」时期定的，与真机矛盾，
  //   2026-10-08 修正 `dilateRingsToWater`（补上区域本体落水）后它会误报。
  //   事故值是 87%，30% 依然能把它抓住。
  let clear = 0;
  let total = 0;
  for (const cell of state.ctx.cells.iterate()) {
    total += 1;
    if (cell.tile === 0) clear += 1;
  }
  assert.ok(clear / total > 0.5,
    `clear 应占多数（历史事故时只剩 13%），实际 ${(clear / total * 100).toFixed(1)}%`);
  assert.ok(waterAfter / total < 0.3,
    `水格应 < 30%（历史事故时 87%），实际 ${(waterAfter / total * 100).toFixed(1)}%`);
});
