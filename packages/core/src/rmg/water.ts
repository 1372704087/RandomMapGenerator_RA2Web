/**
 * 水体阶段（原生阶段 3 + 4）—— MapType 0/1/2 的基础水体与终结器
 *
 * 逐函数对应（gamemd YR 1.001，反编译语料 `re/decomp/`）：
 *   waterBasic        0x0059A6C0   形状派发 + 孤立水清除 + 区域重置 + 岸→绿
 *   shape0/1/2        0x0059AD10 / 0x0059AFA0 / 0x0059B200   群岛/大陆/海中群岛
 *   partitionRects    0x0059A8F0   矩形网格划分（群岛用）
 *   landBlobFlood     0x0059BBC0   有界堆生长的陆地斑块
 *   ellipseTest       0x0059BAB0   斑块椭圆约束
 *   directedKey       0x0059B940   方向偏置键（零抽）
 *   waterFinalize     0x0059C630   底水格 → 真实水砖（单格 / 2×2 模板）
 *   shoreFinalize     0x0057A0C0   岸线三趟 + 0x0057A430/0x0057A320/0x0057ACF0
 *   shoreMaskProbe    0x0057B210   8 位岸向掩码（带缓存）
 *   shoreStampTile    0x0057B440   岸线模板盖章（兼容表 82A7F4/82A89C）
 *
 * 契约要点：
 *   - x87 截断语义（x87.ts）；区间归约「draw×span 后 ×K」。
 *   - 越界坐标访问落**共享哨兵格**（tile 初值 0 = clear；岸→绿会把它染绿，
 *     这是原生共享态，不是 bug —— 见 waterBasic 第 5 步）。
 *   - 抽数站点：blob 每接受邻 1（sqrt 模式）/0（方向键模式）、每弹出轮 2 高斯、
 *     随机种子每尝试 2；形状 0 每矩形 1 + 分区 1 + (cols·rows−n) 次；
 *     形状 2 方向币 1；终结器每水格 1~2 + 拒绝；岸线趟 3/4 每格 1。
 */

import {
  chopAdd,
  chopDiv,
  chopMul,
  chopSub,
  ftol,
  gamemdSqrt,
  nextUniformRange,
  RANGE_K,
} from './x87';
import { RmgGaussian, RmgRng } from './rng';
import { DIRECTION_OFFSETS } from './cell';
import { NativeCell, NativeCells, ScratchGrid, TILE_NONE } from './native';
import { TheaterTables } from './theater';

/** 环境上下文：一次 Generate 共享的全部可变状态 */
export interface WaterContext {
  rng: RmgRng;
  gaussian: RmgGaussian;
  cells: NativeCells;
  scratch: ScratchGrid;
  theater: TheaterTables;
  /** MapSeed+0x308 —— blob 标签计数器 */
  blobCounter: { value: number };
  /** MapSeed+0x3C */
  mapType: number;
  /** MapSeed+0x4C（%） */
  waterAmount: number;
  /** MapSeed+0x50 */
  numPlayers: number;
  /** MapSeed+0x30C 默认地面 level（map-prep 写 4） */
  defaultLevel: number;
  /** dword_A8ED38 = theater 总 tile 数 */
  isoTileTypeCount: number;
  /** MapSeed+0x44 Ruggedness %（阶段 16） */
  ruggedness: number;
  /** MapSeed+0x5C Vegetation %（阶段 17） */
  vegetation: number;
  /** MapSeed+0x64 Width 档位（树数公式） */
  widthLevel: number;
  /** MapSeed+0x2FC MaxTrees（RMGMD.INI / 缺省 500，零售 600） */
  maxTrees: number;
  /** MapSeed+0x38 Theater（阶段 17 分支） */
  theaterIndex: number;
  /** MapSeed+0x58 TiberiumLayout（阶段 13 选择器/阶段 15） */
  tiberiumLayout: number;
  /** 0x00ABE028 起点配额（原生恒 4） */
  startQuota: number;
  /**
   * MapSeed+0x304 —— **已用水面积累加**（`0x59C920` 的 `this+193`）。
   *
   * 湖生长用 `budget = trunc(W·H·waterAmount·0.008 + 100)` 算预算，
   * 再减去本值得到 `remain`；`remain <= 75` 直接放弃生长。
   * 每成功生长一个湖要把它累加回去（否则会无限长湖）。
   * 0/1/2 型不走这条路径，留 0 即可。
   */
  waterUsedArea?: number;
  /** MapSeed+0x40 Resources 档（1..3） */
  resources: number;
  /** MapSeed+0x54 Tiberium %（阶段 15） */
  tiberiumPercent: number;
  /** 起点状态（阶段 13 写，阶段 15 读） */
  starts: { waypoints: ([number, number] | null)[] };
  /** 阶段 17 产出的树（emit 侧转 [Terrain] 节） */
  terrainObjects: { name: string; xd: number; yd: number }[];
  /** 阶段 14 产出的科技建筑（emit 侧转 [Structures] 节） */
  structures: import('./tech').TechStructure[];
  /** 阶段 16 的角点引擎状态（hillsMain 写入） */
  hills?: import('./hills').HillsState;
  /** 阶段 12 的重算参数（可选；缺省平水提供者 + 规则字节 0） */
  recalc?: {
    rules: { cliffBackImpassability: number };
    templates: import('./recalc').TemplateProvider;
  };
  /**
   * 岸线盖章的**独立 tag 网格**（原生 `dword_ABED10` 堆）。
   *
   * 🔴 **2026-10-08 修正：它与 `scratch.regionId` 是两个不同的存储。**
   * `0x57A0C0` 入口每次调用都 `operator new(80·N²)` + `sub_58BDC0` 重建这堆，
   * 而 `sub_58BDC0` 把 `+56`（即 tag 字段）清为 **0**；
   * `sub_5A00C0` 读的正是 `ABED10[x + 89C2DC·y] + 56`，
   * `sub_5A0090` 写的也是同一处 —— **与 scratch 数组毫无关系**。
   *
   * 此前本仓把 `scratch.regionId` 当 tag 用，而 map-prep 之后它已被
   * 水体阶段写成 **−1**（`water.ts` 的 `regionId = -1` 初始化），
   * 于是 `sub_5A00C0` 语义下的「tag > 0 且 ≠ 传入 tag」被误判成
   * 「−1 ≠ tag 恒真」，Pass1 立刻 `return 0` 中止整条盖章链。
   *
   * 实测（`re/probe_shore2.js`）：MT1/MT3 的 `mode=0` 岸线片 0/1 格，
   * 改用独立网格后 589/1154 格（真机 1356/544）。
   *
   * 缺省时由 `shoreFinalize` 自动分配/释放（对齐原生每次调用重建）。
   */
  shoreTags?: Int32Array;
}

/** 岸线 tag 网格的线性下标（原生 `x + 89C2DC·y`，stride = linearW） */
function shoreTagIndex(ctx: WaterContext, xd: number, yd: number): number {
  const tags = ctx.shoreTags;
  if (tags === undefined) return 0;
  return yd * ctx.scratch.size + xd;
}

// ─── tile 族谓词（原生 0x00486380 / 0x00485060 / 0x004865B0 / 0x004865D0 / 0x004867B0）

export function isClearTile(cell: NativeCell): boolean {
  return cell.tile === TILE_NONE || cell.tile === 0;
}

export function isWaterTile(cell: NativeCell, t: TheaterTables): boolean {
  return cell.tile >= t.waterSet && cell.tile < t.waterSet + 14;
}

export function isShorePieceTile(cell: NativeCell, t: TheaterTables): boolean {
  return cell.tile >= t.shorePieces && cell.tile < t.shorePieces + 42;
}

/** `0x004865D0`：岸线片 42 格 / 水 14 格 / 四个瀑布 4 格族 */
export function isWaterFamily(cell: NativeCell, t: TheaterTables): boolean {
  return (
    inRange(cell.tile, t.shorePieces, 42) ||
    inRange(cell.tile, t.waterSet, 14) ||
    inRange(cell.tile, t.waterfallEast, 4) ||
    inRange(cell.tile, t.waterfallWest, 4) ||
    inRange(cell.tile, t.waterfallSouth, 4) ||
    inRange(cell.tile, t.waterfallNorth, 4)
  );
}

