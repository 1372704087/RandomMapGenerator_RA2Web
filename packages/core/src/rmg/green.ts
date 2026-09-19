/**
 * 绿地扩散（原生阶段 11，`0x0059B740`）
 *
 * 收集绿格（绿基址 + 16 格 LAT 族，`0x004867B0`）的 clear 四正交邻 → 向量；
 * `count = min(len/3, 1000)`；每轮 1 抽选格（`ftol(draw·len·K)`，拒绝死臂）、
 * **左移删除**（非 swap）、染绿、其 clear 四邻入队。
 * 入口 `sub_5AD820(0,0)` 已核实为向量构造器（无逻辑）。
 */

import { DIRECTION_OFFSETS } from './cell';
import { ftol, chopMul, RANGE_K } from './x87';
import { isClearTile, isGreenTile, WaterContext } from './water';

export function greenSpread(ctx: WaterContext): void {
  const { cells, rng, theater } = ctx;
  const K = RANGE_K;
  interface Entry {
    cell: import('./native').NativeCell;
    x: number;
    y: number;
  }
  const frontier: Entry[] = [];

  for (const cell of cells.iterate()) {
    if (!isGreenTile(cell, theater)) continue;
    const [x, y] = ctxCoord(ctx, cell);
    for (let d = 0; d < 8; d += 2) {
      const off = DIRECTION_OFFSETS[d];
      const nx = x + off[0];
      const ny = y + off[1];
      const nb = cells.slotAt(nx, ny);
      if (nb !== null && isClearTile(nb)) {
        frontier.push({ cell: nb, x: nx, y: ny });
      }
    }
  }

  let count = Math.trunc(frontier.length / 3);
  if (count > 1000) count = 1000;

  for (let k = 0; k < count; k++) {
    const len = frontier.length;
    let pick = 0;
    do {
      pick = ftol(chopMul(chopMul(rng.next(), len), K));
    } while (pick > len - 1);
    const entry = frontier[pick];
    frontier.splice(pick, 1); // 左移删除（原生 shift-down）
    entry.cell.tile = theater.greenTile;
    for (let d = 0; d < 8; d += 2) {
      const off = DIRECTION_OFFSETS[d];
      const nx = entry.x + off[0];
      const ny = entry.y + off[1];
      const nb = cells.slotAt(nx, ny);
      if (nb !== null && isClearTile(nb)) {
        frontier.push({ cell: nb, x: nx, y: ny });
      }
    }
  }
}

/** cell → 菱形坐标（迭代序反查；与 water.ts 的缓存表同一张） */
import { coordOfCell } from './water';
function ctxCoord(ctx: WaterContext, cell: import('./native').NativeCell): [number, number] {
  return coordOfCell(ctx, cell);
}
