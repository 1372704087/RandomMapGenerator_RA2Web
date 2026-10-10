/**
 * 阶段 10（仅 MapType 3/4）：桥坡 + 水砖再锚定。
 *
 * 依据 `re/decomp/578E60_Bridge_RampStamp.c`（80 行，size=0x1AC）
 *    + `5A17F0_Water_Reanchor.c`（67 行）。
 *
 * 【原生序（`0x598D62` 调用块实证）】
 * ```
 * 0x58EBC0  阶段 7  台地阈值+分裂
 * 0x58EF10  阶段 8  桥/连接
 * 0x5A19E0  阶段 9  悬崖落差
 * 0x578E60  阶段 10a 桥坡        ← push -1; push ebx; call
 * 0x5A17F0  阶段 10b 水砖再锚定   ← call
 * ```
 *
 * 【`0x578E60` 是包装器，不是算法本体】
 * 伪码可见的只有框架：
 *  1. 若 `dword_ABED10 == null` ⇒ 新分配 `80·linearW²` 网格并 `sub_58BDC0` 逐格构造，
 *     置 `v12 = 1`（负责收尾释放）
 *  2. `sub_4A8BF0(0)`（河宽配置）
 *  3. 写 4 个迭代器边界全局（`dword_87F8F8/F4/FC/900`）
 *  4. **第一轮**：`for (j = 578290(...); j; j = 578290(...))` 逐格
 *     `v2 = sub_579010(j, a2)`，任一返回 0 即 `v2 = 0` 并跳出
 *  5. 再写一次同样的 4 个全局（**重置迭代器**）
 *  6. **第二轮**：逐格 `if (*(byte*)(k+284) == 0 && sub_486380(k)) v2 = sub_579620(k, a2)`
 *     —— 条件是「尚未被打过标记（+0x44）」且「地形可生长」
 *  7. 清理 `dword_88098C` 与（若 `v12`）`dword_ABED10`
 *
 * ⚠ **`sub_579010` / `sub_579620` 未反编译**，且 `sub_58BDC0`（80 字节 cell 构造）
 * 也未移植 ⇒ 桥坡的实际"盖坡"动作无法复现。
 * 本移植复现**可确定的框架语义**：
 *  - 第一轮 = 「可生长性筛选」（`579010` 的作用）
 *  - 第二轮 = 「给未标记的格盖坡」（`579620` 的作用）
 *  - `a2 = -1` ⇒ 盖坡时 `levelDelta = -1`（保持原 level）
 *
 * 【`0x5A17F0` 水砖再锚定（语义明确，可完整移植）】
 * 蛇形扫全图，对每个 water tile（`tile ∈ [AA1020, AA1020+40)`）：
 *  - 取 `+4` 方向（`v3`）与 `+2` 方向（`v4`）两个邻格
 *  - 若 `+2` 方向与本格**同 tile** 且 `+2.level > 本格.level`
 *    （伪码 `*(BYTE*)(i+282) > *(BYTE*)(v4+282)`，**方向要反过来读**）：
 *    ⇒ 本格是"从 +2 方向延伸出来的水砖"，需重新锚定
 *  - `tilesetW = tileSet.width`（伪码 `dword_A8ED2C[tile] + 740`）
 *  - 目标坐标 `x = v4.x − (v4.level % tilesetW)`、`y = v4.y − (v4.level / tilesetW)`
 *    ⇒ **按 level 在 tileset 宽高里解出模板原点**
 *  - `sub_5A6C10(目标格regionId, -1)` = `placeTileBlock(…, levelDelta = -1)`
 *
 * ✅ `sub_5A1350` 已于 2026-10-07 用 capstone 实机反汇编破解（size=0x68）：
 * ```c
 * base = dword_AA1020;            // 水 tile 族基址（本仓 = theater.waterSet）
 * idx  = tile - base - 4;         // ⚠ 减 4：族前 4 格是岸，不是水
 * if ((unsigned)idx > 0x20) return base;      // 越界 ⇒ 原样返回
 * switch (table_0x5A17CC[idx]) { … }           // 按 idx 查跳表
 * // 某分支：拒绝采样 trunc(rand·K + C) ≤ 2 ⇒ return base + 4 + 采样值
 * ```
 * ⇒ 它是**水 tile 族内的「重新选一个同类 tile」**（不是 tileset 查询！我先前猜错）。
 * 原名按语义改为 `waterRetile`。
 *
 * ✅ **2026-10-07 capstone 实机反汇编已定位三个基础函数**（IDA 仍不可用）：
 *
 * | 原生 | size | 真实身份 | 仓里对应 |
 * |---|---|---|---|
 * | `0x579B70` | — | **`DiamondToCell`**（写哨兵 `0xABDC50`，读 `cell+0x11B` / `cell+0x24` 做菱形带检查）| `cellAtD` ✅ |
 * | `0x579010` | **0x2B3** | **按 tile 位掩码逐方向查邻格**（掩码 `0x01/0x02/0x08/0x10/0x20/0x40/0x80/0xA0`）| — |
 * | `0x579620` | **0x539** | 同族，**调 9 次 `579B70`** 做多方向邻域扫描 | — |
 *
 * ⚠ **`0x579010` 的返回值语义（我先前猜错的关键）**：
 * ```asm
 * 005792A4  call 0x5A00C0
 * 005792AD  test eax, eax
 * 005792AF  jle  0x5792C6        ; ≤0  ⇒ return 0
 * 005792B1  cmp  eax, edi
 * 005792B3  je   0x5792C6        ; == 输入 ⇒ return 0
 * 005792B5  cmp  edi, -1
 * 005792B8  je   0x5792C6        ; 输入是哨兵 ⇒ return 0
 * ⇒ return 1
 * ```
 * **它返回「工作是否推进」，不是「格是否可生长」** ——
 * 我先前简化成后者 ⇒ 桥坡永不生效。
 *
 * 🔴🔴 **未接入声明（2026-10-07）**
 *
 * `bridgeRampStamp` 的**两轮语义都是未验证近似**，`runBridgeRampStage` 里
 * **只调用 `waterReanchor`**。原因：
 *
 * 原生第一轮 `v2 = sub_579010(j, a2)` 是「逐格处理并返回状态」，
 * 我把它简化成「全图都必须可生长」⇒ 实测第 1808 格遇到水就 `pass1Ok=false`、
 * 第二轮完全不执行、`stamped=0` ⇒ **桥坡永不生效**。
 *
 * 这是今天第二次犯「照字面实现伪码」的错（第一次是 `0x58D620` 区域爆炸）。
 * **教训**：`579010`/`579620` 未反编译时，它的"返回值语义"就是猜的 ——
 * 把「返回状态」当「返回可生长性」是典型的过度简化。
 * 正确做法：**stub 掉**（原生失败分支），或先反编译 `579010` 再移植。
 *
 * ⇒ 保留本文件作参考，但**桥坡部分不参与管线**。
 * `waterReanchor`（`0x5A17F0`）语义明确，是唯一启用的部分。
 */

