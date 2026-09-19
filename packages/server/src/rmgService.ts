/**
 * RMG 服务 —— 把 `@ra2/core` 的 gamemd 精确管线（`packages/core/src/rmg/**`）暴露成 HTTP 能力。
 *
 * 本模块**只做编排**，不重新实现任何数值逻辑：
 *   选项 / clamp / 尺寸推导 → core 的 `options.ts`
 *   `.SED` 种子文件读写     → core 的 `sed.ts`
 *   `RMGMD.INI` 读取        → core 的 `rmgmd.ts`
 *   cell 网格 + emit        → core 的 `cell.ts` / `emit.ts`
 *
 * ⚠ 决定「现在能产出什么」的硬事实：
 *   20 个阶段里**只有 0/1/2 已实现**（播种 RNG、map-prep、读 RMGMD.INI）；
 *   地形阶段 3–19（水体 → 区域 → 台地 → 桥 → 绿地 → 起点 → 矿场 → 山丘 → LAT → 雷达）尚未落地。
 *   因此 `generateRmgMap()` 现在产出的是 **S1（map-prep）骨架**：尺寸 / theater / cell 初态正确，
 *   但地块还没有被地形阶段赋值。它既不是「看起来像 YR 随机图」的假图，也不是完整 RMG 图，
 *   而是真实管线跑到当前实现边界为止的产物。阶段状态由 `RMG_STAGES` 如实返回给前端展示。
 *
 * 与 `generator.ts`（预置地块拼装、`Math.random()`）是**两套并列范式**，不要合并。
 */

import {
  CLAMP_RULES,
  defaultOptions,
  clampOptions,
  deriveDimensions,
  DerivedDimensions,
  loadSed,
  saveSed,
  loadRmgmd,
  RmgSettings,
  defaultRmgSettings,
  RmgGrid,
  RmgOptions,
  emitMapFile,
  rmgTheaterToEnum,
  MapFile,
} from '@ra2/core';

// ---------------------------------------------------------------------------
// 阶段清单（转写自 core/src/rmg/README.md 的阶段表）
// ---------------------------------------------------------------------------

/** 单个 RMG 阶段的实现状态 */
export interface RmgStageStatus {
  /** 编号即原生执行顺序（入口 0x00598960） */
  id: number;
  name: string;
  /** 原生地址 */
  native: string;
  /** 对 `g_MapGenRng` 的抽数（属契约的一部分） */
  draws: string;
  /** 运行时专属（无地图产出），不移植 */
  runtimeOnly?: boolean;
  implemented: boolean;
}

/** 管线阶段表。`implemented` 是唯一真相，前端不得自行推断。 */
export const RMG_STAGES: readonly RmgStageStatus[] = [
  { id: 0, name: '播种 RNG', native: '0x0065C6D0', draws: '0', implemented: true },
  {
    id: 1,
    name: 'map-prep：尺寸 / INI / 光照 / 暂存分配 / waypoint700',
    native: '0x00599650',
    draws: '1（河桥位 rand<0.25）',
    implemented: true,
  },
  { id: 2, name: '读 RMGMD.INI', native: '0x005981F0', draws: '0', implemented: true },
  {
    id: 3,
    name: '水体（3/4 型 → 0x0059C580；否则 0x0059A6C0）',
    native: '0x0059A6C0 / 0x0059C580',
    draws: '多',
    implemented: true,
  },
  { id: 4, name: '水体终结器', native: '0x0059C630', draws: '每底水格 1~2', implemented: true },
  { id: 5, name: '区域划分（洪泛）', native: '0x0058CF90 + 0x0058C800', draws: '1', implemented: true },
  {
    id: 6,
    name: '区域 BFS / 层级',
    native: '0x0058E740 / 0x0058E9B0 / 0x0058D010',
    draws: '0',
    implemented: true,
  },
  {
    id: 7,
    name: '仅 3/4：台地阈值 + 分裂',
    native: '0x0058EBC0 / 0x0058D620',
    draws: '6 类站点',
    implemented: false,
  },
  {
    id: 8,
    name: '仅 3/4：桥 / 连接 pass',
    native: '0x0058EF10 / 0x0058F0C0 / 0x005905D0',
    draws: '15 站点',
    implemented: false,
  },
  { id: 9, name: '仅 3/4：悬崖落差', native: '0x005A19E0', draws: '0/1', implemented: false, runtimeOnly: true },
  {
    id: 10,
    name: '仅 3/4：桥坡 / 水砖再锚定',
    native: '0x00578E60 / 0x005A17F0',
    draws: '0',
    implemented: false,
  },
  { id: 11, name: '绿地扩散', native: '0x0059B740', draws: '每步 1', implemented: true },
  { id: 12, name: '细胞属性重算', native: '0x47D2B0（迭代器 0x578350/0x578290）', draws: '0', implemented: true },
  {
    id: 13,
    name: '起始点（循环至成功）',
    native: '0x00594B50 + 0x005A1FB0',
    draws: '2/候选',
    implemented: true,
  },
  { id: 14, name: '中立科技建筑（MapType≠0）', native: '0x005A95B0', draws: '少量', implemented: true },
  { id: 15, name: '矿场', native: '0x005A23A0', draws: '每入队邻 1', implemented: true },
  {
    id: 16,
    name: '山丘（x87 密集）',
    native: '0x005A35F0 + 角点引擎',
    draws: '每格 2 次高斯',
    implemented: true,
  },
  {
    id: 17,
    name: 'LAT / 树 / 石（Theater==0 完整；否则只填概率）',
    native: '0x005A38C0 / 0x005A3AE0 / 0x005A4280',
    draws: '多',
    implemented: true,
  },
  { id: 18, name: '矿场生长 / 扩散队列', native: '0x00722D00 / 0x00722240', draws: '0', implemented: false, runtimeOnly: true },
  { id: 19, name: '雷达界 + 表面重建', native: '0x00654490 / 0x00654650', draws: '0', implemented: false, runtimeOnly: true },
];

