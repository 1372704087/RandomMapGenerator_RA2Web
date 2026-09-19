/**
 * `.SED` 种子文件读写 —— `MapSeedClass` writer `0x00597760` / reader `0x00597A30`
 *
 * 布局（`[RandomMap]` 段，键序即 writer 输出序）：
 *   Description, Width, Height, NumPlayers, Seed, MapType, Theater, Time,
 *   RegionSize, Ruggedness, Accessibility, WaterAmount, Tiberium,
 *   TiberiumLayout, Vegetation, UrbanPresence, Resources
 *
 * 编码：
 *   - 整数键：有符号十进制 `%d`（不是 hex）。
 *   - Description：UTF-16 code unit 的逗号分隔 hex（如 `52,61,6e,...` 末尾带逗号）。
 *
 * 读取语义（carry-default）：每个键读失败/缺失时**保留当前字段值**。
 * 原生 reader 不调用 ClampFields；本模块同样不 clamp。
 */

import { IniFile } from '../io/iniFile';
import { defaultOptions, RmgOptions } from './options';

/** writer 输出的整数键顺序（Description 单独处理） */
export const SED_INT_KEYS = [
  'Width',
  'Height',
  'NumPlayers',
  'Seed',
  'MapType',
  'Theater',
  'Time',
  'RegionSize',
  'Ruggedness',
  'Accessibility',
  'WaterAmount',
  'Tiberium',
  'TiberiumLayout',
  'Vegetation',
  'UrbanPresence',
  'Resources',
] as const;

export type SedIntKey = (typeof SED_INT_KEYS)[number];

/** SED 键名（PascalCase）→ RmgOptions 数值字段名 */
type SedNumericField =
  | 'width'
  | 'height'
  | 'numPlayers'
  | 'seed'
  | 'mapType'
  | 'theater'
  | 'time'
  | 'regionSize'
  | 'ruggedness'
  | 'accessibility'
  | 'waterAmount'
  | 'tiberium'
  | 'tiberiumLayout'
  | 'vegetation'
  | 'urbanPresence'
  | 'resources';

const SED_TO_FIELD: Record<SedIntKey, SedNumericField> = {
  Width: 'width',
  Height: 'height',
  NumPlayers: 'numPlayers',
  Seed: 'seed',
  MapType: 'mapType',
  Theater: 'theater',
  Time: 'time',
  RegionSize: 'regionSize',
  Ruggedness: 'ruggedness',
  Accessibility: 'accessibility',
  WaterAmount: 'waterAmount',
  Tiberium: 'tiberium',
  TiberiumLayout: 'tiberiumLayout',
  Vegetation: 'vegetation',
  UrbanPresence: 'urbanPresence',
  Resources: 'resources',
};

const SECTION = 'RandomMap';

/**
 * 把 Unicode 字符串编码为原生 Description 值（UTF-16 code unit → hex CSV）。
 * 每个 code unit 写小写 hex，后跟 `,`。
 */
export function encodeSedDescription(text: string): string {
  if (text.length === 0) return '';
  let out = '';
  for (let i = 0; i < text.length; i++) {
    out += text.charCodeAt(i).toString(16) + ',';
  }
  return out;
}

/** 解码原生 Description（忽略非法 token，遇空串返回 ''）。 */
export function decodeSedDescription(encoded: string): string {
  const raw = encoded.trim();
  if (raw.length === 0) return '';
  let out = '';
  for (const token of raw.split(',')) {
    const t = token.trim();
    if (t.length === 0) continue;
    const code = Number.parseInt(t, 16);
    if (Number.isNaN(code)) continue;
    out += String.fromCharCode(code & 0xffff);
  }
  return out;
}

/**
 * 从 `.SED` 文本读入选项。
 *
 * @param content  `.SED` INI 文本
 * @param current  读取起点；缺失键保留其当前值。缺省用构造器默认。
 * @returns 填充后的新对象（不修改 `current`）
 */
export function loadSed(content: string, current?: RmgOptions): RmgOptions {
  const out: RmgOptions = { ...(current ?? defaultOptions()) };
  const ini = new IniFile(content);
  const sec = ini.GetSection(SECTION);
  if (!sec) return out;

  // Description：缺失/空则保留 current.description
  if (sec.KeyExists('Description')) {
    const encoded = sec.GetStringValue('Description', '');
    // 空串保留默认；非空则覆盖
    if (encoded.length > 0) {
      out.description = decodeSedDescription(encoded);
    }
  }

  for (const key of SED_INT_KEYS) {
    if (!sec.KeyExists(key)) continue;
    const raw = sec.GetStringValue(key, '');
    // 整数读失败（非数字）→ 保留当前值
    if (!/^[+-]?\d+$/.test(raw.trim())) continue;
    const v = Number.parseInt(raw.trim(), 10);
    if (Number.isNaN(v)) continue;
    out[SED_TO_FIELD[key]] = v;
  }

  return out;
}

/**
 * 把选项写成 `.SED` 文本。
 * 键序与原生 writer 一致；整数一律十进制；Description 总是写出（可为空）。
 */
export function saveSed(options: RmgOptions): string {
  const ini = new IniFile();
  const sec = ini.AddSection(SECTION);

  sec.SetStringValue('Description', encodeSedDescription(options.description ?? ''));

  for (const key of SED_INT_KEYS) {
    const field = SED_TO_FIELD[key];
    const v = options[field];
    sec.SetStringValue(key, String((v as number) | 0));
  }

  return ini.WriteIniFile();
}

/** 便捷：round-trip 测试用 —— load 后 save。 */
export function roundTripSed(content: string, current?: RmgOptions): string {
  return saveSed(loadSed(content, current));
}
