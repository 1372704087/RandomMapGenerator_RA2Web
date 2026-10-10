/**
 * 阶段 9（仅 MapType 3/4）：悬崖落差 —— 原生 `0x005A19E0`（size=0x285，97 行伪码）。
 *
 * 依据 `re/decomp/5A19E0_Cliff_Drops.c`。
 *
 * 【算法（逐行对照伪码）】
 * 蛇形扫全图，对每格 `i` 取 8 邻的 5 个固定方向
 * （`sub_481810(n)` = 取第 n 号方向的邻格）：
 *   `v13 = +5` `v14 = +1` `v2 = +3` `v3 = +2` `v4 = +6`
 *
 * 按本格 tile 分三族：
 *
 * ① **干悬崖**（原生 tile 131，典型 theater 恰等于 `theater.roughTile`）
 *    - 需 `+3` 方向也是 131 **且** `+2` 方向通过 `sub_486380`
 *    - **50% 概率跳过**（拒绝采样出 {0,1}，非 0 则跳）
 *    - `+2` 方向的 **level −= 4**
 *
 * ② **水崖**（原生 tile 56 = `cliffSet + 7`）
 *    - 需 `+3` 方向也是 56 **且** `+6` 方向通过 TerrainTest
 *    - **50% 概率跳过** ⇒ `+6` 方向的 **level −= 4**
 *
 * ③ **抬升崖**（原生 tile 224 = `cliffSet + 175` = 12×14+7）
 *    - 需 `+5` 与 `+1` 方向也都是 224 **且** 本格通过 TerrainTest
 *    - **不掷 RNG** ⇒ 本格 **level += 4**
 *
 * 三族做完后都把**源格的 `regionId`** 抄给**目标格**。
 *
 * ⚠ 三个关键点：
 *  ① **level 台阶是 ±4 不是 ±1**（原生 `*(_BYTE*)(cell+283) ±= 4`）——
 *     原生把「4 格」当一个 level 台阶。
 *  ② **131/56/224 是原生硬编码 tile 号**，但 56/224 是 `cliffSet` 的**族内偏移**
 *     （+7 / +175 = 12×14+7），换 theater 会变 ⇒ 本移植按
 *     `roughTile` / `cliffSet+7` / `cliffSet+175` 计算，保证跨 theater 可用。
 *  ③ ①② 有 50% 跳过，③ 不掷 RNG。
 */

import { DIRECTION_OFFSETS } from './cell';
import { cellAtD, coordOfCell, isClearTile } from './water';
import type { WaterContext } from './water';
import type { TheaterTables } from './theater';
import type { NativeCell } from './native';

/** 原生 `sub_481810(n)` 的方向序号（对照 `cell.DIRECTION_OFFSETS`） */
const DIR_1 = 1;
const DIR_2 = 2;
const DIR_3 = 3;
const DIR_5 = 5;
const DIR_6 = 6;

/** level 台阶：原生 `*(_BYTE*)(cell+283) ±= 4` */
const LEVEL_STEP = 4;

/** 悬崖族内偏移（原生硬编码 56 / 224 相对 `cliffSet` 的位置） */
const WATER_CLIFF_OFFSET = 7; // 56  = cliffSet + 7
const RISE_CLIFF_OFFSET = 175; // 224 = cliffSet + 175 = 12×14 + 7

/** 悬崖族长度（原生每段 14 块） */
const CLIFF_FAMILY_LEN = 14;
const CLIFF_FAMILIES = 16;

/** `sub_486380` TerrainTest：clear / 水 / 岸 / 崖 都算可生长 */
function terrainOk(cell: NativeCell | null, t: TheaterTables): boolean {
  if (!cell) return false;
  const v = cell.tile;
  if (isClearTile(cell)) return true;
  if (v >= t.waterSet && v < t.waterSet + 14) return true;
  if (v >= t.shorePieces && v < t.shorePieces + 42) return true;
  if (v >= t.cliffSet && v < t.cliffSet + CLIFF_FAMILIES * CLIFF_FAMILY_LEN) return true;
  return false;
}

