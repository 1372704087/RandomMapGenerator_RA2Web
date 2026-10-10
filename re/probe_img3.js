/**
 * `.img` 格式解析 v2 —— 用两份真机样本交叉验证。
 *
 * 样本（同一游戏目录，前后两次生成）：
 *   A: NumPlayers=2, Seed=16093, MapType=4, Theater=1 → 25518 B
 *   B: NumPlayers=8, Seed=16730, MapType=4, Theater=1 → 49599 B
 *
 * 已确认的结构（两份样本头部逐字节同构）：
 *   u16[0..1] = 1290, 2049      ← 恒定，与样本无关（magic/版本）
 *   u16[2..3] = 0, 0
 *   u16[4]    = W               ← 地图宽（随玩家数变）
 *   u16[5]    = H               ← 地图高
 *   u16[6]    = W + 1
 *   u16[7]    = H + 1
 *   u16[8..]  = 0 …
 *
 * 交叉验证：8 人图 W/H 更大，且 W+1/H+1 关系在两份样本都成立。
 */
const fs = require('fs');

const SAMPLES = [
  { name: 'A(2人,seed16093)', path: __dirname + '/samples/randmap_2p_seed16093.img' },
  { name: 'B(8人,seed16730)', path: __dirname + '/samples/randmap_8p_seed16730.img' },
];

const u16 = (b, o) => b[o] | (b[o + 1] << 8);

function analyze(name, buf) {
  console.log('=== %s : %d B ===', name, buf.length);
  const h = [];
  for (let o = 0; o < 24; o += 2) h.push(u16(buf, o));
  console.log('  头部 u16[0..11]: ' + h.slice(0, 12).join(', '));
  const W = u16(buf, 8);
  const H = u16(buf, 10);
  console.log('  W=%d H=%d   W+1=%d(实际 %d)  H+1=%d(实际 %d)',
    W, H, W + 1, u16(buf, 12), H + 1, u16(buf, 14));

  // 头部之后是什么？W*H 个 u16？
  const headBytes = 16;
  const after = buf.length - headBytes;
  console.log('  头部后 %d B，W*H*2 = %d，差 %d', after, W * H * 2, after - W * H * 2);
  console.log('  W*H = %d, (W+1)*(H+1) = %d, (W+1)*H*2 = %d',
    W * H, (W + 1) * (H + 1), (W + 1) * H * 2);

  // 统计头部后 u16 的分布
  let mn = 1e9, mx = -1;
  const uniq = new Set();
  for (let o = headBytes; o + 1 < buf.length; o += 2) {
    const v = u16(buf, o);
    if (v < mn) mn = v;
    if (v > mx) mx = v;
    uniq.add(v);
  }
  console.log('  头部后 u16: min=%d max=%d uniq=%d  样本数=%d',
    mn, mx, uniq.size, (buf.length - headBytes) >> 1);
  return { W, H };
}

for (const s of SAMPLES) {
  analyze(s.name, fs.readFileSync(s.path));
}
