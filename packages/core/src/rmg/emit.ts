/**
 * emit —— 把 cell 网格投影到现有 `MapFile`（IsoMapPack5 + OverlayPack）
 *
 * 验收（S2）：**emit 往返** —— 已生成的成功图 → grid → emit → 与源
 * 在 tile/subTile/Z/overlay 上逐格一致。完整 parity 仍需活 gamemd 的
 * cell 网格 golden（见 README「未认证」）。
 *
 * 坐标：grid `(x,y)` ≡ 引擎 cell 坐标 ≡ IsoMapPack 的 `(Rx,Ry)`（恒等映射）。
 * 带内 unassigned (`TILE_UNASSIGNED`) → TileNum `-1`；tile `0` 保持 `0`。
 */

import { MapFile } from '../fileio';
import { Overlay } from '../tile/overlay';
import { Theater } from '../tile/enums';
import { IsoTile } from '../tile/isoTile';
import { IniSection } from '../io/iniFile';
import { RmgGrid, RmgCell, TILE_UNASSIGNED, isInDiamond, gridArraySize } from './cell';
import { RmgOptions } from './options';

/**
 * RMG 选项 Theater → 引擎 `[Map] Theater` 名。
 * 与 vera20k `emit::theater_name` 一致；越界回退 TEMPERATE。
 *
 * 注意：RMG Theater 序与 `tile/enums.ts` 的 `Theater` 枚举**不同**
 * （RMG 3=DESERT，枚举 DESERT=5；RMG 4=NEWURBAN，枚举 NEWURBAN=3）。
 */
export function rmgTheaterToMapName(theater: number): string {
  switch (theater | 0) {
    case 1:
      return 'SNOW';
    case 2:
      return 'URBAN';
    case 3:
      return 'DESERT';
    case 4:
      return 'NEWURBAN';
    default:
      return 'TEMPERATE';
  }
}

/** RMG Theater → `tile/enums.ts` Theater 枚举值（写入 MapFile.MapTheater） */
export function rmgTheaterToEnum(theater: number): Theater {
  switch (theater | 0) {
    case 1:
      return Theater.SNOW;
    case 2:
      return Theater.URBAN;
    case 3:
      return Theater.DESERT;
    case 4:
      return Theater.NEWURBAN;
    default:
      return Theater.TEMPERATE;
  }
}

/** emit 时可选写入的对象（阶段后期填；S2 往返先只测格子） */
export interface EmitObjects {
  /** (name, rx, ry) → [Terrain] */
  terrain?: ReadonlyArray<readonly [string, number, number]>;
  /** (name, x, y) → [Structures]，owner 默认 Neutral */
  structures?: ReadonlyArray<readonly [string, number, number]>;
  /** (slot, x, y) → [Waypoints]，键为十进制 slot */
  waypoints?: ReadonlyArray<readonly [number, number, number]>;
}

/**
 * 从 grid 构建 `MapFile`（地形格 + 覆盖物；对象可选）。
 *
 * 不调用 `SaveFullMap` —— 调用方自行决定 template / bottomSpace。
 */
export function emitMapFile(
  grid: RmgGrid,
  theater: Theater,
  objects?: EmitObjects,
): MapFile {
  const mapFile = new MapFile();
  mapFile.Width = grid.width;
  mapFile.Height = grid.height;
  mapFile.MapTheater = theater;
  mapFile.IsoTileList = [];
  mapFile.OverlayList = [];

  const geom = {
    width: grid.width,
    height: grid.height,
    diamondMin: grid.diamondMin,
    diamondMax: grid.diamondMax,
  };
  void gridArraySize;

  // 带内全部写出（含 unassigned → TileNum -1），与 CreateEmptyMap/菱形过滤对齐
  for (const [rx, ry] of grid.nativeCells()) {
    const cell = grid.get(rx, ry);
    if (!cell) continue;
    const tileNum = cell.tile === TILE_UNASSIGNED ? -1 : cell.tile;
    const dx = rx - ry + grid.width - 1;
    const dy = rx + ry - grid.width - 1;
    mapFile.IsoTileList.push(
      new IsoTile(dx, dy, rx, ry, cell.level & 0xff, tileNum, cell.subTile & 0xff),
    );

    if (cell.overlay >= 0) {
      const ov = new Overlay(cell.overlay & 0xff, cell.density & 0xff);
      ov.Tile = mapFile.IsoTileList[mapFile.IsoTileList.length - 1];
      mapFile.OverlayList.push(ov);
    }
  }

  if (objects?.terrain?.length) {
    const sec: IniSection = mapFile.Terrain;
    for (const [name, x, y] of objects.terrain) {
      if (!isInDiamond(x, y, geom)) continue;
      const key = `${y}${String(x).padStart(3, '0')}`;
      sec.SetStringValue(key, name);
    }
  }

  if (objects?.structures?.length) {
    const sec: IniSection = mapFile.Structure;
    let i = 0;
    for (const [name, x, y] of objects.structures) {
      if (!isInDiamond(x, y, geom)) continue;
      // 17 字段：Owner,Name,Strength,X,Y,Direction,Tag,Sellable,... 见 Structure.CreateINIValue
      const line =
        `Neutral,${name},256,${x},${y},0,None,0,0,0,0,0,0,,,0,0`;
      sec.SetStringValue(String(i++), line);
    }
  }

  if (objects?.waypoints?.length) {
    const sec: IniSection = mapFile.Waypoint;
    for (const [slot, x, y] of objects.waypoints) {
      if (!isInDiamond(x, y, geom)) continue;
      sec.SetStringValue(String(slot), `${y}${String(x).padStart(3, '0')}`);
    }
  }

  return mapFile;
}

