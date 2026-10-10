/**
 * 原生状态层 —— CellClass 数组 + RMG 暂存 + 菱形几何 + 蛇形迭代器
 *
 * 与 cell.ts 的 `RmgGrid`（包围盒对象模型，emit 用）并列；本文件是
 * **位精确对拍用**的原生模型，字段布局/寻址/遍历序全部按 gamemd 汇编还原：
 *
 *   CellClass[]  512×512 槽（index = x_d + y_d*512，x_d/y_d 为菱形坐标 i16），
 *                带外槽 = null；越界坐标访问落到**共享哨兵格** 0x00ABDC50
 *                （写进去会留在哨兵里 —— 原生如此，本模型一致）。
 *   菱形变换      map(mx,my) → diamond(mx+my+1, W−mx+my)；W = mapW。
 *                diamond → map((x−y+W−1)/2, (x+y−W−1)/2)（Blob_EllipseTest 0x59BAB0）。
 *   菱形界        sum = x+y ∈ (W, W+2·mapH] 且 |x−y| < W。
 *   暂存          W₂×W₂ 槽（W₂ = genW+genH+17 = g_PathfinderLinearMapWidth），
 *                stride 0x50，index = x_d + y_d*W₂。
 *   迭代器        0x578350/0x578290 —— 蛇形（boustrophedon）反对角带扫描，
 *                逐指令还原见 `nextCell()`；带外槽返回 0 终止。
 */

import { DIRECTION_OFFSETS } from './cell';

/** CellClass 的 RMG 可见字段（+0x24 坐标不存——由槽位推出） */
export interface NativeCell {
  /** +0x38 tile 索引；0 = clear，0xFFFF = 未分配/无效 */
  tile: number;
  /** +0x44 overlay，-1 = 无 */
  overlay: number;
  /** +0x4C 通行类别 */
  passability: number;
  /** +0xE4 占位者指针（RMG 只判 0/非 0） */
  occupied: number;
  /** +0xEC LandType */
  landType: number;
  /** +0x11A subtile */
  subTile: number;
  /** +0x11B level（u8 语义，按 0..255 存） */
  level: number;
  /** +0x11C slope */
  slope: number;
  /** +0x11D 冰面坡度分级（(TMP高度−30)/15；渲染用，阶段不消费） */
  grade: number;
  /** +0x11E 矿密度 */
  density: number;
  /** +0x140 flags */
  flags: number;
}

export const TILE_NONE = 0xffff;

function freshCell(): NativeCell {
  return {
    tile: 0,
    overlay: -1,
    passability: 0,
    occupied: 0,
    landType: 0,
    subTile: 0,
    level: 4,
    slope: 0,
    grade: 0,
    density: 0,
    flags: 0,
  };
}

/**
 * 512×512 cell 表。
 * `mapW`/`mapH` 为 `[Map] Size`（genW+4 / genH+12）。
 */
export class NativeCells {
  readonly mapW: number;
  readonly mapH: number;
  /** 线性宽（暂存边长）= genW+genH+17 */
  readonly linearW: number;
  private readonly slots: (NativeCell | null)[] = new Array(512 * 512).fill(null);
  /** 共享哨兵格 0x00ABDC50（越界 DiamondToCell 的落点，写入会滞留） */
  readonly sentinel: NativeCell = freshCell();

  constructor(mapW: number, mapH: number) {
    this.mapW = mapW;
    this.mapH = mapH;
    this.linearW = mapW + mapH + 1; // = genW + genH + 17（g_PathfinderLinearMapWidth）
  }

  /** 菱形 → map 坐标（Blob_EllipseTest 0x59BAB0 的逆变换；C 除法**向零截断**） */
  toMap(xd: number, yd: number): [number, number] {
    return [
      Math.trunc((xd - yd + this.mapW - 1) / 2),
      Math.trunc((xd + yd - this.mapW - 1) / 2),
    ];
  }

  /** map → 菱形坐标（LandBlobFlood 随机种子公式同源） */
  toDiamond(mx: number, my: number): [number, number] {
    return [mx + my + 1, this.mapW - mx + my];
  }

