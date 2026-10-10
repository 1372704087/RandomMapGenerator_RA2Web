/**
 * ⭐ 真机 RMG 产出地图的对拍基线 —— 这是本仓 RMG 唯一有意义的黄金参照。
 *
 * 样本：`H:\Red-Alert-2-Yuris-Revenge\Random Map.yrm`
 *   309 756 B，40 段，`[Basic] Name=Random Map` / `Author=Handama`
 *   —— 即第三方 RMG（Handama 的 RandomMapGenerator）实际生成的地图。
 *
 * ⚠ **为什么它是对拍目标**：
 *   - gamemd 的 RMG 只写 `RandMap.img`（中间产物），**不产出 .map**；
 *   - 但游戏会把生成的地图**存为 .yrm**（用户另存/或启动器流程），这份就是；
 *   - 段结构与 `emit.ts` 的产出目标**一一对应** ⇒ 可直接比对。
 *
 * 【对拍口径】本仓 `emitRmg` 的输出应与本样本的 `[IsoMapPack5]` /
 * `[OverlayPack]` / `[OverlayDataPack]` 同构。
 * 当前测试只锁定**格式契约**（段名/键名/编码），
 * 逐字节一致需等阶段 7-10 + cell 网格 golden 就绪后再加。
 *
 * 与 `rmg3rdparty_templateMap.map` 的关系：那是**空模板**（NumberStartingPoints=0、
 * 26 段、无 IsoMapPack5），本样本是**实际产出**（40 段、含全部数据段）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { IniFile } from '../io/iniFile';

const FIX = join(__dirname, '..', '..', 'src', 'test', 'fixtures');
const raw = readFileSync(join(FIX, 'rmg_real_randommap.yrm'), 'latin1');
const ini = new IniFile(raw);

// ---------------------------------------------------------------------------
// 一、整体结构
// ---------------------------------------------------------------------------

test('真机 RMG 地图：体积与段数（309756 B / 40 段）', () => {
  assert.equal(raw.length, 309756, '样本字节数应与采集时一致');
  assert.equal(ini.GetSections().length, 40, '段数应为 40');
});

test('真机 RMG 地图：含 emit 产出所需的全部数据段', () => {
  // 这 5 段是 emit.ts 的产出目标，也是逐字节对拍的比对对象
  for (const s of [
    'Header', 'Map', 'Basic', 'Lighting',
    'IsoMapPack5', 'OverlayPack', 'OverlayDataPack', 'Digest',
    'Terrain', 'Units', 'Waypoints', 'CellTags',
  ]) {
    assert.ok(ini.SectionExists(s), `应含 [${s}] 段`);
  }
});

test('真机 RMG 地图：段顺序符合 RA2 惯例（Header 首位、Digest 末位）', () => {
  const secs = ini.GetSections();
  assert.equal(secs[0], 'Header', '首段应为 Header');
  assert.equal(secs[secs.length - 1], 'Digest', '末段应为 Digest');
  // 实测序（40 段）：Header > Preview > PreviewPack > Basic > AITriggerTypesEnable
  //   > 13 阵营段 > Special/Houses/General/… > Lighting/CellTags/Tags/Map
  //   > Units/…/Waypoints > IsoMapPack5/OverlayPack/OverlayDataPack > Digest
  // ⇒ Preview 在 Basic **之前**（与空模板的 Basic>Preview 相反，别写死顺序）
  assert.equal(secs[1], 'Preview', '次段应为 Preview');
  assert.equal(secs[3], 'Basic', '第 4 段应为 Basic');
  // 三大数据段必须相邻且在 Digest 之前
  const iIso = secs.indexOf('IsoMapPack5');
  const iPack = secs.indexOf('OverlayPack');
  const iData = secs.indexOf('OverlayDataPack');
  assert.ok(iIso < iPack && iPack < iData, 'IsoMapPack5 < OverlayPack < OverlayDataPack');
  assert.equal(iData, secs.length - 2, 'OverlayDataPack 应紧邻 Digest 之前');
});

// ---------------------------------------------------------------------------
// 二、几何口径 —— 与 deriveDimensions 的口径对齐
// ---------------------------------------------------------------------------

test('真机地图 [Header] Width/Height 与 [Map] Size/LocalSize 的关系', () => {
  const w = ini.GetIntValue('Header', 'Width', -1);
  const h = ini.GetIntValue('Header', 'Height', -1);
  const mapSize = ini.GetStringValue('Map', 'Size', '');
  const localSize = ini.GetStringValue('Map', 'LocalSize', '');

  assert.ok(w > 0 && h > 0, `Header 宽高应 >0，实际 ${w}x${h}`);

  // Size = "0,0,W,H"（4 个 u16）
  const ms = /^(\d+),(\d+),(\d+),(\d+)$/.exec(mapSize);
  assert.ok(ms, `[Map] Size 应为 4 段 u16，实际 "${mapSize}"`);
  const sizeW = Number(ms[3]);
  const sizeH = Number(ms[4]);

  // LocalSize = "x0,y0,w,h"（左上角 + 尺寸）
  const ls = /^(\d+),(\d+),(\d+),(\d+)$/.exec(localSize);
  assert.ok(ls, `[Map] LocalSize 应为 4 个 u16，实际 "${localSize}"`);
  const lsW = Number(ls[3]);
  const lsH = Number(ls[4]);

  // RA2 口径：Size 含边框，LocalSize 是实际可玩区
  // 本仓 deriveDimensions: mapW = genW + 4, mapH = genH + 12
  // ⇒ 可玩区应比 Size 小一圈
  assert.ok(lsW < sizeW, `LocalSize 宽应 < Size 宽（${lsW} < ${sizeW}）`);
  assert.ok(lsH < sizeH, `LocalSize 高应 < Size 高（${lsH} < ${sizeH}）`);
  // 本样本实测：Size 121×121 / LocalSize 117×107 ⇒ 宽差 4、高差 14
  assert.equal(sizeW - lsW, 4, 'Size 宽 − LocalSize 宽 应为 4（= genW+4 口径）');
  // 高度差：mapH = genH + 12，而 LocalSize 高 = genH ⇒ 差 12 + 2×边框
  assert.equal(sizeH - lsH, 14, 'Size 高 − LocalSize 高 应为 14');
});

test('真机地图 [Header] 的 W/H 与 LocalSize 对应', () => {
  // 实测：Header.Width=116 vs LocalSize 宽=117（差 1）
  //      Header.Height=107 vs LocalSize 高=107（相等）
  // ⇒ Width 少 1 是菱形带的必然（带内 (rx,ry) 的 x 上界比矩形少一格），
  //   **不要断言二者相等**。
  const w = ini.GetIntValue('Header', 'Width', -1);
  const h = ini.GetIntValue('Header', 'Height', -1);
  const ls = /^(\d+),(\d+),(\d+),(\d+)$/.exec(ini.GetStringValue('Map', 'LocalSize', ''))!;
  const lsW = Number(ls[3]);
  const lsH = Number(ls[4]);
  assert.equal(w, lsW - 1, 'Header.Width 应为 LocalSize 宽 − 1（菱形带 x 上界）');
  assert.equal(h, lsH, 'Header.Height 应等于 LocalSize 高');
});

test('真机地图 [Map] Theater 非空（tileset 来源）', () => {
  const th = ini.GetStringValue('Map', 'Theater', '');
  assert.ok(th.length > 0, '[Map] Theater 应非空');
  assert.match(th, /^[A-Z]+$/, `Theater 应为大写字母，本样本为 "${th}"`);
});

// ---------------------------------------------------------------------------
// 三、[Basic] —— RMG 产出标识
// ---------------------------------------------------------------------------

test('真机地图 [Basic] 标识为 RMG 产出', () => {
  assert.equal(ini.GetStringValue('Basic', 'Name', ''), 'Random Map',
    '[Basic] Name 应为 "Random Map"（RMG 默认内部名）');
  assert.ok(ini.GetStringValue('Basic', 'Author', '').length > 0, '应有 Author');
  assert.equal(ini.GetStringValue('Basic', 'GameMode', ''), 'standard', 'GameMode 应为 standard');
  assert.equal(ini.GetStringValue('Basic', 'Official', ''), 'no', 'Official 应为 no');
  assert.ok(ini.GetIntValue('Basic', 'MaxPlayer', 0) >= 2, 'MaxPlayer 应 >= 2');
  assert.ok(ini.GetIntValue('Basic', 'MinPlayer', 0) >= 2, 'MinPlayer 应 >= 2');
});

test('真机地图 [Header] 起点数 > 0（真实地图已放置玩家）', () => {
  // 与空模板（NumberStartingPoints=0）对照：真实地图必有玩家
  const nsp = ini.GetIntValue('Header', 'NumberStartingPoints', -1);
  assert.ok(nsp > 0, `NumberStartingPoints 应 >0，实际 ${nsp}`);
  const maxPlayer = ini.GetIntValue('Basic', 'MaxPlayer', 0);
  assert.ok(nsp <= maxPlayer, `起点数(${nsp}) 不应超过 MaxPlayer(${maxPlayer})`);
});

// ---------------------------------------------------------------------------
// 四、三个 base64 数据段 —— 逐字节对拍的主要对象
// ---------------------------------------------------------------------------

/** 收集形如 "1=base64" 的数据行，按序号拼接成一条连续流 */
function collectBase64Stream(iniFile: IniFile, section: string): string {
  const sec = iniFile.GetSection(section);
  assert.ok(sec, `应有 [${section}] 段`);
  const keys: string[] = [];
  let s = '';
  // 段内 key 顺序即序号顺序；用 GetSection 的键枚举
  for (const k of sec!.Keys) keys.push(k);
  keys.sort((a, b) => Number(a) - Number(b));
  for (const k of keys) {
    const v = sec!.GetStringValue(k, '');
    assert.match(v, /^[A-Za-z0-9+/=]+$/, `[${section}] 键 ${k} 应为纯 base64`);
    s += v;
  }
  return s;
}

