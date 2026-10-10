// Generate 10 maps with the cxx pipeline and render PNG previews.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, '.tmp_oracle', 'gallery');
fs.mkdirSync(OUT, { recursive: true });

// 10 combos covering all 5 land types x 2 theaters, varied sizes/players.
const combos = [
    { name: '01-archipelago-temperate-2p', env: 0, theater: 0, size: 1, players: 0, ore: 1, time: 1, gt: 0 },
    { name: '02-continent-temperate-4p',   env: 1, theater: 0, size: 1, players: 2, ore: 1, time: 1, gt: 0 },
    { name: '03-teamcontinent-snow-6p',    env: 2, theater: 1, size: 1, players: 4, ore: 2, time: 2, gt: 0 },
    { name: '04-inland-temperate-4p',      env: 3, theater: 0, size: 1, players: 2, ore: 1, time: 1, gt: 0 },
    { name: '05-mountainous-temperate-6p', env: 4, theater: 0, size: 1, players: 4, ore: 2, time: 1, gt: 0 },
    { name: '06-archipelago-snow-4p',      env: 0, theater: 1, size: 2, players: 2, ore: 2, time: 2, gt: 0 },
    { name: '07-continent-snow-8p',        env: 1, theater: 1, size: 2, players: 6, ore: 3, time: 3, gt: 0 },
    { name: '08-teamcontinent-temperate-4p', env: 2, theater: 0, size: 0, players: 2, ore: 0, time: 0, gt: 0 },
    { name: '09-inland-snow-8p',           env: 3, theater: 1, size: 2, players: 6, ore: 2, time: 3, gt: 0 },
    { name: '10-mountainous-snow-4p',      env: 4, theater: 1, size: 0, players: 2, ore: 1, time: 2, gt: 0 },
];

// deterministic seed sweep
let s = 0x5EED0000;
const nextSeed = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0);

for (const c of combos) {
    const seed = nextSeed();
    const mapPath = path.join(OUT, c.name + '.map');
    process.stdout.write(c.name + ' seed=' + seed.toString(16) + ' ... ');
    try {
        execFileSync('node', ['--stack-size=65536',
            path.join(__dirname, 'run_ts.cjs'),
            '--global-seed', '0x' + seed.toString(16),
            '--env', String(c.env), '--theater', String(c.theater),
            '--size', String(c.size), '--players', String(c.players),
            '--ore', String(c.ore), '--time', String(c.time),
            '--gametype', String(c.gt),
            '--out', mapPath,
            '--log', path.join(OUT, c.name + '.diag.log'),
        ], { encoding: 'utf8', timeout: 300000, cwd: ROOT });
    } catch (e) {
        console.log('GENERATION FAILED');
        continue;
    }
    // render PNG with the repo preview renderer
    try {
        execFileSync('node', [
            path.join(ROOT, 're', 'render_map.js'), mapPath,
        ], { encoding: 'utf8', timeout: 300000, cwd: ROOT, env: { ...process.env, OUT } });
        console.log('ok');
    } catch (e) {
        console.log('map ok, RENDER FAILED: ' + String(e.stderr || e).slice(0, 200));
    }
}
console.log('done -> ' + OUT);
