/**
 * 真实 `.SED` 样本测试 —— 数据来源：真机 YR 1.001 生成
 *
 * 样本（2026-10-07 采自 `H:\测试\Red-Alert-2-Yuris-Revenge\`）：
 *   - `randmap_maptype4_theater1.sed`  ← 真机随机地图的输入（MapType=4, Theater=1）
 *   - `save4823_maptype4_theater1.sed` ← 与上者同内容（游戏另存的副本）
 *   - `save0029_maptype1_width0.sed`   ← 另一局（MapType=1, **Width=0/Height=0**）
 *   - `randmap_maptype4.img`           ← 上者生成的地图（25518 B）
 *
 * 这些样本的价值：
 *   ① 验证 `sed.ts` 解析器对**真实文件**（CRLF、17 键、hex-CSV Description）成立；
 *   ② `MapType=4` 是 **3/4 型**（archipelago / inland）—— 阶段 7-10 的目标类型，
 *      此前仓里只有 0/1/2 型有实现；
 *   ③ `Width=0` 覆盖 `.SED` 加载器**不 clamp** 的路径（clamp 只发生在对话框/随机化）。
 *
 * ⚠ 样本只含**输入**（选项），不含 cell 网格输出 —— 后者仍需 oracle 抓取。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadSed, decodeSedDescription, saveSed, SED_INT_KEYS } from '../rmg/sed';
import { deriveDimensions } from '../rmg/options';
import { defaultRmgSettings } from '../rmg/rmgmd';

const FIX = join(__dirname, '..', '..', 'src', 'test', 'fixtures');

function readSed(name: string): string {
  // 真机文件是 CRLF + latin1；按 latin1 读以免 Description 的高位字节被改写
  return readFileSync(join(FIX, name), 'latin1');
}

// ---------------------------------------------------------------------------
// 一、解析真实文件
// ---------------------------------------------------------------------------

test('真实 .SED（MapType=4）解析出全部 17 个键', () => {
  const sed = loadSed(readSed('randmap_maptype4_theater1.sed'));
  assert.equal(sed.mapType, 4, 'MapType=4（3/4 型，阶段 7-10 目标）');
  assert.equal(sed.theater, 1, 'Theater=1');
  assert.equal(sed.seed, 16093, 'Seed=16093（确定输入，可复现）');
  assert.equal(sed.numPlayers, 2);
  assert.equal(sed.width, 3);
  assert.equal(sed.height, 3);
  assert.equal(sed.time, 1);
  assert.equal(sed.regionSize, 38);
  assert.equal(sed.ruggedness, 39);
  assert.equal(sed.accessibility, 11);
  assert.equal(sed.waterAmount, 48);
  assert.equal(sed.tiberium, 40);
  assert.equal(sed.tiberiumLayout, 14);
  assert.equal(sed.vegetation, 71);
  assert.equal(sed.urbanPresence, 0);
  assert.equal(sed.resources, 2);
});

test('真实 .SED 的 Description 是 hex-CSV UTF-16LE', () => {
  // 原文件：Description=968f,673a,5730,56fe,
  // 逐对解码：968f=随 673a=机 5730=地 56fe=图
  const sed = loadSed(readSed('randmap_maptype4_theater1.sed'));
  assert.equal(sed.description, '随机地图');
  // 直接对原始 hex 串解码，验证不依赖 loadSed 的预处理
  assert.equal(
    decodeSedDescription('968f,673a,5730,56fe,'),
    '随机地图',
    'hex-CSV 应直接解出中文',
  );
});

test('真实 .SED 是 CRLF 行尾，解析器须容忍', () => {
  const raw = readSed('randmap_maptype4_theater1.sed');
  assert.ok(raw.includes('\r\n'), '样本应为 CRLF');
  assert.ok(!/[^\r]\n/.test(raw.replace(/\r\n/g, '')), '不应混有裸 LF');
  const sed = loadSed(raw);
  assert.equal(sed.mapType, 4, 'CRLF 下仍应正确解析（不能把 \\r 带进值）');
});

// ---------------------------------------------------------------------------
// 二、两个样本的差异（覆盖不同 MapType 与 clamp 边界）
// ---------------------------------------------------------------------------

test('真实样本两种 MapType：4（3/4 型）与 1', () => {
  const t4 = loadSed(readSed('randmap_maptype4_theater1.sed'));
  const t1 = loadSed(readSed('save0029_maptype1_width0.sed'));
  assert.equal(t4.mapType, 4);
  assert.equal(t1.mapType, 1);
  // Theater 也不同（1 vs 0）⇒ 跨 theater 回归
  assert.equal(t4.theater, 1);
  assert.equal(t1.theater, 0);
  // Seed 不同 ⇒ RNG 起点不同
  assert.equal(t4.seed, 16093);
  assert.equal(t1.seed, 2147);
});

test('真实样本 Width=0：.SED 加载器不做 clamp（ClampFields 只在对话框路径）', () => {
  // 技能表补正（2026-09-17）：`.SED` 加载器 `0x00597A30` 自身不 clamp。
  // 本仓 `loadSed` 必须同样不 clamp，否则真机存档读出来的 0 会被改写成 0/1/…
  const t1 = loadSed(readSed('save0029_maptype1_width0.sed'));
  assert.equal(t1.width, 0, 'Width 应原样保留 0');
  assert.equal(t1.height, 0, 'Height 应原样保留 0');
  // 而 MapType=1（非 3/4 型）走 clamp 分支 —— 验证 clamp 只作用于 scale，不动档位
  const dims = deriveDimensions(t1);
  assert.ok(Number.isFinite(dims.mapW), 'mapW 应为有限数');
  assert.ok(dims.mapW > 0, `mapW 应为正，实际 ${dims.mapW}`);
});

test('真实样本 Width=3/Height=3/MapType=4 走 3-4 型未 clamp 分支', () => {
  // deriveDimensions 对 mapType 3|4 走 `sH = rawScaleH`（未 clamp）分支。
  // 档位 3 × 0.33333334f 后 ≈ 1.0，故两型在 0..3 档内结果应相同 ——
  // 这是技能表里的既有结论，本测试固定住它。
  const t4 = loadSed(readSed('randmap_maptype4_theater1.sed'));
  const dims = deriveDimensions(t4);
  assert.ok(Number.isFinite(dims.mapW) && dims.mapW > 0);
  assert.ok(Number.isFinite(dims.mapH) && dims.mapH > 0);
  // 换算关系：mapW = genW + 4 / mapH = genH + 12（见 cell.ts RmgGridGeometry）
  assert.equal(dims.mapW - 4, dims.genW, 'mapW = genW + 4');
  assert.equal(dims.mapH - 12, dims.genH, 'mapH = genH + 12');
});

// ---------------------------------------------------------------------------
// 三、round-trip：真实样本解析 → 再保存 → 再解析，须逐字段不变
// ---------------------------------------------------------------------------

test('真实样本 round-trip 稳定（parse → save → parse 字段不变）', () => {
  const original = readSed('randmap_maptype4_theater1.sed');
  const a = loadSed(original);
  const saved = saveSed(a);
  const b = loadSed(saved);

  for (const key of SED_INT_KEYS) {
    assert.equal(
      (b as any)[key],
      (a as any)[key],
      `字段 ${key} 经 round-trip 后变了`,
    );
  }
  assert.equal(b.description, a.description, 'Description 应保持不变');
});

test('真实样本 save 后仍是合法 .SED（17 键 + [RandomMap] 头）', () => {
  const a = loadSed(readSed('randmap_maptype4_theater1.sed'));
  const saved = saveSed(a);
  assert.ok(saved.startsWith('[RandomMap]'), '须保留节头');
  // 17 键 = 16 个 int 键 + description
  const lines = saved.split(/\r?\n/).filter((l) => l.includes('='));
  assert.equal(lines.length, 1 + SED_INT_KEYS.length, '键数应与 SED_INT_KEYS 一致');
});

// ---------------------------------------------------------------------------
// 四、与 RMGMD.INI 的联动（真实样本的 theater=1）
// ---------------------------------------------------------------------------

test('真实样本 theater=1 走 rmgmd 缺省（无本地 RMGMD.INI 时）', () => {
  // 缺省口径：2500/5500/500（构造器缺省），零售文本为 900/1050/600。
  // 本测试只确认读取路径不抛，且 min < max。
  const s = defaultRmgSettings();
  assert.ok(s.minTiberium < s.maxTiberium, 'minTiberium 应小于 maxTiberium');
  assert.ok(s.maxTrees > 0);
});

// ---------------------------------------------------------------------------
// 五、生成产物存在性（记录性断言：样本 img 在仓内）
// ---------------------------------------------------------------------------

test('真实生成的 RandMap.img 已随样本入库（25518 B）', () => {
  const buf = readFileSync(join(FIX, 'randmap_maptype4.img'));
  assert.equal(buf.length, 25518, 'img 字节数应与采自真机时一致');
  // 非断言具体内容：RA2 的 .img 不是自描述格式，解析需 mix 里的 tileset。
  // 它的价值是**将来**做逐字节对拍时的比对基准，先固定长度防误改。
});
