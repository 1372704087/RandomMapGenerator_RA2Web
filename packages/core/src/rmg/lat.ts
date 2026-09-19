/**
 * LAT / 树 / 石（原生阶段 17）
 *
 * 反编译：`re/decomp/5A38C0`（概率）、`5A3AE0`（温带贴片+树+岩）、
 * `5A4280`（非温带）、`5A45E0`（树种树）、`5A4B60`（贴片团块）。
 *
 * 驱动（0x598960 @ 0x59921F）：
 *   Theater==0（温带）: 5A38C0 → 5A3AE0
 *   否则: 全图 latSand=0.005、latGreen=0.001 → 5A4280（无岩石）
 *
 * 抽数契约：
 *   5A3AE0 三个均值各 1 抽（拒绝 >40）；每合格格 1..3 抽（rough 命中 1 /
 *   sand 2 / green 3 / 全不中 3）；每贴片团块每接受邻 1 抽；
 *   树循环每轮槽链（598030 + (0,0) 拒绝 ≤200）+ 2 高斯 + 5A45E0 内部；
 *   岩石 target 1 抽 + 每 attempt 槽链 + 命中变体 1 抽。
 */

import { DIRECTION_OFFSETS } from './cell';
import { coordOfCell, isClearTile, isGreenTile, WaterContext } from './water';
import { chopAdd, chopMul, ftol, gamemdSqrt, nextUniformRange, RANGE_K } from './x87';
import { latRepair, recalcCell } from './recalc';

/** 地形物件（树）—— emit 侧转 [Terrain] 节（菱形坐标存此处，写出时转 map 坐标） */
export interface TerrainEntry {
  name: string;
  xd: number;
  yd: number;
}

// ─── 5A38C0 温带概率（零 RNG）

export function latProbsTemperate(ctx: WaterContext): void {
  const { cells, scratch, theater } = ctx;
  const veg = ctx.vegetation;
  for (const cell of cells.iterate()) {
    const [x, y] = coordOfCell(ctx, cell);
    if (cell.tile >= theater.shorePieces && cell.tile < theater.shorePieces + 42) {
      // 岸格：5×5 邻任一在域内 → 写自身概率
      let any = false;
      for (let dy = -2; dy <= 2 && !any; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (cells.inDiamondBounds(x + dx, y + dy)) {
            any = true;
            break;
          }
        }
      }
      if (any) {
        const s = scratch.at(x, y);
        s.latSand = 0.005;
        s.latGreen = 0.0;
        s.latRough = 0.02 * veg * 10.0 * 0.01; // 0.2·Veg%（Veg 为小数）
      }
    } else if (scratch.at(x, y).latSand === 0) {
      const s = scratch.at(x, y);
      s.latSand = 0.005;
      s.latGreen = 0.005;
      s.latRough = 0.02 * veg * 0.01; // 0.0002·Veg%
    }
  }
}

// ─── 5A4B60 贴片团块

