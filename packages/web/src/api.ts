/**
 * 前端 API 封装
 *
 * 后端接口一览（见 packages/server/src/index.ts）：
 *   GET  /api/theaters            可用 theater 列表
 *   POST /api/generate            随机地图生成（预置地块拼装范式）
 *   POST /api/split               完整地图 → 若干 .map 切片
 *   GET  /api/rmg/meta            RMG 选项元数据 / 默认值 / 阶段状态
 *   POST /api/rmg/derive          RMG clamp + 尺寸推导
 *   POST /api/rmg/sed/read        读 .SED 还原 RMG 选项
 *   POST /api/rmg/sed/write       RMG 选项写出 .SED
 *   POST /api/rmg/generate        跑 RMG 管线产出地图
 */

// ============== 通用 ==============

async function readErrorText(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return '';
    // 后端错误统一是 { error: "..." }
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed && typeof parsed.error === 'string') return parsed.error;
    } catch {
      /* 非 JSON，原样返回 */
    }
    return text;
  } catch {
    return '';
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await readErrorText(res);
    throw new Error(detail ? `${detail} (HTTP ${res.status})` : `请求失败 (HTTP ${res.status})`);
  }
  return (await res.json()) as T;
}

/** 触发浏览器下载一段文本 */
export function downloadText(filename: string, content: string, mime = 'application/octet-stream'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============== 预览 ==============

/** 地图雷达预览：rgb 是 base64 的 RGB 字节（width × height × 3） */
export interface MapPreviewData {
  width: number;
  height: number;
  rgb: string;
}

/** 批量渲染雷达预览（minimap.ini 配色 + 覆盖物/地形/建筑 + 高度明暗） */
export function fetchMapPreviews(contents: string[]): Promise<MapPreviewData[]> {
  return postJson<{ items: MapPreviewData[] }>('/api/preview', { contents }).then(
    (r) => r.items,
  );
}

/** 把预览画到 canvas（RGB → RGBA ImageData） */
export function paintPreview(
  canvas: HTMLCanvasElement,
  preview: MapPreviewData,
): void {
  canvas.width = preview.width;
  canvas.height = preview.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const bin = atob(preview.rgb);
  const img = ctx.createImageData(preview.width, preview.height);
  const n = Math.min(bin.length / 3, preview.width * preview.height);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    img.data[j] = bin.charCodeAt(i * 3);
    img.data[j + 1] = bin.charCodeAt(i * 3 + 1);
    img.data[j + 2] = bin.charCodeAt(i * 3 + 2);
    img.data[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// ============== theater ==============

export interface TheaterInfo {
  name: string;
  theater: string;
  mapUnitSize: string;
  topCorner: string;
  bottomSpace: number;
  hasLighting: boolean;
  hasAdditionIni: boolean;
  hasCannotPlaceSmudge: boolean;
  mapUnitCount: number;
}

export async function fetchTheaters(): Promise<TheaterInfo[]> {
  const res = await fetch('/api/theaters');
  if (!res.ok) throw new Error(`获取地图类型失败: ${res.status}`);
  const data = (await res.json()) as { theaters?: TheaterInfo[] };
  return data.theaters ?? [];
}

// ============== 切片 ==============

export interface MapSplitSlice {
  name: string;
  gridX: number;
  gridY: number;
  content: string;
}

/** 地图 theater 识别结果（`POST /api/split/detect`） */
export interface TheaterDetection {
  /** 地图里读到的引擎 theater 名（如 TEMPERATE）；没读到为 null */
  engineTheater: string | null;
  /** 解析到的本地 theater 目录；null = 本仓库没有对应目录 */
  dir: string | null;
  /** 命中的全部候选目录（>1 表示撞名） */
  candidates: string[];
  /** 是否撞名：同一引擎 theater 名对应多个本地目录 */
  ambiguous: boolean;
  /** dir 是否来自「目录名与引擎名精确相等」 */
  exactNameMatch: boolean;
  /** 命中目录的地图单元尺寸 */
  mapUnitSize: string | null;
  /** 本仓库全部可用目录 */
  available: string[];
  /** 内容里是否有 [Map] 段 */
  hasMapSection: boolean;
}

export interface SplitResult {
  /** 生效 theater 的引擎名 */
  theater: string;
  /** 实际使用的资源目录 */
  theaterDir: string;
  detectedTheater: string | null;
  detectedTheaterDir: string | null;
  theaterSource: 'auto' | 'manual';
  /** 是否画了窗外框（沿用 empty.map 的手工单元框，仅编辑器可见） */
  frame: boolean;
  detection: Omit<TheaterDetection, 'engineTheater' | 'dir' | 'mapUnitSize'>;
  warnings: string[];
  unitSize: string;
  count: number;
  slices: MapSplitSlice[];
}

/** 只识别地图类型，不拆解 */
export function detectSplitTheater(mapContent: string): Promise<TheaterDetection> {
  return postJson<TheaterDetection>('/api/split/detect', { mapContent });
}

export function splitMap(payload: {
  mapContent: string;
  /** 默认 true：按地图自身的 [Map] Theater 切 */
  autoTheater?: boolean;
  /** autoTheater=false 时必填 */
  theaterType?: string;
  skipEmpty?: boolean;
  /** 默认 true：给切片画窗外框（对生成器纯视觉，编辑器里不再一片空白） */
  frame?: boolean;
}): Promise<SplitResult> {
  return postJson<SplitResult>('/api/split', payload);
}

// ============== RMG ==============

/** RMG 的 16 个整数选项（顺序即 MapSeedClass 内存偏移顺序） */
export interface RmgOptions {
  theater: number;
  mapType: number;
  resources: number;
  ruggedness: number;
  time: number;
  waterAmount: number;
  numPlayers: number;
  tiberium: number;
  tiberiumLayout: number;
  vegetation: number;
  urbanPresence: number;
  width: number;
  height: number;
  accessibility: number;
  regionSize: number;
  seed: number;
  description?: string;
}

export type RmgOptionsPatch = Partial<RmgOptions>;

export interface RmgChoice {
  value: number;
  label: string;
}

export interface RmgFieldMeta {
  key: keyof RmgOptions & string;
  label: string;
  hint: string;
  kind: 'range' | 'select';
  min: number;
  max: number;
  clamped: boolean;
  choices: RmgChoice[] | null;
}

export interface RmgStageStatus {
  id: number;
  name: string;
  native: string;
  draws: string;
  implemented: boolean;
}

export interface RmgRmgmdSettings {
  minTiberium: number;
  maxTiberium: number;
  maxTrees: number;
  levelLight: number[];
  vegetationMin: number[];
  vegetationMax: number[];
  temperateAmbientLight: number[];
  snowAmbientLight: number[];
  [key: string]: unknown;
}

export interface RmgMeta {
  fields: RmgFieldMeta[];
  defaults: RmgOptions;
  rmgmdDefaults: RmgRmgmdSettings;
  stages: RmgStageStatus[];
  terrainStagesImplemented: boolean;
  notes: string[];
}

export interface DerivedDimensions {
  genW: number;
  genH: number;
  mapW: number;
  mapH: number;
  localSize: [number, number, number, number];
  diamondMin: number;
  diamondMax: number;
  linearMapWidth: number;
  cells: number;
  rawScaleW: number;
  rawScaleH: number;
}

export interface RmgDeriveResult {
  options: RmgOptions;
  derived: DerivedDimensions;
}

export interface RmgSedReadResult extends RmgDeriveResult {
  sectionFound: boolean;
  ignoredKeys: string[];
}

export interface RmgGenerateResult extends RmgDeriveResult {
  fileName: string;
  mapContent: string;
  stages: RmgStageStatus[];
  terrainStagesImplemented: boolean;
  outputLevel: string;
  missing: string[];
  applied: {
    fill: 'unassigned' | 'clear';
    bottomSpace: number;
    withPreview: boolean;
    bounds: { arraySize: number; packCells: number };
  };
  rmgmd: RmgRmgmdSettings;
  /** 完整管线附加（mode:'full' 时返回） */
  width?: number;
  height?: number;
  stats?: { waypoints: number; ores: number; terrain: number; structures: number };
  elapsedMs?: number;
}

export async function fetchRmgMeta(): Promise<RmgMeta> {
  const res = await fetch('/api/rmg/meta');
  if (!res.ok) throw new Error(`获取 RMG 元数据失败: ${res.status}`);
  return (await res.json()) as RmgMeta;
}

export function deriveRmg(options: RmgOptionsPatch, clamp = true): Promise<RmgDeriveResult> {
  return postJson<RmgDeriveResult>('/api/rmg/derive', { options, clamp });
}

export function readSed(content: string, base?: RmgOptionsPatch): Promise<RmgSedReadResult> {
  return postJson<RmgSedReadResult>('/api/rmg/sed/read', { content, base });
}

export function writeSed(options: RmgOptionsPatch): Promise<{ content: string; options: RmgOptions }> {
  return postJson<{ content: string; options: RmgOptions }>('/api/rmg/sed/write', { options });
}

export function generateRmg(payload: {
  options: RmgOptionsPatch;
  fill: 'unassigned' | 'clear';
  name: string;
  withPreview?: boolean;
  /** full = gamemd 精确管线（默认）；skeleton = 旧 S1 骨架 */
  mode?: 'full' | 'skeleton';
}): Promise<RmgGenerateResult> {
  return postJson<RmgGenerateResult>('/api/rmg/generate', { mode: 'full', ...payload });
}
