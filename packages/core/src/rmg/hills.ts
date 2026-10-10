/**
 * 山丘（原生阶段 16）
 *
 * 反编译：`re/decomp/5A35F0_Hills_Main.c`、`5A33F0`、`5A2F50`、
 * `6B2A70/6B4100/6B4240/6B3E60/6B3A80/6B3850/6B2520`（角点引擎）。
 * 驱动顺序（0x5A35F0）：水岸种子 → 随机游走（全部 RNG）→ 建角点网格 →
 * 逐暂存槽 morph → 收尾（level/slope/tile 反推）→ 2×2 坡象限清理。
 *
 * 契约：
 *   - 游走每槽恰 2 次高斯（拒绝计入），末段高度按符号取整（半值远离零）；
 *   - 角点 ±15 步进、[0,180] 夹取、LOCK/VISITED 字节、LIFO 撤销栈；
 *   - 收尾匹配 19 行 slope 表（`re/decomp/_data_ramp_tables.txt`，行 0 运行时为零）；
 *   - 角点网格几何：菱形坐标原点 (0,0)、边长 mapW+mapH+1（推定，UNVERIFIED ——
 *     原生全局 0x87F90C..918 在语料中无写入者，待 oracle 标定）。
 */

import { DIRECTION_OFFSETS } from './cell';
import { NativeCells, ScratchGrid } from './native';
import { coordOfCell, isClearTile, WaterContext, isShorePieceTile, shoreFamilyD0 } from './water';
import { chopAdd, chopMul, chopSub, ftol } from './x87';
import { RmgGaussian, RmgRng } from './rng';

/** 19 行 slope → (ΔNW, ΔNE, ΔSE, ΔSW)（off_83FF18 静态数据；行 0 = BSS 零） */
export const RAMP_TABLE: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 0, 0, 0],
  [0, 15, 15, 0],
  [0, 0, 15, 15],
  [15, 0, 0, 15],
  [15, 15, 0, 0],
  [0, 0, 15, 0],
  [0, 0, 0, 15],
  [15, 0, 0, 0],
  [0, 15, 0, 0],
  [0, 15, 15, 15],
  [15, 0, 15, 15],
  [15, 15, 0, 15],
  [15, 15, 15, 0],
  [0, 15, 30, 15],
  [15, 0, 15, 30],
  [30, 15, 0, 15],
  [15, 30, 15, 0],
  [0, 15, 0, 15],
  [15, 0, 15, 0],
];

/** 角点网格（8 字节记录：i32 height、u8 LOCK、u8 VISITED） */
export class CornerGrid {
  readonly stride: number;
  readonly rows: number;
  readonly ox = 0;
  readonly oy = 0;
  readonly height: Int32Array;
  readonly lock: Uint8Array;
  readonly visited: Uint8Array;

  constructor(extent: number) {
    this.stride = extent + 1;
    this.rows = extent + 1;
    const n = this.stride * this.rows;
    this.height = new Int32Array(n);
    this.lock = new Uint8Array(n);
    this.visited = new Uint8Array(n);
  }

  idx(xd: number, yd: number): number {
    return (yd - this.oy) * this.stride + (xd - this.ox);
  }
}

/** 角点引擎的全部状态（挂到 ctx.hills） */
export interface HillsState {
  grid: CornerGrid;
  /** 撤销栈：{x, y, oldHeight}（LIFO） */
  undo: { x: number; y: number; old: number }[];
}

// ─── 5A33F0 水/岸种子（零 RNG）

