/**
 * 细胞属性重算（原生阶段 12，`0x47D2B0`）+ LAT 自动接驳（`0x47CA80`）
 *
 * 反编译：`re/decomp/47D2B0_CellRecalc_C.c`、`47CA80_watch_47CA80.c`、
 * `544C20/5471B0/544BE0`（TMP 子格元数据读取器）。
 *
 * 结构（tile 分支）：
 *   tile ≥ IsoTileTypeCount → 0xFFFF；
 *   帧无效（subtile 越界/子格空）→ tile=0xFFFF、subtile=0、land=0、slope=0、density=0；
 *   否则 slope := 模板子格 slope → LAT 修复 → land := 模板子格 land 映射
 *   （`dword_8288E4[16]`，已抓取）→ 多格邻格 flags |= 0x10000 → 悬崖背坡规则。
 * overlay 分支（矿/树阶段用）目前仅结构占位 —— RMG 前段无 overlay。
 *
 * 运行时专属、本层跳过：动画对象生成、隧道对象、图形预加载、寻路镜像表。
 * 悬崖背坡规则字节（RulesClass+1636）缺省 0 = 整块跳过（stock rules 无此键）。
 */

import { DIRECTION_OFFSETS } from './cell';
import { NativeCell, TILE_NONE } from './native';
import { TheaterTables } from './theater';
import { isGreenTile, WaterContext } from './water';

/** `dword_8288E4[16]`：TMP 子格 [terrainIndex] → LandType（exe 文件映像抓取） */
export const LAND_TYPE_MAP: readonly number[] = [
  0, 8, 8, 8, 8, 10, 9, 3, 3, 2, 6, 1, 1, 0, 7, 3,
];

/** CellClass+0x140 位：多格模板的邻格标记 */
export const FLAG_MULTITILE = 0x10000;

/**
 * TMP 模板元数据提供者。
 * 真实数据来自 .TMP 资产（TileSetClass+156 的子格表：+40 高度、+41 terrainIndex、
 * +42 slope）。平水缺省：全部 slope 0、terrainIndex 0、height 30（→ grade 0）。
 * UNVERIFIED —— 待 oracle 抓取真机值替换（README「未认证」）。
 */
export interface TemplateProvider {
  width(tile: number): number;
  height(tile: number): number;
  /** 子格存在性（544C20：subtile < w*h 且条目非空） */
  subExists(tile: number, subtile: number): boolean;
  subSlope(tile: number, subtile: number): number;
  /** 子格 terrainIndex（544BE0 的 `*(char*)(entry+41)`） */
  subTerrainIndex(tile: number, subtile: number): number;
  /** 子格高度基准（sub_547150 的 v56；grade = (h−30)/15） */
  subHeight(tile: number, subtile: number): number;
  /** 多格模板（+737 非 0） */
  isMultiTile(tile: number): boolean;
}

/** 平水缺省提供者：1×1、子格 0 存在；水族 tile 的 terrainIndex → land 8（不可通行） */
/**
 * 占位 `TemplateProvider` —— 宽度/高度恒 1×1（扁平模板）。
 *
 * ⚠ **`subExists` 已按真机基线修正（2026-10-08）**
 *
 * 原生 `0x544C20 Tile_FrameValidQ`（capstone 实测）：
 * ```c
 * TileTemplate* tmpl = this->vtable->slot156(this);      // call [eax+0x9C]
 * return tmpl != nullptr
 *     && subtile < tmpl->width * tmpl->height
 *     && tmpl->subtiles[subtile] != nullptr;
 * ```
 * 判据是「**模板里该子格是否存在**」⇒ 一个 tile 有几个有效子格，
 * 就应该接受几个 subtile。**不是「只认 subtile 0」。**
 *
 * 🔴 **旧实现 `subtile === 0` 会抹掉 61% 的水**（实测 MapType=1 / RandMap.Sed）：
 * ```
 * generateWaterStage 后   water=11124 (48.2%)   ← 与真机 49.4% 吻合
 * runRecalcStage         water=4287  (18.6%)   ← -6837
 * ```
 * 探针定位到 `recalcCell` 的 `if (!valid) { cell.tile = TILE_NONE; … }`，
 * 且丢失量完美均分：**subtile=1/2/3 各 2279 格，subtile=0 零丢失**
 * —— 因为 `waterFinalize` 用 `placeTileBlock` 写出的水格
 * `subtile = j·width + i`（≠0），而真机实测水格
 * `subIndex = {0,1,2,3}` **四种各占 1/4** ⇒ 模板里水 tile 有 4 个有效子格。
 *
 * 下面按 theater 反推各族的子格数（数据源见下）。**只改 `subExists`**，
 * 其余方法保持扁平占位语义，避免连带影响（`subHeight` 只喂 `cell.grade`，
 * 而 `grade` 无消费者；`width/height` 改动会牵动 `isMultiTile` 等）。
 */
