/**
 * RMG 决定论核心的对拍测试
 *
 * golden 向量来源：`tools/rmg_oracle/`（unicorn 直接跑真 gamemd.exe 抓取）
 *   - fixtures/rmg_rng_vectors.json：5 个种子 × 250 个状态字 + 每个 16 次抽取
 *   - fixtures/rmg_x87_vectors.json：Box-Muller 0x005980C0 的 16 个样本（含 FYL2X 警告）
 *
 * RNG 部分是**位精确**断言（这是整条管线的地基）；
 * Box-Muller 部分因 `ln` 走的是 x87 FYL2X 硬件近似表，只能给容差断言（见 README）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { RmgRng, RmgGaussian, randomRanged, countDraws, seedState } from '../rmg/rng';
import {
  chopMul,
  ftol,
  f64FromBits,
  f64ToBits,
  RANGE_K,
  gamemdSqrt,
  chop53,
} from '../rmg/x87';
import { deriveDimensions, defaultOptions, clampOptions } from '../rmg/options';

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

interface RngCase {
  seed: number;
  locked: number;
  idx_a: number;
  idx_b: number;
  state_hex: string;
  draws: string[];
}

const rngVectors = loadFixture('rmg_rng_vectors.json') as { cases: RngCase[] };

/** 把内存 dump 的 hex 按小端解成 u32 序列 */
function parseStateHex(hex: string): number[] {
  const bytes = Buffer.from(hex, 'hex');
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i += 4) {
    out.push(
      (bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24)) >>> 0,
    );
  }
  return out;
}

const hex8 = (v: number): string => (v >>> 0).toString(16).padStart(8, '0');

// ---------------------------------------------------------------------------
// RNG：位精确
// ---------------------------------------------------------------------------

test('RmgRng - 与真机 gamemd 的状态表逐字一致（5 种子 × 250 字）', () => {
  for (const c of rngVectors.cases) {
    const mine = Array.from(seedState(c.seed));
    const golden = parseStateHex(c.state_hex);
    assert.equal(golden.length, 250, `fixture 状态字数量异常 (seed=${c.seed})`);
    assert.deepEqual(mine, golden, `state 不一致 (seed=${c.seed})`);
  }
});

test('RmgRng - 连续 16 次抽取逐位一致（5 种子）', () => {
  for (const c of rngVectors.cases) {
    const rng = RmgRng.fromSeed(c.seed);
    assert.equal(rng.idxA, c.idx_a);
    assert.equal(rng.idxB, c.idx_b);
    const mine = Array.from({ length: c.draws.length }, () => hex8(rng.next()));
    assert.deepEqual(mine, c.draws, `draws 不一致 (seed=${c.seed})`);
  }
});

test('RmgRng - 交叉核对逆向报告里记录的 seed=1234 常量', () => {
  // 这两个常量同时出现在两处独立证据里：报告正文与 unicorn 向量
  const rng = RmgRng.fromSeed(1234);
  assert.deepEqual(
    Array.from(rng.state.subarray(0, 4)).map(hex8),
    ['29b13eec', 'd3f8c8d3', '451aa367', '62564db1'],
  );
  const first6 = Array.from({ length: 6 }, () => hex8(rng.next()));
  assert.deepEqual(first6, [
    '74aed1f3',
    'dcd6c7fc',
    '983f31f3',
    '969af076',
    '87d277f7',
    'f1e4ce03',
  ]);
});

test('RmgRng - locked 位置 1 时 next() 返回 0 且不推进索引', () => {
  const rng = RmgRng.fromSeed(7);
  rng.locked = 1;
  assert.equal(rng.next(), 0);
  assert.equal(rng.idxA, 0);
  assert.equal(rng.idxB, 103);
});

test('RmgRng - 索引在 250 处回卷', () => {
  const rng = RmgRng.fromSeed(1);
  for (let i = 0; i < 250; i++) assert.equal(rng.next() >= 0, true);
  assert.equal(rng.idxA, 0);
  assert.equal(rng.idxB, 103);
});

test('randomRanged - min==max 零抽取 early-out', () => {
  const rng = RmgRng.fromSeed(42);
  const counter = countDraws(rng);
  assert.equal(randomRanged(rng, 5, 5), 5);
  assert.equal(counter.count(), 0);
});

