const fs = require('fs');
const p = 'packages/core/src/rmg/cxx/README.md';
let s = fs.readFileSync(p, 'utf8');
const anchor = '>    用 exe 的 {1,38} 解析替换 TS 的级联 → RIDING 0 diff → env3/4 .map 字节一致 → 收网。';
const add = anchor + '\n' +
'> 10. **✅ 三个位源已全部解出**（asm_pcp.txt = exe PlaceCliffPiece 完整 749 行反汇编切片）：\n' +
'>    - sil = cliffMask(cell)（本格 8 向掩码，0x1400266EA 加载，全函数有效）；\n' +
'>    - r14b = RandomFloatRange(0,5) 的 roll（0x1400266DF，prologue 一次）；\n' +
'>    - al = 第二次 CliffMask 的结果（0x140026BAD 对某邻格再算掩码）。\n' +
'>    **exe 的槽位解析树**（取代 TS 的 0xa0/0x82/0x0a/0x28 级联——那是漂移文本的）：\n' +
'>    ```\n' +
'>    0xa0 位 → 0x1400267EF 自己的分支（待翻译）\n' +
'>    其余:   if ((ownMask & 0x1C) == 4 && (neighMask & 0x0A) != 0x0A)\n' +
'>                slot = (roll % 3) + 35            // 35/36/37\n' +
'>            else if ((ownMask & 0x0C) == 0 && (neighMask & 2) == 0)\n' +
'>                slot = 1\n' +
'>            else\n' +
'>                slot = (roll & 1) ? 1 : 38        // roll 奇偶决定 1/38\n' +
'>    slot ∈ {23,24,25} 时还有东邻 placeholder 检查→可能改 26（0x140026CA2-D34）。\n' +
'>    ```\n' +
'>    即 exe 只放 slot ∈ {1, 23-26, 34-38} 族（与 TS 的 34/39/33/40/9-16 完全不同族）。\n' +
'>    **收网 = 按 asm_pcp.txt（749 行，已切片）完整重译 exe 的 PlaceCliffPiece**，\n' +
'>    替换 river.ts…不、makingSub.ts 的级联 → RIDING 0 diff → .map 字节一致。\n';
if (!s.includes(anchor)) { console.error('anchor missing'); process.exit(1); }
s = s.replace(anchor, add);
fs.writeFileSync(p, s);
console.log('note6 added');
