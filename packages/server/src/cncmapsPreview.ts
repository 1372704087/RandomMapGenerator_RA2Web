/**
 * cncmaps-ts 预览渲染代理。
 *
 * 主后端把生成好的地图上传给它自己的 cncmaps Web 服务（默认 127.0.0.1:5174），
 * 请求 1600px 的缩略预览，再把 PNG 返回给前端。渲染是独立子进程，所以这里
 * 串行化请求，避免两个 500×500 渲染同时吃掉几 GB 内存。
 */

const CNCMAPS_WEB_URL = (process.env.CNCMAPS_WEB_URL ?? 'http://127.0.0.1:5174').replace(/\/+$/, '');
const PREVIEW_TIMEOUT_MS = 180_000;

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
 * 超大图（500×500 这种，全尺寸画布约 3000 万～4 亿像素）再加标记层会直接把子进程
 * 的堆撑爆（exit 134 / SIGABRT）。所以超过阈值时干脆不带标记，省一次必崩的重渲。
 */
export function renderCncmapsPreview(
  mapContent: string,
  name: string,
  previewWidth = 1600,
): Promise<Buffer> {
  const heavy = projectedPixels(mapContent) > MARKER_MAX_PIXELS;
  const job = renderChain.then(() => doRender(mapContent, name, previewWidth, !heavy));
  renderChain = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

/** 标记层允许的最大投影像素数（菱形投影：宽 ×2，高 ×1）。 */
const MARKER_MAX_PIXELS = 120_000_000;

/** 从 `[Map] Size=w,h` 估投影像素数；解析不出来就当作小图。 */
function projectedPixels(mapContent: string): number {
  const m = /\[Map\][^\[]*\bSize\s*=\s*(\d+)\s*,\s*(\d+)/i.exec(mapContent.slice(0, 4096));
  if (!m) return 0;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return 0;
  // NumberedTileData 以菱形铺开：列 = 2w，行 = h
  return 2 * w * h;
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