test('randomRanged - 闭区间且消耗抽取', () => {
  const rng = RmgRng.fromSeed(42);
  const counter = countDraws(rng);
  for (let i = 0; i < 200; i++) {
    const v = randomRanged(rng, 0, 100);
    assert.ok(v >= 0 && v <= 100);
  }
  assert.ok(counter.count() >= 200, '每次取值至少 1 抽');
});

// ---------------------------------------------------------------------------
// x87 浮点契约
// ---------------------------------------------------------------------------

test('x87 - RANGE_K 的位模式是 2^-32 + 2^-64，且恰为 fl64(1/(2^32-1))', () => {
  assert.equal(f64ToBits(RANGE_K), 0x3df0000000100000n);
  // 精确有理数核对：K 与 1/(2^32-1) 的差为 0（在 double 里同一位模式）
  const exact = 1 / 4294967295;
  assert.equal(f64ToBits(exact), f64ToBits(RANGE_K));
  // 但它**不等于** 1/2^32
  assert.notEqual(f64ToBits(1 / 4294967296), f64ToBits(RANGE_K));
});

test('x87 - chopMul 与就近舍入在「差一个 ULP」处分离（决定拒绝循环是否触发）', () => {
  const maxDraw = 0xffffffff;
  const c6 = f64FromBits(0x3e18000000180000n); // 6/(2^32-1) 的最近 double @ 0x007EDA40
  const c4 = f64FromBits(0x3e10000000100000n); // 4/(2^32-1) @ 0x007EDA38

  // 就近舍入：乘积回到整数边界，ftol 取到 n → 触发重抽
  assert.equal(ftol(maxDraw * c6), 6);
  assert.equal(ftol(maxDraw * c4), 4);

  // 截断（已装控制字 0x0E7F 的真实行为）：乘积略小于 n → 不触发
  assert.equal(ftol(chopMul(maxDraw, c6)), 5);
  assert.equal(ftol(chopMul(maxDraw, c4)), 3);
  assert.ok(chopMul(maxDraw, c6) < 6);
});

test('x87 - chop53 对已是 double 的值恒等，截断只在精确运算之后生效', () => {
  // chop53 是对「精确中间结果」的归约；输入本身已是 double 时应为恒等
  assert.equal(chop53(0.5), 0.5);
  assert.equal(chop53(1.2), 1.2);
  assert.equal(chop53(-3.25), -3.25);
  // 精确可表示的运算，截断与就近舍入结果相同
  assert.equal(chopMul(0.5, 0.25), 0.5 * 0.25);
  assert.equal(chopMul(-1.2, 2), -1.2 * 2);
  assert.equal(chopMul(3, 7), 21);
  // 超过 53 位的精确积才会分离：结果必须是精确值的向零截断
  const exactProduct = 0.1 * 3; // 就近舍入
  const truncated = chopMul(0.1, 3);
  assert.ok(Math.abs(truncated - 0.3) < 1e-16);
  assert.ok(Math.abs(exactProduct - 0.3) < 1e-16);
  assert.notEqual(f64ToBits(truncated), f64ToBits(exactProduct));
  assert.equal(f64ToBits(truncated), 0x3fd3333333333333n);
});

test('x87 - ftol 向零截断（不是四舍五入）', () => {
  assert.equal(ftol(5.999999999), 5);
  assert.equal(ftol(-5.999999999), -5);
  assert.equal(ftol(6.0), 6);
});

test('x87 - gamemdSqrt 是表近似（明显粗于 IEEE sqrt）', () => {
  // 报告实测：sqrt(1e-6) 在原生里返回 0.0009999456 而不是 0.001
  const native = gamemdSqrt(1e-6);
  assert.ok(Math.abs(native - 0.001) > 1e-8, '若与真 sqrt 相同则说明表没生效');
  assert.ok(Math.abs(native - 0.0009999456) < 1e-9, `近似值应为 0.0009999456，实得 ${native}`);
  assert.equal(gamemdSqrt(0), 0);
  // 表只在 2^-14 精度上工作：与真值相对误差应在 1e-4 量级
  for (const v of [1, 2, 3.5, 100, 12345.678]) {
    const rel = Math.abs(gamemdSqrt(v) - Math.sqrt(v)) / Math.sqrt(v);
    assert.ok(rel < 1e-4, `sqrt(${v}) 相对误差过大: ${rel}`);
  }
});

// ---------------------------------------------------------------------------
// 尺寸推导
// ---------------------------------------------------------------------------

