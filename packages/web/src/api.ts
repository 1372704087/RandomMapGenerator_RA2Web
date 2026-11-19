/**
 * 前端 API 封装
 *
 * 后端接口一览（见 packages/server/src/index.ts）：
 *   GET  /api/theaters            可用 theater 列表
 *   POST /api/generate            随机地图生成（预置地块拼装范式）
 *   POST /api/split               完整地图 → 若干 .map 切片
 *   POST /api/rmg/cxx/generate    一个种子 → 完整随机地图（vera20k 对齐的 cxx 管线）
 *   POST /api/cncmaps-preview     地图文本 → cncmaps 全分辨率预览 PNG
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

/** 触发浏览器下载一个 Blob */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 触发浏览器下载一段文本 */
export function downloadText(filename: string, content: string, mime = 'application/octet-stream'): void {
  downloadBlob(filename, new Blob([content], { type: mime }));
}

// ============== 预览 ==============

/** 地图雷达预览：rgb 是 base64 的 RGB 字节（width × height × 3） */
export interface MapPreviewData {
  width: number;
  height: number;
  rgb: string;
  /** 可选 alpha（0/255，base64）；裁剪预览用 0 表示原地图没有该格 */
  alpha?: string;
}

/** 批量渲染雷达预览（minimap.ini 配色 + 覆盖物/地形/建筑 + 高度明暗） */
export function fetchMapPreviews(
  contents: string[],
  options?: { cropEmpty?: boolean; transparentEmpty?: boolean; mapUnitWindow?: boolean },
): Promise<MapPreviewData[]> {
  return postJson<{ items: MapPreviewData[] }>('/api/preview', {
    contents,
    ...(options ?? {}),
  }).then((r) => r.items);
}

/**
 * cncmaps 渲染预览（PNG blob，默认 1600px 宽）。
 *
 * 优先传 `{ mapKey }`（生成接口回的内容哈希），服务端自己取回地图原文，
 * 前端就不用再把几 MB 的地图文本重传一遍；key 失效时再退回 `mapContent`。
 */
export async function fetchCncmapsPreview(
  target: string | { mapKey?: string | null; mapContent?: string },
  name: string,
  width = 1600,
): Promise<Blob> {
  const body =
    typeof target === 'string'
      ? { mapContent: target, name, width }
      : { ...target, name, width };
  const res = await fetch('/api/cncmaps-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await readErrorText(res);
    const err = new Error(
      detail ? `${detail} (HTTP ${res.status})` : `cncmaps 预览失败 (HTTP ${res.status})`,
    );
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return await res.blob();
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
  const alphaBin = preview.alpha ? atob(preview.alpha) : null;
  const img = ctx.createImageData(preview.width, preview.height);
  const n = Math.min(bin.length / 3, preview.width * preview.height);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    img.data[j] = bin.charCodeAt(i * 3);
    img.data[j + 1] = bin.charCodeAt(i * 3 + 1);
    img.data[j + 2] = bin.charCodeAt(i * 3 + 2);
    img.data[j + 3] = alphaBin ? alphaBin.charCodeAt(i) : 255;
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

/** 以出生点为中心切出的独立 spawn 单元 */
export interface MapSpawnUnit {
  name: string;
  content: string;
  x: number;
  y: number;
  partial: boolean;
}

export interface SplitSpawnResult {
  theater: string;
  theaterDir: string;
  theaterSource: 'auto' | 'manual';
  detectedTheater: string | null;
  detectedTheaterDir: string | null;
  warnings: string[];
  unitSize: string;
  count: number;
  spawns: MapSpawnUnit[];
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
  /** 是否跳过了功能窗口内缺源地图地形的边缘切片 */
  skipPartial: boolean;
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
  /**
   * true：跳过功能窗口内缺源地图地形的边缘切片（编辑器不会给它们补清地）。
   * 后端默认 false。
   */
  skipPartial?: boolean;
  /** 默认 true：给切片画窗外框（对生成器纯视觉，编辑器里不再一片空白） */
  frame?: boolean;
}): Promise<SplitResult> {
  return postJson<SplitResult>('/api/split', payload);
}

/** 只切出生点：以每个 Waypoint 为中心切单元，每个文件只带一个出生点。 */
export function splitSpawnUnits(payload: {
  mapContent: string;
  autoTheater?: boolean;
  theaterType?: string;
}): Promise<SplitSpawnResult> {
  return postJson<SplitSpawnResult>('/api/split/spawns', payload);
}

// ============== RMG ==============

/** cxx 管线（vera20k 逐函数平移）的生成结果 */
export interface CxxGenerateResult {
  mapContent: string;
  fileName: string;
  /** 服务端内存里这份地图的句柄；预览时用它，免去重传地图文本 */
  mapKey?: string;
  width: number;
  height: number;
  waterAmount: number;
  cellCount: number;
  elapsedMs: number;
  globalSeed: number;
  options: {
    waterAmount: number;
    ruggedness: number;
    urbanPresence: number;
    accessibility: number;
    regionSize: number;
    tiberiumLayout: number;
    vegetation: number;
    seed04C: number;
    environment: number;
    timeOfDay: number;
    theater: number;
    mapSize: number;
    oreDensity: number;
    playerCount: number;
    multiplayer: boolean;
  };
}

/** 用一个种子跑 cxx 管线（16 个 MAPSEEDCLASS 字段由种子摇出，作为结果返回） */
export function generateRmgCxx(payload: {
  globalSeed: string | number;
  environment?: number;
  timeOfDay?: number;
  theater?: number;
  mapSize?: number;
  oreDensity?: number;
  playerIndex?: number;
  gameType?: number;
  name?: string;
  /** Ares Create Urban Areas：true 按面积折算数量，数字直接指定 */
  urbanAreas?: boolean | number;
}): Promise<CxxGenerateResult> {
  return postJson<CxxGenerateResult>('/api/rmg/cxx/generate', payload);
}

