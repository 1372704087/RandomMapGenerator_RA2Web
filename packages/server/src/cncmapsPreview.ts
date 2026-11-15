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

/** 串行渲染，返回预览 PNG 字节。 */
export function renderCncmapsPreview(
  mapContent: string,
  name: string,
  previewWidth = 1600,
): Promise<Buffer> {
  const job = renderChain.then(() => doRender(mapContent, name, previewWidth));
  renderChain = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

async function doRender(mapContent: string, name: string, previewWidth: number): Promise<Buffer> {
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
        markStartPos: true,
        markOre: true,
        previewWidth: width,
      }),
      signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error((await res.text()) || `HTTP ${res.status}`);
    }
    const lines = (await res.text()).split(/\r?\n/);
    let done: { ok?: boolean; url?: string; message?: string } | null = null;
    for (const line of lines) {
      if (!line.trim()) continue;
      let msg: { type?: string; ok?: boolean; url?: string; message?: string };
      try {
        msg = JSON.parse(line) as typeof msg;
      } catch {
        continue;
      }
      if (msg.type === 'error') throw new Error(msg.message || 'cncmaps 渲染失败');
      if (msg.type === 'done') done = msg;
    }
    if (!done) throw new Error('cncmaps 未返回渲染结果');
    if (!done.ok || !done.url) throw new Error(done.message || 'cncmaps 渲染失败');
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
