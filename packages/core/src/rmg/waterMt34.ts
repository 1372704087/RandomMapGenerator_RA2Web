/**
 * MapType 3/4 水体驱动 —— 原生 `0x0059C580`（薄驱动）+ `0x0059C920`（湖生长）。
 *
 * 依据 `re/decomp/59C580_Water_Driver_mt34.c`（44 行）与
 *      `re/decomp/59C920_Water_GrowLake.c`（547 行）。
 *
 * 【为什么 3/4 型是独立路径】
 * 阶段 3 的水体入口由 mapType 分派（README 阶段表）：
 *   MapType 3/4 → `0x0059C580`（河切割 + 湖生长）
 *   其余 0/1/2 → `0x0059A6C0`（本文件 `waterBasic`）
 * `0x0059C580` 本身**很薄**（size=0xA3），只做两件事：
 *   ① 若 mapType∈{3,4} 且 `*(this+19) > 20`：最多 10 次调 `0x0059D510`（河切割），
 *      每次返回非 0 就 `++*(this+194)`（blob 计数器）并 break；
 *   ② 无条件最多 10 次调 `0x0059C920`（湖生长），返回非 0 就计数并 return。
 *
 * 【原生计数器 `this+194`】
 * 是 blob 标签计数器（与 `ctx.blobCounter` 同一语义，MapSeed+0x308）。
 * 湖生长里 `+0x3C` 位置的标号比较、blob 归属都依赖它，
 * 每次成功生长/切割都要 `++` —— 移植时必须维护，否则 blob 会互相覆盖。
 *
 * 【`this+19` / `this+96` / `this+97` / `this+193`】
 * 伪码按 dword 索引（`this` 是 `int*`）：
 *   `this+19`  = MapSeed+0x4C = **WaterAmount %**（`ctx.waterAmount`）
 *   `this+96`  = MapSeed+0x180 = Width（cell 口径）
 *   `this+97`  = MapSeed+0x184 = Height
 *   `this+193` = MapSeed+0x304 = 已用水面积累加（湖生长扣减项）
 *   `this+194` = MapSeed+0x308 = blob 标签计数器
 */

import { chopAdd, chopMul, chopSub, chopDiv, ftol, RANGE_K } from './x87';
import {
  coordOfCell,
  cellAtD,
  isClearTile,
  waterFinalize,
  shoreFinalize,
} from './water';
import { DIRECTION_OFFSETS } from './cell';
import type { WaterContext } from './water';

/** 伪码常量：湖生长的水位阈值（原生硬编码） */
const LAKE_MIN_POOL = 75;

/** 伪码常量：河切割的**最少段数**（`0x59D510` 的 `if (v81 < 40) v78 = 0`） */
const RIVER_MIN_SEGMENTS = 40;

/**
 * 湖生长（`0x0059C920`）—— 接受-拒绝采样 + 优先队列 blob 洪泛。
 *
 * 算法（逐行对照 `59C920_Water_GrowLake.c`）：
 *  1. 若 `waterAmount != 0`：
 *     `budget = trunc(width * height * waterAmount * 0.008 + 100.0)`
 *     `remain = budget - ctx.waterUsedArea`（`this+193`）
 *     `remain <= 75` ⇒ 直接返回 0（池子不够大）
 *  2. 堆容量 `cap = max(2*remain+2, 100)`
 *  3. 蛇形迭代全图，清 `cell+0x24` 区的标记
 *  4. 入参坐标非 (0,0) ⇒ 直接返回（只处理"未指定起点"的分支时才会真正生长）
 *  5. 拒绝采样一个中心点：
 *     `center = rand*2 + radius`，`radius` 取 `remain/3`，
 *     越界则 `radius = (remain-75)/2`、`center = radius+75`；
 *     再用高斯（`sub_5980C0` = Box-Muller）做接受-拒绝，要求 `75 <= v <= remain`
 *  6. 以中心入优先队列（键 = 菱形坐标，值 = 距离场），然后逐个出队做 blob 洪泛：
 *     - 8 邻域按 `DIRECTION_OFFSETS` 遍历
 *     - 目标格必须可生长（`sub_486380` = TerrainTest + 标记未被本 blob 占用）
 *     - 距离场 `= (dx²+dy²) * 0.5 + rand*10 - prevY*0.02`
 *     - 已属其他 blob（`+0x38` 非 0 且不等于本计数器）⇒ 停止扩散
 *  7. 全程消耗 RNG，**抽数与邻居分布相关**（不是常数）
 *
 * @returns 是否成功生长了一个湖（决定 `0x59C580` 是否 `++blobCounter` 并 return）
 */
