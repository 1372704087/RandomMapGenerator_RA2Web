/**
 * Cell 级状态层 —— 对齐 `CellClass` + RMG `0x50` 暂存，以及阶段用 `GridCell`
 *
 * 与 `WorkingMap` 的「预置地块拼装」模型**并列**，不要合并。
 * 发射（emit）时投影到现有 `MapFile`（IsoMapPack5 + OverlayPack）。
 *
 * 字段来源（逆向规格书 §3 + vera20k `grid.rs`）：
 *   CellClass：tile / subTile(+0x11A) / level(+0x11B) / slope(+0x11C) /
 *              overlay(+0x44) / density(+0x11E) / flags(+0x140) / landType(+0xEC)
 *   RMG scratch：regionId / patchId / shore 锁 / 树访问位等（阶段间共享）
 *
 * 邻接次序 `DIRECTION_OFFSETS` 是契约：`N,NE,E,SE,S,SW,W,NW`
 * （`g_DirectionOffsets 0x0089F688` 运行时填充，静态映像为 0）。
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
  };
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
