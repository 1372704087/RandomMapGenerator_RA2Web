/**
 * 区域划分与层级（原生阶段 5 + 6）
 *
 * 对应 gamemd YR 1.001（反编译 `re/decomp/`，裁决见 `re/specs/REGIONS_START_POINTS.md`）：
 *   regionPartition   0x0058CF90   线性扫暂存，水/绿格种子 → floodHelper
 *   floodHelper       0x0058C800   LIFO（DFS 序）洪水；<75 弹出的陆种溶解
 *   regionBfs1        0x0058E740   水/绿区域的 level 匹配扩张（冲突即中止）
 *   regionBfs2        0x0058E9B0   +0x4B 水旗格传播（LIFO）
 *   regionFallback    0x0058D010   剩余未认领格回退建区（a1=0）
 *   boundaryCells     0x0058D410   区域边界格（全图蛇形扫）
 *   boundaryCollector 0x005A0700  指定 tag 的边界格（暂存线性扫）
 *   regionCtor        0x0058BF70   id = nextRegionId++，level/water 取种子格
 *
 * 调用序（0x598960 主函数实证）：
 *   清区（ABED14=0）→ 58CF90 → 逐区域（water 旗 != 0）：
 *     58E740(region, (CellCount>8000) + !mode34 + 4) → 58E9B0(region) → 58D010(0)
 *
 * 契约：洪水为 **LIFO 栈**（弹栈时声明 +0x38/+0x3C）；+0x3C 在父扫描时即盖
 * （同格可重复入栈）；BFS1 的声明（+0x38 与 level 写回）无条件执行，
 * 仅 append 受容量门控（本模型向量无界）。
 */

import { DIRECTION_OFFSETS } from './cell';
import { NativeCell } from './native';
import { coordOfCell, isClearTile, isGreenTile, isWaterFamily, WaterContext } from './water';
import { nextUniformRange } from './x87';

/** RmgRegion（原生 0x50 字节对象的语义子集） */
export interface RmgRegion {
  /** +0x08 */
  id: number;
  /** +0x0C */
  cellCount: number;
  /** +0x10 */
  level: number;
  /** +0x14 byte：种子格过水族测试（4865D0） */
  water: number;
  /** +0x16 打包种子坐标 */
  seedCoord: number;
  /** +0x1A byte */
  finalised: number;
  /** +0x24 byte */
  merged: number;
  /** +0x20 起点配额（阶段 13 写） */
  quota: number;
  /** +0x28 DynamicVector<Cell>（打包坐标数组） */
  cells: number[];
  /** +0x40..+0x4C bbox {x0,y0,w,h} */
  bbox: [number, number, number, number];
  /**
   * 阶段 8（`0x58F0C0`）：与本区域**相邻的其他区域 id 列表**。
   *
   * 原生存在 `region+0x04` 的 DynamicVector 里（`0x58F0C0` 填充），
   * 本仓用普通数组承载。`bridgePair5x5` 读它做区域配对。
   */
  neighbors?: number[];
  /**
   * 阶段 8（`0x5905D0`）：记录到的连桥对（目标区域 id）。
   *
   * ⚠ **只记账不落地** —— 原生此处调 `sub_58F2C0(A,B)` 写 ramp/brick tile，
   * 该函数**未移植**，所以桥目前不会真的出现在地图上。
   */
  bridges?: number[];
  /** 内部：反查同表其他区域（对应原生 `dword_ABDF94` 全局表的线性搜索） */
  __all?: RmgRegion[];
}

/** 区域阶段全局状态（挂到管线上下文） */
export interface RegionState {
  regions: RmgRegion[];
  /** dword_ABED14 */
  nextRegionId: number;
}

export function createRegionState(): RegionState {
  return { regions: [], nextRegionId: 0 };
}

function unpack(p: number): [number, number] {
  return [p & 0xffff, p >>> 16];
}

function pack(x: number, y: number): number {
  return ((y & 0xffff) << 16) | (x & 0xffff);
}

/** `0x0058BF70`：id 取 ABED14 并自增；level/water 取种子格；入全局表 */
export function regionCtor(ctx: WaterContext, rs: RegionState, seedPacked: number): RmgRegion {
  const [x, y] = unpack(seedPacked);
  const cell = ctx.cells.cellAt(x, y);
  const region: RmgRegion = {
    id: rs.nextRegionId++,
    cellCount: 0,
    level: cell.level,
    water: isWaterFamily(cell, ctx.theater) ? 1 : 0,
    seedCoord: seedPacked,
    finalised: 0,
    merged: 0,
    quota: 0,
    cells: [],
    bbox: [9999, 9999, 0, 0],
  };
  rs.regions.push(region);
  return region;
}

/** `0x0058CE90`：暂存 +0x38/+0x3C = -1、删全部区域、ABED14 = 0 */
export function regionResetAll(ctx: WaterContext, rs: RegionState): void {
  for (const slot of ctx.scratch.slots) {
    slot.regionId = -1;
    slot.patchId = -1;
  }
  rs.regions.length = 0;
  rs.nextRegionId = 0;
}