/** `0x004867B0`：绿基址 + 16 格绿 LAT 族 */
export function isGreenTile(cell: NativeCell, t: TheaterTables): boolean {
  return cell.tile === t.greenTile || inRange(cell.tile, t.clearToGreenLat, 16);
}

function inRange(v: number, base: number, len: number): boolean {
  return base >= 0 && v >= base && v < base + len;
}

/** `DiamondToCell 0x005657A0` 语义：带外 → 哨兵（共享可写） */
export function cellAtD(ctx: WaterContext, x: number, y: number): NativeCell {
  return ctx.cells.cellAt(x, y);
}

// ─── 陆地斑块洪泛（`0x0059BBC0`）

interface HeapNode {
  x: number;
  y: number;
  key: number;
}

/** 1-基最小堆；满则静默丢弃（原生 `count+1 < cap` 门） */
class CoordHeap {
  private data: (HeapNode | null)[] = [null];

  constructor(private cap: number) {}

  get count(): number {
    return this.data.length - 1;
  }

  push(n: HeapNode): void {
    if (this.count + 1 >= this.cap) return;
    this.data.push(n);
    let i = this.data.length - 1;
    while (i > 1) {
      const p = i >> 1;
      if ((this.data[p] as HeapNode).key <= n.key) break;
      this.data[i] = this.data[p];
      this.data[p] = n;
      i = p;
    }
  }

  pop(): HeapNode | null {
    if (this.count === 0) return null;
    const top = this.data[1] as HeapNode;
    const last = this.data.pop() as HeapNode | null;
    if (this.count > 0 && last) {
      this.data[1] = last;
      let i = 1;
      for (;;) {
        const l = i * 2;
        const r = l + 1;
        let m = i;
        if (l <= this.count && (this.data[l] as HeapNode).key < (this.data[m] as HeapNode).key) m = l;
        if (r <= this.count && (this.data[r] as HeapNode).key < (this.data[m] as HeapNode).key) m = r;
        if (m === i) break;
        const t = this.data[i];
        this.data[i] = this.data[m];
        this.data[m] = t;
        i = m;
      }
    }
    return top;
  }
}

/** 默认全图矩形哨兵（`0x00ABE2F0..FC`；本管线从未设置 → 相等检查恒假） */
const DEFAULT_RECT = [-1, -1, -1, -1];

function rectIsDefault(rect: number[]): boolean {
  return (
    rect[0] === DEFAULT_RECT[0] &&
    rect[1] === DEFAULT_RECT[1] &&
    rect[2] === DEFAULT_RECT[2] &&
    rect[3] === DEFAULT_RECT[3]
  );
}

/** 椭圆约束 `0x0059BAB0`。directed = 菱形空间椭圆；否则矩形内点测试。 */
export function ellipseTest(
  ctx: WaterContext,
  xd: number,
  yd: number,
  rect: number[],
  directed: boolean,
  invRw2: number,
  invRh2: number,
): boolean {
  if (rectIsDefault(rect)) return true;
  if (directed) {
    const W = ctx.cells.mapW;
    const a = (xd - 2 * rect[0] - yd + W - 1) * 0.5 - rect[2] * 0.5;
    const b = (xd - 2 * rect[1] - W + yd - 1) * 0.5 - rect[3] * 0.5;
    return (
      chopAdd(
        chopMul(chopMul(b, b), invRh2),
        chopMul(chopMul(a, a), invRw2),
      ) < 1
    );
  }
  const [mx, my] = ctx.cells.toMap(xd, yd);
  return (
    mx >= rect[0] && mx < rect[0] + rect[2] && my >= rect[1] && my < rect[1] + rect[3]
  );
}

/**
 * 方向偏置键 `0x0059B940`（零抽）。
 * 注意原生怪癖：`(uy*stretchRx + stretchRy*ux) * reach` —— 两个伸缩系数交叉。
 */
export function directedKey(
  ctx: WaterContext,
  xd: number,
  yd: number,
  cx: number,
  cy: number,
  rect: number[],
  goalX: number,
  goalY: number,
  stretchRy: number,
  stretchRx: number,
): number {
  if (rectIsDefault(rect)) {
    const dx = xd - cx;
    const dy = yd - cy;
    return gamemdSqrt(chopAdd(chopMul(dx, dx), chopMul(dy, dy)));
  }
  const ddx = Math.abs((((cx - cy) >> 1) - ((goalX - goalY) >> 1)) | 0);
  const ddy = Math.abs((((cx + cy) >> 1) - ((goalY + goalX) >> 1)) | 0);
  if (ddx === 0 && ddy === 0) return 0;
  const len = gamemdSqrt(chopAdd(chopMul(ddx, ddx), chopMul(ddy, ddy)));
  const ux = ddx / len;
  const uy = ddy / len;
  const reach = Math.max(Math.abs(xd - cx), Math.abs(yd - cy));
  return (uy * stretchRx + stretchRy * ux) * reach;
}

/**
 * 陆地斑块洪泛。返回 >0 = 成功（弹出数）；0 = 失败。
 *
 * @param target        目标格数（堆容量 = max(8·max(target,400)+2, 100)）
 * @param rect          约束矩形 {x,y,w,h}（map 坐标）
 * @param seedX/seedY   种子菱形坐标；(0,0) = 随机选（每尝试 2 抽，≤200 次）
 * @param directed      椭圆约束模式
 * @param goalX/goalY   方向键目标（菱形坐标）
 * @param drift         高斯漂移步长
 * @param useDirectedKey true = 方向偏置键（零抽）；false = sqrt + 1 抽/接受邻
 */
