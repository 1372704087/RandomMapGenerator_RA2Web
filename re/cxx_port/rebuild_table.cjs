const fs = require('fs');
const buf = fs.readFileSync('G:/MapGenerator/x64/Release/MapGenerator.exe');
const off0 = 0x4bc00 + (0x5E8A8 - 0x4d000);
const entries = [];
for (let s = 0; s < 40; ++s) {
  const o = off0 + s * 40;
  const w = buf.readInt32LE(o);
  const h = buf.readInt32LE(o + 4);
  const mask = Number(buf.readBigUInt64LE(o + 8));
  const z = [];
  for (let i = 0; i < 16; ++i) { const v = buf[o + 16 + i]; if (v !== 0 || z.length) z.push(v); }
  entries.push({ w, h, mask, z });
}
// empirically-best mapping: TS slot N (1-based) uses exe entry N (0-based N),
// slot 40 reuses exe entry 39 (its true source entry is beyond slot 40's record)
const lines = [];
lines.push('// Cliff set - 40 pieces, k = tile - r.shoreTileIndex (CliffSet).');
lines.push("// [EXE-MATCH] extracted from the oracle exe .rdata @0x14005E8A8 (40B/slot:");
lines.push("// w, h, mask u64, z[16]) with the +1 slot offset the exe's callers use -");
lines.push("// the drifted text's table had a wrong first entry shifting every slot.");
lines.push('const kCliffFootprints: IsoFootprint[] = [');
for (let n = 0; n < 40; ++n) {
  const idx = Math.min(n + 1, 39);
  const e = entries[idx];
  const zs = e.z.length ? e.z.join(', ') : '0';
  lines.push('    { w: ' + e.w + ', h: ' + e.h + ', mask: 0x' + e.mask.toString(16) + ', z: [' + zs + '] },        // cliff' + String(n + 1).padStart(2, '0'));
}
lines.push('];');
fs.writeFileSync('.tmp_oracle/cliff_table_full.txt', lines.join('\n'));

const rp = 'packages/core/src/rmg/cxx/river.ts';
const rl = fs.readFileSync(rp, 'utf8').split('\n');
const decl = rl.findIndex(l => l.startsWith('const kCliffFootprints'));
const endIdx = rl.indexOf('];', decl);
if (decl < 0 || endIdx < 0) { console.error('anchors missing', decl, endIdx); process.exit(1); }
const out = rl.slice(0, decl).concat(lines, rl.slice(endIdx + 1));
fs.writeFileSync(rp, out.join('\n'));
console.log('table spliced:', out.length - rl.length, 'delta; entries:', 40);
