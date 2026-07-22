/**
 * 压缩算法测试 - Format80 / MiniLZO / Format5
 */
import * as assert from 'assert';
import * as Format80 from '../format/format80';
import * as MiniLZO from '../format/minilzo';
import * as Format5 from '../format/format5';

// ===== Format80 测试 =====

function testFormat80Roundtrip(): void {
    // 测试1: 简单数据
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const encoded = Format80.encode(data);
    const decoded = new Uint8Array(data.length);
    const written = Format80.decodeInto(encoded, 0, decoded, 0);
    assert.strictEqual(written, data.length, 'Format80: written length mismatch');
    assert.deepStrictEqual(Array.from(decoded), Array.from(data), 'Format80: data mismatch');
}

function testFormat80Empty(): void {
    // 测试2: 空数据
    const data = new Uint8Array(0);
    const encoded = Format80.encode(data);
    const decoded = new Uint8Array(0);
    const written = Format80.decodeInto(encoded, 0, decoded, 0);
    assert.strictEqual(written, 0, 'Format80: empty data written should be 0');
}

function testFormat80Repeated(): void {
    // 测试3: 重复字节（RLE 压缩）
    const data = new Uint8Array(1000);
    data.fill(42);
    const encoded = Format80.encode(data);
    const decoded = new Uint8Array(data.length);
    const written = Format80.decodeInto(encoded, 0, decoded, 0);
    assert.strictEqual(written, data.length, 'Format80: repeated data written mismatch');
    assert.deepStrictEqual(Array.from(decoded), Array.from(data), 'Format80: repeated data mismatch');
    // 压缩后应该比原始数据小很多
    assert.ok(encoded.length < data.length, `Format80: should compress repeated data (${encoded.length} < ${data.length})`);
}

function testFormat80Random(): void {
    // 测试4: 随机数据
    const data = new Uint8Array(500);
    for (let i = 0; i < data.length; i++) {
        data[i] = Math.floor(Math.random() * 256);
    }
    const encoded = Format80.encode(data);
    const decoded = new Uint8Array(data.length);
    const written = Format80.decodeInto(encoded, 0, decoded, 0);
    assert.strictEqual(written, data.length, 'Format80: random data written mismatch');
    assert.deepStrictEqual(Array.from(decoded), Array.from(data), 'Format80: random data mismatch');
}

function testFormat80LargeWithRepeats(): void {
    // 测试5: 大数据，有重复模式
    const data = new Uint8Array(10000);
    for (let i = 0; i < data.length; i++) {
        data[i] = i % 7; // 每 7 字节重复一次
    }
    const encoded = Format80.encode(data);
    const decoded = new Uint8Array(data.length);
    const written = Format80.decodeInto(encoded, 0, decoded, 0);
    assert.strictEqual(written, data.length, 'Format80: pattern data written mismatch');
    assert.deepStrictEqual(Array.from(decoded), Array.from(data), 'Format80: pattern data mismatch');
}

// ===== MiniLZO 测试 =====

function testMiniLZORoundtrip(): void {
    // 测试1: 简单数据
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const compressed = MiniLZO.compress(data);
    const decompressed = new Uint8Array(data.length);
    const result = MiniLZO.lzo1x_decompress(compressed, 0, compressed.length, decompressed, 0);
    assert.strictEqual(result.ret, 0, `MiniLZO: decompress failed with ret=${result.ret}`);
    assert.strictEqual(result.outLen, data.length, 'MiniLZO: outLen mismatch');
    assert.deepStrictEqual(Array.from(decompressed), Array.from(data), 'MiniLZO: data mismatch');
}

function testMiniLZOEmpty(): void {
    // 测试2: 空数据
    const data = new Uint8Array(0);
    const compressed = MiniLZO.compress(data);
    const decompressed = new Uint8Array(0);
    const result = MiniLZO.lzo1x_decompress(compressed, 0, compressed.length, decompressed, 0);
    // 空数据可能有特殊情况，主要验证不崩溃
}

