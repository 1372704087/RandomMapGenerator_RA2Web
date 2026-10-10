/**
 * emit 集成 —— RMG 管线状态 → 可玩 `.map` INI 文本
 *
 * 坐标关系（已验证）：RMG 菱形坐标 (xd,yd) ≡ IsoMapPack (rx,ry)；
 *   iso (dx,dy) = (xd−yd+W−1, xd+yd−W−1)；地图 tile 坐标 (mx,my) = toMap(xd,yd)，
 *   其中 [Terrain]/[Waypoints]/[Structures] 使用 (mx,my) 的 `Y+XXX` 键格式。
 *
 * 覆盖：
 *   - 全 IsoMapPack 格（(2W−1)·H；原生分配缺最后一奇数行 → 以 unassigned(-1) 补齐）；
 *   - Overlay（矿/宝石/岩石）+ 密度；
 *   - [Terrain]（树/TIBTRE）、[Structures]（科技建筑，Neutral）、
 *     [Waypoints]（0..players−1 起点 + 700 中心）。
 */

import MapFile from '../fileio';
import { Overlay } from '../tile/overlay';
import { IsoTile } from '../tile/isoTile';
import { IniFile } from '../io/iniFile';
import { rmgTheaterToEnum } from './emit';
import { createEmptyMapCells } from './cell';
import { coordOfCell, WaterContext } from './water';
import { TechStructure } from './tech';

const THEATER_NAMES = ['TEMPERATE', 'SNOW', 'URBAN', 'DESERT', 'NEWURBAN'];

export interface RmgEmitInput {
  /** 玩家数（[Basic] MaxPlayer） */
  numPlayers: number;
  /** 地图名 */
  name?: string;
}

/** 中心 waypoint 槽位（map-prep 写 700，699 同点） */
const CENTER_WAYPOINT_SLOT = 700;

function pad3(v: number): string {
  return String(v).padStart(3, '0');
}

/**
 * 把 RMG 状态写出为完整 `.map` INI。
 * 返回 INI 文本；调用方负责落盘/预览。
 */
export function emitRmgMapFile(
  ctx: WaterContext,
  waypoints: ReadonlyArray<[number, number] | null>,
  structures: ReadonlyArray<TechStructure>,
): MapFile {
  const W = ctx.cells.mapW;
  const H = ctx.cells.mapH;
  const mapFile = new MapFile();
  mapFile.Width = W;
  mapFile.Height = H;
  mapFile.MapTheater = rmgTheaterToEnum(ctx.theaterIndex);
  mapFile.IsoTileList = [];
  mapFile.OverlayList = [];

  // 全 IsoMapPack 格覆盖（(2W−1)·H）；用 Map 查询原生格，缺格补 -1
  const cellAt = new Map<string, import('./native').NativeCell>();
  for (const cell of ctx.cells.iterate()) {
    const [xd, yd] = coordOfCell(ctx, cell);
    cellAt.set(`${xd},${yd}`, cell);
  }
  const offsetX = 1; // playfield (mx,my)=(0,0) → (rx,ry)=(1,W)
  // 🔴 **必须用 `createEmptyMapCells` 的权威单循环枚举，不能用 `dy < 2*H` 的双重循环。**
  //
  // 双重循环（`dy < 2*H` × `dx < 2*W−1`）会枚举 **46368** 个候选，
  // 但 `(rx,ry) = ((dx+dy)/2+1, dy−rx+W+1)` 是**多对一**映射 ——
  // 相邻的 `(dx,dy)` 与 `(dx+1,dy−1)` 落在**同一个格**上：
  // ```
  // 双循环枚举 = 46368  ⇒ 去重后 = 23184（正好 2 倍），重复 = 11536
  // ```
  // 实测后果（MapType=1 / RandMap.Sed，与真机同参数）：
  // ```
  // 真机 IsoMapPack5：23184 条，(dx,dy) 重复 = 0
  // 我们          ：23184 条，(dx,dy) 重复 = 7700  ← ★ 只有 15484 个唯一格
  // ```
  // 因为 `IsoTileList` 每条都 push 一个 `IsoTile`，重复格会被写两遍，
  // 读者按顺序取用时会看到**错位的 tile**（水格被后面的 clear 覆盖）。
  //
  // 权威枚举见 `cell.ts:291 createEmptyMapCells`：`(2W−1)·H` 个格，
  // `dy = y*2 + (x%2)` 保证每格只出现一次。
  for (const [rx, ry, dx, dy] of createEmptyMapCells(W, H)) {
    if (rx < offsetX) continue;
      const cell = cellAt.get(`${rx},${ry}`);
      // ⚠ **跳过未分配的格**（对齐真机基线 `Random Map.yrm` 的实测行为）。
      // 原版 IsoMapPack5 是稀疏的：未触的格**不出现**，
      // 实测基线 29161 个 tile 里 `TileIndex < 0` 的个数为 **0**
      // （`TileIndex == 0` 有 5783 个，那是合法的 clear tile，不是哨兵）。
      // 此前无条件 push 且把 0xffff 映射成 −1，导致输出里混入 760 个
      // `TileIndex = 0xFFFF` —— 游戏读回时会当无效 tile 处理。
      if (!cell || cell.tile === 0xffff) continue;
      const level = cell.level & 0xff;
      const subTile = cell.subTile & 0xff;
      mapFile.IsoTileList.push(new IsoTile(dx, dy, rx, ry, level, cell.tile, subTile));
      if (cell.overlay >= 0) {
        const ov = new Overlay(cell.overlay & 0xff, cell.density & 0xff);
        ov.Tile = mapFile.IsoTileList[mapFile.IsoTileList.length - 1];
        mapFile.OverlayList.push(ov);
      }
  }

  // [Terrain]（树/TIBTRE，map 坐标）
  for (const o of ctx.terrainObjects) {
    const [mx, my] = ctx.cells.toMap(o.xd, o.yd);
    if (mx < 0 || my < 0) continue;
    mapFile.Terrain.SetStringValue(`${my}${pad3(mx)}`, o.name);
  }

  // [Structures]（科技建筑，Neutral）
  let si = 0;
  for (const s of structures) {
    const [mx, my] = ctx.cells.toMap(s.xd, s.yd);
    if (mx < 0 || my < 0) continue;
    mapFile.Structure.SetStringValue(
      String(si++),
      `Neutral,${s.name},256,${mx},${my},0,None,0,0,0,0,0,0,,,0,0`,
    );
  }

  // [Waypoints]（玩家起点 + 中心 700）
  for (let slot = 0; slot < waypoints.length; slot++) {
    const w = waypoints[slot];
    if (!w) continue;
    const [mx, my] = ctx.cells.toMap(w[0], w[1]);
    mapFile.Waypoint.SetStringValue(String(slot), `${my}${pad3(mx)}`);
  }
  {
    const [mx, my] = ctx.cells.toMap(...centerDiamond(W, H));
    mapFile.Waypoint.SetStringValue(String(CENTER_WAYPOINT_SLOT), `${my}${pad3(mx)}`);
  }

  // MapFile 无通用键写 API —— SaveFullMap 的模板机制走 IniFile；
  // [Basic]/[Map]/[Lighting] 通过占位模板合并：先用 IniFile 建段，
  // SaveFullMap(template) 会以其为基础续写（见 fileio.ts SaveFullMap）。
  void THEATER_NAMES;
  return mapFile;
}

