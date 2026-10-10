/**
 * 真机 `.img` 样本结构测试 —— 锁住已确认的头部关系。
 *
 * 样本（`re/samples/`，2026-10-07 采自真机两次生成）：
 *   A: NumPlayers=2, Seed=16093, MapType=4, Theater=1 → 25518 B
 *   B: NumPlayers=8, Seed=16730, MapType=4, Theater=1 → 49599 B
 *
 * ⚠ **`RandMap.img` 不是最终地图**，是 RMG 的中间产物/缓存
 * （exe 字符串表里它紧邻 `D:\ra2mdpost\LdPrgMgr.cpp`，
 *  而 `RandMap.Map` 与全部 SED 选项键同段）。
 * 游戏实测只写 `.img`，不产出 `.map`。
 *
 * 本测试的作用：把「双样本交叉验证得出的结构关系」固定下来，
 * 防止后续误改或误用。**不试图完整解析格式**（尚未确定，见
 * `re/specs/RANDMAP_IMG_FORMAT.md` §4 的已排除假设表）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIX = join(__dirname, '..', '..', 'src', 'test', 'fixtures');

function load(name: string): Buffer {
  return readFileSync(join(FIX, name));
}
const u16 = (b: Buffer, o: number): number => b[o] | (b[o + 1] << 8);

const A = load('img_2p_seed16093.img');
const B = load('img_8p_seed16730.img');

test('样本体积与采集时一致（防误改）', () => {
  assert.equal(A.length, 25518, '样本 A 应为 25518 B');
  assert.equal(B.length, 49599, '样本 B 应为 49599 B');
});

test('img 头部：u16[0..1] 恒为 (1290, 2049)', () => {
  // 两样本完全相同 ⇒ 是 magic/版本，不随地图变化
  for (const [n, b] of [['A', A], ['B', B]] as const) {
    assert.equal(u16(b, 0), 1290, `${n} u16[0]`);
    assert.equal(u16(b, 2), 2049, `${n} u16[1]`);
  }
});

test('img 头部：u16[2..3] 恒为 0', () => {
  for (const [n, b] of [['A', A], ['B', B]] as const) {
    assert.equal(u16(b, 4), 0, `${n} u16[2]`);
    assert.equal(u16(b, 6), 0, `${n} u16[3]`);
  }
});

test('img 尺寸字段：u16[6] == u16[4]+1 且 u16[7] == u16[5]+1', () => {
  // 这是双样本都成立的核心关系，可作回归判据
  const expect: Array<[string, number, number]> = [
    ['A', 157, 79],
    ['B', 237, 119],
  ];
  for (const [n, W, H] of expect) {
    const b = n === 'A' ? A : B;
    assert.equal(u16(b, 8), W, `${n} W`);
    assert.equal(u16(b, 10), H, `${n} H`);
    assert.equal(u16(b, 12), W + 1, `${n} u16[6] 应为 W+1`);
    assert.equal(u16(b, 14), H + 1, `${n} u16[7] 应为 H+1`);
  }
});

test('img 零区：off 16 起 24 个 u16 全为 0（到 off 63）', () => {
  // 实测：off16..63（24 项）全零，off64 才是段头 768
  for (const [n, b] of [['A', A], ['B', B]] as const) {
    for (let k = 0; k < 24; k++) {
      assert.equal(u16(b, 16 + k * 2), 0, `${n} 零区第 ${k} 项（off${16 + k * 2}）应为 0`);
    }
    assert.equal(u16(b, 62), 0, `${n} off62 应为 0（零区末项）`);
  }
});

test('img 段头 off64：(768, W+1, 1, W+1, H+1) 两样本同构', () => {
  const cases: Array<[string, Buffer, number, number]> = [
    ['A', A, 158, 80],
    ['B', B, 238, 120],
  ];
  for (const [n, b, w1, h1] of cases) {
    assert.equal(u16(b, 64), 768, `${n} off64[0] 应恒为 768`);
    assert.equal(u16(b, 66), w1, `${n} off64[1] 应为 W+1`);
    assert.equal(u16(b, 68), 1, `${n} off64[2] 应恒为 1`);
    assert.equal(u16(b, 70), w1, `${n} off64[3] 应为 W+1`);
    assert.equal(u16(b, 72), h1, `${n} off64[4] 应为 H+1`);
  }
});

test('img 尺寸随玩家数单调增大（8 人图 > 2 人图）', () => {
  // 交叉验证：结构字段确实承载地图尺寸，不是巧合
  const wA = u16(A, 8), hA = u16(A, 10);
  const wB = u16(B, 8), hB = u16(B, 10);
  assert.ok(wB > wA, `8 人图宽应更大: ${wB} > ${wA}`);
  assert.ok(hB > hA, `8 人图高应更大: ${hB} > ${hA}`);
});

test('img 变长编码：每格字节数不是常数（故需 varint/dict 解析）', () => {
  // 联立检验：(len−16)/(W*H) 在两样本不等 ⇒ 排除「定长 tile 数组」假设。
  // 这是"格式尚未确定"的量化依据，防止有人再按定长数组去解。
  const ratioA = (A.length - 16) / (u16(A, 8) * u16(A, 10));
  const ratioB = (B.length - 16) / (u16(B, 8) * u16(B, 10));
  assert.ok(
    Math.abs(ratioA - ratioB) > 0.1,
    `每格字节数应显著不等：A=${ratioA.toFixed(4)} B=${ratioB.toFixed(4)}`,
  );
  // 但两者都落在 (1, 4) 区间 ⇒ 单格 1~4 字节的变长编码
  assert.ok(ratioA > 1 && ratioA < 4);
  assert.ok(ratioB > 1 && ratioB < 4);
});

test('img 字节分布像调色板索引（唯一字节值 < 128）', () => {
  // off 80 之后的唯一字节值：A=87 B=92（<128），
  // 高频值集中在 0xC1/0xC2/0xF0/0xE8/0xF8/0xF4/0xE0/0xC4
  // ⇒ 符合 RA2 地形 8bit 索引调色板，但**尚无定论**，仅记录。
  for (const [n, b] of [['A', A], ['B', B]] as const) {
    const seen = new Set<number>();
    for (let o = 80; o < b.length; o++) seen.add(b[o]);
    assert.ok(seen.size > 50, `${n} 唯一字节值应 >50，实际 ${seen.size}`);
    assert.ok(seen.size < 128, `${n} 唯一字节值应 <128，实际 ${seen.size}`);
  }
});
