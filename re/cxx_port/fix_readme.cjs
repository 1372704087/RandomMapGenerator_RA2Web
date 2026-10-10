const fs = require('fs');
const p = 'packages/core/src/rmg/cxx/README.md';
let s = fs.readFileSync(p, 'utf8');
const broken = '>    exe 的 CarveRampAt 四轴向条目 =  的随机行数循环；盘上文本 = 单次固定条带。\n';
const fixed = '>    exe 的 CarveRampAt 四轴向条目 = 随机行数条带循环：helper 0x14001F510（消耗 2 抽：\n' +
'>    n = clamp(trunc(next·K_UNIT_SCALE·4), 0, 3)，off = clamp(-n - trunc((2n+1)·(-K_UNIT_SCALE)), -n, n)，\n' +
'>    数学上 off 恒 = -n）→ 每行 helper 0x14001F660（消耗 1 抽掷币，行角 from/to = (base±di/bx, C∓D/2) 的打包坐标）\n' +
'>    → 每行独立调 builder + acceptBuilder（首个非零即胜）。盘上文本 = 单次固定条带 + 2 次 DrawZeroOrOne，是构建后的改写。\n';
if (!s.includes(broken)) { console.error('broken line not found'); process.exit(1); }
s = s.replace(broken, fixed);
// also append the builder5 band formula if missing
if (!s.includes('X_i = prevY')) {
  const anchor = '>    斜坡族表已从 exe .rdata 提取验证一致（kSx/kSy/坡带 [10,14,14,14,6]）。下一轮：按上述公式重写 builder5 坡带循环 + A/B 其余 6 个 builder。\n';
  const add = '>    斜坡族表已从 exe .rdata 提取验证一致（kSx/kSy/坡带表 [10,14,14,14,6]/[9,13,13,13,5]）。\n' +
'>    **builder5 坡带链式几何**（exe 实测：每行 5 格中只有首格落在图内，其余链出界成无效写）：\n' +
'>    X_i = prevY + stripBias + toX + 3；Y_i = belowZero - i + (prevY > 0 ? rowCounter : prevY) + toY；\n' +
'>    level = ownerLevel + [3,2,1,0,0][i] - 4；tile = slope + rampBase - 1；ecx 链 = 上一格的 Y（行首 0），rowCounter 每行 -1。\n' +
'>    （TS 当前为文本几何 cx=prev+toX+3+bias / cy=col+belowZero+toY-i，故 R10 clash 点 Y 差 1。）\n' +
'>    下一轮：按链式公式重写 builder5 坡带 + A/B 其余 6 个 builder 是否同样漂移。\n';
  s = s.replace(anchor, add);
}
fs.writeFileSync(p, s);
console.log('README fixed');
