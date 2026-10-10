/**
 * 生成管线 —— 对齐 `RandomMapGenerator__Generate 0x00598960` 的阶段编排
 *
 * 已接阶段（其余见 rmg/README.md 阶段表）：
 *   0  播种 RmgRng                        0x0065C6D0
 *   1  map-prep（尺寸/初态/waypoint/河桥抽） 0x00599650（光照/INI 写出走 emit 侧）
 *   3  基础水体（MapType 0/1/2）           0x0059A6C0
 *   4  水体终结器                          0x0059C630
 *
 * 阶段 2（RMGMD.INI）已在 rmgmd.ts；阶段 5+ 待接。
 */

import { RmgGaussian, RmgRng } from './rng';
import { NativeCells, ScratchGrid } from './native';
import { TheaterTables } from './theater';
import { DerivedDimensions } from './options';
import { shoreFinalize, waterBasic, waterFinalize, WaterContext } from './water';
import { waterBasicMt34 } from './waterMt34';
import { regionPlateauThreshold } from './regionPlateau';
import { bridgeConnectPass } from './bridge';
import { cliffDrops } from './cliff';
import { placeCliffs } from './cliffPlacer';
import { bridgeRampStamp, waterReanchor } from './bridgeRamp';
import {
  createRegionState,
  regionBfs1,
  regionBfs2,
  regionFallback,
  regionPartition,
  RegionState,
} from './regions';
import { greenSpread } from './green';
import { recalcAll } from './recalc';
import { hillsMain } from './hills';
import { latStage } from './lat';
import { startCandidate, startWriteFlood, StartState } from './start';
import { oreFields, OreCell } from './ore';
import { placeTechBuildings } from './tech';
import { emitRmgMapIni } from './emitRmg';

export { isClearTile, isGreenTile, isShorePieceTile, isWaterFamily } from './water';

/** 生成所需的全部输入（对应 MapSeedClass 的消费子集） */
export interface GenerateInput {
  seed: number;
  mapType: number;
  waterAmount: number;
  numPlayers: number;
  ruggedness: number;
  vegetation: number;
  tiberiumLayout: number;
  tiberium: number;
  resources: number;
  theater: number;
  dimensions: DerivedDimensions;
  tables: TheaterTables;
  /**
   * 模板元数据表（可选）。
   *
   * 不传 ⇒ 用 `FlatTemplateProvider`（占位：全 1×1 子格、slope 0、height 30）。
   * 传入 ⇒ 用 `KnownTemplateProvider`（真机反推数据，`rmg/templateKnown.ts`）。
   *
   * ⚠ 缺省保持占位是有意的 —— 反推数据仍是**下界**，
   *   接入前需用 `re/duo_known.js` 对拍确认收益。
   */
  templateTable?: unknown;
}

/** 管线运行后的完整状态（供后续阶段 / emit / 测试检查） */
export interface PipelineState {
  ctx: WaterContext;
  /** waypoint 700/699 的菱形坐标 */
  waypointCenter: [number, number];
  /** 河桥使能位（MapSeed+0x310） */
  riverBridge: boolean;
  /** 区域阶段状态（ABED14 / 区域表） */
  regions: RegionState;
  /** 起点状态（阶段 13 写） */
  starts: StartState;
  /** 矿格（阶段 15 写，emit 侧转 OverlayPack） */
  ores: OreCell[];
}

/**
 * map-prep 等价物（0x00599650 的 RMG 状态部分）：
 *   分配 playfield cell（level=4、tile=0）、初始化暂存（+0x38=0、+0x40=-1、
 *   +0x4A=1）、waypoint 700+699 置中心、河桥位 1 抽（rand·K < 0.25）。
 */
