/**
 * MapUnit 索引：唯一数据源
 *
 *   node scripts/mapunit-index.mjs           # 重新生成 re/specs/MAPUNIT_INDEX.csv
 *   node scripts/mapunit-index.mjs --check   # 只校验磁盘与索引是否一致（CI 用，不一致返回 1）
 *   node scripts/mapunit-index.mjs --print   # 打到 stdout
 *
 * 口径：直接读 .map（指示块解四元组、余量里数权重），不信文件名。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanAll, MAP_UNITS_DIR } from './mapunit-naming.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 're/specs/MAPUNIT_INDEX.csv');

const COLUMNS = [
  'theater', 'path', 'file', 'kind', 'code4', 'NW', 'NE', 'SW', 'SE',
  'weight', 'bytes', 'sha1', 'struct', 'terrain', 'overlay', 'units',
  'dominant', 'ztop', 'label', 'dup_group',
];

const q = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

function buildCsv() {
  const { theaters, units } = scanAll();
  // `scanAll()` 的单元对象用 camelCase（`dupGroup`），CSV 列是 snake_case，
  // 直接 `u[c]` 取会拿到 undefined，导致「重复件」这一列永远是空的。
  const cell = (u, c) => {
    if (c === 'dup_group') return u.dupGroup;
    return u[c];
  };
  const rows = units
    .slice()
    .sort((a, b) => a.theater.localeCompare(b.theater) || a.file.localeCompare(b.file, 'en', { numeric: true }))
    .map((u) => COLUMNS.map((c) => q(cell(u, c))).join(','));
  return { theaters, units, csv: [COLUMNS.join(','), ...rows].join('\n') + '\n' };
}

const { theaters, units, csv } = buildCsv();
const mode = process.argv.includes('--check') ? 'check' : process.argv.includes('--print') ? 'print' : 'write';

if (mode === 'print') process.stdout.write(csv);

if (mode === 'write') {
  fs.writeFileSync(OUT, csv, 'utf8');
  for (const t of theaters) {
    const list = units.filter((u) => u.theater === t);
    const weights = list.filter((u) => u.kind === 'terrain').reduce((a, u) => ((a[u.weight] = (a[u.weight] ?? 0) + 1), a), {});
    const dups = list.filter((u) => u.dupGroup).length;
    console.log(`${t.padEnd(18)} 件=${String(list.length).padStart(3)} 地形=${String(list.filter((u) => u.kind === 'terrain').length).padStart(3)} 权重=${JSON.stringify(weights)} 重复=${dups}`);
  }
  console.log(`\n已写入 ${path.relative(ROOT, OUT).replaceAll('\\', '/')}（${units.length} 行 + 表头）`);
}

if (mode === 'check') {
  if (!fs.existsSync(OUT)) {
    console.error(`索引缺失：${OUT}，先跑 node scripts/mapunit-index.mjs`);
    process.exit(1);
  }
  const old = fs.readFileSync(OUT, 'utf8');
  if (old === csv) {
    console.log(`OK: 索引与磁盘一致（${units.length} 件 / ${theaters.length} 个 theater）`);
    process.exit(0);
  }
  const a = old.trimEnd().split('\n');
  const b = csv.trimEnd().split('\n');
  const diffs = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) diffs.push({ line: i + 1, index: a[i], disk: b[i] });
  }
  console.error(`不一致：${diffs.length} 行（索引 ${a.length} 行 / 磁盘 ${b.length} 行）`);
  for (const d of diffs.slice(0, 12)) {
    console.error(`  L${d.line}\n    索引: ${d.index ?? '(无)'}\n    磁盘: ${d.disk ?? '(无)'}`);
  }
  if (diffs.length > 12) console.error(`  …其余 ${diffs.length - 12} 行省略`);
  console.error('\n跑 node scripts/mapunit-index.mjs 重新生成。');
  process.exit(1);
}
