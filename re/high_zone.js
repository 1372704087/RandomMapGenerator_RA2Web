const B = 'G:/ra2-web-mapgen/packages/core';
const fs = require('fs');
const { IniFile } = require(B + '/dist/io/iniFile.js');
const { decompressRange } = require(B + '/dist/format/minilzo.js');
function readIso(iniText) {
  const ini = new IniFile(iniText);
  const sec = ini.GetSection('IsoMapPack5');
  const keys = sec.Keys.slice().sort((a, b) => Number(a) - Number(b));
  const raw = Buffer.from(keys.map((k) => sec.GetStringValue(k, '')).join(''), 'base64');
  let r = 0; const parts = [];
  while (r + 4 <= raw.length) {
    const si = raw.readUInt16LE(r), so = raw.readUInt16LE(r + 2);
    if (!si || !so) break; r += 4;
    const o = new Uint8Array(so + 1024); decompressRange(new Uint8Array(raw), r, si, o, 0);
    parts.push(Buffer.from(o.slice(0, so))); r += si;
  }
  const buf = Buffer.concat(parts); const out = [];
  for (let o = 0; o + 11 <= buf.length - 4; o += 11) {
    const dx = buf.readInt16LE(o), dy = buf.readInt16LE(o + 2), ti = buf.readInt32LE(o + 4);
    if (dx === 0 && dy === 0 && ti === 0) break;
    out.push({ dx, dy, ti, sub: buf[o + 8], lvl: buf[o + 9] });
  }
  return out;
}
const rows = readIso(fs.readFileSync(process.argv[2], 'latin1'));
const TH = Number(process.argv[3] || 7);
const hi = rows.filter(c => c.lvl >= TH);
const lo = rows.filter(c => c.lvl < TH && c.lvl > 0);
function top(arr) { const m = new Map(); for (const c of arr) m.set(c.ti, (m.get(c.ti) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18); }
console.log('level>=' + TH + ' 格数=' + hi.length);
console.log('  top tile: ' + top(hi).map(([k, v]) => k + ':' + v).join(' '));
console.log('level<' + TH + ' 格数=' + lo.length);
console.log('  top tile: ' + top(lo).map(([k, v]) => k + ':' + v).join(' '));
// level>=TH 的 sub 分布
const sm = new Map(); for (const c of hi) sm.set(c.sub, (sm.get(c.sub) || 0) + 1);
console.log('高区 sub 分布: ' + [...sm.entries()].sort((a,b)=>a[0]-b[0]).map(([k,v])=>k+':'+v).join(' '));