export function mapPrep(input: GenerateInput, rng: RmgRng): PipelineState {
  const { dimensions: d } = input;
  const cells = new NativeCells(d.mapW, d.mapH);
  cells.allocate();
  const scratch = new ScratchGrid(cells.linearW);

  // cell level 盖 4（MapSeed+0x30C）、tile 归 0
  for (const cell of cells.iterate()) {
    cell.level = 4;
    cell.tile = 0;
  }
  // 暂存逐槽坐标填充（map-prep 尾部循环）：只有已分配（playfield+交错带）
  // 的坐标获得非零 coord —— 这就是区域阶段 (X!=0||Y!=0) 门控的来源
  for (let y = 0; y < cells.mapW + cells.mapH + 4; y++) {
    for (let x = 0; x < cells.mapW + cells.mapH + 4; x++) {
      if (cells.slotAt(x, y) !== null) {
        scratch.at(x, y).coord = ((y & 0xffff) << 16) | (x & 0xffff);
      }
    }
  }
  // blobCounter（MapSeed+0x308）= 0
  const blobCounter = { value: 0 };

  // 河桥位：1 抽
  const riverBridge = rng.nextUnit() < 0.25;

  // waypoint 700/699 → 地图中心（菱形坐标 (cx+1, cx)）
  const c = (d.mapH >> 1) + (d.mapW >> 1);
  const waypointCenter: [number, number] = [c + 1, c];

  const ctx: WaterContext = {
    rng,
    gaussian: new RmgGaussian(),
    cells,
    scratch,
    theater: input.tables,
    blobCounter,
    mapType: input.mapType,
    waterAmount: input.waterAmount,
    numPlayers: input.numPlayers,
    defaultLevel: 4,
    ruggedness: input.ruggedness,
    vegetation: input.vegetation,
    widthLevel: 0,
    maxTrees: 600,
    theaterIndex: input.theater,
    tiberiumLayout: input.tiberiumLayout,
    resources: input.resources,
    tiberiumPercent: input.tiberium,
    startQuota: 4,
    waterUsedArea: 0,
    starts: { waypoints: [] },
    isoTileTypeCount: input.tables.totalTiles,
    terrainObjects: [],
    structures: [],
    recalc: {
      rules: { cliffBackImpassability: 0 },
      // ⚠ 默认仍用 `FlatTemplateProvider`（占位：全 1×1、slope 0、height 30）。
      // 传入 `templateTable` 时改用 `KnownTemplateProvider`（真机反推数据）。
      // 见 `rmg/templateKnown.ts` 顶部「数据来源」与限制说明。
      templates:
        input.templateTable !== undefined
          ? new (
              require('./templateKnown') as typeof import('./templateKnown')
            ).KnownTemplateProvider(
              input.templateTable as import('./templateKnown').KnownTemplateTable,
            )
          : new (
              require('./recalc') as typeof import('./recalc')
            ).FlatTemplateProvider(input.tables),
    },
  };

  return {
    ctx,
    waypointCenter,
    riverBridge,
    regions: createRegionState(),
    starts: { waypoints: [] },
    ores: [],
  };
}

/**
 * 阶段 5+6：区域划分 → 水/绿区域 BFS → 回退播种（0x598960 @ 0x598C8F..D010）。
 */
export function runRegionStage(state: PipelineState): void {
  const { ctx, regions } = state;
  regionPartition(ctx, regions);
  const mode34 = ctx.mapType === 3 || ctx.mapType === 4;
  for (const region of regions.regions) {
    if (region.water === 0) continue;
    regionBfs1(ctx, region, (region.cellCount > 8000 ? 1 : 0) + (mode34 ? 0 : 1) + 4);
    regionBfs2(ctx, region);
  }
  regionFallback(ctx, regions, 0);
}

/**
 * 阶段 7（**仅 MapType 3/4**）：台地阈值 + 区域分裂。
 *
 * 原生 `0x0058EBC0`：倒序遍历全图累加各区域格数、更新 bbox，
 * 再按阈值 `trunc(2·(scale·0.005+0.05)·W·H)` 决定
 * 「小区域标记保留」还是「大区域尝试分裂」（`0x58D620`，**未移植**）。
 *
 * 序位置：阶段 6（区域 BFS/层级）之后、阶段 11（绿地）之前 ——
 * 原生 3/4 型走 0x58EBC0 → 0x58D620 → 0x58EF10 → … → 0x59B740。
 */
