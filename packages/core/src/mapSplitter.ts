/**
 * 地图拆解器（Map Splitter）
 *
 * 把一张**完整地图**按 `MapUnitWidth × MapUnitHeight` 的网格切割成若干张
 * "地图单元" 切片（slice）。每张切片都是可独立复用、能被生成器选中并拼接的
 * `.map` 单元文件，从而大幅扩充地图单元模板库。
 *
 * 核心思路：
 *   1. 网格切割：把整张地图的图块按绝对 (Rx, Ry) 坐标划分到 `gx × gy` 个单元块；
 *   2. 边语义分类：对每条缝的"入边"（纵缝=右块首列，横缝=下块首行）取逐格
 *      z 剖面，剖面即连接类 —— 同类边的逐格高度完全一致，因此拼接处的
 *      高度连续性与源图逐字节相同（不会产生台阶/洞）。剖面先对齐到手工
 *      单元的连接类型（config.handmadeRecvProfiles，按"共识需求"判定，保证
 *      与手工单元拼接同样高度安全），对不上的进扩展类（SubTile+Z 编码通道）。
 *      旧方案的"整边签名哈希指纹"已废弃：指纹只保证能复原原邻接，任意
 *      两块之间几乎永远配不上（实测 100% 死格），%6 桶化则引入 ~50% 假接缝。
 *   3. 写指示图块：在切片地图的外围按连接 ID 摆放指示图块（ID 编解码见
 *      tile/connectionId.ts），与 AbstractMapUnit.Initialize 的检测约定逐字节
 *      一致，保证生成器能正确读回；
 *   4. 平移对象：把属于该块的单位/建筑/地形等对象坐标改写到切片本地坐标。
 *
 * 连接一致性保证：相邻切片共享同一条缝，因此两边朝向该缝的连接 ID 相同，
 * 重拼时生成器的连接校验（NW↔SE、NE↔SW 等）会自动通过。
 *
 * 已知取舍（v1）：
 *   - 连接类只承载高度剖面，不含地形族/覆盖物信息：同类的两条边高度衔接
 *     完全正确，但边缘一格的地形花纹（如水岸走向）可能与源图不同——这是
 *     "可拼"与"逐字节复刻"之间的取舍，符合 quality-over-parity 方向；
 *   - 扩展类编号按本次拆解批内字典序分配：同批切片（含 spawn 切片）互通；
 *     跨批切片只有对齐到手工类型的类能互通。
 *
 * 本模块为纯函数、不依赖 Node fs，可在浏览器与 Node 两端的 core 包内复用。
 */

import { MapFile } from './fileio';
import { IniFile } from './io/iniFile';
import { Overlay } from './tile/overlay';
import { Theater } from './tile/enums';
import { IsoTile } from './tile/isoTile';
import { encodeConnectionId, CONNECTION_ID_MAX } from './tile/connectionId';

/** 拆解配置 */
export interface MapSplitConfig {
  /** 地图单元宽（图块数），通常来自 settings.ini 的 MapUnitSize */
  mapUnitWidth: number;
  /** 地图单元高（图块数） */
  mapUnitHeight: number;
  /** 顶角坐标 X，通常来自 settings.ini 的 TopCorner 第一个值 */
  startingX: number;
  /** 顶角坐标 Y，TopCorner 第二个值 */
  startingY: number;
  /** 剧场（决定切片文件里的 Theater 字段） */
  theater: Theater;
  /** 指示图块编号，来自 indicator.map 的 IsoTileList[0].TileNum */
  indicatorNum: number;
  /**
   * empty.map 内容（可选）：单元的「空白基准」模板。
   *
   * 手工地图单元在功能窗口（[startingX, startingX+mapUnitWidth) × …）**之外**画了一圈
   * 框（TEMPERATE 是 Tile293/294 公路圈 + Tile0 清地，DESERT 是 Tile386 整圈填充…）。
   * 实测（2026-09-18，verify-split「切片空白格语义」节）：窗口外的格不参与
   * AbstractMapUnit.Initialize 的读取，也不被 PlaceMapUnitToWorkingMap 消费 ⇒ 纯视觉，
   * 在编辑器里让单元有边界感。`splitMap` 的 `frame: true` 会按本模板给切片画框。
   */
  emptyMapContent?: string;
  /**
   * 手工单元「接收剖面」表（可选；server 的 buildSplitConfig 从 theater 模板构建）。
   *
   * 用于把切片缝的 z 剖面对齐到手工连接类型：nw 每项是一个手工单元的
   * NWConnectionType 与其首列各行 z（NE 角色同理为首行）；-1 表示该格在单元
   * 文件里缺图块（视为通配）。缺省时全部走扩展类——切片仍能自拼，但不与
   * 手工单元互通。
   */
  handmadeRecvProfiles?: {
    nw: { type: number; zs: number[] }[];
    ne: { type: number; zs: number[] }[];
  };
}

/** 单张切片结果 */
export interface MapSplitSlice {
  /** 切片文件名（不含 .map 后缀） */
  name: string;
  /** 网格横坐标（单元列） */
  gridX: number;
  /** 网格纵坐标（单元行） */
  gridY: number;
  /** 切片 .map 文件内容（INI 文本） */
  content: string;
}

/** 以出生点为中心切出的独立 spawn 单元（每个文件只带一个出生点）。 */
export interface MapSpawnUnit {
  /** 文件名（不含 .map 后缀），已含 "spawn" 以便生成器识别 */
  name: string;
  /** 单元 .map 文件内容（INI 文本） */
  content: string;
  /** 源图出生点绝对坐标 */
  x: number;
  y: number;
  /** 窗口内有缺失格（保留原版格子，不补平地） */
  partial: boolean;
}

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------

/** FNV-1a 32 位哈希（确定性、稳定；仅用于切片权值的稳定抖动）。 */
function hashFnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// 缝连接类：入边 z 剖面语义分类
// ---------------------------------------------------------------------------

