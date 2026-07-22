/**
 * Format5 - 分块压缩包装层 - 移植自 C# MapFormat.cs Format5 类
 *
 * Format5 把数据分成 8192 字节的块，每块用 MiniLZO 或 Format80 压缩。
 * 每块前面有 4 字节头：2 字节 size_in（压缩后大小）+ 2 字节 size_out（原始大小）。
 *
 * 用于红警2地图的 IsoMapPack5 / PreviewPack 等段。
 */

import * as Format80 from './format80';
import { compress as lzoCompress, decompressRange as lzoDecompressRange } from './minilzo';

/**
 * 解码 Format5 数据。
 * @param src     压缩数据（包含多个块，每块有 4 字节头）
 * @param dest    目标缓冲区（需预分配足够大小）
 * @param format  5=使用 MiniLZO（默认），80=使用 Format80
 * @returns 写入的字节数
 */
export function decodeInto(src: Uint8Array, dest: Uint8Array, format = 5): number {
    let r = 0;
    let w = 0;
    const w_end = dest.length;

    while (w < w_end) {
        const size_in = src[r] | (src[r + 1] << 8);
        r += 2;
        const size_out = src[r] | (src[r + 1] << 8);
        r += 2;

        if (size_in === 0 || size_out === 0) break;

        if (format === 80) {
            Format80.decodeInto(src, r, dest, w);
        } else {
            lzoDecompressRange(src, r, size_in, dest, w);
        }
        r += size_in;
        w += size_out;
    }
    return w;
}

/**
 * 编码单个段（使用 MiniLZO 压缩）。
 * @param s 原始数据
 * @returns 压缩后的数据
 */
export function encodeSection(s: Uint8Array): Uint8Array {
    return lzoCompress(s);
}

/**
 * 编码 Format5 数据（分块压缩）。
 * @param source 原始数据
 * @param format 5=使用 MiniLZO，80=使用 Format80
 * @returns 压缩后的数据（包含多个块，每块有 4 字节头）
 */
export function encode(source: Uint8Array, format: number): Uint8Array {
    const dest = new Uint8Array(source.length * 2 + 16);
    let srcPos = 0;
    let w = 0;

    while (srcPos < source.length) {
        const cb_in = Math.min(source.length - srcPos, 8192);
        const chunk_in = source.subarray(srcPos, srcPos + cb_in);
        const chunk_out = format === 80 ? Format80.encode(chunk_in) : encodeSection(chunk_in);
        const cb_out = chunk_out.length;

        // 写入 4 字节头：size_out (2) + size_in (2)
        // 注意：C# 代码先写 cb_out 再写 cb_in
        dest[w] = cb_out & 0xff;
        dest[w + 1] = (cb_out >> 8) & 0xff;
        w += 2;
        dest[w] = cb_in & 0xff;
        dest[w + 1] = (cb_in >> 8) & 0xff;
        w += 2;

        // 写入压缩数据
        dest.set(chunk_out, w);
        w += chunk_out.length;

        srcPos += cb_in;
    }

    return dest.subarray(0, w);
}