export function landBlobFlood(
  ctx: WaterContext,
  target: number,
  rect: number[],
  seedX: number,
  seedY: number,
  directed: boolean,
  goalX: number,
  goalY: number,
  drift: number,
  useDirectedKey: boolean,
): number {
  const { rng, cells, scratch, theater } = ctx;
  const K = RANGE_K;
  const heapCap = Math.max(8 * Math.max(target, 400) + 2, 100);
  const heap = new CoordHeap(heapCap);

  // 伸缩系数（v85/v86）：rect 非默认才计算，否则保持 0
  let stretchRx = 0;
  let stretchRy = 0;
  if (!rectIsDefault(rect)) {
    if (rect[2] <= rect[3]) {
      stretchRx = 1.0;
      stretchRy = (rect[3] / rect[2]) * 1.2;
    } else {
      stretchRx = (rect[2] / rect[3]) * 1.2;
      stretchRy = 1.0;
    }
  }
  const invRw2 = chopDiv(1.0, chopMul(chopMul(rect[2], 0.5), chopMul(rect[2], 0.5)));
  const invRh2 = chopDiv(1.0, chopMul(chopMul(rect[3], 0.5), chopMul(rect[3], 0.5)));

  // 随机种子选择（a4 == 0,0 时）
  if (seedX === 0 && seedY === 0) {
    const W = cells.mapW;
    const H = cells.mapH;
    let attempts = 0;
    let found = false;
    for (;;) {
      let mx = 0;
      do {
        mx = ftol(chopMul(chopMul(rng.next(), W), K));
      } while (mx > W - 1);
      let my = 0;
      do {
        my = ftol(chopMul(chopMul(rng.next(), H), K));
      } while (my > H - 1);
      attempts++;
      if (attempts >= 200) return 0;
      const xd = my + mx + 1;
      const yd = W - mx + my;
      if (scratch.at(xd, yd).regionId === 0) {
        const cell = cells.slotAt(xd, yd);
        if (cell !== null && isWaterFamily(cell, theater)) {
          seedX = xd;
          seedY = yd;
          found = true;
          break;
        }
      }
    }
    if (!found) return 0;
  }

  const blobId = ctx.blobCounter.value;
  let cx = seedX;
  let cy = seedY;
  scratch.at(seedX, seedY).patchId = blobId;

  const heapArr: HeapNode[] = [];
  heapArr.push(null as unknown as HeapNode);
  const pushHeap = (n: HeapNode): void => {
    if (heapArr.length - 1 + 1 >= heapCap) return;
    heapArr.push(n);
    let i = heapArr.length - 1;
    while (i > 1) {
      const p = i >> 1;
      if ((heapArr[p] as HeapNode).key <= n.key) break;
      heapArr[i] = heapArr[p];
      heapArr[p] = n;
      i = p;
    }
  };
  const popHeap = (): HeapNode | null => {
    if (heapArr.length === 1) return null;
    const top = heapArr[1];
    const last = heapArr.pop() as HeapNode;
    if (heapArr.length > 1) {
      heapArr[1] = last;
      let i = 1;
      for (;;) {
        const l = i * 2;
        const r = l + 1;
        let m = i;
        if (l < heapArr.length && (heapArr[l] as HeapNode).key < (heapArr[m] as HeapNode).key) m = l;
        if (r < heapArr.length && (heapArr[r] as HeapNode).key < (heapArr[m] as HeapNode).key) m = r;
        if (m === i) break;
        const t = heapArr[i];
        heapArr[i] = heapArr[m];
        heapArr[m] = t;
        i = m;
      }
    }
    return top;
  };

  pushHeap({ x: seedX, y: seedY, key: 0 });
  let cur = popHeap();
  let pops = 0;

  // 主环：do-while，最多 target 轮
  for (;;) {
    if (cur === null) break;
    // 弹出格：声明 + 定为陆地
    scratch.at(cur.x, cur.y).regionId = blobId;
    cellAtD(ctx, cur.x, cur.y).tile = 0;

    for (let d = 0; d < 8; d += 2) {
      const off = DIRECTION_OFFSETS[d];
      const nx = cur.x + off[0];
      const ny = cur.y + off[1];
      if (!cells.inDiamondBounds(nx, ny)) continue;
      const nslot = scratch.at(nx, ny);
      if (nslot.regionId !== 0 || nslot.patchId === blobId) continue;
      const ncell = cells.slotAt(nx, ny);
      if (ncell === null || !isWaterFamily(ncell, theater)) continue;
      if (!ellipseTest(ctx, nx, ny, rect, directed, invRw2, invRh2)) continue;
      let key: number;
      if (useDirectedKey) {
        key = directedKey(ctx, nx, ny, cx, cy, rect, goalX, goalY, stretchRy, stretchRx);
      } else {
        const rx = ftol(chopAdd(cx, 0.5));
        const ry = ftol(chopAdd(cy, 0.5));
        const dx = nx - rx;
        const dy = ny - ry;
        const dist = gamemdSqrt(chopAdd(chopMul(dx, dx), chopMul(dy, dy)));
        key = chopAdd(dist, chopMul(chopMul(rng.next(), 5.0), K));
      }
      nslot.patchId = blobId;
      pushHeap({ x: nx, y: ny, key });
    }

    // 中心漂移：每轮 2 高斯
    cx = chopAdd(chopMul(ctx.gaussian.next(rng), drift), cx);
    cy = chopAdd(chopMul(ctx.gaussian.next(rng), drift), cy);
    pops++;
    if (pops >= target) break;
    cur = popHeap();
  }

  // 排空堆（无抽）
  for (;;) {
    const node = popHeap();
    if (node === null) break;
    const nslot = scratch.at(node.x, node.y);
    const ncell = cells.slotAt(node.x, node.y);
    if (nslot.regionId === 0 && ncell !== null && isWaterFamily(ncell, theater)) {
      ncell.tile = 0;
      nslot.regionId = blobId;
    }
  }

  // 岸线终结
  const shoreOk = shoreFinalize(ctx, blobId, 1) !== 0;

  // 岸线片族清理
  for (const cell of cells.iterate()) {
    if (isShorePieceTile(cell, theater)) {
      cell.tile = 0;
      cell.subTile = 0;
    }
  }

  if (shoreOk) {
    ctx.blobCounter.value = blobId + 1;
    return pops;
  }

  // 回滚：本 blob 退回水底
  for (const cell of cells.iterate()) {
    const [x, y] = coordOfCell(ctx, cell);
    const s = scratch.at(x, y);
    if (s.regionId === blobId) {
      s.regionId = 0;
      s.waterBridgeFlags = 0;
      cell.tile = theater.waterSet;
      cell.subTile = 0;
      cell.level = 4; // MapSeed+0x30C
    }
  }
  return 0;
}

/** 迭代产出的 cell → 菱形坐标（每 NativeCells 缓存一张反查表） */
const cellCoordMap = new WeakMap<NativeCells, Map<NativeCell, [number, number]>>();

export function coordOfCell(ctx: WaterContext, cell: NativeCell): [number, number] {
  let m = cellCoordMap.get(ctx.cells);
  if (m === undefined) {
    m = new Map();
    // 带公式 x/y 最大 = W+H−1（H 可大于 W）—— 扫描界必须用 W+H，不能用 2W
    const limX = ctx.cells.mapW + ctx.cells.mapH + 4;
    const limY = ctx.cells.mapW + ctx.cells.mapH + 4;
    for (let y = 0; y < limY; y++) {
      for (let x = 0; x < limX; x++) {
        const c = ctx.cells.slotAt(x, y);
        if (c !== null) m.set(c, [x, y]);
      }
    }
    cellCoordMap.set(ctx.cells, m);
  }
  const r = m.get(cell);
  if (r === undefined) throw new Error('cell 不在 playfield');
  return r;
}

// ─── 矩形网格划分（`0x0059A8F0`，已按汇编逐指令还原）

/**
 * 把 rect 划成 nTotal 个 inset-2 矩形追加进 out。
 * 抽数：1 次方向币 + (cols·rows − nTotal) 次槽位缩减（各带拒绝）。
 */
export function partitionRects(
  out: number[][],
  nTotal: number,
  rect: number[],
  rng: RmgRng,
): void {
  const K = RANGE_K;
  const v4 = ftol(gamemdSqrt(nTotal));
  const cols = v4 * v4 === nTotal ? v4 : v4 + 1;
  const rows = v4 * cols < nTotal ? cols : v4;

  let wCell = (rect[2] / cols) | 0;
  let hCell = (rect[3] / cols) | 0;

  const coin = chopMul(rng.next(), K) < 0.5;
  let stepXIn = 0;
  let stepYIn = 0;
  let stepXStrip = 0;
  let stepYStrip = 0;
  if (coin) {
    // 竖条：w = w/rows，条内纵向步进 h/cols
    wCell = (rect[2] / rows) | 0;
    stepYIn = hCell;
    stepXStrip = wCell;
  } else {
    // 横排：h = h/rows，排内横向步进 w/cols
    stepXIn = wCell;
    hCell = (rect[3] / rows) | 0;
    stepYStrip = hCell;
  }

  // repeats[k] = cols；cols·rows − nTotal 个槽降为 floor(sqrt(n))，槽池收缩
  const repeats = new Array<number>(rows).fill(cols);
  const pool: number[] = [];
  for (let i = 0; i < rows; i++) pool.push(i);
  const extra = cols * rows - nTotal;
  const flat = ftol(gamemdSqrt(nTotal));
  for (let e = 0; e < extra; e++) {
    const len = pool.length;
    let pick = 0;
    do {
      pick = ftol(chopMul(chopMul(rng.next(), len), K));
    } while (pick > len - 1);
    repeats[pool[pick]] = flat;
    pool.splice(pick, 1);
  }

  let x = rect[0];
  let y = rect[1];
  for (let k = 0; k < rows; k++) {
    const c = repeats[k];
    if (c < cols) {
      if (stepXIn > 0) x += (wCell / 2) | 0;
      else y += (hCell / 2) | 0;
    }
    for (let i = 0; i < c; i++) {
      out.push([x + 2, y + 2, wCell - 4, hCell - 4]);
      x += stepXIn;
      y += stepYIn;
    }
    x += stepXStrip;
    y += stepYStrip;
    if (stepXIn > 0) x = rect[0];
    else y = rect[1];
  }
}

// ─── 形状派发

const waterArea = (cells: NativeCells): number =>
  2 * cells.mapW * (cells.mapH + 4); // `sub_42B1F0`