export function hillsWaterShoreSeed(ctx: WaterContext): void {
  const { cells, scratch, theater } = ctx;
  for (const cell of cells.iterate()) {
    const [x, y] = coordOfCell(ctx, cell);
    if (isShorePieceTile(cell, theater)) {
      for (let d = 0; d < 8; d++) {
        const off = DIRECTION_OFFSETS[d];
        const nx = x + off[0];
        const ny = y + off[1];
        if (!cells.inDiamondBounds(nx, ny)) continue;
        const nb = cells.slotAt(nx, ny);
        if (nb !== null && isClearTile(nb)) {
          const s = scratch.at(nx, ny);
          s.heightDelta = 0;
          s.velocity = 1.0;
          s.waterLock = 1;
          break;
        }
      }
    } else if (shoreFamilyD0(cell, theater)) {
      for (let d = 0; d < 8; d++) {
        const off = DIRECTION_OFFSETS[d];
        const nx = x + off[0];
        const ny = y + off[1];
        if (!cells.inDiamondBounds(nx, ny)) continue;
        const nb = cells.slotAt(nx, ny);
        if (nb !== null && isClearTile(nb)) {
          scratch.at(nx, ny).waterLock = 1;
          break;
        }
      }
    }
  }
}

// ─── 5A2F50 随机游走（山丘全部 RNG：每槽 2 高斯）

export function hillsRandomWalk(ctx: WaterContext, ruggedness: number): void {
  const { scratch, gaussian, rng } = ctx;
  const tiltClamp = chopAdd(chopMul(ruggedness, 0.0001), 0.1);
  const outVel = chopMul(ruggedness, 0.0025);
  const halfStep = chopMul(ruggedness, 0.005);
  if (outVel < 0.025) return; // R < 10 → 整个 walk 跳过

  const W = scratch.size;
  for (let i = 0; i < W * W; i++) {
    const s = scratch.slots[i];
    if (s.coord === 0) continue;
    const [x, y] = [s.coord & 0xffff, s.coord >>> 16];

    s.velocity = 0;
    // W 邻 (x−1,y) 与 NW 高度 (x−1,y−1)
    let nwH = 0;
    {
      const inB = ctx.cells.inDiamondBounds(x - 1, y - 1);
      if (inB) nwH = scratch.at(x - 1, y - 1).heightDelta;
    }
    let tilt = 0;
    if (!ctx.cells.inDiamondBounds(x - 1, y)) {
      s.velocity = outVel;
    } else {
      const w = scratch.at(x - 1, y);
      s.heightDelta = chopAdd(s.heightDelta, w.heightDelta);
      s.velocity = w.velocity;
      tilt = chopSub(w.heightDelta, nwH);
    }
    // N 邻 (x,y−1)
    if (!ctx.cells.inDiamondBounds(x, y - 1)) {
      s.velocity = chopAdd(outVel, s.velocity);
    } else {
      const n = scratch.at(x, y - 1);
      s.heightDelta = chopAdd(n.heightDelta, s.heightDelta);
      s.velocity = chopAdd(n.velocity, s.velocity);
      tilt = chopAdd(chopSub(n.heightDelta, nwH), tilt);
    }
    s.heightDelta = chopMul(s.heightDelta, 0.5);
    s.velocity = chopMul(s.velocity, 0.5);
    // tilt 钳制（0 保持 0）
    if (tilt > 0) tilt = tiltClamp;
    else if (tilt < 0) tilt = -tiltClamp;
    // 岸锁
    if (s.waterLock !== 0) {
      if (s.heightDelta <= 0) s.heightDelta = 0;
      s.velocity = 0.0025;
    }
    // Draw1：区间 [−vel, half_step−vel]
    let lo = -s.velocity;
    let hi = chopSub(halfStep, s.velocity);
    let scale = 0.025;
    let center = 0;
    if (-0.025 > hi || lo > 0.025) {
      scale = chopMul(chopSub(hi, lo), 0.5);
      center = chopSub(scale, s.velocity);
    }
    let g: number;
    do {
      do {
        g = chopAdd(chopMul(gaussian.next(rng), scale), center);
      } while (g < lo);
    } while (g > hi);
    s.velocity = chopAdd(g, s.velocity);
    // Draw2：区间 [−2−h, 2−h]；scale = Draw1 后的 velocity，center = clamp(tilt)
    lo = chopAdd(-2, -s.heightDelta);
    hi = chopSub(2, s.heightDelta);
    let c2 = tilt < lo ? lo : tilt > hi ? hi : tilt;
    scale = s.velocity;
    if (chopSub(c2, s.velocity) > hi || chopAdd(s.velocity, c2) < lo) {
      scale = chopMul(chopSub(hi, lo), 0.5);
      c2 = chopAdd(scale, lo);
    }
    do {
      do {
        g = chopAdd(chopMul(gaussian.next(rng), scale), c2);
      } while (g < lo);
    } while (g > hi);
    s.heightDelta = chopAdd(g, s.heightDelta);
  }
  // 末段：高度符号取整（半值远离零）
  for (let i = 0; i < W * W; i++) {
    const h = scratch.slots[i].heightDelta;
    scratch.slots[i].heightDelta = ftol(h > 0 ? chopAdd(h, 0.5) : chopSub(h, 0.5));
  }
}