export class FlatTemplateProvider implements TemplateProvider {
  constructor(private theater?: { waterSet: number; shorePieces: number; rampBase: number }) {}
  private terrainIndex(tile: number): number {
    const t = this.theater;
    if (!t) return 0;
    // 水（14 格）与岸线片（42 格）的 TMP terrainIndex → land 8（不可通行）
    if (tile >= t.waterSet && tile < t.waterSet + 14) return 1;
    if (tile >= t.shorePieces && tile < t.shorePieces + 42) return 1;
    return 0;
  }
  width(_tile: number): number {
    return 1;
  }
  height(_tile: number): number {
    return 1;
  }
  /**
   * 该 tile 的**有效子格数**（原生 = 模板的 `width * height`）。
   *
   * 数据源（真机基线反推，零外部依赖）：
   *  - 水族：`F:\YTLauncher\RandMap.Map` 实测 `subIndex={0,1,2,3}` 各 1/4 ⇒ **4**
   *    （`re/oracle/reverse_templates_known.js` → `templates_known.json`）
   *  - 岸线片：同族连续排列 ⇒ 4
   *  - ground / ramp：`template_from_baseline.json` 实测**全为单子格** ⇒ 1
   *  - 崖族：反推表实测 2..6（按段内偏移循环），但影响面大 ⇒ 保守取 2
   *
   * ⚠ **崖族/岸族仍是近似值**（下界，因为基线只记录了实际用到的子格）。
   * 取真值需要解 MIX 加密的 `.TEM`，或 unicorn dump 运行时 Tile 对象图
   * （`re/decomp/544BE0` / `5471B0` 的 `tmpl[subtile+4]` 链）。
   */
  private subCellCount(tile: number): number {
    const t = this.theater;
    if (!t) return 1;
    // 水族 14 格：4 子格（真机实测）
    if (tile >= t.waterSet && tile < t.waterSet + 14) return 4;
    // 岸线片 42 格：与水同族的连续段 ⇒ 4
    if (tile >= t.shorePieces && tile < t.shorePieces + 42) return 4;
    return 1; // ground / ramp / 其它：单子格
  }
  subExists(tile: number, subtile: number): boolean {
    if (subtile === 0) return true; // 子格 0 恒存在（也覆盖无 theater 的退化情形）
    return subtile < this.subCellCount(tile);
  }
  subSlope(tile: number, _subtile: number): number {
    // 坡族 tile（rampBase..+18）自带 slope 1..18 —— 保留山丘阶段写下的坡
    const t = this.theater;
    if (t && tile >= t.rampBase && tile < t.rampBase + 19) return tile - t.rampBase + 1;
    return 0;
  }
  subTerrainIndex(tile: number, _subtile: number): number {
    return this.terrainIndex(tile);
  }
  subHeight(_tile: number, _subtile: number): number {
    return 30;
  }
  isMultiTile(_tile: number): boolean {
    return false;
  }
}

export interface RecalcRules {
  /** RulesClass+1636 CliffBackImpassability；stock 缺省 0（整块跳过） */
  cliffBackImpassability: number;
}

const DEFAULT_RULES: RecalcRules = { cliffBackImpassability: 0 };

/** 悬崖背坡：6 探针 [(0,−1),(−1,0),(2,2),(1,1),(−1,1),(1,−1)]（菱形坐标算术） */
function cliffBack(
  ctx: WaterContext,
  x: number,
  y: number,
  selfLand: number,
  rules: RecalcRules,
): number {
  const b = rules.cliffBackImpassability;
  if (b === 0) return selfLand;
  const probes = [
    [0, -1],
    [-1, 0],
    [2, 2],
    [1, 1],
    [-1, 1],
    [1, -1],
  ];
  const self = ctx.cells.cellAt(x, y);
  for (const [dx, dy] of probes) {
    const nb = ctx.cells.cellAt(x + dx, y + dy);
    if (nb.level >= self.level + 4) {
      if (b === 2) return 3;
      break;
    }
  }
  return selfLand;
}