/** 形状 0：群岛 `0x0059AD10` */
export function waterShape0(ctx: WaterContext): void {
  const { rng, cells, scratch } = ctx;
  const K = RANGE_K;
  ctx.blobCounter.value = 1;
  const rect = [0, 0, cells.mapW, cells.mapH];

  const maxBands = Math.max(((ctx.numPlayers / 2) | 0) as number, 2);
  let bands = 0;
  do {
    bands = ftol(chopAdd(chopMul(chopMul(rng.next(), maxBands), K), 1.0));
  } while (bands > maxBands);

  const rects: number[][] = [];
  partitionRects(rects, bands + ctx.numPlayers, rect, rng);

  for (const cell of cells.iterate()) {
    const [x, y] = coordOfCell(ctx, cell);
    scratch.at(x, y).patchId = 0;
  }

  for (const r of rects) {
    const area = 2 * r[2] * r[3];
    const quota = ftol(
      chopMul(chopAdd(chopMul(chopMul(rng.next(), K), 0.05), 0.45), area),
    );
    const seedX = r[0] + ((r[2] / 2) | 0) + ((r[3] / 2) | 0) + r[1] + 1;
    const seedY = r[1] + cells.mapW + ((r[3] / 2) | 0) - ((r[2] / 2) | 0) - r[0];
    let attempts = 0;
    let res = 0;
    do {
      res = landBlobFlood(ctx, quota, r, seedX, seedY, true, seedX, seedY, 0.25, false);
      if (res === 0) ctx.blobCounter.value++;
      attempts++;
    } while (res === 0 && attempts < 10);
  }
}

/** 形状 1：大陆 `0x0059AFA0` */
export function waterShape1(ctx: WaterContext): void {
  const { rng, cells, scratch } = ctx;
  const K = RANGE_K;
  ctx.blobCounter.value = 1;
  const area = waterArea(cells);
  const target = chopAdd(
    chopMul(chopSub(1.0, chopMul(ctx.waterAmount, 0.01)), 0.05),
    0.45,
  );
  const cap = ftol(chopMul(chopMul(area, 0.03), target));
  const center = (cells.mapH >> 1) + (cells.mapW >> 1);
  let seedX = center + 1;
  let seedY = center;

  for (const cell of cells.iterate()) {
    const [x, y] = coordOfCell(ctx, cell);
    scratch.at(x, y).patchId = 0;
  }
  const rect = [1, 1, cells.mapW - 2, cells.mapH - 2];
  if (target <= 0) return;
  let placed = 0;
  for (let iter = 0; iter < 100; iter++) {
    let quota = ftol(chopMul(chopSub(target, placed / area), area));
    if (quota >= cap) quota = cap;
    placed += landBlobFlood(
      ctx,
      quota,
      rect,
      seedX,
      seedY,
      true,
      seedX,
      seedY,
      0.75,
      true,
    );
    // 最近未认领格为新种子（|dx|+|dy|，细胞迭代序，严格 <）
    let best = 50000;
    let bx = 0;
    let by = 0;
    for (const cell of cells.iterate()) {
      const [x, y] = coordOfCell(ctx, cell);
      if (scratch.at(x, y).patchId !== 0) continue;
      const d = Math.abs(x - (center + 1)) + Math.abs(y - center);
      if (d < best) {
        best = d;
        bx = x;
        by = y;
      }
    }
    seedX = bx;
    seedY = by;
    if (placed / area >= target) break;
  }
}

/** 形状 2：海中群岛 `0x0059B200` */
export function waterShape2(ctx: WaterContext): void {
  const { rng, cells, scratch, theater } = ctx;
  const K = RANGE_K;
  ctx.blobCounter.value = 1;
  const area = waterArea(cells);
  const target = chopAdd(
    chopMul(chopSub(1.0, chopMul(ctx.waterAmount, 0.01)), 0.05),
    0.15,
  );
  const cap = ftol(chopMul(chopMul(area, 0.06), target));

  for (const cell of cells.iterate()) {
    const [x, y] = coordOfCell(ctx, cell);
    scratch.at(x, y).patchId = 0;
  }

  // 方向币：切两半（间隙 2 格）
  const W = cells.mapW;
  const H = cells.mapH;
  const halves: number[][] = [];
  if (chopMul(rng.next(), K) >= 0.5) {
    halves.push([0, 0, W, (H >> 1) - 1]);
    halves.push([0, (H >> 1) + 1, W, (H >> 1) - 1]);
  } else {
    halves.push([0, 0, (W >> 1) - 1, H]);
    halves.push([(W >> 1) + 1, 0, (W >> 1) - 1, H]);
  }

  let placed = 0;
  for (const hr of halves) {
    let seedX = hr[0] + ((hr[2] / 2) | 0) + ((hr[3] / 2) | 0) + hr[1] + 1;
    let seedY = hr[1] + W + ((hr[3] / 2) | 0) - ((hr[2] / 2) | 0) - hr[0];
    let local = 0;
    for (let iter = 0; iter < 100; iter++) {
      let quota = ftol(chopMul(chopSub(target, local / area), area));
      if (quota >= cap) quota = cap;
      const res = landBlobFlood(
        ctx,
        quota,
        hr,
        seedX,
        seedY,
        true,
        seedX,
        seedY,
        0.75,
        true,
      );
      local += res;
      placed += res;
      // 矩形菱形界 + 椭圆内最近未认领格（加权曼哈顿，线性扫 W² 槽序）
      let best = 50000;
      let bx = seedX;
      let by = seedY;
      const [stretchX, stretchY] = aspectOf(hr);
      const invRw2 = chopDiv(1.0, chopMul(chopMul(hr[2], 0.5), chopMul(hr[2], 0.5)));
      const invRh2 = chopDiv(1.0, chopMul(chopMul(hr[3], 0.5), chopMul(hr[3], 0.5)));
      for (let y = 1; y < W + 2 * H; y++) {
        for (let x = 1; x < 2 * W; x++) {
          if (!cells.inDiamondBounds(x, y)) continue;
          if (scratch.at(x, y).patchId !== 0) continue;
          if (!ellipseTest(ctx, x, y, hr, true, invRw2, invRh2)) continue;
          const d =
            ftol(chopMul(Math.abs(y - seedY), stretchY)) +
            ftol(chopMul(Math.abs(x - seedX), stretchX));
          if (d < best) {
            best = d;
            bx = x;
            by = y;
          }
        }
      }
      seedX = bx;
      seedY = by;
      if (placed / area >= target) break;
    }
  }
  void theater;
}

/** 纵横比伸缩（shape2 最近距加权用）：返回 [x 权重, y 权重] */
function aspectOf(rect: number[]): [number, number] {
  if (rect[3] <= rect[2]) return [1.0, (rect[2] / rect[3]) * 1.2];
  return [(rect[3] / rect[2]) * 1.2, 1.0];
}

// ─── 基础水体（`0x0059A6C0`）

export function waterBasic(ctx: WaterContext): void {
  const { cells, scratch, theater } = ctx;

  // 1. 全图 tile := waterSet
  for (const cell of cells.iterate()) {
    cell.tile = theater.waterSet;
  }

  // 2. 形状派发
  if (ctx.mapType === 0) waterShape0(ctx);
  else if (ctx.mapType === 1) waterShape1(ctx);
  else if (ctx.mapType === 2) waterShape2(ctx);

  // 3. 孤立水清除（四正交邻含哨兵，全 clear → tile = 0）
  for (const cell of cells.iterate()) {
    if (cell.tile !== theater.waterSet) continue;
    const [x, y] = coordOfCell(ctx, cell);
    let allClear = true;
    for (let d = 0; d < 8; d += 2) {
      const off = DIRECTION_OFFSETS[d];
      if (!isClearTile(cellAtD(ctx, x + off[0], y + off[1]))) {
        allClear = false;
        break;
      }
    }
    if (allClear) cell.tile = 0;
  }

  // 4. 区域重置：shoreFinalize(0,0)；暂存 +0x38/+0x3C = -1
  shoreFinalize(ctx, 0, 0);
  for (let i = 0; i < scratch.slots.length; i++) {
    scratch.slots[i].regionId = -1;
    scratch.slots[i].patchId = -1;
  }

  // 5. 岸→绿（含哨兵写入 —— 共享态，原生如此）
  for (const cell of cells.iterate()) {
    if (!isShorePieceTile(cell, theater)) continue;
    const [x, y] = coordOfCell(ctx, cell);
    for (let d = 0; d < 8; d += 2) {
      const off = DIRECTION_OFFSETS[d];
      const nb = cellAtD(ctx, x + off[0], y + off[1]);
      if (isClearTile(nb)) nb.tile = theater.greenTile;
    }
  }
}

