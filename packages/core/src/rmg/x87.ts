/**
 * x87 定点语义层 —— gamemd 随机地图生成器的浮点契约
 *
 * 背景（逆向结论，目标二进制 gamemd.exe YR 1.001）：
 *   - 进程内第一次调用 CRT 的 float→int 转换 `_ftol2 @ 0x007C5F00` 时，会把 x87
 *     控制字 FLDCW 成常量 `0x00822D80 = 0x0E7F`，并且**永不复原**：
 *       精度控制 PC = 10b → 53 位（double）
 *       舍入控制 RC = 11b → 向零截断
 *   - 因此生成器里的每一次 FMUL/FADD/FSUB/FDIV 都是「53 位 + 截断」，
 *     而 JS 的 `*` `+` `-` `/` 一律就近舍入(round-to-nearest-even)。
 *   - `sqrt` 不是 FSQRT，而是 `0x004CAC40` 的表驱动近似（精度约 2^-14）。
 *
 * 本模块用 BigInt 做「精确运算后再按 53 位向零截断」，从而在 JS 里复现该语义。
 *
 * 已知保真度限制：
 *   - add/sub 在真实 x87 上是对齐到 64 位有效位后再相加（极小加数可能先被截），
 *     本实现是「精确求和后再截断」。对 RMG 的实际取值范围（0.001 ~ 1e7）无差异，
 *     但与真实硬件在极端指数差下可能差末尾一位。乘法与除法是精确的。
 *   - 非规格化数/极端指数未覆盖（RMG 不会产生）。
 */

/** 双精度有效位（含隐式位） */
const MANT_BITS = 53;

export interface Decomposed {
  neg: boolean;
  /** 尾数（整数，值为 (-1)^neg · m · 2^e） */
  m: bigint;
  e: number;
}

const buf = new DataView(new ArrayBuffer(8));

/** 拆解 double 为 (-1)^neg · m · 2^e */
export function decompose(x: number): Decomposed {
  buf.setFloat64(0, x);
  const hi = buf.getUint32(0);
  const lo = buf.getUint32(4);
  const neg = (hi >>> 31) === 1;
  const exp = (hi >>> 20) & 0x7ff;
  const frac = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  if (exp === 0) {
    // 零或非规格化
    return { neg, m: frac, e: -1074 };
  }
  return { neg, m: frac | (1n << 52n), e: exp - 1075 };
}

function bitLength(v: bigint): number {
  return v === 0n ? 0 : v.toString(2).length;
}

/** 由 (-1)^neg · m · 2^e 组装 double，并按 53 位向零截断 */
export function compose(neg: boolean, m: bigint, e: number): number {
  if (m === 0n) return neg ? -0 : 0;
  const bits = bitLength(m);
  if (bits > MANT_BITS) {
    const drop = bits - MANT_BITS;
    m >>= BigInt(drop);
    e += drop;
  }
  // 此时 m < 2^53，Number(m) 精确；乘以 2 的整数次幂在正常范围内是精确的
  const v = Number(m) * Math.pow(2, e);
  return neg ? -v : v;
}

/** 向零截断到 53 位（x87 PC=53 + RC=truncate 的结果语义） */
export function chop53(x: number): number {
  if (!Number.isFinite(x) || x === 0) return x;
  const d = decompose(x);
  return compose(d.neg, d.m, d.e);
}

/** 截断语义的乘法（x87 `FMUL`，PC=53 / RC=11） */
export function chopMul(a: number, b: number): number {
  if (a === 0 || b === 0) return a * b;
  const A = decompose(a);
  const B = decompose(b);
  return compose(A.neg !== B.neg, A.m * B.m, A.e + B.e);
}

/** 截断语义的加法（x87 `FADD`） */
export function chopAdd(a: number, b: number): number {
  if (a === 0) return b;
  if (b === 0) return a;
  const A = decompose(a);
  const B = decompose(b);
  const e = Math.min(A.e, B.e);
  const am = A.neg ? -(A.m << BigInt(A.e - e)) : A.m << BigInt(A.e - e);
  const bm = B.neg ? -(B.m << BigInt(B.e - e)) : B.m << BigInt(B.e - e);
  const s = am + bm;
  return compose(s < 0n, s < 0n ? -s : s, e);
}

/** 截断语义的减法（x87 `FSUB`） */
export function chopSub(a: number, b: number): number {
  return chopAdd(a, -b);
}

/** 截断语义的除法（x87 `FDIV`） */
export function chopDiv(a: number, b: number): number {
  if (b === 0) return a / b;
  if (a === 0) return a;
  const A = decompose(a);
  const B = decompose(b);
  // 取 64 位保护位求商，保证高 53 位精确
  const GUARD = 64n;
  const q = (A.m << GUARD) / B.m;
  return compose(A.neg !== B.neg, q, A.e - B.e - Number(GUARD));
}

/**
 * x87 的 `_ftol2 @ 0x007C5F00` —— 向零截断的 float→int。
 * 注意：该函数同时是「安装 0x0E7F 控制字」的那一处（永不复原）。
 */
