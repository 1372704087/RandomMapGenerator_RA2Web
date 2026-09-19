/**
 * Zone 系统（RMG 消费语义的忠实移植）
 *
 * 原生：`0x56C510`（建区 + 桥接矩阵 + 逐 kind BFS 重编号，返回最大区 id）、
 * `0x56CB90`（同 class 洪水）、`0x56D230`（GetZoneID）、`0x483C80`（+0x4C class）。
 *
 * 解明结论（re/decomp + 完整通行矩阵 0x82A594，13 kind × 32B）：
 *   - class（CellClass+0x4C）由 0x483C80 写：出域 → 7；land 2 → 4；land 6 → 3；
 *     速度 ≤ 0.01 → 6；overlay 墙 → 1；无占位者 → 0。
 *   - Zone = 同 class 的 8 连通分量（class 7 出域不参与）。
 *   - tier = matrix[kind][class]；tier != 1 的区 → 重映射 id 1；
 *     tier == 1 的区按邻接图（桥接边）BFS 依次编号 2,3,4…
 *     ⇒ kind 0/5（RMG 用）下：每个连通 class-0 陆块独立 id，岩/坡组也独立，
 *       其余 class 全部合并为 1。
 *   - 0x56C510 返回 **最大原始区** 的 id；ref = remap[最大区]。
 *
 * 简化（对本管线语义等价，UNVERIFIED 点已标注）：
 *   - 桥接边（+0x140 bit 0x100）在 mt 0/1/2 的水体系不产生 → 邻接图为空，
 *     BFS 退化为「每个 tier==1 分量独立编号」。
 *   - class 的速度表用缺省：land 8（水族 TMP 的 land）→ 0（不可通行），其余 1。
 */

import { DIRECTION_OFFSETS } from './cell';
import { NativeCell } from './native';
import { WaterContext } from './water';

/** 地面速度缺省表（flt_89EA48 为 BSS，运行时由规则填充；land 8 = 水 → 0） */
export const DEFAULT_LAND_SPEED: readonly number[] = [
  1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1,
];

/** 完整通行矩阵（0x82A594，[kind][class]，exe 文件映像抓取） */
export const PASSABILITY_MATRIX: readonly number[][] = [
  [1, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2],
  [1, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 2],
  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 2],
  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1],
  [1, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 2],
  [1, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2],
  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 2],
  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
  [2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2],
  [2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 2],
];

/** `0x483C80`：通行 class（RMG 阶段无 overlay 墙/占位者的分支） */
export function computeCellClass(ctx: WaterContext, x: number, y: number): number {
  const { cells } = ctx;
  if (!cells.inDiamondBounds(x, y)) return 7;
  const cell = cells.cellAt(x, y);
  if (cell.occupied !== 0) {
    // 原生走占位者对象链（树/单位）；RMG 阶段树为 Terrain 对象不阻塞 → 0
    return 0;
  }
  const land = cell.landType & 0x0f;
  if (land === 2) return 4;
  if (land === 6) return 3;
  const speed = DEFAULT_LAND_SPEED[land] ?? 1;
  if (speed <= 0.01) return 6;
  return 0;
}

/** Zone 记录 */
export interface Zone {
  id: number; // 原始区号（1 起；0 = 未分配）
  cls: number;
  cells: [number, number][];
}

/** 全图 class 计算 + 同 class 8 连通分区 */
export function buildZones(ctx: WaterContext): Zone[] {
  const { cells } = ctx;
  const zones: Zone[] = [];
  const zoneAt = new Map<string, number>();
  const clsCache = new Map<string, number>();
  const clsOf = (x: number, y: number): number => {
    const k = `${x},${y}`;
    let v = clsCache.get(k);
    if (v === undefined) {
      v = computeCellClass(ctx, x, y);
      clsCache.set(k, v);
    }
    return v;
  };
  const cellList: [number, number][] = [];
  const limY = cells.mapW + cells.mapH + 4;
  const limX = cells.mapW + cells.mapH + 4;
  for (let y = 0; y < limY; y++) {
    for (let x = 0; x < limX; x++) {
      if (cells.slotAt(x, y) !== null) cellList.push([x, y]);
    }
  }
  for (const [x, y] of cellList) {
    const key = `${x},${y}`;
    if (zoneAt.has(key)) continue;
    const cls = clsOf(x, y);
    if (cls === 7) {
      zoneAt.set(key, 0); // 出域哨兵
      continue;
    }
    const id = zones.length + 1;
    const zone: Zone = { id, cls, cells: [] };
    const stack: [number, number][] = [[x, y]];
    zoneAt.set(key, id);
    while (stack.length > 0) {
      const [cx, cy] = stack.pop() as [number, number];
      zone.cells.push([cx, cy]);
      for (let d = 0; d < 8; d++) {
        const off = DIRECTION_OFFSETS[d];
        const nx = cx + off[0];
        const ny = cy + off[1];
        const nk = `${nx},${ny}`;
        if (zoneAt.has(nk)) continue;
        if (!cells.inDiamondBounds(nx, ny)) continue;
        if (clsOf(nx, ny) !== cls) continue;
        zoneAt.set(nk, id);
        stack.push([nx, ny]);
      }
    }
    zones.push(zone);
  }
  return zones;
}