// ─── 水体终结器（`0x0059C630`）

export function waterFinalize(ctx: WaterContext): void {
  const { rng, cells, scratch, theater } = ctx;
  const K = RANGE_K;
  for (const cell of cells.iterate()) {
    if (cell.tile !== theater.waterSet || cell.subTile !== 0) continue;
    const [x, y] = coordOfCell(ctx, cell);
    const e = orth(ctx, x, y, 2);
    const s = orth(ctx, x, y, 4);
    const se = orth(ctx, x, y, 3);
    const can2x2 =
      e !== null && e.tile === theater.waterSet && e.subTile === 0 &&
      s !== null && s.tile === theater.waterSet && s.subTile === 0 &&
      se !== null && se.tile === theater.waterSet && se.subTile === 0;

    if (can2x2) {
      let sel = 0;
      do {
        sel = ftol(chopAdd(chopMul(rng.next(), chopMul(10, K)), 1.0));
      } while (sel > 10);
      if (sel !== 1) {
        let v = 0;
        do {
          v = ftol(chopMul(rng.next(), chopMul(242, K)));
        } while (v > 0xf1);
        // 🔴 **2026-10-08 修正：除数是 40，不是 10**（capstone 实测 `59C630`）。
        //
        // 汇编 `59C74B..59C75C`：
        // ```asm
        // cmp  ecx, 0F0h
        // jl   loc_59C74B            ; ecx < 240 → 走除法
        // mov  edi, 0F7h / sub edi, ecx / jmp ⇒ edi = 247 − ecx   ; ecx ∈ {240,241} → {7,6}
        // loc_59C74B:
        // mov  eax, 66666667h
        // imul ecx                   ; 64 位积
        // sar  edx, 4                ; >>36
        // mov  ecx, edx / shr ecx,1Fh / add edx, ecx   ; 符号修正
        // mov  edi, edx              ; edi = floor(ecx / 40)
        // ```
        // `0x66666667 / 2^36 = 0.025 = 1/40`（魔数除法，标准编译器序列）。
        //
        // 旧实现写 `(v / 10) | 0` ⇒ 值域 [0,23] ⇒ tile **314..337**，
        // **越出水族 14 格边界**（真机水 tile 绝无 328..337），并连带打挂
        // `water - 形状 0/2 水陆共存` 单测。
        //
        // 真机双向验证（`re/tile_hist.js` / `re/our_hist.js`）：
        //   正确 `/40`：ecx∈[0,241] ⇒ edi∈[0,7] ⇒ tile 314..321（8 种）
        //     其中 edi∈[0,5] 各约 16.5%（每档 40 个 ecx），edi=6/7 各仅 1 个 ecx（~0.41%）
        //   真机 RandMap6 实测：`314..319` 各 1660~2164（高频）、`320:52 321:48`（极稀有）
        //   ⇒ **6 高 + 2 稀 = 8 种**，与 `/40` 的概率分布逐档吻合。
        const idx = v >= 0xf0 ? 0xf7 - v : (v / 40) | 0;
        const tag = scratch.at(x, y).regionId;
        placeTileBlock(ctx, theater.waterSet + idx, x, y, tag, -1);
        continue;
      }
    }
    let v = 0;
    do {
      v = ftol(chopMul(rng.next(), chopMul(201, K)));
    } while (v > 0xc8);
    // 同理：此处 `mul ecx`（magic `0xCCCCCCCD`）+ `shr edx,5` = **/40**（不是 /8 也不是 /40→/… ）
    // 值域 [0,200] ⇒ +0..+5 ⇒ tile 322..327，真机实测这 6 档各约 270~280 格。
    cell.tile = theater.waterSet + 8 + ((v / 40) | 0);
  }
}

function orth(ctx: WaterContext, x: number, y: number, d: number): NativeCell | null {
  const off = DIRECTION_OFFSETS[d];
  return ctx.cells.slotAt(x + off[0], y + off[1]);
}

/**
 * `Place_Tile_Block 0x005A6C10`。模板逐格：subtile = j·w+i、**tile = templateIndex（tile 号本身）**、
 * slope = 模板子格 slope；levelDelta ≠ -1 时 level = Δ + 模板子格 level − 4。
 * tag 写入 scratch+0x38。越界格跳过但**哨兵格可被写入**（共享态）。
 *
 * ⚠ 写入的是 **tile 号**，不是所属 tileset 的基址（见上方
 * `tileSetIndexOfTile` 处的真机实证说明）。`tileSetIndexOfTile` 仍用于取模板元数据。
 */
export function placeTileBlock(
  ctx: WaterContext,
  templateIndex: number,
  xd: number,
  yd: number,
  tag: number,
  levelDelta: number,
): void {
  const { cells, scratch, theater } = ctx;
  const ti = tileSetIndexOfTile(theater, templateIndex);
  if (theater.tileSets[ti] === undefined) return;
  const w = templateWidth(theater, templateIndex);
  const h = templateHeight(theater, templateIndex);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const sub = j * w + i;
      const cx = xd + i;
      const cy = yd + j;
      if (!cells.inDiamondBounds(cx, cy)) continue;
      const cell = cells.cellAt(cx, cy);
      cell.subTile = sub;
      cell.tile = templateIndex;
      if (levelDelta !== -1) {
        cell.level = (levelDelta + templateSubLevel(theater, templateIndex, sub) - 4) & 0xff;
      }
      cell.slope = templateSubSlope(theater, templateIndex, sub);
      scratch.at(cx, cy).regionId = tag;
    }
  }
}

// 模板元数据：模板实参是 **tile 号**（`IsoTileType` per-tile 对象）。
//
// 🔴 **2026-10-08 修正（真机 RandMap4/5/6 实证）**
// 旧注释断言「写入的 tile 值 = 该 tile 所属 tileset 的基址」，据此 `placeTileBlock`
// 与 `shoreStampTile` 都写 `ts.base`。**这是错的**，原生 `0x57B440`（size=0x350）盖章处是：
// ```c
// LABEL_32:
//   v14[14] = *(_DWORD *)(v29 + 660);          // ← 写「模板对象 +660」
//   *((_BYTE*)v14 + 282) = v15;                 // subtile
//   *((_BYTE*)v14 + 283) = a3 + *(_BYTE*)(v16 + 40);  // level = levelBase + tmpl.subHeight
// ```
// `v29 = dword_880990` 就是**被选中的那个 IsoTileType 模板对象**，`+660` 字段
// 存的是它自己的 **tile 号**（不是 tileset 基址）。同一个字段在兼容性判定里也被
// 当 tile 号用：`v24 = *(_DWORD *)(v29 + 660) - dword_ABAD28`，直接去减
// `ShorePieces` 基址 —— 只有「tile 号」才减得通，tileset 基址恒等于 ABAD28，
// 该减法恒为 0。
//
// 真机基线双向验证（`re/tile_hist.js`）：
//   原生公式 tile = ShorePieces + v12 − 1，v12 ∈ [1,41] ⇒ 值域 **89..129**
//   RandMap4 观测 shore tile **89..128**（38 种）、RandMap6 **89..128**（40 种）
//   旧口径（tileset 基址）⇒ 恒 **89**（1 种）—— 与真机完全不符
//   同理 ramp：原生 slope+29−1 ⇒ 29..47，真机观测 29..46
//
// ⇒ `templateIndex`（= tile 号）可直接写入 `cell.tile`；`tileSetIndexOfTile`
//   仍用于查 `ts` 模板元数据，但**不再决定写入值**。
//
// w/h 来自 .TMP 资产（TileSetClass+740/744）—— 平水假设：水族大块 2×2、
// 其余 1×1。UNVERIFIED —— 待 oracle 抓取真机值后替换（README「未认证」）。
function tileSetIndexOfTile(t: TheaterTables, tile: number): number {
  let lo = 0;
  let hi = t.tileSets.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (t.tileSets[mid].base <= tile) lo = mid + 1;
    else hi = mid - 1;
  }
  return hi;
}

