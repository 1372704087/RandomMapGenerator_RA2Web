/**
 * cncmaps-ts 预览渲染代理。
 *
 * 主后端把生成好的地图上传给它自己的 cncmaps Web 服务（默认 127.0.0.1:5174），
 * 请求 1600px 的缩略预览，再把 PNG 返回给前端。渲染是独立子进程，所以这里
 * 串行化请求，避免两个大图渲染同时吃掉几 GB 内存。
 *
 * 同一份地图（内容哈希）+ 同一个预览宽度只渲一次：结果落盘缓存，重复生成同一种子
 * 时直接命中，省掉一整次 spawn + 画布分配。
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const CNCMAPS_WEB_URL = (process.env.CNCMAPS_WEB_URL ?? 'http://127.0.0.1:5174').replace(/\/+$/, '');
const PREVIEW_TIMEOUT_MS = 180_000;

/** 预览缓存目录（内容哈希作文件名，与地图名无关）。 */
const CACHE_DIR = process.env.CNCMAPS_CACHE_DIR ?? path.resolve(process.cwd(), '.cache', 'cncmaps');
/** 缓存上限，超过按最久未用淘汰。 */
const CACHE_MAX_BYTES = Number(process.env.CNCMAPS_CACHE_BYTES ?? 512 * 1024 * 1024);

export class CncmapsPreviewError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = 'CncmapsPreviewError';
    this.statusCode = statusCode;
  }
}

let renderChain: Promise<unknown> = Promise.resolve();

/** 串行渲染，返回预览 PNG 字节。
 *
 * 起点/矿标记是可选叠加层：cncmaps 在遇到无效起点索引时会直接抛错退出
 * （`TileLayer.getTile` 拿到 undefined）。所以先带标记渲染，失败就退回不带标记
 * 重渲一次——地图本体能出图，比因为一层记号整张图 502 好。
 *
 * 超大图（Size 报得很大）再加标记层会把子进程的堆撑爆（exit 134 / SIGABRT）。
 * 所以超过阈值时干脆不带标记，省一次必崩的重渲。
 */
export function renderCncmapsPreview(
  mapContent: string,
  name: string,
  previewWidth = 1600,
): Promise<Buffer> {
  const heavy = projectedPixels(mapContent) > MARKER_MAX_PIXELS;
  const pixels = projectedPixels(mapContent);
  if (pixels > MAX_PIXELS) {
    const mb = Math.round((pixels * 5) / (1024 * 1024));
    throw new CncmapsPreviewError(
      `地图太大，已跳过实景预览（约 ${mb} MB 画布，超过 ${Math.round(
        (MAX_PIXELS * 5) / (1024 * 1024),
      )} MB 上限）；雷达预览与 .map 下载不受影响`,
      413,
    );
  }
  const width = Math.min(2048, Math.max(400, Math.round(previewWidth)));
  const key = cacheKey(mapContent, width, !heavy);

  const cached = readCache(key);
  if (cached) return Promise.resolve(cached);

  const job = renderChain.then(async () => {
    const again = readCache(key); // 排队期间别人可能已经渲好
    if (again) return again;
    const png = await doRender(mapContent, name, previewWidth, !heavy);
    writeCache(key, png);
    return png;
  });
  renderChain = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

/** 标记层允许的最大投影像素数（60px × 30px 一格）。带标记要重画一遍瓦片，超大图靠条带渲染顶着。 */
const MARKER_MAX_PIXELS = 320_000_000;

/** 允许渲染的最大投影像素数。渲染器在超大图上会按条带分片绘制（每片约 160 MB），
 * 所以画布本身不再受限；这个上限只是拦住真正离谱的尺寸（单张预览要跑几十秒）。 */
const MAX_PIXELS = Number(process.env.CNCMAPS_MAX_PIXELS ?? 1_000_000_000);

/** 从 `[Map] Size=x,y,w,h` 估投影像素数；解析不出来就当作小图。 */
function projectedPixels(mapContent: string): number {
  // [Map] 前面可能压着几百行注释（生成器的头块），不能只在开头找
  const at = mapContent.search(/\[map\]/i);
  if (at < 0) return 0;
  const m = /\bSize\s*=\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(
    mapContent.slice(at, at + 512),
  );
  if (!m) return 0;
  const w = Number(m[3]);
  const h = Number(m[4]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 0;
  // 一格 60×30 像素；DrawingSurface 是 3 B/px + Int16 z-buffer = 5 B/px
  return w * 60 * h * 30;
}

/** 供路由判断是否值得尝试实景渲染（0 = 解析不出尺寸）。 */
export function estimatePreviewPixels(mapContent: string): number {
  return projectedPixels(mapContent);
}

function cacheKey(mapContent: string, width: number, markers: boolean): string {
  const hash = crypto.createHash('sha1').update(mapContent, 'utf8').digest('hex');
  return `${hash}_w${width}${markers ? '_m' : ''}`;
}

function readCache(key: string): Buffer | null {
  try {
    const file = path.join(CACHE_DIR, `${key}.png`);
    const buf = fs.readFileSync(file);
    const now = new Date();
    fs.utimesSync(file, now, now); // 触碰 mtime，LRU 淘汰按它排序
    return buf;
  } catch {
    return null;
  }
}

function writeCache(key: string, png: Buffer): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, `${key}.png`), png);
    pruneCache();
  } catch {
    // 缓存只是加速，写不进去不影响出图
  }
}

