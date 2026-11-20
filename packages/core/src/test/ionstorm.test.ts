/**
 * 随机离子风暴单元测试
 *
 * 覆盖：
 * - 关闭时不写任何键（保持原版地图干净）
 * - 开启后 `[General]` 写原版闪电数值
 * - `[Lighting]` Ion* 五行按原版默认值写入（且能与光照步骤共存）
 * - 触发链三段 + tag + waypoint 的格式与模板/FA2 一致
 * - 周期与随机两种事件（13 / 51）的切换
 * - 间隔夹取、数值覆盖、重复调用幂等
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IniFile } from '../io/iniFile';
import {
  applyIonStorm,
  ION_STORM_RULES_VALUES,
  ION_STORM_TRIGGER_ID,
  ION_STORM_TAG_ID,
  ION_STORM_WAYPOINT,
  ION_STORM_EVENT_PERIODIC,
  ION_STORM_EVENT_RANDOM,
  ION_STORM_ACTION,
  formatWaypointCell,
  ION_STORM_MIN_INTERVAL,
  ION_STORM_MAX_INTERVAL,
} from '../ionstorm';

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

  it('触发链、tag、waypoint 格式与模板一致', () => {
    const { iniContent, ionStorm } = applyIonStorm(BASE, { enabled: true }, 95, 89);
    const ini = new IniFile(iniContent);
    assert.equal(
      section(ini, 'Triggers')[ION_STORM_TRIGGER_ID],
      'Neutral,<none>,Random Ion Storm,0,1,1,1,2',
    );
    assert.equal(
      section(ini, 'Events')[ION_STORM_TRIGGER_ID],
      `${ION_STORM_EVENT_PERIODIC},0,600`,
    );
    assert.equal(
      section(ini, 'Actions')[ION_STORM_TRIGGER_ID],
      `${ION_STORM_ACTION},0,0,0,0,0,0,${ION_STORM_WAYPOINT}`,
    );
    assert.equal(
      section(ini, 'Tags')[ION_STORM_TAG_ID],
      `2,RANDOM ION STORM,${ION_STORM_TRIGGER_ID}`,
    );
    // 中心格 (47,44) -> "44" + "047"
    assert.equal(section(ini, 'Waypoints')[String(ION_STORM_WAYPOINT)], '44047');
    assert.deepEqual(ionStorm?.cell, { x: 47, y: 44 });
    // 原有出生点不受影响
    assert.equal(section(ini, 'Waypoints')['0'], '67067');
  });

  it('randomize 切换成 Event 51', () => {
    const { iniContent, ionStorm } = applyIonStorm(
      BASE,
      { enabled: true, randomize: true, intervalSeconds: 900 },
      95,
      89,
    );
    const events = section(new IniFile(iniContent), 'Events');
    assert.equal(events[ION_STORM_TRIGGER_ID], `${ION_STORM_EVENT_RANDOM},0,900`);
    assert.equal(ionStorm?.eventId, ION_STORM_EVENT_RANDOM);
    assert.equal(ionStorm?.intervalSeconds, 900);
  });

  it('间隔超界会被夹取', () => {
    const low = applyIonStorm(BASE, { enabled: true, intervalSeconds: 5 }, 95, 89);
    assert.equal(low.ionStorm?.intervalSeconds, ION_STORM_MIN_INTERVAL);
    const high = applyIonStorm(BASE, { enabled: true, intervalSeconds: 99999 }, 95, 89);
    assert.equal(high.ionStorm?.intervalSeconds, ION_STORM_MAX_INTERVAL);
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
    const first = applyIonStorm(BASE, { enabled: true }, 95, 89).iniContent;
    const second = applyIonStorm(first, { enabled: true }, 95, 89).iniContent;
    const triggers = section(new IniFile(second), 'Triggers');
    assert.deepEqual(Object.keys(triggers), [ION_STORM_TRIGGER_ID]);
    assert.equal(triggers[ION_STORM_TRIGGER_ID], 'Neutral,<none>,Random Ion Storm,0,1,1,1,2');
  });

  it('waypoint 值格式为 Y + 三位 X', () => {
    assert.equal(formatWaypointCell(7, 3), '3007');
    assert.equal(formatWaypointCell(123, 45), '45123');
    assert.equal(formatWaypointCell(0, 0), '0000');
  });

  it('中心格按 [Header] 真实尺寸算，而不是调用方传的请求尺寸', () => {
    // 请求 150x150，实际生成 145x139
    const map = BASE.replace('Width=95', 'Width=145').replace('Height=89', 'Height=139');
    const { iniContent, ionStorm } = applyIonStorm(map, { enabled: true }, 150, 150);
    assert.deepEqual(ionStorm?.cell, { x: 72, y: 69 });
    assert.equal(section(new IniFile(iniContent), 'Waypoints')['16'], '69072');
  });
});