// ─── 角点引擎

/** 6B2520：格可 morph 判定（0 = 锁） */
function morphableClear(ctx: WaterContext, x: number, y: number): boolean {
  const { cells, scratch, theater } = ctx;
  if (!cells.inDiamondBounds(x, y)) return false;
  const cell = cells.slotAt(x, y);
  if (cell === null) return false;
  if (cell.overlay !== -1) return false;
  if (cell.occupied !== 0) return false;
  if (scratch.at(x, y).waterLock !== 0) return false;
  if (cell.tile >= ctx.isoTileTypeCount || cell.tile === 0xffff) return true;
  // IsoTileType[tile]+736 = Morphable（平水缺省：水族不可 morph，其余可）
  return tileMorphable(ctx.theater, cell.tile);
}

/** 平水 morphable 假设（待 oracle 标定）：非水族皆可 morph */
function tileMorphable(theater: { waterSet: number }, tile: number): boolean {
  return !(tile >= theater.waterSet && tile < theater.waterSet + 14);
}

/** 6B2A70：建角点网格 + 初始高度/锁定 */
export function cornerInit(ctx: WaterContext): HillsState {
  const { cells, theater } = ctx;
  const extent = cells.mapW + cells.mapH;
  const grid = new CornerGrid(extent);
  const state: HillsState = { grid, undo: [] };

  const morphPred = (x: number, y: number): boolean => morphableClear(ctx, x, y);

  for (let cy = grid.oy; cy < grid.oy + grid.rows; cy++) {
    for (let cx = grid.ox; cx < grid.ox + grid.stride; cx++) {
      const gi = grid.idx(cx, cy);
      // 属主解析：自身 → N(0,−1) → NW(−1,−1) → W(−1,0)，第一个过菱形测试者
      const candidates: [number, number][] = [
        [cx, cy],
        [cx, cy - 1],
        [cx - 1, cy - 1],
        [cx - 1, cy],
      ];
      let owner: [number, number] | null = null;
      for (const [ox2, oy2] of candidates) {
        if (cells.inDiamondBounds(ox2, oy2)) {
          owner = [ox2, oy2];
          break;
        }
      }
      if (owner === null) {
        grid.lock[gi] = 1;
        continue;
      }
      // 高度 = RAMP_TABLE[owner.slope][0] + 15·owner.level（恒用 NW 列）
      const oc = cells.cellAt(owner[0], owner[1]);
      grid.height[gi] = (RAMP_TABLE[oc.slope]?.[0] ?? 0) + 15 * oc.level;
      // 锁定：四个候选属主任一不可 morph → 锁
      const bad =
        !morphPred(cx, cy) ||
        !morphPred(cx, cy - 1) ||
        !morphPred(cx - 1, cy - 1) ||
        !morphPred(cx - 1, cy);
      if (bad) grid.lock[gi] = 1;
    }
  }
  void theater;
  return state;
}

/** 6B4100：格的当前可编辑等级 */
export function cornerLevel(ctx: WaterContext, hs: HillsState, x: number, y: number): number {
  const { cells, scratch, theater } = ctx;
  const cell = cells.cellAt(x, y);
  const g = hs.grid;
  const i = g.idx(x, y);
  const nw = g.height[i];
  const ne = g.height[i + 1];
  const se = g.height[i + g.stride + 1];
  const sw = g.height[i + g.stride];
  const min = Math.min(nw, ne, se, sw, 1000);
  if (
    cells.inDiamondBounds(x, y) &&
    cell.overlay === -1 &&
    cell.occupied === 0 &&
    scratch.at(x, y).waterLock === 0 &&
    (cell.tile >= ctx.isoTileTypeCount ||
      cell.tile === 0xffff ||
      tileMorphable(theater, cell.tile))
  ) {
    return Math.trunc(min / 15);
  }
  return cell.level;
}

