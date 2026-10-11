// 阶段隔离工具: 单阶段/全阶段生成 + 逐阶段渲染对比
// 用法:
//   node run_stage.cjs --global-seed 0x.. --env 3 [--stop lats] [其他 run_ts 参数]
// RMG_STOP_AFTER=<stage> 会传给生成器, 在该阶段后停止
// 阶段名: water regions recalc1 startpoints tiberium recalc3 hills lats recalc4 cleanup done
'use strict';
const path = require('path');
const fs = require('fs');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const OUT = process.env.STAGE_DIR || path.join(ROOT, '.tmp_oracle', 'stages');
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const seed = argOf('global-seed', '0x09B3C6E7');
const env = argOf('env', '3');
const stop = argOf('stop', '');
fs.mkdirSync(OUT, { recursive: true });

const pass = args.filter((a, i) => !['--stop'].includes(args[i - 1]));
console.log('seed=' + seed + ' env=' + env + ' stop=' + (stop || '无'));

// 1. 生成 (带阶段落盘)
const env2 = { ...process.env, RMG_DUMP_STAGES: '1' };
if (stop) env2.RMG_STOP_AFTER = stop;
const mapArg = path.join(OUT, 'stage.map');
execFileSync(process.execPath, [path.join(ROOT, 're/cxx_port/run_ts.cjs'),
    '--global-seed', seed, ...pass.filter(a => a !== seed),
    '--out', mapArg], { env: env2, stdio: 'inherit' });

// 2. 找出所有阶段 .map 并渲染
const stages = fs.readdirSync(OUT).filter(f => /^stage\..+\.map$/.test(f)).sort((a, b) => {
    const order = ['water', 'regions', 'recalc1', 'startpoints', 'tiberium', 'recalc3', 'hills', 'lats', 'recalc4', 'cleanup'];
    const na = a.match(/stage\.(.+)\.map$/)[1], nb = b.match(/stage\.(.+)\.map$/)[1];
    return (order.indexOf(na) + 1 || 99) - (order.indexOf(nb) + 1 || 99);
});
console.log('阶段数:', stages.length);
for (const f of stages) {
    const name = f.match(/stage\.(.+)\.map$/)[1];
    const png = path.join(OUT, 'stage.' + name);
    try {
        execFileSync(process.execPath, ['G:/cncmaps-ts/dist/cli.js','--infile=' + path.join(OUT, f), '--outdir=' + OUT,
            '--outfile=' + name, '--output-png', '--png-compression=1', '-m', 'F:/Red-Alert-2-Yuris-Revenge'], { stdio: ['ignore', 'pipe', 'ignore'] });
        // 黑簇扫描
        const scan = spawnSync(process.execPath, [path.join(__dirname, 'blackscan.cjs'), 'stage.' + name], { encoding: 'utf8' });
        const m = (scan.stdout || '').match(/largest 5: (\d+)px/);
        console.log('  ' + name.padEnd(12) + ' 最大黑簇: ' + (m ? m[1] + 'px' : '0(干净)'));
    } catch (e) { console.log('  ' + name + ' 渲染失败: ' + e.message.slice(0, 80)); }
}
console.log('完成。渲染图在 ' + OUT);
