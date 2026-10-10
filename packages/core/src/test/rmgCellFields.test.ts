/**
 * 阶段 18 测试：CellClass 原生字段契约 + 菱形坐标打包
 *
 * 依据 `re/specs/STAGE18_GROWTH_QUEUE.md`（2026-10-07 探针 + IDA 双源验证）。
 *
 * 这些断言的作用不是"测算法"，而是**把字段初值与坐标编码锁死** ——
 * 阶段 18 实现时任何一处初值写错（如 `attachIndex` 写成 0 而非 −1）
 * 都会让 `0x4838E0` 的三态门走错分支，而这类错误在类型检查与
 * 端到端出图测试里**完全不可见**（图照样能出，只是内容不同）。
 *
 * 原生偏移 → 字段的对应见各断言注释。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  defaultRmgCell,
  packDiamondCoord,
  unpackDiamondCoord,
  RmgGrid,
  DIRECTION_OFFSETS,
} from '../rmg/cell';

// ---------------------------------------------------------------------------
// 一、菱形坐标 dword 打包（CellClass+0x24）
// ---------------------------------------------------------------------------

test('菱形坐标打包：x=低16位 / y=高16位，均有符号', () => {
  // 原生 0x49F2F0 填入 g_DirectionOffsets 的值可反解验证：
  //   0xFFFF0000 = (x=0, y=−1)  = N
  //   0xFFFF0001 = (x=+1, y=−1) = NE
  //   0x00010001 = (x=+1, y=+1) = SE
  //   0xFFFFFFFF = (x=−1, y=−1) = NW
  assert.equal(packDiamondCoord(0, -1), 0xffff0000 >>> 0);
  assert.equal(packDiamondCoord(1, -1), 0xffff0001 >>> 0);
  assert.equal(packDiamondCoord(1, 1), 0x00010001);
  assert.equal(packDiamondCoord(-1, -1), 0xffffffff >>> 0);
});

test('菱形坐标打包：负 y 不得被当成大正数', () => {
  // JS 的 << 是有符号 32 位运算，直接 (y<<16)|x 在 y 为负时会走错路径，
  // 必须先 & 0xffff 截断。这是 packDiamondCoord 存在的原因。
  for (const [x, y] of [
    [0, -1],
    [1, -1],
    [-1, -1],
    [0, 1],
    [-1, 0],
    [5, -3],
    [-7, 9],
  ] as Array<[number, number]>) {
    const packed = packDiamondCoord(x, y);
    const [ux, uy] = unpackDiamondCoord(packed);
    assert.equal(ux, x, `x round-trip (${x},${y})`);
    assert.equal(uy, y, `y round-trip (${x},${y})`);
  }
});

test('菱形坐标打包：unpack 对高位补码回解（无符号输入）', () => {
  // dword 可能是无符号数（>= 0x80000000），>> 16 后需再补一次符号扩展
  const packed = packDiamondCoord(3, -1);
  assert.ok(packed > 0x80000000, '负 y 的打包结果应是 > 0x80000000 的无符号数');
  assert.deepEqual(unpackDiamondCoord(packed), [3, -1]);
});

// ---------------------------------------------------------------------------
// 二、阶段 18 新增字段的初值契约
//
// 每条都对应原生的一处判定分支；初值写错会静默改变行为。
// ---------------------------------------------------------------------------

test('阶段18 字段初值：多边形 id 必须为 −1（0x4838E0 门 6a）', () => {
  // 门 6a: cmp dword [cell+0x44], -1 ; jne FAIL
  //   ⇒ polyIdLookup 初值必须 −1，否则「无多边形」的格子会被判为不可生长
  const c = defaultRmgCell();
  assert.equal(c.polyIdLookup, -1);
  assert.equal(c.polyId, -1);
});

test('阶段18 字段初值：attachIndex 为 −1（门 6c 三态的「<0 直接通过」）', () => {
  // 门 6c: mov eax,[cell+0x38] ; test eax,eax ; jl PASS
  //   ⇒ < 0 才走「直接通过」。若初值写成 0，会落到查附属表的分支，
  //     而附属表未初始化 ⇒ 行为未定义。
  const c = defaultRmgCell();
  assert.ok(c.attachIndex < 0, 'attachIndex 必须 < 0 以命中门 6c 的快速通过');
  assert.equal(c.attachIndex, -1);
});

test('阶段18 字段初值：spreadKey 为 −1（0x7221B0 的「无主」标记）', () => {
  // 0x7221B0: mov edi,[cell+0x100] ; cmp edi,-1 ; je … ⇒ −1 = 无扩散归属
  const c = defaultRmgCell();
  assert.equal(c.spreadKey, -1);
});

test('阶段18 字段初值：生长队列全空（0x7228B0/0x722D00 的重置目标）', () => {
  // 原生重置序列：heapCount=0 / heap 容器清空 / visited 全 0
  const c = defaultRmgCell();
  assert.equal(c.growthHeapCount, 0);
  assert.equal(c.growthHeap, 0);
  assert.equal(c.growthHeapData, 0);
  assert.equal(c.growthVisited, 0);
});

test('阶段18 字段初值：attachments 为 0（门 3/门 4 与门 A 都要求空）', () => {
  // 0x483780 门 A 含 (*(uint32*)(this+228) != 0) → return 0
  const c = defaultRmgCell();
  assert.equal(c.attachments, 0);
});

test('阶段18 字段初值：菱形坐标为 (0,0) 即 dword 0', () => {
  const c = defaultRmgCell();
  assert.equal(c.diamondCoord, 0);
  assert.deepEqual(unpackDiamondCoord(c.diamondCoord), [0, 0]);
});

test('阶段18 字段初值：height 为 0（RMG 前期高程未定义，但不得为 NaN）', () => {
  // 谓词 B / 门 A 都拿 height 与 1e-05 比较。NaN 会让所有比较为 false
  // ⇒ 判定结果不可预测，故显式断言非 NaN。
  const c = defaultRmgCell();
  assert.equal(c.height, 0);
  assert.ok(!Number.isNaN(c.height));
});

// ---------------------------------------------------------------------------
// 三、两套 id 必须彼此独立（防止实现时误复用）
// ---------------------------------------------------------------------------

test('regionId 与 polyId/polyIdLookup 是三份独立状态', () => {
  // 规格 §4 明确：regionId 是 RMG scratch 区域 id，
  // +0x44/+0x98 是多边形 id，原生同时存在且参与不同判定。
  // 任何「顺手复用」都会让某个门恒成立或恒不成立。
  const c = defaultRmgCell();
  c.regionId = 7;
  assert.equal(c.polyIdLookup, -1, '改 regionId 不得影响 polyIdLookup');
  assert.equal(c.polyId, -1, '改 regionId 不得影响 polyId');
  c.polyIdLookup = 3;
  assert.equal(c.regionId, 7, '改 polyIdLookup 不得影响 regionId');
});

test('slope / density 与原生偏移对应：门 6b 要求 slope 恰为 0', () => {
  // CellClass+0x11C = slope（门 6b: test al,al ; jne FAIL）
  // CellClass+0x11E = density（谓词 B: density > polyId>>1）
  const c = defaultRmgCell();
  assert.equal(c.slope, 0);
  // 初值不校验 density 语义（依赖 polyId），但必须存在且为数字
  assert.equal(typeof c.density, 'number');
});

// ---------------------------------------------------------------------------
// 四、网格构造：所有格子都应拿到完整初值
// ---------------------------------------------------------------------------

/** 找一个确实在菱形带内的格 —— 带的 ry 从 mapW 起算，不能想当然写 (5,5) */
function firstCellInBand(grid: RmgGrid): [number, number] {
  for (const [rx, ry] of grid.nativeCells()) {
    if (grid.get(rx, ry)) return [rx, ry];
  }
  throw new Error('nativeCells 未产出任何带内格');
}

