/**
 * `render_map.js` —— 把「我们生成的地图」或「真机 .Map」渲染成 PNG 预览图。
 *
 * 用法:
 *   node re/render_map.js <Sed>          → 用该 Sed 的参数跑 generateFullMap 再渲染
 *   node re/render_map.js <Map>          → 直接渲染这张真机地图
 *   node re/render_map.js <Sed> <Map>    → 同时渲染两者（我们 / 真机）
 *
 * 可选环境变量:
 *   SCALE=3     放大倍数（默认 3，最近邻）
 *   OUT=dir     输出目录（默认 re/out）
 *
 * 配色来源与网页端预览完全一致：packages/core/src/preview.ts（minimap.ini）。
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CORE = path.resolve(__dirname, '..', 'packages', 'core', 'dist');
const RES = path.resolve(__dirname, '..', 'packages', 'server', 'resources');

const { generateFullMap } = require(CORE + '/rmg/pipeline.js');
const { deriveDimensions } = require(CORE + '/rmg/options.js');
const { loadSed } = require(CORE + '/rmg/sed.js');
const { parseTheaterIni } = require(CORE + '/rmg/theater.js');
const { renderMapPreview } = require(CORE + '/preview.js');

const THEATER_NAMES = ['TEMPERATE', 'DESERT', 'SNOW', 'URBAN', 'URBAN_NIGHT'];

// ---------------------------------------------------------------- PNG 编码
let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function writePng(file, width, height, rgb, scale) {
  const w = width * scale;
  const h = height * scale;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0; // filter: none
    const sy = (y / scale) | 0;
    for (let x = 0; x < w; x++) {
      const sx = (x / scale) | 0;
      const o = (sy * width + sx) * 3;
      raw[p++] = rgb[o];
      raw[p++] = rgb[o + 1];
      raw[p++] = rgb[o + 2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
  return { w, h };
}

// ---------------------------------------------------------------- 渲染
const minimap = fs.readFileSync(path.join(RES, 'minimap.ini'), 'utf8');

function renderIni(iniText, theaterName) {
  return renderMapPreview(iniText, minimap, theaterName);
}

const SCALE = Number(process.env.SCALE || 3);
const OUT = process.env.OUT || path.resolve(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const sedArg = args.find((a) => /\.sed$/i.test(a));
const mapArg = args.find((a) => /\.map$/i.test(a));

if (!sedArg && !mapArg) {
  console.error('用法: node re/render_map.js <Sed|Map> [Map]');
  process.exit(1);
}

const results = [];
let oursPv = null;
let realPv = null;

if (sedArg) {
  const sed = loadSed(fs.readFileSync(sedArg).toString('latin1'));
  const theaterName = THEATER_NAMES[sed.theater] || 'TEMPERATE';
  const tables = parseTheaterIni(
    fs.readFileSync(path.join(RES, 'theater', 'temperatmd.ini'), 'utf8'),
    theaterName,
  );
  const dims = deriveDimensions(sed);
  console.log('sed:', path.basename(sedArg), JSON.stringify({
    seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
    numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
    tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
    theater: sed.theater,
  }));
  console.log('dims:', JSON.stringify(dims));
  const { ini } = generateFullMap({
    seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
    numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
    tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
    theater: sed.theater, dimensions: dims, tables,
  }, 'Random Map');
  const pv = renderIni(ini, theaterName);
  oursPv = pv;
  const name = 'ours_' + path.basename(sedArg, path.extname(sedArg)) + '.png';
  const f = path.join(OUT, name);
  const r = writePng(f, pv.width, pv.height, pv.rgb, SCALE);
  console.log('WROTE', f, `${pv.width}x${pv.height} -> ${r.w}x${r.h}`);
  results.push(f);
  fs.writeFileSync(path.join(OUT, 'ours_' + path.basename(sedArg, path.extname(sedArg)) + '.map.ini'), ini);
}

if (mapArg) {
  const txt = fs.readFileSync(mapArg, 'latin1');
  const theaterName = (txt.match(/^Theater=([^\r\n;]+)/m) || [])[1] || 'TEMPERATE';
  const pv = renderIni(txt, theaterName.trim());
  realPv = pv;
  const name = 'real_' + path.basename(mapArg, path.extname(mapArg)) + '.png';
  const f = path.join(OUT, name);
  const r = writePng(f, pv.width, pv.height, pv.rgb, SCALE);
  console.log('WROTE', f, `${pv.width}x${pv.height} -> ${r.w}x${r.h}`);
  results.push(f);
}

// 上下拼接：上=我们（左）与真机（右）？
// 采用「上=我们 / 下=真机」的纵向拼接，宽度取两者最大值，间隙填白。
if (oursPv && realPv) {
  const tag = path.basename(sedArg || mapArg, path.extname(sedArg || mapArg));
  const w = Math.max(oursPv.width, realPv.width);
  const gap = 4;
  const h = oursPv.height + gap + realPv.height;
  const rgb = new Uint8Array(w * h * 3).fill(255);
  const blit = (pv, oy) => {
    for (let y = 0; y < pv.height; y++) {
      for (let x = 0; x < pv.width; x++) {
        const s = (y * pv.width + x) * 3;
        const d = ((oy + y) * w + x) * 3;
        rgb[d] = pv.rgb[s]; rgb[d + 1] = pv.rgb[s + 1]; rgb[d + 2] = pv.rgb[s + 2];
      }
    }
  };
  blit(oursPv, 0);
  blit(realPv, oursPv.height + gap);
  const f = path.join(OUT, `cmp_${tag}.png`);
  const r = writePng(f, w, h, rgb, SCALE);
  console.log('WROTE', f, `${w}x${h} -> ${r.w}x${r.h}  (上=我们 / 下=真机)`);
  results.push(f);
}

console.log('OUT_DIR', OUT);
