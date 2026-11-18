/**
 * MapUnit 扫描 + 命名规则（索引脚本与改名脚本共用，保证两边口径一致）
 *
 * 规则说明见 re/specs/MAPUNIT_NAMING.md
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { MapFile } from '../packages/core/dist/fileio.js';
import { IniFile } from '../packages/core/dist/io/iniFile.js';
import { decodeConnectionId } from '../packages/core/dist/tile/connectionId.js';

export const MAP_UNITS_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
  '../packages/server/resources/MapUnits',
);

/** 语义名（生成器按名字子串过滤，名字里必须保留这些词） */
const SEMANTIC = { spawn: 'spawn', tiberium: 'tiberium' };
const META_NAMES = new Set(['indicator', 'cannotplacesmudge']);

/** 递归列出某个 theater 下所有 .map（支持 `_` 前缀分组子目录） */
function listMaps(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('_')) out.push(...listMaps(full));
      continue;
    }
    if (entry.name.toLowerCase().endsWith('.map')) out.push(full);
  }
  return out.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

function kindOf(stem) {
  if (stem.toLowerCase() === 'empty') return 'empty';
  if (META_NAMES.has(stem.toLowerCase())) return 'meta';
  for (const [k, word] of Object.entries(SEMANTIC)) if (stem.toLowerCase().includes(word)) return k;
  return 'terrain';
}

/** 结构族：CAHSE01 -> hse，CAMSC04 -> msc，CASIN03E -> sin，CABHUT -> bhut */
function familyOf(code) {
  const body = code.trim().replace(/^CA/i, '');
  const m = /^[A-Za-z]+/.exec(body);
  return (m ? m[0] : body).toLowerCase();
}

function contentOf(content) {
  const ini = new IniFile(content);
  const n = (s) => ini.GetSection(s)?.Keys.length ?? 0;
  const stats = {
    struct: n('Structures'),
    terrain: n('Terrain'),
    overlay: n('OverlayPack') + n('OverlayDataPack'),
    units: n('Units') + n('Infantry') + n('Aircraft'),
  };
  const families = {};
  const s = ini.GetSection('Structures');
  if (s) {
    for (const k of s.Keys) {
      const code = (s.GetStringValue(k, '').split(',')[1] ?? '').trim();
      if (!code) continue;
      const f = familyOf(code);
      families[f] = (families[f] ?? 0) + 1;
    }
  }
  let dominant = '';
  let dominantN = 0;
  for (const [f, c] of Object.entries(families).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    dominant = f;
    dominantN = c;
    break;
  }
  return { ...stats, dominant, dominantN };
}

/** 读出一个 theater 的几何参数 */
function theaterGeom(dir) {
  const settings = new IniFile(fs.readFileSync(path.join(dir, 'settings.ini'), 'utf8'));
  const size = settings.GetStringValue('settings', 'MapUnitSize', '25x25');
  const corner = settings.GetStringValue('settings', 'TopCorner', '18,18');
  const [w] = size.split('x').map((x) => parseInt(x, 10));
  const [sx, sy] = corner.split(',').map((x) => parseInt(x, 10));
  const ind = new MapFile();
  ind.CreateIsoTileList(fs.readFileSync(path.join(dir, 'indicator.map'), 'utf8'));
  const indicatorNum = ind.IsoTileList[0].TileNum;
  return { width: w, startingX: sx, startingY: sy, indicatorNum, mapUnitSize: size, topCorner: corner };
}

