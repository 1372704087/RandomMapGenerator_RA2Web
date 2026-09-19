/**
 * 地图雷达预览渲染
 *
 * 与 FA2 小地图同一套配色来源（minimap.ini，按 TileNum / SubTile 查色），
 * 并复刻 WorkingMap 的覆盖规则：宝石紫、矿黄、其他覆盖物灰、断桥还原底色、
 * 地形物件绿/深灰、建筑灰、高度明暗（Z*2-1）。
 *
 * 投影与 MapFile.RenderPreview 相同：一格一像素，像素 = (Dx, (Dy - Dx%2)/2)。
 * 这是给网页端「地图渲染预览」用的独立入口，不依赖 WorkingMap 的全局状态。
 */

import { IniFile } from './io/iniFile';
import { MapFile } from './fileio';

/** 渲染结果：RGB 字节序（width × height × 3），前端可直接填 ImageData */
export interface MapPreview {
  /** 像素宽 = [Map] Size 的 Width × 2 − 1 */
  width: number;
  /** 像素高 = Height */
  height: number;
  rgb: Uint8Array;
}

function clamp(v: number): number {
  if (Number.isNaN(v)) return 0;
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** 从 minimap.ini 的 [theater] 段取某 TileNum/SubTile 的基础色 */
function baseColor(
  mini: IniSectionLike | null,
  tileNum: number,
  subTile: number,
): Rgb {
  if (!mini) return { r: 255, g: 255, b: 255 };
  const value = mini.GetStringValue(String(tileNum), '255,255,255,255,255,255');
  const combos = value.split('/');
  let index = subTile;
  // 与 WorkingMap 的实现一致：越界回落到第一组
  if (index >= combos.length) index = 0;
  const rgbs = (combos[index] ?? '').split(',');
  return {
    r: clamp(Number.parseInt(rgbs[0], 10)),
    g: clamp(Number.parseInt(rgbs[1], 10)),
    b: clamp(Number.parseInt(rgbs[2], 10)),
  };
}

/** IniSection 的最小结构（避免暴露 IniFile 内部类型） */
interface IniSectionLike {
  GetStringValue(key: string, fallback: string): string;
  KeyExists(key: string): boolean;
}

/**
 * 渲染整张地图的雷达预览。
 *
 * @param mapContent     完整地图 INI 文本
 * @param minimapContent minimap.ini 文本
 * @param theaterName    地图自己的 [Map] Theater（决定 minimap.ini 的段名）
 */
export function renderMapPreview(
  mapContent: string,
  minimapContent: string | null | undefined,
  theaterName: string | null,
): MapPreview {
  const map = new MapFile();
  map.CreateIsoTileList(mapContent);
  if (map.IsoTileList.length === 0) {
    throw new Error('renderMapPreview: 地图没有可渲染的图块（IsoTileList 为空）');
  }
  const overlays = map.ReadOverlay(mapContent) ?? [];

  // --- 各类「地图对象」的落点 ---
  const overlayAt = new Map<string, number>();
  for (const ov of overlays) {
    if (ov.Tile) overlayAt.set(`${ov.Tile.Rx},${ov.Tile.Ry}`, ov.OverlayID);
  }

  const mapIni = new IniFile(mapContent);
  const terrainAt = new Map<string, string>();
  const terrainSec = mapIni.GetSection('Terrain');
  if (terrainSec) {
    // 键格式 = `${ry}${String(rx).padStart(3, '0')}`（见 emit.ts / attachObjects）
    for (const key of terrainSec.Keys) {
      if (key.length <= 3) continue;
      const name = terrainSec.GetStringValue(key, '');
      if (!name) continue;
      terrainAt.set(`${Number(key.slice(-3))},${Number(key.slice(0, -3))}`, name);
    }
  }
  const objectAt = new Set<string>();
  for (const sec of ['Structures', 'Units', 'Infantry', 'Aircraft']) {
    const s = mapIni.GetSection(sec);
    if (!s) continue;
    for (const key of s.Keys) {
      const parts = s.GetStringValue(key, '').split(',');
      // 与 attachObjects 一致：第 4/5 位（0 基下标 3/4）是 X/Y
      const x = Number.parseInt(parts[3], 10);
      const y = Number.parseInt(parts[4], 10);
      if (Number.isFinite(x) && Number.isFinite(y)) objectAt.add(`${x},${y}`);
    }
  }

  // --- minimap.ini 的 [theater] 段 ---
  let mini: IniSectionLike | null = null;
  if (minimapContent && minimapContent.trim().length > 0) {
    const name = (theaterName ?? 'TEMPERATE').toUpperCase();
    const ini = new IniFile(minimapContent);
    mini = ini.GetSection(name);
    if (!mini && name !== 'TEMPERATE') mini = ini.GetSection('TEMPERATE');
  }

  // --- 逐格配色 + 投影 ---
  const width = map.Width * 2 - 1;
  const height = map.Height;
  const rgb = new Uint8Array(width * height * 3);

  for (const t of map.IsoTileList) {
    let c: Rgb;
    if (t.TileNum === -1) {
      // 未赋值格（画布外/无数据）：白色，与编辑器的空白观感一致
      c = { r: 255, g: 255, b: 255 };
    } else {
      c = baseColor(mini, t.TileNum, t.SubTile & 0xff);
    }

    const key = `${t.Rx},${t.Ry}`;
    const ovl = overlayAt.get(key);
    if (ovl !== undefined) {
      if (ovl >= 27 && ovl <= 38) c = { r: 132, g: 0, b: 132 }; // 宝石
      else if (ovl >= 102 && ovl <= 166) c = { r: 220, g: 217, b: 0 }; // 矿
      else if (ovl !== 100 && ovl !== 101 && ovl !== 231) c = { r: 91, g: 91, b: 93 };
      // 100/101/231 = 断桥 → 保留底色
    }

    const terr = terrainAt.get(key);
    if (terr !== undefined) {
      if (terr.includes('TREE')) c = { r: 0, g: 194, b: 0 };
      else if (terr.includes('TIBTRE')) c = { r: 10, g: 10, b: 10 };
      else c = { r: 69, g: 68, b: 69 };
    }
    if (objectAt.has(key)) c = { r: 123, g: 125, b: 123 };

    // 高度明暗（复刻 WorkingMap：Z ≤ 10 时 +Z*2-1）
    const z = t.Z & 0xff;
    if (t.TileNum !== -1 && z <= 10) {
      const d = z * 2 - 1;
      c = { r: clamp(c.r + d), g: clamp(c.g + d), b: clamp(c.b + d) };
    }

    const px = t.Dx;
    const py = (t.Dy - (t.Dx & 1)) / 2;
    if (px < 0 || px >= width || py < 0 || py >= height) continue;
    const off = (py * width + px) * 3;
    rgb[off] = c.r;
    rgb[off + 1] = c.g;
    rgb[off + 2] = c.b;
  }

  return { width, height, rgb };
}