/** 团块生长：锚定原点的最小堆，每接受邻 1 抽；写 tile 基址；返回涂格数 */
export function patchBlob(
  ctx: WaterContext,
  originX: number,
  originY: number,
  tileBase: number,
  size: number,
  patchId: number,
  allowExtra: number,
): number {
  const { cells, scratch, rng } = ctx;
  if (size <= 0) return 0;
  interface Node {
    x: number;
    y: number;
    key: number;
  }
  const heap: (Node | null)[] = [null];
  const push = (n: Node): void => {
    heap.push(n);
    let i = heap.length - 1;
    while (i > 1) {
      const p = i >> 1;
      if ((heap[p] as Node).key <= n.key) break;
      heap[i] = heap[p];
      heap[p] = n;
      i = p;
    }
  };
  const pop = (): Node | null => {
    if (heap.length === 1) return null;
    const top = heap[1];
    const last = heap.pop() as Node;
    if (heap.length > 1) {
      heap[1] = last;
      let i = 1;
      for (;;) {
        const l = i * 2;
        const r = l + 1;
        let m = i;
        if (l < heap.length && (heap[l] as Node).key < (heap[m] as Node).key) m = l;
        if (r < heap.length && (heap[r] as Node).key < (heap[m] as Node).key) m = r;
        if (m === i) break;
        const t = heap[i];
        heap[i] = heap[m];
        heap[m] = t;
        i = m;
      }
    }
    return top;
  };

  scratch.at(originX, originY).patchId = patchId;
  push({ x: originX, y: originY, key: 0 });
  let painted = 0;
  let cur = pop();
  while (cur !== null && painted < size) {
    const cell = cells.cellAt(cur.x, cur.y);
    cell.tile = tileBase;
    painted++;
    for (let d = 0; d < 8; d++) {
      const off = DIRECTION_OFFSETS[d];
      const nx = cur.x + off[0];
      const ny = cur.y + off[1];
      if (!cells.inDiamondBounds(nx, ny)) continue;
      const nb = cells.slotAt(nx, ny);
      if (nb === null) continue;
      const extraOk =
        allowExtra !== 0 && (isRoughExtra(nb, ctx) || isPaveExtra(nb, ctx));
      if (!isClearTile(nb) && !extraOk) continue;
      const s = scratch.at(nx, ny);
      if (s.patchId === patchId) continue;
      if (nb.slope !== 0 || nb.overlay !== -1 || nb.occupied !== 0) continue;
      const dx = originX - nx;
      const dy = originY - ny;
      const dist = gamemdSqrt(chopAdd(chopMul(dx, dx), chopMul(dy, dy)));
      const key = chopAdd(dist, chopMul(chopMul(rng.next(), 5.0), RANGE_K));
      s.patchId = patchId;
      push({ x: nx, y: ny, key });
    }
    cur = pop();
  }
  return painted;
}

function isRoughExtra(_cell: unknown, _ctx: WaterContext): boolean {
  return false; // 486670/486650 族测试；贴片 a5 恒 0，死路径占位
}
function isPaveExtra(_cell: unknown, _ctx: WaterContext): boolean {
  return false;
}

// ─── 5A45E0 树种树

/**
 * 从 origin 团块种树。返回实际棵数；记录进 ctx.terrainObjects。
 * 抽数：每合格弹出 1（密度）+ 命中 1（树名）+ 每入堆邻 1。
 */
export function treesPlant(
  ctx: WaterContext,
  originX: number,
  originY: number,
  size: number,
  density: number,
): number {
  const { cells, scratch, rng } = ctx;
  interface Node {
    x: number;
    y: number;
    key: number;
  }
  const heap: (Node | null)[] = [null];
  const push = (n: Node): void => {
    if (heap.length - 1 + 1 >= 25 * size + 1) return; // 满静默丢弃
    heap.push(n);
    let i = heap.length - 1;
    while (i > 1) {
      const p = i >> 1;
      if ((heap[p] as Node).key <= n.key) break;
      heap[i] = heap[p];
      heap[p] = n;
      i = p;
    }
  };
  const pop = (): Node | null => {
    if (heap.length === 1) return null;
    const top = heap[1];
    const last = heap.pop() as Node;
    if (heap.length > 1) {
      heap[1] = last;
      let i = 1;
      for (;;) {
        const l = i * 2;
        const r = l + 1;
        let m = i;
        if (l < heap.length && (heap[l] as Node).key < (heap[m] as Node).key) m = l;
        if (r < heap.length && (heap[r] as Node).key < (heap[m] as Node).key) m = r;
        if (m === i) break;
        const t = heap[i];
        heap[i] = heap[m];
        heap[m] = t;
        i = m;
      }
    }
    return top;
  };

  scratch.at(originX, originY).treeVisited = 1;
  push({ x: originX, y: originY, key: 0 });
  let placed = 0;
  for (;;) {
    const node = pop();
    if (node === null || placed >= size) break;
    const cell = cells.cellAt(node.x, node.y);
    if (
      !isClearTile(cell) ||
      cell.occupied !== 0 ||
      cell.overlay !== -1 ||
      cell.landType === 3
    ) {
      // 门不过仍继续扩展邻域（原生：扩展在放置门之后、 regardless）
    } else if (chopMul(rng.next(), RANGE_K) < density) {
      // 树名：ftol(r·25K + 1.0)，拒绝 >25（死臂）→ TREE01..25
      let v = 0;
      do {
        v = ftol(chopAdd(chopMul(rng.next(), 25 * RANGE_K), 1.0));
      } while (v > 25);
      const name = `TREE${Math.floor(v / 10)}${v % 10}`;
      ctx.terrainObjects.push({ name, xd: node.x, yd: node.y });
      placed++;
      if (placed >= size) break;
    }
    // 邻域扩展（锚定 origin 距离 + 1 抽）
    for (let d = 0; d < 8; d++) {
      const off = DIRECTION_OFFSETS[d];
      const nx = node.x + off[0];
      const ny = node.y + off[1];
      if (!cells.inDiamondBounds(nx, ny)) continue;
      const s = scratch.at(nx, ny);
      if (s.treeVisited !== 0 || s.waterLock !== 0) continue;
      s.treeVisited = 1;
      const dx = originX - nx;
      const dy = originY - ny;
      const dist = gamemdSqrt(chopAdd(chopMul(dx, dx), chopMul(dy, dy)));
      const key = chopAdd(dist, chopMul(chopMul(rng.next(), 5.0), RANGE_K));
      push({ x: nx, y: ny, key });
    }
  }
  return placed;
}

