/**
 * `cnc_compare.mjs` —— 把 cncmaps-ts 渲染出的两张**真实贴图**大图缩到可看尺寸并拼接。
 *
 * 用法:
 *   node re/cnc_compare.mjs <上.png> <下.png> <输出.png> [目标宽=1200] [标签?]
 *
 * 依赖: G:/cncmaps-ts/node_modules/pngjs（pnpm 仓库里没有）
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('G:/cncmaps-ts/');
const { PNG } = require('pngjs');

const [up, down, out, wArg] = process.argv.slice(2);
if (!up || !down || !out) {
  console.error('用法: node re/cnc_compare.mjs <上.png> <下.png> <输出.png> [目标宽=1200] [cropX,cropY,W,H]');
  process.exit(1);
}
const TARGET_W = Number(wArg || 1200);
const CROP = process.argv[6] ? process.argv[6].split(',').map(Number) : null;

function load(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  return { w: png.width, h: png.height, data: png.data };
}

/** 盒式滤波缩放（面积平均），保持比例 */
function resize(src, tw) {
  const th = Math.max(1, Math.round((src.h / src.w) * tw));
  const dst = Buffer.alloc(tw * th * 4, 255);
  const sx = src.w / tw;
  const sy = src.h / th;
  for (let y = 0; y < th; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < tw; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < src.h; yy++) {
        for (let xx = x0; xx < x1 && xx < src.w; xx++) {
          const o = (yy * src.w + xx) * 4;
          r += src.data[o]; g += src.data[o + 1]; b += src.data[o + 2]; n++;
        }
      }
      const o = (y * tw + x) * 4;
      dst[o] = (r / n) | 0;
      dst[o + 1] = (g / n) | 0;
      dst[o + 2] = (b / n) | 0;
      dst[o + 3] = 255;
    }
  }
  return { w: tw, h: th, data: dst };
}

/** 从大图裁一块矩形（越界部分填黑） */
function crop(src, cx, cy, cw, ch) {
  const dst = Buffer.alloc(cw * ch * 4, 0);
  for (let y = 0; y < ch; y++) {
    const sy = cy + y;
    if (sy < 0 || sy >= src.h) continue;
    for (let x = 0; x < cw; x++) {
      const sx = cx + x;
      if (sx < 0 || sx >= src.w) continue;
      const s = (sy * src.w + sx) * 4;
      const d = (y * cw + x) * 4;
      dst[d] = src.data[s]; dst[d + 1] = src.data[s + 1];
      dst[d + 2] = src.data[s + 2]; dst[d + 3] = 255;
    }
  }
  return { w: cw, h: ch, data: dst };
}

const ia = load(up);
const ib = load(down);
// 有 crop 时按 1:1 输出（那是给"看贴图细节"用的）
const a = CROP ? crop(ia, CROP[0], CROP[1], CROP[2], CROP[3]) : resize(ia, TARGET_W);
const b = CROP ? crop(ib, CROP[0], CROP[1], CROP[2], CROP[3]) : resize(ib, TARGET_W);
const GAP = 6;
const W = Math.max(a.w, b.w);
const H = a.h + GAP + b.h;
const outImg = new PNG({ width: W, height: H });
outImg.data.fill(40); // 深灰分隔/底色
for (let i = 3; i < outImg.data.length; i += 4) outImg.data[i] = 255;

const blit = (src, oy) => {
  for (let y = 0; y < src.h; y++) {
    src.data.copy(outImg.data, ((oy + y) * W) * 4, y * src.w * 4, (y + 1) * src.w * 4);
  }
};
blit(a, 0);
blit(b, a.h + GAP);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, PNG.sync.write(outImg, { colorType: 6 }));
console.log(`WROTE ${out}  ${W}x${H}  (上=${path.basename(up)} ${a.w}x${a.h} / 下=${path.basename(down)} ${b.w}x${b.h})`);
