const fs = require('fs');
const p = 'packages/core/src/rmg/cxx/makingSub.ts';
let s = fs.readFileSync(p, 'utf8');
// undo any broken prior patch
s = s.replace(/\n *diag\(\);?\n/g, '\n');
const anchor1 = "    let carved = 0;                                       // vanilla's v7";
if (!s.includes(anchor1)) { console.error('anchor1 missing'); process.exit(1); }
const t1 = "\n    diag(`RCARVE owner=" + "${owner.id}/L" + "${owner.level} at=(" + "${x}," + "${y}) target=" + "${regionId} mask=" + "${mask.toString(2).padStart(8, '0')} ratio=" + "${ratio.toFixed(2)}`);\n";
s = s.replace(anchor1, anchor1 + t1);
const anchor2 = '    // The second sweep the vanilla runs only for the later tries (ratio > 0.5).';
if (!s.includes(anchor2)) { console.error('anchor2 missing'); process.exit(1); }
const t2 = "    diag(`RCARVE-DONE at=(" + "${x}," + "${y}) carved=" + "${carved}`);\n";
s = s.replace(anchor2, t2 + anchor2);
fs.writeFileSync(p, s);
console.log('trace patched ok');