/** 种子格的分类（水族 ‖ 绿 LAT）→ 1，否则 0 */
function cellClass(cell: NativeCell, theater: import('./theater').TheaterTables): number {
  return isWaterFamily(cell, theater) || isGreenTile(cell, theater) ? 1 : 0;
}

/**
 * `0x0058C800` 洪水建区。返回新区域；null = 溶解（未建区）。
 * 抽数：仅 `cls==0 && stamp==0`（58D010 回退路径）的随机边界格 1 处。
 */
export function floodHelper(
  ctx: WaterContext,
  rs: RegionState,
  seedX: number,
  seedY: number,
  dissolve: boolean,
): RmgRegion | null {
  const { cells, scratch, rng } = ctx;
  const stamp = rs.nextRegionId;
  const seedPacked = pack(seedX, seedY);
  const stack: number[] = [seedPacked];
  const seedCell = cells.cellAt(seedX, seedY);
  const cls = cellClass(seedCell, ctx.theater);
  const lvl = seedCell.level;
  let pops = 0;

  while (stack.length > 0) {
    const c = stack.pop() as number;
    const [cx, cy] = unpack(c);
    const slot = scratch.at(cx, cy);
    slot.regionId = stamp;
    slot.patchId = stamp;
    pops++;
    for (let d = 0; d < 8; d++) {
      const off = DIRECTION_OFFSETS[d];
      const nx = cx + off[0];
      const ny = cy + off[1];
      if (!cells.inDiamondBounds(nx, ny)) continue;
      const nslot = scratch.at(nx, ny);
      if (nslot.regionId !== -1 || nslot.patchId === stamp) continue;
      nslot.patchId = stamp; // 防重查（无条件）
      const ncell = cells.cellAt(nx, ny);
      if (ncell.level === lvl && cellClass(ncell, ctx.theater) === cls) {
        stack.push(pack(nx, ny));
      }
    }
  }

  // 溶解分支（仅 cls==0 —— 58D010 回退播种的陆格种子）
  if (pops < 75 && cls === 0 && dissolve) {
    if (stamp !== 0) {
      // 并入 W 邻（X−1）；出域改 N 邻（Y−1）；都出域 → 建区
      let wx = seedX - 1;
      let wy = seedY;
      if (!cells.inDiamondBounds(wx, wy)) {
        wx = seedX;
        wy = seedY - 1;
      }
      if (cells.inDiamondBounds(wx, wy)) {
        const nslot = scratch.at(wx, wy);
        const ncell = cells.cellAt(wx, wy);
        const v34 = nslot.regionId;
        const v35 = ncell.level;
        for (const cell of cells.iterate()) {
          const [x, y] = coordOfCell(ctx, cell);
          const s = scratch.at(x, y);
          if (s.regionId === stamp) {
            s.regionId = v34;
            s.waterBridgeFlags = 0; // +0x4B
            cell.tile = 0;
            cell.subTile = 0;
            cell.level = v35 !== -1 ? v35 : ctx.defaultLevel;
          }
        }
        return null;
      }
    } else {
      // stamp == 0（首区）：随机取 stamp-0 边界格（1 抽），找 level≠种子且非水的邻格
      const border = boundaryCollector(ctx, 0);
      let pick = 0;
      if (border.length > 0) {
        const count = border.length;
        do {
          pick = nextUniformRange(rng.next(), 0, count - 1);
        } while (pick > count - 1);
        const [bx, by] = unpack(border[Math.min(pick, count - 1)]);
        let target: [number, number] | null = null;
        for (let d = 0; d < 8; d++) {
          const off = DIRECTION_OFFSETS[d];
          const nx = bx + off[0];
          const ny = by + off[1];
          if (!cells.inDiamondBounds(nx, ny)) continue;
          const ncell = cells.cellAt(nx, ny);
          if (ncell.level !== lvl && !isWaterFamily(ncell, ctx.theater)) {
            target = [nx, ny];
            break;
          }
        }
        if (target !== null) {
          const [, ty] = target;
          const tLevel = cells.cellAt(target[0], ty).level;
          for (const cell of cells.iterate()) {
            const [x, y] = coordOfCell(ctx, cell);
            const s = scratch.at(x, y);
            if (s.regionId === 0) {
              s.regionId = -1;
              s.waterBridgeFlags = 0; // +0x4B
              cell.tile = 0;
              cell.subTile = 0;
              cell.level = tLevel !== -1 ? tLevel : ctx.defaultLevel;
            }
          }
          return null;
        }
      }
      // count==0 或无合格邻格 → 落到建区（原生读空数组的崩溃路径按建区近似，已标注）
    }
  }

  // 建区
  const region = regionCtor(ctx, rs, seedPacked);
  region.level = lvl;
  region.water = cls;
  region.cellCount = 0;
  for (const slot of ctx.scratch.slots) {
    if (slot.regionId === region.id && slot.coord !== 0) {
      region.cellCount++;
    }
  }
  return region;
}

