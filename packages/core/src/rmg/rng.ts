/**
 * RMG 随机数发生器 —— gamemd 的 `g_MapGenRng`
 *
 * 逆向结论（目标 gamemd.exe YR 1.001）：
 *
 *   结构（1012 字节 = 253 dword）：
 *     +0x00 u8   locked（1 = 禁用，next() 直接返回 0）
 *     +0x01..+0x03 pad
 *     +0x04 u32  idxA（r）
 *     +0x08 u32  idxB（s）
 *     +0x0C u32  state[250]
 *
 *   `Random__Seed @ 0x0065C6D0`：把 250 个 dword 用「每输出一个字做 4 轮混合」的
 *   自研哈希填满（不是 LCG、不是 MT），然后把 locked 清零。
 *   每轮的算术（由机器码逐条还原）：
 *       y  = T1[k] ^ x
 *       hi = sar(y, 16) ; lo = y & 0xFFFF
 *       t  = lo*lo + ~(hi*hi)            // 即 lo² − hi² − 1（mod 2^32）
 *       m  = sar(t, 16) | (t << 16)      // 折叠（不是纯旋转：t<0 时高位补 1）
 *       x' = ((m ^ T2[k+1]) + hi*lo) ^ p
 *       p  = 上一轮的 x（第 1 轮 p = seed）
 *
 *   `Random__Next @ 0x0065C780`：Lag-250 的 XOR 型 lagged-Fibonacci
 *       state[r] ^= state[s] ; v = state[r] ; r++/s++ 到 250 归零 ; return v
 *       返回值是**原始 u32**，无掩码、无取模；区间归约全部由调用方用浮点做。
 *
 *   `RandomRanged @ 0x0065C7E0`：整数区间，闭区间 [min,max]，最高位置位 + 掩码拒绝采样。
 *
 * 生成器全程只抽这一条流（`g_MapGenRng @ 0x00ABE890`），
 * 与 `g_MainRng(0x00886B88)` / `Scen->Random` 完全独立。
 */

import {
  chopAdd,
  chopDiv,
  chopMul,
  chopSub,
  gamemdSqrt,
  nextUnit,
  x87Ln,
} from './x87';

export const STATE_LEN = 250;

/** 种子哈希的常数表 1（`0x00839644..0x00839650`） */
const T1 = new Uint32Array([0xbaa96887, 0x1e17d32c, 0x03bcdc3c, 0x0f33d1b2]);

/**
 * 种子哈希的常数表 2（`0x00839690..`）。
 * 下标 0 (`0x48AAD7E4`) 因 `ADD EBX,4` 预自增而**永不被消费**，保留以对齐原生下标。
 * 实际消费的是下标 1..4。
 */
const T2 = new Uint32Array([
  0x48aad7e4, 0x4b0f3b58, 0xe874f0c3, 0x6955c5a6, 0x55a7ca46,
]);

/** 用种子填满 250 个状态字（`Random__Seed @ 0x0065C6D0`） */
export function seedState(
  seed: number,
  out = new Uint32Array(STATE_LEN),
): Uint32Array {
  const s = seed >>> 0;
  for (let i = 0; i < STATE_LEN; i++) {
    let x = i >>> 0;
    let p = s;
    for (let k = 0; k < 4; k++) {
      const y = (T1[k] ^ x) >>> 0;
      const hi = (y | 0) >> 16; // SAR：算术右移
      const lo = y & 0xffff;
      const t = (Math.imul(lo, lo) - Math.imul(hi, hi) - 1) >>> 0;
      const fold = (((t | 0) >> 16) | (t << 16)) >>> 0;
      const nx = ((((fold ^ T2[k + 1]) >>> 0) + Math.imul(hi, lo)) >>> 0) ^ p;
      p = x;
      x = nx >>> 0;
    }
    out[i] = x;
  }
  return out;
}

/**
 * 生成器 RNG。每次 `RandomMapGenerator__Generate` 都会用 `MapSeed+0x74`
 * （clamp 到 0..0xFFFF）重新播种，然后整份拷贝进全局。
 */
