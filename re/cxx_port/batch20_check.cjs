// 批量出 20 张 env3/4 图：生成 → 渲染 → 缩图 → 结构检查
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const ROOT = 'G:/ra2-web-mapgen';
const OUT = path.join(ROOT, '.tmp_oracle', 'batch20');
const NODE = process.execPath;
const RUN_TS = path.join(ROOT, 're/cxx_port/run_ts.cjs');
const CNC = 'G:/cncmaps-ts/dist/cli.js';
const MOD = 'F:/Red-Alert-2-Yuris-Revenge';

// 20 张的参数表：env3×10 + env4×10，尺寸/人数/剧场/矿量打散
const JOBS = [
  // env 3 内陆
  { seed: '0x3A7F11C2', env: 3, size: 0, players: 0, theater: 0, ore: 0 },
  { seed: '0x5D2E9A14', env: 3, size: 1, players: 2, theater: 0, ore: 1 },
  { seed: '0x1C4B7F63', env: 3, size: 2, players: 4, theater: 0, ore: 2 },
  { seed: '0x7E0A2D58', env: 3, size: 3, players: 6, theater: 0, ore: 3 },
  { seed: '0x62F84B09', env: 3, size: 0, players: 3, theater: 1, ore: 1 },
  { seed: '0x09B3C6E7', env: 3, size: 1, players: 1, theater: 0, ore: 3 },
  { seed: '0x44D19A80', env: 3, size: 2, players: 5, theater: 0, ore: 0 },
  { seed: '0x2A66E03D', env: 3, size: 3, players: 0, theater: 1, ore: 2 },
  { seed: '0x6C15F9AA', env: 3, size: 1, players: 4, theater: 0, ore: 1 },
  { seed: '0x38AD52F1', env: 3, size: 2, players: 2, theater: 1, ore: 0 },
  // env 4 山地
  { seed: '0x51C7B39E', env: 4, size: 0, players: 0, theater: 0, ore: 0 },
  { seed: '0x0E96D4A7', env: 4, size: 1, players: 2, theater: 0, ore: 1 },
  { seed: '0x7B48F025', env: 4, size: 2, players: 4, theater: 1, ore: 2 },
  { seed: '0x69D2A8CC', env: 4, size: 3, players: 6, theater: 0, ore: 3 },
  { seed: '0x24FA6E51', env: 4, size: 0, players: 3, theater: 1, ore: 1 },
  { seed: '0x8C0379BD', env: 4, size: 1, players: 1, theater: 1, ore: 3 },
  { seed: '0x35E8C017', env: 4, size: 2, players: 5, theater: 0, ore: 0 },
  { seed: '0x407DB592', env: 4, size: 3, players: 0, theater: 1, ore: 2 },
  { seed: '0x1F592E6C', env: 4, size: 1, players: 4, theater: 1, ore: 1 },
  { seed: '0x77AA10FB', env: 4, size: 2, players: 2, theater: 0, ore: 0 },
];

// ---- PNG decode (8-bit RGB/RGBA/gray, non-interlaced) + box downscale + encode ----
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png');
  let off = 8, ihdr = null, idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], colorType: data[9], interlace: data[12] };
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (ihdr.depth !== 8 || ihdr.interlace !== 0) throw new Error('unsupported png depth/interlace');
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.colorType];
  if (!ch) throw new Error('unsupported colorType ' + ihdr.colorType);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const { w, h } = ihdr;
  const stride = w * ch;
  const out = Buffer.alloc(w * h * ch);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; ++y) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; ++x) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      let v = row[x];
      if (filter === 1) v = (v + a) & 0xff;
      else if (filter === 2) v = (v + b) & 0xff;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
      cur[x] = v;
    }
    prev = cur;
  }
  return { ...ihdr, ch, data: out };
}
function encodePng(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; ++y) {
    raw[y * (w * 3 + 1)] = 0;
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 6 });
  const chunks = [];
  const crcTable = [];
  for (let n = 0; n < 256; ++n) { let c = n; for (let k = 0; k < 8; ++k) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  chunks.push(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  chunks.push(chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}
function downscale(img, targetW) {
  const { w, h, ch, data } = img;
  const scale = Math.max(1, Math.round(w / targetW));
  const dw = Math.floor(w / scale), dh = Math.floor(h / scale);
  const out = Buffer.alloc(dw * dh * 3);
  for (let dy = 0; dy < dh; ++dy) {
    for (let dx = 0; dx < dw; ++dx) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = 0; sy < scale; ++sy) {
        const yy = dy * scale + sy;
        for (let sx = 0; sx < scale; ++sx) {
          const xx = dx * scale + sx;
          const o = (yy * w + xx) * ch;
          r += data[o]; g += data[o + 1]; b += data[o + 2]; ++n;
        }
      }
      const oo = (dy * dw + dx) * 3;
      out[oo] = r / n; out[oo + 1] = g / n; out[oo + 2] = b / n;
    }
  }
  return { w: dw, h: dh, rgb: out };
}

// ---- run ----
const results = [];
for (let i = 0; i < JOBS.length; ++i) {
  const j = JOBS[i];
  const name = `${String(i).padStart(2, '0')}_e${j.env}_s${j.size}_p${j.players}_t${j.theater}_o${j.ore}`;
  const map = path.join(OUT, name + '.map');
  const log = path.join(OUT, name + '.log');
  try {
    execFileSync(NODE, [RUN_TS, '--global-seed', j.seed, '--env', String(j.env), '--time', '0',
      '--theater', String(j.theater), '--size', String(j.size), '--ore', String(j.ore),
      '--players', String(j.players), '--out', map, '--log', log], { stdio: 'pipe' });
  } catch (e) {
    results.push({ name, seed: j.seed, error: 'generate failed: ' + e.message.slice(0, 200) });
    continue;
  }
  try {
    execFileSync(NODE, [CNC, '--infile=' + map, '--outdir=' + OUT, '--outfile=' + name,
      '--output-png', '--png-compression=1', '--mark-start-pos', '--mark-ore', '--meta-json=' + path.join(OUT, name + '.json'),
      '-m', MOD], { stdio: 'pipe' });
  } catch (e) {
    results.push({ name, seed: j.seed, error: 'render failed: ' + e.message.slice(0, 200) });
    continue;
  }
  const png = path.join(OUT, name + '.png');
  const small = downscale(decodePng(fs.readFileSync(png)), 880);
  fs.writeFileSync(path.join(OUT, name + '.small.png'), encodePng(small.w, small.h, small.rgb));
  fs.rmSync(png); // 全分辨率图丢弃，只留缩图
  const meta = JSON.parse(fs.readFileSync(path.join(OUT, name + '.json'), 'utf8'));
  results.push({ name, seed: j.seed, meta });
  console.log(`[${i + 1}/20] ${name} ok  starts=${(meta.startPositions || []).length}`);
}
fs.writeFileSync(path.join(OUT, 'batch_results.json'), JSON.stringify(results, null, 1));
console.log('done');