// ─── 树计数 + 槽链（5A3AE0/5A4280 共用）

function pickSlotCoord(ctx: WaterContext): [number, number] | null {
  const { cells, rng, scratch } = ctx;
  const W2 = scratch.size * scratch.size;
  for (let attempt = 0; attempt < 200; attempt++) {
    const slot = nextUniformRange(rng.next(), 0, W2 - 1);
    const s = scratch.slots[Math.min(slot, W2 - 1)];
    const coord = s.coord;
    if (coord === 0) continue; // (0,0) 拒绝
    const [x, y] = [coord & 0xffff, coord >>> 16];
    const cell = cells.slotAt(x, y);
    if (cell !== null && isClearTile(cell)) return [x, y];
  }
  return null; // 耗尽 → 回退坐标 0（原生仍走后续抽取并调 5A45E0）
}

function treeCount(ctx: WaterContext): number {
  const { theater: _t } = ctx;
  return ftol(
    chopMul(
      chopMul(
        chopAdd(chopMul(ctx.widthLevel, 0.1), 0.7),
        chopMul(ctx.vegetation, 0.01),
      ),
      ctx.maxTrees,
    ),
  );
}

/** 树循环（5A3AE0 第 5 步 / 5A4280 第 4 步，逐字节同公式） */
function placeTrees(ctx: WaterContext): void {
  const { rng } = ctx;
  let count = treeCount(ctx);
  for (let iter = 0; iter < 100 && count > 0; iter++) {
    const picked = pickSlotCoord(ctx);
    const [sx, sy] = picked ?? [0, 0];
    // 密度：G·0.1+0.2 拒绝 [0.05, 0.4]
    let density: number;
    do {
      density = chopAdd(chopMul(ctx.gaussian.next(rng), 0.1), 0.2);
    } while (density < 0.05 || density > 0.4);
    // 尺寸：ftol(G·10+25) 拒绝 [10,35]
    let size: number;
    do {
      size = ftol(chopAdd(chopMul(ctx.gaussian.next(rng), 10.0), 25.0));
    } while (size < 10 || size > 35);
    const placed = treesPlant(ctx, sx, sy, size, density);
    count -= placed;
  }
}

// ─── 岩石（仅温带）

function placeRocks(ctx: WaterContext): void {
  const { cells, rng, theater, scratch } = ctx;
  const area = 2 * cells.mapW * (cells.mapH + 4);
  const limit = Math.trunc(area / 200);
  // target = U[0, limit]
  let target = 0;
  do {
    target = ftol(chopMul(rng.next(), (limit + 1) * RANGE_K));
  } while (target > limit);
  const attempts = 5 * target;
  let placed = 0;
  for (let attempt = 0; attempt < attempts && placed < target; attempt++) {
    const picked = pickSlotCoord(ctx);
    const [sx, sy] = picked ?? [0, 0];
    const cell = cells.cellAt(sx, sy);
    if (cell.overlay !== -1) continue;
    // 沙 LAT → SROCK01-05（168+v）；clear/绿 → TROCK01-05（173+v）
    const isSand =
      cell.tile >= theater.clearToSandLat && cell.tile < theater.clearToSandLat + 16;
    let v = 0;
    do {
      v = ftol(chopMul(rng.next(), 5 * RANGE_K));
    } while (v > 4);
    if (isSand) {
      cell.overlay = 168 + v;
    } else if (isClearTile(cell) || isGreenTile(cell, theater)) {
      cell.overlay = 173 + v;
    }
    cell.density = 0;
    const [x, y] = [sx, sy];
    recalcCell(ctx, x, y, -1);
    placed++;
  }
}

