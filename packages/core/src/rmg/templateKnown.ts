/**
 * 真实 `TemplateProvider` —— 由「已知参数 + 真机结果」反推（2026-10-08）。
 *
 * 【原生语义（已由三个观察者函数交叉确认）】
 *   `0x544BE0 Tile_LandOfSubtile` / `0x5471B0 Tile_SlopeOfSubtile` / `0x544C20 Tile_FrameValidQ`：
 * ```c
 *   tmpl = vtable[156](this);                          // vtable+156 ⇒ 第 39 个虚函数
 *   if (tmpl && (e = tmpl[ subtile % (tmpl[0] * tmpl[1]) + 4 ]) != 0) {
 *       // tmpl[0] = width, tmpl[1] = height
 *       // tmpl[4 ..] = TileFrame* 数组（★ 索引从 4 起）
 *       // TileFrame: +40 height / +41 terrainIndex / +42 slope
 *       return landtype_table[ *(char*)(e + 41) ];      // 0x544BE0
 *       return *(char*)(e + 42);                       // 0x5471B0
 *   }
 *   valid = (a2 < tmpl[0]*tmpl[1]) && (tmpl[a2+4] != 0);   // 0x544C20
 * ```
 *
 * 【数据来源：真机实测，可信度高】
 *  `re/oracle/reverse_templates_known.js` → `vectors/templates_known.json`
 *  数据源 = `F:\YTLauncher\RandMap.Map`
 *  （**theater=0 温带 / MapType=1 / seed=40708 / 8 人**，参数由 `RandMap.Sed` 给出）
 *
 *  实测形态（129 个不同 tile）：
 *  | 族      | tile 数 | 多子格 | 最多子格 |
 *  |---------|---------|--------|----------|
 *  | ground  | 46      | **0**  | 1        |
 *  | ramp    | 13      | **0**  | 1        |
 *  | cliff   | 56      | 40     | 6        |
 *  | water   | 14      | 8      | 4        |
 *  ⇒ **多子格只出现在 `cliff` 与 `water` 族**；`ground`/`ramp` 一律单子格。
 *  ⇒ 全图 SubIndex 集合 = `{0,1,2,3,4,5}`（6 种）
 *
 * ⚠ **仍是逆向，不是 `.TMP` 原值**：
 *  - `subCount` = 实测到的 subIndex **数量**（原生真值是 `w*h`，可能更大）；
 *  - `subSlope` 一律 0（真机 slope 全 0，无法区分「真 0」与「未采到」）；
 *  - `subHeight` 由实测 level 区间拟合（见下）。
 *  一旦 MIX 解密拿到 `.TMP`，**应换回真值**。
 */

/** 反推条目（与 `templates_known.json` 的 `tiles[]` 一一对应） */
export interface KnownTemplateEntry {
  /** tile 全局索引 */
  tile: number;
  /** 族：ground / ramp / cliff / water */
  family: string;
  /** 采样次数（真机上该 tile 出现多少格） */
  samples: number;
  /** 实测到的 subIndex 数（下界） */
  subCount: number;
  /** 实测到的 subIndex 列表（升序） */
  subIndex: number[];
  levelCount: number;
  minLevel: number;
  maxLevel: number;
}

export interface KnownTemplateTable {
  theater: { cliffSet: number; waterSet: number; shorePieces: number; rampBase: number };
  summary: {
    distinctTiles: number;
    /** 全图出现过的 SubIndex 集合 */
    globalSubIndex: number[];
    byFamily: Record<string, { n: number; multi: number; maxSub: number }>;
  };
  tiles: KnownTemplateEntry[];
}

/**
 * 真机反推驱动的 `TemplateProvider`。
 *
 * 与 `FlatTemplateProvider`（占位）相比的关键差异：
 *  `ground`/`ramp` ⇒ 1×1 单子格（与占位一致）
 *  `cliff`/`water` ⇒ **多子格**，`subExists` 按实测 subIndex 集合判定
 */
export class KnownTemplateProvider {
  private readonly tbl: KnownTemplateTable;
  /** tile → entry 的索引（数据量小，但每格都要查，别用 find） */
  private readonly index: Map<number, KnownTemplateEntry>;
  private readonly cliffSet: number;
  private readonly waterSet: number;
  private readonly shorePieces: number;
  private readonly rampBase: number;

  constructor(tbl: KnownTemplateTable) {
    this.tbl = tbl;
    this.index = new Map(tbl.tiles.map((t) => [t.tile, t]));
    this.cliffSet = tbl.theater.cliffSet;
    this.waterSet = tbl.theater.waterSet;
    this.shorePieces = tbl.theater.shorePieces;
    this.rampBase = tbl.theater.rampBase;
  }

