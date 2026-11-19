/**
 * 从游戏 theater mix 抽出非温带/雪地的 TMP 瓦片。
 *
 * 原版 MapGenerator 的 `Tile资源/` 只带 温和 和 雪地 两套；城市 / 沙漠 /
 * 新城市的 `.urb/.des/.ubn` 瓦片都在游戏的 theater mix 里（isodesmd.mix、
 * isourbmd.mix、isoubnmd.mix ...）。RMG 的 recalc 要用每张 TMP 的
 * Height / RampType 判断「这一格有没有这一帧」，缺 TMP 会把整张图擦成
 * 0xFFFF（渲染出来就是一片没有海岸、没有边框的沙地），所以这三套必须先
 * 抽出来放进 packages/server/resources/theater-tiles/<theater>/。
 *
 * 用法：
 *   node scripts/extract-theater-tiles.mjs --game-dir "F:/Red-Alert-2-Yuris-Revenge"
 *   node scripts/extract-theater-tiles.mjs --game-dir ... --theater desert
 *
 * 依赖 cncmaps-ts 的 MIX 解析（G:/cncmaps-ts 或 --cncmaps-dir 指定）；
 * 抽取逻辑与渲染器读 theater 归档的方式一致：逐个文件名在候选 mix 里查。
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** theater 表：与 core/src/rmg/cxx/theater.ts 的 artCacheFolder / extension 对齐。 */
const THEATERS = {
  temperate: { ini: 'temperatmd.ini', ext: 'tem', mixes: ['isotemmd.mix', 'isotemp.mix', 'temperat.mix', 'tem.mix'], stock: '温和' },
  snow: { ini: 'snowmd.ini', ext: 'sno', mixes: ['isosnomd.mix', 'snowmd.mix', 'isosnow.mix', 'snow.mix', 'sno.mix'], stock: '雪地' },
  urban: { ini: 'urbanmd.ini', ext: 'urb', mixes: ['isourbmd.mix', 'isourb.mix', 'urb.mix', 'urban.mix'], stock: '城市' },
  desert: { ini: 'desertmd.ini', ext: 'des', mixes: ['isodesmd.mix', 'desert.mix', 'des.mix', 'isodes.mix'], stock: '沙漠' },
  lunar: { ini: 'lunarmd.ini', ext: 'lun', mixes: ['isolunmd.mix', 'isolun.mix', 'lun.mix', 'lunar.mix'], stock: '月球' },
  newurban: { ini: 'urbannmd.ini', ext: 'ubn', mixes: ['isoubnmd.mix', 'isoubn.mix', 'ubn.mix', 'urbann.mix'], stock: '新城市' },
};

function parseArgs(argv) {
  const out = { gameDir: process.env.CNCMAPS_GAME_DIR ?? null, theater: null, cncmapsDir: 'G:/cncmaps-ts', iniDir: null, outDir: null, mergeStock: false, resourceDir: 'G:/MapGenerator/x64/Release' };
  for (let i = 0; i < argv.length; ++i) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--game-dir') { out.gameDir = v; ++i; }
    else if (k === '--theater') { out.theater = v; ++i; }
    else if (k === '--cncmaps-dir') { out.cncmapsDir = v; ++i; }
    else if (k === '--ini-dir') { out.iniDir = v; ++i; }
    else if (k === '--out-dir') { out.outDir = v; ++i; }
    else if (k === '--resource-dir') { out.resourceDir = v; ++i; }
    else if (k === '--merge-stock') { out.mergeStock = true; }
    else if (k === '--help' || k === '-h') { console.log('见文件头注释'); process.exit(0); }
    else throw new Error(`未知参数 ${k}`);
  }
  if (!out.gameDir) throw new Error('缺少 --game-dir（或环境变量 CNCMAPS_GAME_DIR）');
  if (!fs.existsSync(out.gameDir)) throw new Error(`游戏目录不存在：${out.gameDir}`);
  return out;
}

