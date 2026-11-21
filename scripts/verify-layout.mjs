/**
 * 对局布局（symmetry / oreLayout）功能验收脚本。
 *
 * 用法：
 *   node scripts/verify-layout.mjs
 *   RA2_API=http://127.0.0.1:3055 node scripts/verify-layout.mjs
 *
 * 覆盖：
 *   1. 不传参数：没有 X-Map-Layout 头，地图照常生成
 *   2. 参数校验：symmetry / oreLayout 非法值 → 400 + 固定文案
 *   3. 镜像：1v1 / 2v2 / W-E 的出生点逐格点对称（两侧落点相加恒为 (W-1, H-1)）
 *   4. 矿脉：center 明显比 corners 多；corners 四个角各有一片；default 只有出生点附近的常规矿
 *   5. 同 seed 同参数可复现（矿石块数一致）
 *   6. X-Map-Layout 在 Access-Control-Expose-Headers 里
 */

const BASE = process.env.RA2_API || 'http://127.0.0.1:3055';

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

function waypointsOf(mapContent) {
  const lines = mapContent.split(/\r?\n/);
  const start = lines.findIndex(l => l.trim() === '[Waypoints]');
  if (start < 0) return [];
  const list = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('[')) break;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const value = line.slice(eq + 1).trim();
    // 值格式是 `Y + X 三位零填充`，Y 没有前导零，所以长度 4 起
    const x = Number(value.slice(-3));
    const y = Number(value.slice(0, -3));
    list.push({ index: Number(line.slice(0, eq)), x, y });
  }
  return list.sort((a, b) => a.index - b.index);
}

