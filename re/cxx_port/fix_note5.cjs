const fs = require('fs');
const p = 'packages/core/src/rmg/cxx/README.md';
let s = fs.readFileSync(p, 'utf8');
const anchor = '>    （RIDING 顺序即对齐），同时保留 TrimCliffPieceForRamp 的修整语义对齐 exe 的修整时机。\n';
const add = anchor +
'> 9. **最终根因（已切片待解码）**：exe 的 PlaceCliffPiece（0x140026C00-0x140026D70，\n' +
'>    已含在 exe_disasm.txt）的槽位解析是极简二选一：\n' +
'>    slot = (sil&0x0C || al&2) ? ((r14b&1) ? 1 : 38) : 1 ——只放 cliff01/cliff38；\n' +
'>    而漂移文本/TS 是复杂级联（0xa0→34、0x82→39、0x0a→33、0x28→40、E空→9..16）。\n' +
'>    下一轮：解码 sil/al/r14b 三个位源（在调用块上方的行走条件计算里），\n' +
'>    用 exe 的 {1,38} 解析替换 TS 的级联 → RIDING 0 diff → env3/4 .map 字节一致 → 收网。\n';
if (!s.includes(anchor)) { console.error('anchor missing'); process.exit(1); }
s = s.replace(anchor, add);
fs.writeFileSync(p, s);
console.log('note5 added');