  private entryOf(tile: number): KnownTemplateEntry | undefined {
    return this.index.get(tile);
  }

  /**
   * 模板子格总数 `tmpl[0] * tmpl[1]`。
   *
   * 原生 `subtile % (w*h)` ⇒ 越界**环绕**。
   * 本移植取「实测 subIndex 集合的大小」——
   * 崖族量到 6、水族量到 4，未采到的更大子格会被算成环绕（与原生环绕行为同构）。
   */
  private subCountOf(tile: number): number {
    const e = this.entryOf(tile);
    if (e && e.subCount > 0) return e.subCount;
    // 未采样的 tile：按族的实测众数兜底
    if (this.isCliff(tile)) return 4;  // 崖族 [0,1,2,3] 最常见
    if (this.isWater(tile)) return 4;  // 水族 314-321 均为 4
    return 1;                          // ground / ramp 全是单子格
  }

  private isCliff(tile: number): boolean {
    return tile >= this.cliffSet && tile < this.cliffSet + 16 * 14;
  }
  private isWater(tile: number): boolean {
    return tile >= this.waterSet && tile < this.waterSet + 14;
  }

  /** 原生 `tmpl[0]`（宽）。反推不区分宽高，取 1 × N 的单行模板 */
  width(_tile: number): number {
    return 1;
  }

  /** 原生 `tmpl[1]`（高） */
  height(tile: number): number {
    return this.subCountOf(tile);
  }

  /**
   * 子格存在性（原生 `tmpl[subtile % (w*h) + 4] != 0`）。
   *
   * 有实测数据的 tile ⇒ 按**实测 subIndex 集合**判定（最准）；
   * 未采样的 ⇒ 按 `subtile < subCount` 判。
   */
  subExists(tile: number, subtile: number): boolean {
    const e = this.entryOf(tile);
    const n = this.subCountOf(tile);
    const i = ((subtile % n) + n) % n; // 原生用 `% (w*h)` ⇒ 环绕
    if (e && e.subIndex.length > 0) return e.subIndex.includes(i);
    return i < n;
  }

  /**
   * 子格坡度（原生 `*(char*)(e + 42)`）。
   *
   * ⚠ 恒返 0：真机 slope 全为 0。原生基线同样如此 ——
   *   **RMG 产出图不写坡，level 承担全部高差表达**（实测 slope 分布：`0:29161`）。
   */
  subSlope(_tile: number, _subtile: number): number {
    return 0;
  }

  /**
   * 子格地形索引（原生 `landtype_table[*(char*)(e + 41)]`）。
   * 反推无此字段 ⇒ 按族给缺省：水/岸不可通行，其余可通行。
   */
  subTerrainIndex(tile: number, _subtile: number): number {
    if (this.isWater(tile)) return 1;
    if (tile >= this.shorePieces && tile < this.shorePieces + 42) return 1;
    return 0;
  }

  /**
   * 子格高度基准（原生 `*(char*)(e + 40)`，grade = (h−30)/15）。
   *
   * 反推无原生 `+40` ⇒ 按该 tile 实测的 `[minLevel, maxLevel]` 区间线性铺开，
   * 使 `grade` 能覆盖该 tile 观察到的 level 范围。
   */
  subHeight(tile: number, subtile: number): number {
    const e = this.entryOf(tile);
    if (!e) return 30;
    const span = e.maxLevel - e.minLevel;
    if (span <= 0) return 30;
    const n = this.subCountOf(tile);
    const i = ((subtile % n) + n) % n;
    return 30 + Math.round((span * i) / Math.max(1, n - 1)) * 15;
  }

  /** 多格模板标记（原生 `TileSetClass+737`；反推无从判定 ⇒ 恒 0） */
  isMultiTile(_tile: number): boolean {
    return false;
  }

  /** 诊断：与真机实测的覆盖对比 */
  stats(): {
    tiles: number;
    multiSub: number;
    globalSub: number[];
    byFamily: Record<string, { n: number; multi: number }>;
  } {
    return {
      tiles: this.tbl.summary.distinctTiles,
      multiSub: this.tbl.tiles.filter((t) => t.subCount > 1).length,
      globalSub: this.tbl.summary.globalSubIndex,
      byFamily: this.tbl.summary.byFamily,
    };
  }

  rampStart(): number {
    return this.rampBase;
  }
}