/** 地形阶段（3–19）是否已实现。`generateRmgMap` 用它决定是否给出「完整图」 */
export const TERRAIN_STAGES_IMPLEMENTED: boolean = RMG_STAGES
  .filter((s) => s.id >= 3)
  .every((s) => s.implemented);

// ---------------------------------------------------------------------------
// 选项元数据（供前端渲染表单）
// ---------------------------------------------------------------------------

export type RmgOptionKey = keyof RmgOptions;

interface FieldSpec {
  key: RmgOptionKey;
  label: string;
  hint: string;
  kind: 'range' | 'select';
  choices?: ReadonlyArray<{ value: number; label: string }>;
}

const THEATER_CHOICES = [
  { value: 0, label: '温带 TEMPERATE' },
  { value: 1, label: '雪地 SNOW' },
  { value: 2, label: '城市 URBAN' },
  { value: 3, label: '沙漠 DESERT' },
  { value: 4, label: '新城市 NEWURBAN' },
] as const;

const MAP_TYPE_CHOICES = [
  { value: 0, label: '群岛 Archipelago' },
  { value: 1, label: '大陆 Continent' },
  { value: 2, label: '团队大陆 Team Continent' },
  { value: 3, label: '内陆 Inland' },
  { value: 4, label: '多山 Mountainous' },
] as const;

const TIME_CHOICES = [
  { value: 0, label: '晨 Morning' },
  { value: 1, label: '昼 Day' },
  { value: 2, label: '昏 Dusk' },
  { value: 3, label: '夜 Night' },
] as const;

const RESOURCE_CHOICES = [
  { value: 0, label: '档 0' },
  { value: 1, label: '档 1' },
  { value: 2, label: '档 2' },
  { value: 3, label: '档 3' },
] as const;

const SIZE_CHOICES = [
  { value: 0, label: '档 0（最小）' },
  { value: 1, label: '档 1' },
  { value: 2, label: '档 2' },
  { value: 3, label: '档 3（最大）' },
] as const;

/**
 * 字段顺序 = `MapSeedClass` 内存偏移顺序，前端直接照序渲染。
 * min/max 一律从 core 的 `CLAMP_RULES` 取，避免与本尊漂移。
 * `theater` 不在 clamp 表里 —— 原生 `ClampFields 0x005975E0` 从不 clamp 它。
 */
