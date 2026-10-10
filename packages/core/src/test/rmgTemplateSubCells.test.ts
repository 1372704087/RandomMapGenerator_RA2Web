/**
 * 回归测试：`FlatTemplateProvider.subExists` 的子格数。
 *
 * 🔴 事故背景（2026-10-07/08）
 *
 * 原生 `0x544C20 Tile_FrameValidQ`（capstone 实测）的判据是
 * 「**模板里该子格是否存在**」：
 * ```c
 * TileTemplate* tmpl = this->vtable->slot156(this);   // call [eax+0x9C]
 * return tmpl != null && subtile < tmpl->width*tmpl->height
 *     && tmpl->subtiles[subtile] != null;
 * ```
 *
 * 而我们的占位 Provider 写的是 `subtile === 0` ⇒ 水格被大面积抹掉。
 * 实测（MapType=1 / RandMap.Sed，与真机同参数）：
 * ```
 * generateWaterStage 后   water=11124 (48.2%)   ← 与真机 49.4% 吻合
 * runRecalcStage         water=4287  (18.6%)   ← -6837（被抹掉）
 * ```
 * 探针定位到丢失量**完美均分**：subtile=1/2/3 各 2279 格，subtile=0 零丢失 ——
 * 因为 `waterFinalize` 用 `placeTileBlock` 写出的水格 `subtile = j*width + i`（≠0），
 * 而真机实测水格 `subIndex = {0,1,2,3}` 四种各占 1/4 ⇒ 模板里水 tile 有 4 个有效子格。
 *
 * ⚠ 本测试**断言分布**而不是"数量 > 0"：
 * 桥坡那次事故（87% 变水）里 `stamped > 0` 断言**依然通过**。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { parseTheaterIni } from '../rmg/theater';
import { FlatTemplateProvider } from '../rmg/recalc';
import { generateFullMap, generateWaterStage, runRecalcStage } from '../rmg/pipeline';
import { deriveDimensions, type RmgOptions } from '../rmg/options';
import { loadSed } from '../rmg/sed';
import type { RmgOptions as Opt } from '../rmg/options';

const FIX = join(__dirname, '..', '..', 'fixtures');
const THEATER_INI =
  process.env.RMG_THEATER_INI ??
  join(__dirname, '..', '..', '..', 'server', 'resources', 'theater', 'temperatmd.ini');
const tables = parseTheaterIni(readFileSync(THEATER_INI, 'utf8'), 'TEMPERATE');
void FIX;

test('【回归】subExists：水 tile 必须接受 subtile 1..3（真机实测 4 子格）', () => {
  const p = new FlatTemplateProvider(tables);
  const WS = tables.waterSet;

  // 子格 0 恒存在
  assert.equal(p.subExists(WS, 0), true, 'subtile 0 应恒存在');

  // ★ 核心：314..317 在真机里 subIndex = {0,1,2,3} 各占 1/4
  for (const tile of [WS, WS + 1, WS + 2, WS + 3, WS + 4, WS + 5]) {
    for (const sub of [1, 2, 3]) {
      assert.equal(p.subExists(tile, sub), true,
        `水 tile ${tile} 的 subtile ${sub} 应存在（真机 subIndex 覆盖 0..3）`);
    }
  }

  // 越界子格仍应拒绝（不要无脑返回 true）
  assert.equal(p.subExists(WS, 4), false, 'subtile 4 超出 4 子格上限，应拒绝');
  assert.equal(p.subExists(WS, 99), false, 'subtile 99 应拒绝');
});

test('【回归】subExists：ground / ramp 族保持单子格（反推表实测）', () => {
  const p = new FlatTemplateProvider(tables);
  // 反推表 template_from_baseline.json：ground / ramp 全部为单子格
  const rampTile = tables.rampBase;
  for (const sub of [0]) {
    assert.equal(p.subExists(rampTile, sub), true, `坡 tile ${sub} 应存在`);
  }
  assert.equal(p.subExists(rampTile, 1), false,
    '坡族实测单子格，subtile 1 应拒绝（若此断言失败说明反推表或判据变了）');
});

test('【回归】subExists：无 theater 的退化情形仍可用', () => {
  const p = new FlatTemplateProvider(); // 不传 theater
  assert.equal(p.subExists(0, 0), true, 'subtile 0 应恒为 true');
  assert.equal(p.subExists(999, 1), false, '无 theater 时按单子格处理');
});

test('🔴【分布回归】recalc 不得抹掉水（历史：48.2% → 18.6%）', () => {
  // 数据源：F:\YTLauncher\RandMap.Sed（已知参数的真机 SED）
  // 若该文件不存在则跳过（CI 环境无外部依赖）。
  const sedPath = 'F:/YTLauncher/RandMap.Sed';
  let sed: ReturnType<typeof loadSed>;
  try {
    sed = loadSed(readFileSync(sedPath).toString('latin1'));
  } catch {
    return; // 无外部基线 ⇒ 跳过
  }

  const dims = deriveDimensions(sed as unknown as RmgOptions);
  const input = {
    seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
    numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
    tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
    theater: sed.theater, dimensions: dims, tables,
  };

  const LO = tables.waterSet;
  const HI = tables.waterSet + 13;
  const countWater = (ctx: { cells: { iterate: () => Iterable<{ tile: number }> } }) => {
    let n = 0;
    for (const c of ctx.cells.iterate()) if (c.tile >= LO && c.tile <= HI) n += 1;
    return n;
  };

  const st = generateWaterStage(input);
  const before = countWater(st.ctx);
  runRecalcStage(st);
  const after = countWater(st.ctx);

  // 口径：recalc 是"重算"而非"删地形"，水不该被整体抹掉
  assert.ok(before > 10000, `水体阶段应产出大量水（真机 ~11124），实际 ${before}`);
  assert.ok(after >= before * 0.99,
    `recalc 不应抹水：${before} → ${after}（损失 ${((1 - after / before) * 100).toFixed(1)}%，`
    + '历史事故为损失 61.5%）');
});

test('🔴【分布回归】generateFullMap 的水占比应接近真机 49.4%', () => {
  const sedPath = 'F:/YTLauncher/RandMap.Sed';
  let sed: ReturnType<typeof loadSed>;
  try {
    sed = loadSed(readFileSync(sedPath).toString('latin1'));
  } catch {
    return;
  }
  const dims = deriveDimensions(sed as unknown as Opt);
  const { state } = generateFullMap({
    seed: sed.seed, mapType: sed.mapType, waterAmount: sed.waterAmount,
    numPlayers: sed.numPlayers, ruggedness: sed.ruggedness, vegetation: sed.vegetation,
    tiberiumLayout: sed.tiberiumLayout, tiberium: sed.tiberium, resources: sed.resources,
    theater: sed.theater, dimensions: dims, tables,
  }, 'Random Map');

  // 直接在最终的 cell 网格上统计（不需要解压 IsoMapPack5）
  const LO = tables.waterSet;
  const HI = tables.waterSet + 13;
  let water = 0;
  let total = 0;
  const subs = new Set<number>();
  const tiles = new Set<number>();
  for (const cell of state.ctx.cells.iterate()) {
    total += 1;
    if (cell.tile >= LO && cell.tile <= HI) {
      water += 1;
      subs.add(cell.subTile & 0xff);
      tiles.add(cell.tile);
    }
  }
  const ratio = water / total;

  assert.ok(ratio > 0.40,
    `水占比应 > 40%（真机 49.4%，历史事故后 24.7%），实际 ${(ratio * 100).toFixed(1)}%`);
  assert.ok(ratio < 0.60, `水占比应 < 60%，实际 ${(ratio * 100).toFixed(1)}%`);

  // ★ 形态断言：真机水 tile 覆盖 4 种 subIndex（模板 4 子格的真实体现）
  assert.ok(subs.size >= 4,
    `水格 subIndex 应有 4 种（真机 {0,1,2,3}），实际 ${subs.size} 种：${[...subs].sort().join(',')}`);
});