/** 超出上限时删最久未用的文件。 */
function pruneCache(): void {
  let files: { file: string; size: number; at: number }[];
  try {
    files = fs
      .readdirSync(CACHE_DIR)
      .filter((f) => f.endsWith('.png'))
      .map((f) => {
        const full = path.join(CACHE_DIR, f);
        const st = fs.statSync(full);
        return { file: full, size: st.size, at: st.mtimeMs };
      });
  } catch {
    return;
  }
  let total = files.reduce((n, f) => n + f.size, 0);
  if (total <= CACHE_MAX_BYTES) return;
  files.sort((a, b) => a.at - b.at);
  for (const f of files) {
    if (total <= CACHE_MAX_BYTES) break;
    try {
      fs.unlinkSync(f.file);
      total -= f.size;
    } catch {
      /* ignore */
    }
  }
}

async function doRender(
  mapContent: string,
  name: string,
  previewWidth: number,
  withMarkers: boolean,
): Promise<Buffer> {
  try {
    return await doRenderOnce(mapContent, name, previewWidth, withMarkers);
  } catch (err) {
    if (withMarkers && !(err instanceof CncmapsPreviewError && err.statusCode === 503)) {
      // 标记层炸了（起点索引无效 / 大图内存不够）→ 去掉标记再来一次
      try {
        return await doRenderOnce(mapContent, name, previewWidth, false);
      } catch (err2) {
        throw err2;
      }
    }
    throw err;
  }
}

async function doRenderOnce(
  mapContent: string,
  name: string,
  previewWidth: number,
  withMarkers: boolean,
): Promise<Buffer> {
  const fileName = `${safeFileName(name)}.yrm`;
  const width = Math.min(2048, Math.max(400, Math.round(previewWidth)));

  let uploadToken: string;
  try {
    const res = await fetch(`${CNCMAPS_WEB_URL}/api/upload`, {
      method: 'POST',
      headers: { 'X-Filename': encodeURIComponent(fileName) },
      // 地图文件是 Latin-1 文本；不要让 fetch 按 UTF-8 重新编码。
      body: Buffer.from(mapContent, 'latin1'),
      signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error((await res.text()) || `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { token?: string };
    if (!data.token) throw new Error('cncmaps 上传未返回 token');
    uploadToken = data.token;
  } catch (err) {
    throw new CncmapsPreviewError(
      `cncmaps 服务不可用（${CNCMAPS_WEB_URL}）：${errorMessage(err)}`,
      503,
    );
  }

  let imageUrl: string;
  try {
    const res = await fetch(`${CNCMAPS_WEB_URL}/api/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadToken,
        format: 'png',
        engine: 'yr',
        sizeMode: 'auto',
        markStartPos: withMarkers,
        markOre: withMarkers,
        previewWidth: width,
      }),
      signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error((await res.text()) || `HTTP ${res.status}`);
    }
    const lines = (await res.text()).split(/\r?\n/);
    let done: { ok?: boolean; url?: string; message?: string } | null = null;
    let fatal: string | null = null;
    for (const line of lines) {
      if (!line.trim()) continue;
      let msg: {
        type?: string;
        ok?: boolean;
        url?: string;
        message?: string;
        level?: string;
      };
      try {
        msg = JSON.parse(line) as typeof msg;
      } catch {
        continue;
      }
      if (msg.type === 'log' && msg.level === 'fatal') fatal = msg.message ?? fatal;
      if (msg.type === 'error') throw new Error(msg.message || 'cncmaps 渲染失败');
      if (msg.type === 'done') done = msg;
    }
    if (!done) throw new Error(`cncmaps 未返回渲染结果${fatal ? `（${fatal}）` : ''}`);
    if (!done.ok || !done.url) {
      const why = [done.message || 'cncmaps 渲染失败', fatal].filter(Boolean).join('：');
      throw new Error(why);
    }
    imageUrl = done.url;
  } catch (err) {
    if (err instanceof CncmapsPreviewError) throw err;
    throw new CncmapsPreviewError(`cncmaps 渲染失败：${errorMessage(err)}`, 502);
  }

  try {
    const res = await fetch(`${CNCMAPS_WEB_URL}${imageUrl}`, {
      signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    throw new CncmapsPreviewError(`cncmaps 预览图获取失败：${errorMessage(err)}`, 502);
  }
}

function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned.length > 0 ? cleaned : 'Random Map';
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
