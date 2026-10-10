/**
 * 阶段 7（仅 MapType 3/4）：台地阈值 + 区域分裂。
 *
 * 依据 `re/decomp/58EBC0_Region_PlateauThreshold.c`（177 行）
 *    + `re/decomp/58D620_Region_Split.c`（893 行）。
 *
 * 【算法（`0x58EBC0`，逐行对照伪码）】
 *  1. 重置每个区域：`cells` 清空、`cellCount(+0x0C)=0`、
 *     `bbox(+0x40..+0x4C)` 置 `{9999, 9999, 0, 0}`。
 *     ⚠ bbox 初值是 **9999**（不是 0）—— 之后靠 `bbox.w == 0` 判断是否首格。
 *  2. **倒序**遍历全图（`v2 = linear²−1` 起，每步 `v4 -= 80`）：
 *     - 菱形带内四条不等式：`x+y > min`、`x−y < min`、`y−x < min`、`x+y <= max`
 *     - 取该格所属 regionId，合法则 `++cellCount`、push 进 `cells`、更新 bbox
 *  3. 阈值：`v22 = trunc(v21 + v21)`，其中
 *     `v21 = (scale*0.005 + 0.05) * W * H`
 *     ⚠ 伪码是 `v21 + v21`（**自己乘 2**，不是 ×2 常数）。
 *  4. 逐区域：`if (finalised(+0x1A)==0 && water(+0x14)==0)`
 *     - `cellCount <= v22` ⇒ `finalised = 1`（标记保留，不再分裂）
 *     - 否则调 `sub_58D620(region)`；成功则把该区域从全局表**移除**
 *
 * 【区域字段偏移对照（原生 ← → `RmgRegion`）】
 *   +0x0C cellCount ← cellCount
 *   +0x14 byte      ← water
 *   +0x1A byte      ← finalised（阈值标记位）
 *   +0x28 DynamicVector<Cell> ← cells
 *   +0x40..+0x4C bbox ← bbox [x0, y0, w, h]
 *
 * 【`sub_58D620` 未移植】
 * 893 行、依赖 12 个外部函数（`477BE0`/`477D20`/`477E10`/`42F7C0`/`58BF70`…），
 * 属独立大工程。当前 `regionSplit` 返回 0（= 原生"分裂失败"分支），
 * 于是**小区域照常标记保留、大区域保持不分裂** —— 地图仍可出，只是没有台地分裂效果。
 */

import { chopAdd, chopMul } from './x87';
import { coordOfCell } from './water';
import type { WaterContext } from './water';
import type { RegionState, RmgRegion } from './regions';

/** 原生 bbox 初值（`v1[0]=9999; v1[1]=9999; v1[2]=0; v1[3]=0`） */
const BBOX_SENTINEL = 9999;

// 区域分裂（`0x58D620`，size=0xFAB）实现见 `regionSplit.ts`
// （2026-10-07 capstone 实机反汇编重写，修正了「洪泛只写 +0x3C」的关键错误）。
import { regionSplit as splitImpl } from './regionSplit';

// 兼容旧导入路径（测试与外部调用方）
export { splitImpl as regionSplit };

/**
 * 台地阈值 + 分裂（`0x58EBC0`）。
 *
 * @param thresholdScale 阈值缩放 `dword_ABE048`（原生全局）。
 *                       `null` ⇒ 走缺省 0（此时阈值 = `0.05·W·H·2`）。
 */
export function regionPlateauThreshold(
  ctx: WaterContext,
  rs: RegionState,
  thresholdScale: number | null = null,
): number {
  const { cells, scratch } = ctx;

  // ── 1. 重置所有区域 ──
  for (const region of rs.regions) {
    region.cells.length = 0;
    region.cellCount = 0;
    region.bbox = [BBOX_SENTINEL, BBOX_SENTINEL, 0, 0];
  }

  // ── 2. 倒序遍历全图，累加各区域 ──
  // 原生从 `linear²−1` 递减 ⇒ 收集后 reverse() 等价。
  // 顺序会影响 `cells` 数组排列，阶段 13 起点选择会读它，故保持一致。
  const W = cells.mapW;
  const H = cells.mapH;
  const diamondMin = (ctx as unknown as { diamondMin?: number }).diamondMin ?? W;
  const diamondMax =
    (ctx as unknown as { diamondMax?: number }).diamondMax ?? W + 2 * H;

  const touched: Array<{ x: number; y: number; region: RmgRegion }> = [];
  for (const cell of cells.iterate()) {
    const [x, y] = coordOfCell(ctx, cell);
    const sum = x + y;
    if (
      !(sum > diamondMin && x - y < diamondMin && y - x < diamondMin && sum <= diamondMax)
    ) {
      continue;
    }
    // ⚠ regionId 存在 **scratch** 上（NativeCell 无此字段）——
    //   从 cell 上读恒为 undefined ⇒ 曾导致 cells 永不填充、分裂无从下手。
    const rid = scratch.at(x, y).regionId;
    const region = rid >= 0 && rid < rs.regions.length ? rs.regions[rid] : null;
    if (!region) continue;
    region.cellCount += 1;
    region.cells.push(((y & 0xffff) << 16) | (x & 0xffff));
    touched.push({ x, y, region });
  }
  touched.reverse();

  // ── 更新 bbox ──
  // 原生首格判定用 `*(region+72) == 0`（= bbox.w）；四个方向的扩张/收缩
  // 都要**先存旧值**再算（伪码 v16/v17/v18/v19 就是旧值暂存）。
  for (const region of rs.regions) {
    region.bbox = [BBOX_SENTINEL, BBOX_SENTINEL, 0, 0];
  }
  for (const { x, y, region } of touched) {
    const b = region.bbox;
    if (b[2] === 0) {
      b[0] = x;
      b[1] = y;
      b[2] = 1;
      b[3] = 1;
      continue;
    }
    if (x >= b[0] + b[2]) b[2] = x - b[0] + 1;
    if (x < b[0]) {
      const oldX0 = b[0];
      const oldW = b[2];
      b[0] = x;
      b[2] = oldX0 - x + oldW;
    }
    if (y >= b[1] + b[3]) b[3] = y - b[1] + 1;
    if (y < b[1]) {
      const oldY0 = b[1];
      const oldH = b[3];
      b[1] = y;
      b[3] = oldY0 - y + oldH;
    }
  }

  // ── 3. 阈值 ──
  const scale = thresholdScale ?? 0;
  const v21 = chopMul(chopMul(chopAdd(chopMul(scale, 0.005), 0.05), W), H);
  const threshold = chopAdd(v21, v21) | 0; // 原生 sub_7C5F00 = 向零截断

  // ── 4. 逐区域：小的标记保留，大的尝试分裂 ──
  let splitTried = 0;
  for (let j = 0; j < rs.regions.length; ) {
    const region = rs.regions[j];
    if (region.finalised === 0 && region.water === 0) {
      if (region.cellCount <= threshold) {
        region.finalised = 1;
        j += 1;
        continue;
      }
      splitTried += 1;
      if (splitImpl(ctx, region, rs) !== 0) {
        // 原生：分裂成功 ⇒ 从全局表移除（数组前移 + count--）
        rs.regions.splice(j, 1);
        continue;
      }
    }
    j += 1;
  }
  return splitTried;
}
