/**
 * `png_scale.mjs` —— 把 cncmaps-ts 输出的大图缩到可看尺寸（盒式滤波）。
 * 用法: node re/png_scale.mjs <in.png> <out.png> [目标宽=1300]
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire('G:/cncmaps-ts/');
const { PNG } = require('pngjs');

const [inp, outp, wArg] = process.argv.slice(2);
const tw = Number(wArg || 1300);
const src = PNG.sync.read(fs.readFileSync(inp));
const th = Math.max(1, Math.round((src.height / src.width) * tw));
const dst = Buffer.alloc(tw * th * 4, 255);
const sx = src.width / tw;
const sy = src.height / th;
for (let y = 0; y < th; y++) {
  const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
  for (let x = 0; x < tw; x++) {
    const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
    let r = 0, g = 0, b = 0, n = 0;
    for (let yy = y0; yy < y1 && yy < src.height; yy++) {
      for (let xx = x0; xx < x1 && xx < src.width; xx++) {
        const o = (yy * src.width + xx) * 4;
        r += src.data[o]; g += src.data[o + 1]; b += src.data[o + 2]; n++;
      }
    }
    const o = (y * tw + x) * 4;
    dst[o] = (r / n) | 0; dst[o + 1] = (g / n) | 0; dst[o + 2] = (b / n) | 0; dst[o + 3] = 255;
  }
}
const out = new PNG({ width: tw, height: th });
out.data = dst;
fs.writeFileSync(outp, PNG.sync.write(out));
console.log(`WROTE ${outp} ${tw}x${th} (src ${src.width}x${src.height})`);
