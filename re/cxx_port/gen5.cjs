// Generate 5 env3/4 maps with the cxx pipeline and render PNG previews.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, '.tmp_oracle', 'gallery');
fs.mkdirSync(OUT, { recursive: true });

const combos = [
    { name: 'g1-inland-temperate-4p',      env: 3, theater: 0, size: 1, players: 2, ore: 1, time: 1, gt: 0 },
    { name: 'g2-inland-snow-8p',           env: 3, theater: 1, size: 2, players: 6, ore: 2, time: 3, gt: 0 },
    { name: 'g3-mountainous-temperate-6p', env: 4, theater: 0, size: 1, players: 4, ore: 2, time: 1, gt: 0 },
    { name: 'g4-mountainous-snow-4p',      env: 4, theater: 1, size: 0, players: 2, ore: 1, time: 2, gt: 0 },
    { name: 'g5-inland-temperate-8p',      env: 3, theater: 0, size: 2, players: 6, ore: 3, time: 2, gt: 0 },
];

let s = 0x5EED7777;
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
        console.log('ok');
    } catch (e) {
        console.log('FAILED');
        continue;
    }
    try {
        execFileSync('powershell', ['-NoProfile', '-Command',
            `& 'G:/cncmaps-net/CNCMaps.Renderer/bin/Release/net10.0/CNCMaps.Renderer.exe' -i '${mapPath.replace(/\//g, '\\')}' -o '${path.join(OUT, 'cg_' + c.name)}'.replace(/\\//g,'\\') -p --mark-start-pos -m 'H:\\测试\\Red-Alert-2-Yuris-Revenge' -y`],
            { encoding: 'utf8', timeout: 300000 });
        console.log('  rendered');
    } catch (e) {
        console.log('  render failed: ' + String(e.stderr || e).slice(0, 150));
    }
}
console.log('done -> ' + OUT);
