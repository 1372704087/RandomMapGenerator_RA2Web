/**
 * 昼夜交替（游戏内循环切光）功能验收脚本。
 *
 * 用法：
 *   node scripts/verify-daynight.mjs
 *   RA2_API=http://127.0.0.1:3054 node scripts/verify-daynight.mjs
 *
 * 覆盖：
 *   1. 不开启：没有 X-Map-DayNight，也不写任何 trigger/tag/celltags
 *   2. 开启（默认 4 档 / 600 秒 / 6 点起）：
 *      - [Lighting] 五个基础键 = 06:00 温带锚点
 *      - 4 组 trigger / event / action / tag / celltag，键一一对应
 *      - [Events] 值以数量 1 开头，参数是各档秒数、合计 = 一轮
 *      - [Actions] 值以数量 6 开头，动作顺序 73→142/143/144→53→54、每个动作 7 参数且 P7 为字母
 *      - 环形链：只有第一档开局启用，最后一档指回第一档
 *      - 环境光百分比 = Ambient × 100
 *   3. retint=false 时每档只剩 3 个动作
 *   4. 档数 / 时长 / 开局钟点：夹取与等分
 *   5. 与静态光照、离子风暴共存：Ion* 不被删、两套 ID 不撞号
 *   6. 参数校验（错误文案固定）
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
    dayNightHeader: res.headers.get('X-Map-DayNight'),
    ionStormHeader: res.headers.get('X-Map-IonStorm'),
  };
}

const COMMON = {
  theaterType: 'TEMPERATE',
  playerLocations: { N: 2, S: 2 },
  seed: 7,
};

/** 温带 06:00 / 12:00 / 18:00 / 00:00 的 Ambient（用于对百分比） */
const AMBIENT_BY_HOUR = { 6: 0.75, 12: 1.0, 18: 0.75, 0: 0.08 };

