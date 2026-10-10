/**
 * `.img` 布局求解 —— 两样本联立。
 *
 * 已知（两份样本一致）：
 *   u16[4]=W, u16[5]=H, u16[6]=W+1, u16[7]=H+1
 *   u16[0..1]=1290,2049 恒定；u16[2..3]=0
 *
 * 目标：找出「头部字节数 Hs」与「每格字节数」使
 *   len - Hs = rows * cols * cellBytes
 * 对两份样本同时成立。
 */
const fs = require('fs');

const S = [
  { n: 'A(2p)', f: 'randmap_2p_seed16093.img' },
  { n: 'B(8p)', f: 'randmap_8p_seed16730.img' },
].map((x) => {
  const b = fs.readFileSync(__dirname + '/samples/' + x.f);
  return { n: x.n, b, len: b.length, W: b[8] | (b[9] << 8), H: b[10] | (b[11] << 8) };
});

const u16 = (b, o) => b[o] | (b[o + 1] << 8);

for (const s of S) {
  console.log('%s len=%d  W=%d H=%d  W+1=%d H+1=%d',
    s.n, s.len, s.W, s.H, s.W + 1, s.H + 1);
}

console.log('\n=== 联立求解：len - Hs = f(W,H) * cellBytes ===\n');

const results = [];
for (let Hs = 2; Hs <= 64; Hs += 2) {
  for (const rowMul of [1, 2]) {
    // rows = H 或 H+1；cols = W 或 W+1
    for (const [rn, rows] of [['H', 0], ['H+1', 1]]) {
      for (const [cn, cols] of [['W', 0], ['W+1', 1]]) {
        for (const cell of [1, 2, 4]) {
          let ok = true;
          const details = [];
          for (const s of S) {
            const r = rows ? s.H + 1 : s.H;
            const c = cols ? s.W + 1 : s.W;
            const need = Hs + r * c * cell * rowMul;
            details.push(need - s.len);
            if (need !== s.len) { ok = false; break; }
          }
          if (ok) {
            results.push({ Hs, rn, cn, cell, rowMul });
            console.log('★ 匹配: Hs=%d rows=%s cols=%s cellBytes=%d rowMul=%d',
              Hs, rn, cn, cell, rowMul);
          }
        }
      }
    }
  }
}
if (results.length === 0) {
  console.log('无简单匹配 ⇒ 数据是变长/压缩的，需逐段分析');
  // 逐样本算差
  for (const s of S) {
    for (const Hs of [16, 20, 24, 32]) {
      const rem = s.len - Hs;
      const wh = s.W * s.H;
      console.log('  %s Hs=%d 剩余=%d  W*H=%d  剩余/(W*H)=%s',
        s.n, Hs, rem, wh, (rem / wh).toFixed(4));
    }
  }
}