test('deriveDimensions - 表端点（2 人与 8 人，Width/Height 档 0 与 3）', () => {
  const base = { ...defaultOptions(), numPlayers: 2, mapType: 1 };
  assert.equal(deriveDimensions({ ...base, width: 0, height: 0 }).genW, 70);
  assert.equal(deriveDimensions({ ...base, width: 3, height: 3 }).genW, 80);

  const p8 = { ...defaultOptions(), numPlayers: 8, mapType: 1 };
  assert.equal(deriveDimensions({ ...p8, width: 0, height: 0 }).genW, 100);
  assert.equal(deriveDimensions({ ...p8, width: 3, height: 3 }).genW, 120);
});

test('deriveDimensions - 派生几何与逆向报告一致', () => {
  const d = deriveDimensions({ ...defaultOptions(), numPlayers: 4, mapType: 1, width: 3, height: 3 });
  assert.equal(d.genW, 80);
  assert.equal(d.mapW, d.genW + 4);
  assert.equal(d.mapH, d.genH + 12);
  assert.deepEqual(d.localSize, [2, 5, d.genW, d.genH]);
  assert.equal(d.diamondMin, d.mapW);
  assert.equal(d.diamondMax, d.mapW + 2 * d.mapH);
  assert.equal(d.linearMapWidth, d.genW + d.genH + 17);
  assert.equal(d.cells, d.mapH * (2 * d.mapW - 1));
});

test('deriveDimensions - 1.2 上限在 0..3 档内不可达，只在手改 .SED 时生效', () => {
  // Width 档 0..3 ⇒ sW 最大约 1.0（3 × 0.33333334），永远到不了 1.2
  const p8 = { ...defaultOptions(), numPlayers: 8, width: 3, height: 3 };
  assert.equal(deriveDimensions({ ...p8, mapType: 1 }).genW, 120);
  assert.equal(deriveDimensions({ ...p8, mapType: 3 }).genW, 120);

  // 手改 .SED 写 Width=9：非 3/4 型被 1.2 截断；3/4 型不截断（外插）
  const wide = { ...p8, width: 9, height: 9 };
  assert.equal(deriveDimensions({ ...wide, mapType: 1 }).genW, 124); // 100 + 1.2·20
  assert.equal(deriveDimensions({ ...wide, mapType: 3 }).genW, 160); // 100 + 3.0·20
});

test('clampOptions - theater 不被 clamp，tiberium 下限是 1', () => {
  const o = clampOptions({
    ...defaultOptions(),
    theater: 99,
    tiberium: 0,
    numPlayers: 1,
    mapType: 9,
    seed: 0x12345,
  });
  assert.equal(o.theater, 99, 'Theater 原生不 clamp');
  assert.equal(o.tiberium, 1);
  assert.equal(o.numPlayers, 2);
  assert.equal(o.mapType, 4);
  assert.equal(o.seed, 0xffff);
});

// ---------------------------------------------------------------------------
// 高斯（容差断言 + 统计匹配率）
// ---------------------------------------------------------------------------

test('RmgGaussian - Box-Muller 与真机向量逐位一致（含 sqrt 表与缓存）', () => {
  const x87 = loadFixture('rmg_x87_vectors.json') as {
    cases: { seed: number; call: number; value_bits: string; value: number }[];
    caveat: string;
  };

  const bySeed = new Map<number, typeof x87.cases>();
  for (const c of x87.cases) {
    if (!bySeed.has(c.seed)) bySeed.set(c.seed, []);
    bySeed.get(c.seed)!.push(c);
  }

  let exact = 0;
  let total = 0;

  for (const [seed, cases] of bySeed) {
    const rng = RmgRng.fromSeed(seed);
    const g = new RmgGaussian();
    for (const c of cases) {
      const mine = f64ToBits(g.next(rng));
      const want = BigInt('0x' + c.value_bits);
      total++;
      if (mine === want) exact++;
      else {
        const ulp = Number(mine > want ? mine - want : want - mine);
        assert.fail(
          `seed=${seed} call=${c.call} 位不一致：${mine.toString(16)} vs ${c.value_bits}（${ulp} ULP）`,
        );
      }
    }
  }

  assert.ok(total >= 16, `应至少跑到 16 个样本，实得 ${total}`);
  assert.equal(exact, total);
  // 注意：这些向量由 unicorn 跑真 gamemd.exe 抓取。unicorn 的 FYL2X 是 QEMU 的软件
  // 近似实现，因此「本实现 == 向量」是必要而非充分证据；真实硬件 FYL2X 的末位差异
  // 需要真机捕获才能排除（这是整条管线唯一未认证环节，见 README）。
});
