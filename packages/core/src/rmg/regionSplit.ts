/**
 * 区域分裂（`0x0058D620`，size=0xFAB）—— 依据 2026-10-07 capstone 实机反汇编。
 *
 * ⚠ **这是第二次重写**（第一版把区域造到 31 504 个，因漏了 `+0x38 = -3`）。
 * 本版逐条对照实测汇编，修正三处关键语义。
 *
 * 【实测到的关键事实】
 * ① 守卫：`mov al,[ebx+0x1A]; test al,al` ⇒ `finalised != 0` 直接 `return 0`
 *    （`0x58D648`，即伪码头部 `size=0x28` 那个 `ret` —— **早退路径**，
 *      所以"扫到第一个 ret 得 0x28"是错的，真实长度是 0xFAB）
 *
 * ② **洪泛写的是 `+0x38`，不是只写 `+0x3C`**：
 * ```asm
 * 0x58D72F  mov [eax+edx+0x38], 0xFFFFFFFE   ; −2 = 本区域待分裂
 * 0x58D830  mov [eax+ecx+0x3C], 0xFFFFFFFD   ; −3 = 抢占标记（种子）
 * 0x58D920  mov [eax+edx+0x38], 0xFFFFFFFD   ; −3 = 抢占标记（**也写 +0x38**）
 * 0x58DA5B  mov [eax+ecx+0x3C], 0xFFFFFFFD
 * ```
 * ⇒ **抢占过的格 `regionId` 变成 −3**，而建区只收 `regionId == -2`
 *   （实测 `0x58DCA8: cmp eax,-1; jge skip` ⇒ `>= -1` 跳过，`-2` 才建区）。
 * ⇒ 洪泛吃掉多少格就少建多少区 —— **这正是"成区单位数"的来源**。
 *   第一版只标 `+0x38 = -2`、洪泛时只改 `patchId(+0x3C)`，
 *   于是洪泛过的格**仍是 −2** ⇒ 全部建区 ⇒ **31 504 个**。
 *
 * ③ **没有配额除法**：capstone 扫全函数 **1 249 条指令**，
 *   `imul` 全部是 ×`0x89C2DC`（菱形索引换算），**无任何配额乘/除法**
 *   ⇒ 伪码里的 `cellCount/3`、`cellCount/8` 是编译器产物，**不是真实配额**。
 *   成区数量完全由洪泛抢占范围决定。
 *
 * 【建区段（实测，`0x58DC7D`）】
 * ```asm
 * for (edx = …; edx >= 0; edx--) {              // 0x58DF7A: dec edx; jns 0x58DC83
 *     packed = region.cells[edx];                // [ebx+0x2C] 向量
 *     idx    = packed.x + packed.y * 0x89C2DC;   // 菱形索引
 *     if (cell[idx].regionId >= -1) continue;    // 只有 == -2 才继续
 *     child  = new Region(packed);               // call 0x58BF70
 *     cell[idx].regionId = child.id;
 * }
 * ```
 *
 * 【标记语义汇总（80 字节 cell 结构体偏移）】
 *   `+0x38` regionId：`-1` 未认领 / `-2` 本区域待分裂 / `-3` 洪泛抢占 / `>=0` 区域 id
 *   `+0x3C` 抢占辅助标记：`-3` 已入队
 *   `+0x44` 生长就绪标记
 *
 * 【★ 台地抬升（`0x58D620` 尾部，2026-10-09 补齐）】
 * 这是 **MT3/4 Level 双峰（真机主峰 4、次峰 8）的唯一来源** —— 真机
 * RandMap1 的 level 8/9/10 共 15 572 格（占 47.8%）全是它抬出来的。
 *
 * 区域自带 **`+0x10` = 台地高度**（本仓 `RmgRegion.level`），与 cell 的
 * `+283` 渲染高度是两回事。分裂收尾按区域大小分两路：
 *
 * ```
 *   邻区（merged==0）高度 min=v101 / max=v102
 *   if (v102 != v101) {                       // 邻区不等高
 *     if (v102-v101 == 4) cand.push(v102);
 *     else if (v102-v101 == 8) cand.push((v101+v102)/2);   // 取中值
 *   } else {                                  // 邻区全等高
 *     if (v101 >= 4) cand.push(v101 - 4);
 *     if (v102 <= 7) cand.push(v102 + 4);
 *   }
 *   if (mapType == 3 || mapType == 4) 删除 cand 里值为 0 的项
 *
 *   if (cellCount > 100) {            // ★ 大区域：随机择一
 *     pick = cand[randInt(jj)];  Δ = pick - region.level;  region.level = pick;
 *     for (cell : 本区域) cell.level += Δ;
 *   } else if (最大邻区存在) {        // 小区域：跟随 cellCount 最大的邻区
 *     Δ = big.level - region.level;   region.level = big.level;
 *     for (cell : 本区域) cell.level += Δ;
 *     region.merged = 1;              // 并把格并给 big（本仓未做合并）
 *   }
 * ```
 *
 * ⚠ 初值全部是 4：首次分裂时邻区等高 ⇒ 候选 = `4-4=0`（MT3/4 删掉）
 * 与 `4+4=8` ⇒ **只剩 8** ⇒ 大区域被抬到 level 8。这正解释真机的 4/8 双峰。
 */