export function waterGrowLake(ctx: WaterContext): boolean {
  const { rng, cells, scratch, theater } = ctx;

  // ── 1. 预算与池子 ──
  if (ctx.waterAmount === 0) return false;
  const W = cells.mapW;
  const H = cells.mapH;
  const diamondMin = (ctx as unknown as { diamondMin?: number }).diamondMin ?? W;
  const diamondMax =
    (ctx as unknown as { diamondMax?: number }).diamondMax ?? W + 2 * H;
  const budget = ftol(
    chopAdd(chopMul(chopMul(W, H), chopMul(ctx.waterAmount, 0.008)), 100.0),
  );
  const remain = budget - (ctx.waterUsedArea ?? 0);
  if (remain <= LAKE_MIN_POOL) return false;

  // ── 2. 堆容量 ──
  const cap = Math.max(2 * remain + 2, 100);

  // ── 3. 清全图标记（原生 sub_578350/578290 蛇形迭代 + 清 +0x24 区）──
  for (const cell of cells.iterate()) {
    const [x, y] = coordOfCell(ctx, cell);
    const s = scratch.at(x, y);
    s.patchId = 0;
  }

  // ── 4. 原生：入参坐标非 (0,0) 时走另一分支（本移植只覆盖 (0,0)）──
  // `0x59C580` 每轮都传 `v6=0, v7=0`，故此处恒走 (0,0) 分支。

  // ── 5. 拒绝采样湖的目标格数 ──
  // 原生 `0x59C920`：`v89 = remain/6`（σ）、`v88 = remain/3`（μ），
  //   退化条件 `v88 − v89 > remain || v88 + v89 < 75`（即 `remain/2 < 75`）时
  //   改为 `v89 = (remain−75)/2`、`v88 = v89 + 75`。
  // ⚠ 旧实现把 σ 写成 `remain/3`（原生的 **2 倍**）⇒ 采样方差翻倍、湖规模失控。
  const sigma0 = remain / 6;
  const mu0 = Math.trunc(remain / 3);
  let radius = sigma0;
  let center = mu0;
  if (mu0 - sigma0 > remain || mu0 + sigma0 < LAKE_MIN_POOL) {
    radius = (remain - LAKE_MIN_POOL) * 0.5;
    center = radius + LAKE_MIN_POOL;
  }
  // Box-Muller 接受-拒绝，要求 75 <= v <= remain
  let v = 0;
  const inv = 1 / RANGE_K / (1 << 32); // 原生 2.328306437080797e-10
  for (let guard = 0; guard < 1000; guard++) {
    v = ctx.gaussian.next(rng) * radius + center;
    if (v < LAKE_MIN_POOL) continue;
    if (v > remain) continue;
    break;
  }
  const radiusI = Math.trunc(v);
  if (radiusI <= 0) return false;
  void inv;

  // ── 6. 湖心入堆 + blob 洪泛 ──
  const blobId = ++ctx.blobCounter.value;

  // ── 5b. **湖心是随机拒绝采样，不是地图中心** ──
  // 原生 `0x59C920` 的拒绝采样循环（最多 200 次，超限 `return 0`）：
  //   u = trunc(rand × W)（拒绝上界 W−1）、v = trunc(rand × H)（拒绝上界 H−1），
  //   再经菱形→笛卡尔 `x = v + u + 1`、`y = W − u + v` 变换得到候选湖心。
  //   该变换与本仓 `createEmptyMapCells` 的偶数格 `dx = 2u, dy = 2v` **逐点一致**
  //   （rx = (2u+2v)/2+1 = u+v+1、ry = 2v − (u+v+1) + W + 1 = W−u+v）。
  //   候选接受条件：`cell+0x38 == 0`（未被任何 blob 标记）
  //              && `sub_486380(cell)`（地形可生长）
  //              && `cell+0x44 != 0`（本轮可生长标志已置）。
  // ⚠ 旧实现固定取地图中心 —— 湖位置完全不可变、且中心格从未做地形校验。
  const keyOfSeed = (x: number, y: number): number => x * 4096 + y;
  let cx = -1;
  let cy = -1;
  for (let tries = 0; tries < 200; tries++) {
    const u = randBelow(ctx, W);
    const vv = randBelow(ctx, H);
    const px = vv + u + 1;
    const py = W - u + vv;
    const sum = px + py;
    if (!(sum > diamondMin && px - py < diamondMin && py - px < diamondMin && sum <= diamondMax)) {
      continue;
    }
      const seedCell = cellAtD(ctx, px, py);
    if (!seedCell) continue;
    // 近似原生 `sub_486380` + `cell+0x44`：空地或已是水才可生长
    if (!(isClearTile(seedCell) || seedCell.tile === theater.waterSet)) continue;
    cx = px;
    cy = py;
    break;
  }
  if (cx < 0) return false;

  const heap: Array<{ x: number; y: number; dist: number }> = [];
  const push = (x: number, y: number, dist: number): void => {
    heap.push({ x, y, dist });
    // 原生是优先队列（按 dist 升序的二叉堆），此处用线性插入保持等价顺序
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent].dist <= heap[i].dist) break;
      const t = heap[parent];
      heap[parent] = heap[i];
      heap[i] = t;
      i = parent;
    }
  };
  const pop = (): { x: number; y: number; dist: number } | null => {
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
        if (l < heap.length && heap[l].dist < heap[m].dist) m = l;
        if (r < heap.length && heap[r].dist < heap[m].dist) m = r;
        if (m === i) break;
        const t = heap[m];
        heap[m] = heap[i];
        heap[i] = t;
        i = m;
      }
    }
    return top;
  };

  const mark = new Map<number, number>();
  const keyOf = (x: number, y: number): number => x * 4096 + y;
  mark.set(keyOf(cx, cy), blobId);

  // ── blob 洪泛（只**标记**，不落水）──
  // ⚠ 原生 `0x59C920` 的洪泛**不写 tile**，只写 `cell+0x3C = blobId` 并入优先队列；
  // 真正落水在函数末尾的 `sub_5A0160(blobId, 1, 0,0, 512,512, 0,0)`（区域膨胀成水）。
  // 洪泛时对每个 8 邻格的判据（伪码 4 条**合取**，全满足才继续扩散）：
  //   `cell+0x38 != 0`（已被某 blob 标记）
  //   `|| cell+0x3C == blobId`（属于当前 blob）
  //   `|| !isGrowable(cell)`（地形测试失败）
  //   `|| cell[68] == 0`（+0x44 标记未置）
  // 命中 `cell+0x38 != 0 && != blobId` ⇒ 撞到别的 blob ⇒ 整体中止（v76=0）。
  const blobHit = { stop: false };
  const startDist = 0;
  push(cx, cy, startDist);

  for (let iter = 0; iter < 40000; iter++) {
    const cur = pop();
    if (!cur) break;
    // ⚠ **规模上限**：原生靠优先队列的出队次序把 blob 控制在 `v85`（采样半径）量级，
    //   落水门槛是 `v79 > 75 && v79 > v85/4`（即允许 543..2172 格）。
    //   本实现是 BFS，不加限会把整个菱形带（3 万+ 格）吃光 ⇒ 反而全图变水。
    //   用 `v85` 作硬上限，与原生的量级一致。
    if (mark.size >= radiusI) break;
    for (let d = 0; d < 8; d++) {
      const off = DIRECTION_OFFSETS[d];
      const nx = cur.x + off[0];
      const ny = cur.y + off[1];
      // 菱形带内判定（原生四条不等式）
      const sum = nx + ny;
      if (!(sum > diamondMin && nx - ny < diamondMin && ny - nx < diamondMin && sum <= diamondMax)) {
        continue;
      }
      const cell = cellAtD(ctx, nx, ny);
      if (!cell) continue;

      // 洪泛判据（原生四条**合取**）：只有
      //   `cell+0x38 == 0`（未被任何 blob 标记）
      //   `&& cell+0x3C != blobId`（不属当前 blob）
      //   `&& isGrowable(cell)`（地形测试通过）
      //   `&& cell[68] != 0`（+0x44 标记已置）
      // 才**继续扩散**并标记。任一不满足 ⇒ 该格不吸收（但也不中止）。
      // 唯一中止条件：撞到**别的** blob（`owner !== undefined && owner !== blobId`）。
      // ── 跨 blob 领地检查 ──
      // ⚠ 原生 `cell+0x38` 是**持久**的 blob 领地标记：河切割（`0x59D510`）写的领地
      //   在随后的湖生长里依然可见，湖洪泛撞上就 `v76 = 0` **整体中止**
      //   ⇒ 真机 MT3 大量样本「只有河、没有湖」正源于此。
      //   旧实现只用本函数内的局部 `mark`，河的领地根本不可见 ⇒ 湖**永不中止**。
      //   本仓用 `ScratchSlot.blobOwner` 承载该持久领地（-1 = 未认领）。
      //   ⚠ **不能**用 `patchId`：它是 BFS 戳，本函数第 3 步会把它清成 0，
      //   而 `0 >= 0` 会被误判成"已被别的 blob 认领" ⇒ 湖第一格就中止。
      const foreign = scratch.at(nx, ny).blobOwner;
      if (foreign >= 0 && foreign !== blobId) {
        blobHit.stop = true; // 撞到别的 blob ⇒ 整体中止
        continue;
      }
      const owner = mark.get(keyOf(nx, ny));
      if (owner !== undefined) {
        if (owner !== blobId) blobHit.stop = true; // 撞到别的 blob ⇒ 整体中止
        continue;
      }
      // 本仓以「可生长」近似原生 `sub_486380` + `cell[68]` 两个条件
      const growable = isClearTile(cell) || cell.tile === theater.waterSet;
      if (!growable) continue;

      // 距离场（原生 `(cx−x)² + (cy−y)²` 经 sub_4CAC40 转 float 后 ×0.5，
      //           再 `+ 10·rand − prevY·0.02`）
      const dx = cx - nx;
      const dy = cy - ny;
      const base = dx * dx + dy * dy;
      // ⚠ `rng.next()` 返回**原始 uint32**（如 3099944058），必须先 ×RANGE_K 归一化。
      //   原生这里是 `10.0 * ((double)draw * 2.328306437080797e-10)`（= `nextUnit()`）。
      const dist = base * 0.5 + rng.nextUnit() * 10.0 - (cur.y % 4) * 0.02;
      mark.set(keyOf(nx, ny), blobId);
      push(nx, ny, dist);
    }
  }

  // ── 落水门槛（原生 `LABEL_113`：`v79 > 75 && v79 > v85/4`）──
  const marked = mark.size;
  if (blobHit.stop || marked <= LAKE_MIN_POOL || marked <= (radiusI >> 2)) {
    return false;
  }

  // ── 落水：`sub_5A0160(blobId, 1, 0,0, 512,512, 0,0)` = 区域膨胀 1 圈成水 ──
  dilateRingsToWater(ctx, mark, keyOf, 1);

  // 领地持久化（与河切割同一口径）
  for (const key of mark.keys()) {
    ctx.scratch.at(Math.floor(key / 4096), key % 4096).blobOwner = blobId;
  }

  ctx.waterUsedArea = (ctx.waterUsedArea ?? 0) + marked;
  return true;
}