/** 一条边逐格的 z 剖面；-1 = 源图该格缺图块（地图菱形外/空地） */
type ZProfile = number[];

/** 缝角色：nw = 纵缝入边（右块首列，与手工单元 NW 接收边同角色）；ne = 横缝入边（下块首行） */
type SeamRole = 'nw' | 'ne';

function lineZ(
  tileByRxRy: Map<string, IsoTile>,
  rx: number,
  ry: number,
  count: number,
  dx: number,
  dy: number,
): ZProfile {
  const zs: ZProfile = [];
  for (let k = 0; k < count; k++) {
    const t = tileByRxRy.get(`${rx + dx * k},${ry + dy * k}`);
    zs.push(t ? t.Z : -1);
  }
  return zs;
}

function profileKey(zs: ZProfile): string {
  return zs.join(',');
}

/** 手工单元某连接类型的"共识需求"：每行 z 需求（-1 = 该行全部缺格，视为通配） */
interface RecvSpec {
  type: number;
  required: number[];
}

/**
 * 同类型各行的 z 需求一致率低于此值时放弃该类型（不可安全对齐）。
 */
const MAJORITY_RATIO = 0.8;

/**
 * 从手工单元 recv 剖面表构建对齐规格（多数共识版）。
 *
 * 实测（2026-11-18，SNOW）：每类 12~43 个单元里普遍有 1 个"少数派"
 * （025/018/037/043，边缘阶梯与主流差一格），旧的"任何冲突→整类丢弃"
 * 规则会把最常用的类型全部杀掉，迫使全平剖面进扩展类、组合空间碎片化。
 * 改为逐行多数投票取共识，一致率（匹配 (单元,行) 数 / 有定义 (单元,行) 数）
 * ≥ MAJORITY_RATIO 才对齐。
 *
 * 代价（有界、可量化）：对齐后的切片若恰好挨着该类的少数派单元，少数派
 * 边缘那几行会出现 1~3 格 z 错位——发生率 ≈ 少数派占比（~4%），远小于
 * 组合缺失造成的整格空地。
 */
function buildRecvSpecs(
  entries?: { type: number; zs: number[] }[],
): RecvSpec[] {
  if (!entries || entries.length === 0) return [];
  const byType = new Map<number, number[][]>();
  for (const e of entries) {
    if (e.type < 0) continue;
    if (!byType.has(e.type)) byType.set(e.type, []);
    byType.get(e.type)!.push(e.zs);
  }
  const specs: RecvSpec[] = [];
  for (const [type, profiles] of [...byType.entries()].sort((a, b) => a[0] - b[0])) {
    const len = profiles[0].length;
    const required: number[] = new Array(len).fill(-1);
    let defined = 0;
    let agreed = 0;
    for (let r = 0; r < len; r++) {
      const votes = new Map<number, number>();
      for (const zs of profiles) {
        if (zs[r] >= 0) votes.set(zs[r], (votes.get(zs[r]) ?? 0) + 1);
      }
      if (votes.size === 0) continue; // 该行全部缺格 → 通配
      let bestZ = -1;
      let bestN = 0;
      for (const [z, n] of votes) {
        if (n > bestN) {
          bestZ = z;
          bestN = n;
        }
      }
      required[r] = bestZ;
      defined += profiles.length;
      agreed += bestN;
    }
    if (defined === 0) continue; // 无任何确定需求 → 对齐无意义
    if (agreed / defined < MAJORITY_RATIO) continue; // 分歧过大 → 不可安全对齐
    specs.push({ type, required });
  }
  return specs;
}

/**
 * 完整剖面（无缺格）对齐到手工连接类型：逐行满足共识需求（通配行任意）。
 * 只对齐完整剖面 —— 带缺格的边只出现在地图菱形外缘，无真实拼接意义。
 * 多个类型同时满足时取类型号最小者（确定性）。
 */
function alignProfile(p: ZProfile, specs: RecvSpec[]): number | null {
  if (p.some((v) => v < 0)) return null;
  for (const spec of specs) {
    let ok = true;
    for (let r = 0; r < spec.required.length; r++) {
      if (spec.required[r] >= 0 && p[r] !== spec.required[r]) {
        ok = false;
        break;
      }
    }
    if (ok) return spec.type;
  }
  return null;
}

/**
 * 缝连接类分配器。
 *
 * 分配规则：
 *   1. 完整剖面先尝试对齐手工连接类型（对齐后与手工单元拼接高度安全）；
 *   2. 其余剖面进扩展类：批内按首见顺序从 16 起（0..15 保留给"位置即类型"
 *      的手工/兼容语义），编码走 SubTile+Z 通道，容量见 CONNECTION_ID_MAX。
 *
 * 扩展类编号是**批内**的：同一张图（含同批 spawn 切片）互通；跨批只有
 * 对齐到手工类型的类互通 —— 失败方向是"配不上"（安全），绝不会"错配"。
 */
function createSeamClassAssigner(config: MapSplitConfig) {
  const specsByRole: Record<SeamRole, RecvSpec[]> = {
    nw: buildRecvSpecs(config.handmadeRecvProfiles?.nw),
    ne: buildRecvSpecs(config.handmadeRecvProfiles?.ne),
  };
  const extended = new Map<string, number>();
  let nextExtended = 16;
  return {
    assign(p: ZProfile, role: SeamRole): number {
      const aligned = alignProfile(p, specsByRole[role]);
      if (aligned !== null) return aligned;
      const key = profileKey(p);
      let id = extended.get(key);
      if (id === undefined) {
        if (nextExtended > CONNECTION_ID_MAX) {
          throw new Error('切片连接类数量超出编码空间（>3600）');
        }
        id = nextExtended++;
        extended.set(key, id);
      }
      return id;
    },
  };
}