/** 6B4240：morph 掩码（bit0..3 = NW,NE,SE,SW；过滤 LOCK；dir<=0 取高、dir>0 取低） */
export function cornerMask(
  ctx: WaterContext,
  hs: HillsState,
  x: number,
  y: number,
  dir: number,
): number {
  const g = hs.grid;
  const i = g.idx(x, y);
  const heights = [g.height[i], g.height[i + 1], g.height[i + g.stride + 1], g.height[i + g.stride]];
  const locks = [g.lock[i], g.lock[i + 1], g.lock[i + g.stride + 1], g.lock[i + g.stride]];
  let mn = 1000;
  let mx = -1;
  for (const h of heights) {
    if (h < mn) mn = h;
    if (h > mx) mx = h;
  }
  let mask = 0;
  for (let b = 0; b < 4; b++) {
    if (mx === mn) {
      if (locks[b] === 0) mask |= 1 << b;
    } else if (dir <= 0) {
      if (heights[b] > mn && locks[b] === 0) mask |= 1 << b;
    } else {
      if (heights[b] < mx && locks[b] === 0) mask |= 1 << b;
    }
  }
  return mask;
}

/** 6B3A80：坡度传播（8 邻递归；锁角/出界 force==0 → 失败） */
function propagate(
  ctx: WaterContext,
  hs: HillsState,
  dir: number,
  force: number,
  cx: number,
  cy: number,
): boolean {
  const g = hs.grid;
  const center = g.height[g.idx(cx, cy)];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= g.stride || ny >= g.rows) {
        if (force === 0) return false;
        continue;
      }
      const ni = g.idx(nx, ny);
      const h = g.height[ni];
      if (g.lock[ni] !== 0 && (force === 0 || g.visited[ni] === 0)) {
        if (Math.abs(h - center) > 15) return false;
        continue;
      }
      if (Math.abs(h - center) <= 15) continue;
      if (dir === 1 && h < center) {
        hs.undo.push({ x: nx, y: ny, old: h });
        g.height[ni] = center - 15;
        g.visited[ni] = 1;
      } else if (dir !== 1 && h > center) {
        hs.undo.push({ x: nx, y: ny, old: h });
        g.height[ni] = center + 15;
        g.visited[ni] = 1;
      }
      if (g.lock[ni] === 0) {
        if (!propagate(ctx, hs, dir, force, nx, ny) && force === 0) return false;
      }
    }
  }
  return true;
}

/** 6B3E60：2×2 角块 ±15 施加（全有全无事务） */
export function morphAt(
  ctx: WaterContext,
  hs: HillsState,
  dir: number,
  force: number,
  x: number,
  y: number,
  mask: number,
): boolean {
  const g = hs.grid;
  // 掩码重映射：bit2↔bit3（SE↔SW）—— 6B4240 的 [NW,NE,SE,SW] → 行主序 [NW,NE,SW,SE]
  const m = (mask & 3) | ((mask & 4) << 1) | ((mask >> 1) & 4);
  const start = g.idx(x, y);
  const cornerIdx = [start, start + 1, start + g.stride, start + g.stride + 1];
  const bits = [1, 2, 4, 8];
  hs.undo.length = 0;
  for (let c = 0; c < 4; c++) {
    if ((m & bits[c]) === 0) continue;
    const gi = cornerIdx[c];
    if (g.lock[gi] !== 0) {
      if (force !== 0) continue;
      rollback(hs);
      return false;
    }
    const delta = 15 * (dir > 0 ? 1 : -1);
    const nh = g.height[gi] + delta;
    // ⚠ **原生 `0x6B4240`（size=0x104）没有任何高度夹取** —— 实测全部 cmp 只有：
    //   `cmp ecx,esi` / `cmp ecx,edi`（求 min/max，初值 esi=1000 / edi=−1）
    //   `cmp byte [edx],0`（LOCK）/ `cmp ecx,4`（4 个角）
    //  此前移植的 `nh > 180 ⇒ 跳过` 是**臆造的**，
    //  它把 level 卡在 0..6（基线是 0..12）⇒ 实测 5 轮 hills 仍收敛在 0..6。
    if (nh < 0) {
      // 越界：还原不入栈
      g.visited[gi] = 1;
      if (!propagate(ctx, hs, dir, force, g.ox + (gi % g.stride), g.oy + Math.floor(gi / g.stride)) && force === 0) {
        rollback(hs);
        return false;
      }
      continue;
    }
    hs.undo.push({ x: gi % g.stride, y: Math.floor(gi / g.stride), old: g.height[gi] });
    g.height[gi] = nh;
    g.visited[gi] = 1;
    const cx = gi % g.stride;
    const cy = Math.floor(gi / g.stride);
    if (!propagate(ctx, hs, dir, force, cx, cy) && force === 0) {
      rollback(hs);
      return false;
    }
  }
  return true;
}