export class RmgRng {
  /** +0x00：1 = 禁用（next 返回 0）。播种后恒为 0 */
  locked = 0;
  /** +0x04 */
  idxA = 0;
  /** +0x08 */
  idxB = 103;
  /** +0x0C */
  readonly state = new Uint32Array(STATE_LEN);

  private constructor() {}

  /** 由 16 位种子构造（等价于 `Random__Seed` + 拷贝到全局） */
  static fromSeed(seed: number): RmgRng {
    const rng = new RmgRng();
    rng.reseed(seed);
    return rng;
  }

  reseed(seed: number): void {
    seedState(seed >>> 0, this.state);
    this.locked = 0;
    this.idxA = 0;
    this.idxB = 103;
  }

  /** `Random__Next @ 0x0065C780`：返回原始 u32 */
  next(): number {
    if (this.locked !== 0) return 0;
    let r = this.idxA;
    let s = this.idxB;
    this.state[r] = (this.state[r] ^ this.state[s]) >>> 0;
    const v = this.state[r];
    if (++r >= STATE_LEN) r = 0;
    if (++s >= STATE_LEN) s = 0;
    this.idxA = r;
    this.idxB = s;
    return v >>> 0;
  }

  /** `next_unit()`：`0x00598000` —— 原始抽取 × K（截断乘法） */
  nextUnit(): number {
    return nextUnit(this.next());
  }
}

/**
 * `RandomRanged @ 0x0065C7E0` —— 闭区间整数随机。
 *
 * 注意两个容易改错的地方：
 *   1. `min === max` 时**不消耗任何抽取**（early-out）；
 *   2. 是「最高位置位 + 掩码 + 拒绝」，不是取模；即使 span 是 2 的幂也会拒绝。
 */
export function randomRanged(rng: RmgRng, min: number, max: number): number {
  if (min === max) return min;
  let lo = min;
  let hi = max;
  if (lo > hi) {
    const t = lo;
    lo = hi;
    hi = t;
  }
  const span = (hi - lo) >>> 0;
  const msb = 31 - Math.clz32(span);
  const mask = msb >= 31 ? 0xffffffff : ((1 << (msb + 1)) - 1) >>> 0;
  let v: number;
  do {
    v = (rng.next() & mask) >>> 0;
  } while (v > span);
  return lo + v;
}

/**
 * 高斯抽样 —— `NextGaussian 0x005980C0`（Box-Muller，缓存第二个值）。
 *
 * 抽数契约：缓存命中 = 0 抽；每次成功生成消耗 2 抽；拒绝（r²>=1 或 r²==0）再消耗 2 抽。
 * 缓存状态在原生里位于全局控制块 `0x00ABDFB8`，每次 Generate 重置 → 这里做成实例。
 */
export class RmgGaussian {
  private hasSpare = false;
  private spare = 0;

  reset(): void {
    this.hasSpare = false;
    this.spare = 0;
  }

  /** 返回一个标准正态样本 */
  next(rng: RmgRng): number {
    if (this.hasSpare) {
      this.hasSpare = false;
      return this.spare;
    }
    let x = 0;
    let y = 0;
    let r2 = 0;
    for (;;) {
      x = chopSub(chopMul(2, rng.nextUnit()), 1);
      y = chopSub(chopMul(2, rng.nextUnit()), 1);
      r2 = chopAdd(chopMul(y, y), chopMul(x, x)); // 先 y*y 再 + x*x
      if (!(r2 < 1) || r2 === 0) continue; // r2>=1 或 r2==0 → 重抽（各 2 抽）
      break;
    }
    const lnR2 = x87Ln(r2);
    const t = chopDiv(chopSub(chopSub(0, lnR2), lnR2), r2); // (-ln - ln) / r2
    const scale = gamemdSqrt(t);
    this.spare = chopMul(scale, y);
    this.hasSpare = true;
    return chopMul(scale, x);
  }
}

/**
 * 抽数记账：包住 rng.next，统计本阶段消耗了多少抽。
 * 阶段契约里「每阶段抽数」是可断言的不变量——这是发现错位最便宜的手段。
 */
export function countDraws(rng: RmgRng): { count: () => number; reset: () => void } {
  let n = 0;
  const orig = rng.next.bind(rng);
  rng.next = () => {
    n++;
    return orig();
  };
  return { count: () => n, reset: () => (n = 0) };
}
