// 全分辨率黑簇扫描：找纯黑像素连通域（排除大水域），输出 bbox 供裁剪
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function decodePng(p) {
  const b = fs.readFileSync(p);
  let off = 8, ihdr = null, idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off), type = b.toString('ascii', off + 4, off + 8);
    if (type === 'IHDR') ihdr = { w: b.readUInt32BE(off + 8), h: b.readUInt32BE(off + 12), depth: b[off + 16], ct: b[off + 17] };
    else if (type === 'IDAT') idat.push(b.subarray(off + 8, off + 8 + len));
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const ch = ihdr.ct === 2 ? 3 : 4;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = ihdr.w * ch, out = Buffer.alloc(ihdr.h * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < ihdr.h; ++y) {
    const f = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; ++x) {
      const a = x >= ch ? cur[x - ch] : 0, b2 = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = row[x];
      if (f === 1) v = (v + a) & 255;
      else if (f === 2) v = (v + b2) & 255;
      else if (f === 3) v = (v + ((a + b2) >> 1)) & 255;
      else if (f === 4) {
        const p = a + b2 - c, pa = Math.abs(p - a), pb = Math.abs(p - b2), pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b2 : c)) & 255;
      }
      cur[x] = v;
    }
    prev = cur;
  }
  return { w: ihdr.w, h: ihdr.h, ch, data: out };
}

const name = process.argv[2];
const dir = path.join('G:/ra2-web-mapgen/.tmp_oracle/batch20');
const img = decodePng(path.join(dir, name + '.png'));
const { w, h, ch, data } = img;
const isBlack = (x, y) => {
  const o = (y * w + x) * ch;
  return data[o] < 15 && data[o + 1] < 15 && data[o + 2] < 15;
};
const seen = new Uint8Array(w * h);
const clusters = [];
const stack = [];
for (let y0 = 0; y0 < h; y0 += 2) {
  for (let x0 = 0; x0 < w; x0 += 2) {
    if (seen[y0 * w + x0] || !isBlack(x0, y0)) continue;
    let minX = x0, maxX = x0, minY = y0, maxY = y0, count = 0;
    stack.length = 0; stack.push(y0 * w + x0); seen[y0 * w + x0] = 1;
    while (stack.length) {
      const idx = stack.pop();
      const y = (idx / w) | 0, x = idx % w;
      ++count;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (!seen[ni] && isBlack(nx, ny)) { seen[ni] = 1; stack.push(ni); }
      }
    }
    clusters.push({ minX, maxX, minY, maxY, count, w: maxX - minX, h: maxY - minY });
  }
}
clusters.sort((a, b) => b.count - a.count);
console.log(name, 'clusters:', clusters.length);
console.log('largest 5:', clusters.slice(0, 5).map(c => `${c.count}px (${c.minX},${c.minY})-(${c.maxX},${c.maxY})`).join('  '));
// 缺陷簇 = 排除最大的水体簇后，其余按大小列出
const rest = clusters.slice(1).filter(c => c.count > 200).slice(0, 12);
console.log('defect candidates:');
for (const c of rest) console.log(`  (${c.minX},${c.minY})-(${c.maxX},${c.maxY}) ${c.count}px ${c.w}x${c.h}`);