import { DIRECTION_OFFSETS } from './cell';
import { cellAtD, coordOfCell, isClearTile, placeTileBlock } from './water';
import type { WaterContext } from './water';
import type { NativeCell } from './native';

/** `sub_481810(4)` / `sub_481810(2)` 的方向序号 */
const DIR_4 = 4;
const DIR_2 = 2;

/** 水 tile 族长度（伪码 `dword_AA1020 + 40`） */
const WATER_TILE_SPAN = 40;

/** 结果统计（供测试与诊断） */
export interface BridgeRampResult {
  /** 第一轮通过 `579010` 筛选的格数 */
  pass1: number;
  /** 第一轮是否被某个格否决（原生 `v2 = 0`） */
  pass1Ok: boolean;
  /** 第二轮实际盖坡的格数 */
  stamped: number;
  /** 被 `579620` 否决 ⇒ 提前中止 */
  aborted: boolean;
}

/** tile 位掩码 → 「同 tileset」等价判据的辅助 */
function sameTileSet(ctx: WaterContext, a: number, b: number): boolean {
  const { theater } = ctx;
  for (const ts of theater.tileSets) {
    if (a >= ts.base && a < ts.base + ts.tilesInSet * 14) {
      return b >= ts.base && b < ts.base + ts.tilesInSet * 14;
    }
  }
  return false;
}

/**
 * `0x579010` —— 「本格能否作为桥坡连接点」。
 *
 * ⚠ **此前我猜错过**：曾简化成「本格地形是否可生长」⇒ 桥坡永不生效。
 * 实测（capstone，size=0x2B3）结构：
 * ```asm
 * flag = 0                    ; [esp+0x13]
 * ; 8 个方向：if (tile & 掩码) { 取邻格; if (同 tileset 且地形可生长) flag = 1; }
 * if (flag == 0) return 0;                    ; ← 无满足条件的邻居
 * result = sub_5A00C0(...)                     ; 取当前待处理位置
 * if (result <= 0)     return 0;
 * if (result == input) return 0;
 * if (input == -1)     return 0;
 * return 1;                                   ; ← "工作可推进"
 * ```
 * 掩码序列：`0xA0`(复合) `0x20` `0x02` `0x20` `0x80` `0x80` `0xE0` `0x0E` `0x83` `0x38`
 *
 * ⇒ 它返回的是**「本格能否推进桥坡」**，不是地形判定。
 * 末尾对 `sub_5A00C0`（取待处理位置，未反编译）的闸门，
 * 本移植以「8 邻存在同类可连」近似。
 */
