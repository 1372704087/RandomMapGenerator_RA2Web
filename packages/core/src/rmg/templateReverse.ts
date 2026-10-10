/**
 * 真实 `TemplateProvider` —— 由**基线地图反推**的模板元数据（2026-10-07）。
 *
 * 【原生语义（已由三个观察者函数交叉确认）】
 *   `0x544BE0 Tile_LandOfSubtile` / `0x5471B0 Tile_SlopeOfSubtile` / `0x544C20 Tile_FrameValidQ`：
 * ```c
 *   tmpl = vtable[156](this);                          // vtable+156 ⇒ 第 39 个虚函数
 *   if (tmpl && (e = tmpl[ subtile % (tmpl[0] * tmpl[1]) + 4 ]) != 0)
 *       // tmpl[0] = width, tmpl[1] = height
 *       // tmpl[4 ..] = TileFrame* 数组（★ 索引从 4 起，不是 0）
 *       // TileFrame: +40 height / +41 terrainIndex / +42 slope
 *       return landtype_table[ *(char*)(e + 41) ];      // 0x544BE0
 *       return *(char*)(e + 42);                       // 0x5471B0
 *   valid = (a2 < tmpl[0]*tmpl[1]) && (tmpl[a2+4] != 0);   // 0x544C20
 * ```
 *
 * 【数据来源与性质】
 *  - `.TMP` 资产**不存在**（`MIXFILES/` 整个目录缺失），
 *    填表者在未反编译的 `0x42xxxx` / `0x45xxxx` 段，单点仿真跑不动 theater 加载链。
 *  - ⇒ 改从**基线 `.yrm` 的 `IsoMapPack5` 反推**
 *    （`re/oracle/reverse_template_from_baseline.js` → `vectors/template_from_baseline.json`）：
 *    29 161 条 `(tileIndex, subIndex, level, slope)` 记录。
 *  - 实测：163 个不同 tile，**68 个（41.7%）有多子格**，最多 20 子格，slope 全为 0。
 *  - **多子格 tile 有 43/70 落在崖族**（`cliffSet..+16×14` = 49..272），
 *    且段内偏移 0..13 对应**固定的子格数模式**：
 *    `4,2,4,4,4,4,4,2,3,2,2,3,3,3`（按该偏移取众数）。
 *
 * ⚠⚠ **这是逆向近似，不是取证真值**：
 *  - `subCount` 是**下界** —— 基线只记录实际用到的子格，
 *    真实模板可能有更多子格未被采样；
 *  - `subSlope` 一律返 0（基线 slope 全为 0，无法区分"真 0"与"未采到"）；
 *  - `subHeight` 由反推的 level 跨度拟合（见下），**不是**原生 `+40` 真值。
 *  一旦 MIXFILES 可用，**应换回真实 `.TMP` 解析**。
 */

/** 崖族段内偏移 → 子格数（按 14 个段取众数；实测自基线反推） */
const CLIFF_SUB_COUNT_BY_OFFSET = [4, 2, 4, 4, 4, 4, 4, 2, 3, 2, 2, 3, 3, 3];

/** 每个崖族的段数（原生 `cliffSet` 起 16 段 × 每段 14 块） */
const CLIFF_SEGMENTS = 16;
const CLIFF_STRIDE = 14;

/** 反推的每 tile 元数据（由 `template_from_baseline.json` 注入） */
export interface ReverseTemplateEntry {
  /** 子格数下界 */
  subCount: number;
  /** 出现过的最大 subIndex */
  maxSub: number;
  /** 出现过的最小 level */
  minLevel: number;
  /** 出现过的最大 level */
  maxLevel: number;
}

export interface ReverseTemplateTable {
  entries: Record<number, ReverseTemplateEntry>;
}

/**
 * 反推驱动的 `TemplateProvider`。
 *
 * ⚠ 语义与原生 `TemplateProvider` 一一对应，**差别只在数据来源**：
 * 真实版读 `.TMP`，本版读基线反推表。
 */
export class ReverseTemplateProvider {
  private readonly tbl: ReverseTemplateTable;
  private readonly cliffSet: number;
  private readonly rampBase: number;
  private readonly waterSet: number;
  private readonly shorePieces: number;

  constructor(
    tbl: ReverseTemplateTable,
    theater: {
      cliffSet: number;
      rampBase: number;
      waterSet: number;
      shorePieces: number;
    },
  ) {
    this.tbl = tbl;
    this.cliffSet = theater.cliffSet;
    this.rampBase = theater.rampBase;
    this.waterSet = theater.waterSet;
    this.shorePieces = theater.shorePieces;
  }

