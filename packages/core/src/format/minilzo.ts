/**
 * MiniLZO - LZO1X 压缩/解压 - 移植自 C# MapFormat.cs MiniLZO 类
 *
 * LZO1X 是无损压缩算法，用于红警2地图的 IsoMapPack5 / PreviewPack 等段。
 * C# 原版使用 unsafe 指针运算，本实现用 Uint8Array 索引替代。
 *
 * 关键移植点：
 * - C# byte* ip → number ip（整数索引）
 * - C# *(uint*)ip → getU4(ip)（小端序 4 字节读取）
 * - C# *(ushort*)ip → getU2(ip)（小端序 2 字节读取）
 * - C# goto → 标志变量 + continue/break
 * - C# 哈希表 ushort* dict → Uint16Array(1<<14)
 */

// DeBruijn 位表：用于计算 trailing zeros
const MultiplyDeBruijnBitPosition = [
    0, 1, 28, 2, 29, 14, 24, 3, 30, 22, 20, 15, 25, 17, 4, 8,
    31, 27, 13, 23, 21, 19, 16, 7, 26, 12, 18, 6, 11, 5, 10, 9,
];

/** 计算 v 的 trailing zeros（最低设置位的位置） */
function lzo_bitops_ctz32(v: number): number {
    // v 来自 XOR 操作，是 32 位整数
    // v & -v 提取最低设置位（JS 位运算对 32 位整数正确）
    // Math.imul 模拟 uint 乘法截断
    return MultiplyDeBruijnBitPosition[Math.imul(v & -v, 0x077CB531) >>> 27];
}

// ===== 内联的字节读写辅助 =====
// 这些操作在热循环中频繁调用，但为了代码清晰度先实现为函数
// 后续可优化为内联

interface CompressBuffers {
    input: Uint8Array;
    output: Uint8Array;
}

/** 读取 input[pos..pos+3] 的小端 uint32（可能有符号，但用于比较/XOR 没问题） */
function getU4(buf: Uint8Array, pos: number): number {
    return buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16) | (buf[pos + 3] << 24);
}

/** 写入 output[pos..pos+3] 的小端 uint32 */
function setU4(buf: Uint8Array, pos: number, val: number): void {
    buf[pos] = val & 0xff;
    buf[pos + 1] = (val >>> 8) & 0xff;
    buf[pos + 2] = (val >>> 16) & 0xff;
    buf[pos + 3] = (val >>> 24) & 0xff;
}

/** 读取 input[pos..pos+1] 的小端 uint16 */
function getU2(buf: Uint8Array, pos: number): number {
    return buf[pos] | (buf[pos + 1] << 8);
}

/**
 * LZO1X-1 压缩核心 - 移植自 lzo1x_1_compress_core
 *
 * @param input   输入缓冲区
 * @param inStart 输入起始偏移
 * @param inLen   输入长度
 * @param output  输出缓冲区
 * @param outStart 输出起始偏移
 * @param ti      前一次调用遗留的 literal 字节数
 * @param dict    哈希表 Uint16Array(1<<14)
 * @returns { outLen: 输出字节数, remaining: 剩余未压缩字节数 }
 */
