const fs = require('fs');
const p = 'packages/core/src/rmg/cxx/makingSub.ts';
let s = fs.readFileSync(p, 'utf8');
const L = s.indexOf('export function rampBuilder5');
if (L < 0) { console.error('b5 not found'); process.exit(1); }
// find the end of rampBuilder5 (next 'export function' after L)
const L2 = s.indexOf('export function', L + 10);
let body = s.slice(L, L2);
body = body.replace('    if (!rampRectClear(r, owner, blockX, blockY, blockW, blockH, targetId))   // 0x591dxx\n        return 0;',
    '    if (!rampRectClear(r, owner, blockX, blockY, blockW, blockH, targetId)) {   // 0x591dxx\n        diag(`B5-REJ rrc from=(${fromX},${fromY}) to=(${toX},${toY})`);\n        return 0;\n    }');
body = body.replace('    if (ady > dx - 5)                                     // 0x591dxx\n        return 0;',
    '    if (ady > dx - 5) {                                   // 0x591dxx\n        diag(`B5-REJ ady from=(${fromX},${fromY}) to=(${toX},${toY})`);\n        return 0;\n    }');
// final return 0 of builder5 — tag it
body = body.replace(/(\n    return 0;\n\})\s*$/, '\n    diag(`B5-REJ tail from=(${fromX},${fromY}) to=(${toX},${toY})`);\n    return 0;\n}');
s = s.slice(0, L) + body + s.slice(L2);
fs.writeFileSync(p, s);
console.log('b5 trace added');