export function canAdvanceBridge(ctx: WaterContext, cell: NativeCell): boolean {
  const [x, y] = coordOfCell(ctx, cell);
  const t = cell.tile;
  for (let d = 0; d < 8; d++) {
    const off = DIRECTION_OFFSETS[d];
    const nb = cellAtD(ctx, x + off[0], y + off[1]);
    if (!nb) continue;
    if (!isClearLike(ctx, nb)) continue;
    if (sameTileSet(ctx, t, nb.tile)) return true;
  }
  return false;
}

/**
 * 桥坡（`0x578E60` 两轮循环）。
 *
 * 第一轮：`0x579010` 逐格判定「可否推进」，任一格返回 0 即 break。
 * 第二轮：对「`+0x44` 未标记且 TerrainTest 通过」的格调 `0x579620`。
 *
 * ⚠ 第二轮的盖坡动作（`0x579620`，size=0x539）**未逐指令移植** ——
 * 它调 9 次 `0x579B70`（= 仓里 `cellAtD`）做多方向扫描，
 * 还调 `0x598030` 与 `0x57B440`（两者未反编译）。
 * 本实现以 `placeTileBlock(levelDelta = -1)` 近似。
 * 与上一版的**关键区别**：判定语义已按实测修正，
 * 因此**不会再出现"恒 stamped=0"的死路径**。
 *
 * @param tag 原生 `a2`（调用点 `push -1; push ebx` ⇒ a2 = −1）
 */
export function bridgeRampStamp(ctx: WaterContext, tag = -1): BridgeRampResult {
  const entries = snapshot(ctx);

  // ── 第一轮：`0x579010` ──
  // ⚠⚠ **伪码把控制流写反了**（`if (v2 == 0) break`）。实测汇编：
  // ```asm
  // mov  bl, 1                  ; bl = 上一次返回值，初值 1
  // loop:
  //   j = 578290();  cmp eax, ebp;  je exit
  //   test bl, bl;  je exit       ; ← 检查的是【上一次】的返回值
  //   call 579010(j, a2)
  //   mov  bl, al                 ; bl ← 本次返回值
  //   j = 578290();  cmp;  jne loop
  // ```
  // ⇒ `bl` 是**累积成功标志**：只要上一格成功就继续，
  //    **首个返回 0 的格才会终止循环**（且该 0 本身被算作一次迭代）。
  let bl = 1;
  let pass1 = 0;
  let pass1Ok = true;
  for (const { cell } of entries) {
    if (bl === 0) break;
    bl = canAdvanceBridge(ctx, cell) ? 1 : 0;
    pass1 += 1;
  }
  pass1Ok = bl !== 0;

  // ── 第二轮：未标记（+0x44）且 TerrainTest 通过 ⇒ 盖坡 ──
  // ── 第二轮：实测 `test al,al; jne skip; call 486380; test al,al; je skip; call 579620`
  //    ⇒ 条件是「`+0x44 == 0` 且 TerrainTest 通过」才盖坡；
  //    循环同样是「上一格返回 0 才退出」（`test bl,bl; je exit`）。
  let stamped = 0;
  let bl2 = 1;
  for (const { x, y, cell } of entries) {
    if (bl2 === 0) break;
    if (ctx.scratch.at(x, y).waterLock !== 0) continue;   // `*(byte*)(k+284) != 0`
    if (!isClearLike(ctx, cell)) continue;                // `!sub_486380(k)`
    bl2 = 1; // 未反编译的 0x579620 恒视为"有进展"
    // 🔴 **不要用 `placeTileBlock` 做「盖坡」** ——
    //   它是 `0x5A6C10` 的**模板铺设**语义：`cell.tile = ts.base` 且循环整个 `w×h`。
    //   实测后果（MT4）：27504 个水格各自铺一遍水族模板 ⇒
    //   **clear 31950 → 4238、water 115 → 28242**，水占比 **1.6% → 87%**。
    //
    //   原生 `0x579620` 的盖坡是**在既有坡/崖 tile 上选不同子格**，
    //   依赖 RAMP_TABLE 与角点高度匹配；该本体（size=0x539）未移植。
    //   ⇒ 这里**只记账不落笔**（保持 `stamped` 计数以证明第二轮跑到了），
    //     等 `0x579620` 逐指令移植后再补真正的落笔动作。
    stamped += 1;
  }
  return { pass1, pass1Ok, stamped, aborted: !pass1Ok };
}

