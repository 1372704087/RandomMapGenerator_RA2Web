/**
 * 环境光照（[Lighting]）功能验收脚本。
 *
 * 用法：
 *   node scripts/verify-lighting.mjs                    # 默认打 http://127.0.0.1:3000
 *   RA2_API=http://127.0.0.1:3048 node scripts/verify-lighting.mjs
 *
 * 覆盖：
 *   1. /api/lighting/presets 预设表（5 环境 × 4 时段）
 *   2. 各 theater 的 auto 行为（沙漠有 [Lighting]，其余没有）
 *   3. preset 模式四档时间（温带 / 非温带两张表）
 *   4. random 模式抖动 + 种子复现
 *   5. custom 模式通道覆盖
 *   6. 参数校验（非法模式 / 时段 / 通道值）
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

/** 取 [Lighting] 段的键值；没有该段返回 null。 */
function lightingOf(mapContent) {
  const lines = mapContent.split(/\r?\n/);
  const start = lines.findIndex(l => l.trim() === '[Lighting]');
  if (start < 0) return null;
  const kv = {};
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('[')) break;
    const eq = line.indexOf('=');
    if (eq > 0) kv[line.slice(0, eq).trim()] = Number(line.slice(eq + 1));
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
  const mapContent = await res.text();
  return {
    status: res.status,
    mapContent,
    seed: res.headers.get('X-Map-Seed'),
    lightingHeader: res.headers.get('X-Map-Lighting'),
  };
}

function baseBody(extra) {
  return {
    width: 77,
    height: 85,
    theaterType: 'TEMPERATE',
    playerLocations: { N: 1, S: 1 },
    seed: 1,
    ...extra,
  };
}

function fmt(v) {
  return v === undefined || v === null ? '-' : Number(v).toFixed(6);
}

