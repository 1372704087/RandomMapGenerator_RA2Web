/**
 * 昼夜交替单元测试
 *
 * 覆盖：
 * - 关闭时不写任何键
 * - 开局 `[Lighting]` = 第一档（06:00 温带锚点）
 * - 阶段钟点按 startHour 等分（4 档 + 6 点起 = 06/12/18/00）
 * - 环形触发链：T0 开局启用、其余禁用；每档"启用下一档 + 禁用自己"，最后一档指回 T0
 * - `[Events]` 带数量前缀、时长合计 = cycleSeconds
 * - `[Actions]` 带数量前缀、每个动作 7 参数且 P7 为字母；动作顺序 73→142/143/144→53→54
 * - 每个 tag 都挂到了图内的独立格子（CellTags）
 * - 时长/档数夹取、startHour 取模、动作 P7 字母编码、theater 推导环境主题、幂等
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IniFile } from '../io/iniFile';
import {
  applyDayNight,
  stageHours,
  DAYNIGHT_ACTION_AMBIENT,
  DAYNIGHT_ACTION_RED,
  DAYNIGHT_ACTION_GREEN,
  DAYNIGHT_ACTION_BLUE,
  DAYNIGHT_ACTION_ENABLE,
  DAYNIGHT_ACTION_DISABLE,
  DAYNIGHT_DEFAULT_CYCLE,
  DAYNIGHT_DEFAULT_STAGES,
  DAYNIGHT_MAX_CYCLE,
  DAYNIGHT_MIN_CYCLE,
  DAYNIGHT_MAX_STAGES,
  DAYNIGHT_MIN_STAGES,
  DAYNIGHT_TRIGGER_BASE,
  DAYNIGHT_TAG_BASE,
} from '../daynight';
import { waypointLetter } from '../trigger';

const BASE = `[Header]
Width=95
Height=89

[Lighting]
Ambient=1.000000
Red=1.080000
Green=0.940000
Blue=0.680000
Level=0.032000
`;

function section(ini: IniFile, name: string): Record<string, string> {
  const sec = ini.GetSection(name);
  if (sec === null) return {};
  const out: Record<string, string> = {};
  for (const key of sec.Keys) out[key] = sec.GetStringValue(key, '');
  return out;
}

describe('昼夜交替', () => {
  it('未开启时不改任何内容', () => {
    const out = applyDayNight(BASE, undefined, 'TEMPERATE', 95, 89);
    assert.equal(out.iniContent, BASE);
    assert.equal(out.dayNight, undefined);
    const off = applyDayNight(BASE, { enabled: false }, 'TEMPERATE', 95, 89);
    assert.equal(off.iniContent, BASE);
  });

  it('开局 [Lighting] 就是第一档（06:00 温带）', () => {
    const { iniContent } = applyDayNight(BASE, { enabled: true }, 'TEMPERATE', 95, 89);
    const lighting = section(new IniFile(iniContent), 'Lighting');
    assert.equal(lighting.Ambient, '0.750000');
    assert.equal(lighting.Red, '1.090000');
    assert.equal(lighting.Green, '0.800000');
    assert.equal(lighting.Blue, '0.490000');
    assert.equal(lighting.Level, '0.030000');
  });

  it('默认 4 档、6 点起：钟点 06/12/18/00，时长合计 = 一轮', () => {
    const { dayNight } = applyDayNight(
      BASE,
      { enabled: true, cycleSeconds: 600 },
      'TEMPERATE',
      95,
      89,
    );
    assert.equal(dayNight?.stages.length, DAYNIGHT_DEFAULT_STAGES);
    assert.deepEqual(
      dayNight?.stages.map((s) => s.hour),
      [6, 12, 18, 0],
    );
    const total = (dayNight?.stages ?? []).reduce((sum, s) => sum + s.seconds, 0);
    assert.equal(total, 600);
    assert.equal(dayNight?.cycleSeconds, 600);
  });

  it('环形触发链：只有第一档开局启用，每档启用下一档并禁用自己', () => {
    const { iniContent, dayNight } = applyDayNight(
      BASE,
      { enabled: true, stages: 4 },
      'TEMPERATE',
      95,
      89,
    );
    const ini = new IniFile(iniContent);
    const triggers = section(ini, 'Triggers');
    const actions = section(ini, 'Actions');
    const count = dayNight!.stages.length;

    assert.equal(Object.keys(triggers).length, count);
    for (let i = 0; i < count; i++) {
      const id = String(DAYNIGHT_TRIGGER_BASE + i);
      const fields = (triggers[id] ?? '').split(',');
      assert.equal(fields.length, 8);
      assert.equal(fields[0], 'Neutral');
      assert.equal(fields[3], i === 0 ? '0' : '1', `第 ${i} 档 DISABLED`);
      // 动作数量 6（开环境光、三通道、启用下一档、禁用自己）
      const act = (actions[id] ?? '').split(',');
      assert.equal(act[0], '6');
      const nextId = String(DAYNIGHT_TRIGGER_BASE + ((i + 1) % count));
      assert.ok(act.includes(nextId), `第 ${i} 档应启用 ${nextId}`);
      assert.ok(act.includes(id), `第 ${i} 档应禁用自己`);
    }
    // 最后一档指回第一档，形成闭环
    const last = (actions[String(DAYNIGHT_TRIGGER_BASE + count - 1)] ?? '').split(',');
    assert.ok(last.includes(String(DAYNIGHT_TRIGGER_BASE)));
  });

  it('[Events] 带数量前缀，参数是各档时长', () => {
    const { iniContent, dayNight } = applyDayNight(
      BASE,
      { enabled: true, cycleSeconds: 480, stages: 4 },
      'TEMPERATE',
      95,
      89,
    );
    const events = section(new IniFile(iniContent), 'Events');
    for (let i = 0; i < 4; i++) {
      const id = String(DAYNIGHT_TRIGGER_BASE + i);
      assert.equal(events[id], `1,13,0,${dayNight!.stages[i].seconds}`);
    }
  });

  it('[Actions] 每个动作 7 个参数，P7 是字母 A', () => {
    const { iniContent } = applyDayNight(BASE, { enabled: true }, 'TEMPERATE', 95, 89);
    const actions = section(new IniFile(iniContent), 'Actions');
    const first = (actions[String(DAYNIGHT_TRIGGER_BASE)] ?? '').split(',');
    // 1 个数量 + 6 个动作 × 8 字段（动作号 + 6 参数 + P7）
    assert.equal(first.length, 1 + 6 * 8);
    for (let b = 0; b < 6; b++) {
      assert.equal(first[1 + b * 8 + 7], 'A', `第 ${b + 1} 个动作的 P7`);
    }
    assert.deepEqual(
      [0, 1, 2, 3, 4, 5].map((b) => Number(first[1 + b * 8])),
      [
        DAYNIGHT_ACTION_AMBIENT,
        DAYNIGHT_ACTION_RED,
        DAYNIGHT_ACTION_GREEN,
        DAYNIGHT_ACTION_BLUE,
        DAYNIGHT_ACTION_ENABLE,
        DAYNIGHT_ACTION_DISABLE,
      ],
    );
  });

  it('关掉 RGB 重染后每档只剩 3 个动作', () => {
    const { iniContent, dayNight } = applyDayNight(
      BASE,
      { enabled: true, retint: false },
      'TEMPERATE',
      95,
      89,
    );
    const actions = section(new IniFile(iniContent), 'Actions');
    assert.equal((actions[String(DAYNIGHT_TRIGGER_BASE)] ?? '').split(',')[0], '3');
    assert.deepEqual(dayNight?.actions, [
      DAYNIGHT_ACTION_AMBIENT,
      DAYNIGHT_ACTION_ENABLE,
      DAYNIGHT_ACTION_DISABLE,
    ]);
  });

  it('每档 tag 都挂到图内的独立格子', () => {
    const { iniContent, dayNight } = applyDayNight(
      BASE,
      { enabled: true, stages: 4 },
      'TEMPERATE',
      95,
      89,
    );
    const ini = new IniFile(iniContent);
    const cellTags = section(ini, 'CellTags');
    const tags = section(ini, 'Tags');
    const keys = Object.keys(cellTags);
    assert.equal(keys.length, 4);
    assert.equal(new Set(keys).size, 4);
    for (const entry of dayNight!.cellTags) {
      const index = Number(entry.tagId) - DAYNIGHT_TAG_BASE;
      assert.equal(cellTags[entry.key], entry.tagId);
      assert.equal(
        tags[entry.tagId],
        `2,DAY NIGHT ${index + 1},${String(DAYNIGHT_TRIGGER_BASE + index)}`,
      );
      assert.ok(entry.cell.x >= 0 && entry.cell.x < 95);
      assert.ok(entry.cell.y >= 0 && entry.cell.y < 89);
    }
  });

  it('触发器 ID 全为数字（避免十六进制/十进制解析歧义）', () => {
    const { dayNight } = applyDayNight(BASE, { enabled: true }, 'TEMPERATE', 95, 89);
    for (const stage of dayNight!.stages) {
      assert.match(stage.triggerId, /^\d{8}$/);
      assert.match(stage.tagId, /^\d{8}$/);
    }
  });

  it('时长与档数超界会被夹取', () => {
    const low = applyDayNight(BASE, { enabled: true, cycleSeconds: 5, stages: 1 }, 'TEMPERATE', 95, 89);
    assert.equal(low.dayNight?.cycleSeconds, DAYNIGHT_MIN_CYCLE);
    assert.equal(low.dayNight?.stages.length, DAYNIGHT_MIN_STAGES);
    const high = applyDayNight(BASE, { enabled: true, cycleSeconds: 999999, stages: 99 }, 'TEMPERATE', 95, 89);
    assert.equal(high.dayNight?.cycleSeconds, DAYNIGHT_MAX_CYCLE);
    assert.equal(high.dayNight?.stages.length, DAYNIGHT_MAX_STAGES);
    const def = applyDayNight(BASE, { enabled: true }, 'TEMPERATE', 95, 89);
    assert.equal(def.dayNight?.cycleSeconds, DAYNIGHT_DEFAULT_CYCLE);
  });

  it('startHour 取模，钟点按档数等分', () => {
    assert.deepEqual(stageHours(6, 4), [6, 12, 18, 0]);
    assert.deepEqual(stageHours(18, 4), [18, 0, 6, 12]);
    assert.deepEqual(stageHours(-3, 4), [21, 3, 9, 15]);
    const { dayNight } = applyDayNight(
      BASE,
      { enabled: true, startHour: 18, stages: 2 },
      'TEMPERATE',
      95,
      89,
    );
    assert.deepEqual(dayNight?.stages.map((s) => s.hour), [18, 6]);
  });

  it('环境光百分比 = 各档 Ambient × 100', () => {
    const { iniContent, dayNight } = applyDayNight(
      BASE,
      { enabled: true, startHour: 0, stages: 2 },
      'TEMPERATE',
      95,
      89,
    );
    const actions = section(new IniFile(iniContent), 'Actions');
    const first = (actions[String(DAYNIGHT_TRIGGER_BASE)] ?? '').split(',');
    // 动作 73 的 P2 是亮度百分比：00:00 档 0.08 → 8，12:00 档 1.00 → 100
    assert.equal(Number(first[3]), 8);
    const second = (actions[String(DAYNIGHT_TRIGGER_BASE + 1)] ?? '').split(',');
    assert.equal(Number(second[3]), 100);
    assert.equal(dayNight?.stages[0].ambientPercent, 8);
    assert.equal(dayNight?.stages[1].ambientPercent, 100);
  });

  it('theater 自动推导环境主题（DESERT 走沙漠曲线）', () => {
    const temper = applyDayNight(BASE, { enabled: true }, 'DESERT', 95, 89);
    assert.equal(temper.dayNight?.environment, 'desert');
    const snow = applyDayNight(BASE, { enabled: true }, 'SNOW', 95, 89);
    assert.equal(snow.dayNight?.environment, 'snow');
  });

  it('重复调用幂等（不叠加触发器）', () => {
    const first = applyDayNight(BASE, { enabled: true, stages: 3 }, 'TEMPERATE', 95, 89).iniContent;
    const second = applyDayNight(first, { enabled: true, stages: 3 }, 'TEMPERATE', 95, 89).iniContent;
    const triggers = section(new IniFile(second), 'Triggers');
    assert.equal(Object.keys(triggers).length, 3);
    assert.equal(section(new IniFile(second), 'CellTags') && Object.keys(section(new IniFile(second), 'CellTags')).length, 3);
  });

  it('waypoint 字母编码：0=A、16=Q、25=Z、26=AA', () => {
    assert.equal(waypointLetter(0), 'A');
    assert.equal(waypointLetter(1), 'B');
    assert.equal(waypointLetter(16), 'Q');
    assert.equal(waypointLetter(25), 'Z');
    assert.equal(waypointLetter(26), 'AA');
  });
});