import { DIRECTION_OFFSETS } from './cell';
import { cellAtD } from './water';
import { createRegionState, regionCtor } from './regions';
import type { WaterContext } from './water';
import type { RegionState, RmgRegion } from './regions';

/** 菱形带四条不等式 */
function inDiamond(x: number, y: number, dMin: number, dMax: number): boolean {
  const sum = x + y;
  return sum > dMin && x - y < dMin && y - x < dMin && sum <= dMax;
}

/** 区域分裂结果（供测试与诊断） */
export interface SplitResult {
  /** 是否分裂成功（原生 `return 1`） */
  ok: boolean;
  /** 洪泛抢占的格数（被标 `+0x38 = -3`） */
  grabbed: number;
  /** 新建的区域数 */
  created: number;
  /** 台地抬升落地的格数（`0x58D620` 尾部；0 = 未抬升） */
  raised: number;
}

/** 区域分裂（`0x58D620`），返回原生语义的 0/1 */
export function regionSplit(
  ctx: WaterContext,
  region: RmgRegion,
  rs?: RegionState,
): number {
  return regionSplitDetailed(ctx, region, rs).ok ? 1 : 0;
}

/**
 * 区域分裂（带诊断信息）。
 *
 * 流程（逐条对照实测汇编）：
 *  1. `finalised != 0` ⇒ 返回 0
 *  2. 本区域所有格标 `regionId = -2`
 *  3. 随机种子标 `regionId = -3`，入优先队列
 *  4. **洪泛**：从队首取点，8 邻中「`regionId == -2` 且 TerrainTest 通过」的格
 *     标 `regionId = -3`（**关键**）并入队
 *  5. 建区：遍历 `region.cells`，对**仍为 `-2`** 的格各建一个新区域
 *     （被抢占的已是 `-3`，自然被排除 ⇒ 成区数 = 格数 − 抢占数）
 */