test('RmgGrid 构造后每格含阶段 18 字段且初值一致', () => {
  // 只加字段不改构造点是不够的 —— 若某条路径漏初始化，
  // 端到端出图仍会成功但内容错。这类断言是唯一的兜底。
  const grid = new RmgGrid({
    width: 40,
    height: 30,
    diamondMin: 40,
    diamondMax: 100,
  });
  const [rx, ry] = firstCellInBand(grid);
  const probe = grid.get(rx, ry);
  assert.ok(probe, 'nativeCells 首格应可取到');
  const fresh = defaultRmgCell();
  for (const k of Object.keys(fresh) as Array<keyof typeof fresh>) {
    assert.deepEqual(
      probe[k],
      fresh[k],
      `字段 ${String(k)} 未按 defaultRmgCell 初始化`,
    );
  }
});

test('resetToPrepState 把阶段 18 字段一并复位', () => {
  // map-prep 会重跑；若复位漏了新字段，阶段 18 会读到上一轮的残留值
  const grid = new RmgGrid({
    width: 40,
    height: 30,
    diamondMin: 40,
    diamondMax: 100,
  });
  const [rx, ry] = firstCellInBand(grid);
  const c = grid.get(rx, ry);
  assert.ok(c);
  c.polyIdLookup = 9;
  c.spreadKey = 4;
  c.growthHeapCount = 12;
  c.diamondCoord = packDiamondCoord(1, 1);
  c.attachIndex = 0;

  grid.resetToPrepState();

  assert.equal(c.polyIdLookup, -1, '复位应恢复 polyIdLookup = −1');
  assert.equal(c.spreadKey, -1, '复位应恢复 spreadKey = −1');
  assert.equal(c.growthHeapCount, 0, '复位应清空堆计数');
  assert.equal(c.diamondCoord, 0, '复位应清空菱形坐标');
  assert.equal(c.attachIndex, -1, '复位应恢复 attachIndex = −1');
});

