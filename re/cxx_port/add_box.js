const fs = require('fs');
const p = 'packages/core/src/rmg/cxx/types.ts';
let s = fs.readFileSync(p, 'utf8');
if (!s.includes('Box<')) {
  const anchor = 'export enum LandType {';
  const ins = `/** Mutable box for C++ T* in/out parameters. */
export interface Box<T> { v: T }
export const box = <T,>(v: T): Box<T> => ({ v });

`;
  s = s.replace(anchor, ins + anchor);
  fs.writeFileSync(p, s);
  console.log('Box added');
} else console.log('already present');
