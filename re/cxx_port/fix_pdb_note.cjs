const fs = require('fs');
const p = 'packages/core/src/rmg/cxx/README.md';
let s = fs.readFileSync(p, 'utf8');
const old1 = '> 1. **PDB SHA-256 实证**：MapGenerator.pdb 内含的源文件哈希与盘上\n>    MapGenMakingSub.cpp 完全一致 ⇒ exe 就是当前源码编译的，源码即权威。';
const new1 = '> 1. ~~PDB SHA-256 实证 exe==盘上源码~~ **已被三轮推翻**：直接反汇编证明\n>    exe 的 CarveRampAt 条带循环与盘上文本不同——PDB 中的哈希命中是早期\n>    编译轮次的残留。**以反汇编为准**。';
if (!s.includes(old1)) { console.error('anchor missing'); process.exit(1); }
s = s.replace(old1, new1);
fs.writeFileSync(p, s);
console.log('corrected');
