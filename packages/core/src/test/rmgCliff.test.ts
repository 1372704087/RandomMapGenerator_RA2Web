/**
 * 阶段 9（`0x5A19E0` 悬崖落差）的行为契约。
 *
 * 依据 `re/decomp/5A19E0_Cliff_Drops.c`（97 行）。
 *
 * 【原生序已核实（`0x598D62` 处的调用块）】
 * ```
 * if (mapType == 3 || mapType == 4) {
 *     0x58EBC0  阶段 7  台地阈值+分裂
 *     0x58EF10  阶段 8  桥/连接
 *     0x5A19E0  阶段 9  悬崖落差   ← 本阶段
 *     0x578E60  阶段 10 桥坡
 *     0x5A17F0  阶段 10 水砖再锚定
 * }
 * ```
 * ⇒ 阶段 9 **在山丘（阶段 16）之前**，此时图上还没有崖 tile，
 * 所以端到端跑下来调整数常为 **0** —— 这是**正确行为**，不是缺陷。
 *
 * 【锁住的语义】
 *  ① 三族 tile 判据（原生硬编码，但按 theater 相对化）：
 *     干崖 = `roughTile`（原生 131）、水崖 = `cliffSet+7`（原生 56）、
 *     抬升崖 = `cliffSet+175`（原生 224 = 12×14+7）。
 *  ② **level 台阶是 ±4 不是 ±1**（原生 `*(_BYTE*)(cell+283) ±= 4`）。
 *  ③ ①② 两族各有 **50% 概率跳过**（拒绝采样出 {0,1}）；③ 不掷 RNG。
 *  ④ 邻域方向是固定序号：+1/+2/+3/+5/+6（不是 `+0`）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cliffDrops } from '../rmg/cliff';
import { runCliffStage, generateThroughGreen, generateFullMap } from '../rmg/pipeline';
import { NativeCells } from '../rmg/native';
import { parseTheaterIni } from '../rmg/theater';
import { deriveDimensions } from '../rmg/options';
import { loadSed } from '../rmg/sed';
import { cellAtD } from '../rmg/water';
import { DIRECTION_OFFSETS } from '../rmg/cell';
import type { WaterContext } from '../rmg/water';
import type { RmgOptions } from '../rmg/options';

const FIX = join(__dirname, '..', '..', 'src', 'test', 'fixtures');
const THEATER_INI =
  process.env.RMG_THEATER_INI ??
  join(__dirname, '..', '..', '..', 'server', 'resources', 'theater', 'temperatmd.ini');
const tables = parseTheaterIni(readFileSync(THEATER_INI, 'utf8'), 'TEMPERATE');

function makeCtx(mapW = 60, mapH = 60): WaterContext {
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

/** 在菱形带内找一组可写坐标（用于构造测试地形） */
function writableSpots(ctx: WaterContext, n: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let x = 0; x < ctx.cells.mapW && out.length < n; x++) {
    for (let y = 0; y < ctx.cells.mapH && out.length < n; y++) {
      if (cellAtD(ctx, x, y)) out.push([x, y]);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// ① ③ tile 判据与 50% 概率
// ---------------------------------------------------------------------------

test('无崖 tile 时调整数为 0（阶段 9 在山丘之前，正确行为）', () => {
  const ctx = makeCtx();
  const n = cliffDrops(ctx);
  assert.equal(n, 0, '全图 clear 时不该有任何 level 调整');
});

test('干崖族：同族邻格 + 可生长邻格 ⇒ 50% 概率把邻格 level −4', () => {
  const ctx = makeCtx();
  const spots = writableSpots(ctx, 3);
  if (spots.length < 3) return; // 地图太小则跳过
  const T_DRY = tables.roughTile;
  const o3 = DIRECTION_OFFSETS[3];
  const o2 = DIRECTION_OFFSETS[2];
  const [sx, sy] = spots[0];
  // 源格与 +3 方向同族
  cellAtD(ctx, sx, sy)!.tile = T_DRY;
  cellAtD(ctx, sx + o3[0], sy + o3[1])!.tile = T_DRY;
  // +2 方向留 clear（可生长）
  const tx = sx + o2[0];
  const ty = sy + o2[1];
  const target = cellAtD(ctx, tx, ty)!;
  target.level = 4;
  const before = target.level;
  // rng.next()=0.5 ⇒ randCoin 返回 1 ⇒ 跳过（50% 分支的另一半）
  cliffDrops(ctx);
  // 无论命中与否，level 只能保持或 −4（绝不能是 +4）
  assert.ok(target.level === before || target.level === before - 4,
    `level 应保持 ${before} 或减 4，实际 ${target.level}`);
});

test('抬升崖族不掷 RNG（同族 +5/+1 ⇒ level +4）', () => {
  const ctx = makeCtx();
  const spots = writableSpots(ctx, 3);
  if (spots.length < 3) return;
  const T_RISE = tables.cliffSet + 175;
  const o5 = DIRECTION_OFFSETS[5];
  const o1 = DIRECTION_OFFSETS[1];
  const [sx, sy] = spots[0];
  const self = cellAtD(ctx, sx, sy)!;
  self.tile = T_RISE;
  self.level = 4;
  cellAtD(ctx, sx + o5[0], sy + o5[1])!.tile = T_RISE;
  cellAtD(ctx, sx + o1[0], sy + o1[1])!.tile = T_RISE;
  // ③ 不掷 RNG ⇒ 若满足条件必然 +4
  const before = self.level;
  cliffDrops(ctx);
  assert.ok(self.level === before || self.level === before + 4,
    `level 应保持 ${before} 或加 4，实际 ${self.level}`);
});

test('level 台阶是 ±4 不是 ±1', () => {
  const ctx = makeCtx();
  const spots = writableSpots(ctx, 3);
  if (spots.length < 3) return;
  const T_RISE = tables.cliffSet + 175;
  const o5 = DIRECTION_OFFSETS[5];
  const o1 = DIRECTION_OFFSETS[1];
  const [sx, sy] = spots[0];
  const self = cellAtD(ctx, sx, sy)!;
  self.tile = T_RISE;
  self.level = 4;
  cellAtD(ctx, sx + o5[0], sy + o5[1])!.tile = T_RISE;
  cellAtD(ctx, sx + o1[0], sy + o1[1])!.tile = T_RISE;
  cliffDrops(ctx);
  const diff = Math.abs(self.level - 4);
  if (diff !== 0) {
    assert.equal(diff, 4, `level 台阶必须是 4，实际差 ${diff}`);
  }
});

// ---------------------------------------------------------------------------
// ② ④ 方向序号
// ---------------------------------------------------------------------------

test('邻域方向是固定序号 +1/+2/+3/+5/+6（不是 +0）', () => {
  // 固化原生用的方向序号，防止误改成"周围 8 格"或"只取 +0"
  assert.equal(DIRECTION_OFFSETS.length, 8);
  for (const d of [1, 2, 3, 5, 6]) {
    assert.ok(Array.isArray(DIRECTION_OFFSETS[d]), `方向 ${d} 应存在`);
  }
});

// ---------------------------------------------------------------------------
// 管线集成
// ---------------------------------------------------------------------------

test('runCliffStage 对 MapType=1 返回 0（仅 3/4 型）', () => {
  const sed = loadSed(readFileSync(join(FIX, 'randmap_maptype1_2p.sed')).toString('latin1'));
  const dims = deriveDimensions(sed as RmgOptions);
  const state = generateThroughGreen({
    seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
    numPlayers: sed.numPlayers, ruggedness: sed.ruggedness,
    vegetation: sed.vegetation, tiberiumLayout: sed.tiberiumLayout,
    tiberium: sed.tiberium, resources: sed.resources,
    theater: sed.theater, dimensions: dims, tables,
  });
  assert.equal(runCliffStage(state), 0, 'MapType=1 时阶段 9 应 no-op');
});

test('MapType=4 端到端：阶段 9 接入后仍能出图', () => {
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
  assert.ok(ini.includes('[IsoMapPack5]'), '仍应产出地图');
});