export function regionSplitDetailed(
  ctx: WaterContext,
  region: RmgRegion,
  rs?: RegionState,
): SplitResult {
  // ── 1. 守卫（实测 `mov al,[ebx+0x1A]; test al,al`）──
  if (region.finalised !== 0) return { ok: false, grabbed: 0, created: 0, raised: 0 };

  const { cells, theater, scratch } = ctx;
  const dMin = (ctx as unknown as { diamondMin?: number }).diamondMin ?? cells.mapW;
  const dMax =
    (ctx as unknown as { diamondMax?: number }).diamondMax ?? cells.mapW + 2 * cells.mapH;

  if (region.cells.length === 0) return { ok: false, grabbed: 0, created: 0, raised: 0 };

  // ── 2. 标 −2（实测 `0x58D72F: mov [eax+edx+0x38], 0xFFFFFFFE`）──
  const owned: Array<[number, number]> = [];
  for (const packed of region.cells) {
    const x = packed & 0xffff;
    const y = (packed >>> 16) & 0xffff;
    if (!inDiamond(x, y, dMin, dMax)) continue;
    if (!cellAtD(ctx, x, y)) continue;
    scratch.at(x, y).regionId = -2;
    owned.push([x, y]);
  }
  if (owned.length === 0) return { ok: false, grabbed: 0, created: 0, raised: 0 };

  // ── 3a. 洪泛配额（`0x58D620` 伪码 254-258 行）──
  // ```c
  // v19 = cellCount / 3;  v20 = cellCount / 8;
  // do { v172 = trunc(rand01 * (v19 - v20 + 1) + v20); } while (v172 > v19);
  // ```
  // ⇒ 配额 = `U[cellCount/8, cellCount/3]`，洪泛计数达标即 `break`
  // （主循环 `if ((int)n >= v172) break;`，伪码 314 行）。
  // ⚠ 旧注释断言「cellCount/3、cellCount/8 是编译器产物、不是真实配额」是**错的**
  //   —— 实测没有配额时洪泛吃光整个区域（RandMap1: grabbed=26463 / 仅剩 11 格），
  //   只剩一堆 1 格碎片，与真机完全不符。
  const v19 = Math.trunc(region.cellCount / 3);
  const v20 = Math.trunc(region.cellCount / 8);
  const span = v19 - v20 + 1;
  let quota = v20;
  for (let guard = 0; guard < 1000; guard++) {
    quota = Math.trunc(ctx.rng.nextUnit() * span) + v20;
    if (quota <= v19) break;
  }

  // ── 3. 随机种子（实测 `0x58D830` 写 +0x3C = −3）──
  const seedIdx = Math.trunc(ctx.rng.nextUnit() * region.cells.length);
  const seedPacked = region.cells[Math.min(seedIdx, region.cells.length - 1)];
  const seedX = seedPacked & 0xffff;
  const seedY = (seedPacked >>> 16) & 0xffff;
  const seedSlot = scratch.at(seedX, seedY);
  seedSlot.regionId = -2;
  seedSlot.patchId = -3;

  // 优先队列（按距离升序）
  const heap: Array<{ x: number; y: number; d: number }> = [
    { x: seedX, y: seedY, d: 0 },
  ];
  const push = (x: number, y: number, d: number): void => {
    heap.push({ x, y, d });
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].d <= heap[i].d) break;
      const t = heap[p];
      heap[p] = heap[i];
      heap[i] = t;
      i = p;
    }
  };
  const pop = (): { x: number; y: number; d: number } | null => {
    if (heap.length === 0) return null;
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l].d < heap[m].d) m = l;
        if (r < heap.length && heap[r].d < heap[m].d) m = r;
        if (m === i) break;
        const t = heap[m];
        heap[m] = heap[i];
        heap[i] = t;
        i = m;
      }
    }
    return top;
  };

  // ── 4. 洪泛：**抢占的格写 `regionId = -3`**（实测 `0x58D920`）──
  // ⚠ 这是第一版最大的错：只改 `patchId(+0x3C)` 而不动 `+0x38`，
  //    导致洪泛过的格仍是 `-2` ⇒ 全部被建区 ⇒ 区域爆炸到 31 504。
  let grabbed = 0;
  for (let iter = 0; iter < 60000; iter++) {
    // ★ 配额闸门（原生 `if ((int)n >= v172) break;`）—— 没有它洪泛会吃光整个区域
    if (grabbed >= quota) break;
    const cur = pop();
    if (!cur) break;
    for (let d = 0; d < 8; d++) {
      const off = DIRECTION_OFFSETS[d];
      const nx = cur.x + off[0];
      const ny = cur.y + off[1];
      if (!inDiamond(nx, ny, dMin, dMax)) continue;
      const cell = cellAtD(ctx, nx, ny);
      if (!cell) continue;
      const s = scratch.at(nx, ny);
      if (s.regionId !== -2) continue; // 只抢「本区域待分裂」的格
      const clear = theater.clearTile ?? 0;
      const growable = cell.tile === 0 || cell.tile === clear || cell.tile === theater.waterSet;
      if (!growable) continue;
      // 距离场（原生 `sub_58C6F0`，含抖动）
      // ⚠ `rng.next()` 是原始 uint32（~4e9），必须 `nextUnit()` 归一化，
      //    否则 `dist` 量级爆炸、优先队列退化成随机序。
      const dx = nx - seedX;
      const dy = ny - seedY;
      const dist = (dx * dx + dy * dy) / 8 + ctx.rng.nextUnit() * 4;
      s.regionId = -3; // ★ 关键：写 +0x38
      s.patchId = -3; // ★ 同时写 +0x3C（实测 0x58DA5B）
      grabbed += 1;
      push(nx, ny, dist);
      if (grabbed >= quota) break; // 配额达标立即停
    }
  }

  if (grabbed === 0) return { ok: false, grabbed: 0, created: 0, raised: 0 };

  // ── 5a. 台地抬升（`0x58D620` 尾部）──
  // ⚠ 必须在建区**之前**：`regionCtor` 用种子格的 `cell.level` 初始化子区
  //   `level`，先抬升 ⇒ 子区继承台地高度。
  if (process.env.RMG_SPLIT_DBG === '1') {
    let n2 = 0;
    let n3 = 0;
    for (const [x, y] of owned) {
      const v = scratch.at(x, y).regionId;
      if (v === -2) n2++;
      else if (v === -3) n3++;
    }
    console.log(
      `  [split] 区域#${region.id} 大小=${region.cellCount} owned=${owned.length} ` +
        `grabbed=${grabbed} (-2=${n2} / -3=${n3})`,
    );
  }
  // ── 5a. 台地抬升（`0x58D620` 尾部）──
  // ★ 抬升范围是**被洪泛抢占的那一块（-3）**，不是整个区域。
  //   真机实证：RandMap1 的 level 8 群只占大区域的 ~37%（9882/26474），
  //   若整个区域都抬升会得到 100%。抬升「抢占块」才形成 4/8 镶嵌台地。
  const grabCells = owned.filter(([x, y]) => scratch.at(x, y).regionId === -3);
  // ⚠ 邻区要按**整个原区域**的边界收集（抬升范围只取抢占块）：
  //   抢占块在区域内部，它的 8 邻全是同区域的格 ⇒ 找不到任何邻区。
  const raised = plateauRaise(ctx, region, owned, grabCells, dMin, dMax, rs);

  // ── 5. 建区 ──
  // ⚠ 不能「每个 -2 格建一个区」：配额只抢走 n/8..n/3，
  //   剩余上万格会各自成区（实测 22 996 个）⇒ 后续阶段全崩。
  //   原生靠 `regionCtor` 之后的洪泛把连通格吸进新区（后续遍历到时
  //   `regionId >= -1` 自然跳过）。本仓显式做**连通块聚合**。
  const table: RegionState = rs ?? createRegionState();
  let created = 0;
  for (const [x, y] of owned) {
    if (scratch.at(x, y).regionId !== -2) continue;
    const child = regionCtor(ctx, table, (y << 16) | x);
    child.finalised = 0;
    child.merged = 0;
    // 聚合：BFS 吸收连通的 -2 格
    // ⚠ 必须同步 `cellCount`：`regionCtor` 初值是 0，
    //    阶段 7 的阈值判定 `cellCount <= threshold` 会把它当小区域直接
    //    `finalised = 1` ⇒ 大块不再继续分裂（实测只分裂 1 轮）。
    const stack: Array<[number, number]> = [[x, y]];
    scratch.at(x, y).regionId = child.id;
    // ⚠ 必须同时填 `cells`：`regionCtor` 给的是空数组，
    //    而下一轮分裂（以及阶段 7 的重统计）依赖 `region.cells` 定位本区格子；
    //    空 ⇒ `owned.length === 0` ⇒ 二次分裂直接失败（实测只分裂 1 轮）。
    child.cells = [(y << 16) | x];
    let cnt = 1;
    while (stack.length > 0) {
      const [cx, cy] = stack.pop() as [number, number];
      for (let d = 0; d < 8; d++) {
        const off = DIRECTION_OFFSETS[d];
        const nx = cx + off[0];
        const ny = cy + off[1];
        if (!inDiamond(nx, ny, dMin, dMax)) continue;
        const ns = scratch.at(nx, ny);
        if (ns.regionId !== -2) continue;
        ns.regionId = child.id;
        stack.push([nx, ny]);
        child.cells.push((ny << 16) | nx);
        cnt += 1;
      }
    }
    child.cellCount = cnt;
    created += 1;
  }
  // ── 5b. 被抢占的块也要有归属：整块建一个区（继承抬升后的 level）──
  if (grabCells.length > 0) {
    const [gx, gy] = grabCells[0];
    const top = regionCtor(ctx, table, (gy << 16) | gx);
    top.finalised = 0;
    top.merged = 0;
    top.cellCount = grabCells.length;
    top.cells = grabCells.map(([x, y]) => (y << 16) | x);
    for (const [x, y] of grabCells) scratch.at(x, y).regionId = top.id;
    created += 1;
  }
  if (rs && created > 0) {
    for (const r of table.regions) {
      if (!rs.regions.includes(r)) rs.regions.push(r);
    }
  }
  return { ok: created > 0, grabbed, created, raised };
}

