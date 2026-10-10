// Matrix comparison: MapGenerator.exe vs the TS cxx pipeline.
// For each (env, theater, size, players) combo:
//   1. run the exe via run_mapgenerator.ps1, parse the seed + map path
//   2. run the TS pipeline with the same params + seed
//   3. byte-compare the two .map files
// Usage: node re/cxx_port/compare_matrix.cjs [count]
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const ORACLE_DIR = 'G:/MapGenerator/x64/Release';

const combos = [];
// cover all 5 land types x 2 theaters with fixed seeds, then extra variety
for (let env = 0; env <= 4; ++env) {
    combos.push({ env, theater: 0, size: 0, players: 0, ore: 0, time: 0, gametype: 0 });
}
for (let theater = 0; theater <= 1; ++theater) {
    combos.push({ env: 1, theater, size: 1, players: 3, ore: 1, time: 1, gametype: 0 });
    combos.push({ env: 3, theater, size: 2, players: 6, ore: 2, time: 2, gametype: 0 });
    combos.push({ env: 4, theater, size: 3, players: 6, ore: 3, time: 3, gametype: 1 });
}
const extra = parseInt(process.argv[2] || '0', 10);
// deterministic pseudo-random extra combos
let s = 12345;
const rnd = (n) => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s % n;
};
for (let i = 0; i < extra; ++i) {
    combos.push({
        env: rnd(5), theater: rnd(2), size: rnd(4), players: rnd(7),
        ore: rnd(4), time: rnd(4), gametype: rnd(2),
    });
}

const runExe = (c, attempt) => {
    execFileSync('powershell', ['-NoProfile', '-Command', 'Stop-Process -Name MapGenerator -Force -ErrorAction SilentlyContinue; exit 0'], { timeout: 30000 });
    return execFileSync('powershell', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', path.join(__dirname, '../oracle/run_mapgenerator.ps1'),
        '-Env', String(c.env), '-Time', String(c.time), '-Theater', String(c.theater),
        '-Size', String(c.size), '-Ore', String(c.ore), '-Players', String(c.players),
        '-GameType', String(c.gametype), '-TimeoutSec', '600',
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 630000 });
};

let pass = 0;
let fail = 0;
const failures = [];

for (let i = 0; i < combos.length; ++i) {
    const c = combos[i];
    const label = `#${i} env=${c.env} theater=${c.theater} size=${c.size} players=${c.players} ore=${c.ore} time=${c.time} gt=${c.gametype}`;
    process.stdout.write(`${label} ... `);

    // 1. exe run
    let psOut;
    try {
        psOut = runExe(c, 1);
    } catch (e1) {
        try {
            psOut = runExe(c, 2);
        } catch (e) {
            console.log('EXE FAILED');
            ++fail;
            failures.push({ label, why: 'exe run failed', detail: (String((e && e.stderr) || e) + ' ||STDOUT|| ' + String((e && e.stdout) || '')).slice(0, 600) });
            continue;
        }
    }

    const mapLine = psOut.split('\n').find((l) => l.trim().startsWith('G:') && /\.ya?m[pr]$|\.map$|\.yrm$/.test(l.trim()));
    const seedLine = psOut.match(/GLOBAL-SEED ([0-9A-F]{8})/);
    const failLine = psOut.includes('地形生成失败');
    if (!mapLine || !seedLine) {
        console.log('EXE OUTPUT PARSE FAILED');
        ++fail;
        failures.push({ label, why: 'parse', detail: psOut.slice(-500) });
        continue;
    }
    if (failLine) {
        console.log('EXE reported generation failure');
        ++fail;
        failures.push({ label, why: 'exe generation failed' });
        continue;
    }
    const exeMap = mapLine.trim();
    const seed = parseInt(seedLine[1], 16) >>> 0;

    // 2. TS run
    const ext = exeMap.endsWith('.yrm') ? '.yrm' : '.map';
    const tsMap = path.join(ROOT, '.tmp_oracle', `ts_${seed.toString(16)}_${i}${ext}`).replace(/\//g, path.sep);
    let tsOut;
    try {
        tsOut = execFileSync('node', [
            '--stack-size=65536', path.join(__dirname, 'run_ts.cjs'),
            '--global-seed', '0x' + seed.toString(16),
            '--env', String(c.env), '--time', String(c.time), '--theater', String(c.theater),
            '--size', String(c.size), '--ore', String(c.ore), '--players', String(c.players),
            '--gametype', String(c.gametype),
            '--out', tsMap, '--log', path.join(ROOT, '.tmp_oracle', 'ts_diag_last.log'),
        ], { encoding: 'utf8', timeout: 600000, cwd: ROOT });
    } catch (e) {
        console.log(`TS FAILED (seed=${seed.toString(16)})`);
        ++fail;
        failures.push({ label, why: 'ts failed', detail: String(e.stdout || e).slice(0, 800) });
        continue;
    }

    // 3. compare
    const a = fs.readFileSync(exeMap);
    const b = fs.readFileSync(tsMap);
    if (a.length === b.length && a.equals(b)) {
        console.log(`PASS (seed=${seed.toString(16)}, ${a.length} B)`);
        ++pass;
    } else {
        // first differing byte
        let d = 0;
        while (d < Math.min(a.length, b.length) && a[d] === b[d]) ++d;
        console.log(`DIFF (seed=${seed.toString(16)}, ${a.length} vs ${b.length} B, first diff @${d})`);
        ++fail;
        failures.push({ label, why: 'map diff', detail: `seed=${seed.toString(16)} len ${a.length}/${b.length} first@${d}; exe log ${ORACLE_DIR}/rmg_diag.log vs .tmp_oracle/ts_diag_last.log` });
        fs.copyFileSync(path.join(ROOT, '.tmp_oracle', 'ts_diag_last.log'), path.join(ROOT, '.tmp_oracle', `ts_diag_fail_${i}.log`));
        fs.copyFileSync(exeMap, path.join(ROOT, '.tmp_oracle', `exe_fail_${i}${ext}`));
    }
}

console.log(`\n=== ${pass} pass / ${fail} fail ===`);
for (const f of failures) console.log(`FAIL ${f.label}: ${f.why}\n  ${f.detail ?? ''}`);
