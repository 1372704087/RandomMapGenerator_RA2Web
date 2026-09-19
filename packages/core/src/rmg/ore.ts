/**
 * 矿场（原生阶段 15）
 *
 * 反编译：`re/decomp/5A23A0_Ore_Fields.c`（驱动）、`5A28C0_Ore_BfsPlacer.c`
 * （BFS 放置器）。裁决见 `re/specs/HILLS_LAT_ORE_TECH.md` §5。
 *
 * 驱动公式（RMGMD.INI 缺省 900/1050）：
 *   lerp = ftol(T%·0.01·(RMGMaximumTiberium − RMGMinimumTiberium) + RMGMinimumTiberium)
 *   regionTotal = ftol(lerp × max(配额, 0.5))
 *   perFieldBase = regionTotal IDIV 槽位数；槽位 = 最远点采样
 *   每槽 size = ftol(perFieldBase + G·50)，拒绝 ±100，负跳过
 *   第二遍：size = ftol((score−min)·15) + 500（每起点补偿场，无 gem 门）
 *
 * 放置器契约：
 *   - overlay：矿 102+frame / 宝石 27+frame，frame = ftol(draw·12K) 拒绝 >11（0..11）
 *   - 已有矿 → density++（上限 11）；TIBTRE01..03 地形物（每重播种代一枚，永非 00）
 *   - +0x45 起点保护圈格跳过放置（邻域仍扩张）；≤10 次重播种（同 origin，全图 +0x3C 清）
 *   - 邻域：clear 且(未认领 或 density<11 且含矿)，key = 锚距 + draw·5K（1 抽/邻）
 */

import { DIRECTION_OFFSETS } from './cell';
import { coordOfCell, isClearTile, WaterContext } from './water';
import { chopAdd, chopMul, chopSub, ftol, gamemdSqrt, nextUniformRange, RANGE_K } from './x87';
import { recalcCell } from './recalc';

/** RMGMD.INI 缺省（零售 900/1050；构造器缺省 2500/5500） */
export const RMG_MIN_TIBERIUM = 900;
export const RMG_MAX_TIBERIUM = 1050;

export const ORE_OVERLAY_BASE = 102;
export const GEM_OVERLAY_BASE = 27;

/** 矿/宝石格元数据（emit 侧转 OverlayPack + [OverlayData]） */
export interface OreCell {
  x: number;
  y: number;
  overlay: number;
  frame: number;
  density: number;
}

/** 驱动门（bVar12 switch）：第一遍是否放宝石 */
export function gemGateFirstPass(ctx: WaterContext): boolean {
  switch (ctx.mapType) {
    case 0:
      return ctx.resources === 3;
    case 1:
    case 3:
    case 4:
      return ctx.resources !== 3;
    case 2:
      return true;
    default:
      return false;
  }
}

/**
 * `0x5A28C0` BFS 放置器。返回放置格数。
 * 抽数：每次重播种 1（TIBTRE 变体，非宝石时）+ 每接受邻 1 + 有矿格 frame 1。
 */
