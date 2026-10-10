const fs = require('fs');
const p = 'packages/core/src/rmg/cxx/makingSub.ts';
let s = fs.readFileSync(p, 'utf8');
const anchor = "        for (let j = 0; j < r.regions.length; ++j)        // 0x58f07f\n            r.regions[j]!.neighbours.length = 0;\n    }\n}";
if (!s.includes(anchor)) { console.error('anchor missing'); process.exit(1); }
const dump =
"        for (let j = 0; j < r.regions.length; ++j)        // 0x58f07f\n" +
"            r.regions[j]!.neighbours.length = 0;\n" +
"    }\n" +
"    // TEMP-DIAG post-reseed table\n" +
"    diag('RESEED ' + r.regions.map((rg) => `id=${rg.id} n=${rg.cellCount} L=${rg.level} w=${rg.waterFamily ? 1 : 0}`).join(' '));\n" +
"    for (let i = 0; i < r.size.workSide * r.size.workSide; ++i) {\n" +
"        const pc = r.work.i(i, 0);\n" +
"        const px = pc & 0xffff; const py = pc >>> 16;\n" +
"        if (px === 0 && py === 0) continue;\n" +
"        diag(`RESEED-FIRST cell=(${px},${py}) level=${r.cellAt(px, py).level}`);\n" +
"        break;\n" +
"    }\n" +
"}";
s = s.replace(anchor, dump);
fs.writeFileSync(p, s);
console.log('dump added');