function rollback(hs: HillsState): void {
  while (hs.undo.length > 0) {
    const u = hs.undo.pop() as { x: number; y: number; old: number };
    hs.grid.height[hs.grid.idx(u.x, u.y)] = u.old;
  }
}

/**
 * `FinalizeElevationSlopes` = `sub_6B3850`（`MapGenHills.cpp:898`）。
 *
 * 🔴 **上一版多了一步 `g.height[c] -= mn`（四角归零），原生没有。**
 * 原生在 `slope < 0`（位形不在 19 行表里）时 `continue`，而无论匹配与否
 * 都**不消费角点**——网格在函数末尾整体 `clear()`。
 * 那步归零把后续格子看到的角点高度削掉 15 ⇒
 * 「恰好 15 落差」再也构不出来 ⇒ **slope 1~4 恒为 0**，
 * 而 `SubIdx`（= Height）因此只有 4 种（真机 12 种）——
 * 这是「渲染出来单调」的头号根因。已删除。
 *
 * 【原生逐条】
 *  1. 只看**四角至少有一个 touched** 的格（`0x6b38c7`）；
 *  2. 四角取 `e(x,y) / e(x+1,y) / e(x+1,y+1) / e(x,y+1)`（该顺序很重要，
 *     它与 `kSlopeCorners` 的列序一一对应）；
 *  3. `highest − lowest > 15` ⇒ 跳过（跨两级以上不算坡）；
 *  4. `CanHostSlope(x, y)` 四条门：菱形内 / overlay==-1 / 无建筑 / `work+69` 清 / tile 可 morph；
 *  5. **崖壁抑制门**：若某个**正交**邻格是 CliffSet tile 且 `Level − 新 level >= 2`，
 *     则要求同方向存在一个 `Level == 新 level` 的 CliffSet 格（它的美术自带中间墙面），
 *     否则整格跳过（**只算正交，对角不算**——对角 L4/L8 挨着是合法配置）。
 *  6. `cell->Level = lowest / 15` **先写**，再查表 ⇒
 *     即使位形不在表里，level 也已更新（只是 slope/tile 不动）；
 *  7. 查 `kSlopeCorners` 19 行；命中则
 *     `SlopeIndex = slope`、`IsoTileTypeIndex = slope ? rampBase + slope − 1 : clearTile`。
 */
