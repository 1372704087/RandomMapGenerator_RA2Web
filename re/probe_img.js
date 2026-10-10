const fs = require('fs');
const raw = fs.readFileSync('H:/测试/Red-Alert-2-Yuris-Revenge/RandMap.img');
const L = raw.length;

console.log('size =', L);
console.log('前 120 字节 latin1:');
console.log(JSON.stringify(raw.slice(0, 120).toString('latin1')));
console.log();
const hex = (b) => Array.from(b).map((x) => '0' + x.toString(16).toUpperCase()).join(' ');
console.log('前 32 字节 hex:', hex(raw.slice(0, 32)));
console.log('后 32 字节 hex:', hex(raw.slice(L - 32)));

// 统计字节分布：若大量 0x00 段 → 二进制；若可打印 → 文本
let zero = 0, printable = 0, high = 0;
for (const b of raw) {
  if (b === 0) zero++;
  else if (b >= 32 && b < 127) printable++;
  else high++;
}
console.log();
console.log('字节分布: 0x00=%d  可打印=%d  其它=%d', zero, printable, high);
console.log('=> %s', zero > L * 0.3 ? '二进制（含大量零）' : '偏文本');
