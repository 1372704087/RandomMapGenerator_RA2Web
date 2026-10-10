const fs = require('fs');
const p = 'packages/core/src/rmg/cxx/makingSub.ts';
let s = fs.readFileSync(p, 'utf8');
// remove the two trace lines and the dump block
s = s.replace(/ *diag\(`RCARVE owner=[^)]*\)[^;]*;\n/g, '');
s = s.replace(/\n *diag\(`RCARVE owner[\s\S]*?`\);\n/g, '\n');
s = s.replace(/ *diag\(`RCARVE-DONE[^;]*;\n/g, '');
s = s.replace(/\n *diag\(`RCARVE-DONE[\s\S]*?`\);\n/g, '\n');
// remove the reseed dump block
const start = s.indexOf('    // TEMP-DIAG post-reseed table');
if (start >= 0) {
  const endMarker = '    }\n}';
  const end = s.indexOf(endMarker, start);
  if (end >= 0) {
    s = s.slice(0, start) + '    }\n}' + s.slice(end + endMarker.length);
  }
}
fs.writeFileSync(p, s);
console.log('cleaned:', !s.includes('RCARVE') && !s.includes('TEMP-DIAG'));