const FIELD_SPECS: readonly FieldSpec[] = [
  {
    key: 'theater',
    label: 'Theater 地形',
    hint: 'RMG 的 Theater 序与引擎 Theater 枚举不同；原生不 clamp 此字段',
    kind: 'select',
    choices: THEATER_CHOICES,
  },
  { key: 'mapType', label: 'MapType 地图类型', hint: '决定水体/植被等派生区间', kind: 'select', choices: MAP_TYPE_CHOICES },
  { key: 'resources', label: 'Resources 资源档', hint: '档位 0..3，不是百分比', kind: 'select', choices: RESOURCE_CHOICES },
  { key: 'ruggedness', label: 'Ruggedness 崎岖度 %', hint: '0..100', kind: 'range' },
  { key: 'time', label: 'Time 时段', hint: '影响 levelLight 与光照', kind: 'select', choices: TIME_CHOICES },
  { key: 'waterAmount', label: 'WaterAmount 水量 %', hint: '面板上无控件，由派生逻辑写入', kind: 'range' },
  { key: 'numPlayers', label: 'NumPlayers 玩家数', hint: '2..8，同时是尺寸表索引 n = NumPlayers − 2', kind: 'range' },
  { key: 'tiberium', label: 'Tiberium 矿量 %', hint: '下限是 1（不是 0）', kind: 'range' },
  { key: 'tiberiumLayout', label: 'TiberiumLayout 矿形 %', hint: '0..100', kind: 'range' },
  { key: 'vegetation', label: 'Vegetation 植被 %', hint: '0..100', kind: 'range' },
  { key: 'urbanPresence', label: 'UrbanPresence 城市密度 %', hint: '零售版无消费者', kind: 'range' },
  { key: 'width', label: 'Width 档', hint: '档位 0..3，sW = 档 × 0.33333334f', kind: 'select', choices: SIZE_CHOICES },
  { key: 'height', label: 'Height 档', hint: '档位 0..3，sH = 档 × 0.33333334f', kind: 'select', choices: SIZE_CHOICES },
  { key: 'accessibility', label: 'Accessibility 连通性 %', hint: '0..100', kind: 'range' },
  { key: 'regionSize', label: 'RegionSize 区域大小 %', hint: '0..100', kind: 'range' },
  { key: 'seed', label: 'Seed 种子', hint: '0..0xFFFF；构造默认 −1 表示未设', kind: 'range' },
];

/** 前端渲染表单所需的字段元数据 */
export interface RmgFieldMeta {
  key: string;
  label: string;
  hint: string;
  kind: 'range' | 'select';
  min: number;
  max: number;
  /** 是否在原生 `ClampFields` 表内（theater = false） */
  clamped: boolean;
  choices: ReadonlyArray<{ value: number; label: string }> | null;
}

function choicesRange(choices: ReadonlyArray<{ value: number; label: string }>): [number, number] {
  const values = choices.map((c) => c.value);
  return [Math.min(...values), Math.max(...values)];
}

export function getRmgFieldMeta(): RmgFieldMeta[] {
  return FIELD_SPECS.map((spec) => {
    const rule = CLAMP_RULES.find((r) => r.key === spec.key);
    const [lo, hi] = spec.choices ? choicesRange(spec.choices) : [0, 0];
    return {
      key: spec.key as string,
      label: spec.label,
      hint: spec.hint,
      kind: spec.kind,
      min: rule ? rule.min : lo,
      max: rule ? rule.max : hi,
      clamped: rule !== undefined,
      choices: spec.choices ?? null,
    };
  });
}

/** `GET /api/rmg/meta` 的响应体 */
export interface RmgMeta {
  fields: RmgFieldMeta[];
  defaults: RmgOptions;
  /** `RMGMD.INI` 缺省（无文件时的构造器值） */
  rmgmdDefaults: RmgSettings;
  stages: readonly RmgStageStatus[];
  terrainStagesImplemented: boolean;
  /** 运行期注入的 RMGMD（来自 core 的 loadRmgmd，此处是缺省，仅作对照） */
  notes: string[];
}

export function getRmgMeta(): RmgMeta {
  return {
    fields: getRmgFieldMeta(),
    defaults: defaultOptions(),
    rmgmdDefaults: defaultRmgSettings(),
    stages: RMG_STAGES,
    terrainStagesImplemented: TERRAIN_STAGES_IMPLEMENTED,
    notes: [
      '选项 / clamp / 尺寸推导来自 core/src/rmg/options.ts（对齐 ClampFields 0x005975E0 与 map-prep 0x00599650）。',
      'Theater 不在 ClampFields 表内，原生从不 clamp 它。',
      '尺寸推导走 53 位 + 向零截断的 x87 契约（chopMul/ ftol），不是普通 f64。',
      `地形阶段 ${TERRAIN_STAGES_IMPLEMENTED ? '已实现' : '（3–19）尚未实现'}，生成产出为 S1（map-prep）骨架。`,
    ],
  };
}

