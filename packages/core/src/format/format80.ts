/**
 * Format80 编解码 - 移植自 C# MapFormat.cs Format80 类
 *
 * Westwood Format80 是一种简单的 RLE + LZ 压缩格式，用于红警2地图的
 * OverlayPack / OverlayDataPack 段。
 *
 * 命令格式（控制字节 code）：
 *   bit7=0                    → copy: 从 writep-rpos 复制 ((code>>4)+3) 字节
 *   bit7=1, bit6=0, count=0   → 结束
 *   bit7=1, bit6=0, count>0   → literal: 从输入复制 count 字节
 *   bit7=1, bit6=1, count<0x3E→ copy: 从偏移 ReadU16 复制 (count+3) 字节
 *   bit7=1, bit6=1, count=0x3E→ fill: 用 1 字节填充 ReadU16 个
 *   bit7=1, bit6=1, count=0x3F→ copy: 从偏移 ReadU16 复制 ReadU16 个
 */

/** 从 dest[srcIndex..] 复制到 dest[destIndex..]，处理重叠情况 */
function replicatePrevious(dest: Uint8Array, destIndex: number, srcIndex: number, count: number): void {
    if (srcIndex > destIndex) {
        throw new Error(`srcIndex > destIndex  ${srcIndex}  ${destIndex}`);
    }
    if (destIndex - srcIndex === 1) {
        for (let i = 0; i < count; i++) {
            dest[destIndex + i] = dest[destIndex - 1];
        }
    } else {
        for (let i = 0; i < count; i++) {
            dest[destIndex + i] = dest[srcIndex + i];
        }
    }
}

/**
 * 解码 Format80 数据。
 * @param src    压缩数据
 * @param srcStart 压缩数据起始偏移
 * @param dest   目标缓冲区
 * @param destStart 目标起始偏移
 * @returns 写入的字节数
 */
export function decodeInto(src: Uint8Array, srcStart: number, dest: Uint8Array, destStart: number): number {
    let readp = srcStart;
    let destIndex = destStart;

    while (true) {
        const code = src[readp++];

        if ((code & 0x80) === 0) {
            // case 2: copy from previous
            const secondByte = src[readp++];
            const count = ((code & 0x70) >> 4) + 3;
            const rpos = ((code & 0x0f) << 8) + secondByte;
            replicatePrevious(dest, destIndex, destIndex - rpos, count);
            destIndex += count;
        } else if ((code & 0x40) === 0) {
            // case 1: literal copy
            const count = code & 0x3f;
            if (count === 0) {
                return destIndex - destStart;
            }
            for (let i = 0; i < count; i++) {
                dest[destIndex + i] = src[readp + i];
            }
            readp += count;
            destIndex += count;
        } else {
            const count3 = code & 0x3f;
            if (count3 === 0x3e) {
                // case 4: fill
                const count = src[readp] | (src[readp + 1] << 8);
                readp += 2;
                const color = src[readp++];
                for (let end = destIndex + count; destIndex < end; destIndex++) {
                    dest[destIndex] = color;
                }
            } else if (count3 === 0x3f) {
                // case 5: copy from offset (long)
                const count = src[readp] | (src[readp + 1] << 8);
                readp += 2;
                let srcIndex = (src[readp] | (src[readp + 1] << 8)) + destStart;
                readp += 2;
                if (srcIndex >= destIndex) {
                    throw new Error(`srcIndex >= destIndex  ${srcIndex}  ${destIndex}`);
                }
                for (let end = destIndex + count; destIndex < end; destIndex++) {
                    dest[destIndex] = dest[srcIndex++];
                }
            } else {
                // case 3: copy from offset
                const count = count3 + 3;
                let srcIndex = (src[readp] | (src[readp + 1] << 8)) + destStart;
                readp += 2;
                if (srcIndex >= destIndex) {
                    throw new Error(`srcIndex >= destIndex  ${srcIndex}  ${destIndex}`);
                }
                for (let end = destIndex + count; destIndex < end; destIndex++) {
                    dest[destIndex] = dest[srcIndex++];
                }
            }
        }
    }
}

/** 计算 src[offset..] 中连续相同字节的数量（最多 maxCount 个） */
function countSame(src: Uint8Array, offset: number, maxCount: number): number {
    maxCount = Math.min(src.length - offset, maxCount);
    if (maxCount <= 0) return 0;
    const first = src[offset++];
    let count = 1;
    while (count < maxCount && src[offset++] === first) {
        count++;
    }
    return count;
}

/** 将 src[offset..] 的 count 字节以 literal copy 命令写入 output */
function writeCopyBlocks(src: Uint8Array, offset: number, count: number, output: number[], writePos: number): number {
    while (count > 0) {
        const writeNow = Math.min(count, 0x3f);
        output[writePos++] = 0x80 | writeNow;
        for (let i = 0; i < writeNow; i++) {
            output[writePos++] = src[offset + i];
        }
        count -= writeNow;
        offset += writeNow;
    }
    return writePos;
}

/**
 * 编码 Format80 数据（快速脏版本，使用 raw copy + RLE）。
 * @param src 原始数据
 * @returns 压缩后的数据
 */
export function encode(src: Uint8Array): Uint8Array {
    const output: number[] = [];
    let offset = 0;
    const left = src.length;
    let blockStart = 0;

    while (offset < left) {
        const repeatCount = countSame(src, offset, 0xffff);
        if (repeatCount >= 4) {
            // 先写入之前未写的 literal 块
            let wp = writeCopyBlocks(src, blockStart, offset - blockStart, output, output.length);
            output.length = wp;

            // Command 4 (fill): 重复字节 n 次
            output.push(0xfe);
            output.push(repeatCount & 0xff);       // low byte
            output.push((repeatCount >> 8) & 0xff); // high byte
            output.push(src[offset]);               // value

            offset += repeatCount;
            blockStart = offset;
        } else {
            offset++;
        }
    }

    // 写入剩余的 literal 块
    let wp = writeCopyBlocks(src, blockStart, offset - blockStart, output, output.length);
    output.length = wp;

    // 写入终止符
    output.push(0x80);

    return new Uint8Array(output);
}