/** INI 里每个 [TileSetNNNN] 的 FileName + TilesInSet → 需要的 TMP 文件名 */
function wantedTileNames(iniPath, ext) {
  const text = fs.readFileSync(iniPath, 'latin1');
  const names = [];
  for (const m of text.matchAll(/\[TileSet(\d{4})\]([\s\S]*?)(?=\n\[|$)/gi)) {
    const body = m[2];
    const tiles = Number((/TilesInSet\s*=\s*(\S+)/i.exec(body) ?? [])[1] ?? 0);
    const file = (/FileName\s*=\s*(\S+)/i.exec(body) ?? [])[1] ?? '';
    if (!Number.isFinite(tiles) || tiles <= 0 || !file) continue;
    for (let k = 0; k < tiles; ++k) names.push(`${file}${String(k + 1).padStart(2, '0')}.${ext}`);
  }
  return names;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cm = args.cncmapsDir.replace(/\/?$/, '/') + 'dist/';
  const { VirtualFileSystem } = require(path.join(cm, 'formats/vfs/index.js'));
  const { EngineType } = require(path.join(cm, 'shared/Enums.js'));
  const { MixFile } = require(path.join(cm, 'formats/MixFile.js'));

  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..');
  const iniDir = args.iniDir ?? path.join(repoRoot, 'packages', 'server', 'resources', 'theater');
  const outRoot = args.outDir ?? path.join(repoRoot, 'packages', 'server', 'resources', 'theater-tiles');

  const vfs = new VirtualFileSystem();
  vfs.addItem(args.gameDir);
  vfs.loadMixes(args.gameDir, EngineType.YurisRevenge, true);

  const targets = args.theater ? [args.theater] : Object.keys(THEATERS);
  for (const key of targets) {
    const def = THEATERS[key];
    if (!def) throw new Error(`未知 theater：${key}`);

    // artDir() 找的是 <exeDir>/../../Tile资源/<stock>（exeDir 默认
    // G:/MapGenerator/x64/Release），不是游戏目录旁边那份。
    const stockRoot = path.resolve(args.resourceDir, '..', '..', 'Tile资源');
    const outDir = args.mergeStock
      ? path.join(stockRoot, def.stock)
      : path.join(outRoot, key);
    if (!args.mergeStock && fs.existsSync(def.stock)) {
      // 已经放好（比如 温和/雪地），不覆盖用户的解包
      if (fs.existsSync(path.join(stockRoot, def.stock))) {
        console.log(`${key}: 已有 Tile资源/${def.stock}，跳过（要补缺失件请加 --merge-stock）`);
        continue;
      }
    }

    const wanted = [...new Set(wantedTileNames(path.join(iniDir, def.ini), def.ext))];
    const mixes = [];
    for (const name of def.mixes) {
      const vf = vfs.openFile(name);
      if (!vf) continue;
      vf.position = 0;
      const bytes = new Uint8Array(vf.read(vf.length));
      try {
        mixes.push({ name, mix: new MixFile(bytes, name, 0, bytes.length, false) });
      } catch {
        // 解析不了的（比如不是 MIX）直接跳过
      }
    }

    fs.mkdirSync(outDir, { recursive: true });
    let written = 0;
    let kept = 0;
    const perMix = new Map();
    for (const tileName of wanted) {
      const dstPath = path.join(outDir, tileName);
      if (args.mergeStock && fs.existsSync(dstPath)) { kept += 1; continue; }
      for (const { name, mix } of mixes) {
        if (!mix.containsFile(tileName)) continue;
        const f = mix.openFile(tileName);
        if (!f) continue;
        f.position = 0;
        fs.writeFileSync(dstPath, new Uint8Array(f.read(f.length)));
        written += 1;
        perMix.set(name, (perMix.get(name) ?? 0) + 1);
        break;
      }
    }
    const missing = wanted.length - written - kept;
    const from = [...perMix].map(([m, c]) => `${m}:${c}`).join(' ');
    console.log(`${key}: wanted=${wanted.length} written=${written} kept=${kept} missing=${missing}  (${from}) -> ${outDir}`);
  }
}

main();
