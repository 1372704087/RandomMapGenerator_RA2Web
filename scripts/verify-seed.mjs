// 切片管线的种子复现性验收：同种子 3 次逐字节一致；换种子不同；不给种子但回显的种子可复现
//   node scripts/verify-seed.mjs            # 默认打 http://127.0.0.1:3000
//   RA2_API=http://127.0.0.1:3047 node scripts/verify-seed.mjs
import crypto from 'node:crypto';

const base = process.env.RA2_API ?? 'http://127.0.0.1:3000';
const sha = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);

async function gen(body) {
  const res = await fetch(`${base}/api/generate`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return { sha: sha(text), seed: res.headers.get('x-map-seed'), len: text.length };
}

const baseBody = { width: 77, height: 85, theaterType: 'DESERT', playerLocations: { N: 1, S: 1 } };

console.log('--- 1. 固定种子 3 次 ---');
const a1 = await gen({ ...baseBody, seed: 424242 });
const a2 = await gen({ ...baseBody, seed: 424242 });
const a3 = await gen({ ...baseBody, seed: 424242 });
console.log(`  ${a1.sha} / ${a2.sha} / ${a3.sha}  len=${a1.len}  identical=${a1.sha === a2.sha && a2.sha === a3.sha}`);

console.log('--- 2. 换种子 ---');
const b1 = await gen({ ...baseBody, seed: 777 });
console.log(`  seed=777 -> ${b1.sha}  differs=${b1.sha !== a1.sha}`);

console.log('--- 3. 不给种子：回显的种子应能复现 ---');
const n1 = await gen(baseBody);
const n2 = await gen({ ...baseBody, seed: Number(n1.seed) });
console.log(`  随机 ${n1.sha}（seed=${n1.seed}）/ 用该种子重放 ${n2.sha}  replayable=${n1.sha === n2.sha}`);

console.log('--- 4. totalRandom + 固定种子 ---');
const t1 = await gen({ width: 0, height: 0, theaterType: 'DESERT', totalRandom: true, seed: 555 });
const t2 = await gen({ width: 0, height: 0, theaterType: 'DESERT', totalRandom: true, seed: 555 });
console.log(`  ${t1.sha} vs ${t2.sha}  identical=${t1.sha === t2.sha}`);

console.log('--- 5. 损坏建筑 + 固定种子 ---');
const d1 = await gen({ ...baseBody, seed: 99, damagedBuilding: true });
const d2 = await gen({ ...baseBody, seed: 99, damagedBuilding: true });
console.log(`  ${d1.sha} vs ${d2.sha}  identical=${d1.sha === d2.sha}`);

console.log('--- 6. 非法种子 ---');
const bad = await fetch(`${base}/api/generate`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ ...baseBody, seed: 1.5 }),
});
console.log(`  seed=1.5 -> HTTP ${bad.status} ${(await bad.text()).slice(0, 80)}`);