export function ftol(x: number): number {
  return Math.trunc(x) | 0;
}

/**
 * 区间归约常数 `0x007ED898`。
 *
 * 位模式 `0x3DF0000000100000` = 2^-32 + 2^-64
 * （**精确等于** fl64(1/(2^32-1))，但**不等于** 2^-32）。
 * 逆向报告里三种描述（"2^-32"、"~2^-32"、"1/(2^32-1)"）指的是同一个位模式；
 * 注意 `1/4294967296` 不是它，用它会让整数区间归约差一个 ULP。
 */
export const RANGE_K = 2.3283064370807974e-10;

/** 常用常数的位模式（供「必须按位抄」的场合使用） */
export const FP_BITS = {
  /** 0.005 @ 0x007ED7F0 / 0x007E44E8 */
  P_0005: 0x3f747ae147ae147bn,
  /** 0.001 @ 0x007ED7F8 */
  P_0001: 0x3f50624dd2f1a9fcn,
  /** 0.0025 @ 0x007EDAA0 */
  P_0025: 0x3f647ae147ae147bn,
  /** 0.1 @ 0x007E3860 */
  P_01: 0x3fb999999999999an,
  /** 0.025 @ 0x007ED7C8 */
  P_0025_: 0x3f9999999999999an,
  /** 0.7 @ design ledger */
  P_07: 0x3fe6666666666666n,
  /** 2.5 / 1.5 / 0.15 —— 区域分裂代价权重 */
  W_25: 0x4004000000000000n,
  W_15: 0x3ff8000000000000n,
  W_015: 0x3fc3333333333333n,
} as const;

export function f64FromBits(bits: bigint): number {
  buf.setBigUint64(0, bits);
  return buf.getFloat64(0);
}

export function f64ToBits(x: number): bigint {
  buf.setFloat64(0, x);
  return buf.getBigUint64(0);
}

// ---------------------------------------------------------------------------
// 近似 sqrt（`0x004CAC40`）—— 不是 FSQRT
// ---------------------------------------------------------------------------

/**
 * 表项推导：表在二进制里位于 `0x008650BC`，16384 项 × 4 字节，只存结果尾数。
 *
 *   index <  8192 :  m = 1 + index/8192            （偶指数，m ∈ [1,2)）
 *   index >= 8192 :  m = 2 * (1 + (index-8192)/8192)（奇指数，m ∈ [2,4)）
 *   table[index]  = trunc((sqrt(m) - 1) * 2^23)
 *
 * 表不落盘、按需算（二进制里的表是游戏数据，不进本仓库）。
 */
const sqrtTable = new Int32Array(16384);
for (let i = 0; i < 16384; i++) {
  const m = i < 8192 ? 1 + i / 8192 : 2 * (1 + (i - 8192) / 8192);
  sqrtTable[i] = Math.trunc((Math.sqrt(m) - 1) * 8388608); // 2^23
}

/**
 * `0x004CAC40` 的表驱动近似平方根。
 *
 * 关键点：输入先被降为 float32（丢掉 ~2^-24 以下的信息），结果是 float32，
 * 精度只有约 2^-14。用 `Math.sqrt` 会准 29 个 bit 以上，会让山丘与补丁尺寸走偏。
 */
export function gamemdSqrt(x: number): number {
  if (!(x > 0)) return x; // 0 / 负数：按原值返回（原生对 0 有早退）
  const f = Math.fround(x);
  buf.setFloat32(0, f);
  const bits = buf.getUint32(0);
  let mantissa = bits & 0x7fffff;
  let exp = bits >>> 23;
  exp = exp - 0x7f;
  if ((exp & 1) === 1) mantissa |= 0x800000;
  exp = (exp << 16 >> 16) >> 1; // 16 位算术右移一位（与原生 SAR AX,1 一致）
  const index = mantissa >>> 10;
  exp = exp + 0x7f;
  buf.setFloat32(0, 0);
  buf.setUint32(0, (sqrtTable[index] + (exp << 23)) >>> 0);
  return buf.getFloat32(0);
}

// ---------------------------------------------------------------------------
// 高斯（Box-Muller，`0x005980C0`）
// ---------------------------------------------------------------------------

/** `NextUniformRange 0x00598030`：先乘跨度再乘 K，最后加 min，逐次截断 */
export function nextUniformRange(
  draw: number,
  min: number,
  max: number,
): number {
  const span = chopAdd(chopSub(max, min), 1);
  const t = chopMul(draw, span);
  const u = chopMul(t, RANGE_K);
  return ftol(chopAdd(u, min));
}

/** `next_unit()`：`0x00598000` = (double)draw × K，乘法截断 */
export function nextUnit(draw: number): number {
  return chopMul(draw, RANGE_K);
}

/** 单位区间内归一化的 `ln`：x87 `FYL2X(ln2, x)`。
 *
 * 已知限制：本机用 Math.log（正确舍入到 ~1ulp），真实 x87 FYL2X 是硬件近似表，
 * 末几位可能不同。这一项是整条链里唯一未被认证的环节（见 README）。 */
export function x87Ln(x: number): number {
  return Math.log(x);
}