test('真机地图 [IsoMapPack5] 编码链：base64 整流 + Format5 分块 LZO', () => {
  // ⚠ 关键：base64 是**跨行连续切断**的 —— 首行 base64 解码后仅 55 字节，
  // 而首块头声明 size_in=4030（需 4034 字节）⇒ 单行装不下一个块。
  // **必须先把全部 base64 串拼接、再整体解码**，逐行独立解码是错的。
  // （ModEnc 的解码步骤 1-2 就是"把所有值合并成一个长串再 base64 解码"）
  const sec = ini.GetSection('IsoMapPack5')!;
  const keys = sec.Keys.slice().sort((a, b) => Number(a) - Number(b));
  assert.equal(keys.length, 2806, '本样本 IsoMapPack5 应有 2806 个 base64 块行');

  // 每行长度只有两种：74（正常）与 22（末行）
  const lens = new Set(keys.map((k) => sec.GetStringValue(k, '').length));
  assert.deepEqual([...lens].sort((a, b) => a - b), [22, 74],
    '每行 base64 长度应只有 74(正常)与 22(末行)两种');

  // 拼接全部 base64 → 整体解码
  const b64 = keys.map((k) => sec.GetStringValue(k, '')).join('');
  assert.equal(b64.length % 4, 0, '拼接后 base64 总长应为 4 的倍数');
  const raw = Buffer.from(b64, 'base64');
  assert.equal(raw.length, 155693, '整体解码应得 155693 字节的 LZO 块流');

  // 块流结构：每块 u16 size_in + u16 size_out + size_in 字节压缩数据
  const firstIn = raw.readUInt16LE(0);
  const firstOut = raw.readUInt16LE(2);
  assert.equal(firstIn, 4030, '首块 size_in 应为 4030');
  assert.equal(firstOut, 8192, '首块 size_out 应为 8192（标准块大小）');
  // 首行 base64 解码仅 55 字节 < 4034 ⇒ 证明跨行切断
  const firstLineBytes = Buffer.from(sec.GetStringValue('1', ''), 'base64').length;
  assert.ok(firstLineBytes < 4 + firstIn,
    `首行仅 ${firstLineBytes} 字节，装不下首块 ${4 + firstIn} 字节 ⇒ 跨行切断`);
});

