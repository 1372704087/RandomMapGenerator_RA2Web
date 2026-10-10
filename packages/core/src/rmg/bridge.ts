/**
 * 阶段 8（仅 MapType 3/4）：桥 / 连接。
 *
 * 依据 `re/decomp/58EF10_Bridge_ConnectPass.c`（127 行，主入口）
 *    + `58F0C0_Bridge_Helper.c`（129 行，邻区收集）
 *    + `5905D0_Bridge_5x5Connect.c`（275 行，区域配对）。
 *
 * 【三个函数的分工（`0x58EF10` 的调用序）】
 *  1. `sub_4A8BF0(0)`：前置（RMGMD 河宽相关，全局配置）
 *  2. 蛇形扫全图 → `sub_579010(cell, -1)`，任一返回 0 即 `v15 = 0`
 *  3. 清全图 `+0x30`/`+0x34` 两字段为 -1
 *  4. 逆序 `sub_58C070(region)` 释放区域附属数据 + delete
 *  5. `dword_ABED14 = 0`（桥计数器归零）
 *  6. 全图扫 `regionId == -1` 的格 → `sub_5AC370` 成功则
 *     `sub_58C800(cell)` 并把返回结构的 `+0x1A` 清 0
 *  7. **仅当 `v15 != 0`**（步骤 2 全通过）：
 *     逐区域 `sub_58F0C0(region)` → 逐区域 `sub_5905D0(region)`
 *     → 逐区域清 `+0x04` 的次级结构
 *
 * 【`sub_58F0C0`（邻区收集）语义】
 *  - 对本区域的**每个边界格**取 8 邻（`dword_89F688` 方向表），
 *    菱形带内的邻格按其 `regionId` 置 `Block[rid] = 1`
 *  - 扫 `Block`，把 `!= 0 && != 本区域 id` 的收集进 `region.+0x04` 的 DynamicVector
 *    ⇒ **该向量 = 与本区域相邻的其他区域 id 列表**
 *  - 另计 `region.+0x0C = 全图属于本区域的格数`
 *
 * 【`sub_5905D0`（区域配对）语义】
 *  - `*(this+0x14) != 0` 分支：遍历本区域候选 id（B 区域），
 *    若 B 满足 `(候选数 > 1 || B.cellCount > 50) && B.+0x14 == 0`
 *    且 `B.+0x10 == A.+0x10` ⇒ 调 `sub_58F2C0(A, B)`（**未移植**）
 *  - `*(this+0x14) == 0` 分支：找 `B.cellCount > A.cellCount && B.+0x10 != A.+0x10`，
 *    按 RNG 概率（`dword_ABE044` 阈值 + 拒绝采样 1..2）决定是否配对
 *
 * 【未移植声明】
 *  - `sub_4A8BF0`：RMGMD 河宽配置（0 输入），跳过。
 *  - `sub_579010`：阶段 7 内的地形测试，阶段 7 拆分后此处改用 `isClearTile` 近似。
 *  - `sub_58C070` / `sub_58C800` / `sub_5AC370`：区域附属结构的分配/释放，
 *    本仓 `RmgRegion` 无对应堆结构，跳过（无副作用的清理）。
 *  - `sub_58F2C0`：**实际的连桥动作**（写 ramp/brick tile）。
 *    本移植**不写 tile**，只做区域配对记账 ⇒ 桥不会真的出现。
 *
 * ⚠ 因此本阶段当前的实际效果 = **统计每个区域相邻了哪些区域**
 * （填 `RmgRegion.neighbors` 与 `RmgRegion.cellCount`），
 * 为后续 `sub_58F2C0` 与阶段 9（悬崖落差）提供输入。
 */

import { DIRECTION_OFFSETS } from './cell';
import { coordOfCell, cellAtD, isClearTile } from './water';
import { boundaryCells } from './regions';
import type { WaterContext } from './water';
import type { RegionState, RmgRegion } from './regions';

/** 桥候选数的分界（原生 `*(int*)(region.+0x04+16) <= 1`） */
const CANDIDATE_MIN = 1;
/** 格数的分界（原生 `*(int*)(region+12) <= 50`） */
const CELLS_MIN = 50;
/**
 * 邻区收集（`0x58F0C0`）。
 *
 * 对本区域每个边界格取 8 邻，把带内邻格所属的 regionId 标记；
 * 再把「非本区域」的 id 收进 `region.neighbors`。
 * 同时统计全图属于本区域的格数写入 `region.cellCount`（原生 `+0x0C`）。
 */