/**
 * 掷硬币：返回 0 或 1（各 50%）。
 *
 * 原生：`do { v = trunc(rand × 2.328306437080797e-10 × 2^32); } while (v > 1);`
 * 即 `trunc(rand01 × 4294967296 × 2.328e-10)` = `trunc(rand01 × 2)`。
 */
function randCoin(ctx: WaterContext): number {
  for (let guard = 0; guard < 1000; guard++) {
    const v = Math.trunc(ctx.rng.next() * 2);
    if (v <= 1) return v;
  }
  return 0;
}

/**
 * 悬崖落差（`0x5A19E0`）。
 *
 * @param dryCliff 干悬崖 tile；缺省用 `theater.roughTile`
 *                （原生硬编码 131，恰等于典型 theater 的 roughTile）
 * @returns 实际调整过 level 的格数
 */
export function cliffDrops(ctx: WaterContext, dryCliff?: number): number {
  const { cells, scratch, theater } = ctx;
  const T_DRY = dryCliff ?? theater.roughTile;
  const T_WATER = theater.cliffSet + WATER_CLIFF_OFFSET;
  const T_RISE = theater.cliffSet + RISE_CLIFF_OFFSET;

  // 先把全图格与其坐标固化（原生是蛇形迭代器，这里等价的快照）
  const entries: Array<{ x: number; y: number; cell: NativeCell }> = [];
  for (const cell of cells.iterate()) {
    const [x, y] = coordOfCell(ctx, cell);
    entries.push({ x, y, cell });
  }

  let adjusted = 0;
  for (const { x, y, cell } of entries) {
    const t = cell.tile;
    let tx = -1;
    let ty = -1;
    let target: NativeCell | null = null;
    let delta = 0;

    if (t === T_DRY) {
      const o3 = DIRECTION_OFFSETS[DIR_3];
      const o2 = DIRECTION_OFFSETS[DIR_2];
      const n3 = cellAtD(ctx, x + o3[0], y + o3[1]);
      if (!n3 || n3.tile !== T_DRY) continue;
      target = cellAtD(ctx, x + o2[0], y + o2[1]);
      if (!terrainOk(target, theater)) continue;
      if (randCoin(ctx) !== 0) continue; // 50% 跳过
      tx = x + o2[0];
      ty = y + o2[1];
      delta = -LEVEL_STEP;
    } else if (t === T_WATER) {
      const o3 = DIRECTION_OFFSETS[DIR_3];
      const o6 = DIRECTION_OFFSETS[DIR_6];
      const n3 = cellAtD(ctx, x + o3[0], y + o3[1]);
      if (!n3 || n3.tile !== T_WATER) continue;
      target = cellAtD(ctx, x + o6[0], y + o6[1]);
      if (!terrainOk(target, theater)) continue;
      if (randCoin(ctx) !== 0) continue; // 50% 跳过
      tx = x + o6[0];
      ty = y + o6[1];
      delta = -LEVEL_STEP;
    } else if (t === T_RISE) {
      const o5 = DIRECTION_OFFSETS[DIR_5];
      const o1 = DIRECTION_OFFSETS[DIR_1];
      const n5 = cellAtD(ctx, x + o5[0], y + o5[1]);
      const n1 = cellAtD(ctx, x + o1[0], y + o1[1]);
      if (!n5 || n5.tile !== T_RISE) continue;
      if (!n1 || n1.tile !== T_RISE) continue;
      if (!terrainOk(cell, theater)) continue;
      target = cell;
      tx = x;
      ty = y;
      delta = +LEVEL_STEP; // ③ 不掷 RNG
    } else {
      continue;
    }

    if (!target) continue;
    target.level = (target.level + delta) & 0xff;
    adjusted += 1;
    // 源格 regionId 抄给目标格（原生 `v7[20*x+14+20*W*y] = v8`）
    scratch.at(tx, ty).regionId = scratch.at(x, y).regionId;
  }
  return adjusted;
}