function testMiniLZOSmall(): void {
    // 测试3: 小数据（< 20 字节，不触发核心压缩）
    const data = new Uint8Array([10, 20, 30, 40, 50]);
    const compressed = MiniLZO.compress(data);
    const decompressed = new Uint8Array(data.length);
    const result = MiniLZO.lzo1x_decompress(compressed, 0, compressed.length, decompressed, 0);
    assert.strictEqual(result.ret, 0, `MiniLZO: small data decompress failed with ret=${result.ret}`);
    assert.strictEqual(result.outLen, data.length, 'MiniLZO: small data outLen mismatch');
    assert.deepStrictEqual(Array.from(decompressed), Array.from(data), 'MiniLZO: small data mismatch');
}

function testMiniLZORepeated(): void {
    // 测试4: 重复数据（高度可压缩）
    const data = new Uint8Array(1000);
    data.fill(42);
    const compressed = MiniLZO.compress(data);
    const decompressed = new Uint8Array(data.length);
    const result = MiniLZO.lzo1x_decompress(compressed, 0, compressed.length, decompressed, 0);
    assert.strictEqual(result.ret, 0, `MiniLZO: repeated data decompress failed with ret=${result.ret}`);
    assert.strictEqual(result.outLen, data.length, 'MiniLZO: repeated data outLen mismatch');
    assert.deepStrictEqual(Array.from(decompressed), Array.from(data), 'MiniLZO: repeated data mismatch');
    assert.ok(compressed.length < data.length, `MiniLZO: should compress repeated data (${compressed.length} < ${data.length})`);
}

function testMiniLZORandom(): void {
    // 测试5: 随机数据（不可压缩）
    const data = new Uint8Array(500);
    for (let i = 0; i < data.length; i++) {
        data[i] = Math.floor(Math.random() * 256);
    }
    const compressed = MiniLZO.compress(data);
    const decompressed = new Uint8Array(data.length);
    const result = MiniLZO.lzo1x_decompress(compressed, 0, compressed.length, decompressed, 0);
    assert.strictEqual(result.ret, 0, `MiniLZO: random data decompress failed with ret=${result.ret}`);
    assert.strictEqual(result.outLen, data.length, 'MiniLZO: random data outLen mismatch');
    assert.deepStrictEqual(Array.from(decompressed), Array.from(data), 'MiniLZO: random data mismatch');
}

function testMiniLZOLargeWithPattern(): void {
    // 测试6: 大数据，有重复模式
    const data = new Uint8Array(10000);
    for (let i = 0; i < data.length; i++) {
        data[i] = i % 13;
    }
    const compressed = MiniLZO.compress(data);
    const decompressed = new Uint8Array(data.length);
    const result = MiniLZO.lzo1x_decompress(compressed, 0, compressed.length, decompressed, 0);
    assert.strictEqual(result.ret, 0, `MiniLZO: pattern data decompress failed with ret=${result.ret}`);
    assert.strictEqual(result.outLen, data.length, 'MiniLZO: pattern data outLen mismatch');
    assert.deepStrictEqual(Array.from(decompressed), Array.from(data), 'MiniLZO: pattern data mismatch');
    assert.ok(compressed.length < data.length, `MiniLZO: should compress pattern data (${compressed.length} < ${data.length})`);
}

function testMiniLZOLarge(): void {
    // 测试7: 大数据（超过 49152 的分块边界）
    const data = new Uint8Array(100000);
    for (let i = 0; i < data.length; i++) {
        // 混合模式：有随机也有重复
        if (i % 100 < 30) {
            data[i] = Math.floor(Math.random() * 256);
        } else {
            data[i] = i % 5;
        }
    }
    const compressed = MiniLZO.compress(data);
    const decompressed = new Uint8Array(data.length);
    const result = MiniLZO.lzo1x_decompress(compressed, 0, compressed.length, decompressed, 0);
    assert.strictEqual(result.ret, 0, `MiniLZO: large data decompress failed with ret=${result.ret}`);
    assert.strictEqual(result.outLen, data.length, 'MiniLZO: large data outLen mismatch');
    assert.deepStrictEqual(Array.from(decompressed), Array.from(data), 'MiniLZO: large data mismatch');
}

// ===== Format5 测试 =====