export function lzo1x_1_compress_core(
    input: Uint8Array,
    inStart: number,
    inLen: number,
    output: Uint8Array,
    outStart: number,
    ti: number,
    dict: Uint16Array,
): { outLen: number; remaining: number } {
    let ip = inStart;
    let op = outStart;
    const in_end = inStart + inLen;
    const ip_end = inStart + inLen - 20;
    let ii = ip;
    ip += ti < 4 ? 4 - ti : 0;

    let m_pos = 0;
    let m_off = 0;
    let m_len = 0;

    // goto 模拟：
    //   goto literal → 回到循环开头，执行 ip 增量
    //   goto next    → 回到循环开头，跳过 ip 增量
    let skipLiteral = false;

    while (true) {
        if (!skipLiteral) {
            // literal:
            ip += 1 + ((ip - ii) >> 5);
        }
        skipLiteral = false;

        // next:
        if (ip >= ip_end) break;

        const dv = getU4(input, ip);
        const dindex = (Math.imul(0x1824429d, dv) >>> 18) & 0x3fff;
        m_pos = inStart + dict[dindex];
        dict[dindex] = ip - inStart;

        if (dv !== getU4(input, m_pos)) {
            // goto literal
            continue;
        }

        // 找到匹配
        ii -= ti;
        ti = 0;

        {
            const t = ip - ii;
            if (t !== 0) {
                if (t <= 3) {
                    output[op - 2] |= t;
                    setU4(output, op, getU4(input, ii));
                    op += t;
                } else if (t <= 16) {
                    output[op++] = t - 3;
                    setU4(output, op, getU4(input, ii));
                    setU4(output, op + 4, getU4(input, ii + 4));
                    setU4(output, op + 8, getU4(input, ii + 8));
                    setU4(output, op + 12, getU4(input, ii + 12));
                    op += t;
                } else {
                    if (t <= 18) {
                        output[op++] = t - 3;
                    } else {
                        let tt = t - 18;
                        output[op++] = 0;
                        while (tt > 255) {
                            tt -= 255;
                            output[op++] = 0;
                        }
                        output[op++] = tt;
                    }
                    // 大块复制
                    let tt = t;
                    do {
                        setU4(output, op, getU4(input, ii));
                        setU4(output, op + 4, getU4(input, ii + 4));
                        setU4(output, op + 8, getU4(input, ii + 8));
                        setU4(output, op + 12, getU4(input, ii + 12));
                        op += 16;
                        ii += 16;
                        tt -= 16;
                    } while (tt >= 16);
                    if (tt > 0) {
                        do {
                            output[op++] = input[ii++];
                        } while (--tt > 0);
                    }
                }
            }
        }

        m_len = 4;
        {
            let v = getU4(input, ip + m_len) ^ getU4(input, m_pos + m_len);
            if (v === 0) {
                let mLenDone = false;
                do {
                    m_len += 4;
                    v = getU4(input, ip + m_len) ^ getU4(input, m_pos + m_len);
                    if (ip + m_len >= ip_end) {
                        mLenDone = true;
                        break;
                    }
                } while (v === 0);
                if (!mLenDone) {
                    m_len += lzo_bitops_ctz32(v) >>> 3;
                }
            } else {
                m_len += lzo_bitops_ctz32(v) >>> 3;
            }
        }

        // m_len_done:
        m_off = ip - m_pos;
        ip += m_len;
        ii = ip;

        if (m_len <= 8 && m_off <= 0x0800) {
            m_off -= 1;
            output[op++] = ((m_len - 1) << 5) | ((m_off & 7) << 2);
            output[op++] = m_off >> 3;
        } else if (m_off <= 0x4000) {
            m_off -= 1;
            if (m_len <= 33) {
                output[op++] = 32 | (m_len - 2);
            } else {
                m_len -= 33;
                output[op++] = 32 | 0;
                while (m_len > 255) {
                    m_len -= 255;
                    output[op++] = 0;
                }
                output[op++] = m_len;
            }
            output[op++] = m_off << 2;
            output[op++] = m_off >> 6;
        } else {
            m_off -= 0x4000;
            if (m_len <= 9) {
                output[op++] = 16 | ((m_off >> 11) & 8) | (m_len - 2);
            } else {
                m_len -= 9;
                output[op++] = 16 | ((m_off >> 11) & 8);
                while (m_len > 255) {
                    m_len -= 255;
                    output[op++] = 0;
                }
                output[op++] = m_len;
            }
            output[op++] = m_off << 2;
            output[op++] = m_off >> 6;
        }

        // goto next（跳过 literal 增量）
        skipLiteral = true;
    }

    const out_len = op - outStart;
    const remaining = in_end - (ii - ti);
    return { outLen: out_len, remaining };
}

/**
 * LZO1X-1 压缩（外层）- 移植自 lzo1x_1_compress
 *
 * 分块调用 compress_core，然后处理剩余的 literal 字节。
 * @returns 压缩后的字节数
 */