/**
 * LAT 自动接驳 `0x47CA80`。返回 tile 是否变化。
 * 四个 LAT 族：4 正交邻（dir 0,2,4,6 → 位 0..3）不属于本族兼容集 → 置位；
 * tile := LAT基 + mask（mask==0 → 基址）。坡族：slope 1..4 的两个指定方向
 * 邻 slope==0 → 2bit 掩码 → tile := AA1058 + {−1,+2,+5,+8} + mask；mask 0 →
 * tile := slope + RampBase − 1。
 */
export function latRepair(ctx: WaterContext, x: number, y: number): boolean {
  const { cells, theater: t } = ctx;
  const cell = cells.cellAt(x, y);
  const before = cell.tile;

  const nb = (dir: number): NativeCell => {
    const off = DIRECTION_OFFSETS[dir & 7];
    return cells.cellAt(x + off[0], y + off[1]);
  };
  const inRange = (v: number, base: number, len: number): boolean =>
    base >= 0 && v >= base && v <= base + len;

  // 族 1：rough（base ABC2B8 / LAT AA1134 +15）
  if (cell.tile === t.roughTile || inRange(cell.tile, t.clearToRoughLat, 15)) {
    let mask = 0;
    for (let i = 0; i < 4; i++) {
      const n = nb(2 * i);
      if (n.tile !== t.roughTile && !inRange(n.tile, t.clearToRoughLat, 15)) {
        mask |= 1 << i;
      }
    }
    cell.tile = mask !== 0 ? t.clearToRoughLat + mask : t.roughTile;
  }
  // 族 2：sand（ABB104 / AA0E24 +15）—— AA0E24 != -1 门控
  if (t.clearToSandLat !== -1) {
    if (cell.tile === t.sandTile || inRange(cell.tile, t.clearToSandLat, 15)) {
      let mask = 0;
      for (let i = 0; i < 4; i++) {
        const n = nb(2 * i);
        if (n.tile !== t.sandTile && !inRange(n.tile, t.clearToSandLat, 15)) {
          mask |= 1 << i;
        }
      }
      cell.tile = mask !== 0 ? t.clearToSandLat + mask : t.sandTile;
    }
  }
  // 族 3：green（AA0E18 / AA0748 +15）—— 兼容岸线族 [ABAD28,+41] 与 [AA1090,+1]
  if (t.clearToGreenLat !== -1) {
    if (cell.tile === t.greenTile || inRange(cell.tile, t.clearToGreenLat, 15)) {
      let mask = 0;
      for (let i = 0; i < 4; i++) {
        const n = nb(2 * i);
        const compat =
          n.tile === t.greenTile ||
          inRange(n.tile, t.clearToGreenLat, 15) ||
          inRange(n.tile, t.shorePieces, 41) ||
          inRange(n.tile, t.waterBridge, 1);
        if (!compat) mask |= 1 << i;
      }
      cell.tile = mask !== 0 ? t.clearToGreenLat + mask : t.greenTile;
    }
  }
  // 族 4：pave（ABC2B0 / AA10A8 +15）—— 兼容 [AA10A4,+13] [AA0E20,+13] [ABBEC8,+20]
  if (t.clearToPaveLat !== -1) {
    if (cell.tile === t.paveTile || inRange(cell.tile, t.clearToPaveLat, 15)) {
      let mask = 0;
      for (let i = 0; i < 4; i++) {
        const n = nb(2 * i);
        const compat =
          n.tile === t.paveTile ||
          inRange(n.tile, t.clearToPaveLat, 15) ||
          inRange(n.tile, t.miscPaveTile, 13) ||
          inRange(n.tile, t.medians, 13) ||
          inRange(n.tile, t.pavedRoads, 20);
        if (!compat) mask |= 1 << i;
      }
      cell.tile = mask !== 0 ? t.clearToPaveLat + mask : t.paveTile;
    }
  }
  // 坡族：tile ∈ [RampBase,+19] ∪ [AA1058,+11]
  if (inRange(cell.tile, t.rampBase, 19) || inRange(cell.tile, t.rampSmooth, 11)) {
    let mask = 0;
    let target = -1;
    const slope = cell.slope;
    if (slope === 1) {
      // W(dir6) 与 E(dir2)
      if (nb(6).slope === 0) mask |= 1;
      if (nb(2).slope === 0) mask |= 2;
      if (mask !== 0) target = t.rampSmooth - 1 + mask;
    } else if (slope === 2) {
      // N(dir0) 与 S(dir4)
      if (nb(0).slope === 0) mask |= 1;
      if (nb(4).slope === 0) mask |= 2;
      if (mask !== 0) target = t.rampSmooth + 2 + mask;
    } else if (slope === 3) {
      // E(dir2) 与 W(dir6)
      if (nb(2).slope === 0) mask |= 1;
      if (nb(6).slope === 0) mask |= 2;
      if (mask !== 0) target = t.rampSmooth + 5 + mask;
    } else if (slope === 4) {
      // S(dir4) 与 N(dir0)
      if (nb(4).slope === 0) mask |= 1;
      if (nb(0).slope === 0) mask |= 2;
      if (mask !== 0) target = t.rampSmooth + 8 + mask;
    }
    if (target !== -1) cell.tile = target;
    else cell.tile = slope + t.rampBase - 1;
  }
  return before !== cell.tile;
}