function templateWidth(t: TheaterTables, tile: number): number {
  return tile >= t.waterSet && tile < t.waterSet + 14 ? 2 : 1;
}
function templateHeight(t: TheaterTables, tile: number): number {
  return tile >= t.waterSet && tile < t.waterSet + 14 ? 2 : 1;
}
function templateSubLevel(_t: TheaterTables, _tile: number, _sub: number): number {
  return 0;
}
function templateSubSlope(_t: TheaterTables, _tile: number, _sub: number): number {
  return 0;
}

// ─── 岸线（`0x0057A0C0` + 三趟 + 0x0057B210 + 0x0057B440）

/**
 * 岸线掩码探测 `0x0057B210`。
 * probe 0 = 仅 clear 格；1 = 排除水族；2 = 无前置过滤。结果缓存 +0x40。
 */
export function shoreMaskProbe(
  ctx: WaterContext,
  xd: number,
  yd: number,
  probe: number,
): number {
  const { cells, scratch, theater } = ctx;
  if (!cells.inDiamondBounds(xd, yd)) return 0;
  const cell = cells.slotAt(xd, yd);
  if (cell === null) return 0;
  if (probe === 1) {
    if (isWaterTile(cell, theater)) return 0;
  } else if (probe === 0) {
    if (!isClearTile(cell)) return 0;
  }
  const slot = scratch.at(xd, yd);
  if (slot.shoreEnabled === 0) return 0;
  if (slot.shoreMask >= 0) return slot.shoreMask;

  const selfWater = isWaterTile(cell, theater);
  // 计算次序与位分配（原生）：NW=0x40 NE=0x80 N=0x01 W=0x20 E=0x02
  //                       SW=0x10 S=0x08 SE=0x04；图外邻 + 自身水 → 计为水
  const w = (x: number, y: number): boolean => isWaterTile(cells.cellAt(x, y), theater);
  const m =
    (w(xd - 1, yd - 1) || (!cells.slotAt(xd - 1, yd - 1) && selfWater) ? 0x40 : 0) |
    (w(xd, yd - 1) || (!cells.slotAt(xd, yd - 1) && selfWater) ? 0x80 : 0) |
    (w(xd + 1, yd - 1) || (!cells.slotAt(xd + 1, yd - 1) && selfWater) ? 0x01 : 0) |
    (w(xd - 1, yd) || (!cells.slotAt(xd - 1, yd) && selfWater) ? 0x20 : 0) |
    (w(xd + 1, yd) || (!cells.slotAt(xd + 1, yd) && selfWater) ? 0x02 : 0) |
    (w(xd - 1, yd + 1) || (!cells.slotAt(xd - 1, yd + 1) && selfWater) ? 0x10 : 0) |
    (w(xd, yd + 1) || (!cells.slotAt(xd, yd + 1) && selfWater) ? 0x08 : 0) |
    (w(xd + 1, yd + 1) || (!cells.slotAt(xd + 1, yd + 1) && selfWater) ? 0x04 : 0);
  slot.shoreMask = m;
  return m;
}

/** probe 结果在趟函数里按 **signed char** 使用（bit0x80 → 负数） */
function toSignedChar(v: number): number {
  return v > 127 ? v - 256 : v;
}

/** 岸线终结器 `0x0057A0C0`。返回 0 = 有趟失败；否则最后趟的值。 */
export function shoreFinalize(ctx: WaterContext, tag: number, mode: number): number {
  const { cells, scratch } = ctx;
  // 原生 0x57A0C0 入口：全部暂存 +0x40（掩码缓存）清 -1 —— 每次调用都清，
  // 否则 blob 阶段的陈旧掩码会污染后续岸线判定（内陆盖岸线片的根因）
  for (const slot of scratch.slots) slot.shoreMask = -1;
  // 原生每次调用都重建 tag 堆（operator new + 58BDC0 ⇒ tag 全 0）
  if (ctx.shoreTags === undefined || ctx.shoreTags.length !== scratch.slots.length) {
    ctx.shoreTags = new Int32Array(scratch.slots.length);
  } else {
    ctx.shoreTags.fill(0);
  }
  let j = 1;
  for (const cell of cells.iterate()) {
    if (j === 0) break;
    const [x, y] = coordOfCell(ctx, cell);
    j = shorePass1(ctx, x, y, tag, mode);
  }
  for (const cell of cells.iterate()) {
    if (j === 0) break;
    const [x, y] = coordOfCell(ctx, cell);
    shorePass2(ctx, x, y, tag, mode);
  }
  for (const cell of cells.iterate()) {
    if (j === 0) break;
    const [x, y] = coordOfCell(ctx, cell);
    if (!shorePass34(ctx, x, y, 1, tag, mode)) j = 0;
  }
  for (const cell of cells.iterate()) {
    if (j === 0) break;
    const [x, y] = coordOfCell(ctx, cell);
    if (!shorePass34(ctx, x, y, 2, tag, mode)) j = 0;
  }
  return j;
}

/** 趟 1 `0x0057A430`：直岸检测 → 复位为水底 + 8 邻递归刷新 */
function shorePass1(
  ctx: WaterContext,
  xd: number,
  yd: number,
  tag: number,
  mode: number,
): number {
  const { cells, scratch, theater } = ctx;
  scratch.at(xd, yd).shoreMask = shoreMaskProbe(ctx, xd, yd, 2);
  const maskC = toSignedChar(shoreMaskProbe(ctx, xd, yd, 0));
  const maskU = maskC < 0 ? maskC + 256 : maskC;
  // 原生 `v8 > 0` 是 **signed char** 比较：bit0x80 置位（NE 水）→ 整格跳过
  if (maskC <= 0) return 1;
  let need = false;
  if (maskU === 11 || maskU === 26) need = true;
  if (
    ((maskU & 0xa0) === 0xa0 && (maskU & 0x11) === 0) ||
    ((maskU & 0x82) === 0x82 && (maskU & 0x44) === 0) ||
    ((maskU & 0x0a) === 0x0a && (maskU & 0x11) === 0) ||
    ((maskU & 0x28) === 0x28 && (maskU & 0x44) === 0)
  ) {
    need = true;
  }
  if ((maskU & 0x20) !== 0) {
    const m1 = toSignedChar(shoreMaskProbe(ctx, xd + 1, yd, 0));
    const m2 = toSignedChar(shoreMaskProbe(ctx, xd + 2, yd, 0));
    if ((m1 & 2) !== 0 || (m2 & 2) !== 0) need = true;
  }
  if ((maskU & 2) !== 0) {
    const m1 = toSignedChar(shoreMaskProbe(ctx, xd - 1, yd, 0));
    const m2 = toSignedChar(shoreMaskProbe(ctx, xd - 2, yd, 0));
    if ((m1 & 0x20) !== 0 || (m2 & 0x20) !== 0) need = true;
  }
  if ((maskC & 8) !== 0) {
    const m1 = toSignedChar(shoreMaskProbe(ctx, xd, yd - 1, 0));
    const m2 = toSignedChar(shoreMaskProbe(ctx, xd, yd - 2, 0));
    if (m1 < 0 || m2 < 0) need = true;
  }
  if (maskC < 0) {
    const m1 = toSignedChar(shoreMaskProbe(ctx, xd, yd + 1, 0));
    const m2 = toSignedChar(shoreMaskProbe(ctx, xd, yd + 2, 0));
    if ((m1 & 8) !== 0 || (m2 & 8) !== 0) need = true;
  }
  if ((maskU & 0x88) === 0x88 || (maskU & 0x22) === 0x22 || need) {
    // 原生 `v33 = sub_5A00C0(&i)` 读的是**独立 tag 堆**（+56），不是 scratch.regionId
    const ti2 = shoreTagIndex(ctx, xd, yd);
    const curTag = ctx.shoreTags !== undefined ? ctx.shoreTags[ti2] : 0;
    if (curTag > 0 && curTag !== tag && mode === 0) return 0;
    const cell = cells.slotAt(xd, yd);
    if (cell === null) return 1;
    cell.subTile = 0;
    cell.tile = theater.waterSet;
    if (ctx.shoreTags !== undefined) ctx.shoreTags[ti2] = mode !== 0 ? 0 : tag;
    for (let d = 0; d < 8; d++) {
      const off = DIRECTION_OFFSETS[d];
      const nx = xd + off[0];
      const ny = yd + off[1];
      if (!cells.inDiamondBounds(nx, ny)) continue;
      scratch.at(nx, ny).shoreMask = -1;
      if (shorePass1(ctx, nx, ny, tag, mode) === 0) return 0;
    }
  }
  return 1;
}