function lzo1x_1_compress(
    input: Uint8Array,
    inLen: number,
    output: Uint8Array,
    dict: Uint16Array,
): number {
    let ip = 0;
    let op = 0;
    let l = inLen;
    let t = 0;

    while (l > 20) {
        let ll = Math.min(l, 49152);
        const ll_end = ip + ll;
        // 溢出检查（C#: ll_end + ((t+ll)>>5) <= ll_end || ...）
        if (ll_end + ((t + ll) >> 5) <= ll_end) {
            break;
        }

        // 清零哈希表
        dict.fill(0);

        const result = lzo1x_1_compress_core(input, ip, ll, output, op, t, dict);
        ip += ll;
        op += result.outLen;
        l -= ll;
        t = result.remaining;
    }

    t += l;

    if (t > 0) {
        let ii = inLen - t;
        if (op === 0 && t <= 238) {
            output[op++] = 17 + t;
        } else if (t <= 3) {
            output[op - 2] |= t;
        } else if (t <= 18) {
            output[op++] = t - 3;
        } else {
            let tt = t - 18;
            output[op++] = 0;
            while (tt > 255) {
                tt -= 255;
                output[op++] = 0;
            }
            output[op++] = tt;
        }
        do {
            output[op++] = input[ii++];
        } while (--t > 0);
    }

    output[op++] = 16 | 1;
    output[op++] = 0;
    output[op++] = 0;

    return op;
}

/**
 * LZO1X 解压 - 移植自 lzo1x_decompress
 *
 * 控制流说明（C# goto → TS 标志变量）：
 *   goto first_literal_run → gt_first_literal_run 标志
 *   goto match → enterMatch 标志
 *   goto match_done → skipCopy 标志（跳过 copy_match 部分）
 *   goto eof_found → 直接 return
 *
 * @param src      压缩数据
 * @param srcStart 压缩数据起始偏移
 * @param srcLen   压缩数据长度
 * @param dst      输出缓冲区
 * @param dstStart 输出起始偏移
 * @returns { outLen: 解压字节数, ret: 0=成功 }
 */
