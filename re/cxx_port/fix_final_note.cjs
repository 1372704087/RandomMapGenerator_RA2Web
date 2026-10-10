const fs = require('fs');
const p = 'packages/core/src/rmg/cxx/README.md';
let s = fs.readFileSync(p, 'utf8');
const oldLine = '>    斜坡族表已从 exe .rdata 提取验证一致（kSx/kSy/坡带 [10,14,14,14,6]）。下一轮：按上述公式重写 builder5 坡带循环 + A/B 其余 6 个 builder。';
const newLine = '>    斜坡族表已从 exe .rdata 提取验证一致（kSx/kSy/坡带 [10,14,14,14,6]）。\n' +
'>    ✅ **链式坡带已实现**：5 个取消 5/5 逐字节一致；builder5 坡带 = 链式 X（ecx 接前一格 Y）+ toY-1 基 Y。\n' +
'>    ↓ **最终剩余（唯一分歧）**：isCliffWallRiding 方向扫描——\n' +
'>    悬崖盖章账本与 CLIFF-TRIM 全一致后，exe 的 CliffPieceHitsRamp 先在\n' +
'>    (57,88) 检出 riding（faceDir=3=SE），TS 先在 (56,88) 检出（faceDir=5=SW）。\n' +
'>    exe 的 IsCliffWallRiding @0x140021054 起 587 行（8 方向低坡扫描），\n' +
'>    与 river.ts isCliffWallRiding 的方向序/低坡判定有差异。逐行比对该函数\n' +
'>    = env3/4 完全收网的最后一步。（其后 CliffPieceHitsRamp @0x140013960\n' +
'>    的位掩码遍历与 TS 一致。）';
if (!s.includes(oldLine)) { console.error('anchor missing'); process.exit(1); }
s = s.replace(oldLine, newLine);
fs.writeFileSync(p, s);
console.log('final note added');
