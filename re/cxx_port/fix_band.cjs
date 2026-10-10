const fs = require('fs');
const p = 'packages/core/src/rmg/cxx/makingSub.ts';
let s = fs.readFileSync(p, 'utf8');
const oldBand = `        if (ady > 0) {
            const belowZero = dy < 0 ? 1 : 0;             // v71
            let counter = 0;                              // pMapCoord_
            let previous = 0;                             // pMapCoord__2
            let mirror = 0;                               // Y, the column offset
            do {
                const column = side !== 0 ? mirror : previous;      // Y_1
                for (let i = 0; i < 5; ++i) {
                    const cx = i16(
                        previous + toX + 3 + stripBias);  // v74 + v70
                    const cy = i16(
                        column + belowZero + toY - i);    // Y_1 + WORD1
                    const cell = r.cellAt(i16(cx), i16(cy));
                    cell.level = ownerLevel + K_LEVEL_OFFSETS[i]! - 4;   // 0x5922xx
                    const slopeByte = K_SLOPE_OFFSETS[side]![i]!;
                    cell.slopeIndex = slopeByte;          // 0x5922xx
                    cell.height = 0;
                    cell.isoTileTypeIndex = slopeByte + r.rampBaseIndex - 1;
                }
                ++counter;                                // 0x5923xx
                previous = counter;
                --mirror;
            } while (counter < ady);
        }`;
const newBand = `        if (ady > 0) {
            // [EXE-MATCH] 0x140023105 - 0x140023247: the band rows use CHAINED
            // registers - X_i = prevY + stripBias + toX + 3 (ecx carries the
            // previous cell's Y; 0 for the first cell), and
            // Y_i = belowZero - i + (prevY > 0 ? rowCounter : prevY) + toY - 1
            // (r13d reloads [rsp+44h] = owner.level inside the loop, so the
            // level term stays ownerLevel + T1[i] - 4). The drifted text's
            // column/mirror geometry stamps the band one row too low.
            const belowZero = dy < 0 ? 1 : 0;             // v71 (r14w = sign of dy)
            let ecx = 0;                                  // chains the previous Y
            let rowCounter = 0;                           // r12d, -1 per row
            let row = 0;                                  // ebp
            do {
                for (let i = 0; i < 5; ++i) {
                    const cx = i16(ecx + stripBias + toX + 3);
                    const cy = i16(belowZero - i + (ecx > 0 ? rowCounter : ecx) + toY - 1);
                    const cell = r.cellAt(cx, cy);
                    cell.level = ownerLevel + K_LEVEL_OFFSETS[i]! - 4;   // 0x5922xx
                    const slopeByte = K_SLOPE_OFFSETS[side]![i]!;
                    cell.slopeIndex = slopeByte;          // 0x5922xx
                    cell.height = 0;
                    cell.isoTileTypeIndex = slopeByte + r.rampBaseIndex - 1;
                    ecx = cy;                             // mov ecx, r8d
                }
                --rowCounter;                             // dec r12d
                ++row;
            } while (row < ady);
        }`;
if (!s.includes(oldBand)) { console.error('band anchor not found'); process.exit(1); }
s = s.replace(oldBand, newBand);
fs.writeFileSync(p, s);
console.log('band rewritten');