export function lzo1x_decompress(
    src: Uint8Array,
    srcStart: number,
    srcLen: number,
    dst: Uint8Array,
    dstStart: number,
): { outLen: number; ret: number } {
    let ip = srcStart;
    let op = dstStart;
    const ip_end = srcStart + srcLen;
    let t = 0;
    let m_pos = 0;

    let gt_first_literal_run = false;
    let gt_match_done = false;

    // 初始 literal run
    if (src[ip] > 17) {
        t = src[ip++] - 17;
        if (t < 4) {
            // match_next: copy t bytes then read new t
            do {
                dst[op++] = src[ip++];
            } while (--t > 0);
            t = src[ip++];
            // fall through to main loop (gt_first_literal_run = false)
        } else {
            do {
                dst[op++] = src[ip++];
            } while (--t > 0);
            gt_first_literal_run = true;
        }
    }

    let enterMatch = false;

    outer: while (true) {
        if (!enterMatch && !gt_first_literal_run) {
            // 主循环：读取 t
            t = src[ip++];
            if (t >= 16) {
                enterMatch = true;
                gt_match_done = false;
            } else {
                // literal run (t < 16)
                if (t === 0) {
                    while (src[ip] === 0) {
                        t += 255;
                        ip++;
                    }
                    t += 15 + src[ip++];
                }
                // copy 4+t bytes (t is count beyond the first 4)
                setU4(dst, op, getU4(src, ip));
                op += 4;
                ip += 4;
                if (--t > 0) {
                    if (t >= 4) {
                        do {
                            setU4(dst, op, getU4(src, ip));
                            op += 4;
                            ip += 4;
                            t -= 4;
                        } while (t >= 4);
                        if (t > 0) {
                            do {
                                dst[op++] = src[ip++];
                            } while (--t > 0);
                        }
                    } else {
                        do {
                            dst[op++] = src[ip++];
                        } while (--t > 0);
                    }
                }
                // goto first_literal_run
                gt_first_literal_run = true;
                continue;
            }
        }

        if (enterMatch) {
            enterMatch = false;
            // gt_match_done 已在设置 enterMatch 时设好
        } else {
            // first_literal_run:
            gt_first_literal_run = false;
            t = src[ip++];
            if (t >= 16) {
                gt_match_done = false;
            } else {
                // short match (t < 16)
                m_pos = op - (1 + 0x0800);
                m_pos -= t >> 2;
                m_pos -= src[ip++] << 2;
                dst[op++] = dst[m_pos++];
                dst[op++] = dst[m_pos++];
                dst[op++] = dst[m_pos];
                gt_match_done = true;
            }
        }

        // match: do { ... } while (true)
        matchLoop: while (true) {
            let skipCopy = false;

            if (gt_match_done) {
                gt_match_done = false;
                skipCopy = true;
            } else if (t >= 64) {
                // match type 1
                m_pos = op - 1;
                m_pos -= (t >> 2) & 7;
                m_pos -= src[ip++] << 3;
                t = (t >> 5) - 1;
                // copy_match (t>=64 专用，已内联)
                dst[op++] = dst[m_pos++];
                dst[op++] = dst[m_pos++];
                do {
                    dst[op++] = dst[m_pos++];
                } while (--t > 0);
                skipCopy = true; // goto match_done
            } else if (t >= 32) {
                // match type 2
                t &= 31;
                if (t === 0) {
                    while (src[ip] === 0) {
                        t += 255;
                        ip++;
                    }
                    t += 31 + src[ip++];
                }
                m_pos = op - 1;
                m_pos -= getU2(src, ip) >> 2;
                ip += 2;
                // fall through to copy_match
            } else if (t >= 16) {
                // match type 3
                m_pos = op;
                m_pos -= (t & 8) << 11;
                t &= 7;
                if (t === 0) {
                    while (src[ip] === 0) {
                        t += 255;
                        ip++;
                    }
                    t += 7 + src[ip++];
                }
                m_pos -= getU2(src, ip) >> 2;
                ip += 2;
                if (m_pos === op) {
                    // goto eof_found
                    break outer;
                }
                m_pos -= 0x4000;
                // fall through to copy_match
            } else {
                // match type 4 (t < 16)
                m_pos = op - 1;
                m_pos -= t >> 2;
                m_pos -= src[ip++] << 2;
                dst[op++] = dst[m_pos++];
                dst[op++] = dst[m_pos];
                skipCopy = true; // goto match_done
            }

            if (!skipCopy) {
                // copy_match (t>=32 和 t>=16 到达)
                if (t >= 2 * 4 - (3 - 1) && op - m_pos >= 4) {
                    // 快速 4 字节复制
                    setU4(dst, op, getU4(dst, m_pos));
                    op += 4;
                    m_pos += 4;
                    t -= 4 - (3 - 1);
                    do {
                        setU4(dst, op, getU4(dst, m_pos));
                        op += 4;
                        m_pos += 4;
                        t -= 4;
                    } while (t >= 4);
                    if (t > 0) {
                        do {
                            dst[op++] = dst[m_pos++];
                        } while (--t > 0);
                    }
                } else {
                    // 逐字节复制
                    dst[op++] = dst[m_pos++];
                    dst[op++] = dst[m_pos++];
                    do {
                        dst[op++] = dst[m_pos++];
                    } while (--t > 0);
                }
            }

            // match_done:
            t = src[ip - 2] & 3;
            if (t === 0) {
                break; // break matchLoop, back to outer
            }
            // match_next:
            dst[op++] = src[ip++];
            if (t > 1) {
                dst[op++] = src[ip++];
                if (t > 2) {
                    dst[op++] = src[ip++];
                }
            }
            t = src[ip++];
        }
        // matchLoop 结束，回到 outer
    }

    // eof_found:
    const out_len = op - dstStart;
    const ret = ip === ip_end ? 0 : ip < ip_end ? -8 : -4;
    return { outLen: out_len, ret };
}

// ===== 公开 API =====

/**
 * 解压 LZO 数据
 * @param input  压缩数据
 * @param output 输出缓冲区（需预分配足够大小）
 * @returns output
 */
export function decompress(input: Uint8Array, output: Uint8Array): Uint8Array {
    lzo1x_decompress(input, 0, input.length, output, 0);
    return output;
}

/**
 * 解压 LZO 数据（指定输入范围）
 * @param src       压缩数据
 * @param srcStart  起始偏移
 * @param srcLen    压缩长度
 * @param dst       输出缓冲区
 * @param dstStart  输出起始偏移
 * @returns 解压写入的字节数
 */
export function decompressRange(
    src: Uint8Array,
    srcStart: number,
    srcLen: number,
    dst: Uint8Array,
    dstStart: number,
): number {
    const result = lzo1x_decompress(src, srcStart, srcLen, dst, dstStart);
    return result.outLen;
}

/**
 * 压缩数据
 * @param input 原始数据
 * @returns 压缩后的数据
 */
export function compress(input: Uint8Array): Uint8Array {
    const outLen = input.length + (input.length >> 4) + 64 + 3;
    const output = new Uint8Array(outLen);
    const dict = new Uint16Array(1 << 14);
    const written = lzo1x_1_compress(input, input.length, output, dict);
    return output.subarray(0, written);
}
