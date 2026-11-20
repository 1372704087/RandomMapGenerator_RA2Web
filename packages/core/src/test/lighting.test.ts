/**
 * 环境光照（[Lighting]）单元测试
 *
 * 覆盖：
 * - 预设表：温带 / 非温带四档的取值与游戏光照表一致
 * - 沙漠派生：由 settings.ini 中值缩放，并夹在 0.2..1.6
 * - theater 名 → 环境主题映射
 * - 自定义覆盖只改给了的通道
 * - 抖动受 Random 种子约束（同种子 = 同结果）
 * - MapFile.ChangeLighting 写入 / 省略 Ion / 幂等覆盖已有段
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getLightingPreset,
  getLightingForHour,
  getHourLabel,
  LIGHTING_HOURS,
  applyLightingOverrides,
  jitterLighting,
  theaterToLightingEnvironment,
  TIME_OF_DAY_LABELS,
} from '../lighting';
import { Random } from '../random';
import { MapFile } from '../fileio';

describe('光照预设表', () => {
  it('温带四档与游戏光照表一致', () => {
    const expected = [
      { Ambient: 0.75, Red: 1.09, Green: 0.8, Blue: 0.49, Level: 0.03 },
      { Ambient: 1.0, Red: 1.08, Green: 0.94, Blue: 0.68, Level: 0.03 },
      { Ambient: 0.75, Red: 0.71, Green: 0.81, Blue: 1.19, Level: 0.03 },
      { Ambient: 0.35, Red: 0.51, Green: 0.46, Blue: 1.41, Level: 0.03 },
    ];
    for (const tod of [0, 1, 2, 3] as const) {
      assert.deepEqual(getLightingPreset('temperate', tod), expected[tod]);
    }
  });

  it('雪地四档与游戏光照表一致', () => {
    const expected = [
      { Ambient: 0.75, Red: 1.12, Green: 0.8, Blue: 1.33, Level: 0.03 },
      { Ambient: 1.0, Red: 0.99, Green: 1.04, Blue: 1.07, Level: 0.03 },
      { Ambient: 0.75, Red: 1.06, Green: 1.07, Blue: 1.54, Level: 0.03 },
      { Ambient: 0.55, Red: 0.76, Green: 0.74, Blue: 1.18, Level: 0.03 },
    ];
    for (const tod of [0, 1, 2, 3] as const) {
      assert.deepEqual(getLightingPreset('snow', tod), expected[tod]);
    }
  });

  it('新城区 / 岛屿复用非温带表', () => {
    for (const env of ['newurban', 'islands'] as const) {
      for (const tod of [0, 1, 2, 3] as const) {
        assert.deepEqual(getLightingPreset(env, tod), getLightingPreset('snow', tod));
      }
    }
  });

  it('沙漠正午保留 settings.ini 中值底色', () => {
    const noon = getLightingPreset('desert', 1);
    assert.equal(noon.Ambient, 0.875);
    assert.equal(noon.Red, 0.98);
    assert.equal(noon.Green, 0.955);
    assert.equal(noon.Blue, 0.955);
    assert.equal(noon.Level, 0.017);
  });

  it('沙漠夜间最暗，且所有通道夹在 0.2..1.6', () => {
    const night = getLightingPreset('desert', 3);
    const noon = getLightingPreset('desert', 1);
    assert.ok(night.Ambient < noon.Ambient);
    for (const tod of [0, 1, 2, 3] as const) {
      const v = getLightingPreset('desert', tod);
      for (const key of ['Ambient', 'Red', 'Green', 'Blue'] as const) {
        assert.ok(v[key] >= 0.2 && v[key] <= 1.6, `${key}@t${tod}=${v[key]} 越界`);
      }
    }
  });

  it('四档都有中文标签', () => {
    for (const tod of [0, 1, 2, 3] as const) {
      assert.ok(TIME_OF_DAY_LABELS[tod].length > 0);
    }
  });
});

describe('theater → 环境主题', () => {
  it('按目录名映射', () => {
    assert.equal(theaterToLightingEnvironment('TEMPERATE'), 'temperate');
    assert.equal(theaterToLightingEnvironment('SNOW'), 'snow');
    assert.equal(theaterToLightingEnvironment('DESERT'), 'desert');
    assert.equal(theaterToLightingEnvironment('NEWURBAN'), 'newurban');
    assert.equal(theaterToLightingEnvironment('TEMPERATE_Islands'), 'islands');
  });

  it('未知 theater 回落到温带', () => {
    assert.equal(theaterToLightingEnvironment('WHATEVER'), 'temperate');
    assert.equal(theaterToLightingEnvironment(''), 'temperate');
  });
});

describe('自定义覆盖', () => {
  it('只覆盖给出的通道', () => {
    const base = getLightingPreset('temperate', 3);
    const out = applyLightingOverrides(base, { Ambient: 0.6, Red: 1.25, Blue: 0.35 });
    assert.equal(out.Ambient, 0.6);
    assert.equal(out.Red, 1.25);
    assert.equal(out.Blue, 0.35);
    assert.equal(out.Green, base.Green);
    assert.equal(out.Level, base.Level);
  });

  it('越界值被夹到 0.2..1.6', () => {
    const base = getLightingPreset('temperate', 1);
    const out = applyLightingOverrides(base, { Ambient: 9, Blue: -3 });
    assert.equal(out.Ambient, 1.6);
    assert.equal(out.Blue, 0.2);
  });

  it('Ion 通道可单独覆盖', () => {
    const base = getLightingPreset('temperate', 1);
    const out = applyLightingOverrides(base, { IonAmbient: 0.5, IonBlue: 1.2 });
    assert.equal(out.IonAmbient, 0.5);
    assert.equal(out.IonBlue, 1.2);
  });

  it('空覆盖不改变基准', () => {
    const base = getLightingPreset('snow', 2);
    assert.deepEqual(applyLightingOverrides(base, undefined), base);
    assert.deepEqual(applyLightingOverrides(base, {}), base);
  });
});

describe('随机抖动', () => {
  it('同种子结果一致', () => {
    const base = getLightingPreset('temperate', 1);
    const a = jitterLighting(base, 0.1, new Random(123));
    const b = jitterLighting(base, 0.1, new Random(123));
    assert.deepEqual(a, b);
  });

  it('不同种子结果不同', () => {
    const base = getLightingPreset('temperate', 1);
    const a = jitterLighting(base, 0.1, new Random(1));
    const b = jitterLighting(base, 0.1, new Random(2));
    assert.notDeepEqual(a, b);
  });

  it('抖动幅度不超过设定比例', () => {
    const base = getLightingPreset('temperate', 1);
    const jitter = 0.05;
    for (let seed = 1; seed <= 50; seed++) {
      const v = jitterLighting(base, jitter, new Random(seed));
      assert.ok(Math.abs(v.Ambient - base.Ambient) <= base.Ambient * jitter + 1e-6);
      assert.ok(Math.abs(v.Green - base.Green) <= base.Green * jitter + 1e-6);
    }
  });

  it('jitter=0 时等于基准值', () => {
    const base = getLightingPreset('desert', 0);
    const v = jitterLighting(base, 0, new Random(7));
    assert.equal(v.Ambient, base.Ambient);
    assert.equal(v.Red, base.Red);
    assert.equal(v.Blue, base.Blue);
  });
});

describe('整点小时曲线', () => {
  it('锚点上与四档预设逐位一致（温带）', () => {
    const pairs: [number, 0 | 1 | 2 | 3][] = [
      [0, 3],
      [6, 0],
      [12, 1],
      [18, 2],
    ];
    for (const [hour, tod] of pairs) {
      assert.deepEqual(getLightingForHour('temperate', hour), getLightingPreset('temperate', tod));
    }
  });

  it('锚点上与四档预设逐位一致（雪地）', () => {
    for (const [hour, tod] of [
      [0, 3],
      [6, 0],
      [12, 1],
      [18, 2],
    ] as [number, 0 | 1 | 2 | 3][]) {
      assert.deepEqual(getLightingForHour('snow', hour), getLightingPreset('snow', tod));
    }
  });

  it('09:00 是日出与正午的中点', () => {
    const sunrise = getLightingPreset('temperate', 0);
    const noon = getLightingPreset('temperate', 1);
    const v = getLightingForHour('temperate', 9);
    assert.equal(v.Ambient, (sunrise.Ambient + noon.Ambient) / 2);
    assert.equal(v.Red, (sunrise.Red + noon.Red) / 2);
    assert.equal(v.Blue, (sunrise.Blue + noon.Blue) / 2);
  });

  it('03:00 是深夜与日出的中点', () => {
    const night = getLightingPreset('temperate', 3);
    const sunrise = getLightingPreset('temperate', 0);
    const v = getLightingForHour('temperate', 3);
    assert.equal(v.Ambient, (night.Ambient + sunrise.Ambient) / 2);
  });

  it('21:00 是黄昏与深夜的中点', () => {
    const dusk = getLightingPreset('temperate', 2);
    const night = getLightingPreset('temperate', 3);
    const v = getLightingForHour('temperate', 21);
    assert.equal(v.Ambient, (dusk.Ambient + night.Ambient) / 2);
  });

  it('曲线闭合：0 点与 24 点相同', () => {
    assert.deepEqual(getLightingForHour('temperate', 0), getLightingForHour('temperate', 24));
  });

  it('白天整体比夜里亮（环境光单调区间）', () => {
    const noon = getLightingForHour('temperate', 12);
    const midnight = getLightingForHour('temperate', 0);
    const dawn = getLightingForHour('temperate', 6);
    assert.ok(noon.Ambient > dawn.Ambient);
    assert.ok(dawn.Ambient > midnight.Ambient);
  });

  it('24 个整点都有标签，越界自动绕回', () => {
    for (let h = 0; h < 24; h++) {
      assert.ok(getHourLabel(h).length > 0, `hour ${h} 无标签`);
    }
    assert.equal(getHourLabel(25), getHourLabel(1));
    assert.equal(getHourLabel(-1), getHourLabel(23));
  });

  it('每个整点的通道都夹在 0.2..1.6', () => {
    for (const env of ['temperate', 'snow', 'desert', 'newurban', 'islands'] as const) {
      for (let h = 0; h < 24; h++) {
        const v = getLightingForHour(env, h);
        for (const key of ['Ambient', 'Red', 'Green', 'Blue'] as const) {
          assert.ok(v[key] >= 0.2 && v[key] <= 1.6, `${env} ${h}:00 ${key}=${v[key]} 越界`);
        }
      }
    }
  });

  it('LIGHTING_HOURS 恰好是 0..23', () => {
    assert.deepEqual(LIGHTING_HOURS, Array.from({ length: 24 }, (_, i) => i));
  });
});

describe('MapFile.ChangeLighting', () => {
  const template = ['[Basic]', 'Name=Test', '', '[Map]', 'Size=0,0,10,10'].join('\n');

  it('新建 [Lighting] 段并写入五个核心键', () => {
    const out = new MapFile().ChangeLighting(template, {
      Ambient: 0.75, Red: 1.09, Green: 0.8, Blue: 0.49, Level: 0.03,
    });
    assert.ok(out.includes('[Lighting]'));
    assert.ok(out.includes('Ambient=0.750000'));
    assert.ok(out.includes('Red=1.090000'));
    assert.ok(out.includes('Level=0.030000'));
  });

  it('未给 Ion 时不写 Ion 键', () => {
    const out = new MapFile().ChangeLighting(template, {
      Ambient: 0.75, Red: 1.09, Green: 0.8, Blue: 0.49, Level: 0.03,
    });
    assert.ok(!out.includes('IonAmbient'));
    assert.ok(!out.includes('IonRed'));
  });

  it('给了 Ion 就写 Ion 键', () => {
    const out = new MapFile().ChangeLighting(template, {
      Ambient: 0.75, Red: 1.09, Green: 0.8, Blue: 0.49, Level: 0.03,
      IonAmbient: 0.5, IonLevel: 0.02, IonRed: 0.7, IonGreen: 0.8, IonBlue: 1.1,
    });
    assert.ok(out.includes('IonAmbient=0.500000'));
    assert.ok(out.includes('IonBlue=1.100000'));
  });

  it('覆盖已有 [Lighting] 段（幂等）', () => {
    const withLighting = [
      template, '', '[Lighting]', 'Ambient=0.990000', 'Red=0.100000', 'IonAmbient=0.400000',
    ].join('\n');
    const first = new MapFile().ChangeLighting(withLighting, {
      Ambient: 0.35, Red: 0.51, Green: 0.46, Blue: 1.41, Level: 0.03,
    });
    const second = new MapFile().ChangeLighting(first, {
      Ambient: 0.35, Red: 0.51, Green: 0.46, Blue: 1.41, Level: 0.03,
    });
    assert.equal(first, second);
    assert.ok(first.includes('Ambient=0.350000'));
    assert.ok(!first.includes('IonAmbient'), '未给 Ion 时应清掉旧值');
  });
});