  /**
   * 槽是否在 playfield（即原生 512×512 指针数组里非 null 的槽）。
   *
   * 原生分配 = 蛇形迭代器扫过的**全部**反对角带（含「交错带」）：
   * 第 k 带（k = 0..2H−2）起点 (⌈k/2⌉+1, W+⌊k/2⌋)，长度 W（k 偶）/ W−1（k 奇）格，
   * 每步 (+1,−1)。交错带的格是 RA2 地图的可视边缘格（playable 菱形之外），
   * RMG 阶段同样会在它们上写 tile —— 这不是 bug，是原生行为。
   */
  inPlayfield(xd: number, yd: number): boolean {
    if (xd < 0 || yd < 0 || xd >= 512 || yd >= 512) return false;
    return this.slots[yd * 512 + xd] !== null;
  }

  /** 菱形界测试（Blob 邻域/盖章共用的形状：sum∈(W, W+2H] 且 |x−y|<W） */
  inDiamondBounds(xd: number, yd: number): boolean {
    const sum = xd + yd;
    return (
      sum > this.mapW &&
      xd - yd < this.mapW &&
      yd - xd < this.mapW &&
      sum <= this.mapW + 2 * this.mapH
    );
  }

  /** `DiamondToCell 0x005657A0`：带外 → 哨兵格（共享，写入滞留） */
  cellAt(xd: number, yd: number): NativeCell {
    if (xd < 0 || yd < 0 || xd >= 512 || yd >= 512) return this.sentinel;
    const slot = this.slots[yd * 512 + xd];
    if (slot === null) return this.sentinel;
    return slot;
  }

  /** 原生槽指针语义：playfield 内 → 实格；否则 null（区别于哨兵） */
  slotAt(xd: number, yd: number): NativeCell | null {
    if (!this.inPlayfield(xd, yd)) return null;
    return this.slots[yd * 512 + xd];
  }

  /** 按蛇形迭代器的带结构分配全部 cell（含交错带；见 `inPlayfield` 注释） */
  allocate(): void {
    const W = this.mapW;
    for (let k = 0; k <= 2 * this.mapH - 2; k++) {
      const sx = Math.ceil(k / 2) + 1;
      const sy = W + Math.floor(k / 2);
      const len = k % 2 === 0 ? W : W - 1;
      for (let i = 0; i < len; i++) {
        const x = sx + i;
        const y = sy - i;
        if (x >= 0 && y >= 0 && x < 512 && y < 512) {
          this.slots[y * 512 + x] = freshCell();
        }
      }
    }
  }

  /** `AdjacentCell 0x00481810`：dir 0..7 = N,NE,E,SE,S,SW,W,NW；越界 → 哨兵 */
  neighbor(cell: NativeCell, dir: number): NativeCell;
  neighbor(xd: number, yd: number, dir: number): NativeCell;
  neighbor(a: NativeCell | number, b: number, dir?: number): NativeCell {
    let xd: number;
    let yd: number;
    if (typeof a === 'number') {
      xd = a;
      yd = b;
      dir = dir as number;
    } else {
      // 由 cell 反查坐标：遍历成本高，此重载仅用于测试；生产路径用坐标重载
      throw new Error('neighbor(cell) 仅测试用；请用 neighbor(xd, yd, dir)');
    }
    const off = DIRECTION_OFFSETS[dir & 7];
    return this.cellAt(xd + off[0], yd + off[1]);
  }

