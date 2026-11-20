/**
 * MapUnit 改名：<label>_<kindTag>_<code4>_w<weight>_<seq>.map
 *
 *   node scripts/mapunit-rename.mjs            # 只生成 re/specs/MAPUNIT_RENAME_MAP.csv（不落盘）
 *   node scripts/mapunit-rename.mjs --apply    # 真正改名（git 会识别为 rename）
 *
 * 不动：empty.map / indicator.map / cannotplacesmudge.map / *.ini
 * 语义词保留：spawn、tiberium（生成器按名字子串过滤）
 *
 * 序号规则（2026-11-21 修订）：同一 (kind, code4) 内，**已经符合当前命名规则的文件原样保留自己的
 * 序号**，只有拿不到合法序号的文件（旧式名字、标签/接口/权重变了导致序号失效、或序号撞车）
 * 才补最小空闲序号。对已规范化的库跑出来是 0 处改动，脚本幂等，不会平白重排全库。
 *
 * --apply 走两阶段改名（先全部挪到 .renaming-tmp 临时名，再落到目标名），
 * 避免 A→B / B→C 链式改名中途撞「目标已存在」留下半改名现场；第二阶段失败时整体还原。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanAll, targetName, KIND_TAG, MAP_UNITS_DIR } from './mapunit-naming.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAP_CSV = path.join(ROOT, 're/specs/MAPUNIT_RENAME_MAP.csv');
const TMP_SUFFIX = '.renaming-tmp';

/**
 * 两阶段执行改名。changes: [{ from, to }]（绝对路径）。
 * 失败时把已挪走的临时文件还原回原名，再把异常抛出去。
 * @returns {number} 实际改名数量
 */
export function applyRenames(changes) {
  const staged = [];
  for (const c of changes) {
    const tmp = `${c.from}${TMP_SUFFIX}`;
    if (fs.existsSync(tmp)) throw new Error(`临时名已存在：${tmp}`);
    fs.renameSync(c.from, tmp);
    staged.push({ ...c, tmp });
  }
  try {
    for (const s of staged) {
      if (fs.existsSync(s.to)) throw new Error(`目标已存在：${s.to}`);
      fs.renameSync(s.tmp, s.to);
    }
  } catch (err) {
    // 逆序回滚：已落地的从目标名搬回原名，尚未落地的从临时名搬回原名
    for (let i = staged.length - 1; i >= 0; i--) {
      const s = staged[i];
      if (fs.existsSync(s.tmp)) fs.renameSync(s.tmp, s.from);
      else if (fs.existsSync(s.to)) fs.renameSync(s.to, s.from);
    }
    throw err;
  }
  return staged.length;
}

/** 从现存文件名解析出序号；只有标签/kind/接口/权重都与内容一致时才认。 */
function parsedSeq(file, u) {
  const base = file.replace(/\.map$/i, '');
  const m = /^([^_]+)_([tsoem])_([A-Z-]{4})_w(\d+)_(\d{2})$/.exec(base);
  if (!m) return null;
  const [, label, kindTag, code4, weight, seq] = m;
  if (label !== u.label) return null;
  if (kindTag !== KIND_TAG[u.kind]) return null;
  if (code4 !== u.code4) return null;
  if (Number(weight) !== u.weight) return null;
  return Number(seq);
}

function buildPlan(units) {
  const plan = [];
  for (const theater of [...new Set(units.map((u) => u.theater))]) {
    const list = units.filter((u) => u.theater === theater && targetName(u, 0) !== null);
    const groups = new Map();
    for (const u of list) {
      const key = `${u.kind}|${u.code4}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(u);
    }
    for (const group of groups.values()) {
      group.sort((a, b) => a.file.localeCompare(b.file, 'en', { numeric: true }));
      // 已合规的文件先认领自己的序号；撞车时按文件名先后保留先者
      const claimed = new Set();
      const pending = [];
      for (const u of group) {
        const seq = parsedSeq(u.file, u);
        if (seq != null && seq > 0 && !claimed.has(seq)) {
          claimed.add(seq);
          u.seq = seq;
        } else {
          pending.push(u);
        }
      }
      let next = 1;
      for (const u of pending) {
        while (claimed.has(next)) next++;
        claimed.add(next);
        u.seq = next;
      }
      for (const u of group) {
        plan.push({ ...u, newFile: targetName(u, u.seq, path.extname(u.file)) });
      }
    }
  }
  return plan;
}

function main() {
  const APPLY = process.argv.includes('--apply');
  const { units } = scanAll();
  const plan = buildPlan(units);

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
      if (p.kind === 'terrain' && /spawn|tiberium/i.test(p.newFile)) problems.push(`[${theater}] 地形件名含保留词: ${p.newFile}`);
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

  // 真正要动的文件（已经是目标名的跳过）
  const changes = [];
  for (const p of plan) {
    const from = path.join(MAP_UNITS_DIR, p.path);
    const to = path.join(path.dirname(from), p.newFile);
    if (path.resolve(from) === path.resolve(to)) continue;
    if (!fs.existsSync(from)) throw new Error(`源文件不存在：${from}`);
    changes.push({ from, to, p });
  }

  for (const theater of [...new Set(plan.map((p) => p.theater))]) {
    const t = plan.filter((p) => p.theater === theater);
    const byKind = t.reduce((a, p) => ((a[p.kind] = (a[p.kind] ?? 0) + 1), a), {});
    const moved = changes.filter((c) => c.p.theater === theater).length;
    console.log(`${theater.padEnd(18)} 件 ${String(t.length).padStart(3)}  需改名 ${String(moved).padStart(3)}  ${JSON.stringify(byKind)}`);
  }
  console.log(`\n映射表：${path.relative(ROOT, MAP_CSV).replaceAll('\\', '/')}（${plan.length} 行）`);
  console.log(`需改名合计：${changes.length} 件`);

  if (!APPLY) {
    console.log('未落盘。确认后跑：node scripts/mapunit-rename.mjs --apply');
  } else if (changes.length === 0) {
    console.log('\n已是规范名，无需改名。');
  } else {
    const done = applyRenames(changes);
    console.log(`\n已改名 ${done} 个文件。`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