/**
 * 计算全部缝的连接类 ID。
 *
 *   seamV[c][r]：纵向缝（单元列边界 c，单元行 r）—— 采样绝对列 X = OX + c*W，
 *                即右块首列，角色 nw；
 *   seamH[r][c]：横向缝（单元行边界 r，单元列 c）—— 采样绝对行 Y = OY + r*H，
 *                即下块首行，角色 ne。
 *
 * 相邻两块朝同一条缝取同一表项，因此两侧连接 ID 必然一致。
 */
function computeSeamIds(
  tileByRxRy: Map<string, IsoTile>,
  OX: number,
  OY: number,
  gx: number,
  gy: number,
  W: number,
  H: number,
  assigner: ReturnType<typeof createSeamClassAssigner>,
): { seamV: number[][]; seamH: number[][] } {
  const seamV: number[][] = [];
  const seamH: number[][] = [];
  for (let c = 0; c <= gx; c++) {
    seamV[c] = [];
    for (let r = 0; r < gy; r++) {
      seamV[c][r] = assigner.assign(
        lineZ(tileByRxRy, OX + c * W, OY + r * H, H, 0, 1),
        'nw',
      );
    }
  }
  for (let r = 0; r <= gy; r++) {
    seamH[r] = [];
    for (let c = 0; c < gx; c++) {
      seamH[r][c] = assigner.assign(
        lineZ(tileByRxRy, OX + c * W, OY + r * H, W, 1, 0),
        'ne',
      );
    }
  }
  return { seamV, seamH };
}

/**
 * 判断某个 (rx, ry) 单元是否落在边长为 s 的菱形地图内。
 * 与 CreateIsoTileList / CreateEmptyMap 的坐标换算保持一致。
 */
function cellValidInDiamond(rx: number, ry: number, s: number): boolean {
  const dx = rx - ry + s - 1;
  const dy = rx + ry - s - 1;
  return dx >= 0 && dx < 2 * s && dy >= 0 && dy < 2 * s;
}

// ---------------------------------------------------------------------------
// 主函数：拆解整张地图
// ---------------------------------------------------------------------------

/** 拆解选项 */
export interface MapSplitOptions {
  /**
   * 是否跳过"内部完全没有实际地形"的空块（即整块图块都是空 -1）。
   * 这类块通常出现在完整地图菱形边角之外，没有保留价值。
   * 默认 true。
   */
  skipEmpty?: boolean;
  /**
   * 跳过功能窗口内缺源地图地形的边缘块。
   * 这类块在编辑器里会被 [Map] Size 自动补清地，默认由网页层开启。
   */
  skipPartial?: boolean;
  /**
   * 是否给切片画「窗外框」（沿用 config.emptyMapContent 里手工单元的框图块）。
   *
   * 框只落在功能窗口之外 ⇒ 对生成器纯视觉（已由 verify-split「切片空白格语义」节
   * 用机器实验证明：块外 -1 填 0 后 AbstractMapUnit 模型逐格一致）。
   * 默认 false（保持既有格式不变；命令行/网页层可显式开启）。
   */
  frame?: boolean;
}

/**
 * 将一张完整的 `.map` 文本按网格拆解成若干切片。
 *
 * @param sourceIni 完整地图的 INI 文本内容
 * @param config    拆解配置（单元尺寸、顶角、指示图块等）
 * @param options   可选项
 * @returns 切片列表（每个含文件内容与网格坐标）
 */
export function splitMap(
  sourceIni: string,
  config: MapSplitConfig,
  options?: MapSplitOptions,
): MapSplitSlice[] {
  const { mapUnitWidth: W, mapUnitHeight: H, startingX: SX, startingY: SY } =
    config;
  const skipEmpty = options?.skipEmpty ?? true;
  const skipPartial = options?.skipPartial ?? false;

  // 1. 读取源地图的等距图块（绝对坐标）
  const sourceMap = new MapFile();
  sourceMap.CreateIsoTileList(sourceIni);
  if (sourceMap.IsoTileList.length === 0) {
    throw new Error('源地图没有可拆解的图块（IsoTileList 为空）。');
  }

  // 以绝对 (rx,ry) 索引源图块，便于快速查找
  const tileByRxRy = new Map<string, IsoTile>();
  let minRx = Infinity,
    maxRx = -Infinity;
  let minRy = Infinity,
    maxRy = -Infinity;
  for (const t of sourceMap.IsoTileList) {
    tileByRxRy.set(`${t.Rx},${t.Ry}`, t);
    if (t.Rx < minRx) minRx = t.Rx;
    if (t.Rx > maxRx) maxRx = t.Rx;
    if (t.Ry < minRy) minRy = t.Ry;
    if (t.Ry > maxRy) maxRy = t.Ry;
  }

  // 源地图原点（统一到单元尺寸的倍数，让单元块与整图坐标对齐）
  const OX = Math.floor(minRx / W) * W;
  const OY = Math.floor(minRy / H) * H;
  const gx = Math.floor((maxRx - OX) / W) + 1;
  const gy = Math.floor((maxRy - OY) / H) + 1;

  // 读取源地图覆盖物（绝对坐标）
  const sourceOverlays = sourceMap.ReadOverlay(sourceIni) ?? [];
  const overlayByIdx = new Map<string, Overlay>();
  for (const ov of sourceOverlays) {
    if (ov.Tile !== null) {
      overlayByIdx.set(`${ov.Tile.Rx},${ov.Tile.Ry}`, ov);
    }
  }

  // 2. 计算每条"缝"的连接类 ID（入边 z 剖面语义分类）
  const assigner = createSeamClassAssigner(config);
  const { seamV, seamH } = computeSeamIds(
    tileByRxRy,
    OX,
    OY,
    gx,
    gy,
    W,
    H,
    assigner,
  );

  /** 该块内容区是否含非空图块（缺格或 TileNum=-1 视为空）。 */
  const blockHasTerrain = (i: number, j: number): boolean => {
    const blockRX0 = OX + i * W;
    const blockRY0 = OY + j * H;
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        const tile = tileByRxRy.get(`${blockRX0 + x},${blockRY0 + y}`);
        if (tile && tile.TileNum !== -1) return true;
      }
    }
    return false;
  };

  /** 功能窗口是否完全被源地图地形覆盖（每一格都存在且不是 -1）。 */
  const blockFullyCovered = (i: number, j: number): boolean => {
    const blockRX0 = OX + i * W;
    const blockRY0 = OY + j * H;
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        const tile = tileByRxRy.get(`${blockRX0 + x},${blockRY0 + y}`);
        if (!tile || tile.TileNum === -1) return false;
      }
    }
    return true;
  };

  // 3. 逐块生成切片
  const frame = options?.frame === true && !!config.emptyMapContent;
  const frameTemplate = frame
    ? buildFrameTemplate(config.emptyMapContent!, SX, SY, W, H)
    : null;

  const slices: MapSplitSlice[] = [];
  for (let i = 0; i < gx; i++) {
    for (let j = 0; j < gy; j++) {
      if (skipEmpty && !blockHasTerrain(i, j)) continue;
      if (skipPartial && !blockFullyCovered(i, j)) continue;
      const partial = !blockFullyCovered(i, j);
      const content = buildSlice(
        i,
        j,
        W,
        H,
        SX,
        SY,
        OX,
        OY,
        config,
        tileByRxRy,
        overlayByIdx,
        seamV,
        seamH,
        sourceIni,
        frameTemplate,
        partial,
      );
      slices.push({
        name: `split_${i}_${j}`,
        gridX: i,
        gridY: j,
        content,
      });
    }
  }

  return slices;
}

