// 验证 scripts/mapunit-rename.mjs 的 applyRenames：链式改名 + 失败回滚
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert';
import { applyRenames } from './mapunit-rename.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rename-test-'));
const p = (n) => path.join(dir, n);
const write = (n, body) => fs.writeFileSync(p(n), body);
const read = (n) => (fs.existsSync(p(n)) ? fs.readFileSync(p(n), 'utf8') : null);
const leftovers = () => fs.readdirSync(dir).filter((n) => n.endsWith('.renaming-tmp'));

// 用例 1：链式 a -> b -> c
write('a', 'A');
write('b', 'B');
const n1 = applyRenames([
  { from: p('a'), to: p('b') },
  { from: p('b'), to: p('c') },
]);
assert.equal(n1, 2);
assert.equal(read('a'), null);
assert.equal(read('b'), 'A');
assert.equal(read('c'), 'B');
assert.deepEqual(leftovers(), []);
console.log('case1 chain a->b->c: OK');

// 用例 2：环形 a -> b, b -> a
write('a', 'A');
write('b', 'B');
const n2 = applyRenames([
  { from: p('a'), to: p('b') },
  { from: p('b'), to: p('a') },
]);
assert.equal(n2, 2);
assert.equal(read('a'), 'B');
assert.equal(read('b'), 'A');
assert.deepEqual(leftovers(), []);
console.log('case2 cycle a<->b: OK');

// 用例 3：目标被非改名对象占用 -> 抛错且原名全部还原
write('x', 'X');
write('y', 'Y');
assert.throws(
  () => applyRenames([
    { from: p('x'), to: p('z') },
    { from: p('y'), to: p('z') }, // 第二个目标与第一个相同，第二阶段必然报冲突
  ]),
  /目标已存在/,
);
assert.equal(read('x'), 'X');
assert.equal(read('y'), 'Y');
assert.deepEqual(leftovers(), []);
console.log('case3 rollback: OK');

// 用例 4：空改动
assert.equal(applyRenames([]), 0);
console.log('case4 noop: OK');

fs.rmSync(dir, { recursive: true, force: true });
console.log('ALL PASS');
