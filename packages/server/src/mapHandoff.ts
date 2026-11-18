/**
 * 生成 → 预览之间传递地图文本的短命仓库。
 *
 * 前端拿到生成结果后要渲染 cncmaps 预览，原先的做法是把几 MB 的地图文本再 POST 一次；
 * 手机端为了一个缩略图再上行 5 MB 不划算。改成：生成接口回一个 `mapKey`（内容 sha1），
 * 预览接口凭 key 取回服务端内存里的原文。
 *
 * 只保留最近几条，超限按 LRU 丢；重启即失效（前端拿不到内容时会退回直接上传原文）。
 */

import crypto from 'node:crypto';

const MAX_ENTRIES = 8;
const MAX_BYTES = 64 * 1024 * 1024;

interface Entry {
  content: string;
  bytes: number;
}

const store = new Map<string, Entry>(); // Map 的插入顺序即 LRU 顺序
let totalBytes = 0;

function sha1(content: string): string {
  return crypto.createHash('sha1').update(content, 'utf8').digest('hex');
}

/** 存一份地图文本，返回内容哈希（同一内容重复存不会占第二份）。 */
export function putMap(content: string): string {
  const key = sha1(content);
  const bytes = Buffer.byteLength(content, 'utf8');
  const existing = store.get(key);
  if (existing) {
    store.delete(key);
    store.set(key, existing);
    return key;
  }
  store.set(key, { content, bytes });
  totalBytes += bytes;
  evict();
  return key;
}

/** 按 key 取回地图文本；不存在返回 null。 */
export function getMap(key: string): string | null {
  const entry = store.get(key);
  if (!entry) return null;
  // 命中即提到队尾
  store.delete(key);
  store.set(key, entry);
  return entry.content;
}

function evict(): void {
  while (store.size > MAX_ENTRIES || totalBytes > MAX_BYTES) {
    const oldest = store.keys().next();
    if (oldest.done) break;
    const entry = store.get(oldest.value);
    store.delete(oldest.value);
    totalBytes -= entry?.bytes ?? 0;
  }
}