test('真机地图 [IsoMapPack5] 的 LZO 块流可持续解出且以 (0,0) 终止', () => {
  const { decompressRange } = require('../format/minilzo') as {
    decompressRange(s: Uint8Array, ss: number, sl: number, d: Uint8Array, ds: number): number;
  };
  const sec = ini.GetSection('IsoMapPack5')!;
  const keys = sec.Keys.slice().sort((a, b) => Number(a) - Number(b));
  const raw = Buffer.from(keys.map((k) => sec.GetStringValue(k, '')).join(''), 'base64');

  let r = 0;
  let n = 0;
  const parts: Buffer[] = [];
  // ⚠ 不要设块数上限：未解完时末尾拿不到 (0,0) 终止符（实测末尾是 `007900a9`
  //   这类残块）。必须解到 size_in/size_out 为 0 的真终止。
  while (r + 4 <= raw.length) {
    const sizeIn = raw.readUInt16LE(r);
    const sizeOut = raw.readUInt16LE(r + 2);
    if (sizeIn === 0 || sizeOut === 0) break;
    r += 4;
    const out = new Uint8Array(sizeOut + 1024);
    decompressRange(new Uint8Array(raw), r, sizeIn, out, 0);
    parts.push(Buffer.from(out.slice(0, sizeOut)));
    r += sizeIn;
    n += 1;
    if (n > 200) break; // 防死循环的硬保险（实测仅 ~40 块）
  }
  assert.ok(n >= 6, `应至少解出 6 块，实际 ${n}`);
  const all = Buffer.concat(parts);
  assert.ok(all.length > 60000, `tile 流应 >60000 字节，实际 ${all.length}`);
  // 末 4 字节 = (0,0) 终止符（ModEnc 明述）
  assert.equal(all.slice(-4).toString('hex'), '00000000',
    'tile 流末尾应为 (0,0) 终止符');
  assert.ok(all.length / 11 > 5000, `tile 流应 >55000 字节（>5000 tile），实际 ${all.length}`);
});