export function oreBlob(
  ctx: WaterContext,
  originX: number,
  originY: number,
  size: number,
  fieldId: number,
  isGem: number,
  ores: OreCell[],
): number {
  const { cells, scratch, rng } = ctx;
  if (size <= 0) return 0;
  interface Node {
    x: number;
    y: number;
    key: number;
  }
  const cap = 10 * Math.max(size, 1);
  const heap: (Node | null)[] = [null];
  const push = (n: Node): void => {
    if (heap.length - 1 + 1 >= cap) return;
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

  const base = isGem !== 0 ? GEM_OVERLAY_BASE : ORE_OVERLAY_BASE;
  let placed = 0;
  let reseeds = 0;
  let cur: Node | null = null;
  let anchorX = originX;
  let anchorY = originY;

  while (placed < size && reseeds < 10) {
    if (cur === null) {
      // 重播种：清堆 + 全图 +0x3C 清 + origin 入堆
      for (const slot of ctx.scratch.slots) slot.patchId = 0;
      heap.length = 1;
      scratch.at(originX, originY).patchId = fieldId;
      push({ x: originX, y: originY, key: 0 });
      reseeds++;
      // TIBTRE 锚点（非宝石；每播种代一枚）
      if (isGem === 0) {
        let v = 0;
        do {
          v = ftol(chopAdd(chopMul(rng.next(), 3 * RANGE_K), 1.0));
        } while (v > 3);
        ctx.terrainObjects.push({ name: `TIBTRE0${v % 10}`, xd: originX, yd: originY });
      }
      cur = pop();
      continue;
    }
    // 弹出格处理（+0x45 保护圈跳过放置）
    if (scratch.at(cur.x, cur.y).waterLock === 0) {
      anchorX = cur.x;
      anchorY = cur.y;
      const cell = cells.cellAt(cur.x, cur.y);
      if (cell.overlay === -1) {
        let frame = 0;
        do {
          frame = ftol(chopMul(rng.next(), 12 * RANGE_K));
        } while (frame > 0xb);
        cell.overlay = base + frame;
        cell.density = 0;
        ores.push({ x: cur.x, y: cur.y, overlay: cell.overlay, frame, density: 0 });
        placed++;
      } else if (cell.density < 0xb) {
        cell.density++;
        placed++;
      }
    }
    // 邻域扩张
    for (let d = 0; d < 8; d++) {
      const off = DIRECTION_OFFSETS[d];
      const nx = cur.x + off[0];
      const ny = cur.y + off[1];
      if (!cells.inDiamondBounds(nx, ny)) continue;
      const nb = cells.cellAt(nx, ny);
      if (!isClearTile(nb)) continue;
      const nslot = scratch.at(nx, ny);
      // 原生推送门：无 overlay 时仅「未被本 field 认领」的格推送
      // （本 field 已认领但未矿的格 GetTiberiumType == -1 → 不重推，
  //   否则保护圈两格互相弹推 → 死循环）；有 overlay 时须本 field + density < 11
      if (nb.overlay === -1) {
        if (nslot.patchId === fieldId) continue;
      } else if (nslot.patchId !== fieldId || nb.density >= 0xb) {
        continue;
      }
      const dx = anchorX - nx;
      const dy = anchorY - ny;
      const dist = gamemdSqrt(chopAdd(chopMul(dx, dx), chopMul(dy, dy)));
      const key = chopAdd(dist, chopMul(chopMul(rng.next(), 5.0), RANGE_K));
      nslot.patchId = fieldId;
      push({ x: nx, y: ny, key });
    }
    cur = pop();
  }
  return placed;
}

/** 最远点采样槽位（与 594F40 同法的简化：pool 上取相互距离最大的一组） */
function pickSlots(
  candidates: number[],
  target: number,
): [number, number][] {
  if (candidates.length === 0 || target <= 0) return [];
  const dist = (a: number, b: number): number => {
    const dx = (a & 0xffff) - (b & 0xffff);
    const dy = (a >>> 16) - (b >>> 16);
    return gamemdSqrt(chopAdd(chopMul(dx, dx), chopMul(dy, dy)));
  };
  const out = [candidates[0]];
  const used = new Set<number>([0]);
  while (out.length < target && used.size < candidates.length) {
    let pick = -1;
    let pickMin = -1;
    for (let c = 0; c < candidates.length; c++) {
      if (used.has(c)) continue;
      let mn = Infinity;
      for (const s of out) mn = Math.min(mn, dist(candidates[c], s));
      if (mn > pickMin) {
        pickMin = mn;
        pick = c;
      }
    }
    if (pick < 0) break;
    out.push(candidates[pick]);
    used.add(pick);
  }
  return out.map((p) => [p & 0xffff, p >>> 16]);
}

/** `0x5A23A0` 矿场驱动 */
export function oreFields(ctx: WaterContext, regions: { cells: number[]; quota: number; id: number }[]): OreCell[] {
  const { rng } = ctx;
  const ores: OreCell[] = [];
  const isGem = gemGateFirstPass(ctx) ? 1 : 0;
  const lerp = ftol(
    chopAdd(
      chopMul(ctx.tiberiumPercent * 0.01, RMG_MAX_TIBERIUM - RMG_MIN_TIBERIUM),
      RMG_MIN_TIBERIUM,
    ),
  );
  let fieldId = 1;
  let globalStartBase = 0;
  // 每区起点坐标（quota 个 waypoint 中落在该区的）
  const startCoordsByRegion = regionStartCoords(ctx, regions);

  for (const region of regions) {
    if (region.cells.length === 0) continue;
    const starts = startCoordsByRegion.get(region.id) ?? [];
    const mult = Math.max(region.quota, 0.5);
    const regionTotal = ftol(lerp * mult);
    const slotTarget = ftol(
      chopAdd(chopDiv12(ctx.tiberiumLayout, ctx.numPlayers), 2.0) * starts.length,
    );
    // 槽位 = 区内格子的最远点采样（原生用候选向量 + 594F40 同法）
    const slots = pickSlots(region.cells, slotTarget);
    if (slots.length === 0 || regionTotal === 0) {
      globalStartBase += starts.length;
      continue;
    }
    const perFieldBase = Math.trunc(regionTotal / slots.length);
    // 宝石锚点：区内离参考点（起点均值或随机格）最近的槽
    let gemSlot = -1;
    if (isGem !== 0) {
      let refX: number;
      let refY: number;
      if (starts.length === 0) {
        const pick = nextUniformRange(rng.next(), 0, region.cells.length - 1);
        const p = region.cells[Math.min(pick, region.cells.length - 1)];
        refX = p & 0xffff;
        refY = p >>> 16;
      } else {
        refX = 0;
        refY = 0;
        for (const [sx, sy] of starts) {
          refX += sx;
          refY += sy;
        }
        refX = Math.trunc(refX / starts.length);
        refY = Math.trunc(refY / starts.length);
      }
      let best = 500000;
      for (let i = 0; i < slots.length; i++) {
        const d = Math.abs(slots[i][0] - refX) + Math.abs(slots[i][1] - refY);
        if (d < best) {
          best = d;
          gemSlot = i;
        }
      }
    }
    // 每槽抖动 + 派发
    for (let i = 0; i < slots.length; i++) {
      let jitter = 0;
      do {
        jitter = chopMul(ctx.gaussian.next(rng), 50.0);
      } while (jitter < -100 || jitter > 100);
      const size = ftol(perFieldBase + jitter);
      if (size >= 0) {
        oreBlob(ctx, slots[i][0], slots[i][1], size, fieldId + i, i === gemSlot ? 1 : 0, ores);
      }
    }
    fieldId += slots.length;
    // 第二遍：每起点补偿场
    const gem2 = ctx.resources === 3 && [1, 3, 4].includes(ctx.mapType) ? 1 : 0;
    if (starts.length > 0) {
      const scores = starts.map(([sx, sy]) => {
        let sum = 0;
        for (const [tx, ty] of slots) {
          const dx = sx - tx;
          const dy = sy - ty;
          sum += gamemdSqrt(chopAdd(chopMul(dx, dx), chopMul(dy, dy)));
        }
        return sum / slots.length;
      });
      const minScore = Math.min(...scores, 9999999);
      for (let s = 0; s < starts.length; s++) {
        const size = ftol((scores[s] - minScore) * 15.0) + 500;
        oreBlob(ctx, starts[s][0], starts[s][1], size, fieldId + s, gem2, ores);
      }
    }
    fieldId += starts.length;
    globalStartBase += starts.length;
  }
  void globalStartBase;
  // 矿格重算（原生 recalc(cell, -1) 由放置器隐含；这里集中跑 overlay 分支）
  for (const o of ores) {
    recalcCell(ctx, o.x, o.y, -1);
  }
  return ores;
}

function chopDiv12(layout: number, players: number): number {
  // (TiberiumLayout·0.01·12)/NumPlayers —— x87 截断除
  const a = chopMul(chopMul(layout, 0.01), 12);
  return players > 0 ? a / players : 0;
}

/** 区 → 其起点坐标（由 waypoints 与起点的区归属推得） */
function regionStartCoords(
  ctx: WaterContext,
  regions: { cells: number[]; id: number }[],
): Map<number, [number, number][]> {
  const map = new Map<number, [number, number][]>();
  for (const r of regions) map.set(r.id, []);
  const cellRegion = new Map<string, number>();
  for (const r of regions) {
    for (const packed of r.cells) {
      cellRegion.set(`${packed & 0xffff},${packed >>> 16}`, r.id);
    }
  }
  for (const w of ctx.starts.waypoints) {
    if (!w) continue;
    const rid = cellRegion.get(`${w[0]},${w[1]}`);
    if (rid !== undefined) {
      map.get(rid)?.push([w[0], w[1]]);
    }
  }
  return map;
}

// ctx.tiberiumPercent / ctx.resources / ctx.starts 挂载提示：
// WaterContext 扩展见 water.ts；oreFields 由 pipeline 传入。