  /**
   * `CellIterator 0x578350/0x578290` —— 蛇形反对角带扫描。
   *
   * 逐指令还原（mapW=4 手工验证覆盖整菱形）：
   *   init : x=1, y=mapW, band=mapW-1, ptr=cell(1,mapW)
   *   next : 若 band≠0：返回 ptr；x++, y--, band--
   *          若 band==0：先返回 ptr（当前带末格），然后 (x,y):=(y,x)；
   *          parity = (y_old − W + x_old − 1) & 1：
   *            奇 → band=W-1, y = x_old+1；偶 → band=W-2, x = y_old+1
   *          ptr = cell(x,y)
   *   带外/null → 0（终止）
   */
  *iterate(): Generator<NativeCell> {
    const W = this.mapW;
    let x = 1;
    let y = W;
    let band = W - 1;
    // 返回当前 ptr 槽；null 视为终止（原生返回 0）
    const peek = (): NativeCell | null => {
      if (x < 0 || y < 0 || x >= 512 || y >= 512) return null;
      return this.slots[y * 512 + x];
    };

    // 原生 first-call 语义：init 后第一次 next() 先推进再返回 —— 即首格是
    // cell(2, W-1)？不对：反汇编 `return *(dword ptr [ebp-8](=ptr))` 在推进
    // **之前**取值（0x578296: mov eax,[ebp+..]; ... return *v2）。首格 = (1,W)。
    for (;;) {
      if (band !== 0) {
        const cur = peek();
        if (cur === null) return;
        yield cur;
        x++;
        y--;
        band--;
      } else {
        const cur = peek();
        if (cur === null) return;
        yield cur;
        const yOld = y;
        const xOld = x;
        x = yOld;
        y = xOld;
        if ((((yOld - W + xOld - 1) & 1) & 0xff) !== 0) {
          band = W - 1;
          y = xOld + 1;
        } else {
          band = W - 2;
          x = yOld + 1;
        }
        const nxt = peek();
        if (nxt === null) return;
      }
    }
  }
}

/** 暂存槽（stride 0x50 的 RMG 语义子集） */
export interface ScratchSlot {
  /** +0x00 打包坐标（0,0 = 空槽） */
  coord: number;
  /** +0x08 目标高度 Δ（f64） */
  heightDelta: number;
  /** +0x10 速度（f64） */
  velocity: number;
  /** +0x18 / +0x20 / +0x28 rough/green/sand LAT 概率（f64） */
  latRough: number;
  latGreen: number;
  latSand: number;
  /** +0x38 region id / blob 标签（-1 无） */
  regionId: number;
  /** +0x3C 补丁 id / BFS 戳 / blob 认领 */
  patchId: number;
  /**
   * 阶段 3/4 的 **blob 领地**（原生 `dword_ABED10 + 80·i + 56`，byte +56）。
   *
   * ⚠ 与 `patchId(+0x3C)` 是两个**不同**的存储：
   *   - `+56` = blob 领地，**跨调用持久**（河切割写完，随后的湖生长仍可见）；
   *   - `+3C` = BFS 戳，`0x59C920` 入口每轮清零（`s.patchId = 0`）。
   * 把领地塞进 `patchId` 会被那次清零抹成 0，
   * 而 `0 >= 0` 会被判成"已被别的 blob 认领" ⇒ 湖洪泛第一格就中止。
   * `-1` = 未认领。
   */
  blobOwner: number;
  /** +0x40 岸线掩码缓存（-1 未算） */
  shoreMask: number;
  /** +0x45 水/岸锁 */
  waterLock: number;
  /** +0x47 树已访问 */
  treeVisited: number;
  /** +0x4A 岸线使能（map-prep 后 1） */
  shoreEnabled: number;
  /** +0x4B 水/桥旗标 */
  waterBridgeFlags: number;
}

/** RMG 暂存网格（`DAT_00ABED10`，stride 0x50，W₂×W₂） */
export class ScratchGrid {
  readonly size: number;
  readonly slots: ScratchSlot[];

  constructor(linearW: number) {
    this.size = linearW;
    this.slots = new Array(linearW * linearW);
    for (let i = 0; i < this.slots.length; i++) {
      this.slots[i] = {
        coord: 0,
        heightDelta: 0,
        velocity: 0,
        latRough: 0,
        latGreen: 0,
        latSand: 0,
        regionId: 0,
        patchId: 0,
        blobOwner: -1,
        shoreMask: -1,
        waterLock: 0,
        treeVisited: 0,
        shoreEnabled: 1,
        waterBridgeFlags: 0,
      };
    }
  }

  at(xd: number, yd: number): ScratchSlot {
    return this.slots[yd * this.size + xd];
  }
}