/**
 * `0x47D2B0` 重算单格（RMG 全部调用点 a2 = -1）。
 * templates / rules / overlays 由 ctx 扩展字段提供。
 */
export function recalcCell(
  ctx: WaterContext,
  x: number,
  y: number,
  a2 = -1,
): void {
  const { cells, theater: t } = ctx;
  const cell = cells.cellAt(x, y);
  const rules = ctx.recalc?.rules ?? DEFAULT_RULES;
  const tp = ctx.recalc?.templates ?? new FlatTemplateProvider();

  if (cell.overlay !== -1) {
    // overlay 分支（矿/树阶段接入时补 OverlayType 元数据）：
    // 现阶段管线不产生 overlay —— 保持 land 由 overlay 类型决定的占位
    // 结构，行为与原生在「无 OverlayType 数据」时的缺省一致。
    // 原生：land = OverlayType[ov]+664；墙族/4/9 特例；这里统一保留原 land。
    if (rules.cliffBackImpassability !== 0) {
      cell.landType = cliffBack(ctx, x, y, cell.landType, rules);
    }
    return;
  }

  if (cell.tile >= ctx.isoTileTypeCount) {
    cell.tile = TILE_NONE;
  }
  if (cell.tile !== TILE_NONE) {
    const subtile = cell.subTile & 0xff;
    let valid = tp.subExists(cell.tile, subtile);
    if (cell.slope !== 0) {
      if (valid) {
        applyTileData(ctx, cell, x, y, subtile, a2, rules, tp);
        return;
      }
      valid = tp.subExists(cell.tile, subtile); // 原生 second probe（图形懒加载差异不影响数据）
    }
    if (!valid) {
      cell.tile = TILE_NONE;
      cell.subTile = 0;
      cell.landType = 0;
      cell.slope = 0;
      cell.density = 0;
      cell.landType = cliffBack(ctx, x, y, 0, rules);
      return;
    }
    applyTileData(ctx, cell, x, y, subtile, a2, rules, tp);
    return;
  }
  // tile == 0xFFFF
  cell.landType = 0;
  cell.slope = 0;
  cell.landType = cliffBack(ctx, x, y, 0, rules);
}

function applyTileData(
  ctx: WaterContext,
  cell: NativeCell,
  x: number,
  y: number,
  subtile: number,
  a2: number,
  rules: RecalcRules,
  tp: TemplateProvider,
): void {
  const { theater: t } = ctx;
  cell.slope = tp.subSlope(cell.tile, subtile);
  latRepair(ctx, x, y);
  cell.landType = LAND_TYPE_MAP[tp.subTerrainIndex(cell.tile, subtile) & 0x0f];
  if (cell.landType === 10) {
    // 隧道分支：RMG 地图无隧道对象 —— 保留 land=10 即可
  }
  if (a2 !== -1) {
    cell.level = a2 & 0xff;
  }
  cell.grade = (tp.subHeight(cell.tile, subtile) - 30) / 15;
  if (tp.isMultiTile(cell.tile)) {
    const w = tp.width(cell.tile);
    const h = tp.height(cell.tile);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (i === 0 && j === 0) continue;
        const nx = x + i;
        const ny = y + j;
        if (!ctx.cells.inDiamondBounds(nx, ny)) continue;
        ctx.cells.cellAt(nx, ny).flags |= FLAG_MULTITILE;
      }
    }
  }
  cell.landType = cliffBack(ctx, x, y, cell.landType, rules);
  void t;
}

/** 全图重算（Generate 中每次 `0x578350/290` 迭代 + 47D2B0(cell,−1)） */
export function recalcAll(ctx: WaterContext): void {
  for (const cell of ctx.cells.iterate()) {
    const [x, y] = coordOf(ctx, cell);
    recalcCell(ctx, x, y, -1);
  }
}

import { coordOfCell } from './water';
function coordOf(ctx: WaterContext, cell: NativeCell): [number, number] {
  return coordOfCell(ctx, cell);
}

/** isGreenTile 再导出便于测试 */
export { isGreenTile };