/** 逐 kind 重映射（0x56C510 尾部 BFS 的无桥退化版） */
export function buildKindRemap(
  zones: Zone[],
  kind: number,
): { remap: number[]; biggestRawId: number } {
  const n = zones.length;
  const remap = new Array<number>(n + 1).fill(0); // index 0 unused
  let biggest = 0;
  let biggestSize = -1;
  for (const z of zones) {
    if (z.cells.length > biggestSize) {
      biggestSize = z.cells.length;
      biggest = z.id;
    }
  }
  // tier != 1 → id 1；tier == 1 → 无桥邻接图 ⇒ 每区分量独立编号 2,3,…
  let next = 2;
  for (const z of zones) {
    const tier = PASSABILITY_MATRIX[kind][z.cls & 0x0f] ?? 0;
    remap[z.id] = tier === 1 ? next++ : 1;
  }
  return { remap, biggestRawId: biggest };
}

/** `0x56D230` 的 RMG 消费面：GetZoneID(cell, kind, bridgeAware=false) */
export function getZoneId(
  ctx: WaterContext,
  x: number,
  y: number,
  kind: number,
  zs: ZoneState,
): number {
  const key = `${x},${y}`;
  const raw = zs.zoneAt.get(key);
  if (raw === undefined || raw === 0) return -1;
  return zs.remaps[kind][raw] ?? -1;
}

/** Zone 阶段状态 */
export interface ZoneState {
  zones: Zone[];
  zoneAt: Map<string, number>;
  remaps: number[][];
  /** 0x56C510 返回值：最大原始区 id */
  biggestRawId: number;
  /** kind → ref（remap[biggest]） */
  refs: number[];
}

/** RMG 的 kind 表 {5,5,5,0,0}[mapType] */
export function zoneKindForMapType(mapType: number): number {
  return [5, 5, 5, 0, 0][mapType] ?? 5;
}

/** 全量构建（对应 map-prep 的 56D6E0+56C510 序列中 Zone 相关部分） */
export function buildZoneState(ctx: WaterContext, mapType: number): ZoneState {
  const zones = buildZones(ctx);
  const zoneAt = new Map<string, number>();
  for (const z of zones) {
    for (const [x, y] of z.cells) zoneAt.set(`${x},${y}`, z.id);
  }
  const remaps: number[][] = [];
  const refs: number[] = [];
  let biggestRawId = 0;
  for (let kind = 0; kind < 13; kind++) {
    const { remap, biggestRawId: b } = buildKindRemap(zones, kind);
    remaps.push(remap);
    if (kind === 0) biggestRawId = b;
  }
  // ref = 最大【可行走 tier==1】区的重映射 id。
  // 开放问题：原生 0x56C510 返回「全图最大区」（可能为水域），其 remap 为 1 时
  // 594B50 的洪水门将无匹配 —— 与原生实际产出矛盾，说明洪水跳过条件/线性数组
  // 语义仍有未解明处（README 待办）。此处按设计意图取最大 tier-1 区。
  for (let kind = 0; kind < 13; kind++) {
    let best = 0;
    let bestSize = -1;
    for (const z of zones) {
      const tier = PASSABILITY_MATRIX[kind][z.cls & 0x0f] ?? 0;
      if (tier === 1 && z.cells.length > bestSize) {
        bestSize = z.cells.length;
        best = z.id;
      }
    }
    refs[kind] = best !== 0 ? remaps[kind][best] ?? -1 : -1;
  }
  void ctx;
  return { zones, zoneAt, remaps, biggestRawId, refs };
}

/** 全格 class 回填（0x483C80 的调用序在原生由 recalc/attr 链触发；这里集中写） */
export function applyCellClasses(ctx: WaterContext): void {
  const { cells } = ctx;
  for (const cell of cells.iterate()) {
    const [x, y] = coordOf(ctx, cell);
    cell.passability = computeCellClass(ctx, x, y);
  }
}

import { coordOfCell } from './water';
function coordOf(ctx: WaterContext, cell: NativeCell): [number, number] {
  return coordOfCell(ctx, cell);
}