/**
 * 用 grid + 选项写出完整 `.map/.yrm` INI 文本。
 * LocalSize 走 `SaveFullMap` 的默认推导（Width-4 / Height-11+4-bottomSpace）。
 */
export function emitMapIni(
  grid: RmgGrid,
  options: Pick<RmgOptions, 'theater'>,
  objects?: EmitObjects,
  bottomSpace = 0,
): string {
  const mapFile = emitMapFile(grid, rmgTheaterToEnum(options.theater), objects);
  return mapFile.SaveFullMap(undefined, { bottomSpace });
}

// ---------------------------------------------------------------------------
// 反向：MapFile → grid（emit 往返的载入半程）
// ---------------------------------------------------------------------------

/**
 * 把已有地图 INI 读入 `RmgGrid`。
 *
 * 只填充带内格的 tile/subTile/level/overlay/density；
 * 其余字段保持 `defaultRmgCell()`。
 */
export function loadGridFromMapIni(content: string): RmgGrid {
  const mapFile = new MapFile();
  mapFile.CreateIsoTileList(content);
  const overlays = mapFile.ReadOverlay(content) ?? [];

  if (mapFile.Width <= 0 || mapFile.Height <= 0) {
    throw new Error('loadGridFromMapIni: missing or invalid [Map] Size');
  }

  const grid = new RmgGrid({
    width: mapFile.Width,
    height: mapFile.Height,
    diamondMin: mapFile.Width,
    diamondMax: mapFile.Width + 2 * mapFile.Height,
  });

  for (const t of mapFile.IsoTileList) {
    const cell = grid.get(t.Rx, t.Ry);
    if (!cell) continue;
    cell.tile = t.TileNum;
    cell.subTile = t.SubTile;
    cell.level = t.Z & 0xff;
  }

  for (const ov of overlays) {
    if (!ov.Tile) continue;
    const cell = grid.get(ov.Tile.Rx, ov.Tile.Ry);
    if (!cell) continue;
    cell.overlay = ov.OverlayID;
    cell.density = ov.OverlayValue;
  }

  return grid;
}

/** emit 往返便捷入口：ini → grid → ini */
export function emitRoundTrip(content: string, bottomSpace = 0): string {
  const grid = loadGridFromMapIni(content);
  const mapFile = new MapFile();
  // 保留源 Theater
  const src = new MapFile();
  src.CreateIsoTileList(content);
  const iniTheater = pickTheaterFromIni(content);
  mapFile.MapTheater = iniTheater;
  mapFile.Width = grid.width;
  mapFile.Height = grid.height;

  for (const [rx, ry] of grid.nativeCells()) {
    const cell = grid.get(rx, ry);
    if (!cell) continue;
    const tileNum = cell.tile === TILE_UNASSIGNED ? -1 : cell.tile;
    const dx = rx - ry + grid.width - 1;
    const dy = rx + ry - grid.width - 1;
    mapFile.IsoTileList.push(
      new IsoTile(dx, dy, rx, ry, cell.level & 0xff, tileNum, cell.subTile & 0xff),
    );
    if (cell.overlay >= 0) {
      const ov = new Overlay(cell.overlay & 0xff, cell.density & 0xff);
      ov.Tile = mapFile.IsoTileList[mapFile.IsoTileList.length - 1];
      mapFile.OverlayList.push(ov);
    }
  }

  return mapFile.SaveFullMap(undefined, { bottomSpace });
}

function pickTheaterFromIni(content: string): Theater {
  const m = /\[Map\][\s\S]*?Theater\s*=\s*(\w+)/i.exec(content);
  if (!m) return Theater.TEMPERATE;
  const name = m[1].toUpperCase();
  const idx = (Theater as unknown as Record<string, Theater | undefined>)[name];
  return typeof idx === 'number' ? idx : Theater.TEMPERATE;
}
