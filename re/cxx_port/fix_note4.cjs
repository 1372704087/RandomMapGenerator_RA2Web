const fs = require('fs');
const p = 'packages/core/src/rmg/cxx/README.md';
let s = fs.readFileSync(p, 'utf8');
const anchor = '>    而 TS 是逐片预检。下一轮：重排 TS 的 placeCliffPiece/预检为 exe 的行走内调用序，即可收网。';
const add = '>    而 TS 是逐片预检。下一轮：重排 TS 的 placeCliffPiece/预检为 exe 的行走内调用序，即可收网。\n' +
'> 8. **✅ 已实证：exe 的骑坡检查 = 全局菱形行走序**（RIDING 格按 x+y 分带排序与实际顺序完全吻合：\n' +
'>    (31,44)=75, (59,16)=75, (60,16)=76, (31,45)=76, (61,15)=76...）——exe 是「先盖章、后统一\n' +
'>    行走检查/修整」（global pass），TS 是「放置前逐片预检」（pre-check）。收网方案：把 TS 的\n' +
'>    cliffPieceHitsRamp 预检从 placeCliffPiece 中移出，改为盖章后按菱形迭代器序的全局行走检查\n' +
'>    （ RIDING 顺序即对齐），同时保留 TrimCliffPieceForRamp 的修整语义对齐 exe 的修整时机。\n';
if (!s.includes(anchor)) { console.error('anchor missing'); process.exit(1); }
s = s.replace(anchor, add);
fs.writeFileSync(p, s);
console.log('note4 added');