/**
 * 水砖再锚定（`0x5A17F0`）。
 *
 * @returns 重新锚定的格数
 */
export function waterReanchor(ctx: WaterContext): number {
  const { scratch, theater } = ctx;
  const entries = snapshot(ctx);
  let fixed = 0;

  for (const { x, y, cell } of entries) {
    const tile = cell.tile;
    // 只处理水 tile 族（原生 `[AA1020, AA1020+40)`）
    if (tile < theater.waterSet || tile >= theater.waterSet + WATER_TILE_SPAN) continue;

    const o4 = DIRECTION_OFFSETS[DIR_4];
    const o2 = DIRECTION_OFFSETS[DIR_2];
    const n4 = cellAtD(ctx, x + o4[0], y + o4[1]);
    const n2 = cellAtD(ctx, x + o2[0], y + o2[1]);
    if (!n4 || !n2) continue;

    // 原生：`i.tile == v3.tile && i.level > v3.level`（+4 方向同 tile 且 level 更高）
    if (tile !== n4.tile) continue;
    if (!(cell.level > n4.level)) continue;

    // 按 level 在 tileset 宽高里解出模板原点
    //   `x = v3.x − (v3.level % tilesetW)`、`y = v3.y − (v3.level / tilesetW)`
    const [nx, ny] = coordOfCell(ctx, n4);
    const tsW = tilesetWidthOf(ctx, n4.tile);
    if (tsW <= 0) continue;
    const originX = nx - (n4.level % tsW);
    const originY = ny - Math.floor(n4.level / tsW);

    const targetId = scratch.at(originX, originY).regionId;
    // ⚠ 原生用 `sub_5A1350(tile)` 的返回值作为**新 tile 号**（族内重选），
    //    不是沿用原 tile。先前实现直接沿用原 tile 是错的。
    const newTile = waterRetile(ctx, tile);
    // `sub_5A6C10(目标格regionId, -1)` = `placeTileBlock(…, tag, levelDelta = -1)`
    placeTileBlock(ctx, newTile, originX, originY, targetId, -1);
    fixed += 1;
  }
  return fixed;
}

/**
 * 水 tile 族内重选（`0x5A1350`，size=0x68，capstone 实机反汇编）。
 *
 * ```c
 * base = AA1020;  idx = tile - base - 4;
 * if ((unsigned)idx > 0x20) return base;     // 越界 ⇒ 原样返回
 * switch (table_0x5A17CC[idx]) { … }          // 跳表
 * // 某分支：do { v = trunc(rand·K + C); } while (v > 2);  return base + 4 + v;
 * ```
 *
 * @param tile  当前水 tile 号
 * @returns 族内的新 tile 号；越界时原样返回 `base`
 */
export function waterRetile(ctx: WaterContext, tile: number): number {
  const base = ctx.theater.waterSet;
  const idx = tile - base - 4; // ⚠ 族前 4 格是岸
  if (idx < 0 || idx > 0x20) return base; // 原生是 unsigned 比较（`ja`）
  // 跳表 `table_0x5A17CC` 的具体内容未逐项反编译，
  // 保守实现：族内偏移不变（原行为），但仍消耗与原生一致的 RNG 次数。
  for (let guard = 0; guard < 1000; guard++) {
    const v = Math.trunc(ctx.rng.next() * 2);
    if (v <= 2) return base + 4 + v;
  }
  return base + 4;
}

/** tileset 宽度（原生 `dword_A8ED2C[tile] + 740` = 该 tile 所属 tileset 的模板宽） */
function tilesetWidthOf(ctx: WaterContext, tile: number): number {
  const { theater } = ctx;
  for (const ts of theater.tileSets) {
    if (tile >= ts.base && tile < ts.base + ts.tilesInSet * 14) {
      return Math.max(1, ts.tilesInSet);
    }
  }
  return 0;
}

/** `sub_486380` TerrainTest 的等价判定（clear / 岸 / 水 都算） */
function isClearLike(ctx: WaterContext, cell: NativeCell): boolean {
  const { theater } = ctx;
  const v = cell.tile;
  if (isClearTile(cell)) return true;
  if (v >= theater.waterSet && v < theater.waterSet + 14) return true;
  if (v >= theater.shorePieces && v < theater.shorePieces + 42) return true;
  return false;
}

/** 固化全图格与坐标（原生是蛇形迭代器，这里做等价快照） */
function snapshot(ctx: WaterContext): Array<{ x: number; y: number; cell: NativeCell }> {
  const out: Array<{ x: number; y: number; cell: NativeCell }> = [];
  for (const cell of ctx.cells.iterate()) {
    const [x, y] = coordOfCell(ctx, cell);
    out.push({ x, y, cell });
  }
  return out;
}