/** 单个 .map → 一条索引记录（不解码 code4，需要 theater 级 base 后才能算） */
function readUnit(file, geom) {
  const content = fs.readFileSync(file, 'utf8');
  const stem = path.basename(file, path.extname(file));
  const mf = new MapFile();
  mf.CreateIsoTileList(content);
  const { width, startingX: SX, startingY: SY, indicatorNum: IND } = geom;

  const ids = { NW: -1, NE: -1, SW: -1, SE: -1 };
  for (const t of mf.IsoTileList) {
    if (t.TileNum !== IND) continue;
    if (t.Rx === SX - 3 && t.Ry - SY >= 0 && t.Ry - SY < width) ids.NW = decodeConnectionId(t.Ry - SY, t.SubTile, t.Z);
    if (t.Rx === SX + width + 2 && t.Ry - SY >= 0 && t.Ry - SY < width) ids.SE = decodeConnectionId(t.Ry - SY, t.SubTile, t.Z);
    if (t.Ry === SX - 3 && t.Rx - SY >= 0 && t.Rx - SY < width) ids.NE = decodeConnectionId(t.Rx - SY, t.SubTile, t.Z);
    if (t.Ry === SX + width + 2 && t.Rx - SY >= 0 && t.Rx - SY < width) ids.SW = decodeConnectionId(t.Rx - SY, t.SubTile, t.Z);
  }

  let weight = 0;
  let ztop = 0;
  for (const t of mf.IsoTileList) {
    if (t.Rx < SX - 5 && t.TileNum === IND) weight++;
    if (t.Rx >= SX && t.Rx < SX + width && t.Ry >= SY && t.Ry < SY + width && t.Z > ztop) ztop = t.Z;
  }

  const sha1 = crypto.createHash('sha1').update(content, 'utf8').digest('hex');
  return {
    file: path.basename(file),
    path: path.relative(MAP_UNITS_DIR, file).replaceAll('\\', '/'),
    stem,
    kind: kindOf(stem),
    ...ids,
    weight,
    bytes: Buffer.byteLength(content, 'utf8'),
    sha1,
    ztop,
    ...contentOf(content),
  };
}

/** 扫描全部 theater；code4 用 theater 内最小连接 ID 作为 A */
export function scanAll() {
  const theaters = fs
    .readdirSync(MAP_UNITS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
    .map((e) => e.name)
    .sort();

  const result = [];
  for (const theater of theaters) {
    const dir = path.join(MAP_UNITS_DIR, theater);
    const geom = theaterGeom(dir);
    const units = listMaps(dir)
      .filter((f) => !['indicator.map', 'cannotplacesmudge.map'].includes(path.basename(f).toLowerCase()))
      .map((f) => readUnit(f, geom));

    const base = Math.min(
      ...units.filter((u) => u.kind === 'terrain' && u.NW >= 0).flatMap((u) => [u.NW, u.NE, u.SW, u.SE]),
    );
    for (const u of units) {
      u.theater = theater;
      u.code4 = [u.NW, u.NE, u.SW, u.SE].map((id) => (id < 0 ? '-' : String.fromCharCode(65 + id - base))).join('');
      u.label = labelOf(u);
    }

    // 重复组：同 theater 内 sha1 相同的件
    const bySha = new Map();
    for (const u of units) {
      if (!bySha.has(u.sha1)) bySha.set(u.sha1, []);
      bySha.get(u.sha1).push(u);
    }
    let n = 0;
    for (const list of bySha.values()) {
      if (list.length < 2) continue;
      const id = `${theater}-D${++n}`;
      for (const u of list) u.dupGroup = id;
    }
    for (const u of units) u.dupGroup ??= '';

    result.push(...units);
  }
  return { theaters, units: result };
}

/** 内容标签：只标「类型」，数量留在索引的 struct/terrain/overlay 列 */
export function labelOf(u) {
  if (u.kind === 'spawn') return 'spawn';
  if (u.kind === 'tiberium') return 'tiberium';
  if (u.kind === 'meta') return 'meta';
  if (u.kind === 'empty') return 'empty';
  if (u.struct > 0 && u.dominant) return u.dominant;
  if (u.terrain > 0) return 'trees';
  if (u.overlay > 0) return 'ovl';
  return 'plain';
}

export const KIND_TAG = { terrain: 't', spawn: 's', tiberium: 'o', empty: 'e', meta: 'm' };

/**
 * 目标文件名：<label>_<kindTag>_<code4>_w<weight>_<seq>.map
 * empty.map 保持原名（loader 与 splitter 按固定名读取），meta 不动。
 */
export function targetName(u, seq, ext = '.map') {
  if (u.kind === 'meta' || u.kind === 'empty') return null; // 不动
  return `${u.label}_${KIND_TAG[u.kind]}_${u.code4}_w${u.weight}_${String(seq).padStart(2, '0')}${ext}`;
}