export function runPlateauStage(state: PipelineState): void {
  const { ctx, regions } = state;
  if (ctx.mapType !== 3 && ctx.mapType !== 4) return; // 仅 3/4 型
  regionPlateauThreshold(ctx, regions);
}

/**
 * 阶段 8（**仅 MapType 3/4**）：桥 / 连接。
 *
 * 原生 `0x0058EF10`：三段式
 *   ① `0x58F0C0` 逐区域收集**邻接区域 id 列表**（→ `RmgRegion.neighbors`）
 *   ② `0x5905D0` 逐区域做 5×5 配对（→ `RmgRegion.bridges`，**只记账**）
 *   ③ 清各区域次级结构（本仓无对应堆结构）
 *
 * ⚠ **只记账不落地**：连桥动作 `sub_58F2C0`（写 ramp/brick tile）**未移植**，
 * 所以桥目前不会真的出现在地图上。本阶段的价值是产出邻接关系，
 * 供后续 `0x58F2C0` 与阶段 9（悬崖落差）使用。
 */
export function runBridgeStage(state: PipelineState): void {
  const { ctx, regions } = state;
  if (ctx.mapType !== 3 && ctx.mapType !== 4) return; // 仅 3/4 型
  bridgeConnectPass(ctx, regions);
}

/**
 * 阶段 9（**仅 MapType 3/4**）：悬崖落差。
 *
 * 原生 `0x005A19E0`（97 行）：蛇形扫全图，按 tile 分三族
 * （干崖 / 水崖 / 抬升崖）调整邻格 level **±4**，并把源格 regionId 抄给目标格。
 * ①② 两族各有 50% 概率跳过，③ 不掷 RNG。
 */
export function runCliffStage(state: PipelineState): number {
  const { ctx } = state;
  if (ctx.mapType !== 3 && ctx.mapType !== 4) return 0; // 仅 3/4 型
  // ✅ 原生序（`sub_578E60` = PlaceCliffs）：
  //   Pass1 `CliffPass`(0x579010) 填洼 → Pass2 `PlaceCliffPiece`(0x579620) 落片
  //   → `CorrectCliffTiles`(0x5A17F0) 转向修正 → `FixCliffLevels`(0x5A19E0) 崖边 ±4。
  // ⚠ 此前本阶段只跑 `cliffDrops`（= FixCliffLevels），而它三个分支全部以
  //   「本格已是崖族 tile」为前提 —— 我们从没写过 cliff tile ⇒ **一直是空转**，
  //   对拍里 `cliff 恒 0` 的根因。
  placeCliffs(ctx);
  return cliffDrops(ctx);
}

/**
 * 阶段 10（**仅 MapType 3/4**）：桥坡 + 水砖再锚定。
 *
 * 原生序（`0x598D62` 调用块）：
 *   `0x578E60` 桥坡 → `0x5A17F0` 水砖再锚定 → 之后才是阶段 11 绿地。
 *
 * ⚠ `0x578E60` 是**包装器**：`579010`（筛选）/ `579620`（盖坡）/ `58BDC0`（cell 构造）
 * 三个关键函数未反编译，本移植按可确定的框架语义近似。
 * `0x5A17F0` 语义明确，已完整移植。
 */
export function runBridgeRampStage(state: PipelineState): void {
  const { ctx } = state;
  if (ctx.mapType !== 3 && ctx.mapType !== 4) return; // 仅 3/4 型
  // ✅ `bridgeRampStamp` 的第一轮判定已按 capstone 实测（size=0x2B3）修正
  //    —— 原生返回「工作是否推进」而非「地形是否可生长」。
  //    第二轮盖坡（`0x579620`，size=0x539）仍为近似，但不再是死路径。
  bridgeRampStamp(ctx, -1);
  waterReanchor(ctx);
}

/**
 * 阶段 11：绿地扩散（0x0059B740）。
 */
