/**
 * C++ 工程对齐回归测试（rmg/cxx/ 管线）。
 *
 * 对齐基准：G:\MapGenerator 的 MapGenerator.exe。golden 文件采集自一次
 * 已验证的双端对拍（exe 跑 re/oracle/run_mapgenerator.ps1、TS 跑
 * re/cxx_port/run_ts.cjs，.map 逐字节相同后固化）：
 *   - rmgcxx_seed00ff01eb.map       终产物（群岛/温带/早晨/小/2p/单人）
 *   - rmgcxx_seed00ff01eb.diag.log  全程 DiagLog（1000 行阶段轨迹）
 *
 * 约束：golden 只含本仓库可复现的输入（两个种子都显式给定），不依赖
 * exe 或 G:\ 素材 —— TS 侧的 INI/tile 资源路径默认指向
 * G:/MapGenerator/x64/Release，缺素材时本测试 skip（CI 环境无该目录）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const here = dirname(__filename);
const FIX = join(here, '..', '..', 'src', 'test', 'fixtures');
const fixtureMap = join(FIX, 'rmgcxx_seed00ff01eb.map');
const fixtureLog = join(FIX, 'rmgcxx_seed00ff01eb.diag.log');
const resDir = 'G:/MapGenerator/x64/Release';
const hasResources = existsSync(join(resDir, 'RMGMD.INI'));

function runPipeline(): { map: Buffer; log: string[] } {
    // late-bind the built output (tests run against dist/)
    const dist = join(here, '../../dist');
    const { setDiagSink } = require(join(dist, 'rmg/cxx/diag.js')) as typeof import('../rmg/cxx/diag');
    const { generateMap } = require(join(dist, 'rmg/cxx/generate.js')) as {
        generateMap: typeof import('../rmg/cxx/generate').generateMap;
    };
    const log: string[] = [];
    setDiagSink((line) => log.push(line));
    try {
        // the WinMain GLOBAL-SEED banner (seed boxes removed from the exe UI,
        // so the source labels are always tickcount / default0)
        log.push('GLOBAL-SEED 00FF01EB source=tickcount MAP-SEED 0 source=default0');
        const outDir = join(here, '../../.tmp_oracle');
        mkdirSync(outDir, { recursive: true });
        const out = join(outDir, 'parity_regen.map');
        const { result } = generateMap(
            {
                environment: 0, timeOfDay: 0, theater: 0, mapSize: 0,
                oreDensity: 0, playerIndex: 0, gameType: 0,
                globalSeed: 0x00ff01eb, mapSeed: 0,
            },
            out,
            resDir,
        );
        assert.equal(result.ok, true, 'generation should succeed');
        return { map: readFileSync(out), log };
    } finally {
        setDiagSink(null);
    }
}

test('rmg/cxx: R250 seed+draw stream is stable (known-vector smoke)', async (t) => {
    if (!hasResources) return t.skip('requires G:/MapGenerator resources');
    const { R250Random } = await import('../rmg/cxx/r250');
    const r = new R250Random();
    r.seed(0x00ff01eb);
    const draws: number[] = [];
    for (let i = 0; i < 8; ++i) draws.push(r.next());
    // pinned against the golden run: any change here desyncs every stage
    assert.deepEqual(draws, [
        0x934d7224, 0x2ec17b66, 0xb501020e, 0xc6567f13,
        0x6da9154f, 0x28b5fcae, 0xe69a94ce, 0xe566d97c,
    ]);
});

test('rmg/cxx: full pipeline reproduces the exe-verified golden map', () => {
    if (!hasResources) return;
    const golden = readFileSync(fixtureMap);
    const { map } = runPipeline();
    assert.equal(map.length, golden.length, `.map size ${map.length} vs golden ${golden.length}`);
    assert.ok(map.equals(golden), '.map must be byte-identical to the MapGenerator.exe run');
});

test('rmg/cxx: full pipeline reproduces the golden diag log line by line', () => {
    if (!hasResources) return;
    const golden = readFileSync(fixtureLog, 'utf8').split('\n');
    if (golden.length && golden[golden.length - 1] === '') golden.pop();
    const { log } = runPipeline();
    assert.equal(log.length, golden.length, `diag line count ${log.length} vs golden ${golden.length}`);
    const firstBad = log.findIndex((l, i) => l !== golden[i]);
    if (firstBad >= 0) {
        assert.fail(
            `diag divergence at line ${firstBad + 1}:\n  got:    ${log[firstBad]}\n  golden: ${golden[firstBad]}`,
        );
    }
});
