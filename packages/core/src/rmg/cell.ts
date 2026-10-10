/**
 * Cell 级状态层 —— 对齐 `CellClass` + RMG `0x50` 暂存，以及阶段用 `GridCell`
 *
 * 与 `WorkingMap` 的「预置地块拼装」模型**并列**，不要合并。
 * 发射（emit）时投影到现有 `MapFile`（IsoMapPack5 + OverlayPack）。
 *
 * 字段来源（逆向规格书 §3 + vera20k `grid.rs` + 阶段 18 机器码复核）：
 *   CellClass：tile / subTile(+0x11A) / level(+0x11B) / slope(+0x11C) /
 *              density(+0x11E) / flags(+0x140) / landType(+0xEC) /
 *              diamondCoord(+0x24) / height(+0xA0, f64) / attachments(+0xE4)
 *   RMG scratch：regionId / patchId / shore 锁 / 树访问位等（阶段间共享）
 *
 * ⚠ **两套字段不要混**：`regionId`（RMG scratch 区域 id）与
 *   `polyIdLookup`/`polyId`（`+0x44`/`+0x98` **多边形** id）是不同概念，
 *   原生代码里二者同时存在且参与不同判定，**勿互相赋值**。
 *
 * 邻接次序 `DIRECTION_OFFSETS` 是契约：`N,NE,E,SE,S,SW,W,NW`
 * （`g_DirectionOffsets 0x0089F688`，静态映像全 0、运行时由 `0x49F2F0` 填入）。
 *
 * ✅ **本表已由 unicorn 实跑 gamemd.exe 验证 8/8 全对**（2026-10-07，
 * `re/oracle/dump_runtime_tables.py`）：原生 dword 表真值
 * `FFFF0000/FFFF0001/00000001/00010001/00010000/0001FFFF/0000FFFF/FFFFFFFF`
 * 逐项解回即本表。此前"原生表含重复项、缺 E 与 SW"的疑点已撤销
 * —— 那是读 Hex-Rays 伪码时看错 dword 常量所致（IDA 把 `dword_89F690 = 1`
 * 渲染成 `0x00010000`）。改动本表会连带影响阶段 5/6/12，仍需谨慎。
 */

/** 未分配图块哨兵（emit → IsoMapPack 的 -1） */
export const TILE_UNASSIGNED = -1;

/** map-prep 把生成格的 level 盖成 MapSeed+0x30C = 4 */
export const DEFAULT_GROUND_LEVEL = 4;

/**
 * 8 方向偏移，下标 = 方向码 0..7。
 * 次序：N, NE, E, SE, S, SW, W, NW —— 邻遍历必须按此序。
 */
export const DIRECTION_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

/** flags：bit 0x100 = 桥面上 */
export const FLAG_BRIDGE_DECK = 0x100;

/** scratch region id 特殊值 */
export const REGION_NONE = -1;
export const REGION_PENDING = -2;
export const REGION_CARVED = -3;

/** 一格生成状态（阶段读写） */
export interface RmgCell {
  /** 图块索引；0 = clear ground，TILE_UNASSIGNED = 未触 */
  tile: number;
  /** 多格块内子图块（0 = anchor/unset） */
  subTile: number;
  /** 地面高度字节 */
  level: number;
  /** 原生 slope id（0 平坦；坡道可达 ≥16） */
  slope: number;
  /** overlay 类型，-1 = 无 */
  overlay: number;
  /** overlay 密度/frame 字节 */
  density: number;
  /** 通行 class（CellClass+0x4C） */
  passability: number;
  /** LandType（CellClass+0xEC） */
  landType: number;
  /** CellClass+0x140 */
  flags: number;
  /** 占位者（树/科技建筑等） */
  occupied: boolean;
  /** 起点 waypoint 落点 */
  startMarker: boolean;

  // ---- RMG scratch（0x50 的语义子集，阶段间共享）----
  /** -1 无 / -2 pending / -3 carved / ≥0 region id */
  regionId: number;
  /** 补丁 id / BFS 戳 */
  patchId: number;
  /** 岸线掩码缓存，初始 -1 */
  shoreMask: number;
  /** 水/岸锁 */
  waterLock: number;
  /** 树已访问 */
  treeVisited: number;
  /** 岸线使能，map-prep 后为 1 */
  shoreEnabled: number;
  /** 水/桥旗标 */
  waterBridgeFlags: number;

  // ---- CellClass 原生字段（阶段 18 补，2026-10-07）----
  // ⚠ 这些是**原生 CellClass 的偏移语义**，与上面的 RMG scratch 是两套东西。
  //   依据 `re/specs/STAGE18_GROWTH_QUEUE.md`（探针 + IDA 双源验证）。
  //   全部有唯一构造点 `defaultRmgCell()`，加字段不影响既有阶段。

