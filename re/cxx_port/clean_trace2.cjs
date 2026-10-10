const fs = require('fs');
const p = 'packages/core/src/rmg/cxx/makingSub.ts';
let s = fs.readFileSync(p, 'utf8');
// remove B5-REJ / RRC-REJ / TEMP-STRIP / TEMP-ACC traces
s = s.replace(/ *diag\(`B5-REJ[^;]*;\n/g, '');
s = s.replace(/ *diag\(`RRC-REJ[^;]*;\n/g, '');
s = s.replace(/ *diag\(`TEMP-STRIP[^;]*;\n/g, '');
s = s.replace(/ *diag\(`TEMP-ACC[^;]*;\n/g, '');
// collapse the if-blocks opened by the removed traces
s = s.replace(/    if \(!rampRectClear\(r, owner, blockX, blockY, blockW, blockH, targetId\)\) \{   \/\/ 0x591dxx\n        return 0;\n    \}/,
    '    if (!rampRectClear(r, owner, blockX, blockY, blockW, blockH, targetId))   // 0x591dxx\n        return 0;');
s = s.replace(/    if \(ady > dx - 5\) \{                                   \/\/ 0x591dxx\n        return 0;\n    \}/,
    '    if (ady > dx - 5)                                     // 0x591dxx\n        return 0;');
s = s.replace(/            if \(mark !== owner\.id && mark !== targetId\) \{   \/\/ 0x5941xx\n                return false;\n            \}/,
    '            if (mark !== owner.id && mark !== targetId)   // 0x5941xx\n                return false;');
s = s.replace(/            if \(!r\.isPlaceholderTile\(r\.cellAt\(i16\(col\), i16\(row\)\)\)\) \{\n                return false;   \/\/ sub_486380\n            \}/,
    '            if (!r.isPlaceholderTile(r.cellAt(i16(col), i16(row))))\n                return false;   // sub_486380');
s = s.replace(/        if \(builderResult === 0\) \{\n            return 0;\n        \}\n\n        /, '        if (builderResult === 0)\n            return 0;\n\n        ');
s = s.replace(/        if \(sideHighClash\(clash\)\) \{\n            diag\(`RAMP-SIDE-CANCEL near=\$\{clash\.x\},\$\{clash\.y\} R\$\{clash\.slope\} ownerL=\$\{owner\.level\}`\);\n            diag\(`TEMP-ACC clash[^\n]*\n            restoreSnapshot\(\);\n            return 0;\n        \}/,
`        if (sideHighClash(clash)) {
            diag(\`RAMP-SIDE-CANCEL near=\${clash.x},\${clash.y} R\${clash.slope} ownerL=\${owner.level}\`);
            restoreSnapshot();
            return 0;
        }`);
fs.writeFileSync(p, s);
const leftovers = (s.match(/TEMP-|B5-REJ|RRC-REJ/g) || []).length;
console.log('cleaned, leftovers:', leftovers);