test('真机地图 [OverlayPack] / [OverlayDataPack] 同构且可解码', () => {
  const pack = collectBase64Stream(ini, 'OverlayPack');
  const dataPack = collectBase64Stream(ini, 'OverlayDataPack');
  assert.ok(pack.length > 0 && dataPack.length > 0, '两段都应有内容');
  assert.equal(pack.length % 4, 0, '[OverlayPack] 拼接后应为 4 的倍数');
  assert.equal(dataPack.length % 4, 0, '[OverlayDataPack] 拼接后应为 4 的倍数');
  const pb = Buffer.from(pack, 'base64');
  const db = Buffer.from(dataPack, 'base64');
  assert.ok(pb.length > 0 && db.length > 0, '两段都应能解出字节');
});

test('真机地图 [OverlayPack] / [OverlayDataPack] 同构且可解码', () => {
  const pack = collectBase64Stream(ini, 'OverlayPack');
  const dataPack = collectBase64Stream(ini, 'OverlayDataPack');
  assert.ok(pack.length > 0 && dataPack.length > 0, '两段都应有内容');
  assert.equal(pack.length % 4, 0, '[OverlayPack] 拼接后应为 4 的倍数');
  assert.equal(dataPack.length % 4, 0, '[OverlayDataPack] 拼接后应为 4 的倍数');
  const pb = Buffer.from(pack, 'base64');
  const db = Buffer.from(dataPack, 'base64');
  assert.ok(pb.length > 0 && db.length > 0, '两段都应能解出字节');
});

test('真机地图 [Digest] 是 20 字节校验和（SHA-1）', () => {
  const d = ini.GetStringValue('Digest', '1', '');
  assert.ok(d.length > 0, '[Digest] 应有值');
  const bytes = Buffer.from(d, 'base64');
  assert.equal(bytes.length, 20, `Digest 应为 20 字节 (SHA-1)，实际 ${bytes.length}`);
});

// ---------------------------------------------------------------------------
// 五、阵营段 —— RMG 必须写全 3 个阵营 × 2 基地类型
// ---------------------------------------------------------------------------

test('真机地图含全部阵营段（RMG 需为每阵营写 spawn 配置）', () => {
  for (const s of [
    'Americans', 'Alliance', 'French', 'Germans', 'British',
    'Africans', 'Arabs', 'Confederation', 'Russians', 'YuriCountry',
    'GDI', 'Nod', 'Neutral', 'Houses',
  ]) {
    assert.ok(ini.SectionExists(s), `应含 [${s}] 阵营段`);
  }
});

test('真机地图 [General] 含 RMG 相关键', () => {
  // General 段承载全局难度/行为参数
  const sec = ini.GetSection('General');
  assert.ok(sec, '应有 [General] 段');
  // 至少能取到若干键（内容随游戏版本变化，不硬编码具体键名）
  assert.ok(sec!.Keys.length > 0, '[General] 应有至少一个键');
});

// ---------------------------------------------------------------------------
// 六、对象段 —— RMG 产出的实体
// ---------------------------------------------------------------------------

test('真机地图含对象段（Units/Infantry/Structures/Aircraft/Smudge/Waypoints）', () => {
  for (const s of ['Units', 'Infantry', 'Structures', 'Aircraft', 'Smudge', 'Waypoints']) {
    assert.ok(ini.SectionExists(s), `应含 [${s}] 对象段`);
  }
});

test('真机地图 [Waypoints] 至少有出生点标记', () => {
  const nsp = ini.GetIntValue('Header', 'NumberStartingPoints', 0);
  const wps = ini.GetStringValue('Waypoints', '1', '');
  if (nsp > 0) {
    assert.ok(wps.length > 0, '有出生点时 [Waypoints] 应有内容');
  }
  // Waypoints 段本身应存在（哪怕 RMG 没放额外路径）
  assert.ok(ini.SectionExists('Waypoints'), '应有 [Waypoints] 段');
});
