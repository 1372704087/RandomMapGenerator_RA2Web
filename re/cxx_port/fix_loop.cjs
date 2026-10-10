const fs = require('fs');
const p = 'packages/core/src/rmg/cxx/makingSub.ts';
let s = fs.readFileSync(p, 'utf8');
const marker = "// Vanilla's `goto LABEL_32` (0x58ee8b) lands on the for-loop's own";
const i = s.indexOf(marker);
if (i < 0) { console.error('anchor not found'); process.exit(1); }
// replace from the marker comment through the `++j;` + `continue;` that follow
const tailStart = i;
const contIdx = s.indexOf('continue;', i);
if (contIdx < 0) { console.error('continue not found'); process.exit(1); }
const newBlock = `// Vanilla's \`goto LABEL_32\` (0x58ee8b) targets the loop HEAD: the
            // same slot j is re-tested, which now holds the record that slid
            // down through ReleaseRegionObject's compaction. (Verified against
            // the exe: after src=6's split the scan lands on the slid-down
            // region 7 and splits it, which a ++j here would skip.)
            continue;`;
s = s.slice(0, tailStart) + newBlock + s.slice(contIdx + 'continue;'.length);
fs.writeFileSync(p, s);
console.log('fixed loop semantics');