export function cornerFinalize(ctx: WaterContext, hs: HillsState): void {
  const { cells, theater: t, scratch } = ctx;
  const g = hs.grid;
  for (const cell of cells.iterate()) {
    const [x, y] = coordOfCell(ctx, cell);
    const i = g.idx(x, y);
    const corners = [i, i + 1, i + g.stride + 1, i + g.stride];
    const visitedAny =
      g.visited[corners[0]] !== 0 ||
      g.visited[corners[1]] !== 0 ||
      g.visited[corners[2]] !== 0 ||
      g.visited[corners[3]] !== 0;
    if (!visitedAny) continue;
    const hs4 = corners.map((c) => g.height[c]);
    const mn = Math.min(...hs4, 1000);
    const mx = Math.max(...hs4, 0);
    if (mx - mn > 15) continue; // 跨两级以上 ⇒ 不算坡

    // ── 资格门（原生 `CanHostSlope` = `sub_6B2520`）──
    if (
      !cells.inDiamondBounds(x, y) ||
      cell.overlay !== -1 ||
      cell.occupied !== 0 ||
      scratch.at(x, y).waterLock !== 0
    ) {
      continue;
    }
    // 原生是 `IsMorphableTile(cell->IsoTileTypeIndex)`：**越界与 0xFFFF 都算可 morph**，
    // 只有越界内的具体 tile 才查表。
    if (cell.tile < ctx.isoTileTypeCount && cell.tile !== 0xffff && !tileMorphable(t, cell.tile)) {
      continue;
    }

    // ── 崖壁抑制门（原生 `FinalizeElevationSlopes` 的 port tuning 块）──
    // 只看正交邻格；要求同方向有一块同 level 的崖片格（其美术自带中间墙面）。
    const newLevel = Math.trunc(mn / 15);
    {
      const oDX = [0, 1, 0, -1];
      const oDY = [-1, 0, 1, 0];
      const inCliff = (t2: number) => t2 >= t.cliffSet && t2 <= t.cliffSet + 39;
      let block = false;
      for (let sd = 0; sd < 4 && !block; sd++) {
        const oq = cells.slotAt(x + oDX[sd], y + oDY[sd]);
        if (oq && inCliff(oq.tile) && oq.level - newLevel >= 2) block = true;
      }
      if (block) {
        let sameLevelFoot = false;
        for (let sd = 0; sd < 4 && !sameLevelFoot; sd++) {
          const sq = cells.slotAt(x + oDX[sd], y + oDY[sd]);
          if (sq && inCliff(sq.tile) && sq.level === newLevel) sameLevelFoot = true;
        }
        if (!sameLevelFoot) continue;
      }
    }

    // level 先写，再查表（原生 0x6b39dc）
    cell.level = newLevel;
    const deltas = hs4.map((h) => h - mn);
    let matched = -1;
    for (let s = 0; s < RAMP_TABLE.length; s++) {
      const row = RAMP_TABLE[s];
      if (
        row[0] === deltas[0] &&
        row[1] === deltas[1] &&
        row[2] === deltas[2] &&
        row[3] === deltas[3]
      ) {
        matched = s;
        break;
      }
    }
    if (matched < 0) continue; // 原生 0x6b3a25 → LABEL_36：level 已写，slope/tile 不动

    cell.slope = matched;
    cell.tile = matched === 0 ? t.clearTile : t.rampBase + matched - 1;
  }
}