/** `0x0058CF90`：线性扫暂存；水/绿格种子 → floodHelper（非溶解模式） */
export function regionPartition(ctx: WaterContext, rs: RegionState): void {
  for (const slot of ctx.scratch.slots) {
    if (slot.regionId !== -1 || slot.coord === 0) continue;
    const [x, y] = unpack(slot.coord);
    const cell = ctx.cells.cellAt(x, y);
    if (isWaterFamily(cell, ctx.theater) || isGreenTile(cell, ctx.theater)) {
      floodHelper(ctx, rs, x, y, false);
    }
  }
}

/** `0x0058D010`（a1 恒 0）：剩余未认领格回退建区，region.finalised = a1 */
export function regionFallback(ctx: WaterContext, rs: RegionState, a1 = 0): void {
  for (const slot of ctx.scratch.slots) {
    if (slot.regionId !== -1 || slot.coord === 0) continue;
    const [x, y] = unpack(slot.coord);
    const r = floodHelper(ctx, rs, x, y, true);
    if (r !== null) r.finalised = a1;
  }
}

/** `0x0058D410`：全图蛇形扫，区域格且任一 8 邻 scratch id 不同 → 该格坐标 */
export function boundaryCells(ctx: WaterContext, region: RmgRegion): number[] {
  const { cells, scratch } = ctx;
  const out: number[] = [];
  for (const cell of cells.iterate()) {
    const [x, y] = coordOfCell(ctx, cell);
    if (scratch.at(x, y).regionId !== region.id) continue;
    let isBoundary = false;
    for (let d = 0; d < 8; d++) {
      const off = DIRECTION_OFFSETS[d];
      const nx = x + off[0];
      const ny = y + off[1];
      if (!cells.inDiamondBounds(nx, ny)) continue;
      if (scratch.at(nx, ny).regionId !== region.id) {
        isBoundary = true;
        break;
      }
    }
    if (isBoundary) out.push(pack(x, y));
  }
  return out;
}

/** `0x005A0700`：暂存线性扫，tag 区域的边界格 */
export function boundaryCollector(ctx: WaterContext, tag: number): number[] {
  const { cells, scratch } = ctx;
  const out: number[] = [];
  for (const slot of ctx.scratch.slots) {
    const coord = slot.coord;
    if (coord === 0 || slot.regionId !== tag) continue;
    const [x, y] = unpack(coord);
    let isBoundary = false;
    for (let d = 0; d < 8; d++) {
      const off = DIRECTION_OFFSETS[d];
      const nx = x + off[0];
      const ny = y + off[1];
      if (!cells.inDiamondBounds(nx, ny)) continue;
      if (scratch.at(nx, ny).regionId !== tag) {
        isBoundary = true;
        break;
      }
    }
    if (isBoundary) out.push(coord);
  }
  void cells;
  return out;
}

/**
 * `0x0058E740`：level 匹配扩张。返回 false = 冲突中止（上层忽略返回值）。
 * 声明（+0x38 与邻格 level）无条件；frontier 序 = boundaryCells 的蛇形序。
 */
export function regionBfs1(
  ctx: WaterContext,
  region: RmgRegion,
  passes: number,
): boolean {
  const { cells, scratch } = ctx;
  let frontier = boundaryCells(ctx, region);
  for (let p = 0; p < passes; p++) {
    const next: number[] = [];
    for (const c of frontier) {
      const [cx, cy] = unpack(c);
      for (let d = 0; d < 8; d++) {
        const off = DIRECTION_OFFSETS[d];
        const nx = cx + off[0];
        const ny = cy + off[1];
        if (!cells.inDiamondBounds(nx, ny)) continue;
        const ncell = cells.cellAt(nx, ny);
        if (ncell.level !== region.level) continue;
        const nslot = scratch.at(nx, ny);
        if (nslot.regionId === -1 && (isClearTile(ncell) || isGreenTile(ncell, ctx.theater))) {
          next.push(pack(nx, ny));
          nslot.regionId = region.id;
          ncell.level = region.level;
        } else if (nslot.regionId !== region.id) {
          return false; // 冲突（含 r==-1 但类测试失败）
        }
      }
    }
    frontier = next;
  }
  return true;
}

/** `0x0058E9B0`：水旗（+0x4B）格传播，LIFO。恒返回 true。 */
export function regionBfs2(ctx: WaterContext, region: RmgRegion): boolean {
  const { cells, scratch } = ctx;
  const stack = boundaryCells(ctx, region);
  while (stack.length > 0) {
    const c = stack.pop() as number;
    const [cx, cy] = unpack(c);
    for (let d = 0; d < 8; d++) {
      const off = DIRECTION_OFFSETS[d];
      const nx = cx + off[0];
      const ny = cy + off[1];
      if (!cells.inDiamondBounds(nx, ny)) continue;
      const nslot = scratch.at(nx, ny);
      if (nslot.regionId === -1 && nslot.waterBridgeFlags !== 0) {
        nslot.regionId = region.id;
        stack.push(pack(nx, ny));
      }
    }
  }
  return true;
}


