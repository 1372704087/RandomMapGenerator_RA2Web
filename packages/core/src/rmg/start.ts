/**
 * 起始点（原生阶段 13）
 *
 * 反编译：`594B50`（候选）、`594420`（洪水建区）、`594870`（逐区写路径点）、
 * `594F40`（最远优先选择器）、`5A1FB0`（起点保护洪泛）、`578640`（6×6 检查）、
 * `5A7250`（放置门）。裁决见 `re/specs/REGIONS_START_POINTS.md`。
 *
 * 契约要点：
 *   - 阈值 = ftol(max(genW·genH·0.03, 400))；N = 删除前区域数；
 *   - 打分 key = regionId + N·(500000 − CellCount)，升序（id 作平局断据）；
 *   - 配额 q = 末桶取余数，否则 ftol(cum/total·quota + 0.5 − assigned)；
 *   - 594870：候选目标 = U{0,1,2} + 15·配额（≤300 次尝试）；6×6 矩形门；
 *   - 594F40：目标 = ftol((TiberiumLayout·0.01·12/4 + 2)·配额)；两趟
 *     （对最大距 + 跨区奖 20，随后 max-min 贪心）；空候选 + 配额>0 → 非空空向量；
 *   - MapType==0：每个零配额桶 1 抽（<0.5 → 每区一座科技楼；阶段 14 待接，
 *     抽取照消耗）。
 */

import { DIRECTION_OFFSETS } from './cell';
import { coordOfCell, WaterContext } from './water';
import { RegionState, regionCtor, regionResetAll } from './regions';
import {
  buildZoneState,
  getZoneId,
  zoneKindForMapType,
  ZoneState,
} from './zones';
import { chopAdd, chopDiv, chopMul, chopSub, ftol, gamemdSqrt, RANGE_K } from './x87';
import { computeCellClass, applyCellClasses } from './zones';

/** 起点状态（emit 侧转 [Waypoints]） */
export interface StartState {
  /** 槽位 → 菱形坐标 */
  waypoints: ([number, number] | null)[];
}

// ─── 578640 6×6 矩形检查

export function rect6x6Check(
  ctx: WaterContext,
  rect: [number, number, number, number],
  x: number,
  y: number,
): boolean {
  const W = ctx.cells.mapW;
  // a4 = 1：锚格等级修正
  const cell = ctx.cells.cellAt(x, y);
  let base = cell.level;
  if (cell.slope !== 0 && x + y < base + W + 2 * rect[1] + 4) base += 1;
  return (
    y + x > base + W + 2 * rect[1] &&
    y + x <= base + W + 2 * (rect[1] + rect[3]) + 2 &&
    x - y < 2 * (rect[0] + rect[2]) - W &&
    y - x < W - 2 * rect[0]
  );
}

// ─── 5A7250 放置门（a2 = a3 = 0）

export function placeabilityGate(ctx: WaterContext, rect: [number, number, number, number]): boolean {
  const { cells } = ctx;
  const corners: [number, number][] = [
    [rect[0], rect[1]],
    [rect[0] + rect[2] - 1, rect[1]],
    [rect[0], rect[1] + rect[3] - 1],
    [rect[0] + rect[2] - 1, rect[1] + rect[3] - 1],
  ];
  for (const [cx, cy] of corners) {
    if (!cells.inDiamondBounds(cx, cy)) return false;
  }
  for (let cy = rect[1]; cy < rect[1] + rect[3]; cy++) {
    for (let cx = rect[0]; cx < rect[0] + rect[2]; cx++) {
      const cell = cells.cellAt(cx, cy);
      // 4866D0（paved 族）/4866F0（桥端族）门：a2=a3=0 → 命中即失败；
      // 其余必须 clear（486650/486670 族测试未反编译，保守按不允许）
      if (!cells.inDiamondBounds(cx, cy)) return false;
      if (!isCellClearForStart(ctx, cell.tile)) return false;
    }
  }
  return true;
}