// ---------------------------------------------------------------------------
// 出生点单元：以每个 Waypoint 为中心单独切一个 MapUnitSize 窗口
// ---------------------------------------------------------------------------

/** empty.map 功能窗口里最常见的图块号（没有 empty.map 时回退到 0）。 */
function clearTileFromEmptyMap(
  emptyMapContent: string | undefined,
  SX: number,
  SY: number,
  W: number,
  H: number,
): number {
  if (!emptyMapContent) return 0;
  try {
    const empty = new MapFile();
    empty.CreateIsoTileList(emptyMapContent);
    const counts = new Map<number, number>();
    for (const t of empty.IsoTileList) {
      if (t.Rx < SX || t.Rx >= SX + W || t.Ry < SY || t.Ry >= SY + H) continue;
      if (t.TileNum === -1) continue;
      counts.set(t.TileNum, (counts.get(t.TileNum) ?? 0) + 1);
    }
    let best = 0;
    let bestCount = 0;
    for (const [tile, count] of counts) {
      if (count > bestCount) {
        best = tile;
        bestCount = count;
      }
    }
    return best;
  } catch {
    return 0;
  }
}

/**
 * 以源图每个出生点为中心切出独立的 spawn 单元（每个文件只含一个出生点）。
 *
 * 与普通网格切片的区别：
 *   - 窗口以出生点为中心（而不是固定网格），出生点落在窗口中心；
 *   - 只导出含出生点的单元，不产出普通地形切片；
 *   - 连接 ID 沿用出生点所在网格块的缝隙签名，便于和同批地形切片接边；
 *   - 窗口内其它出生点会被清掉，保证一个 spawn 单元只带出一个起点。
 */