/** 趟 2 `0x0057A320`：特定掩码组合的水格 → 0xFFFF 待重铺 + 刷新邻缓存 */
function shorePass2(
  ctx: WaterContext,
  xd: number,
  yd: number,
  tag: number,
  mode: number,
): void {
  const { cells, scratch, theater } = ctx;
  const cell = cells.slotAt(xd, yd);
  if (cell === null) return;
  if (cell.tile < theater.waterSet || cell.tile >= theater.waterSet + 12) return;
  const probe2 = shoreMaskProbe(ctx, xd, yd, 2);
  if (
    probe2 === 199 || probe2 === 124 || probe2 === 241 || probe2 === 31 ||
    probe2 === 198 || probe2 === 108 || probe2 === 177 || probe2 === 27
  ) {
    cell.tile = TILE_NONE;
    cell.subTile = 0;
    if (mode !== 0) scratch.at(xd, yd).regionId = tag;
    for (let d = 0; d < 8; d++) {
      const off = DIRECTION_OFFSETS[d];
      const nx = xd + off[0];
      const ny = yd + off[1];
      if (!cells.inDiamondBounds(nx, ny)) continue;
      const s = scratch.at(nx, ny);
      s.shoreMask = -1;
      s.shoreMask = shoreMaskProbe(ctx, nx, ny, 2);
    }
  }
}

/**
 * 趟 3/4 `0x0057ACF0`。kind 1 = 单边（probe 0），kind 2 = 组合（probe 1）。
 * 每格恰 1 抽（nextUniformRange(0,5)）。返回 false = 上层中止。
 */
function shorePass34(
  ctx: WaterContext,
  xd: number,
  yd: number,
  kind: number,
  tag: number,
  mode: number,
): boolean {
  const { cells, rng, scratch, theater } = ctx;
  const cell = cells.slotAt(xd, yd);
  if (cell === null) return true;
  // `NextUniformRange 0x00598030` + 拒绝（>5 重抽）；原生在掩码检查**之前**抽
  let draw = rng.next();
  let variant = nextUniformRange(draw, 0, 5);
  while (variant > 5) {
    draw = rng.next();
    variant = nextUniformRange(draw, 0, 5);
  }
  const rawMask = shoreMaskProbe(ctx, xd, yd, kind === 2 ? 1 : 0);
  if (rawMask === 0) return true;
  const mask = toSignedChar(rawMask);

  let v12: number;
  if (kind !== 2) {
    if ((rawMask & 2) !== 0) {
      const run = shoreRun(ctx, xd, yd, 4, 2);
      if (
        ((run & 1) !== 0 && mask >= 0) ||
        (mask & 4) === 0 ||
        (mask & 0x18) !== 0
      ) {
        v12 = 12;
      } else {
        v12 = Math.abs(mask % 3) + 9;
      }
    } else if ((rawMask & 0x20) !== 0) {
      const run = shoreRun(ctx, xd, yd, 4, 6);
      if (
        ((run & 1) !== 0 && mask >= 0) ||
        (mask & 0x10) === 0 ||
        (mask & 0x0c) !== 0
      ) {
        v12 = 28;
      } else {
        v12 = Math.abs(mask % 3) + 25;
      }
    } else if ((rawMask & 8) !== 0) {
      const run = shoreRun(ctx, xd, yd, 2, 4);
      if ((run & 1) !== 0 || (mask & 4) === 0 || (mask & 3) !== 0) {
        v12 = 4;
      } else {
        v12 = Math.abs(mask % 3) + 1;
      }
    } else if ((rawMask & 0x80) !== 0) {
      const run = shoreRun(ctx, xd, yd, 2, 0);
      if ((run & 1) !== 0 || (mask & 1) === 0 || (mask & 6) !== 0) {
        v12 = 20;
      } else {
        v12 = Math.abs(mask % 3) + 17;
      }
    } else if ((rawMask & 1) !== 0) {
      v12 = (variant & 1) + 35;
    } else if ((rawMask & 4) !== 0) {
      v12 = (variant & 1) + 33;
    } else if ((rawMask & 0x10) !== 0) {
      v12 = (variant & 1) + 39;
    } else if ((rawMask & 0x40) !== 0) {
      v12 = (variant & 1) + 37;
    } else {
      return true;
    }
  } else {
    if ((rawMask & 0xa0) === 0xa0) {
      if ((rawMask & 0x11) === 0x11) v12 = (variant & 1) + 23;
      else v12 = (rawMask & 1) !== 0 ? 21 : 30;
    } else if ((rawMask & 0x82) === 0x82) {
      if ((rawMask & 0x44) === 0x44) v12 = (variant & 1) + 15;
      else v12 = (rawMask & 4) !== 0 ? 14 : 22;
    } else if ((rawMask & 0x0a) === 0x0a) {
      if ((rawMask & 0x11) === 0x11) v12 = (variant & 1) + 7;
      else v12 = (rawMask & 1) !== 0 ? 13 : 6;
    } else if ((rawMask & 0x28) === 0x28) {
      if ((rawMask & 0x44) === 0x44) v12 = (variant & 1) + 31;
      else v12 = (rawMask & 4) !== 0 ? 5 : 29;
    } else {
      return true;
    }
  }
  if (v12 <= 0) return true;

  // 锚点偏移（word_ABDB64/66 运行时值 = 磁盘值 = 恒 (-1,-1)，无写入者）
  // UNVERIFIED：待 oracle 抓取确认。
  const ax = xd - 1;
  const ay = yd - 1;
  const range: [number, number] =
    kind === 2 ? [theater.shorePieces, theater.shorePieces + 41] : [0, 0];
  return shoreStampTile(
    ctx,
    ax,
    ay,
    theater.shorePieces + v12 - 1,
    cell.level,
    range,
    tag,
    mode,
  );
}

/** 趟 3/4 的 run 扫描：A = cell+step，B = A+cross；A 非水且 B 水时沿 step 计数 */
function shoreRun(
  ctx: WaterContext,
  xd: number,
  yd: number,
  stepDir: number,
  crossDir: number,
): number {
  const { cells, theater } = ctx;
  let count = 1;
  const st = DIRECTION_OFFSETS[stepDir];
  const cr = DIRECTION_OFFSETS[crossDir];
  let ax = xd + st[0];
  let ay = yd + st[1];
  let bx = ax + cr[0];
  let by = ay + cr[1];
  const a0 = cells.slotAt(ax, ay);
  const b0 = cells.slotAt(bx, by);
  const aNotWater = a0 === null || !isWaterTile(a0, theater);
  let bWater = b0 !== null && isWaterTile(b0, theater);
  if (aNotWater) {
    for (;;) {
      if (!bWater) break;
      count++;
      ax += st[0];
      ay += st[1];
      bx += st[0];
      by += st[1];
      const na = cells.slotAt(ax, ay);
      const nb = cells.slotAt(bx, by);
      const naNotWater = na === null || !isWaterTile(na, theater);
      bWater = nb !== null && isWaterTile(nb, theater);
      if (!naNotWater) break;
    }
  }
  return count;
}

