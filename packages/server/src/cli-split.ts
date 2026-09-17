/**
 * 命令行拆解工具：从完整地图拆解出切片。
 *
 * 用法:
 *   node dist/cli-split.js <theater> <sourceMapFile> [outputDir]
 *
 * 参数:
 *   theater         theater 目录名，如 TEMPERATE、DESERT、NEWURBAN
 *   sourceMapFile   要拆解的完整地图文本（.map/.yrm 内容文件）
 *   outputDir       输出目录，默认 ./split_<sourceBasename>
 *   --no-skip-empty 保留内部为空的地块（默认跳过）
 *
 * 示例:
 *   node dist/cli-split.js TEMPERATE ./big.map ./out_slices
 */

import fs from 'fs';
import path from 'path';
import { loadAllResources } from './resourceLoader';
import { splitFullMap } from './splitter';

function usage(): void {
  console.log(
    'Usage: node dist/cli-split.js <theater> <sourceMapFile> [outputDir] [--no-skip-empty]',
  );
}

function main(): void {
  const args = process.argv.slice(2);
  const flagIndex = args.indexOf('--no-skip-empty');
  const skipEmpty = flagIndex === -1;
  if (flagIndex !== -1) args.splice(flagIndex, 1);

  if (args.length < 2 || args.length > 3) {
    usage();
    process.exit(1);
  }

  const [theaterName, sourcePath] = args;
  const sourceBasename = path.basename(sourcePath).replace(/\.[^.]+$/, '');
  const outDir = args[2] ?? path.resolve(`./split_${sourceBasename}`);

  if (!fs.existsSync(sourcePath)) {
    console.error(`Source map file not found: ${sourcePath}`);
    process.exit(1);
  }
  const sourceIni = fs.readFileSync(sourcePath, 'utf-8');

  console.log(`[cli-split] Loading resources...`);
  loadAllResources();

  console.log(
    `[cli-split] Splitting "${sourcePath}" into "${theaterName}" slices (skipEmpty=${skipEmpty})...`,
  );
  const slices = splitFullMap(theaterName, sourceIni, { skipEmpty });

  fs.mkdirSync(outDir, { recursive: true });
  for (const s of slices) {
    fs.writeFileSync(path.join(outDir, `${s.name}.map`), s.content, 'utf-8');
  }

  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(
      {
        theater: theaterName,
        skipEmpty,
        count: slices.length,
        slices: slices.map((s) => ({ name: s.name, gridX: s.gridX, gridY: s.gridY })),
      },
      null,
      2,
    ),
    'utf-8',
  );

  console.log(`[cli-split] Done. ${slices.length} slices written to: ${outDir}`);
}

main();