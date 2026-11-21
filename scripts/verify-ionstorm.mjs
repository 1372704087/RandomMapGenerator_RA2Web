/**
 * 随机离子风暴（Lightning Storm）功能验收脚本。
 *
 * 用法：
 *   node scripts/verify-ionstorm.mjs
 *   RA2_API=http://127.0.0.1:3052 node scripts/verify-ionstorm.mjs
 *
 * 覆盖：
 *   1. 不开启：不写 [Triggers]/[General] Lightning*，也没有 X-Map-IonStorm
 *   2. 开启（默认 4 点位）：[General] 原版七键、[Lighting] Ion* 四键、
 *      4 组 trigger/tag/waypoint、每个点位间隔 = 平均值 × 4
 *   3. sites=1 回落为地图正中单点位
 *   4. randomize 切换 Event 51
 *   5. 点位都在图内、互不重复
 *   6. 不停用超级武器：地图里不出现 GACSPH/GAWEAT/NAIRON/NAMISL/YAGNTC/YAPPET 的段
 *   7. 参数校验（间隔/点位越界、数值非法、enabled 非布尔）
 */

const BASE = process.env.RA2_API || 'http://127.0.0.1:3000';

let pass = 0;
let fail = 0;

function check(name, ok, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}${detail ? `  ${detail}` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}${detail ? `  ${detail}` : ''}`);
  }
}

function sectionOf(mapContent, name) {
  const lines = mapContent.split(/\r?\n/);
  const start = lines.findIndex(l => l.trim() === `[${name}]`);
  if (start < 0) return null;
  const kv = {};
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('[')) break;
    const eq = line.indexOf('=');
    if (eq > 0) kv[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return kv;
}

async function generate(body) {
  const res = await fetch(`${BASE}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    return { status: res.status, error: text };
  }
  return {
    status: res.status,
    mapContent: await res.text(),
    headers: { ionStorm: res.headers.get('X-Map-IonStorm') },
  };
}

const BASE_BODY = {
  width: 150,
  height: 150,
  theaterType: 'TEMPERATE',
  playerLocations: { N: 2, S: 2 },
  seed: 7,
  lighting: { mode: 'preset', hour: 12 },
};

/** `[Waypoints]` 里 `YXXX` → {x,y} */
function parseCell(value) {
  const raw = String(value);
  return { x: Number(raw.slice(-3)), y: Number(raw.slice(0, -3)) };
}