export function runGreenStage(state: PipelineState): void {
  greenSpread(state.ctx);
}

/**
 * 阶段 16：山丘（0x5A35F0）。
 */
export function runHillsStage(state: PipelineState): void {
  hillsMain(state.ctx);
}

/**
 * 阶段 17：LAT/树/石（温带 5A38C0+5A3AE0；非温带 5A4280）。
 */
export function runLatStage(state: PipelineState): void {
  latStage(state.ctx);
}

/**
 * 阶段 13：起始点（594B50 → 5A1FB0；原生在 LAT 前跑，此处独立入口
 * 供在山丘/LAT 后补跑——序差异见 README 待办）。
 */
export function runStartStage(state: PipelineState): void {
  state.ctx.starts = state.starts;
  startCandidate(state.ctx, state.regions, state.starts, state.ctx.tiberiumLayout);
  startWriteFlood(state.ctx, state.starts, state.ctx.numPlayers);
}

/**
 * 阶段 14：中立科技建筑（0x5A95B0）—— 依赖建筑足迹规则数据，未接（见 README）。
 * 抽数已在 594B50 的 MapType==0 分支预消耗。
 */

/**
 * 阶段 15：矿场（5A23A0 → 5A28C0）。
 */
export function runOreStage(state: PipelineState): void {
  const regions = state.regions.regions.map((r) => ({
    id: r.id,
    quota: r.quota,
    cells: r.cells,
  }));
  state.ores = oreFields(state.ctx, regions);
}

/**
 * 阶段 12：细胞属性重算（0x47D2B0(cell,-1) 全图迭代）。
 * Generate 在 绿地后 / 起点矿场后 / LAT 后 各跑一遍。
 */
export function runRecalcStage(state: PipelineState): void {
  recalcAll(state.ctx);
}

/**
 * 阶段 3+4。按 MapType 分派水体驱动（原生入口 `0x0059A6C0` / `0x0059C580`）：
 *   - MapType 0/1/2 → `waterBasic`（全图铺 waterSet，再按形状打洞）
 *   - MapType 3/4   → `waterBasicMt34`（**不铺满**，在清地上生长河/湖）
 *
 * ⚠ 3/4 型与 0/1/2 型是**两条独立路径**，不是参数差异：
 *   3/4 型不进 `waterBasic`（否则整图变水），走 `waterDriverMt34`（`0x0059C580`）。
 */
export function runWaterStage(state: PipelineState): void {
  const { ctx } = state;
  if (ctx.mapType === 3 || ctx.mapType === 4) {
    waterBasicMt34(ctx);
    return;
  }
  waterBasic(ctx);
  waterFinalize(ctx);
}

/** 一键：播种 → map-prep → 水体（MapType 0/1/2） */
export function generateWaterStage(input: GenerateInput): PipelineState {
  const rng = RmgRng.fromSeed(input.seed);
  const state = mapPrep(input, rng);
  runWaterStage(state);
  return state;
}

/** 一键：水体 → 区域 → 绿地（阶段 0-6 + 11，MapType 0/1/2） */
export function generateThroughGreen(input: GenerateInput): PipelineState {
  const state = generateWaterStage(input);
  runRegionStage(state);
  runPlateauStage(state);   // 阶段 7（仅 3/4 型；0/1/2 型内部直接 return）
  runBridgeStage(state);    // 阶段 8（仅 3/4 型）
  runCliffStage(state);     // 阶段 9（仅 3/4 型）
  runBridgeRampStage(state);// 阶段 10（仅 3/4 型）
  runGreenStage(state);
  return state;
}

/** 一键：… → 绿地 → 重算（阶段 0-6 + 11-12） */
export function generateThroughRecalc(input: GenerateInput): PipelineState {
  const state = generateThroughGreen(input);
  runRecalcStage(state);
  return state;
}

/** 一键：… → 重算 → 山丘（阶段 0-6 + 11-12 + 16；原生 16 前还有 13-15 未接） */
export function generateThroughHills(input: GenerateInput): PipelineState {
  const state = generateThroughRecalc(input);
  runHillsStage(state);
  return state;
}