function testFormat5RoundtripLZO(): void {
    // 测试1: Format5 with LZO (format=5)
    const data = new Uint8Array(20000);
    for (let i = 0; i < data.length; i++) {
        data[i] = i % 17;
    }
    const encoded = Format5.encode(data, 5);
    const decoded = new Uint8Array(data.length);
    const written = Format5.decodeInto(encoded, decoded, 5);
    assert.strictEqual(written, data.length, 'Format5(LZO): written mismatch');
    assert.deepStrictEqual(Array.from(decoded), Array.from(data), 'Format5(LZO): data mismatch');
}

function testFormat5RoundtripFormat80(): void {
    // 测试2: Format5 with Format80 (format=80)
    const data = new Uint8Array(20000);
    for (let i = 0; i < data.length; i++) {
        data[i] = i % 7;
    }
    const encoded = Format5.encode(data, 80);
    const decoded = new Uint8Array(data.length);
    const written = Format5.decodeInto(encoded, decoded, 80);
    assert.strictEqual(written, data.length, 'Format5(F80): written mismatch');
    assert.deepStrictEqual(Array.from(decoded), Array.from(data), 'Format5(F80): data mismatch');
}

function testFormat5MultiBlock(): void {
    // 测试3: 多块数据（超过 8192 字节，触发分块）
    const data = new Uint8Array(25000); // 约 3 个块
    for (let i = 0; i < data.length; i++) {
        data[i] = (i * 3) % 256;
    }
    const encoded = Format5.encode(data, 5);
    const decoded = new Uint8Array(data.length);
    const written = Format5.decodeInto(encoded, decoded, 5);
    assert.strictEqual(written, data.length, 'Format5 multi-block: written mismatch');
    assert.deepStrictEqual(Array.from(decoded), Array.from(data), 'Format5 multi-block: data mismatch');
}

function testFormat5Small(): void {
    // 测试4: 小数据（单块）
    const data = new Uint8Array([100, 200, 50, 75, 100, 200, 50, 75, 100, 200]);
    const encoded = Format5.encode(data, 5);
    const decoded = new Uint8Array(data.length);
    const written = Format5.decodeInto(encoded, decoded, 5);
    assert.strictEqual(written, data.length, 'Format5 small: written mismatch');
    assert.deepStrictEqual(Array.from(decoded), Array.from(data), 'Format5 small: data mismatch');
}

function testFormat5ExactBlockBoundary(): void {
    // 测试5: 恰好 8192 字节（块边界）
    const data = new Uint8Array(8192);
    for (let i = 0; i < data.length; i++) {
        data[i] = i & 0xff;
    }
    const encoded = Format5.encode(data, 5);
    const decoded = new Uint8Array(data.length);
    const written = Format5.decodeInto(encoded, decoded, 5);
    assert.strictEqual(written, data.length, 'Format5 boundary: written mismatch');
    assert.deepStrictEqual(Array.from(decoded), Array.from(data), 'Format5 boundary: data mismatch');
}

// ===== 运行所有测试 =====

const tests = [
    ['Format80 roundtrip', testFormat80Roundtrip],
    ['Format80 empty', testFormat80Empty],
    ['Format80 repeated', testFormat80Repeated],
    ['Format80 random', testFormat80Random],
    ['Format80 pattern', testFormat80LargeWithRepeats],
    ['MiniLZO roundtrip', testMiniLZORoundtrip],
    ['MiniLZO empty', testMiniLZOEmpty],
    ['MiniLZO small', testMiniLZOSmall],
    ['MiniLZO repeated', testMiniLZORepeated],
    ['MiniLZO random', testMiniLZORandom],
    ['MiniLZO pattern', testMiniLZOLargeWithPattern],
    ['MiniLZO large', testMiniLZOLarge],
    ['Format5 LZO roundtrip', testFormat5RoundtripLZO],
    ['Format5 F80 roundtrip', testFormat5RoundtripFormat80],
    ['Format5 multi-block', testFormat5MultiBlock],
    ['Format5 small', testFormat5Small],
    ['Format5 boundary', testFormat5ExactBlockBoundary],
];

let passed = 0;
let failed = 0;

for (const [name, fn] of tests) {
    try {
        (fn as () => void)();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (e) {
        console.error(`  ✗ ${name}: ${(e as Error).message}`);
        failed++;
    }
}

console.log(`\n${passed}/${tests.length} tests passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
}
