/**
 * VERA20k 上限验收脚本（30 人 / 512 边长 / 宽+高 ≤ 1024 / 正向每方向 ≤ 4）。
 *
 * 用法：node scripts/verify-limits.mjs（默认 http://127.0.0.1:3055）
 *
 * 覆盖：
 *   1. GET /api/limits 与 limits.ts 的单一数据源一致，并带引擎出处
 *   2. 30 人真实生成：NumberStartingPoints=30、[Basic] MaxPlayers/MinPlayers 都写了、
 *      [Waypoints] 0..29 全部有坐标（否则引擎的 skirmish_player_capacity 会回落 8）
 *   3. 31/32 人被拒，且报错里点明 NETWORK_PLAYER_SLOT_COUNT=30 会回落 8
 *   4. 正向单方向 > 4 被拒（PlacePlayerLocation 只实现了 4 组偏移）
 *   5. 尺寸越界被拒：单边 513、宽+高 1025
 *   6. 原版（非 VERA20k）9 人被拒、8 人可生成
 */

const BASE = process.env.RA2_API || 'http://127.0.0.1:3055';

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}${detail ? `  ${detail}` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}${detail ? `  ${detail}` : ''}`);
  }
};

const errorText = body => {
  try {
    const j = JSON.parse(body);
    return typeof j.error === 'string' ? j.error : body;
  } catch {
    return body;
  }
};

async function generate(body) {
  const res = await fetch(`${BASE}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

function sectionKV(mapContent, name) {
  const lines = mapContent.split(/\r?\n/);
  const start = lines.findIndex(l => l.trim() === `[${name}]`);
  if (start < 0) return {};
  const kv = {};
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('[')) break;
    const eq = line.indexOf('=');
    if (eq > 0) kv[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return kv;
}

const VERA_BASE = {
  width: 500,
  height: 500,
  theaterType: 'TEMPERATE',
  vera20k: true,
  seed: 7,
  playerLocations: { N: 4, S: 4, W: 4, E: 4, NE: 4, SE: 4, NW: 3, SW: 3 },
};

async function main() {
  console.log(`Base: ${BASE}`);

  console.log('\n[1] /api/limits');
  const limRes = await fetch(`${BASE}/api/limits`);
  const limJson = await limRes.json();
  check('200', limRes.ok, `status=${limRes.status}`);
  const lim = limJson.limits || {};
  check('maxPlayersVera20k = 30', lim.maxPlayersVera20k === 30, `got ${lim.maxPlayersVera20k}`);
  check('vera20kMaxSide = 512', lim.vera20kMaxSide === 512, `got ${lim.vera20kMaxSide}`);
  check('vera20kMaxSpan = 1024', lim.vera20kMaxSpan === 1024, `got ${lim.vera20kMaxSpan}`);
  check('maxPlayersCardinal = 4', lim.maxPlayersCardinal === 4, `got ${lim.maxPlayersCardinal}`);
  check(
    '带引擎出处（NETWORK_PLAYER_SLOT_COUNT）',
    String(limJson.provenance?.maxPlayersVera20k || '').includes('NETWORK_PLAYER_SLOT_COUNT'),
    String(limJson.provenance?.maxPlayersVera20k),
  );

  console.log('\n[2] 30 人真实生成');
  const gen = await generate(VERA_BASE);
  check('生成成功', gen.status === 200, `status=${gen.status}`);
  const map = gen.body;
  const header = sectionKV(map, 'Header');
  const basic = sectionKV(map, 'Basic');
  const wp = sectionKV(map, 'Waypoints');
  check('NumberStartingPoints = 30', header.NumberStartingPoints === '30', `got ${header.NumberStartingPoints}`);
  check('[Basic] MaxPlayer = 30', basic.MaxPlayer === '30', `got ${basic.MaxPlayer}`);
  check('[Basic] MaxPlayers = 30', basic.MaxPlayers === '30', `got ${basic.MaxPlayers}`);
  check('[Basic] MinPlayers 存在', basic.MinPlayers !== undefined, `got ${basic.MinPlayers}`);
  check('[Waypoints] 恰好 30 条', Object.keys(wp).length === 30, `got ${Object.keys(wp).length}`);
  const allAuthors =
    Object.keys(wp).length === 30 &&
    Object.keys(wp).every(k => wp[k] && wp[k] !== '0' && wp[k] !== '-1');
  check('30 个出生点全部有坐标（否则引擎回落 8 人）', allAuthors);
  check(
    '[Header] Waypoint1..Waypoint30 都写了',
    Array.from({ length: 30 }, (_, i) => `Waypoint${i + 1}`).every(k => header[k] !== undefined),
    Object.keys(header).filter(k => k.startsWith('Waypoint')).length + ' 条',
  );

  console.log('\n[3] 31 / 32 人');
  for (const players of [31, 32]) {
    const locs =
      players === 31
        ? { N: 4, S: 4, W: 4, E: 4, NE: 4, SE: 4, NW: 4, SW: 3 }
        : { N: 4, S: 4, W: 4, E: 4, NE: 4, SE: 4, NW: 4, SW: 4 };
    const r = await generate({ ...VERA_BASE, playerLocations: locs });
    const msg = errorText(r.body);
    check(
      `${players} 人被拒（400）`,
      r.status === 400 && msg.includes(`must not exceed 30`),
      `status=${r.status} msg=${msg}`,
    );
    check(
      `${players} 人报错点明引擎上限 30 / 回落 8`,
      msg.includes('NETWORK_PLAYER_SLOT_COUNT = 30') && msg.includes('8'),
      msg.slice(0, 160),
    );
  }

  console.log('\n[4] 正向单方向 > 4');
  const card = await generate({
    ...VERA_BASE,
    playerLocations: { N: 5, S: 4, W: 4, E: 4, NE: 4, SE: 3, NW: 3, SW: 3 },
  });
  check(
    'N=5 被拒',
    card.status === 400 && errorText(card.body).includes('at most 4'),
    `status=${card.status} msg=${errorText(card.body)}`,
  );

  console.log('\n[5] 尺寸越界');
  const side = await generate({ ...VERA_BASE, width: 513, height: 500 });
  check(
    '513 边长被拒',
    side.status === 400 && errorText(side.body).includes('each side <= 512'),
    `status=${side.status} msg=${errorText(side.body)}`,
  );
  const span = await generate({ ...VERA_BASE, width: 512, height: 513 });
  check(
    '宽+高 1025 被拒',
    span.status === 400 && errorText(span.body).includes('width+height <= 1024'),
    `status=${span.status} msg=${errorText(span.body)}`,
  );

  console.log('\n[6] 原版（非 VERA20k）');
  const retail9 = await generate({
    ...VERA_BASE,
    vera20k: false,
    width: 120,
    height: 120,
    playerLocations: { N: 2, S: 2, W: 2, E: 2, NE: 1 },
  });
  check(
    '9 人被拒（原版上限 8）',
    retail9.status === 400 && errorText(retail9.body).includes('must not exceed 8'),
    `status=${retail9.status}`,
  );
  const retail8 = await generate({
    ...VERA_BASE,
    vera20k: false,
    width: 120,
    height: 120,
    playerLocations: { N: 2, S: 2, W: 2, E: 2 },
  });
  check('8 人可生成', retail8.status === 200, `status=${retail8.status}`);

  console.log(`\n${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
