/**
 * 探针 v11（可信版）：`createEmptyMapCells` 的 (rx,ry) 集合
 *                   vs `emitRmg` 实际枚举的 (rx,ry) 集合。
 *
 * ⚠ 前两版（v9/v10）失败原因：坐标系混用 + 钩子跑两遍。
 *    本版**纯静态推演**，不挂钩子、不跑管线 ⇒ 无法挂错层。
 *
 * 已知：
 *   ctx.cells 网格 = 23081 格   water 11409
 *   IsoMapPack5     = 23184 格  water 10289   ← 比 cell 多 103 格，少 1120 水
 */
const B = 'G:/ra2-web-mapgen/packages/core';
const fs = require('fs');
const { loadSed } = require(B + '/dist/rmg/sed.js');
const { deriveDimensions } = require(B + '/dist/rmg/options.js');
const { parseTheaterIni } = require(B + '/dist/rmg/theater.js');

const tables = parseTheaterIni(
  fs.readFileSync('G:/ra2-web-mapgen/packages/server/resources/theater/temperatmd.ini', 'utf8'), 'TEMPERATE');
const sed = loadSed(fs.readFileSync('F:/YTLauncher/RandMap.Sed').toString('latin1'));
const d = deriveDimensions(sed);
const W = d.mapW, H = d.mapH;
console.log('mapW=' + W + '  mapH=' + H + '   真机 Header: W=99 H=100（注意不同！）');
console.log('');

// ── A. createEmptyMapCells 的 (rx,ry) 集合（权威枚举）──
const A = new Map();   // key → [dx,dy]
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W * 2 - 1; x++) {
    const dx = x;
    const dy = y * 2 + (x % 2);
    const rx = Math.floor((dx + dy) / 2) + 1;
    const ry = dy - rx + W + 1;
    A.set(rx * 4096 + ry, [dx, dy]);
  }
}
console.log('createEmptyMapCells 枚举格数 = ' + A.size +
  '   期望 (2W-1)*H = ' + ((W * 2 - 1) * H));
if (A.size !== (W * 2 - 1) * H) {
  console.log('  ⚠ 与期望不符 ⇒ (rx,ry) 有碰撞');
}

// ── B. emitRmg 的枚举（dx 0..2W-2, dy 0..2H-1, 奇偶过滤）──
const Bset = new Map();
for (let dx = 0; dx < 2 * W - 1; dx++) {
  for (let dy = 0; dy < 2 * H; dy++) {
    if ((dx + dy) % 2 !== 0 && dx % 2 === 0) continue;
    const rx = Math.floor((dx + dy) / 2) + 1;
    const ry = dy - rx + W + 1;
    const k = rx * 4096 + ry;
    if (Bset.has(k)) continue;   // emit 只取第一个
    Bset.set(k, [dx, dy]);
  }
}
console.log('emitRmg 枚举格数（去重后） = ' + Bset.size);

console.log('');
console.log('=== 两套枚举的差集 ===');
const onlyA = [...A.keys()].filter((k) => !Bset.has(k));
const onlyB = [...Bset.keys()].filter((k) => !A.has(k));
console.log('  只有 createEmptyMapCells 有 = ' + onlyA.length);
console.log('  只有 emitRmg 有 = ' + onlyB.length);
if (onlyA.length) {
  const s = onlyA.slice(0, 6).map((k) => '(' + Math.floor(k / 4096) + ',' + (k % 4096) + ')');
  console.log('    样本: ' + s.join(' '));
}
if (onlyB.length) {
  const s = onlyB.slice(0, 6).map((k) => '(' + Math.floor(k / 4096) + ',' + (k % 4096) + ')');
  console.log('    样本: ' + s.join(' '));
}

console.log('');
console.log('=== emitRmg 的 ry 是否越界 ===');
let ryMin = 1e9, ryMax = -1e9, rxMin = 1e9, rxMax = -1e9;
for (const k of Bset.keys()) {
  const rx = Math.floor(k / 4096), ry = k % 4096;
  if (ry < ryMin) ryMin = ry;
  if (ry > ryMax) ryMax = ry;
  if (rx < rxMin) rxMin = rx;
  if (rx > rxMax) rxMax = rx;
}
console.log('  rx ' + rxMin + '..' + rxMax + '   ry ' + ryMin + '..' + ryMax);
console.log('  cell 分配域是 [0,' + W + ')×[0,' + H + ') 吗？');
console.log('  ⇒ rx 超出 [' + W + '] 的: ' + [...Bset.keys()].filter((k) => Math.floor(k / 4096) >= W).length + ' 格');
console.log('  ⇒ ry 超出 [' + H + '] 的: ' + [...Bset.keys()].filter((k) => (k % 4096) >= H).length + ' 格');

console.log('');
console.log('=== cellAt 的菱形带约束 ===');
const dMin = W, dMax = W + 2 * H;
const inBand = (rx, ry) => {
  const s = rx + ry;
  return s > dMin && rx - ry < dMin && ry - rx < dMin && s <= dMax;
};
let inB = 0;
for (const k of Bset.keys()) if (inBand(Math.floor(k / 4096), k % 4096)) inB += 1;
console.log('  emitRmg 枚举中满足菱形带 = ' + inB + ' / ' + Bset.size);
console.log('  ⇒ 被 cellAt 拒绝 ⇒ ' + (Bset.size - inB) + ' 格  ★');
console.log('  真机 iso 总格 23184   我们的 23184');