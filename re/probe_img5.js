/**
 * `.img` 逐层试探 —— 假设布局：
 *   u16 magic0(1290) magic1(2049)
 *   u16 zero0 zero1
 *   u16 W  H  W+1  H+1
 *   然后重复 { ... 层数据 ... }
 *
 * 已知 u16[4..7] = (W,H,W+1,H+1) 两样本成立。
 * 现在从偏移 16 开始，尝试「层头 = {u16 a, u16 b, u16 tileCount}」等组合，
 * 逐层推进看游标能否走完文件。
 */
const fs = require('fs');

function load(f) {
  const b = fs.readFileSync(__dirname + '/samples/' + f);
  return { b, len: b.length, W: b[8] | (b[9] << 8), H: b[10] | (b[11] << 8) };
}
const u16 = (b, o) => b[o] | (b[o + 1] << 8);

const A = load('randmap_2p_seed16093.img');
const B = load('randmap_8p_seed16730.img');

// 打印 A 的前 64 字节 u16，找可能的层头
console.log('=== A: 偏移 16 起的 u16 序列（前 48 项）===');
const seq = [];
for (let o = 16; o < 16 + 96 && o + 1 < A.len; o += 2) seq.push(u16(A.b, o));
console.log(seq.join(', '));

console.log('\n=== B: 同上 ===');
const seq2 = [];
for (let o = 16; o < 16 + 96 && o + 1 < B.len; o += 2) seq2.push(u16(B.b, o));
console.log(seq2.join(', '));

// 假设：偏移16 起是 layerCount(u16) 或 逐层 {u16 w, u16 h, u16 n, ...}
console.log('\n=== 试探 A：把 u16[8] 当 layerCount ===');
for (const start of [16, 18, 20]) {
  const n = u16(A.b, start);
  console.log('  start=%d layerCount=%d', start, n);
  if (n > 0 && n < 64) {
    let o = start + 2;
    for (let i = 0; i < Math.min(n, 6); i++) {
      if (o + 6 > A.len) { console.log('    越界 @%d', o); break; }
      const w = u16(A.b, o), h = u16(A.b, o + 2), tc = u16(A.b, o + 4);
      console.log('    层%d @%d: w=%d h=%d tileCount=%d (数据 %d B)', i, o, w, h, tc, tc * 2);
      o += 6 + tc * 2;
      if (o > A.len) { console.log('      -> 越界'); break; }
    }
    console.log('    结束游标 %d / %d', o, A.len);
  }
}