  /**
   * `CellClass+0x24` —— **菱形坐标**（dword 打包：`x = 低 16 位`, `y = 高 16 位`，
   * 均有符号）。
   *
   * 这是阶段 18 堆的键（`cell.ts` 的 int32 min-heap 用它排序），
   * 也是 `sub_578460` 坐标合法性检查的入参。
   * ⚠ 勿与「`rx`/`ry` 网格下标」混用：菱形坐标可越界（负数），
   *   网格下标恒为 `≥ 0`。转换用 `0x42B1C0`（菱形→线性索引）。
   */
  diamondCoord: number;

  /**
   * `CellClass+0x38` —— 附属表下标（门 6c 用）。
   *
   * 三态语义（`0x4838E0` 门 6c）：`< 0` 或 `≥ [0xA8ED38]` 直接通过；
   * 落在区间内才查 `table_A8ED2C[idx] + 0x306`。
   * 勿写成简单二值判断。
   */
  attachIndex: number;

  /**
   * `CellClass+0x44` —— 多边形 id（regionLookup 的 **key**）。
   *
   * `0x4838E0` 门 6a 要求它 **`== -1`**（无多边形）才可生长；
   * 而 `0x483690`（谓词 B）要求 `regionLookup(+0x44) == +0x98`。
   * ⚠ 与 `regionId`（RMG scratch 区域 id）**未必同一概念，勿互相赋值**。
   */
  polyIdLookup: number;

  /** `CellClass+0x98` —— 多边形 id（**存**侧）。须与 `regionLookup(polyIdLookup)` 相等。 */
  polyId: number;

  /** `CellClass+0x9C` —— 扩散三元组的第三分量（`0x7221B0` 写入 `+0x108` 前的来源）。 */
  spreadAux: number;

  /**
   * `CellClass+0xA0` —— **高程 / 高度（f64）**。
   *
   * ⚠ 不是 `level`（`+0x11B` 是 byte level 0..15）。这个是 double。
   * 两处比较（`0x483690` 谓词 B、`0x722440`）都拿它和 `1e-05` 比
   * ⇒ 对 level 0..15 恒真，属防御性检查。
   */
  height: number;

  /**
   * `CellClass+0xE4` —— 附着物链表头。
   *
   * 阶段 18 门 3/4 会遍历它（`+0x30` = next，`vtable+0x2C` = 类型 tag，
   * 关心 tag `6` 与 `36`）。RMG 前期格子应为 `0`（无附着物）。
   * `0x483780` 门 A 也要求 `+0xE4 == 0`。
   */
  attachments: number;

  // ---- 阶段 18 扩散三元组（`0x7221B0` 写 / `0x4838E0` 读）----
  /** `CellClass+0x100` —— 扩散归属标记，**-1 = 无** */
  spreadKey: number;
  /** `CellClass+0x104` —— 调用方传入的阈值/数量参数 */
  spreadParam: number;
  /** `CellClass+0x108` —— 距离/半径（与全局 `[0xA8ED84]` 做减法比较） */
  spreadRadius: number;

  // ---- 阶段 18 生长队列（每 cell 一份，孪生通道字段组不同）----
  // ⚠ 原生是两套**并列**通道（`0x722240` / `0x722D00`，入口 `0x5993A0`/`0x59939B`
  //   背靠背调用），字段组相差 0x1C：主通道 `+0xF0..`，孪生通道 `+0x10C..`。
  //   本实现目前只建**主通道**；孪生通道接入前所有孪生字段保持初值。
  /** `+0xF0` 主通道堆计数（入队元素数），初值 0 */
  growthHeapCount: number;
  /** `+0xF4` 主通道堆容器（`{count:int, ?}`，数据在 `+8`） */
  growthHeap: number;
  /** `+0xF8` 主通道已访问位图（byte/格） */
  growthVisited: number;
  /** `+0xFC` 主通道堆元素数组（每项 8 字节：`[0]=菱形坐标`, `[4]=int32 优先级`） */
  growthHeapData: number;
}

