/**
 * `g_DirectionOffsets` 的真机对拍
 *
 * `0x0089F688` 位于 `.data` 的零填充尾部（文件映像里读出来是全 0），只有在初始化函数
 * `0x0049F2F0` 跑过之后才存在取值。因此这份 golden 的抓取方式是：
 * **在 unicorn 里调用真机初始化函数 `0x0049F2F0`，然后 dump 该表 32 字节**。
 *
 * golden 来源：`vera20k-main/tools/rmg_oracle/gen_direction_offsets_vector.py`
 * 仓库内副本：`fixtures/rmg_direction_offsets.json`
 *
 * 意义：把「邻遍历次序是契约、必须硬编码 N,NE,E,SE,S,SW,W,NW」这条纪律
 * 从**约定**升级为**机器派生并受测守卫**的事实 —— 谁改坏了 `DIRECTION_OFFSETS`，
 * 这个测试就会红。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { DIRECTION_OFFSETS } from '../rmg/cell';

// ---------------------------------------------------------------------------
// fixture 载入（dist 下 tsc 会复制 JSON；若没有则回退到源码树）
// ---------------------------------------------------------------------------

function loadFixture(name: string): unknown {
  const candidates = [
    path.join(__dirname, 'fixtures', name),
    path.join(__dirname, '..', '..', 'src', 'test', 'fixtures', name),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  throw new Error(`fixture not found: ${name} (tried ${candidates.join(', ')})`);
}

interface DirectionOffsetVector {
  source: string;
  init_fn: string;
  table: string;
  table_len: number;
  order: string[];
  entries: { index: number; dir: string; dword: string; dx: number; dy: number }[];
}

const VECTOR = loadFixture('rmg_direction_offsets.json') as DirectionOffsetVector;

// ---------------------------------------------------------------------------
// 断言
// ---------------------------------------------------------------------------

test('方向偏移 - golden 结构完整（8 项、对应 N/NE/E/SE/S/SW/W/NW）', () => {
  assert.equal(VECTOR.entries.length, 8);
  assert.deepEqual(VECTOR.order, ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);
  assert.equal(VECTOR.source, 'unicorn/gamemd.exe');
  assert.ok(VECTOR.entries.every((e, i) => e.index === i));
});

test('方向偏移 - DIRECTION_OFFSETS 与真机表逐项一致（位精确）', () => {
  for (const e of VECTOR.entries) {
    const ours = DIRECTION_OFFSETS[e.index];
    assert.deepEqual(
      [ours[0], ours[1]],
      [e.dx, e.dy],
      `方向 ${e.index}(${e.dir}) 不一致：ours=(${ours[0]},${ours[1]}) machine=(${e.dx},${e.dy})`,
    );
  }
});

test('方向偏移 - 未消费方向槽（下标 ≥ 8）为 undefined，不越界读', () => {
  // 原生 `MapCoord_StepByDir_GetCell 0x00481810` 用 `dir & 7` 索引；
  // 本侧 `neighbor()` 同样对越界目录返回 null（见 cell.ts）。
  assert.equal(DIRECTION_OFFSETS[8], undefined);
});

test('方向偏移 - 表内不含 (0,0)：不存在「原地不动」的方向', () => {
  for (const [i, off] of DIRECTION_OFFSETS.entries()) {
    assert.ok(
      off[0] !== 0 || off[1] !== 0,
      `方向 ${i} 是 (0,0) —— 会让邻遍历死循环`,
    );
  }
});
