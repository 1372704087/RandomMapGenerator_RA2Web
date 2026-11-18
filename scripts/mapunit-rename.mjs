/**
 * MapUnit 改名：<label>_<kindTag>_<code4>_w<weight>_<seq>.map
 *
 *   node scripts/mapunit-rename.mjs            # 只生成 re/specs/MAPUNIT_RENAME_MAP.csv（不落盘）
 *   node scripts/mapunit-rename.mjs --apply    # 真正改名（git 会识别为 rename）
 *
 * 不动：empty.map / indicator.map / cannotplacesmudge.map / *.ini
 * 语义词保留：spawn、tiberium（生成器按名字子串过滤）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanAll, targetName, KIND_TAG, MAP_UNITS_DIR } from './mapunit-naming.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAP_CSV = path.join(ROOT, 're/specs/MAPUNIT_RENAME_MAP.csv');
const APPLY = process.argv.includes('--apply');

const { units } = scanAll();
const plan = [];

for (const theater of [...new Set(units.map((u) => u.theater))]) {
  const list = units.filter((u) => u.theater === theater && targetName(u, 0) !== null);
  // 序号：同一 (kind, code4) 内按原文件名自然排序递增
  const groups = new Map();
  for (const u of list) {
    const key = `${u.kind}|${u.code4}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(u);
  }
  for (const [key, group] of groups) {
    group.sort((a, b) => a.file.localeCompare(b.file, 'en', { numeric: true }));
    group.forEach((u, i) => plan.push({ ...u, seq: i + 1, newFile: targetName(u, i + 1, path.extname(u.file)) }));
  }
}

// 校验
const problems = [];
for (const theater of [...new Set(plan.map((p) => p.theater))]) {
  const t = plan.filter((p) => p.theater === theater);
  const seen = new Map();
  for (const p of t) {
    const k = p.newFile.toLowerCase();
    if (seen.has(k)) problems.push(`[${theater}] 重名: ${seen.get(k)} 与 ${p.file} → ${p.newFile}`);
    seen.set(k, p.file);
    if (p.kind !== 'terrain' && !new RegExp(p.kind, 'i').test(p.newFile)) problems.push(`[${theater}] ${p.file} 缺语义词 ${p.kind}`);
    if (p.kind === 'terrain' && /spawn|tiberium/i.test(p.newFile)) problems.push(`[${theater}] ${p.file} 地形件名含保留词: ${p.newFile}`);
    if (/[<>:"/\\|?*]/.test(p.newFile)) problems.push(`[${theater}] ${p.file} 非法字符: ${p.newFile}`);
  }
}
if (problems.length) {
  console.error(`校验失败 ${problems.length} 项：`);
  for (const p of problems.slice(0, 20)) console.error('  ' + p);
  process.exit(1);
}

// 写映射表
const cols = ['theater', 'old_path', 'new_file', 'kind', 'code4', 'weight', 'label', 'seq', 'struct', 'terrain', 'overlay', 'units', 'dominant', 'ztop'];
const q = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
const rows = plan
  .sort((a, b) => a.theater.localeCompare(b.theater) || a.newFile.localeCompare(b.newFile))
  .map((p) => [p.theater, p.path, p.newFile, p.kind, p.code4, p.weight, p.label, p.seq, p.struct, p.terrain, p.overlay, p.units, p.dominant, p.ztop].map(q).join(','));
fs.writeFileSync(MAP_CSV, [cols.join(','), ...rows].join('\n') + '\n', 'utf8');

for (const theater of [...new Set(plan.map((p) => p.theater))]) {
  const t = plan.filter((p) => p.theater === theater);
  const byKind = t.reduce((a, p) => ((a[p.kind] = (a[p.kind] ?? 0) + 1), a), {});
  console.log(`${theater.padEnd(18)} 改名 ${String(t.length).padStart(3)} 件 ${JSON.stringify(byKind)}`);
}
console.log(`\n映射表：${path.relative(ROOT, MAP_CSV).replaceAll('\\', '/')}（${plan.length} 行）`);

if (!APPLY) {
  console.log('未落盘。确认后跑：node scripts/mapunit-rename.mjs --apply');
} else {
  let done = 0;
  for (const p of plan) {
    const from = path.join(MAP_UNITS_DIR, p.path);
    const to = path.join(path.dirname(from), p.newFile);
    if (fs.existsSync(to)) throw new Error(`目标已存在：${to}`);
    fs.renameSync(from, to);
    done++;
  }
  console.log(`\n已改名 ${done} 个文件。`);
}