// ---------------------------------------------------------------------------
// 选项清洗 / clamp / 派生
// ---------------------------------------------------------------------------

const NUMERIC_KEYS = FIELD_SPECS.map((s) => s.key as string);

/**
 * 把外部输入收敛成合法的 `RmgOptions`。
 * 只接受数值字段；非数/缺失一律回落到构造器默认值。
 */
export function sanitizeOptions(input: unknown): RmgOptions {
  const out = defaultOptions();
  if (!input || typeof input !== 'object') return out;
  const src = input as Record<string, unknown>;

  for (const key of NUMERIC_KEYS) {
    const raw = src[key];
    if (raw === undefined || raw === null || raw === '') continue;
    const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
    if (!Number.isFinite(n)) continue;
    (out as unknown as Record<string, number>)[key] = n;
  }

  if (typeof src.description === 'string') {
    out.description = src.description;
  }
  return out;
}

/** clamp 后的选项 + 派生几何 */
export interface RmgDerivedResult {
  /** clamp 之后的选项（等价原生 0x005975E0） */
  options: RmgOptions;
  /** 尺寸推导结果（genW/genH/mapW/mapH/LocalSize/菱形界/格数…） */
  derived: DerivedDimensions;
}

export function deriveRmgOptions(input: unknown, doClamp = true): RmgDerivedResult {
  const options = sanitizeOptions(input);
  if (doClamp) clampOptions(options);
  return { options, derived: deriveDimensions(options) };
}

// ---------------------------------------------------------------------------
// `.SED` 读写
// ---------------------------------------------------------------------------

/** `.SED` 读取结果（carry-default；原生 reader 不调用 ClampFields，故此处也不 clamp） */
export interface RmgSedReadResult extends RmgDerivedResult {
  /** 是否真的读到了 `[RandomMap]` 段 */
  sectionFound: boolean;
  /** 未能识别的键名（供前端提示） */
  ignoredKeys: string[];
}

/** `.SED` 里 `[RandomMap]` 段读到的键名集合 */
const SED_NUMERIC_KEYS = [
  'Width',
  'Height',
  'NumPlayers',
  'Seed',
  'MapType',
  'Theater',
  'Time',
  'RegionSize',
  'Ruggedness',
  'Accessibility',
  'WaterAmount',
  'Tiberium',
  'TiberiumLayout',
  'Vegetation',
  'UrbanPresence',
  'Resources',
] as const;

/**
 * 读 `.SED` 还原选项。
 *
 * 语义与 core 的 `loadSed` 一致：**carry-default** —— 缺失/读失败的键保留当前字段值。
 * 原生 reader 不调用 ClampFields，这里同样不 clamp；派生尺寸按原值算，如实反映文件内容。
 */
export function readSedOptions(content: string, base?: unknown): RmgSedReadResult {
  const current = base === undefined ? undefined : sanitizeOptions(base);
  const options = loadSed(content ?? '', current);

  // 键名统计仅用于提示，不影响解析结果
  const ignoredKeys: string[] = [];
  const known = new Set<string>([...SED_NUMERIC_KEYS, 'Description']);
  const section = /\[RandomMap\]([\s\S]*?)(?=\n\s*\[|$)/i.exec(content ?? '');
  if (section) {
    for (const line of section[1].split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][\w]*)\s*=/.exec(line);
      if (m && !known.has(m[1])) ignoredKeys.push(m[1]);
    }
  }

  return {
    options,
    derived: deriveDimensions(options),
    sectionFound: /\[RandomMap\]/i.test(content ?? ''),
    ignoredKeys,
  };
}

/** 写出 `.SED` 文本（键序与原生 writer 0x00597760 一致） */
export function writeSedOptions(input: unknown): { content: string; options: RmgOptions } {
  const options = sanitizeOptions(input);
  return { content: saveSed(options), options };
}