/**
 * 区域膨胀成水（`0x5A0160` Region_DilateRings 的 a2 形态）。
 *
 * 语义：**先把已标记 blobId 的区域本身全部落水**，再向外 8 邻膨胀 `rings` 圈，
 * 每一圈新纳入的格同样落水。湖生长固定传 `rings = 1`（河切割传 6 / 2）。
 *
 * ⚠ 曾漏掉「区域本身落水」这一步 —— 只写了外扩的那一圈，导致
 *    `waterUsedArea = 2061` 而实际水格仅 **584**（周长量级），MT3 水量差 19 倍。
 *
 * @param mark    blobId → true 的标记表
 * @param keyOf   坐标 → key 的编码函数
 * @param rings   膨胀圈数
 */
export function dilateRingsToWater(
  ctx: WaterContext,
  mark: Map<number, number | boolean>,
  keyOf: (x: number, y: number) => number,
  rings: number,
): void {
  const { cells, theater } = ctx;
  const diamondMin = (ctx as unknown as { diamondMin?: number }).diamondMin ?? cells.mapW;
  const diamondMax =
    (ctx as unknown as { diamondMax?: number }).diamondMax ?? cells.mapW + 2 * cells.mapH;

  let frontier: Array<[number, number]> = [];
  for (const key of mark.keys()) {
    // key = x * 4096 + y ⇒ 反解
    const x = Math.floor(key / 4096);
    const y = key % 4096;
    frontier.push([x, y]);
    // ── 区域本体落水（原实现遗漏）──
    const cell = cellAtD(ctx, x, y);
    if (cell) {
      cell.tile = theater.waterSet;
      cell.subTile = 0;
    }
  }

  for (let r = 0; r < rings; r++) {
    const next: Array<[number, number]> = [];
    for (const [x, y] of frontier) {
      for (let d = 0; d < 8; d++) {
        const off = DIRECTION_OFFSETS[d];
        const nx = x + off[0];
        const ny = y + off[1];
        const sum = nx + ny;
        if (!(sum > diamondMin && nx - ny < diamondMin && ny - nx < diamondMin && sum <= diamondMax)) {
          continue;
        }
        const k = keyOf(nx, ny);
        if (mark.get(k)) continue;
        const cell = cellAtD(ctx, nx, ny);
        if (!cell) continue;
        mark.set(k, true);
        cell.tile = theater.waterSet;
        cell.subTile = 0;
        next.push([nx, ny]);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  void cells;
}

/**
 * MapType 3/4 的完整阶段 3+4（水体 + 终结器）。
 *
 * 与 0/1/2 型的差别：**不做「全图铺 waterSet」** —— 原版 3/4 型是
 * 在清地上「生长」水体（先 mark 再 flood），不是先铺满再打洞。
 * 因此这里不调 `waterBasic`，只做 blob 生长 + 终结器。
 */
export function waterBasicMt34(ctx: WaterContext): void {
  // ⚠ **必须先把 `regionId` 全置 -1**（"未认领"哨兵）。
  // `ScratchSlot.regionId` 的构造默认值是 **0**（`native.ts:270`），
  // 而区域代码（`regionPartition` / `regionFallback`）全用 `-1` 判"未认领"。
  // 0/1/2 型由 `waterBasic` 的第 4 步（`water.ts:787`）完成这项重置，
  // **3/4 型不走 `waterBasic` ⇒ 曾整张图 regionId=0 ⇒ 区域表为空**。
  for (const slot of ctx.scratch.slots) {
    slot.regionId = -1;
    slot.patchId = -1;
    slot.blobOwner = -1;
  }
  waterDriverMt34(ctx);
  waterFinalize(ctx);
  shoreFinalize(ctx, 0, 0);
}

/**
 * 河切割（`0x0059D510`，size=0x1122）—— 依据 `re/decomp/59D510_Water_CarveRiver.c`（589 行）。
 *
 * 【算法主干（逐段对照伪码）】
 *  1. 入口判定 `*(int16*)a2 == 0 && *(int16*)(a2+2) == 0`
 *     （`0x59C580` 每次都传 `v6=0, v7=0` ⇒ 恒满足）才继续。
 *  2. **随机起点 + 象限**（全部拒绝采样）：
 *     `v7 = trunc(rand × W)`（拒绝上界 `W-1`）、
 *     `v9 = trunc(rand × H)`（拒绝上界 `H-1`）、
 *     `v90 = trunc(rand × 4)`（拒绝上界 3）。
 *  3. **菱形带校验**（四条不等式）⇒ 不在带内直接 `return 0`。
 *  4. **河长** `v16 = max(1, WaterAmount × 0.07)`，`v17 = trunc(v16)`，
 *     再拒绝采样得步数 `v18 ∈ [1, v17]`。
 *  5. **河宽** `v91 = v18 / 2`。
 *  6. **首步弧长偏置** `v84 = trunc(rand × 125 + 35)`（拒绝上界 0x7D）。
 *  7. **主循环**（极坐标推进 + 8 邻微抖动）：每点经 `sub_486380`
 *     地形测试后写 `cell+0x38 = blobId`（**只标记不落水**）；
 *     撞到别的 blob / 越界 / 地形不合格 ⇒ `v78 = 0` 中止。
 *  8. **落水** `sub_5A0160(blobId, 2, …)` = 区域膨胀 2 圈成水
 *     （原生有三处调用：1 圈 / 6 圈 / 2 圈，本移植走 2 圈分支）。
 *  9. **收尾** `this[193] += 已涂格数`（累计已用面积）。
 *
 * 【与湖生长共享的机制】
 *  洪泛只**标记** `cell+0x38 = blobId`，落水统一由 `dilateRingsToWater`
 *  （= `0x5A0160` Region_DilateRings）完成。
 *
 * 【未移植】`sub_5A08D0`（河宽自适应）：调用点保留，返回 0。
 */
export function waterRiverCut(ctx: WaterContext, out: [number, number]): boolean {
  const { cells, theater } = ctx;
  const W = cells.mapW;
  const H = cells.mapH;
  const dMin = (ctx as unknown as { diamondMin?: number }).diamondMin ?? W;
  const dMax = (ctx as unknown as { diamondMax?: number }).diamondMax ?? W + 2 * H;
  const blobId = ctx.blobCounter.value;

  // ── 2. 随机起点 + 象限（三次拒绝采样）──
  // 原生顺序：`v90 = trunc(rand×4)`（象限）、`v7 = trunc(rand×W)`、`v9 = trunc(rand×H)`。
  // ⚠ `(v7,v9)` 是**菱形坐标**，要经与湖心同一套变换才是笛卡尔格：
  //   `x = v + u + 1`、`y = W − u + v`（伪码里以 packed word 写入 `v106[q]`，
  //   再由 `v93 = v106[v90]` 按象限取出）。旧实现把 (u,v) 直接当笛卡尔用
  //   ⇒ 起点被压在 `[0,W)×[0,H)` 矩形里，菱形带可达空间被砍掉大半，
  //   河动辄撞界 ⇒ `v81 < 40` ⇒ 河切割几乎恒失败。
  const quadrant = randBelow(ctx, 4);
  const u0 = randBelow(ctx, W);
  const v0 = randBelow(ctx, H);
  const rx = v0 + u0 + 1;
  const ry = W - u0 + v0;

  // ── 3. 菱形带校验 ──
  if (!inDiamond(rx, ry, dMin, dMax)) return false;

  // ── 4. 河长（段长基准）──
  //    原生 `v16 = max(1, WaterAmount × 0.07)`、`v17 = trunc(v16)`，
  //    再拒绝采样得 `v18 ∈ [1, v17]`（本仓的段数基准）。
  const rawLen = chopMul(ctx.waterAmount, 0.07);
  const lenBase = rawLen < 1.0 ? 1 : ftol(rawLen);
  const steps = lenBase > 0 ? randRange(ctx, 1, lenBase, lenBase) : 1;

  // ── 5. 河宽半径 `v91 = v18 / 2` ──
  const radius = ftol(steps) >> 1;

  // ── 6. 首步弧长偏置（原生 `v84 = trunc(rand × 90 + 35)`，拒绝 `> 0x7D`）──
  //    常数 `2.118758857743526e-8 × 2³² ≈ 90`（不是 125）。
  const arc = randRange(ctx, 35, 90, 125);
  void arc;

  // ── 7. 主循环：**分段推进** ──
  // 原生结构（`59D510_Water_CarveRiver.c`）：
  //   do {
  //     v30 = trunc(段长 + 0.5);
  //     以河头为中心，沿朝向画 v30 格，逐格做菱形带 / blob 领地 / 地形测试；
  //     河头沿朝向**推进 1 格**（`v102 += v95; v104 -= v87` 是单位向量）；
  //     if (v81 > 5) 朝向 += 采样 ∈ ±0.314 rad；
  //     if (v91 > 0) 段长 += 采样 ∈ ±0.5；
  //     v22 = rand；++v81;
  //   } while (v22 >= 0.005);        ← **几何分布**，期望约 200 段
  //   if (v81 < 40) v78 = 0;         ← ★ 段数不足 40 直接判失败
  // ⚠ 旧实现把 `steps` 当**总步数上限**（`steps*8`，WA=76 时仅 40 步）且
  //   每段只画 1 格 ⇒ 河只有 3~9 格，MT3 水量长期偏离真机一个数量级。
  //   「画 v30 格、推进 1 格」正是**河宽**的来源：段长约 5 而推进 1 ⇒ 带宽约 5。
  const keyOf = (x: number, y: number): number => x * 4096 + y;
  const mark = new Map<number, boolean>();
  let painted = 0;
  let hx = rx + 0.5;
  let hy = ry + 0.5;
  // 原生 `v10 = 5.497787143782138 − v90 × 1.570796326794897`（= 315° − q·90°）
  let heading = 5.497787143782138 - quadrant * 1.570796326794897;
  let segLen = lenBase;
  let segments = 0;
  let ok = true;

  do {
    const n = Math.max(1, ftol(chopAdd(segLen, 0.5)));
    const dirX = Math.cos(heading);
    const dirY = Math.sin(heading);
    // 段以河头为中心向 +dir 延伸（原生 `v92 = v102 − (v30−1)·dir/2`）
    const half = (n - 1) * 0.5;
    for (let k = 0; k < n; k++) {
      const px = Math.trunc(hx + (k - half) * dirX);
      const py = Math.trunc(hy + (k - half) * dirY);
      if (!inDiamond(px, py, dMin, dMax)) {
        ok = false;
        break;
      }
      const cell = cellAtD(ctx, px, py);
      if (!cell) {
        ok = false;
        break;
      }
      // 撞到别的 blob 领地 ⇒ 中止（原生 `v76 = 0`）
      const foreign = ctx.scratch.at(px, py).blobOwner;
      if (foreign >= 0 && foreign !== blobId) {
        ok = false;
        break;
      }
      const growable = isClearTile(cell) || cell.tile === theater.waterSet;
      if (!growable) {
        ok = false;
        break;
      }
      const key = keyOf(px, py);
      if (!mark.get(key)) {
        mark.set(key, true);
        painted += 1;
      }
      out[0] = px;
      out[1] = py;
    }
    if (!ok) break;
    // 河头沿朝向推进 **1 格**
    hx += dirX;
    hy += dirY;
    if (segments > 5) {
      heading += (ctx.rng.nextUnit() - 0.5) * 2 * 0.3141592653589793;
    }
    if (radius > 0) {
      segLen += (ctx.rng.nextUnit() - 0.5) * 2 * 0.5;
    }
    segments += 1;
  } while (ctx.rng.nextUnit() >= 0.005 && segments < 4000);

  // ★ 原生 `if (v81 < 40) v78 = 0`
  if (!ok || painted === 0 || segments < RIVER_MIN_SEGMENTS) return false;

  // ── 8. 落水：区域膨胀 2 圈（原生 5A0160 的三处调用之一）──
  dilateRingsToWater(ctx, mark, keyOf, 2);

  // ── 8b. 领地持久化：`cell+0x38 = blobId` ──
  // 原生河切割写完 blob 领地后**不清除**，随后的湖生长仍看得到这张领地，
  // 撞上即整体中止。本仓用 `ScratchSlot.blobOwner` 承载（-1 = 未认领）。
  for (const key of mark.keys()) {
    ctx.scratch.at(Math.floor(key / 4096), key % 4096).blobOwner = blobId;
  }

  // ── 9. 收尾 ──
  ctx.waterUsedArea = (ctx.waterUsedArea ?? 0) + painted;
  return true;
}

/** 菱形带四条不等式（`dword_ABED04` / `dword_ABED08`） */
function inDiamond(x: number, y: number, dMin: number, dMax: number): boolean {
  const sum = x + y;
  return sum > dMin && x - y < dMin && y - x < dMin && sum <= dMax;
}

/**
 * 拒绝采样：`trunc(draw × range × 2⁻³²)`，值域 `0..range-1`。
 *
 * ⚠ **必须用 `nextUnit()`**（= `next() × RANGE_K`）而不是 `next()`。
 *   `RmgRng.next()` 返回的是**原始 uint32 抽取**（如 3099944058），
 *   直接乘 range 会得到 3.4e11 量级 ⇒ 拒绝循环 1000 次全失败 ⇒ 恒返回 0
 *   ⇒ 湖心/河起点**永远落在 (u,v)=(0,0)**，MT3 水体长期只有 157 格。
 */
function randBelow(ctx: WaterContext, range: number): number {
  const lim = range - 1;
  for (let guard = 0; guard < 1000; guard++) {
    const v = ftol(chopMul(ctx.rng.nextUnit(), range));
    if (v <= lim) return v;
  }
  return 0;
}

/** 拒绝采样：`trunc(draw × range × 2⁻³² + lo)`，值域 `[lo, hi]` */
function randRange(ctx: WaterContext, lo: number, range: number, hi: number): number {
  for (let guard = 0; guard < 1000; guard++) {
    const v = ftol(chopAdd(chopMul(ctx.rng.nextUnit(), range), lo));
    if (v <= hi) return v;
  }
  return lo;
}

/**
 * 阶段 3/4 的 MapType 3/4 入口 —— 原生 `0x0059C580`（`59C580_Water_Driver_mt34.c`）。
 *
 * ```
 * ++*(this + 194);                       // ⚠ 开头无条件自增一次
 * if ((mapType==3||mapType==4) && *(this+19) > 20) {
 *     for (v3=0; v3<10; v3++) {
 *         v6=0; v7=0;
 *         if (sub_59D510(this,&v6,0.0,0)) { ++*(this+194); break; }
 *     }
 * }
 * for (v4=0; v4<10; v4++) {
 *     v6=0; v7=0;
 *     if (sub_59C920(this,&v6)) { ++*(this+194); return; }
 * }
 * ```
 *
 * ⚠ 开头那次无条件 `++` 漏掉会让 blob 标号错位、
 * 「已属其他 blob」判定误判冲突。
 */
export function waterDriverMt34(ctx: WaterContext): void {
  ctx.blobCounter.value += 1;

  // ① 河切割：mapType∈{3,4} && waterAmount > 20，最多 10 次
  if ((ctx.mapType === 3 || ctx.mapType === 4) && ctx.waterAmount > 20) {
    for (let i = 0; i < 10; i++) {
      const out: [number, number] = [0, 0];
      if (waterRiverCut(ctx, out)) {
        ctx.blobCounter.value += 1;
        break;
      }
    }
  }

  // ② 湖生长：最多 10 次，成功即计数并 return
  for (let i = 0; i < 10; i++) {
    if (waterGrowLake(ctx)) {
      ctx.blobCounter.value += 1;
      return;
    }
  }
}