/** `sub_578D80(newTileBase, subtile)`：瀑布/悬崖族 subtile 兼容 */
export function shoreSubCompatCheck(
  t: TheaterTables,
  tileBase: number,
  subtile: number,
): boolean {
  if (inRange(tileBase, t.cliffSet, 40)) return true;
  if (inRange(tileBase, t.waterfallEast, 4)) {
    if (tileBase === t.waterfallEast || tileBase === t.waterfallEast + 3) {
      return subtile !== 0 && subtile !== 4;
    }
    return true;
  }
  if (inRange(tileBase, t.waterfallWest, 4)) {
    if (tileBase === t.waterfallWest || tileBase === t.waterfallWest + 3) {
      return subtile !== 1 && subtile !== 3;
    }
    return true;
  }
  if (inRange(tileBase, t.waterfallSouth, 4)) {
    if (tileBase === t.waterfallSouth || tileBase === t.waterfallSouth + 3) {
      return subtile >= 2;
    }
    return true;
  }
  if (inRange(tileBase, t.waterfallNorth, 4)) {
    if (tileBase === t.waterfallNorth || tileBase === t.waterfallNorth + 3) {
      return subtile !== 2 && subtile !== 3;
    }
    return true;
  }
  return t.cliffRamps >= 0 && tileBase >= t.cliffRamps && tileBase < t.cliffRamps + 20;
}

/** `sub_4863D0(cell)`：桥/悬崖/坡族成员（含 [DestroyableCliffs基-2,0) 恒真怪癖） */
export function shoreFamilyD0(cell: NativeCell, t: TheaterTables): boolean {
  const v = cell.tile;
  if (t.cliffSet >= 0 && inRange(v, t.cliffSet, 40)) return true;
  if (t.waterfallEast >= 0 && inRange(v, t.waterfallEast, 4)) {
    if (v === t.waterfallEast || v === t.waterfallEast + 3) {
      return cell.subTile !== 0 && cell.subTile !== 4;
    }
    return true;
  }
  if (t.waterfallWest >= 0 && inRange(v, t.waterfallWest, 4)) {
    if (v === t.waterfallWest || v === t.waterfallWest + 3) {
      return cell.subTile !== 1 && cell.subTile !== 3;
    }
    return true;
  }
  if (t.waterfallSouth >= 0 && inRange(v, t.waterfallSouth, 4)) {
    if (v === t.waterfallSouth || v === t.waterfallSouth + 3) {
      return cell.subTile >= 2;
    }
    return true;
  }
  if (t.waterfallNorth >= 0 && inRange(v, t.waterfallNorth, 4)) {
    if (v === t.waterfallNorth || v === t.waterfallNorth + 3) {
      return cell.subTile !== 2 && cell.subTile !== 3;
    }
    return true;
  }
  if (t.cliffRamps >= 0 && inRange(v, t.cliffRamps, 20)) return true;
  if (t.waterCaves !== -1 && inRange(v, t.waterCaves, 4)) return true;
  if (t.bridges !== -1 && inRange(v, t.bridges, 16)) return true;
  if (t.woodBridges !== -1 && inRange(v, t.woodBridges, 16)) return true;
  // DestroyableCliffs 缺省 -2 → [-2, 0)；按 32 位有符号 tile 语义：
  // 只有写为负数的 tile（本管线不产生）会命中
  const sv = v > 0x7fffffff ? v - 0x100000000 : v;
  if (sv >= t.destroyableCliffs && sv < t.destroyableCliffs + 2) return true;
  if (t.slopeSetPieces !== -1 && inRange(v, t.slopeSetPieces, 28)) return true;
  return false;
}

/**
 * 岸线模板盖章 `0x0057B440`。
 *
 * 返回值语义来自 `*a5` 标志（Pass34 据此决定是否中止）：
 *   - 盖章成功 / A 表兼容跳过 / 非 clear 且 tag=-1 跳过 → true（继续）；
 *   - 82A89C 差值 [3,5] / 82A7F4 族不兼容 / 尾部 578D80·4863D0 命中 → false（中止）。
 */
function shoreStampTile(
  ctx: WaterContext,
  ax: number,
  ay: number,
  templateIndex: number,
  levelBase: number,
  range: [number, number],
  tag: number,
  mode: number,
): boolean {
  const { cells, scratch, theater } = ctx;
  const ti = tileSetIndexOfTile(theater, templateIndex);
  if (theater.tileSets[ti] === undefined) return false;
  const w = templateWidth(theater, templateIndex);
  const h = templateHeight(theater, templateIndex);
  // 原生入口：mode != 0 时 tag 直接清零
  const claim = mode !== 0 ? 0 : tag;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const sub = j * w + i;
      const cx = ax + i;
      const cy = ay + j;
      if (!cells.inDiamondBounds(cx, cy)) continue;
      const cell = cells.cellAt(cx, cy);
      const slot = scratch.at(cx, cy);
      // 原生 `v17 = sub_5A00C0(&v31)` 读的是**独立 tag 堆**，不是 scratch.regionId
      const ti2 = shoreTagIndex(ctx, cx, cy);
      const curTag = mode !== 0 ? 0 : ctx.shoreTags !== undefined ? ctx.shoreTags[ti2] : 0;

      // ⚠ `ts.base` → `templateIndex`：原生 `*(DWORD*)(v29+660)` 就是 tile 号。
      //   兼容性判定两侧（`v14[14]` / `v29+660`）都直接减 shorePieces 基址，
      //   只有 tile 号语义才自洽（见 tileSetIndexOfTile 上方实证）。
      if (curTag === claim) {
        // LABEL_20：82A89C 差值 ∈ [3,5] → 冲突
        const a = cell.tile - theater.shorePieces;
        const b = templateIndex - theater.shorePieces;
        if (a >= 0 && b >= 0 && a <= 41 && b <= 41) {
          const diff = Math.abs(SHORE_COMPAT_B[a] - SHORE_COMPAT_B[b]);
          if (diff >= 3 && diff <= 5) return false;
        }
      } else if (claim !== -1) {
        if (!isClearTile(cell)) {
          const a = cell.tile - theater.shorePieces;
          const b = templateIndex - theater.shorePieces;
          if (
            a < 0 ||
            b < 0 ||
            a > 41 ||
            b > 41 ||
            SHORE_COMPAT_A[a] !== SHORE_COMPAT_A[b]
          ) {
            return false; // *a5 = 0
          }
          return true; // 兼容：整体放行（原生 return 1）
        }
        if (ctx.shoreTags !== undefined) ctx.shoreTags[ti2] = claim;
      } else {
        // tag == -1 且他 tag 占用
        if (!isClearTile(cell)) continue; // LABEL_36
        if (ctx.shoreTags !== undefined) ctx.shoreTags[ti2] = claim;
      }

      // LABEL_32
      if (isClearTile(cell) || (cell.tile >= range[0] && cell.tile <= range[1])) {
        cell.tile = templateIndex;
        cell.subTile = sub;
        cell.level = (levelBase + templateSubLevel(theater, templateIndex, sub)) & 0xff;
        continue; // LABEL_36
      }
      // 非可覆盖格：兼容命中 → *a5 = 0（中止）；未命中 → *a5 保持 1（跳过）
      if (
        (isShorePieceTile(cell, theater) &&
          shoreSubCompatCheck(theater, templateIndex, sub)) ||
        (templateIndex >= theater.shorePieces &&
          templateIndex < theater.shorePieces + 42 &&
          shoreFamilyD0(cell, theater))
      ) {
        return false;
      }
      return true;
    }
  }
  return true;
}

/** `dword_82A7F4[0..41]`（从 exe 文件映像逐 dword 读出） */
export const SHORE_COMPAT_A: readonly number[] = [
  0, 0, 0, 1, 2, 3, 4, 4, 5, 5, 5, 6, 7, 8, 9, 9,
  10, 10, 10, 11, 12, 13, 14, 14, 15, 15, 15, 16, 17, 18, 19, 19,
  20, 20, 21, 21, 22, 22, 23, 23, 24, 25,
];

/** `dword_82A89C[0..41]` */
export const SHORE_COMPAT_B: readonly number[] = [
  4, 4, 4, 4, 4, 4, 3, 3, 2, 2, 2, 2, 2, 2, 1, 1,
  0, 0, 0, 0, 0, 0, 7, 7, 6, 6, 6, 6, 6, 6, 5, 5,
  3, 3, 1, 1, 7, 7, 5, 5, 4, 4,
];