/**
 * 台地抬升（`0x58D620` 尾部两个分支）。
 *
 * @returns 实际抬升的格数（0 = 未抬升）
 */
function plateauRaise(
  ctx: WaterContext,
  region: RmgRegion,
  owned: Array<[number, number]>,
  raiseCells: Array<[number, number]>,
  dMin: number,
  dMax: number,
  rs?: RegionState,
): number {
  const { scratch } = ctx;

  // ── 邻区收集：本区域格的 8 邻中 `regionId >= 0` 且非本区的区域 ──
  // 原生从 `dword_ABDF94` 全局区域表 + `n[v98]=1` 邻接标记得到，
  // 本仓直接扫 8 邻（等价，且不受全局表顺序影响）。
  const neighIds = new Set<number>();
  for (const [x, y] of owned) {
    for (let d = 0; d < 8; d++) {
      const off = DIRECTION_OFFSETS[d];
      const nx = x + off[0];
      const ny = y + off[1];
      if (!inDiamond(nx, ny, dMin, dMax)) continue;
      const rid = scratch.at(nx, ny).regionId;
      if (rid >= 0 && rid !== region.id) neighIds.add(rid);
    }
  }
  const pool: RmgRegion[] = rs ? rs.regions : [];
  let v101 = -1;
  let v102 = -1;
  let big: RmgRegion | null = null;
  let bigCount = -1;
  for (const id of neighIds) {
    const r = pool.find((q) => q.id === id);
    if (!r) continue;
    if (r.merged !== 0) continue; // 原生 `*(_BYTE*)(v105+36) == 0`
    const lv = r.level;
    if (v101 === -1 || lv < v101) v101 = lv;
    if (v102 === -1 || lv > v102) v102 = lv;
    // 最大邻区（原生 `v146`）：cellCount 最大 **且** water == 0（+0x14）
    if (r.water === 0 && r.cellCount > bigCount) {
      bigCount = r.cellCount;
      big = r;
    }
  }
  if (v101 === -1) return 0; // 无邻区 ⇒ 原生 `v146 == 0`，不抬升

  // ── 候选高度（原生 `v148` / `jj`，`MapGenMakingSub.cpp:687-697`）──
  //
  // ⚠ 结构必须逐字对齐：`span == 8` 是**独占**分支（只推中值，直接跳出）；
  //   `else` 内部是**三个独立 if** —— `span == 4` 推 `maxLevel` 之后
  //   **仍继续**试 `minLevel - 4` 与 `maxLevel + 4`，三者是叠加关系。
  //   误写成 `else if (span === 4)` 会让 span==4 时只剩 {maxLevel} 一个候选，
  //   真机 level 3..10 里的 8 就永远产不出来（RandMap5 实测：
  //   互斥版 Level 17 档 0..16、凭空多出真机没有的 0/1/2 与 11~16）。
  const cand: number[] = [];
  const span = v102 - v101;
  if (span === 8) {
    cand.push((v101 + v102) >> 1);
  } else {
    if (span === 4) cand.push(v102);
    if (v101 >= 4) cand.push(v101 - 4);
    if (v102 <= 7) cand.push(v102 + 4);
  }
  // MT3/4 特判：删除候选里的 0（原生 `if (dword_ABE014==3||==4)` 反序剔除）
  if (ctx.mapType === 3 || ctx.mapType === 4) {
    for (let i = cand.length - 1; i >= 0; i--) {
      if (cand[i] === 0) cand.splice(i, 1);
    }
  }

  let newLevel: number;
  let mergeInto: RmgRegion | null = null;
  if (region.cellCount > 100) {
    // ★ 大区域（>100 格）：从候选里随机择一（原生 `0x58e343`）
    if (cand.length === 0) return 0;
    let pick = 0;
    for (let guard = 0; guard < 1000; guard++) {
      pick = Math.trunc(ctx.rng.nextUnit() * cand.length);
      if (pick <= cand.length - 1) break;
    }
    newLevel = cand[Math.min(pick, cand.length - 1)];
  } else {
    // ★ 小区域（≤100 格）：**并入最大邻区**，本区不再是独立台地
    //   （原生 `0x58e40a` SPLIT-MERGE）
    if (!big) return 0;
    newLevel = big.level;
    region.merged = 1;
    mergeInto = big;
  }

  if (process.env.RMG_SPLIT_DBG === '1') {
    console.log(
      `  [split] 区域#${region.id} 大小=${region.cellCount} lv=${region.level} ` +
        `邻区min=${v101} max=${v102} span=${span} cand=[${cand.join(',')}] ` +
        `→ newLv=${newLevel} big=${big ? big.id + '/' + big.level : 'null'}` +
        (mergeInto ? ' MERGE' : ''),
    );
  }
  // ── 落地：只抬**被洪泛抢占的那一块**（`raiseCells` = `regionId === -3`）──
  //
  // ⚠ 范围必须是 `raiseCells` **独占**，不能并上 `owned`：
  //   真机实证 RandMap1 的 level 8 群只占大区域的 ~37%（9882/26474），
  //   整个区域都抬会得到 100%，而且多轮分裂后 level 一层层叠加
  //   ⇒ 冒出真机根本不存在的 0/1/2 与 11~16 档（实测 Level 17 档 0..16）。
  //   `delta === 0` 时也要照常返回 0，不进下面的循环。
  const delta = newLevel - region.level;
  region.level = newLevel;
  let n = 0;
  if (delta !== 0) {
    for (const [x, y] of raiseCells) {
      const cell = cellAtD(ctx, x, y);
      if (!cell) continue;
      cell.level = (cell.level + delta) & 0xff;
      n += 1;
    }
  }

  // ── 合并记账（原生 `0x58e410`：`nr->cells` 并入 `best`、`cellCount` 累加、
  //   `nr->consumed = 1`）──
  //
  // ⚠ **只搬 `cells` 列表与计数，不改写格子的 `regionId`**（实测两种做法的差别：
  //   - 不改 id：Level 档 8 档(3..10)，level4=22854（真机 13914），cliff=810 ✅
  //   - 改 id  ：Level 档 **17** 档(0..16)，凭空多出 0/1/2 与 11~16（真机都没有）
  //     —— `cellCount` 累加会把下一轮的「≤100 小区」判定翻成「大区」，
  //        那些格子于是又被随机抬一次，level 一层层往上叠。
  //   ⇒ 原生 `data[14] = best.id` 那一步是给**后续轮次**用的；
  //     在本仓「标记 -2/-3 晚于 plateauRaise 才转真实 id」的时序下改写会自伤。
  //   真正缺的那一半（重复抬升的根因）是原生 `consumed` 一次性语义，
  //   由 `merged` 标记 + 不累加 cellCount 来保持。
  if (mergeInto) {
    mergeInto.cells.push(...region.cells);
    region.cells.length = 0;
  }
  return n;
}