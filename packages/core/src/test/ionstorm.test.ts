/**
 * 随机离子风暴单元测试
 *
 * 覆盖：
 * - 关闭时不写任何键（保持原版地图干净）
 * - 开启后 `[General]` 写原版闪电数值
 * - `[Lighting]` Ion* 五行按原版默认值写入（且能与光照步骤共存）
 * - 多点位：默认 4 个点位 = 4 个 trigger/tag/waypoint，各自的间隔是平均值 × 点位数
 * - 单点位回落：sites=1 时只在地图正中起风暴
 * - 周期与随机两种事件（13 / 51）的切换
 * - 点位落在图内、互不重复、受种子约束可复现
 * - 间隔夹取、数值覆盖、重复调用幂等
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IniFile } from '../io/iniFile';
import { Random } from '../random';
import {
  applyIonStorm,
  ION_STORM_RULES_VALUES,
  ION_STORM_TRIGGER_BASE,
  ION_STORM_TAG_BASE,
  ION_STORM_WAYPOINT_BASE,
  ION_STORM_EVENT_PERIODIC,
  ION_STORM_EVENT_RANDOM,
  ION_STORM_ACTION,
  ION_STORM_ACTION_ENABLE,
  ION_STORM_ACTION_DISABLE,
  ION_STORM_DEFAULT_SITES,
  ION_STORM_MAX_SITES,
  formatWaypointCell,
  hexId,
  pickStormSites,
  ION_STORM_MIN_INTERVAL,
  ION_STORM_MAX_INTERVAL,
} from '../ionstorm';
import { waypointLetter } from '../trigger';

const BASE = `[Header]
Width=95
Height=89

[Waypoints]
0=67067
1=52082

[Lighting]
Ambient=1.000000
Red=1.080000
Green=0.940000
Blue=0.680000
Level=0.032000

[Basic]
Name=Random Map
`;

function section(ini: IniFile, name: string): Record<string, string> {
  const sec = ini.GetSection(name);
  if (sec === null) return {};
  const out: Record<string, string> = {};
  for (const key of sec.Keys) out[key] = sec.GetStringValue(key, '');
  return out;
}

describe('随机离子风暴', () => {
  it('未开启时不改任何内容', () => {
    const out = applyIonStorm(BASE, undefined, 95, 89);
    assert.equal(out.iniContent, BASE);
    assert.equal(out.ionStorm, undefined);
    const out2 = applyIonStorm(BASE, { enabled: false }, 95, 89);
    assert.equal(out2.iniContent, BASE);
  });

  it('[General] 写入原版闪电数值', () => {
    const { iniContent } = applyIonStorm(BASE, { enabled: true }, 95, 89);
    const general = section(new IniFile(iniContent), 'General');
    assert.equal(general.LightningDamage, '250');
    assert.equal(general.LightningDeferment, '250');
    assert.equal(general.LightningStormDuration, '180');
    assert.equal(general.LightningHitDelay, '10');
    assert.equal(general.LightningCellSpread, '10');
    assert.equal(general.LightningScatterDelay, '5');
    assert.equal(general.LightningSeparation, '3');
  });

  it('[Lighting] 写入 Ion* 且保留原环境光', () => {
    const { iniContent } = applyIonStorm(BASE, { enabled: true }, 95, 89);
    const lighting = section(new IniFile(iniContent), 'Lighting');
    assert.equal(lighting.IonAmbient, '0.650000');
    assert.equal(lighting.IonRed, '0.695000');
    assert.equal(lighting.IonGreen, '0.445000');
    assert.equal(lighting.IonBlue, '0.775000');
    assert.equal(lighting.Ambient, '1.000000');
  });

  it('默认 4 个点位：环形轮转，每 600 秒劈一次、落点轮换', () => {
    const { iniContent, ionStorm } = applyIonStorm(BASE, { enabled: true }, 95, 89);
    const ini = new IniFile(iniContent);
    const triggers = section(ini, 'Triggers');
    const tags = section(ini, 'Tags');
    const events = section(ini, 'Events');
    const actions = section(ini, 'Actions');
    const waypoints = section(ini, 'Waypoints');
    const cellTags = section(ini, 'CellTags');

    assert.equal(ionStorm?.siteCount, ION_STORM_DEFAULT_SITES);
    assert.equal(Object.keys(triggers).length, ION_STORM_DEFAULT_SITES);
    assert.equal(Object.keys(tags).length, ION_STORM_DEFAULT_SITES);
    for (let i = 0; i < ION_STORM_DEFAULT_SITES; i++) {
      const triggerId = hexId(ION_STORM_TRIGGER_BASE + i);
      const nextId = hexId(ION_STORM_TRIGGER_BASE + ((i + 1) % ION_STORM_DEFAULT_SITES));
      const tagId = hexId(ION_STORM_TAG_BASE + i);
      const waypoint = ION_STORM_WAYPOINT_BASE + i;
      // 环形链：只有第 0 档开局启用，其余等前一档叫起来
      assert.equal(
        triggers[triggerId],
        `Neutral,<none>,Random Ion Storm,${i === 0 ? 0 : 1},1,1,1,0`,
      );
      // 每一档只等一个 intervalSeconds，不是 interval × N（那会让 N 个点同时劈）
      assert.equal(events[triggerId], `1,${ION_STORM_EVENT_PERIODIC},0,600`);
      assert.equal(
        actions[triggerId],
        `3,${ION_STORM_ACTION},0,0,0,0,0,0,${waypointLetter(waypoint)},` +
          `${ION_STORM_ACTION_ENABLE},0,${nextId},0,0,0,0,A,` +
          `${ION_STORM_ACTION_DISABLE},0,${triggerId},0,0,0,0,A`,
      );
      assert.equal(tags[tagId], `2,RANDOM ION STORM ${i + 1},${triggerId}`);
      // tag 必须挂到点位的格子上，否则永远不会被评估
      assert.equal(
        cellTags[formatWaypointCell(ionStorm!.sites[i].cell.x, ionStorm!.sites[i].cell.y)],
        tagId,
      );
      assert.match(waypoints[String(waypoint)] ?? '', /^\d{4,5}$/);
      assert.equal(ionStorm!.sites[i].intervalSeconds, 600);
    }
    // 原有出生点不受影响
    assert.equal(waypoints['0'], '67067');
  });

  it('环形链首尾相接（末档 53 指回第一个点位）', () => {
    const { iniContent } = applyIonStorm(BASE, { enabled: true, sites: 5 }, 95, 89);
    const actions = section(new IniFile(iniContent), 'Actions');
    const last = (actions[hexId(ION_STORM_TRIGGER_BASE + 4)] ?? '').split(',');
    assert.equal(last[9], String(ION_STORM_ACTION_ENABLE));
    assert.equal(last[11], hexId(ION_STORM_TRIGGER_BASE));
    assert.equal(last[17], String(ION_STORM_ACTION_DISABLE));
    assert.equal(last[19], hexId(ION_STORM_TRIGGER_BASE + 4));
  });

  it('点位都在图内且互不重复', () => {
    const { ionStorm } = applyIonStorm(BASE, { enabled: true }, 95, 89);
    const sites = ionStorm?.sites ?? [];
    const seen = new Set<string>();
    for (const site of sites) {
      assert.ok(site.cell.x >= 0 && site.cell.x < 95, `x=${site.cell.x}`);
      assert.ok(site.cell.y >= 0 && site.cell.y < 89, `y=${site.cell.y}`);
      const key = `${site.cell.x},${site.cell.y}`;
      assert.ok(!seen.has(key), `重复点位 ${key}`);
      seen.add(key);
    }
  });

  it('sites=1 回落为地图正中单点位', () => {
    const { iniContent, ionStorm } = applyIonStorm(BASE, { enabled: true, sites: 1 }, 95, 89);
    const ini = new IniFile(iniContent);
    assert.equal(ionStorm?.siteCount, 1);
    assert.deepEqual(ionStorm?.cell, { x: 47, y: 44 });
    assert.equal(section(ini, 'Waypoints')[String(ION_STORM_WAYPOINT_BASE)], '44047');
    assert.equal(Object.keys(section(ini, 'Triggers')).length, 1);
    assert.equal(
      Object.values(section(ini, 'Events'))[0],
      `1,${ION_STORM_EVENT_PERIODIC},0,600`,
    );
  });

  it('randomize 切换成 Event 51', () => {
    const { iniContent, ionStorm } = applyIonStorm(
      BASE,
      { enabled: true, randomize: true, intervalSeconds: 900, sites: 2 },
      95,
      89,
    );
    const events = section(new IniFile(iniContent), 'Events');
    assert.equal(
      events[hexId(ION_STORM_TRIGGER_BASE)],
      `1,${ION_STORM_EVENT_RANDOM},0,1800`,
    );
    assert.equal(ionStorm?.eventId, ION_STORM_EVENT_RANDOM);
    assert.equal(ionStorm?.intervalSeconds, 900);
  });

  it('间隔超界会被夹取', () => {
    const low = applyIonStorm(BASE, { enabled: true, intervalSeconds: 5, sites: 2 }, 95, 89);
    assert.equal(low.ionStorm?.intervalSeconds, ION_STORM_MIN_INTERVAL);
    // 严格周期 + 多点位走环形链，每个点位等的就是一个 intervalSeconds
    assert.equal(low.ionStorm?.sites[0].intervalSeconds, ION_STORM_MIN_INTERVAL);
    const high = applyIonStorm(BASE, { enabled: true, intervalSeconds: 99999, sites: 1 }, 95, 89);
    assert.equal(high.ionStorm?.intervalSeconds, ION_STORM_MAX_INTERVAL);
    // 随机窗口模式下每个点位用的是 interval × 点位数
    const rnd = applyIonStorm(BASE, { enabled: true, randomize: true, intervalSeconds: 600, sites: 2 }, 95, 89);
    assert.equal(rnd.ionStorm?.sites[0].intervalSeconds, 1200);
  });

  it('点位数超过上限被夹到 64', () => {
    const { ionStorm } = applyIonStorm(BASE, { enabled: true, sites: 99 }, 95, 89);
    assert.equal(ionStorm?.siteCount, ION_STORM_MAX_SITES);
    assert.equal(ION_STORM_MAX_SITES, 64);
  });

  it('64 点位：waypoint 编号全部落在字母编码可表达的范围内', () => {
    const { iniContent, ionStorm } = applyIonStorm(BASE, { enabled: true, sites: 64 }, 95, 89);
    const waypoints = section(new IniFile(iniContent), 'Waypoints');
    const cellTags = section(new IniFile(iniContent), 'CellTags');
    assert.equal(ionStorm?.siteCount, 64);
    assert.equal(Object.keys(cellTags).length, 64);
    for (const site of ionStorm!.sites) {
      // 16 → Q … 79 → CB，全在两位字母以内
      assert.match(waypointLetter(site.waypoint), /^[A-Z]{1,2}$/);
      assert.ok(waypoints[String(site.waypoint)] !== undefined);
    }
  });

  it('数值可以单条覆盖，其余仍为原版', () => {
    const { iniContent, ionStorm } = applyIonStorm(
      BASE,
      { enabled: true, values: { damage: 120, cellSpread: 20 } },
      95,
      89,
    );
    const general = section(new IniFile(iniContent), 'General');
    assert.equal(general.LightningDamage, '120');
    assert.equal(general.LightningCellSpread, '20');
    assert.equal(general.LightningStormDuration, String(ION_STORM_RULES_VALUES.duration));
    assert.deepEqual(ionStorm?.values, { ...ION_STORM_RULES_VALUES, damage: 120, cellSpread: 20 });
  });

  it('重复调用幂等（不会叠加触发器）', () => {
    const first = applyIonStorm(BASE, { enabled: true, sites: 3 }, 95, 89).iniContent;
    const second = applyIonStorm(first, { enabled: true, sites: 3 }, 95, 89).iniContent;
    const triggers = section(new IniFile(second), 'Triggers');
    assert.equal(Object.keys(triggers).length, 3);
    assert.equal(triggers[hexId(ION_STORM_TRIGGER_BASE)], 'Neutral,<none>,Random Ion Storm,0,1,1,1,0');
  });

  it('waypoint 值格式为 Y + 三位 X', () => {
    assert.equal(formatWaypointCell(7, 3), '3007');
    assert.equal(formatWaypointCell(123, 45), '45123');
    assert.equal(formatWaypointCell(0, 0), '0000');
  });

  it('中心格按 [Header] 真实尺寸算，而不是调用方传的请求尺寸', () => {
    // 请求 150x150，实际生成 145x139
    const map = BASE.replace('Width=95', 'Width=145').replace('Height=89', 'Height=139');
    const { iniContent, ionStorm } = applyIonStorm(map, { enabled: true, sites: 1 }, 150, 150);
    assert.deepEqual(ionStorm?.cell, { x: 72, y: 69 });
    assert.equal(section(new IniFile(iniContent), 'Waypoints')['16'], '69072');
  });

  it('点位抖动受种子约束：同种子同点位，不同种子会变', () => {
    const a1 = pickStormSites(120, 120, 4, new Random(123)).map((s) => `${s.cell.x},${s.cell.y}`);
    const a2 = pickStormSites(120, 120, 4, new Random(123)).map((s) => `${s.cell.x},${s.cell.y}`);
    const b = pickStormSites(120, 120, 4, new Random(999)).map((s) => `${s.cell.x},${s.cell.y}`);
    assert.deepEqual(a1, a2);
    assert.notDeepEqual(a1, b);
    // 不传 rng 时落在各片区正中，也应互不相同
    const fixed = pickStormSites(120, 120, 4).map((s) => `${s.cell.x},${s.cell.y}`);
    assert.equal(new Set(fixed).size, 4);
  });
});