export function splitSpawnUnits(
  sourceIni: string,
  config: MapSplitConfig,
): MapSpawnUnit[] {
  const { mapUnitWidth: W, mapUnitHeight: H, startingX: SX, startingY: SY } =
    config;

  const sourceMap = new MapFile();
  sourceMap.CreateIsoTileList(sourceIni);
  if (sourceMap.IsoTileList.length === 0) {
    throw new Error('源地图没有可拆解的图块（IsoTileList 为空）。');
  }

  const tileByRxRy = new Map<string, IsoTile>();
  let minRx = Infinity;
  let maxRx = -Infinity;
  let minRy = Infinity;
  let maxRy = -Infinity;
  for (const t of sourceMap.IsoTileList) {
    tileByRxRy.set(`${t.Rx},${t.Ry}`, t);
    if (t.Rx < minRx) minRx = t.Rx;
    if (t.Rx > maxRx) maxRx = t.Rx;
    if (t.Ry < minRy) minRy = t.Ry;
    if (t.Ry > maxRy) maxRy = t.Ry;
  }

  const OX = Math.floor(minRx / W) * W;
  const OY = Math.floor(minRy / H) * H;
  const gx = Math.floor((maxRx - OX) / W) + 1;
  const gy = Math.floor((maxRy - OY) / H) + 1;

  const sourceOverlays = sourceMap.ReadOverlay(sourceIni) ?? [];
  const overlayByIdx = new Map<string, Overlay>();
  for (const ov of sourceOverlays) {
    if (ov.Tile !== null) {
      overlayByIdx.set(`${ov.Tile.Rx},${ov.Tile.Ry}`, ov);
    }
  }

  // spawn 单元连接类（诚实边语义）：spawn 窗口 = 中心核心区原图 + 外围清地
  // 填充，边缘实际内容与网格缝无关 —— 边类必须按窗口实际边缘剖面（NW/NE）
  // 和"期望邻居剖面"（SE/SW：核心区行/列取源图东/南邻的 z，填充区取 0）
  // 分配，而不是照抄网格缝表，否则类声称的剖面与切片实际边缘不符，
  // 拼接处可能出现台阶。
  const assigner = createSeamClassAssigner(config);

  // 源图出生点（坐标格式 YYYXXX，0,0 视为未使用）
  const ini = new IniFile(sourceIni);
  const waypointSection = ini.GetSection('Waypoints');
  if (!waypointSection) return [];

  const waypoints: Array<{ x: number; y: number }> = [];
  const seen = new Set<string>();
  for (const key of waypointSection.Keys) {
    const value = waypointSection.GetStringValue(key, '').trim();
    if (value.length <= 3) continue;
    const x = parseInt(value.slice(-3), 10);
    const y = parseInt(value.slice(0, -3), 10);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x === 0 && y === 0) continue;
    const dedupe = `${x},${y}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    waypoints.push({ x, y });
  }

  const offsetX = Math.floor((W - 1) / 2);
  const offsetY = Math.floor((H - 1) / 2);
  // 出生点只取一小块完整基地地形（默认 10×10），其余补该 theater 的清地
  // 凑满单元窗口；清地取 empty.map 功能窗口里最常见的图块。
  const coreW = Math.min(10, W);
  const coreH = Math.min(10, H);
  const fillTile = clearTileFromEmptyMap(config.emptyMapContent, SX, SY, W, H);

  const units: MapSpawnUnit[] = [];
  // 与 buildSpawnUnit 的填充逻辑保持一致的核心区偏移
  const coreX0 = offsetX - Math.floor((coreW - 1) / 2);
  const coreY0 = offsetY - Math.floor((coreH - 1) / 2);
  for (let index = 0; index < waypoints.length; index++) {
    const wp = waypoints[index];
    const originX = wp.x - offsetX;
    const originY = wp.y - offsetY;
    // 窗口本地 (x,y) 的实际内容 z：核心区取源图（缺格 0），外围填充 0
    const contentZ = (x: number, y: number): number => {
      const inCore =
        x >= coreX0 && x < coreX0 + coreW && y >= coreY0 && y < coreY0 + coreH;
      if (!inCore) return 0;
      const t = tileByRxRy.get(`${originX + x},${originY + y}`);
      return t ? t.Z : 0;
    };
    // 核心区 (x,y) 处期望其东/南邻居的 z（源图中的真实邻居；缺格/填充 0）
    const expectZ = (x: number, y: number, dx: number, dy: number): number => {
      const inCore =
        x >= coreX0 && x < coreX0 + coreW && y >= coreY0 && y < coreY0 + coreH;
      if (!inCore) return 0;
      const t = tileByRxRy.get(`${originX + x + dx},${originY + y + dy}`);
      return t ? t.Z : 0;
    };
    const nwP: number[] = [];
    const seP: number[] = [];
    const neP: number[] = [];
    const swP: number[] = [];
    for (let y = 0; y < H; y++) {
      nwP.push(contentZ(0, y)); // NW 边 = 首列实际内容
      seP.push(expectZ(W - 1, y, 1, 0)); // SE 边 = 期望东邻首列
    }
    for (let x = 0; x < W; x++) {
      neP.push(contentZ(x, 0)); // NE 边 = 首行实际内容
      swP.push(expectZ(x, H - 1, 0, 1)); // SW 边 = 期望南邻首行
    }
    const built = buildSpawnUnit(
      originX,
      originY,
      wp,
      W,
      H,
      SX,
      SY,
      config,
      tileByRxRy,
      overlayByIdx,
      sourceIni,
      {
        nw: assigner.assign(nwP, 'nw'),
        se: assigner.assign(seP, 'nw'),
        ne: assigner.assign(neP, 'ne'),
        sw: assigner.assign(swP, 'ne'),
      },
      coreW,
      coreH,
      fillTile,
    );
    units.push({
      name: `spawn_${index + 1}`,
      content: built.content,
      x: wp.x,
      y: wp.y,
      partial: built.partial,
    });
  }

  return units;
}

/**
 * 构建单个出生点单元：以 (originX, originY) 为窗口原点取 W×H 地形，
 * 出生点放在窗口中心，四周写与所在网格块一致的连接 ID。
 */
function buildSpawnUnit(
  originX: number,
  originY: number,
  wp: { x: number; y: number },
  W: number,
  H: number,
  SX: number,
  SY: number,
  config: MapSplitConfig,
  tileByRxRy: Map<string, IsoTile>,
  overlayByIdx: Map<string, Overlay>,
  sourceIni: string,
  ids: { nw: number; se: number; ne: number; sw: number },
  coreW: number,
  coreH: number,
  fillTile: number,
): { content: string; partial: boolean } {
  // 选择能放下指示图块的最小菱形边长（与 buildSlice 一致，weight 固定 1）
  const neededCells: Array<[number, number]> = [
    [SX - 3, SY + W - 1],
    [SX + W + 2, SY + W - 1],
    [SY + W - 1, SX - 3],
    [SY + W - 1, SX + W + 2],
    [SX - 6, SY],
    [SX, SY],
    [SX + W - 1, SY + H - 1],
  ];
  let s = W + 3;
  for (; s < 300; s++) {
    if (neededCells.every(([rx, ry]) => cellValidInDiamond(rx, ry, s))) break;
  }
  if (s >= 300) {
    throw new Error(`无法为出生点 (${wp.x},${wp.y}) 找到合适的切片尺寸 s。`);
  }

  const sliceMap = new MapFile();
  sliceMap.MapTheater = config.theater;
  sliceMap.CreateEmptyMap(s, s);

  const localByIdx = new Map<string, IsoTile>();
  for (const t of sliceMap.IsoTileList) {
    localByIdx.set(`${t.Dx},${t.Dy}`, t);
  }
  const putTile = (
    rx: number,
    ry: number,
    tileNum: number,
    subTile: number,
    z: number,
  ): void => {
    const dx = rx - ry + s - 1;
    const dy = rx + ry - s - 1;
    const entry = localByIdx.get(`${dx},${dy}`);
    if (entry) {
      entry.Rx = rx;
      entry.Ry = ry;
      entry.TileNum = tileNum;
      entry.SubTile = subTile;
      entry.Z = z;
    }
  };

  // 窗口地形：中心 coreW×coreH 取原图，其余补清地（Tile0）凑满单元窗口
  const coreX0 = wp.x - originX - Math.floor((coreW - 1) / 2);
  const coreY0 = wp.y - originY - Math.floor((coreH - 1) / 2);
  let missing = 0;
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const inCore =
        x >= coreX0 && x < coreX0 + coreW && y >= coreY0 && y < coreY0 + coreH;
      if (!inCore) {
        putTile(SX + x, SY + y, fillTile, 0, 0);
        continue;
      }
      const absRX = originX + x;
      const absRY = originY + y;
      const tile = tileByRxRy.get(`${absRX},${absRY}`);
      if (!tile) {
        missing++;
        continue;
      }
      if (tile.TileNum === -1) missing++;
      putTile(SX + x, SY + y, tile.TileNum, tile.SubTile, tile.Z);
    }
  }
  const partial = missing > 0;

  // 连接 ID 指示图块（位置 + SubTile + Z 三通道编码）
  const nwEnc = encodeConnectionId(ids.nw);
  const seEnc = encodeConnectionId(ids.se);
  const neEnc = encodeConnectionId(ids.ne);
  const swEnc = encodeConnectionId(ids.sw);
  putTile(SX - 3, nwEnc.pos + SY, config.indicatorNum, nwEnc.subTile, nwEnc.z);
  putTile(SX + W + 2, seEnc.pos + SY, config.indicatorNum, seEnc.subTile, seEnc.z);
  putTile(neEnc.pos + SY, SX - 3, config.indicatorNum, neEnc.subTile, neEnc.z);
  putTile(swEnc.pos + SY, SX + W + 2, config.indicatorNum, swEnc.subTile, swEnc.z);
  putTile(SX - 6, SY, config.indicatorNum, 0, 0); // 权值固定 1

  // 覆盖物：只取核心窗口内的
  for (let x = coreX0; x < coreX0 + coreW; x++) {
    for (let y = coreY0; y < coreY0 + coreH; y++) {
      const absRX = originX + x;
      const absRY = originY + y;
      const ov = overlayByIdx.get(`${absRX},${absRY}`);
      if (!ov || !ov.Tile) continue;
      const lrx = SX + x;
      const lry = SY + y;
      const localTile = localByIdx.get(
        `${lrx - lry + s - 1},${lrx + lry - s - 1}`,
      );
      if (!localTile) continue;
      const newOv = new Overlay(ov.OverlayID, ov.OverlayValue);
      newOv.Tile = localTile;
      sliceMap.OverlayList.push(newOv);
    }
  }

  // 其它对象（单位/建筑/地形物件/污迹/飞机等）：只取核心窗口内的
  attachObjects(
    sliceMap,
    sourceIni,
    originX + coreX0,
    originY + coreY0,
    SX + coreX0,
    SY + coreY0,
    coreW,
    coreH,
  );

  // 只保留窗口中心这一个出生点，避免一个 spawn 单元带出多个起点
  sliceMap.Waypoint.clear();
  const localX = SX + (wp.x - originX);
  const localY = SY + (wp.y - originY);
  sliceMap.Waypoint.SetStringValue(
    '0',
    localY.toString() + localX.toString().padStart(3, '0'),
  );

  if (partial) {
    sliceMap.IsoTileList = sliceMap.IsoTileList.filter((t) => t.TileNum !== -1);
  }
  const content = sliceMap.SaveFullMap(undefined, { bottomSpace: 0 });
  const out = new IniFile(content);
  out.SetStringValue('Basic', 'IsMapUnit', 'yes');
  out.SetStringValue('Basic', 'MapUnitStartX', String(SX));
  out.SetStringValue('Basic', 'MapUnitStartY', String(SY));
  out.SetStringValue('Basic', 'MapUnitWidth', String(W));
  out.SetStringValue('Basic', 'MapUnitHeight', String(H));
  if (partial) {
    out.SetStringValue('Basic', 'PartialMapUnit', 'yes');
  }
  return { content: out.WriteIniFile(), partial };
}

// ---------------------------------------------------------------------------
// 单块切片构建
// ---------------------------------------------------------------------------

/**
 * 构建单元块 (i, j) 的切片 .map 内容。
 *
 * 单元块覆盖绝对坐标 [OX+iW, OX+(i+1)W) × [OY+jH, OY+(j+1)H)。
 */
function buildSlice(
  i: number,
  j: number,
  W: number,
  H: number,
  SX: number,
  SY: number,
  OX: number,
  OY: number,
  config: MapSplitConfig,
  tileByRxRy: Map<string, IsoTile>,
  overlayByIdx: Map<string, Overlay>,
  seamV: number[][],
  seamH: number[][],
  sourceIni: string,
  frameTemplate: Map<string, number> | null,
  partial: boolean,
): string {
  const blockRX0 = OX + i * W;
  const blockRY0 = OY + j * H;

  // 该块的四个连接 ID
  //   NW = 左缝 seamV[i]、SE = 右缝 seamV[i+1]
  //   NE = 上缝 seamH[j]、SW = 下缝 seamH[j+1]
  const nwId = seamV[i][j];
  const seId = seamV[i + 1][j];
  const neId = seamH[j][i];
  const swId = seamH[j + 1][i];

  // 权值：稳定地给切片一个非零 SelectionWeight（指示图块在 Rx<SX-5 处每颗 +1）
  const weight = 1 + (hashFnv1a(`w:${i},${j}:${nwId}:${seId}`) % 4);

  // 找出能容纳所有必要单元图块的最小菱形边长 s
  const neededCells: Array<[number, number]> = [];
  // 四周指示缝（覆盖连接 ID 的全范围 0..W-1）
  neededCells.push([SX - 3, SY + W - 1]); // NW：Ry ∈ [SY, SY+W-1]
  neededCells.push([SX + W + 2, SY + W - 1]); // SE：Ry ∈ [SY, SY+W-1]
  neededCells.push([SY + W - 1, SX - 3]); // NE：Rx ∈ [SY, SY+W-1]
  neededCells.push([SY + W - 1, SX + W + 2]); // SW：Rx ∈ [SY, SY+W-1]
  // 权值指示图块
  for (let w = 0; w < Math.max(1, weight); w++) {
    neededCells.push([SX - 6, SY + w]);
  }
  // 内部四角（切片本地坐标，即真实摆放位置）
  neededCells.push([SX, SY]);
  neededCells.push([SX + W - 1, SY + H - 1]);

  // 选择边长：从 W+3 起，找到第一个能放下所有必要单元的最小 s
  let s = W + 3;
  for (; s < 300; s++) {
    let ok = true;
    for (const [rx, ry] of neededCells) {
      if (!cellValidInDiamond(rx, ry, s)) {
        // cellValidInDiamond 使用的是"本地"换算；这里 rx/ry 已是切片本地坐标，
        // 因此直接校验即可（dx = rx-ry+s-1 等）。
        ok = false;
        break;
      }
    }
    if (ok) break;
  }
  if (s >= 300) {
    throw new Error(`无法为单元块 (${i},${j}) 找到合适的切片尺寸 s。`);
  }

  // 创建空的完整菱形地图，并建立 (dx,dy) -> 图块 索引
  const sliceMap = new MapFile();
  sliceMap.MapTheater = config.theater;
  sliceMap.CreateEmptyMap(s, s);

  const localByIdx = new Map<string, IsoTile>();
  for (const t of sliceMap.IsoTileList) {
    localByIdx.set(`${t.Dx},${t.Dy}`, t);
  }

  const putTile = (
    rx: number,
    ry: number,
    tileNum: number,
    subTile: number,
    z: number,
  ): void => {
    const dx = rx - ry + s - 1;
    const dy = rx + ry - s - 1;
    const key = `${dx},${dy}`;
    const entry = localByIdx.get(key);
    if (entry) {
      entry.Rx = rx;
      entry.Ry = ry;
      entry.TileNum = tileNum;
      entry.SubTile = subTile;
      entry.Z = z;
    }
  };

  // 4. 填充内部实际地形
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const absRX = blockRX0 + x;
      const absRY = blockRY0 + y;
      const tile = tileByRxRy.get(`${absRX},${absRY}`);
      if (!tile) continue; // 源地图此格无图块 → 保持空
      const lrx = absRX - blockRX0 + SX;
      const lry = absRY - blockRY0 + SY;
      putTile(lrx, lry, tile.TileNum, tile.SubTile, tile.Z);
    }
  }

  // 5. 摆放四周的指示图块（连接 ID 编码到 位置+SubTile+Z 三通道）
  const nwEnc = encodeConnectionId(nwId);
  const seEnc = encodeConnectionId(seId);
  const neEnc = encodeConnectionId(neId);
  const swEnc = encodeConnectionId(swId);
  //    NW： (Rx = SX-3, Ry = nw.pos + SY)
  putTile(SX - 3, nwEnc.pos + SY, config.indicatorNum, nwEnc.subTile, nwEnc.z);
  //    SE： (Rx = SX+W+2, Ry = se.pos + SY)
  putTile(SX + W + 2, seEnc.pos + SY, config.indicatorNum, seEnc.subTile, seEnc.z);
  //    NE： (Ry = SX-3, Rx = ne.pos + SY)
  putTile(neEnc.pos + SY, SX - 3, config.indicatorNum, neEnc.subTile, neEnc.z);
  //    SW： (Ry = SX+W+2, Rx = sw.pos + SY)
  putTile(swEnc.pos + SY, SX + W + 2, config.indicatorNum, swEnc.subTile, swEnc.z);
  //    权值指示图块（Rx < SX-5 计数 +1）
  for (let w = 0; w < Math.max(1, weight); w++) {
    putTile(SX - 6, SY + w, config.indicatorNum, 0, 0);
  }

  // 6. 收集覆盖物（把属于本块的覆盖物平移到本地坐标）
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const absRX = blockRX0 + x;
      const absRY = blockRY0 + y;
      const ov = overlayByIdx.get(`${absRX},${absRY}`);
      if (!ov || !ov.Tile) continue;
      const lrx = absRX - blockRX0 + SX;
      const lry = absRY - blockRY0 + SY;
      const localTile = localByIdx.get(`${lrx - lry + s - 1},${lrx + lry - s - 1}`);
      if (!localTile) continue;
      const newOv = new Overlay(ov.OverlayID, ov.OverlayValue);
      newOv.Tile = localTile;
      sliceMap.OverlayList.push(newOv);
    }
  }

  // 7. 平移对象（单位/步兵/建筑/地形/飞机/污迹/路径点）
  attachObjects(sliceMap, sourceIni, blockRX0, blockRY0, SX, SY, W, H);

  // 7b. 画窗外框（frame=true 时）：只填「仍是 -1」的窗口外格。
  //     指示图块已在上面写入（非 -1），天然不会被框覆盖；
  //     内容块（窗口内）一格都不碰 —— 块内的值参与单元模型，动了会变（见 verify-split）。
  if (frameTemplate) {
    for (const tile of sliceMap.IsoTileList) {
      if (tile.TileNum !== -1) continue;
      const dx = tile.Rx - SX;
      const dy = tile.Ry - SY;
      const inWindow = dx >= 0 && dx < W && dy >= 0 && dy < H;
      if (inWindow) continue;
      const frameTile = frameTemplate.get(`${dx},${dy}`);
      if (frameTile === undefined) continue;
      tile.TileNum = frameTile;
      tile.SubTile = 0;
      tile.Z = 0;
    }
  }

  // 8. 组装并返回 INI 文本
  // 边缘不完整切片只保留原版格子：不写 -1/缺失格，也不补平地。
  // 预览端据此裁到内容范围并用透明背景表示空缺。
  if (partial) {
    sliceMap.IsoTileList = sliceMap.IsoTileList.filter((t) => t.TileNum !== -1);
  }
  const content = sliceMap.SaveFullMap(undefined, { bottomSpace: 0 });
  const out = new IniFile(content);
  if (partial) {
    out.SetStringValue('Basic', 'IsMapUnit', 'yes');
    out.SetStringValue('Basic', 'PartialMapUnit', 'yes');
    out.SetStringValue('Basic', 'MapUnitStartX', String(SX));
    out.SetStringValue('Basic', 'MapUnitStartY', String(SY));
    out.SetStringValue('Basic', 'MapUnitWidth', String(W));
    out.SetStringValue('Basic', 'MapUnitHeight', String(H));
  }
  return out.WriteIniFile();
}

/**
 * 从 empty.map 提取「窗外框模板」：键 = (Rx-startingX, Ry-startingY)（相对窗口的
 * 有符号偏移），值 = TileNum。只收窗口外的格。
 *
 * 手工单元的框因 theater 而异（TEMPERATE 是 Tile293/294 公路圈 + Tile0 清地，
 * DESERT 是 Tile386 整圈填充，Islands 是 Tile418 水面），所以模板必须逐 theater
 * 从它自己的 empty.map 采集，不能硬编码图块号。
 */
function buildFrameTemplate(
  emptyMapContent: string,
  SX: number,
  SY: number,
  W: number,
  H: number,
): Map<string, number> {
  const empty = new MapFile();
  empty.CreateIsoTileList(emptyMapContent);
  const tpl = new Map<string, number>();
  for (const t of empty.IsoTileList) {
    if (t.TileNum === -1) continue;
    const dx = t.Rx - SX;
    const dy = t.Ry - SY;
    if (dx >= 0 && dx < W && dy >= 0 && dy < H) continue; // 窗口内的不是框
    tpl.set(`${dx},${dy}`, t.TileNum);
  }
  return tpl;
}

// ---------------------------------------------------------------------------
// 对象平移
// ---------------------------------------------------------------------------

/**
 * 把源地图中属于单元块 (blockRX0, blockRY0) 的对象，改写坐标到切片本地
 * （本地 = 绝对坐标 - 块原点 + 顶角）。
 *
 * 对象坐标字段位置（按 RA2 地图 [Units]/[Structures] 等段的逗号格式）：
 *   Unit/Structure/Aircraft/Infantry: 第 4/5 位（0 基下标 3/4）是 X/Y
 *   Smudge: 第 2/3 位（下标 1/2）是 X/Y
 *   Terrain / Waypoint: 键/值里的 XXX 序号
 */
function attachObjects(
  sliceMap: MapFile,
  sourceIni: string,
  blockRX0: number,
  blockRY0: number,
  SX: number,
  SY: number,
  W: number,
  H: number,
): void {
  const file = new IniFile(sourceIni);

  /** section 名 -> MapFile 对应属性（SaveFullMap 依赖这些属性） */
  const sectionTarget = (
    src: string,
  ): 'Unit' | 'Infantry' | 'Structure' | 'Terrain' | 'Aircraft' | 'Smudge' | 'Waypoint' => {
    switch (src) {
      case 'Units':
        return 'Unit';
      case 'Infantry':
        return 'Infantry';
      case 'Structures':
        return 'Structure';
      case 'Terrain':
        return 'Terrain';
      case 'Aircraft':
        return 'Aircraft';
      case 'Smudge':
        return 'Smudge';
      case 'Waypoints':
        return 'Waypoint';
      default:
        return 'Unit';
    }
  };

  /** 判断对象本地坐标是否落在单元块内 */
  const inBlock = (lx: number, ly: number): boolean =>
    lx >= 0 && lx < W && ly >= 0 && ly < H;

  // 通用：把逗号序列里的 X/Y 字段重映射到本地
  const remapIndex = (section: string, xi: number, yi: number): void => {
    const sec = file.GetSection(section);
    if (!sec) return;
    const target = sliceMap[sectionTarget(section)];
    for (const key of sec.Keys) {
      const raw = sec.GetStringValue(key, '');
      const parts = raw.split(',');
      if (parts.length <= Math.max(xi, yi)) continue;
      const absX = parseInt(parts[xi], 10);
      const absY = parseInt(parts[yi], 10);
      if (isNaN(absX) || isNaN(absY)) continue;
      const lx = absX - blockRX0;
      const ly = absY - blockRY0;
      if (!inBlock(lx, ly)) continue; // 不在此块范围内
      parts[xi] = (lx + SX).toString();
      parts[yi] = (ly + SY).toString();
      target.SetStringValue(key, parts.join(','));
    }
  };

  remapIndex('Units', 3, 4);
  remapIndex('Infantry', 3, 4);
  remapIndex('Structures', 3, 4);
  remapIndex('Aircraft', 3, 4);
  remapIndex('Smudge', 1, 2);

  // Terrain：键为 "YYYYXXX"（Y 不定长 + X 三位），值为规则名
  const terrain = file.GetSection('Terrain');
  if (terrain) {
    const target = sliceMap.Terrain;
    for (const key of terrain.Keys) {
      const value = terrain.GetStringValue(key, '');
      const x = parseInt(key.slice(-3), 10);
      const y = parseInt(key.slice(0, key.length - 3), 10);
      if (isNaN(x) || isNaN(y)) continue;
      const lx = x - blockRX0;
      const ly = y - blockRY0;
      if (!inBlock(lx, ly)) continue;
      const newKey =
        (ly + SY).toString() + (lx + SX).toString().padStart(3, '0');
      target.SetStringValue(newKey, value);
    }
  }

  // Waypoints：键为编号，值为 "YYYYXXX"
  const waypoints = file.GetSection('Waypoints');
  if (waypoints) {
    const target = sliceMap.Waypoint;
    for (const key of waypoints.Keys) {
      const value = waypoints.GetStringValue(key, '');
      const x = parseInt(value.slice(-3), 10);
      const y = parseInt(value.slice(0, value.length - 3), 10);
      if (isNaN(x) || isNaN(y)) continue;
      const lx = x - blockRX0;
      const ly = y - blockRY0;
      if (!inBlock(lx, ly)) continue;
      const newValue =
        (ly + SY).toString() + (lx + SX).toString().padStart(3, '0');
      target.SetStringValue(key, newValue);
    }
  }

  // 覆盖物已在 buildSlice 阶段处理
}

export default splitMap;