  /**
   * 模板子格总数 `tmpl[0] * tmpl[1]`。
   *
   * 原生 `subtile % (w*h)` ⇒ 越界会**环绕**，故必须返回真实总数。
   * 反推只能给下界 —— 这里用「出现过的最大 subIndex + 1」，
   * 对未采样的高 subIndex 会算成越界并环绕（与原生环绕行为一致）。
   */
  private subCountOf(tile: number): number {
    const e = this.tbl.entries[tile];
    if (e) return Math.max(1, e.subCount);
    // 崖族未采样的段内偏移 ⇒ 用该偏移的众数
    if (tile >= this.cliffSet && tile < this.cliffSet + CLIFF_SEGMENTS * CLIFF_STRIDE) {
      const off = (tile - this.cliffSet) % CLIFF_STRIDE;
      return CLIFF_SUB_COUNT_BY_OFFSET[off] ?? 1;
    }
    return 1;
  }

  /** 原生 `tmpl[0]`：宽（反推不区分宽高，取 1 × N 的单行模板） */
  width(tile: number): number {
    return 1;
  }

  /** 原生 `tmpl[1]`：高 */
  height(tile: number): number {
    return this.subCountOf(tile);
  }

  /**
   * 子格存在性（原生 `tmpl[subtile % (w*h) + 4] != 0`）。
   *
   * 反推无法判定"该子格是否存在"，只能判"是否在采样到的范围内" ⇒
   * `subtile < subCount` 时假定存在。
   */
  subExists(tile: number, subtile: number): boolean {
    const n = this.subCountOf(tile);
    // 原生用 `subtile % (w*h)` ⇒ 越界环绕而非失败
    const i = ((subtile % n) + n) % n;
    return i < n;
  }

  /**
   * 子格坡度（原生 `*(char*)(e + 42)`）。
   *
   * ⚠ **一律返 0**：基线 slope 全为 0，无法区分"真 0"与"未采到"。
   * 这意味着**坡面（ramp）暂不产生** —— 但原生基线同样 slope 全 0，
   * 说明 RMG 产出图确实不写坡（level 承担全部高差表达）。
   */
  subSlope(tile: number, _subtile: number): number {
    void tile;
    return 0;
  }

  /**
   * 子格地形索引（原生 `landtype_table[*(char*)(e + 41)]`）。
   *
   * 反推表里没有这个字段 ⇒ 按族给缺省：水/岸不可通行（land 1），
   * 其余可通行（land 0）。与 `FlatTemplateProvider` 同口径。
   */
  subTerrainIndex(tile: number, _subtile: number): number {
    if (tile >= this.waterSet && tile < this.waterSet + 14) return 1;
    if (tile >= this.shorePieces && tile < this.shorePieces + 42) return 1;
    return 0;
  }

  /**
   * 子格高度基准（原生 `*(char*)(e + 40)`，grade = (h−30)/15）。
   *
   * 反推表按 tile 给出了 `minLevel..maxLevel` 跨度 ⇒ 用它拟合出
   * 「该 tile 可承载的 level 跨度」，映射为高度基准。
   *
   * ⚠ 这是**拟合值**，不是原生 `+40`。原生语义：`grade = (h−30)/15`，
   * h 越大 grade 越高。本实现按反推跨度线性铺开，
   * 使 `grade` 能覆盖该 tile 观察到的 level 区间。
   */
  subHeight(tile: number, subtile: number): number {
    const e = this.tbl.entries[tile];
    if (!e) return 30;
    const span = e.maxLevel - e.minLevel;
    if (span <= 0) return 30;
    const n = this.subCountOf(tile);
    const i = ((subtile % n) + n) % n;
    // 把 [0, span] 均分到 n 个子格 ⇒ grade 覆盖 e.minLevel..e.maxLevel
    return 30 + Math.round((span * i) / Math.max(1, n - 1)) * 15;
  }

  /** 多格模板标记（原生 `TileSetClass+737`；反推无从判定 ⇒ 恒 0） */
  isMultiTile(_tile: number): boolean {
    return false;
  }

  /** 诊断：反推覆盖了多少 tile */
  stats(): { total: number; withMultiSub: number; cliffCovered: number } {
    const keys = Object.keys(this.tbl.entries);
    return {
      total: keys.length,
      withMultiSub: keys.filter((k) => this.tbl.entries[Number(k)].subCount > 1).length,
      cliffCovered: keys.filter((k) => {
        const t = Number(k);
        return t >= this.cliffSet && t < this.cliffSet + CLIFF_SEGMENTS * CLIFF_STRIDE;
      }).length,
    };
  }

  /** 坡族起始（诊断用） */
  rampStart(): number {
    return this.rampBase;
  }
}