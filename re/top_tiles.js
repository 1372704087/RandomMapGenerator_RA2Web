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
const m = new Map();
for (const c of rows) m.set(c.ti, (m.get(c.ti) || 0) + 1);
const top = [...m.entries()].sort((a, b) => b[1] - a[1]);
console.log('总格=' + rows.length + ' 不同 tile=' + m.size);
console.log(top.slice(0, 40).map(([k, v]) => k + ':' + v).join(' '));
console.log('');
const lo = top.filter(([k]) => k >= 200 && k <= 420);
console.log('200..420: ' + lo.map(([k, v]) => k + ':' + v).join(' '));
