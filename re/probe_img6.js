/**
 * `.img` 第三段头已破译：
 *   off 0  : u16 1290, 2049          (magic, 恒定)
 *   off 4  : u16 0, 0
 *   off 8  : u16 W, H, W+1, H+1      (地图尺寸)
 *   off 16 : 48 × u16 = 0            (零区)
 *   off 64 : u16 768, W+1, 1, W+1, H+1   ← 段头（两样本同构）
 *   off 74 : ...
 *
 * 768 = 0x300 恒定；1 恒定；W+1 / H+1 随图变。
 * 猜测：768 是 flags/bitmask（W<<8|H 的打包？157<<8|79 = 0x9D4F 正是样本A的 u16[4..5] 拼接！）
 * 验证：157<<8|79 = 40207 = 0x9D4F ≠ 768。所以 768 与 W/H 无关。
 */
const fs = require('fs');

function load(f) {
  const b = fs.readFileSync(__dirname + '/samples/' + f);
  return { b, len: b.length };
}
const u16 = (b, o) => b[o] | (b[o + 1] << 8);

for (const [n, f] of [['A(2p)', 'randmap_2p_seed16093.img'], ['B(8p)', 'randmap_8p_seed16730.img']]) {
  const { b, len } = load(f);
  console.log('=== %s len=%d ===', n, len);
  // off 64 起 40 个 u16
  const s = [];
  for (let o = 64; o < 64 + 80 && o + 1 < len; o += 2) s.push(u16(b, o));
  console.log('  off64 u16: ' + s.slice(0, 20).join(', '));

  // 找 off64 之后的非零区
  let first = -1;
  for (let o = 64; o < len; o++) {
    if (b[o] !== 0) { first = o; break; }
  }
  console.log('  off64 之后首个非零字节 @%d (0x%X)', first, first);

  // 统计 off80 之后 u16 分布
  const tail = b.slice(80);
  let mn = 1e9, mx = -1;
  const uq = new Set();
  for (let o = 0; o + 1 < tail.length; o += 2) {
    const v = tail[o] | (tail[o + 1] << 8);
    if (v < mn) mn = v;
    if (v > mx) mx = v;
    uq.add(v);
  }
  console.log('  off80 后 u16: min=%d max=%d uniq=%d 样本=%d',
    mn, mx, uq.size, tail.length >> 1);
  // 高频值
  const cnt = new Map();
  for (let o = 0; o + 1 < tail.length; o += 2) {
    const v = tail[o] | (tail[o + 1] << 8);
    cnt.set(v, (cnt.get(v) || 0) + 1);
  }
  const top = [...cnt.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8);
  console.log('  高频 u16: ' + top.map(([v, c]) => `${v}×${c}`).join('  '));
  console.log();
}