function isCellClearForStart(ctx: WaterContext, tile: number): boolean {
  if (tile === 0 || tile === 0xffff) return true;
  const t = ctx.theater;
  // 486650/486670 未解码 —— LAT 族按允许近似（贴片后的陆地仍是合法落点）
  return (
    (tile >= t.clearToRoughLat && tile < t.clearToRoughLat + 16) ||
    (tile >= t.clearToSandLat && tile < t.clearToSandLat + 16) ||
    (tile >= t.clearToGreenLat && tile < t.clearToGreenLat + 16) ||
    tile === t.roughTile ||
    tile === t.sandTile ||
    tile === t.greenTile
  );
}

// ─── 594420 起点洪水建区

export function startFloodRegion(
  ctx: WaterContext,
  rs: RegionState,
  zs: ZoneState,
  x: number,
  y: number,
  kind: number,
  ref: number,
): void {
  const { cells, scratch } = ctx;
  const region = regionCtor(ctx, rs, ((y & 0xffff) << 16) | (x & 0xffff));
  region.level = cells.cellAt(x, y).level;
  region.water = 0;
  const stack: number[] = [((y & 0xffff) << 16) | (x & 0xffff)];
  while (stack.length > 0) {
    const packed = stack.pop() as number;
    const cx = packed & 0xffff;
    const cy = packed >>> 16;
    scratch.at(cx, cy).regionId = region.id;
    region.cellCount++;
    region.cells.push(packed);
    for (let d = 0; d < 8; d++) {
      const off = DIRECTION_OFFSETS[d];
      const nx = cx + off[0];
      const ny = cy + off[1];
      if (!cells.inDiamondBounds(nx, ny)) continue;
      const ncell = cells.cellAt(nx, ny);
      const nslot = scratch.at(nx, ny);
      if (
        ncell.passability === 0 &&
        getZoneId(ctx, nx, ny, kind, zs) === ref &&
        nslot.patchId === -1
      ) {
        nslot.patchId = region.id;
        stack.push(((ny & 0xffff) << 16) | (nx & 0xffff));
      }
    }
  }
}

// ─── 594F40 最远优先选择器

interface SelectorResult {
  selected: number[]; // 打包坐标
  remaining: number[]; // 未用候选（跨区复用）
}

export function farthestSelector(
  ctx: WaterContext,
  regionQuota: number,
  candidates: number[],
  tiberiumLayout: number,
  stamps: Map<number, number>, // coord → 起点区 id（跨区奖判定）
): SelectorResult | null {
  const quota = regionQuota;
  const count = candidates.length;
  let target = ftol(
    chopMul(chopAdd(chopDiv(chopMul(chopMul(tiberiumLayout, 0.01), 12.0), 4), 2.0), quota),
  );
  if (quota === 0 && count > 0) target = count;
  if (target > count || target === 0) {
    if (quota === 0) return null;
    target = count;
  }
  const out: number[] = [];
  if (count === 0) return { selected: out, remaining: [] };
  if (count === 1) {
    return { selected: [candidates[0]], remaining: [] };
  }
  // 第一趟：所有 i<j 对的最大距离（跨区 +20），严格 > 首见胜
  const dist = (a: number, b: number): number => {
    const dx = (a & 0xffff) - (b & 0xffff);
    const dy = (a >>> 16) - (b >>> 16);
    return gamemdSqrt(chopAdd(chopMul(dx, dx), chopMul(dy, dy)));
  };
  let bestI = -1;
  let bestD = -1;
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const bonus = stamps.get(candidates[i]) !== stamps.get(candidates[j]) ? 20 : 0;
      const d = dist(candidates[i], candidates[j]) + bonus;
      if (d > bestD) {
        bestD = d;
        bestI = i;
      }
    }
  }
  const used = new Set<number>();
  if (bestI >= 0) {
    out.push(candidates[bestI]);
    used.add(bestI);
  }
  // 第二趟：max-min 贪心
  while (out.length < target) {
    let pick = -1;
    let pickMin = -1;
    for (let c = 0; c < count; c++) {
      if (used.has(c)) continue;
      let mn = 9999999;
      for (const s of out) {
        const bonus = stamps.get(candidates[c]) !== stamps.get(s) ? 20 : 0;
        const d = dist(candidates[c], s) + bonus;
        if (d < mn) mn = d;
      }
      if (mn > pickMin) {
        pickMin = mn;
        pick = c;
      }
    }
    if (pick < 0) break;
    out.push(candidates[pick]);
    used.add(pick);
  }
  return { selected: out, remaining: candidates.filter((_, i) => !used.has(i)) };
}