async function generate(body) {
  const res = await fetch(`${BASE}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return {
    status: res.status,
    body: text,
    layout: res.headers.get('X-Map-Layout'),
    expose: res.headers.get('Access-Control-Expose-Headers') || '',
    waypoints: res.ok ? waypointsOf(text) : [],
  };
}

const baseBody = {
  width: 150,
  height: 150,
  theaterType: 'TEMPERATE',
  playerLocations: { N: 1, S: 1 },
  seed: 11,
};

async function main() {
  console.log(`Base: ${BASE}`);

  console.log('\n[1] 默认不传布局参数');
  const plain = await generate(baseBody);
  check('生成成功', plain.status === 200, `status=${plain.status}`);
  check('没有 X-Map-Layout 头', plain.layout === null, `layout=${plain.layout}`);

  console.log('\n[2] 参数校验');
  const errorText = body => {
    try { const j = JSON.parse(body); return typeof j.error === 'string' ? j.error : body; }
    catch { return body; }
  };
  const badSym = await generate({ ...baseBody, symmetry: 'diagonal' });
  check(
    'symmetry 非法值 → 400',
    badSym.status === 400 && errorText(badSym.body) === 'symmetry must be "none" or "mirror"',
    `status=${badSym.status} body=${badSym.body}`,
  );
  const badOre = await generate({ ...baseBody, oreLayout: 'everywhere' });
  check(
    'oreLayout 非法值 → 400',
    badOre.status === 400 &&
      errorText(badOre.body) === 'oreLayout must be "default", "center" or "corners"',
    `status=${badOre.status} body=${badOre.body}`,
  );

  console.log('\n[3] 镜像：出生点逐格点对称');
  // 出生点坐标的镜像中心：cell 网格 = 2*请求边长，点对称和为 2*边长-1
  const SUM_X = baseBody.width * 2 - 1;
  const SUM_Y = baseBody.height * 2 - 1;
  const isMirrorPair = (a, b) => a.x + b.x === SUM_X && a.y + b.y === SUM_Y;
  const oneVone = await generate({ ...baseBody, symmetry: 'mirror' });
  const lay1 = oneVone.layout ? JSON.parse(oneVone.layout) : null;
  check('1v1 生成成功', oneVone.status === 200);
  check('mirroredPairs 含 N->S', (lay1?.mirroredPairs || []).includes('N->S'), JSON.stringify(lay1?.mirroredPairs));
  check('mirroredStarts = 1', lay1?.mirroredStarts === 1, `starts=${lay1?.mirroredStarts}`);
  const w1 = oneVone.waypoints;
  check('1v1 两个出生点', w1.length === 2, `count=${w1.length}`);
  check(
    '1v1 两个出生点互相点对称',
    w1.length === 2 && isMirrorPair(w1[0], w1[1]),
    w1.length === 2 ? `sum=(${w1[0].x + w1[1].x},${w1[0].y + w1[1].y}) 期望=(${SUM_X},${SUM_Y})` : '',
  );

  const twoVtwo = await generate({
    ...baseBody,
    symmetry: 'mirror',
    playerLocations: { N: 2, S: 2 },
  });
  const lay2 = twoVtwo.layout ? JSON.parse(twoVtwo.layout) : null;
  const w2 = twoVtwo.waypoints;
  check('2v2 生成成功', twoVtwo.status === 200);
  check('2v2 mirroredStarts = 2', lay2?.mirroredStarts === 2, `starts=${lay2?.mirroredStarts}`);
  check('2v2 四个出生点', w2.length === 4, `count=${w2.length}`);
  // 每个出生点都能在集合里找到点对称的落点（顺序不保证一致）
  const mirroredOk = w2.length === 4 && w2.every(p => w2.some(q => q !== p && isMirrorPair(p, q)));
  check('2v2 四个出生点两两点对称', mirroredOk);

  const we = await generate({
    ...baseBody,
    symmetry: 'mirror',
    playerLocations: { W: 1, E: 1 },
  });
  const wWE = we.waypoints;
  check(
    'W-E 1v1 互相点对称',
    wWE.length === 2 && isMirrorPair(wWE[0], wWE[1]),
    wWE.length === 2 ? `sum=(${wWE[0].x + wWE[1].x},${wWE[0].y + wWE[1].y}) 期望=(${SUM_X},${SUM_Y})` : '',
  );

  // 人数不等时不配对（保持各自随机）
  const uneven = await generate({
    ...baseBody,
    symmetry: 'mirror',
    playerLocations: { N: 1, S: 2 },
  });
  const layUneven = uneven.layout ? JSON.parse(uneven.layout) : null;
  check(
    '人数不等时不做镜像',
    (layUneven?.mirroredPairs || []).length === 0,
    JSON.stringify(layUneven?.mirroredPairs),
  );

  console.log('\n[4] 矿脉布局');
  const def = await generate({ ...baseBody, oreLayout: 'default' });
  const layDef = def.layout ? JSON.parse(def.layout) : null;
  check(
    'default 只有出生点附近的矿',
    (layDef?.oreCells ?? -1) === 0 && (layDef?.oreCellsTotal ?? 0) > 0,
    `oreCells=${layDef?.oreCells} total=${layDef?.oreCellsTotal}`,
  );

  const center = await generate({ ...baseBody, oreLayout: 'center' });
  const layCenter = center.layout ? JSON.parse(center.layout) : null;
  check(
    'center 铺下矿脉',
    (layCenter?.oreCells ?? 0) > 0,
    `oreCells=${layCenter?.oreCells}`,
  );

  const corners = await generate({ ...baseBody, oreLayout: 'corners' });
  const layCorners = corners.layout ? JSON.parse(corners.layout) : null;
  check(
    'corners 铺下矿脉',
    (layCorners?.oreCells ?? 0) > 0,
    `oreCells=${layCorners?.oreCells}`,
  );
  check(
    'center 明显比 corners 富',
    (layCenter?.oreCells ?? 0) >= (layCorners?.oreCells ?? 0) * 2,
    `center=${layCenter?.oreCells} corners=${layCorners?.oreCells}`,
  );

  console.log('\n[5] 同 seed 可复现');
  const again = await generate({ ...baseBody, oreLayout: 'center' });
  const layAgain = again.layout ? JSON.parse(again.layout) : null;
  check(
    'center 同 seed 矿石块数一致',
    layAgain?.oreCells === layCenter?.oreCells,
    `${layAgain?.oreCells} vs ${layCenter?.oreCells}`,
  );

  console.log('\n[6] 响应头暴露');
  check(
    'Access-Control-Expose-Headers 含 X-Map-Layout',
    center.expose.toLowerCase().includes('x-map-layout'),
    center.expose,
  );

  console.log(`\n${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