// ---------------------------------------------------------------------------
// 五、方向表真值锁定（unicorn 实跑 gamemd.exe 验证，勿改）
// ---------------------------------------------------------------------------

test('DIRECTION_OFFSETS：与原生 0x89F688 运行时真值逐项一致', () => {
  // ✅ 本表已由 unicorn 实跑 gamemd.exe 验证 8/8 全对
  // （re/oracle/dump_runtime_tables.py，2026-10-07）。
  // 原生 dword 表真值，逐项 unpack 后应等于本表：
  //   0xFFFF0000 (0,−1)  0xFFFF0001 (+1,−1) 0x00000001 (+1,0)  0x00010001 (+1,+1)
  //   0x00010000 (0,+1)  0x0001FFFF (−1,+1) 0x0000FFFF (−1,0)  0xFFFFFFFF (−1,−1)
  //
  // ⚠ 曾有"原生表含重复项、缺 E 与 SW"的疑点 —— 已撤销：
  //   那是读 Hex-Rays 伪码时看错 dword 常量（IDA 把 `dword_89F690 = 1`
  //   渲染成 `0x00010000`）。**伪码的 dword 常量不可尽信。**
  const NATIVE_DWORD = [
    0xffff0000, 0xffff0001, 0x00000001, 0x00010001,
    0x00010000, 0x0001ffff, 0x0000ffff, 0xffffffff,
  ];
  assert.equal(DIRECTION_OFFSETS.length, 8);
  for (let i = 0; i < 8; i++) {
    const [x, y] = unpackDiamondCoord(NATIVE_DWORD[i]);
    assert.deepEqual(
      DIRECTION_OFFSETS[i],
      [x, y],
      `下标 ${i} 与原生 0x${NATIVE_DWORD[i].toString(16).padStart(8, '0')} 不符`,
    );
  }
  // 同时钉住方向语义（读起来更直观）
  assert.deepEqual(DIRECTION_OFFSETS[0], [0, -1], '下标 0 = N');
  assert.deepEqual(DIRECTION_OFFSETS[1], [1, -1], '下标 1 = NE');
  assert.deepEqual(DIRECTION_OFFSETS[2], [1, 0], '下标 2 = E');
  assert.deepEqual(DIRECTION_OFFSETS[4], [0, 1], '下标 4 = S');
  assert.deepEqual(DIRECTION_OFFSETS[7], [-1, -1], '下标 7 = NW');
});