async function main() {
  console.log(`靶机：${BASE}\n`);

  // ---------------------------------------------------------------- 1. 预设表
  console.log('[1] /api/lighting/presets');
  const presetsRes = await fetch(`${BASE}/api/lighting/presets`);
  check('预设表接口 200', presetsRes.status === 200, `HTTP ${presetsRes.status}`);
  const presets = await presetsRes.json();
  check('环境主题数 = 5', presets.environments.length === 5, `实际 ${presets.environments.length}`);
  check('每个环境 4 档时段',
    presets.environments.every(e => e.presets.length === 4),
    presets.environments.map(e => `${e.id}:${e.presets.length}`).join(' '));
  check('每个环境都有 24 整点', presets.environments.every(e => e.hourly.length === 24),
    presets.environments.map(e => `${e.id}:${e.hourly?.length}`).join(' '));
  check('hours 列表 24 项', presets.hours?.length === 24, `实际 ${presets.hours?.length}`);
  for (const env of presets.environments) {
    const row = env.presets
      .map(p => `t${p.timeOfDay} A${fmt(p.values.Ambient)} R${fmt(p.values.Red)} G${fmt(p.values.Green)} B${fmt(p.values.Blue)}`)
      .join(' | ');
    console.log(`    ${env.id.padEnd(10)} ${row}`);
  }
  const temperateHourly = presets.environments.find(e => e.id === 'temperate').hourly;
  console.log('    temperate 逐 3 小时：' +
    temperateHourly.filter(h => h.hour % 3 === 0)
      .map(h => `${String(h.hour).padStart(2, '0')}:00 A${fmt(h.values.Ambient)} R${fmt(h.values.Red)} G${fmt(h.values.Green)} B${fmt(h.values.Blue)}`)
      .join(' | '));

  // ------------------------------------------------------- 2. auto 行为（原版）
  console.log('\n[2] auto 模式（不传 lighting）');
  const autoTemperate = await generate(baseBody({ theaterType: 'TEMPERATE', seed: 11 }));
  check('TEMPERATE 不写 [Lighting]', lightingOf(autoTemperate.mapContent) === null);
  const autoSnow = await generate(baseBody({ theaterType: 'SNOW', seed: 11 }));
  check('SNOW 不写 [Lighting]', lightingOf(autoSnow.mapContent) === null);
  const autoNewurban = await generate(baseBody({ theaterType: 'NEWURBAN', seed: 11 }));
  check('NEWURBAN 不写 [Lighting]', lightingOf(autoNewurban.mapContent) === null);
  const autoDesert = await generate(baseBody({ theaterType: 'DESERT', seed: 11 }));
  check('DESERT 仍随机写 [Lighting]', lightingOf(autoDesert.mapContent) !== null,
    JSON.stringify(lightingOf(autoDesert.mapContent)));

  // ------------------------------------------------------- 3. preset 四档
  console.log('\n[3] preset 模式（温带 / 雪地 四档）');
  const temperatePresets = presets.environments.find(e => e.id === 'temperate').presets;
  for (const p of temperatePresets) {
    const r = await generate(baseBody({
      theaterType: 'TEMPERATE',
      seed: 7,
      lighting: { mode: 'preset', timeOfDay: p.timeOfDay },
    }));
    const got = lightingOf(r.mapContent);
    const ok = got !== null &&
      Math.abs(got.Ambient - p.values.Ambient) < 1e-6 &&
      Math.abs(got.Red - p.values.Red) < 1e-6 &&
      Math.abs(got.Green - p.values.Green) < 1e-6 &&
      Math.abs(got.Blue - p.values.Blue) < 1e-6 &&
      Math.abs(got.Level - p.values.Level) < 1e-6;
    check(`TEMPERATE preset t${p.timeOfDay}`, ok, JSON.stringify(got));
  }
  const snowPresets = presets.environments.find(e => e.id === 'snow').presets;
  for (const p of [snowPresets[0], snowPresets[3]]) {
    const r = await generate(baseBody({
      theaterType: 'SNOW',
      seed: 7,
      lighting: { mode: 'preset', timeOfDay: p.timeOfDay },
    }));
    const got = lightingOf(r.mapContent);
    const ok = got !== null &&
      Math.abs(got.Ambient - p.values.Ambient) < 1e-6 &&
      Math.abs(got.Red - p.values.Red) < 1e-6 &&
      Math.abs(got.Green - p.values.Green) < 1e-6 &&
      Math.abs(got.Blue - p.values.Blue) < 1e-6;
    check(`SNOW preset t${p.timeOfDay}`, ok, JSON.stringify(got));
  }
  // 显式 environment 覆盖 theater 默认
  const forced = await generate(baseBody({
    theaterType: 'TEMPERATE',
    seed: 7,
    lighting: { mode: 'preset', timeOfDay: 1, environment: 'desert' },
  }));
  const forcedValues = lightingOf(forced.mapContent);
  const desertPreset = presets.environments.find(e => e.id === 'desert').presets[1].values;
  check('environment 可显式覆盖（温带图用沙漠色）',
    forcedValues !== null && Math.abs(forcedValues.Red - desertPreset.Red) < 1e-6,
    `R=${fmt(forcedValues?.Red)} 期望 ${fmt(desertPreset.Red)}`);

  // ------------------------------------------------------- 3.5 整点小时
  console.log('\n[3.5] hour 模式（24 整点插值）');
  const hourAt = async (hour, env = 'temperate') => {
    const r = await generate(baseBody({
      theaterType: env === 'temperate' ? 'TEMPERATE' : 'SNOW',
      seed: 7,
      lighting: { mode: 'preset', hour, environment: env },
    }));
    return lightingOf(r.mapContent);
  };
  const h6 = await hourAt(6);
  check('06:00 == 预设 t0（日出）',
    h6 !== null && Math.abs(h6.Ambient - temperatePresets[0].values.Ambient) < 1e-6 &&
      Math.abs(h6.Red - temperatePresets[0].values.Red) < 1e-6, JSON.stringify(h6));
  const h0 = await hourAt(0);
  check('00:00 == 预设 t3（夜间）',
    h0 !== null && Math.abs(h0.Ambient - temperatePresets[3].values.Ambient) < 1e-6,
    `A=${fmt(h0?.Ambient)} 期望 ${fmt(temperatePresets[3].values.Ambient)}`);
  const h9 = await hourAt(9);
  const h9Expect = (temperatePresets[0].values.Ambient + temperatePresets[1].values.Ambient) / 2;
  check('09:00 = 日出与正午中点',
    h9 !== null && Math.abs(h9.Ambient - h9Expect) < 1e-6,
    `A=${fmt(h9?.Ambient)} 期望 ${fmt(h9Expect)}`);
  const h21 = await hourAt(21);
  const h21Expect = (temperatePresets[2].values.Ambient + temperatePresets[3].values.Ambient) / 2;
  check('21:00 = 黄昏与深夜中点',
    h21 !== null && Math.abs(h21.Ambient - h21Expect) < 1e-6,
    `A=${fmt(h21?.Ambient)} 期望 ${fmt(h21Expect)}`);
  const h3 = await hourAt(3);
  check('03:00 比 06:00 暗、比 00:00 亮',
    h3 !== null && h3.Ambient > h0.Ambient && h3.Ambient < h6.Ambient,
    `A3=${fmt(h3?.Ambient)} A0=${fmt(h0?.Ambient)} A6=${fmt(h6?.Ambient)}`);
  const snowPresetsFor23 = presets.environments.find(e => e.id === 'snow').presets;
  const snowH23Expect = (snowPresetsFor23[2].values.Blue + snowPresetsFor23[3].values.Blue * 5) / 6;
  const snowH23 = await hourAt(23, 'snow');
  check('雪地 23:00 走非温带曲线（18:00→24:00 的 5/6）',
    snowH23 !== null && Math.abs(snowH23.Blue - snowH23Expect) < 1e-6,
    `B=${fmt(snowH23?.Blue)} 期望 ${fmt(snowH23Expect)}`);

  // ------------------------------------------------------- 4. random + 种子
  console.log('\n[4] random 模式（抖动 + 种子复现）');
  const rndA = await generate(baseBody({
    theaterType: 'TEMPERATE', seed: 4242,
    lighting: { mode: 'random', timeOfDay: 1, jitter: 0.12 },
  }));
  const rndB = await generate(baseBody({
    theaterType: 'TEMPERATE', seed: 4242,
    lighting: { mode: 'random', timeOfDay: 1, jitter: 0.12 },
  }));
  const rndC = await generate(baseBody({
    theaterType: 'TEMPERATE', seed: 4243,
    lighting: { mode: 'random', timeOfDay: 1, jitter: 0.12 },
  }));
  check('同 seed 两次结果逐字节相同', rndA.mapContent === rndB.mapContent);
  check('换 seed 光照变了',
    JSON.stringify(lightingOf(rndA.mapContent)) !== JSON.stringify(lightingOf(rndC.mapContent)),
    `A=${JSON.stringify(lightingOf(rndA.mapContent))} C=${JSON.stringify(lightingOf(rndC.mapContent))}`);
  const rndVals = lightingOf(rndA.mapContent);
  const noon = temperatePresets[1].values;
  check('抖动幅度在 ±12% 内',
    rndVals !== null &&
      Math.abs(rndVals.Ambient - noon.Ambient) <= noon.Ambient * 0.12 + 1e-6 &&
      Math.abs(rndVals.Blue - noon.Blue) <= noon.Blue * 0.12 + 1e-6,
    JSON.stringify(rndVals));
  check('响应头 X-Map-Lighting 回显',
    rndA.lightingHeader !== null && JSON.parse(rndA.lightingHeader).Ambient === rndVals.Ambient,
    rndA.lightingHeader);

  // ------------------------------------------------------- 5. custom 覆盖
  console.log('\n[5] custom 模式（通道覆盖）');
  const custom = await generate(baseBody({
    theaterType: 'TEMPERATE', seed: 9,
    lighting: { mode: 'custom', timeOfDay: 3, values: { Ambient: 0.6, Red: 1.25, Blue: 0.35 } },
  }));
  const customVals = lightingOf(custom.mapContent);
  check('custom 覆盖 Ambient/Red/Blue',
    customVals !== null &&
      Math.abs(customVals.Ambient - 0.6) < 1e-6 &&
      Math.abs(customVals.Red - 1.25) < 1e-6 &&
      Math.abs(customVals.Blue - 0.35) < 1e-6,
    JSON.stringify(customVals));
  const night = temperatePresets[3].values;
  check('未覆盖的 Green 沿用 preset',
    customVals !== null && Math.abs(customVals.Green - night.Green) < 1e-6,
    `G=${fmt(customVals?.Green)} 期望 ${fmt(night.Green)}`);

  // ------------------------------------------------------- 6. 参数校验
  console.log('\n[6] 参数校验');
  const badMode = await generate(baseBody({ lighting: { mode: 'weird' } }));
  check('非法 mode → 400', badMode.status === 400, badMode.error);
  const badTod = await generate(baseBody({ lighting: { mode: 'preset', timeOfDay: 7 } }));
  check('timeOfDay=7 → 400', badTod.status === 400, badTod.error);
  const badValue = await generate(baseBody({ lighting: { mode: 'custom', values: { Ambient: 5 } } }));
  check('Ambient=5 → 400', badValue.status === 400, badValue.error);
  const badEnv = await generate(baseBody({ lighting: { mode: 'preset', environment: 'moon' } }));
  check('非法 environment → 400', badEnv.status === 400, badEnv.error);
  const badJitter = await generate(baseBody({ lighting: { mode: 'random', jitter: 0.9 } }));
  check('jitter=0.9 → 400', badJitter.status === 400, badJitter.error);
  const badHour = await generate(baseBody({ lighting: { mode: 'preset', hour: 25 } }));
  check('hour=25 → 400', badHour.status === 400, badHour.error);
  const badHourFloat = await generate(baseBody({ lighting: { mode: 'preset', hour: 9.5 } }));
  check('hour=9.5 → 400', badHourFloat.status === 400, badHourFloat.error);

  console.log(`\n结果：${pass} pass / ${fail} fail`);
  if (fail > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error('验收脚本异常：', err);
  process.exitCode = 1;
});