// ─── 594870 逐区写路径点

function startWritePerRegion(
  ctx: WaterContext,
  st: StartState,
  region: { quota: number; cells: number[]; id: number },
  slotBase: number,
  tiberiumLayout: number,
  stamps: Map<number, number>,
): void {
  const { cells, rng } = ctx;
  const rect: [number, number, number, number] = [4, 4, ctx.cells.mapW - 8, ctx.cells.mapH - 8];
  // U{0,1,2}
  let roll = 0;
  do {
    roll = ftol(chopMul(rng.next(), 3 * RANGE_K));
  } while (roll > 2);
  const target = roll + 15 * region.quota;
  const candidates: number[] = [];
  for (let iter = 0; iter < 300 && candidates.length < target; iter++) {
    const n = region.cells.length;
    if (n === 0) break;
    let pick = 0;
    do {
      pick = ftol(chopMul(rng.next(), n * RANGE_K));
    } while (pick > n - 1);
    const packed = region.cells[Math.min(pick, n - 1)];
    const x = packed & 0xffff;
    const y = packed >>> 16;
    const cand: [number, number, number, number] = [x - 3, y - 3, 6, 6];
    // 578640 的矩形实参 = 内缩 4 的地图矩形（候选坐标须落在其中），非 6×6 候选框
    if (placeabilityGate(ctx, cand) && rect6x6Check(ctx, [4, 4, ctx.cells.mapW - 8, ctx.cells.mapH - 8], x, y)) {
      candidates.push(packed);
    }
  }
  const sel = farthestSelector(ctx, region.quota, candidates, tiberiumLayout, stamps);
  if (sel === null) return;
  for (let i = 0; i < region.quota && i < sel.selected.length; i++) {
    const packed = sel.selected[i];
    const x = packed & 0xffff;
    const y = packed >>> 16;
    const slot = slotBase + i;
    st.waypoints[slot] = [x, y];
    cells.cellAt(x, y).flags |= 4;
  }
}

// ─── 5A1FB0 起点保护洪泛

export function startWriteFlood(ctx: WaterContext, st: StartState, numPlayers: number): void {
  const { cells, scratch } = ctx;
  for (let i = 0; i < numPlayers; i++) {
    const wp = st.waypoints[i];
    if (wp === undefined || wp === null) continue;
    for (const slot of scratch.slots) slot.patchId = 0;
    interface Node {
      x: number;
      y: number;
      key: number;
    }
    const heap: (Node | null)[] = [null];
    const push = (n: Node): void => {
      if (heap.length - 1 + 1 >= 800) return;
      heap.push(n);
      let k = heap.length - 1;
      while (k > 1) {
        const p = k >> 1;
        if ((heap[p] as Node).key <= n.key) break;
        heap[k] = heap[p];
        heap[p] = n;
        k = p;
      }
    };
    const pop = (): Node | null => {
      if (heap.length === 1) return null;
      const top = heap[1];
      const last = heap.pop() as Node;
      if (heap.length > 1) {
        heap[1] = last;
        let k = 1;
        for (;;) {
          const l = k * 2;
          const r = l + 1;
          let m = k;
          if (l < heap.length && (heap[l] as Node).key < (heap[m] as Node).key) m = l;
          if (r < heap.length && (heap[r] as Node).key < (heap[m] as Node).key) m = r;
          if (m === k) break;
          const t = heap[k];
          heap[k] = heap[m];
          heap[m] = t;
          k = m;
        }
      }
      return top;
    };
    scratch.at(wp[0], wp[1]).patchId = i + 1;
    push({ x: wp[0], y: wp[1], key: 0 });
    let pops = 0;
    for (;;) {
      const node = pop();
      if (node === null || pops >= 400) break;
      scratch.at(node.x, node.y).waterLock = 1; // +0x45 保护旗
      pops++;
      for (let d = 0; d < 8; d++) {
        const off = DIRECTION_OFFSETS[d];
        const nx = node.x + off[0];
        const ny = node.y + off[1];
        if (!cells.inDiamondBounds(nx, ny)) continue;
        const ncell = cells.cellAt(nx, ny);
        const nslot = scratch.at(nx, ny);
        if (nslot.patchId === 0 && isClear(ncell)) {
          nslot.patchId = i + 1;
          const dx = nx - wp[0];
          const dy = ny - wp[1];
          const key = gamemdSqrt(chopAdd(chopMul(dx, dx), chopMul(dy, dy)));
          push({ x: nx, y: ny, key });
        }
      }
    }
  }
}

