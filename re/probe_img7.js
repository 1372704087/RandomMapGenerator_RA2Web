/**
 * 假设检验：RandMap.img 是否为**未压缩位图**（缩略图 / 预览图）？
 *
 * 依据：高频 u16 全是 0xC1F0/0xE8C1/0xF001 这类"两字节颜色"形态，
 * 且体积随地图尺寸线性增长（2人 25KB ↔ 8人 50KB）。
 *
 * 检验：把字节流按 8 位调色板（RA2 的 IMG 就是索引调色板）解读，
 * 看能否形成有结构的图像。
 */
const fs = require('fs');

for (const [n, f] of [['A(2p)', 'randmap_2p_seed16093.img'], ['B(8p)', 'randmap_8p_seed16730.img']]) {
  const b = fs.readFileSync(__dirname + '/samples/' + f);
  const W = b[8] | (b[9] << 8);
  const H = b[10] | (b[11] << 8);
  console.log('=== %s  len=%d  W=%d H=%d ===', n, b.length, W, H);

  // 尝试：头部 80 字节后是 W*H 的调色板索引？
  const body = b.length - 80;
  console.log('  头部后 %d B, W*H = %d, 比值 %s',
    body, W * H, (body / (W * H)).toFixed(4));
  console.log('  (W+1)*(H+1) = %d, 比值 %s',
    (W + 1) * (H + 1), (body / ((W + 1) * (H + 1))).toFixed(4));

  // 字节直方图（判断是索引调色板还是 RGB）
  const hist = new Array(256).fill(0);
  for (let o = 80; o < b.length; o++) hist[b[o]]++;
  const top = hist.map((c, i) => [i, c]).sort((x, y) => y[1] - x[1]).slice(0, 10);
  console.log('  字节 top10: ' + top.map(([v, c]) => `${v}(0x${v.toString(16)})×${c}`).join(' '));

  // 唯一字节数
  const uniq = hist.filter((c) => c > 0).length;
  console.log('  唯一字节值 = %d / 256', uniq);
  console.log();
}