export function defaultRmgCell(): RmgCell {
  return {
    tile: TILE_UNASSIGNED,
    subTile: 0,
    level: DEFAULT_GROUND_LEVEL,
    slope: 0,
    overlay: -1,
    density: 0,
    passability: 0,
    landType: 0,
    flags: 0,
    occupied: false,
    startMarker: false,
    regionId: REGION_NONE,
    patchId: 0,
    shoreMask: -1,
    waterLock: 0,
    treeVisited: 0,
    shoreEnabled: 1,
    waterBridgeFlags: 0,

    // ---- CellClass 原生字段（阶段 18）----
    // 菱形坐标初值 (0,0) ⇒ dword 0
    diamondCoord: 0,
    // 附属表下标：初值 -1 ⇒ 门 6c 的「< 0 直接通过」分支成立
    attachIndex: -1,
    // 多边形 id：-1 = 无（门 6a 的通过条件）
    polyIdLookup: -1,
    polyId: -1,
    spreadAux: 0,
    height: 0,
    // RMG 前期格子无附着物（门 A / 门 3 / 门 4 都要求 0 或查空表）
    attachments: 0,

    // ---- 阶段 18 扩散三元组 ----
    spreadKey: -1,
    spreadParam: 0,
    spreadRadius: 0,

    // ---- 阶段 18 生长队列（主通道）----
    growthHeapCount: 0,
    growthHeap: 0,
    growthVisited: 0,
    growthHeapData: 0,
  };
}

/**
 * 菱形坐标 ↔ `diamondCoord` dword 打包。
 *
 * 原生用单个 dword 同时存 (x,y)：`x = 低 16 位`、`y = 高 16 位`，
 * **均有符号**（依据 `0x49F2F0` 填表值 `0xFFFF0000` = (0,−1) 等）。
 *
 * ⚠ 这是坐标的**原生表示**，与 `RmgGrid` 的 `(rx, ry)` 网格下标不同：
 * 菱形坐标可为负，网格下标恒 `≥ 0`。两者不要混用。
 *
 * ⚠ 返回值统一为**无符号**（`>>> 0`）：原生按 dword 位模式比较，
 *   JS 若存成有符号负数，`===`/`!==` 与原生 dword 相等语义不一致。
 *   取 x/y 用 `unpackDiamondCoord`，它内部做符号扩展。
 */
export function packDiamondCoord(x: number, y: number): number {
  return (((y & 0xffff) << 16) | (x & 0xffff)) >>> 0;
}

/** `packDiamondCoord` 的逆。接受有符号或无符号 dword，返回有符号的 `[x, y]`。 */
export function unpackDiamondCoord(dword: number): [number, number] {
  const x = dword << 16 >> 16;
  const y = (dword >> 16) << 16 >> 16;
  return [x, y];
}

/** 地图几何（与 `deriveDimensions` 对齐） */
export interface RmgGridGeometry {
  /** mapW = genW + 4 —— `[Map] Size` 的 Width（菱形过滤用） */
  width: number;
  /** mapH = genH + 12 —— `[Map] Size` 的 Height */
  height: number;
  /** 菱形界下界 = mapW（原生 scratch 用；本层保留供阶段引用） */
  diamondMin: number;
  /** 菱形界上界 = mapW + 2·mapH */
  diamondMax: number;
}

/**
 * 菱形带内判定。
 *
 * 与 `MapFile.CreateIsoTileList` 的过滤条件一致（`[Map] Size` 的 Width×Height）：
 *   dx = rx − ry + width − 1 ∈ [0, 2·width)
 *   dy = rx + ry − width − 1 ∈ [0, 2·height)
 *
 * 注意：合法 `(rx,ry)` **不是** `[0,mapW)×[0,mapH)` 矩形——
 * rx/ry 可到约 `mapW+mapH`。数组必须按该包围盒分配（见 `gridArraySize`）。
 */
export function isInDiamond(
  rx: number,
  ry: number,
  geometry: Pick<RmgGridGeometry, 'width' | 'height'>,
): boolean {
  const { width: w, height: h } = geometry;
  const dx = rx - ry + w - 1;
  const dy = rx + ry - w - 1;
  return dx >= 0 && dx < 2 * w && dy >= 0 && dy < 2 * h;
}

/**
 * 与 `MapFile.CreateEmptyMap` **同一套** (rx,ry) 枚举。
 *
 * IsoMapPack5 定长缓冲 = `(width·2−1)·height` 条；只有这套枚举的格
 * 能安全写入/读回。`isInDiamond` 的代数条件与此**不完全等价**（包围盒
 * 会多出缓冲装不下的格），故 emit/nativeCells 必须走本枚举。
 *
 * 迭代序：y 升序，x 升序（与 CreateEmptyMap 双重循环一致）。
 */
export function* createEmptyMapCells(
  width: number,
  height: number,
): Generator<[number, number, number, number]> {
  // yields [rx, ry, dx, dy]
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width * 2 - 1; x++) {
      const dx = x;
      const dy = y * 2 + (x % 2);
      const rx = Math.floor((dx + dy) / 2) + 1;
      const ry = dy - rx + width + 1;
      yield [rx, ry, dx, dy];
    }
  }
}