// ─── 阶段入口

/** 温带：5A38C0 → 5A3AE0 */
export function latStageTemperate(ctx: WaterContext): void {
  const { rng, cells, scratch, theater } = ctx;
  latProbsTemperate(ctx);
  // 全图 +0x3C = 0
  for (const slot of scratch.slots) slot.patchId = 0;
  // 三个均值 [20,40]
  const means: number[] = [];
  for (let i = 0; i < 3; i++) {
    let mean = 0;
    do {
      // 21/2³² = 4.889443517869674e-9（K×21）
      mean = ftol(chopAdd(chopMul(rng.next(), 4.889443517869674e-9), 20.0));
    } while (mean > 0x28);
    means.push(mean);
  }
  // 每格三连抽
  let patchCounter = 1;
  for (const cell of cells.iterate()) {
    const [x, y] = coordOfCell(ctx, cell);
    const s = scratch.at(x, y);
    if (
      !isClearTile(cell) ||
      cell.slope !== 0 ||
      cell.overlay !== -1 ||
      cell.occupied !== 0 ||
      s.waterLock !== 0
    ) {
      continue;
    }
    const r1 = chopMul(rng.next(), RANGE_K);
    if (r1 < s.latRough) {
      const size = rejectPatchSize(ctx, means[0], 20.0, 4, 80);
      patchBlob(ctx, x, y, theater.roughTile, size, patchCounter++, 0);
      continue;
    }
    const r2 = chopMul(rng.next(), RANGE_K);
    if (r2 < s.latSand) {
      const size = rejectPatchSize(ctx, means[1], 20.0, 4, 80);
      patchBlob(ctx, x, y, theater.sandTile, size, patchCounter++, 0);
      continue;
    }
    const r3 = chopMul(rng.next(), RANGE_K);
    if (r3 < s.latGreen) {
      const size = rejectPatchSize(ctx, means[2], 20.0, 4, 80);
      patchBlob(ctx, x, y, theater.greenTile, size, patchCounter++, 0);
    }
  }
  // LAT 接驳（原生全图 47CA80 —— recalc 内已含；此处独立跑一遍与原生序一致）
  for (const cell of cells.iterate()) {
    const [x, y] = coordOfCell(ctx, cell);
    latRepair(ctx, x, y);
  }
  placeTrees(ctx);
  placeRocks(ctx);
}

function rejectPatchSize(
  ctx: WaterContext,
  mean: number,
  scale: number,
  lo: number,
  hi: number,
): number {
  let size = 0;
  do {
    size = ftol(chopAdd(chopMul(ctx.gaussian.next(ctx.rng), scale), mean));
  } while (size < lo || size > hi);
  return size;
}

/** 非温带：全图概率 0.005/0.001 → 5A4280（无岩石） */
export function latStageNonTemperate(ctx: WaterContext): void {
  const { rng, cells, scratch, theater } = ctx;
  for (const slot of scratch.slots) {
    slot.latSand = 0.005;
    slot.latGreen = 0.001;
    slot.patchId = 0;
  }
  let patchCounter = 1;
  for (const cell of cells.iterate()) {
    const [x, y] = coordOfCell(ctx, cell);
    const s = scratch.at(x, y);
    if (!isClearTile(cell) || cell.slope !== 0 || s.waterLock !== 0) continue;
    if (chopMul(rng.next(), RANGE_K) < s.latSand) {
      const size = rejectPatchSize(ctx, 20.0, 15.0, 4, 60);
      patchBlob(ctx, x, y, theater.roughTile, size, patchCounter++, 0);
    }
  }
  for (const cell of cells.iterate()) {
    const [x, y] = coordOfCell(ctx, cell);
    latRepair(ctx, x, y);
  }
  placeTrees(ctx);
}

/** 阶段 17 驱动（0x598960 @ 0x59921F 的分支） */
export function latStage(ctx: WaterContext): void {
  if (ctx.theaterIndex === 0) latStageTemperate(ctx);
  else latStageNonTemperate(ctx);
}
