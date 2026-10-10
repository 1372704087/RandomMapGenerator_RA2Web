const fs = require('fs');
const p = 'packages/core/src/rmg/cxx/README.md';
let s = fs.readFileSync(p, 'utf8');
const anchor = '>    的位掩码遍历与 TS 一致。）';
const add = '>    的位掩码遍历与 TS 一致。）\n' +
'> 6. **kCliffFootprints 已替换为 exe .rdata 提取表**（0x14005E8A8，40B/槽：w/h/mask u64/z[16]，\n' +
'>    TS 槽 N = exe 槽 N+1 的 +1 移位关系；文本表首条目错误导致整体错位）。替换后 RAMP 取消 5/5 保持，\n' +
'>    全日志 diff 收敛到 **85 行**（起点 11,948）。\n' +
'> 7. **最后 85 行的根因**：exe 的 RIDING 调用在放置遍历中**跨片交错**（piece A 格、piece B 格、\n' +
'>    piece A 格…）——其 CliffPieceHitsRamp 调用点（0x140026D5E）在 PlaceCliffs 的逐格行走内，\n' +
'>    而 TS 是逐片预检。下一轮：重排 TS 的 placeCliffPiece/预检为 exe 的行走内调用序，即可收网。';
if (!s.includes(anchor)) { console.error('anchor missing'); process.exit(1); }
s = s.replace(anchor, add);
fs.writeFileSync(p, s);
console.log('note added');