async function main() {
  console.log(`昼夜交替验收 @ ${BASE}`);

  // ---------- 1. 不开启 ----------
  {
    const r = await generate({ ...COMMON, width: 110, height: 110 });
    check('不开启时无 X-Map-DayNight', r.dayNightHeader === null);
    check('不开启时没有 [Triggers] 段', sectionOf(r.mapContent, 'Triggers') === null);
    const cells = sectionOf(r.mapContent, 'CellTags') ?? {};
    check('不开启时没有写任何 DAY NIGHT tag',
      !Object.values(cells).some(v => v.startsWith('1611')), Object.values(cells).join(' '));
  }

  // ---------- 2. 默认开启 ----------
  const on = await generate({
    ...COMMON,
    width: 110,
    height: 110,
    dayNight: { enabled: true },
  });
  check('开启后返回 X-Map-DayNight', !!on.dayNightHeader);
  const headers = on.dayNightHeader ? JSON.parse(on.dayNightHeader) : null;
  check('回显一轮 600 秒 / 4 档', headers?.cycleSeconds === 600 && headers?.stages.length === 4);
  check(
    '回显各档钟点 6/12/18/0',
    JSON.stringify(headers?.stages.map(s => s.hour)) === JSON.stringify([6, 12, 18, 0]),
    JSON.stringify(headers?.stages.map(s => s.hour)),
  );
  check('回显事件 13、动作 [73,142,143,144,53,54]',
    headers?.eventId === 13 && JSON.stringify(headers?.actions) === JSON.stringify([73, 142, 143, 144, 53, 54]));

  const lighting = sectionOf(on.mapContent, 'Lighting');
  check('开局 [Lighting] Ambient = 06:00 锚点 0.75', lighting?.Ambient === '0.750000', lighting?.Ambient);
  check('开局 [Lighting] Blue = 06:00 锚点 0.49', lighting?.Blue === '0.490000', lighting?.Blue);

  const triggers = sectionOf(on.mapContent, 'Triggers') ?? {};
  const events = sectionOf(on.mapContent, 'Events') ?? {};
  const actions = sectionOf(on.mapContent, 'Actions') ?? {};
  const tags = sectionOf(on.mapContent, 'Tags') ?? {};
  const cellTags = sectionOf(on.mapContent, 'CellTags') ?? {};

  check('4 组 trigger', Object.keys(triggers).length === 4, String(Object.keys(triggers).length));
  check('4 组 event / action / tag / celltag',
    Object.keys(events).length === 4 && Object.keys(actions).length === 4 &&
    Object.keys(tags).length === 4 && Object.keys(cellTags).length === 4,
    `${Object.keys(events).length}/${Object.keys(actions).length}/${Object.keys(tags).length}/${Object.keys(cellTags).length}`);

  const ids = Object.keys(triggers);
  check('触发器 ID 全为 8 位数字（无十六进制字母）', ids.every(id => /^\d{8}$/.test(id)), ids.join(','));
  check('第一档开局启用、其余禁用',
    triggers[ids[0]].split(',')[3] === '0' &&
    ids.slice(1).every(id => triggers[id].split(',')[3] === '1'));

  const perStage = 600 / 4;
  check('每档 [Events] 以数量 1 开头且时长为 150 秒',
    ids.every(id => events[id] === `1,13,0,${perStage}`), events[ids[0]]);

  const actionFieldCount = actions[ids[0]].split(',').length;
  check('[Actions] 以数量 6 开头', actions[ids[0]].split(',')[0] === '6');
  check('[Actions] 每条 6 个动作 × 8 字段 + 1 位数量', actionFieldCount === 1 + 6 * 8, String(actionFieldCount));

  const actIds = [0, 1, 2, 3, 4, 5].map(b => Number(actions[ids[0]].split(',')[1 + b * 8]));
  check('动作顺序 73 → 142 → 143 → 144 → 53 → 54',
    JSON.stringify(actIds) === JSON.stringify([73, 142, 143, 144, 53, 54]), actIds.join(','));

  const p7 = [0, 1, 2, 3, 4, 5].map(b => actions[ids[0]].split(',')[1 + b * 8 + 7]);
  check('六个动作的 P7 都是字母 A', p7.every(x => x === 'A'), p7.join(','));

  const chainOk = ids.every((id, i) => {
    const next = ids[(i + 1) % ids.length];
    const fields = actions[id].split(',');
    return fields.includes(next) && fields.includes(id);
  });
  check('环形链：每档启用下一档并禁用自己（最后一档指回第一档）', chainOk);

  const envOk = ids.every((id, i) => {
    const fields = actions[id].split(',');
    const pct = Number(fields[3]);
    const hour = headers.stages[i].hour;
    return pct === Math.round(AMBIENT_BY_HOUR[hour] * 100);
  });
  check('环境光百分比 = 各档 Ambient × 100', envOk, ids.map((id, i) => `${AMBIENT_BY_HOUR[headers.stages[i].hour] * 100}`).join(','));

  check('4 档 tag 都挂到了各自独立格子',
    Object.keys(cellTags).length === 4 && new Set(Object.keys(cellTags)).size === 4,
    Object.keys(cellTags).join(' '));

  // ---------- 3. retint=false ----------
  {
    const r = await generate({
      ...COMMON, width: 110, height: 110,
      dayNight: { enabled: true, retint: false },
    });
    const acts = sectionOf(r.mapContent, 'Actions') ?? {};
    const first = Object.values(acts)[0] ?? '';
    check('retint=false 每档只剩数量 3 的动作', first.split(',')[0] === '3', first.slice(0, 24));
    check('retint=false 不再写 142/143/144',
      !first.split(',').includes('142') && !first.split(',').includes('143') && !first.split(',').includes('144'));
  }

  // ---------- 4. 边界值与等分 ----------
  {
    const r = await generate({
      ...COMMON, width: 110, height: 110,
      dayNight: { enabled: true, cycleSeconds: 7200, stages: 8, startHour: 18 },
    });
    const h = JSON.parse(r.dayNightHeader);
    check('上限 7200 秒 / 8 档被接受', h.cycleSeconds === 7200 && h.stages.length === 8, `${h.cycleSeconds}/${h.stages.length}`);
    check('startHour=18 → 首档 18 点', h.stages[0].hour === 18, String(h.stages[0].hour));
    const total = h.stages.reduce((s, x) => s + x.seconds, 0);
    check('各档时长合计 = 一轮', total === 7200, String(total));
  }
  {
    const r = await generate({
      ...COMMON, width: 110, height: 110,
      dayNight: { enabled: true, cycleSeconds: 60, stages: 2, startHour: 0 },
    });
    const h = JSON.parse(r.dayNightHeader);
    check('下限 60 秒 / 2 档被接受', h.cycleSeconds === 60 && h.stages.length === 2, `${h.cycleSeconds}/${h.stages.length}`);
    check('stages=2 + startHour=0 → 两档是 00 点 / 12 点',
      h.stages[0].hour === 0 && h.stages[1].hour === 12,
      h.stages.map(s => s.hour).join(','));
    const l = sectionOf(r.mapContent, 'Lighting');
    check('stages=2 + startHour=0 → 开局 [Lighting] 是深夜 0.08', l?.Ambient === '0.080000', l?.Ambient);
  }

  // ---------- 4b. 24 档 = 逐整点走一遍 ----------
  {
    const r = await generate({
      ...COMMON, width: 110, height: 110,
      dayNight: { enabled: true, cycleSeconds: 1440, stages: 24, startHour: 0 },
    });
    const h = JSON.parse(r.dayNightHeader);
    check('24 档被接受', h.stages.length === 24, String(h.stages.length));
    const hours = h.stages.map(s => s.hour);
    check('24 档覆盖 00…23 且不重复',
      new Set(hours).size === 24 && hours.every((v, i) => v === i), hours.join(','));
    check('24 档 / 1440 秒 → 每档 60 秒', h.stages.every(s => s.seconds === 60), h.stages.map(s => s.seconds).join(','));
    const trig = sectionOf(r.mapContent, 'Triggers') ?? {};
    const tags = sectionOf(r.mapContent, 'Tags') ?? {};
    const cells = sectionOf(r.mapContent, 'CellTags') ?? {};
    check('24 组 trigger / tag / celltag 全写全',
      Object.keys(trig).length === 24 && Object.keys(tags).length === 24 && Object.keys(cells).length === 24,
      `${Object.keys(trig).length}/${Object.keys(tags).length}/${Object.keys(cells).length}`);
    check('24 个 celltag 的格子互不相同', Object.keys(cells).length === 24 &&
      new Set(Object.keys(cells)).size === 24, Object.keys(cells).join(' '));
    const acts = sectionOf(r.mapContent, 'Actions') ?? {};
    const last = (acts['16100023'] ?? '').split(',');
    check('24 档首尾相接（末档 53 指回 16100000）', last[33] === '53' && last[35] === '16100000', last.slice(33, 36).join(','));
    const mid = (acts['16100012'] ?? '').split(',');
    check('中段 12 点档环境光 = 100%', mid[3] === '100', mid[3]);
  }

  // ---------- 5. 与光照 / 离子风暴共存 ----------
  {
    const r = await generate({
      ...COMMON, width: 150, height: 150, seed: 11,
      lighting: { mode: 'preset', hour: 12 },
      dayNight: { enabled: true, cycleSeconds: 900, stages: 4 },
      ionStorm: { enabled: true, sites: 4, intervalSeconds: 600 },
    });
    const l = sectionOf(r.mapContent, 'Lighting') ?? {};
    check('昼夜交替接管 [Lighting]（覆盖静态 preset 的 12 点）', l.Ambient === '0.750000', l.Ambient);
    check('离子风暴的 Ion* 四键仍在', !!l.IonAmbient && !!l.IonBlue, `${l.IonAmbient}/${l.IonBlue}`);
    const trig = sectionOf(r.mapContent, 'Triggers') ?? {};
    check('两套触发器共存（4 昼夜 + 4 风暴 = 8）', Object.keys(trig).length === 8, String(Object.keys(trig).length));
    const acts = sectionOf(r.mapContent, 'Actions') ?? {};
    check('风暴动作第一条 P7 是字母（waypoint 16 → Q）',
      (acts['0E000000'] ?? '').split(',')[8] === 'Q', acts['0E000000']);
    const cells = sectionOf(r.mapContent, 'CellTags') ?? {};
    check('8 个 celltag 互不冲突', Object.keys(cells).length === 8, String(Object.keys(cells).length));
  }

  // ---------- 6. 参数校验 ----------
  const bad = [
    [{ dayNight: 5 }, 'dayNight must be an object'],
    [{ dayNight: { enabled: 'yes' } }, 'dayNight.enabled must be a boolean'],
    [{ dayNight: { enabled: true, cycleSeconds: 5 } }, 'dayNight.cycleSeconds must be an integer between 60 and 7200'],
    [{ dayNight: { enabled: true, cycleSeconds: 999999 } }, 'dayNight.cycleSeconds must be an integer between 60 and 7200'],
    [{ dayNight: { enabled: true, stages: 1 } }, 'dayNight.stages must be an integer between 2 and 24'],
    [{ dayNight: { enabled: true, stages: 99 } }, 'dayNight.stages must be an integer between 2 and 24'],
    [{ dayNight: { enabled: true, startHour: 24 } }, 'dayNight.startHour must be an integer between 0 and 23'],
    [{ dayNight: { enabled: true, startHour: -1 } }, 'dayNight.startHour must be an integer between 0 and 23'],
    [{ dayNight: { enabled: true, retint: 'no' } }, 'dayNight.retint must be a boolean'],
    [{ dayNight: { enabled: true, cycleSeconds: 90.5 } }, 'dayNight.cycleSeconds must be an integer between 60 and 7200'],
  ];
  for (const [extra, expected] of bad) {
    const r = await generate({ ...COMMON, width: 110, height: 110, ...extra });
    check(`非法参数 400：${expected}`, r.status === 400 && (r.error ?? '').includes(expected), `status=${r.status}`);
  }

  console.log(`\n结果：${pass} pass / ${fail} fail`);
  if (fail > 0) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