// ---------------------------------------------------------------------------
// 生成（当前实现边界：阶段 0–2 → S1 骨架）
// ---------------------------------------------------------------------------

/** 地块填充模式 */
export type RmgFillMode = 'unassigned' | 'clear';

export interface RmgGenerateInput {
  options?: unknown;
  /** `unassigned`：保持管线初态（TileNum = −1）；`clear`：填 0（清地），便于目视检查尺寸 */
  fill?: RmgFillMode;
  /** 地图名（写入 `[Basic] Name`） */
  name?: string;
  /** 是否注入预览缩略图，默认 true */
  withPreview?: boolean;
}

export interface RmgGenerateResult {
  fileName: string;
  mapContent: string;
  options: RmgOptions;
  derived: DerivedDimensions;
  stages: readonly RmgStageStatus[];
  terrainStagesImplemented: boolean;
  /** 产出等级说明，前端必须原样展示 */
  outputLevel: string;
  /** 明确列出这一版产出**缺**什么 */
  missing: string[];
  /** 本次实际用到的参数 */
  applied: {
    fill: RmgFillMode;
    bottomSpace: number;
    withPreview: boolean;
    bounds: { arraySize: number; packCells: number };
  };
  /** 阶段 2 读到的 RMGMD.INI 设置（本仓不带零售 MIX，故为构造器缺省） */
  rmgmd: RmgSettings;
}

/** RMG 出图不消费 theater 的 BottomSpace（那是预置拼装范式的概念），固定 0 */
const RMG_BOTTOM_SPACE = 0;

/**
 * 跑管线并产出地图文本。
 *
 * 现在只能跑到 S1：clamp → 派生尺寸 → 建 `RmgGrid` 初态 → emit → `SaveFullMap`。
 * 地形阶段（3–19）未实现，所以地块没有水/区域/山丘/矿场分布 —— 详见 `outputLevel` 与 `missing`。
 */
export function generateRmgMap(input: RmgGenerateInput): RmgGenerateResult {
  const { options, derived } = deriveRmgOptions(input.options, true);
  const fill: RmgFillMode = input.fill === 'clear' ? 'clear' : 'unassigned';

  // 阶段 1 的产物：map-prep 后的 cell 初态（level = 4，overlay = −1，shoreEnabled = 1…）
  const grid = RmgGrid.fromDerived(derived);
  grid.resetToPrepState();

  if (fill === 'clear') {
    for (const [rx, ry] of grid.nativeCells()) {
      const cell = grid.get(rx, ry);
      if (cell) cell.tile = 0;
    }
  }

  // 阶段 2 的产物：RMGMD.INI 缺省（本仓不带零售 MIX，故走构造器缺省）
  const rmgmd = loadRmgmd(null);

  const mapFile = emitMapFile(grid, rmgTheaterToEnum(options.theater));
  let ini = mapFile.SaveFullMap(undefined, { bottomSpace: RMG_BOTTOM_SPACE });

  const withPreview = input.withPreview !== false;
  if (withPreview) {
    const preview = MapFile.RenderPreview(
      mapFile.IsoTileList,
      mapFile.Width,
      mapFile.Height,
      RMG_BOTTOM_SPACE,
    );
    ini = mapFile.InjectThumb(preview, ini);
  }

  const mapName = (input.name ?? '').trim() || 'RMG Skeleton';
  ini = mapFile.ChangeName(ini, mapName);
  ini = mapFile.ChangeDigest(ini);

  const fileName = `${mapName}.yrm`;

  return {
    fileName,
    mapContent: ini,
    options,
    derived,
    stages: RMG_STAGES,
    terrainStagesImplemented: TERRAIN_STAGES_IMPLEMENTED,
    outputLevel: TERRAIN_STAGES_IMPLEMENTED
      ? '完整 RMG 产出'
      : 'S1（map-prep）骨架 —— 尺寸 / Theater / cell 初态正确，地块尚未由地形阶段赋值',
    missing: TERRAIN_STAGES_IMPLEMENTED
      ? []
      : RMG_STAGES.filter((s) => !s.implemented).map((s) => `stage ${s.id} ${s.name}`),
    applied: {
      fill,
      bottomSpace: RMG_BOTTOM_SPACE,
      withPreview,
      bounds: {
        arraySize: grid.arraySize,
        packCells: grid.countPackCells(),
      },
    },
    rmgmd,
  };
}