/** 一键：… → 山丘 → LAT/树/石（阶段 0-6 + 11-12 + 16-17） */
export function generateThroughLat(input: GenerateInput): PipelineState {
  const state = generateThroughHills(input);
  latStage(state.ctx);
  return state;
}

/** 一键：… → LAT → 起始点（阶段 0-6 + 11-13 + 16-17；起点序与原生不同） */
export function generateThroughStart(input: GenerateInput): PipelineState {
  const state = generateThroughLat(input);
  runStartStage(state);
  return state;
}

/** 一键：… → 起始点 → 矿场（阶段 0-6 + 11-13 + 15-17；原生 15 在 13 前但依赖起点区） */
export function generateThroughOre(input: GenerateInput): PipelineState {
  const state = generateThroughStart(input);
  runOreStage(state);
  return state;
}

/**
 * 阶段 14：中立科技建筑（0x005A95B0）。原生序在起点后、矿场前。
 */
export function runTechStage(state: PipelineState): void {
  placeTechBuildings(state.ctx);
}

/**
 * 一键：全管线，按原生 0x598960 实证顺序：
 *   水(3) → 终结(4) → 区域(5/6) → 绿地(11) → 重算(12) → 起始点(13)
 *   → 科技(14) → 矿场(15) → 重算(12) → 山丘(16) → LAT/树/石(17) → 重算(12)
 * → emit .map 文本。
 */
export function generateFullMap(
  input: GenerateInput,
  mapName?: string,
): { state: PipelineState; ini: string } {
  const state = generateThroughRecalc(input);
  runStartStage(state);
  runTechStage(state);
  runOreStage(state);
  runRecalcStage(state);
  runHillsStage(state);
  runLatStage(state);
  runRecalcStage(state);
  // 收尾清扫：LAT 后再跑一次岸线终结（覆盖 Pass2/hills 清理写入的 0xFFFF），
  // 然后把不属于任何合法地形族的孤儿 tile（如 latRepair 回退写出的
  // rampBase−1）回填清地 —— 原生地图无此类残留
  shoreFinalize(state.ctx, 0, 0);
  const t = state.ctx.theater;
  const inFam = (v: number, base: number | undefined, len: number) =>
    base !== undefined && base >= 0 && v >= base && v < base + len;
  for (const cell of state.ctx.cells.iterate()) {
    const v = cell.tile;
    const known =
      v === 0 ||
      v === 0xffff ||
      inFam(v, t.waterSet, 14) ||
      inFam(v, t.shorePieces, 42) ||
      inFam(v, t.rampBase, 19) ||
      inFam(v, t.rampSmooth, 12) ||
      inFam(v, t.roughTile, 1) ||
      inFam(v, t.sandTile, 1) ||
      inFam(v, t.greenTile, 1) ||
      inFam(v, t.paveTile, 1) ||
      inFam(v, t.clearToRoughLat, 16) ||
      inFam(v, t.clearToSandLat, 16) ||
      inFam(v, t.clearToGreenLat, 16) ||
      inFam(v, t.clearToPaveLat, 16) ||
      inFam(v, t.waterfallEast, 4) ||
      inFam(v, t.waterfallWest, 4) ||
      inFam(v, t.waterfallNorth, 4) ||
      inFam(v, t.waterfallSouth, 4) ||
      inFam(v, t.cliffSet, 40) ||
      inFam(v, t.cliffRamps, 20) ||
      inFam(v, t.bridges, 16) ||
      inFam(v, t.woodBridges, 16);
    if (!known) {
      cell.tile = 0;
      cell.subTile = 0;
      cell.slope = 0;
    }
  }
  runRecalcStage(state);
  const ini = emitRmgMapIni(state.ctx, state.starts.waypoints, state.ctx.structures, {
    numPlayers: input.numPlayers,
    name: mapName,
  });
  return { state, ini };
}