/** 5A35F0 尾：2×2 坡象限清理（零 RNG） */
export function quadrantCleanup(ctx: WaterContext): void {
  const { cells, theater: t } = ctx;
  for (const cell of cells.iterate()) {
    const slope = cell.slope;
    if (slope !== 5 && slope !== 11) continue;
    const [x, y] = coordOfCell(ctx, cell);
    const offs = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const want = slope === 5 ? [5, 6, 7, 8] : [11, 12, 9, 10];
    let ok = true;
    const quad: ReturnType<typeof cells.cellAt>[] = [];
    for (let k = 0; k < 4; k++) {
      const q = cells.cellAt(x + offs[k][0], y + offs[k][1]);
      quad.push(q);
      if (q.slope !== want[k]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    // ── 崖坡抑制门（原生 `MergeSlopeBlocks` 的 port tuning 块）──
    // 紧贴 CliffRamps(0..9) 或 CliffSet(0..39) 的坡块**不许**塌成 0xFFFF：
    // 原版存图里这类接缝从不带 0xFFFF，塌了就会在坡道旁留白墙三角。
    // 探测范围是 4 格块的 3×3 邻域（跳过块内另外三格）。
    let touchesArt = false;
    for (let k = 0; k < 4 && !touchesArt; k++) {
      const bx = x + offs[k][0];
      const by = y + offs[k][1];
      for (let adx = -1; adx <= 1 && !touchesArt; adx++) {
        for (let ady = -1; ady <= 1; ady++) {
          if (adx === 0 && ady === 0) continue;
          const ax = bx + adx;
          const ay = by + ady;
          if (ax >= x && ax <= x + 1 && ay >= y && ay <= y + 1) continue;
          const aq = cells.slotAt(ax, ay);
          if (!aq) continue;
          const at = aq.tile;
          if ((t.cliffRamps >= 0 && at >= t.cliffRamps && at <= t.cliffRamps + 9) ||
              (t.cliffSet >= 0 && at >= t.cliffSet && at <= t.cliffSet + 39)) {
            touchesArt = true;
            break;
          }
        }
      }
    }
    if (touchesArt) continue;

    for (const q of quad) {
      q.tile = 0xffff;
      q.subTile = 0;
      q.slope = 0;
      if (slope === 11) q.level += 1;
    }
  }
}

/** 5A35F0 全流程 */
export function hillsMain(ctx: WaterContext): void {
  hillsWaterShoreSeed(ctx);
  hillsRandomWalk(ctx, ctx.ruggedness);
  const hs = cornerInit(ctx);
  ctx.hills = hs;
  const { cells, scratch } = ctx;
  // 原生按暂存线性序扫描（非蛇形 cell 序）—— morph 结果依赖此序
  const W = scratch.size;
  for (let i = 0; i < W * W; i++) {
    const s = scratch.slots[i];
    if (s.coord === 0) continue;
    const x = s.coord & 0xffff;
    const y = s.coord >>> 16;
    const cell = cells.cellAt(x, y);
    const target = cell.level + s.heightDelta;
    const cur = cornerLevel(ctx, hs, x, y);
    const delta = ftol(chopSub(target, cur));
    const n = Math.abs(delta);
    const dir = delta >= 0 ? 1 : -1;
    for (let k = 0; k < n; k++) {
      const mask = cornerMask(ctx, hs, x, y, dir);
      morphAt(ctx, hs, dir, 0, x, y, mask);
    }
  }
  cornerFinalize(ctx, hs);
  smoothLevelJumps(ctx);
  quadrantCleanup(ctx);
}

/**
 * 邻格 level 差 ≥ 2 的平顺（原生 6B3E60 传播保证邻格 level 差 ≤ 1；
 * 移植侧 morph 回滚保真度缺口会留下 2~3 级断崖 → 渲染器画黑块）。
 * 高侧降 1 优先，否则低侧升 1；跳过保护圈格。迭代至收敛（≤8 趟）。
 */
export function smoothLevelJumps(ctx: WaterContext): void {
  const { cells, scratch } = ctx;
  const lim = cells.mapW + cells.mapH + 4;
  for (let pass = 0; pass < 8; pass++) {
    let fixed = 0;
    for (let y = 1; y < lim; y++) {
      for (let x = 1; x < lim; x++) {
        const a = cells.slotAt(x, y);
        if (!a) continue;
        for (let d = 0; d < 8; d += 2) {
          const off = DIRECTION_OFFSETS[d];
          const b = cells.slotAt(x + off[0], y + off[1]);
          if (!b) continue;
          const diff = a.level - b.level;
          if (Math.abs(diff) < 2) continue;
          const hi = diff > 0 ? a : b;
          const lo = diff > 0 ? b : a;
          const hiX = diff > 0 ? x : x + off[0];
          const hiY = diff > 0 ? y : y + off[1];
          const loX = diff > 0 ? x + off[0] : x;
          const loY = diff > 0 ? y + off[1] : y;
          if (scratch.at(hiX, hiY).waterLock === 0 && hi.level > 0) {
            hi.level -= 1;
          } else if (scratch.at(loX, loY).waterLock === 0 && lo.level < 12) {
            lo.level += 1;
          } else {
            continue;
          }
          fixed++;
        }
      }
    }
    if (fixed === 0) break;
  }
}