async function run() {
  console.log(`离子风暴验收 @ ${BASE}`);

  // 1. 不开启
  const off = await generate({ ...BASE_BODY });
  {
    const map = off.mapContent ?? '';
    check('不开启：HTTP 200', off.status === 200, `status=${off.status}`);
    check('不开启：没有 X-Map-IonStorm', off.headers?.ionStorm === null, String(off.headers?.ionStorm));
    check('不开启：没有 [Triggers] 段', sectionOf(map, 'Triggers') === null);
    check('不开启：没有 [General] LightningDamage', (sectionOf(map, 'General') ?? {}).LightningDamage === undefined);
  }

  // 2. 开启（默认 4 点位）
  const on = await generate({ ...BASE_BODY, ionStorm: { enabled: true } });
  {
    check('开启：HTTP 200', on.status === 200, `status=${on.status}`);
    const map = on.mapContent ?? '';
    const general = sectionOf(map, 'General') ?? {};
    const expected = {
      LightningDamage: '250',
      LightningDeferment: '250',
      LightningStormDuration: '180',
      LightningHitDelay: '10',
      LightningCellSpread: '10',
      LightningScatterDelay: '5',
      LightningSeparation: '3',
    };
    for (const [key, value] of Object.entries(expected)) {
      check(`[General] ${key}=${value}（原版）`, general[key] === value, String(general[key]));
    }

    const lighting = sectionOf(map, 'Lighting') ?? {};
    check('[Lighting] IonAmbient=0.650000', lighting.IonAmbient === '0.650000', lighting.IonAmbient);
    check('[Lighting] IonRed=0.695000', lighting.IonRed === '0.695000', lighting.IonRed);
    check('[Lighting] IonGreen=0.445000', lighting.IonGreen === '0.445000', lighting.IonGreen);
    check('[Lighting] IonBlue=0.775000', lighting.IonBlue === '0.775000', lighting.IonBlue);

    const header = JSON.parse(on.headers.ionStorm ?? '{}');
    check('默认 4 个点位', header.siteCount === 4, String(header.siteCount));

    const triggers = sectionOf(map, 'Triggers') ?? {};
    const events = sectionOf(map, 'Events') ?? {};
    const actions = sectionOf(map, 'Actions') ?? {};
    const tags = sectionOf(map, 'Tags') ?? {};
    const waypoints = sectionOf(map, 'Waypoints') ?? {};

    check('4 个触发器', Object.keys(triggers).length === 4, String(Object.keys(triggers).length));
    check(
      '循环靠 tag 持久值 2（触发器末位 0 = 不可 transfer，不是循环标志）',
      Object.values(tags).every(v => v.startsWith('2,')) &&
        Object.values(triggers).every(v => v.endsWith(',0')),
      Object.values(tags).join(' | '),
    );
    check(
      '每个点位间隔 = 600 × 4 = 2400 秒（[Events] 带数量前缀）',
      Object.values(events).every(v => v === '1,13,0,2400'),
      Object.values(events).join(' | '),
    );
    check('4 个 tag', Object.keys(tags).length === 4, String(Object.keys(tags).length));
    const cellTags = sectionOf(map, 'CellTags') ?? {};
    const tagIds = Object.keys(tags);
    check(
      '每个 tag 都挂到一个格子（[CellTags]，否则永不评估）',
      Object.keys(cellTags).length === tagIds.length && tagIds.every(t => Object.values(cellTags).includes(t)),
      Object.entries(cellTags).map(([k, v]) => `${k}=${v}`).join(' '),
    );

    const headerSize = sectionOf(map, 'Header') ?? {};
    const W = Number(headerSize.Width);
    const H = Number(headerSize.Height);

    const siteCells = [];
    let actionOk = true;
    Object.values(actions).forEach((value, i) => {
      const parts = value.split(',');
      // [Actions] 格式：数量, 动作号, P1..P6, P7（waypoint 的字母编码）
      const id = Number(parts[1]);
      const letter = parts[8];
      const waypoint = letter.charCodeAt(0) - 65;
      if (id !== 102 || waypoint !== 16 + i) actionOk = false;
      const cell = parseCell(waypoints[String(waypoint)] ?? '');
      siteCells.push(cell);
    });
    check(
      'Action 102 依次指向 waypoint 16..19（字母 Q/R/S/T）',
      actionOk,
      Object.values(actions).join(' | '),
    );
    check(
      '点位都在图内',
      siteCells.every(c => c.x >= 0 && c.x < W && c.y >= 0 && c.y < H),
      `${W}x${H} · ${siteCells.map(c => `(${c.x},${c.y})`).join(' ')}`,
    );
    check(
      '点位互不重复',
      new Set(siteCells.map(c => `${c.x},${c.y}`)).size === siteCells.length,
    );
    check(
      '回显 sites 与地图一致',
      (header.sites ?? []).length === 4 &&
        header.sites.every((s, i) => s.x === siteCells[i].x && s.y === siteCells[i].y),
      JSON.stringify(header.sites),
    );
    check('出生点 waypoint 0 仍在', typeof waypoints['0'] === 'string' && waypoints['0'].length > 3);
  }

  // 3. sites=1 回落地图正中
  {
    const single = await generate({ ...BASE_BODY, ionStorm: { enabled: true, sites: 1, intervalSeconds: 600 } });
    const map = single.mapContent ?? '';
    const header = JSON.parse(single.headers.ionStorm ?? '{}');
    const headerSize = sectionOf(map, 'Header') ?? {};
    const center = { x: Math.floor(Number(headerSize.Width) / 2), y: Math.floor(Number(headerSize.Height) / 2) };
    check('sites=1：只有 1 个触发器', Object.keys(sectionOf(map, 'Triggers') ?? {}).length === 1);
    check(
      'sites=1：落在正中',
      header.cell?.x === center.x && header.cell?.y === center.y,
      `${JSON.stringify(header.cell)} vs ${JSON.stringify(center)}`,
    );
    check(
      'sites=1：间隔 600',
      Object.values(sectionOf(map, 'Events') ?? {})[0] === '1,13,0,600',
      Object.values(sectionOf(map, 'Events') ?? {})[0],
    );
  }

  // 4. randomize
  {
    const random = await generate({
      ...BASE_BODY,
      ionStorm: { enabled: true, intervalSeconds: 900, randomize: true, sites: 2 },
    });
    const map = random.mapContent ?? '';
    const header = JSON.parse(random.headers.ionStorm ?? '{}');
    check(
      'randomize：Event 51/1800（900 × 2）',
      Object.values(sectionOf(map, 'Events') ?? {}).every(v => v === '1,51,0,1800'),
      Object.values(sectionOf(map, 'Events') ?? {}).join(' | '),
    );
    check('randomize：回显 eventId 51', header.eventId === 51, String(header.eventId));
    check('randomize：平均间隔回显 900', header.intervalSeconds === 900, String(header.intervalSeconds));
  }

  // 5. 不动超级武器
  {
    const map = on.mapContent ?? '';
    const forbidden = ['GACSPH', 'GAWEAT', 'NAIRON', 'NAMISL', 'YAGNTC', 'YAPPET'];
    const leaked = forbidden.filter(id => new RegExp(`^\\[${id}\\]`, 'm').test(map));
    check('没有为超武建筑写段（不禁用也不强行开启）', leaked.length === 0, leaked.join(','));
    check('没有 LightningStormSpecial 段（不改闪电风暴超武定义）', sectionOf(map, 'LightningStormSpecial') === null);
  }

  // 6. 参数校验
  {
    const cases = [
      [{ ...BASE_BODY, ionStorm: { enabled: true, intervalSeconds: 5 } }, 'intervalSeconds 太小'],
      [{ ...BASE_BODY, ionStorm: { enabled: true, intervalSeconds: 9999 } }, 'intervalSeconds 太大'],
      [{ ...BASE_BODY, ionStorm: { enabled: true, sites: 0 } }, 'sites=0'],
      [{ ...BASE_BODY, ionStorm: { enabled: true, sites: 13 } }, 'sites=13'],
      [{ ...BASE_BODY, ionStorm: { enabled: true, values: { damage: 0 } } }, 'values.damage=0'],
      [{ ...BASE_BODY, ionStorm: { enabled: true, values: { nope: 1 } } }, '未知数值键'],
      [{ ...BASE_BODY, ionStorm: { enabled: 'yes' } }, 'enabled 非布尔'],
    ];
    for (const [body, label] of cases) {
      const res = await generate(body);
      check(`拒绝 ${label}（400）`, res.status === 400, `status=${res.status}`);
    }
  }

  console.log(`\n结果：${pass} pass / ${fail} fail`);
  if (fail > 0) process.exitCode = 1;
}

run().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
