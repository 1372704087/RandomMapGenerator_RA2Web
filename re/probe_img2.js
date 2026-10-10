/**
 * 探针：确定 RA2 `.img`（MapLayerSet / Image）的真实布局。
 * 样本：H:\测试\Red-Alert-2-Yuris-Revenge\RandMap.img（真机 RMG MapType=4 产物）
 *
 * 已排除的假设（都试过且不成立）：
 *   ✗ 裸 MiniLZO（`decompress` 静默失败）
 *   ✗ Format5 分块（块头解出 NaN，游标超文件）
 *   ✗ Format80（`srcIndex >= destIndex`）
 *   ✗ base64 + 分块 LZO（只解出 597 B / 25518）
 *   ✗ `4 + w*h*2` 单层（(L−4)/2 = 12757 无合理因数对）
 *   ✗ `u8 layerCount` 逐层（layerCount=10，游标冲到 80909）
 *
 * 头部实测：`0A 05 01 08 | 00 00 | 9D 00 | 4F 00 | 9E 00 | 50 00 | 00 ...`
 * 尾部实测：全 u16 序列（`0F8 0C2 0F0 0C3 ...`）
 */
const fs = require('fs');

const raw = fs.readFileSync('H:/测试/Red-Alert-2-Yuris-Revenge/RandMap.img');
const L = raw.length;
const u16 = (o) => raw[o] | (raw[o + 1] << 8);
const i16 = (o) => {
  const v = u16(o);
  return v & 0x8000 ? v - 0x10000 : v;
};

console.log('=== 头部前 40 字节按 u16 解读 ===');
const vals = [];
for (let o = 0; o < 40; o += 2) vals.push(u16(o));
console.log('u16: ' + vals.join(', '));
console.log('i16: ' + Array.from({ length: 20 }, (_, k) => i16(k * 2)).join(', '));

console.log();
console.log('=== 尾部 u16 解读（最后 20 个）===');
const tail = [];
for (let o = L - 40; o < L; o += 2) tail.push(u16(o));
console.log(tail.join(', '));

// 尾部 u16 全在 0xC0..0x100 区间 → 像 tile index
const tailStats = { min: 1e9, max: -1, uniq: new Set() };
for (let o = L - 2000; o < L; o += 2) {
  const v = u16(o);
  if (v < tailStats.min) tailStats.min = v;
  if (v > tailStats.max) tailStats.max = v;
  tailStats.uniq.add(v);
}
console.log();
console.log('尾部 1000 字节的 u16: min=%d max=%d uniq=%d',
  tailStats.min, tailStats.max, tailStats.uniq.size);

// 反推：尾部连续 u16 段的起点（往前找连续可打印 u16）
let runStart = L;
while (runStart >= 2) {
  const v = u16(runStart - 2);
  if (v > 0x8000 || v < 0x40) break;   // 越界值视为非 tile
  runStart -= 2;
}
console.log('尾部连续 u16 段起点 = 0x%X (%d)，长度 %d B = %d 项',
  runStart, runStart, L - runStart, (L - runStart) / 2);

// 头部 0x9D=157, 0x4F=79, 0x9E=158, 0x50=80 —— 试 w=157,h=79
for (const [w, h] of [[157, 79], [158, 80], [157, 158], [79, 157]]) {
  console.log('若 w=%d h=%d: w*h=%d, *2=%d, 4+= %d, L=%d %s',
    w, h, w * h, w * h * 2, 4 + w * h * 2, L,
    4 + w * h * 2 === L ? '★ 精确匹配' : '');
}