/** emitRmgMapFile + 元数据 → 完整 .map INI 文本 */
export function emitRmgMapIni(
  ctx: WaterContext,
  waypoints: ReadonlyArray<[number, number] | null>,
  structures: ReadonlyArray<TechStructure>,
  input: RmgEmitInput,
): string {
  const mapFile = emitRmgMapFile(ctx, waypoints, structures);
  const ini = mapFile.SaveFullMap(undefined, { bottomSpace: 0 });
  const meta = new IniFile(ini);
  // ⚠ [Header] Width/Height 由 `CalculateStartingWaypoints` 从 [Map] LocalSize 推导
  //   （Width = localWidth − 1、Height = localHeight），不调它就会留 0。
  //   该口径已与真机基线 `Random Map.yrm` 实测一致：
  //   Header.Width=116 vs LocalSize 宽=117（差 1，菱形带 x 上界）、
  //   Header.Height=107 = LocalSize 高。
  //   顺带由它把 Waypoint1..8 与玩家数元数据写好。
  const withWaypoints = mapFile.CalculateStartingWaypoints(meta.WriteIniFile());
  const out = new IniFile(withWaypoints);
  out.SetStringValue('Header', 'NumberStartingPoints', String(input.numPlayers));
  out.SetStringValue('Basic', 'Name', input.name ?? 'Random Map');
  out.SetStringValue('Basic', 'MaxPlayer', String(input.numPlayers));
  out.SetStringValue('Basic', 'MinPlayer', '1');
  out.SetStringValue('Map', 'Level', '4');
  out.SetStringValue('Lighting', 'Ambient', '0.75');
  out.SetStringValue('Lighting', 'RedTint', '1.0');
  out.SetStringValue('Lighting', 'GreenTint', '1.0');
  meta.SetStringValue('Lighting', 'BlueTint', '1.0');
  meta.SetStringValue('Lighting', 'Ground', '0.0');
  out.SetStringValue('Lighting', 'IonAmbient', '0.75');
  out.SetStringValue('Lighting', 'IonRed', '0.3');
  out.SetStringValue('Lighting', 'IonGreen', '0.4');
  out.SetStringValue('Lighting', 'IonBlue', '0.75');
  out.SetStringValue('Lighting', 'IonGround', '0.0');
  out.SetStringValue('Lighting', 'IonLevel', '0.0');
  return out.WriteIniFile();
}

/** map 中心（mx=W/2, my=H/2）的菱形坐标 */
function centerDiamond(w: number, h: number): [number, number] {
  const mx = Math.floor(w / 2);
  const my = Math.floor(h / 2);
  return [mx + my + 1, w - mx + my];
}
