const fs = require('fs');
const p = 'packages/core/src/rmg/cxx/makingSub.ts';
let s = fs.readFileSync(p, 'utf8');
const a1 = `            if (mark !== owner.id && mark !== targetId)   // 0x5941xx
                return false;
            if (!r.isPlaceholderTile(r.cellAt(i16(col), i16(row))))
                return false;   // sub_486380`;
const b1 = `            const mark = r.work.i(col + side * row, 14);
            if (mark !== owner.id && mark !== targetId) {   // 0x5941xx
                diag(\`RRC-REJ mark c=(\${col},\${row}) m=\${mark} o=\${owner.id} t=\${targetId}\`);
                return false;
            }
            if (!r.isPlaceholderTile(r.cellAt(i16(col), i16(row)))) {
                diag(\`RRC-REJ ph c=(\${col},\${row}) tile=\${r.cellAt(i16(col), i16(row)).isoTileTypeIndex} lvl=\${r.cellAt(i16(col), i16(row)).level}\`);
                return false;   // sub_486380
            }`;
if (!s.includes(a1)) { console.error('anchor missing'); process.exit(1); }
s = s.replace(a1, `            const mark = r.work.i(col + side * row, 14);\n` + b1.split('            const mark = r.work.i(col + side * row, 14);\n')[1]);
fs.writeFileSync(p, s);
console.log('rrc trace added');