export function bridgeCollectNeighbors(ctx: WaterContext, region: RmgRegion): void {
  const { cells } = ctx;
  region.neighbors = [];

  // Block：regionId → 是否被本区域边界格触及
  const block = new Map<number, boolean>();
  for (const packed of boundaryCells(ctx, region)) {
    const cx = packed & 0xffff;
    const cy = (packed >>> 16) & 0xffff;
    for (let d = 0; d < 8; d++) {
      const off = DIRECTION_OFFSETS[d];
      // ⚠ 不要对邻格调 `coordOfCell` —— 带外邻格会命中**共享哨兵**
      //   （`DiamondToCell` 语义），而 `coordOfCell` 对哨兵抛
      //   "cell 不在 playfield"。这里只读它的 regionId 即可。
      const nb = cellAtD(ctx, cx + off[0], cy + off[1]);
      if (!nb) continue;
      // regionId 存在 scratch 上（NativeCell 无此字段）
      const rid = ctx.scratch.at(cx + off[0], cy + off[1]).regionId;
      if (rid >= 0) block.set(rid, true);
    }
  }
  // 收进 neighbors（去重、保序）
  for (const rid of block.keys()) {
    if (rid !== region.id) region.neighbors.push(rid);
  }
  // 原生 +0x0C：全图属于本区域的格数
  let count = 0;
  for (const cell of cells.iterate()) {
    const [x, y] = coordOfCell(ctx, cell);
    if (ctx.scratch.at(x, y).regionId === region.id) count += 1;
  }
  region.cellCount = count;
}

/**
 * 区域配对（`0x5905D0`）。
 *
 * 逐个候选区域 B，按原生条件判断是否值得连桥：
 *   - `B.neighbors.length > 1 || B.cellCount > 50`
 *   - 且 `B` 未被处理过
 *   - 且 `B.merged(+0x10) === A.merged(+0x10)`（同一台地簇）
 * ⇒ 记入 `region.bridges`（连桥动作 `sub_58F2C0` **未移植**）。
 *
 * @returns 记录下来的连桥对数
 */
export function bridgePair5x5(ctx: WaterContext, region: RmgRegion): number {
  void ctx;
  region.bridges = [];
  let pairs = 0;
  for (const rid of region.neighbors ?? []) {
    const other = region.__all?.[rid];
    if (!other) continue;
    if (!((other.neighbors?.length ?? 0) > CANDIDATE_MIN || other.cellCount > CELLS_MIN)) continue;
    if (other.merged !== 0) continue;
    if (other.merged !== region.merged) continue;
    // 原生此处调 sub_58F2C0(A, B) —— 连桥动作未移植，只记账
    region.bridges.push(rid);
    pairs += 1;
  }
  return pairs;
}

/**
 * 桥 / 连接主入口（`0x58EF10`）。
 *
 * @returns 原生恒返回 1；本实现返回 1 保持签名一致。
 */
export function bridgeConnectPass(ctx: WaterContext, rs: RegionState): number {
  // 让区域能反查同表中的其他区域（伪码里是 `dword_ABDF94` 全局表线性搜索）
  for (const region of rs.regions) {
    (region as RmgRegion & { __all?: RmgRegion[] }).__all = rs.regions;
  }

  // 步骤 3：清全图两字段为 -1（本仓无对应字段 ⇒ 由各阶段重置）
  // 步骤 4：释放区域附属数据（本仓 RmgRegion 无堆结构 ⇒ 跳过）
  // 步骤 5：桥计数器归零
  // 步骤 6：regionId == -1 的格做补区（本仓无 58C800 附属结构 ⇒ 跳过）

  // 步骤 7：仅当 v15 != 0 才跑；本移植以「全图存在 clear 格」近似 v15
  let v15 = false;
  for (const cell of ctx.cells.iterate()) {
    if (isClearTile(cell)) {
      v15 = true;
      break;
    }
  }
  if (!v15) return 1;

  // 逐区域：邻区收集 → 5×5 配对
  for (const region of rs.regions) {
    bridgeCollectNeighbors(ctx, region);
  }
  for (const region of rs.regions) {
    bridgePair5x5(ctx, region);
  }
  // 步骤 7 末：清各区域次级结构（本仓无 ⇒ 跳过）
  return 1;
}
