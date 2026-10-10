/**
 * 第三方 RMG 输出模板的对拍基线 —— 回答"`RandMap.Map` 到底长什么样"。
 *
 * 样本：`H:\RA2YRLauncher\RA2YRdata\RandomMapGenerator_RA2\templateMap.map`
 *   —— RA2YR 启动器内置的**第三方 RMG（C# RandomMapGenerator，作者 Handama）**
 *      输出模板。它给出 RMG 产出 INI 的**完整段骨架**，
 *      含 `[OverlayDataPack]` / `[OverlayPack]` / `[Digest]` ——
 *      正是本仓 `emit.ts` 要产出的东西。
 *
 * ⚠ 与 `RandMap.img` 的关系：
 *   `RandMap.img` 是 gamemd 的中间产物（RMG 管理器写出）；
 *   而本模板是**最终 .map INI 的形态**。
 *   要做逐字节对拍，目标是本模板这类 .map，而不是 .img。
 *
 * 本测试的作用：把真实 .map 的段名/键名固定下来，
 * 作为 emit 输出的**接口契约**（防止字段名写错却仍能出图）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { IniFile } from '../io/iniFile';

const FIX = join(__dirname, '..', '..', 'src', 'test', 'fixtures');
const raw = readFileSync(join(FIX, 'rmg3rdparty_templateMap.map'), 'latin1');

function sectionNames(text: string): string[] {
  const out: string[] = [];
  const re = /^\[([^\]]+)\]/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

test('真实 .map 模板体积与段数（采集时 6442 B）', () => {
  assert.equal(raw.length, 6442, '模板字节数应与采集时一致');
  const secs = sectionNames(raw);
  assert.ok(secs.length >= 20, `段数应 >=20，实际 ${secs.length}`);
});

test('真实 .map 含 RMG 必需的三大数据段', () => {
  // 这三个段是 emit.ts 的产出目标，也是对拍的核心
  const secs = sectionNames(raw);
  for (const need of ['Header', 'Map', 'OverlayDataPack', 'OverlayPack']) {
    assert.ok(secs.includes(need), `应含 [${need}] 段，实际有: ${secs.join(',')}`);
  }
});

test('[Map] 段结构：Size / Theater / LocalSize', () => {
  const m = /^\[Map\]\r?\n([\s\S]*?)(?=^\[)/m.exec(raw);
  assert.ok(m, '应有 [Map] 段');
  const body = m[1];
  assert.match(body, /^Size=/m, '[Map] 应有 Size');
  assert.match(body, /^Theater=/m, '[Map] 应有 Theater');
  assert.match(body, /^LocalSize=/m, '[Map] 应有 LocalSize');
  // Size 形如 "0,0,50,50"（4 个 u16）
  const size = /^Size=(\d+),(\d+),(\d+),(\d+)/m.exec(body);
  assert.ok(size, 'Size 应为 4 段 u16');
  const w = Number(size[3]);
  const h = Number(size[4]);
  assert.ok(w > 0 && h > 0, `Size 的宽高应 >0，实际 ${w}x${h}`);
});

test('[Header] 段含 Width/Height/NumberStartingPoints', () => {
  const m = /^\[Header\]\r?\n([\s\S]*?)(?=^\[)/m.exec(raw);
  assert.ok(m, '应有 [Header] 段');
  assert.match(m[1], /^Width=/m);
  assert.match(m[1], /^Height=/m);
  assert.match(m[1], /^NumberStartingPoints=/m);
  // 模板是 NumberStartingPoints=0（占位），真实地图由 RMG 填
  const nsp = /NumberStartingPoints=(\d+)/.exec(m[1]);
  assert.ok(nsp);
  assert.equal(Number(nsp[1]), 0, '模板的起点数应为 0（待生成时填）');
});

test('[OverlayDataPack] / [OverlayPack] 是 base64 分块数据（连续流的切片）', () => {
  // 这是 RMG 地形的两大部分：数据 + 索引。emit.ts 产出同构内容。
  // ⚠ 每行 base64 长度 70 —— **不是 4 的倍数**，说明这些行是
  //   一条连续 base64 流按固定字符数切出的片段，
  //   **必须按序号拼接后整体解码**，逐行解码会失败。
  for (const seg of ['OverlayDataPack', 'OverlayPack']) {
    const m = new RegExp('^\\[' + seg + '\\]\\r?\\n([\\s\\S]*?)(?=^\\[)', 'm').exec(raw);
    assert.ok(m, `应有 [${seg}] 段`);
    const lines = m[1].trim().split(/\r?\n/).filter((l) => l.includes('='));
    assert.ok(lines.length > 0, `[${seg}] 应有数据行`);

    // 序号必须从 1 连续递增
    lines.forEach((l, i) => {
      const kv = /^(\d+)=([A-Za-z0-9+/=]+)$/.exec(l.trim());
      assert.ok(kv, `[${seg}] 第 ${i + 1} 行应形如 "序号=base64"，实际: ${l.slice(0, 30)}`);
      assert.equal(Number(kv[1]), i + 1, `[${seg}] 序号应连续递增，第 ${i + 1} 行是 ${kv[1]}`);
    });

    // 拼接后整体解码必须成功且长度合理
    const joined = lines.map((l) => l.trim().split('=')[1]).join('');
    assert.equal(joined.length % 4, 0, `[${seg}] 拼接后总长应为 4 的倍数（实际 ${joined.length}）`);
    const bytes = Buffer.from(joined, 'base64');
    assert.ok(bytes.length > 0, `[${seg}] 拼接后应能解出字节`);
    // 每行 70 字符 ⇒ 单独一行解不出字节，必须拼接（这正是易错点）
    if (lines.length > 1) {
      const firstAlone = Buffer.from(lines[0].trim().split('=')[1], 'base64');
      assert.ok(firstAlone.length < bytes.length,
        '单行 base64 解码应不完整（故必须拼接）');
    }
  }
});

test('[OverlayPack] 与 [OverlayDataPack] 行数一致（索引/数据配对）', () => {
  const count = (seg: string): number => {
    const m = new RegExp('^\\[' + seg + '\\]\\r?\\n([\\s\\S]*?)(?=^\\[)', 'm').exec(raw);
    assert.ok(m, `应有 [${seg}] 段`);
    return m[1].trim().split(/\r?\n/).filter((l) => l.includes('=')).length;
  };
  assert.equal(
    count('OverlayDataPack'),
    count('OverlayPack'),
    '数据段与索引段行数应相同（一一配对）',
  );
});

test('[Digest] 段是 base64 校验和（RMG 作者内置比对机制）', () => {
  // 关键发现：第三方 RMG 在输出里内置了 Digest ⇒ 模板本身就是可比对的
  const m = /^\[Digest\]\r?\n(\d+)=([A-Za-z0-9+/=]+)\s*$/m.exec(raw);
  assert.ok(m, '应有 [Digest] 段且形如 "1=<base64>"');
  const digest = m[2];
  assert.equal(digest.length, 28, 'SHA-1 base64 应为 28 字符');
  assert.equal(Buffer.from(digest, 'base64').length, 20, '解码后应为 20 字节 (SHA-1)');
});

test('[Basic] 段标识 RMG 产出（Name=Random Map）', () => {
  const m = /^\[Basic\]\r?\n([\s\S]*?)(?=^\[)/m.exec(raw);
  assert.ok(m, '应有 [Basic] 段');
  assert.match(m[1], /^Name=Random Map\s*$/m, 'Name 应为 "Random Map"');
  assert.match(m[1], /^Author=/m);
  assert.match(m[1], /^GameMode=/m);
});

test('[AITriggerTypesEnable] 段按 0x%X 格式列出触发表 ID', () => {
  // 键名形如 "0A31295C-G=yes"：高 32 位十六进制 + "-G/-H" 阵营标记
  const m = /^\[AITriggerTypesEnable\]\r?\n([\s\S]*?)(?=^\[)/m.exec(raw);
  assert.ok(m, '应有 [AITriggerTypesEnable] 段');
  const lines = m[1].trim().split(/\r?\n/).filter((l) => l.includes('='));
  assert.ok(lines.length > 0, '应有触发表条目');
  for (const l of lines) {
    assert.match(l.trim(), /^[0-9A-F]{8}-[GH]=(yes|no)$/i,
      `条目应形如 "0A31295C-G=yes"，实际: ${l.slice(0, 30)}`);
  }
});

test('仓内 IniFile 能解析真实 .map（本仓读 .map 的能力已验证）', () => {
  // 关键验证：IniFile 直接吃字符串构造（见 iniFile.ts 构造函数）
  // 本仓 API 是 C# 风格 PascalCase：GetSection / GetStringValue / GetIntValue
  const ini = new IniFile(raw);

  assert.ok(ini.SectionExists('Map'), 'IniFile 应能识别 [Map] 段');
  const sizeTxt = ini.GetStringValue('Map', 'Size', '');
  assert.match(sizeTxt, /^\d+,\d+,\d+,\d+$/, `Size 应为 4 段 u16，实际 "${sizeTxt}"`);
  assert.ok(ini.GetStringValue('Map', 'Theater', ''), '[Map] 应能读出 Theater');

  assert.ok(ini.SectionExists('Header'), 'IniFile 应能识别 [Header] 段');
  const w = ini.GetIntValue('Header', 'Width', -1);
  const nsp = ini.GetIntValue('Header', 'NumberStartingPoints', -1);
  assert.ok(w > 0, `Header.Width 应 >0，实际 ${w}`);
  assert.equal(nsp, 0, '模板的 NumberStartingPoints 应为 0（待生成时填）');

  // 三大数据段 + 元信息段都应能取到
  for (const s of ['OverlayDataPack', 'OverlayPack', 'Basic', 'Digest']) {
    assert.ok(ini.SectionExists(s), `IniFile 应能识别 [${s}] 段`);
  }

  // 段枚举：首段 Header、末段 Digest
  const secs = ini.GetSections();
  assert.equal(secs[0], 'Header', '首段应为 Header');
  assert.equal(secs[secs.length - 1], 'Digest', '末段应为 Digest');
  assert.ok(secs.length >= 20, `段数应 >=20，实际 ${secs.length}`);
});