function isClear(cell: { tile: number }): boolean {
  return cell.tile === 0 || cell.tile === 0xffff;
}

// ─── 594B50 主入口

export function startCandidate(
  ctx: WaterContext,
  rs: RegionState,
  st: StartState,
  tiberiumLayout: number,
): void {
  const { cells, rng } = ctx;
  const threshold0 = chopMul(ctx.cells.mapW * ctx.cells.mapH, 0.03);
  const threshold = ftol(threshold0 < 400 ? 400 : threshold0);
  // 0x483C80 class 回填（原生 recalc 尾调用；这里集中执行）
  applyCellClasses(ctx);
  const kind = zoneKindForMapType(ctx.mapType);
  const zs = buildZoneState(ctx, kind);
  const ref = zs.refs[kind];

  regionResetAll(ctx, rs);
  // 候选洪水
  const limY = cells.mapW + cells.mapH + 4;
  const limX = cells.mapW + cells.mapH + 4;
  for (let y = 0; y < limY; y++) {
    for (let x = 0; x < limX; x++) {
      if (cells.slotAt(x, y) === null) continue;
      const slot = ctx.scratch.at(x, y);
      const cell = cells.cellAt(x, y);
      if (
        slot.regionId === -1 &&
        cell.passability === 0 &&
        getZoneId(ctx, x, y, kind, zs) === ref
      ) {
        startFloodRegion(ctx, rs, zs, x, y, kind, ref);
      }
    }
  }
  // 删小（N = 删除前数量）
  const nBefore = rs.regions.length;
  for (let i = rs.regions.length - 1; i >= 0; i--) {
    if (rs.regions[i].cellCount < threshold) {
      rs.regions.splice(i, 1);
    }
  }
  if (rs.regions.length === 0) return;
  // 打分升序（key = id + N·(500000 − CellCount)）
  const buckets = rs.regions
    .map((r) => ({
      region: r,
      key: r.id + nBefore * (500000 - r.cellCount),
    }))
    .sort((a, b) => a.key - b.key);
  // 配额
  const total = buckets.reduce((s, b) => s + b.region.cellCount, 0);
  const quotaTotal = ctx.startQuota;
  let cum = 0;
  let assigned = 0;
  const quotas: number[] = [];
  for (let i = 0; i < buckets.length; i++) {
    cum += buckets[i].region.cellCount;
    let q: number;
    if (i === buckets.length - 1) {
      q = quotaTotal - assigned;
    } else {
      q = ftol(chopSub((cum / total) * quotaTotal + 0.5, assigned));
    }
    quotas[i] = q;
    assigned += q;
  }
  // 派发
  const stamps = new Map<number, number>();
  for (const b of buckets) {
    for (const packed of b.region.cells) stamps.set(packed, b.region.id);
  }
  let offset = 0;
  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i];
    b.region.quota = quotas[i];
    startWritePerRegion(ctx, st, { quota: quotas[i], cells: b.region.cells, id: b.region.id }, offset, tiberiumLayout, stamps);
    offset += quotas[i];
  }
  // MapType==0 零配额桶掷币（科技楼阶段 14 待接 —— 抽取照消耗）
  if (ctx.mapType === 0) {
    for (let i = 0; i < buckets.length; i++) {
      if (quotas[i] !== 0) continue;
      ctx.rng.next(); // 1 抽，无论结果
    }
  }
}