/** 网格数组边长：覆盖 CreateEmptyMap 全部 (rx,ry) 的保守包围盒 */
export function gridArraySize(
  geometry: Pick<RmgGridGeometry, 'width' | 'height'>,
): number {
  // rx, ry 实测上界 < width+height（CreateEmptyMap 公式）
  return geometry.width + geometry.height + 2;
}

/**
 * 工作网格。
 *
 * **索引**：`ry * arraySize + rx`，`arraySize = mapW + mapH`（包围盒），
 * 而非 `[0,mapW)×[0,mapH)` —— 带内 `(rx,ry)` 可超出 map Size 矩形。
 * `width`/`height` 仍是 `[Map] Size` 的 mapW/mapH（菱形过滤参数）。
 *
 * 菱形外读 `get` 返回 `null`；写 `set` 为 no-op。
 */
export class RmgGrid {
  /** `[Map] Size` Width（mapW） */
  readonly width: number;
  /** `[Map] Size` Height（mapH） */
  readonly height: number;
  readonly diamondMin: number;
  readonly diamondMax: number;
  /** 数组边长 = mapW + mapH */
  readonly arraySize: number;

  private readonly cells: RmgCell[];

  constructor(geometry: RmgGridGeometry) {
    this.width = geometry.width;
    this.height = geometry.height;
    this.diamondMin = geometry.diamondMin;
    this.diamondMax = geometry.diamondMax;
    this.arraySize = gridArraySize(geometry);
    const n = this.arraySize * this.arraySize;
    this.cells = new Array<RmgCell>(n);
    for (let i = 0; i < n; i++) {
      this.cells[i] = defaultRmgCell();
    }
  }

  static fromDerived(d: {
    mapW: number;
    mapH: number;
    diamondMin: number;
    diamondMax: number;
  }): RmgGrid {
    return new RmgGrid({
      width: d.mapW,
      height: d.mapH,
      diamondMin: d.diamondMin,
      diamondMax: d.diamondMax,
    });
  }

  inBand(rx: number, ry: number): boolean {
    if (rx < 0 || ry < 0 || rx >= this.arraySize || ry >= this.arraySize) {
      return false;
    }
    // 用 CreateEmptyMap 同源枚举做 O(1) 不可行时，退回代数过滤 + 数组界。
    // emit 走 nativeCells()（精确枚举）；随机访问用代数条件近似带内。
    return isInDiamond(rx, ry, this);
  }

  get(rx: number, ry: number): RmgCell | null {
    if (!this.inBand(rx, ry)) return null;
    return this.cells[ry * this.arraySize + rx];
  }

  /** 带外写忽略 */
  set(rx: number, ry: number, cell: RmgCell): void {
    if (!this.inBand(rx, ry)) return;
    this.cells[ry * this.arraySize + rx] = cell;
  }

  /**
   * IsoMapPack **精确**格枚举（CreateEmptyMap 同源）—— emit 与对拍用此序。
   * 抽数序在此基础上后续再对齐真机 DiamondScan（UNVERIFIED）。
   */
  *nativeCells(): Generator<[number, number]> {
    for (const [rx, ry] of createEmptyMapCells(this.width, this.height)) {
      if (rx >= 0 && ry >= 0 && rx < this.arraySize && ry < this.arraySize) {
        yield [rx, ry];
      }
    }
  }

  /**
   * 代数带内计数（调试用）。**不等于** IsoMapPack 格数；
   * 写出格数请用 `nativeCells` 计数或 `countPackCells`。
   */
  countInBand(): number {
    let n = 0;
    for (const _ of this.nativeCells()) n++;
    return n;
  }

  /** 与 CreateEmptyMap/IsoMapPack 完全一致的格数 = (2W−1)·H */
  countPackCells(): number {
    return (this.width * 2 - 1) * this.height;
  }

  /** 邻格（带外 → null）。dir ∈ 0..7 = DIRECTION_OFFSETS 下标 */
  neighbor(rx: number, ry: number, dir: number): RmgCell | null {
    const off = DIRECTION_OFFSETS[dir];
    if (!off) return null;
    return this.get(rx + off[0], ry + off[1]);
  }

  /** 重置为 map-prep 后的初态（level=4，overlay=-1，shoreEnabled=1…） */
  resetToPrepState(): void {
    for (const c of this.cells) {
      Object.assign(c, defaultRmgCell());
    }
  }
}
