/**
 * 城区生成（对齐 Ares「Create Urban Areas」）
 *
 * Ares 的做法是打开引擎里原本就存在的 `MapSeedClass::PlaceUrbanStructures` /
 * `PlacePavedRoads` 流程，并把建筑 / 载具 / 步兵名单换成 rmgmd.ini 的
 * `[Urban]` 三段（默认值见下）。它自己并不画街道 —— 街道是游戏引擎按
 * theater 的 Paved Roads 图块铺的。
 *
 * 这里是该语义的自绘版本：
 *   1. 在已生成的地图上挑一块平整、无物件、无水的地面；
 *   2. 沿主轴铺一条直线街道（铺装路图块，取自手工城市块实测的图块号）；
 *   3. 街道两侧按 Ares 默认建筑名单放城区战斗建筑（`CanPlaceStructure` 校验）；
 *   4. 街道上撒 Ares 默认载具 / 平民步兵。
 *
 * 图块号来自 `re/specs/URBAN_AREAS.md` 的实测表（从手工城市单元里反推，
 * 不是按 theater ini 的 tileset 基址推算 —— 仓库里那几份 ini 与 RA2 的实际
 * 图块编号并不同源）。
 */

import { IniFile } from '../io/iniFile';
import { AbstractTileType } from '../tile/abstractTileType';
import { WorkingMap } from '../workingMap';
import { Structure } from '../objects/structure';
import { Unit } from '../objects/unit';
import { Infantry } from '../objects/infantry';

/** Ares 默认 [Urban] Structures（`rmgmd.ini` 未配置时） */
export const ARES_URBAN_STRUCTURES: readonly string[] = [
  'CABUNK01', 'CABUNK02', 'CAARMY01', 'CAARMY02', 'CAARMY03', 'CAARMY04',
  'CACHIG03', 'CANEWY01', 'CANEWY14', 'CANWY09', 'CANWY26', 'CANWY25',
  'CATEXS07',
];

/** Ares 默认 [Urban] Vehicles */
export const ARES_URBAN_VEHICLES: readonly string[] = [
  'TRUCKA', 'TRUCKB', 'COP', 'EUROC', 'SUVW', 'SUVB', 'FTRK', 'AMBU',
];

/** Ares 默认 [Urban] Infantry */
export const ARES_URBAN_INFANTRY: readonly string[] = [
  'CIV1', 'CIV2', 'CIV3', 'CIVA', 'CIVB', 'CIVC',
];

/**
 * 铺装路直线图块（手工城市块实测）。
 *
 * `ew` = 沿常量 Y 走的直段（屏幕坐标里是其中一条斜向），`ns` = 沿常量 X 走的直段。
 * 五个 theater 的编号只有 DESERT 不同。
 */
const ROAD_TILES: Record<string, { ew: number; ns: number }> = {
  NEWURBAN: { ew: 293, ns: 294 },
  TEMPERATE: { ew: 293, ns: 294 },
  SNOW: { ew: 293, ns: 294 },
  TEMPERATE_ISLANDS: { ew: 293, ns: 294 },
  DESERT: { ew: 265, ns: 266 },
};

export interface UrbanAreaOptions {
  /** 要生成的城区数量（Ares 的复选框按地图尺寸随机，这里由调用方给出） */
  areas: number;
  /** minimap.ini 的段名（theater 枚举名，如 `NEWURBAN` / `TEMPERATE` / `SNOW` / `DESERT`） */
  theaterName: string;
  /** 道路图块表用的 theater 目录名（`TEMPERATE_Islands` 这类带下划线的走目录名），缺省同 theaterName */
  roadTheater?: string;
  /** 建筑名单（默认 Ares 默认值，且只保留 rules 里存在的） */
  structures?: readonly string[];
  /** 载具名单 */
  vehicles?: readonly string[];
  /** 步兵名单 */
  infantry?: readonly string[];
  /** minimap.ini 内容，用于识别水面图块 */
  minimapContent?: string | null;
  /** 街道长度区间（格） */
  lengthRange?: [number, number];
  /** 每个城区的建筑数量区间 */
  structuresPerArea?: [number, number];
  /** 每个城区的载具 / 步兵数量区间 */
  vehiclesPerArea?: [number, number];
  infantryPerArea?: [number, number];
  /** 离出生点（waypoint）的最小 Chebyshev 距离，默认 10 */
  waypointSafeRadius?: number;
  /** 确定性随机种子 */
  seed?: number;
}

export interface UrbanAreaStats {
  /** 成功铺出的城区数 */
  areas: number;
  /** 铺出的道路格数 */
  roadCells: number;
  structures: number;
  vehicles: number;
  infantry: number;
  /** 尝试次数（含失败的） */
  attempts: number;
  /** 失败原因计数（调试用） */
  rejections: Record<string, number>;
  /** 落成的城区位置（调试用） */
  locations: { x: number; y: number; dir: 'ew' | 'ns'; len: number }[];
}

/** 判断 minimap.ini 里的颜色是不是水（深蓝） */
function isWaterColor(r: number, g: number, b: number): boolean {
  return b >= 78 && b - r >= 15 && b - g >= 12;
}

/** 解析 minimap.ini 的 [theater] 段，得到「图块号 → 是否水面」的判定器 */
function makeWaterProbe(
  minimapContent: string | null | undefined,
  theaterName: string,
): (tileNum: number) => boolean {
  if (!minimapContent) return () => false;
  const ini = new IniFile(minimapContent);
  const section =
    ini.GetSection(theaterName.toUpperCase()) ?? ini.GetSection('TEMPERATE');
  if (!section) return () => false;
  const cache = new Map<number, boolean>();
  return (tileNum: number): boolean => {
    const cached = cache.get(tileNum);
    if (cached !== undefined) return cached;
    const value = section.GetStringValue(String(tileNum), '');
    const first = value.split('/')[0] ?? '';
    const rgb = first.split(',').map((v) => Number.parseInt(v, 10));
    const water =
      rgb.length >= 3 && rgb.every((v) => Number.isFinite(v))
        ? isWaterColor(rgb[0], rgb[1], rgb[2])
        : false;
    cache.set(tileNum, water);
    return water;
  };
}

/** mulberry32：轻量、可复现的随机数 */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** 取规则/美术里存在、且底座不超过 3x3 的候选建筑 */
function filterStructures(candidates: readonly string[]): string[] {
  const out: string[] = [];
  for (const name of candidates) {
    if (!WorkingMap.Rules.SectionExists(name)) continue;
    const size = WorkingMap.GetStructureSize(name);
    if (size[0] <= 0 || size[1] <= 0 || size[0] > 3 || size[1] > 3) continue;
    out.push(name);
  }
  return out;
}

function filterTypes(candidates: readonly string[]): string[] {
  return candidates.filter((name) => WorkingMap.Rules.SectionExists(name));
}

interface FootprintCell {
  x: number;
  y: number;
}

/**
 * 生成城区。
 *
 * 调用时机：`PlaceMapUnitByAbsMapMatrix()` 之后、`ReadyForMiniMap()` 之前
 * （同 Ares 在 RMG 末尾铺街区的位置），先于污迹，避免污迹压在街道上。
 */
export function generateUrbanAreas(options: UrbanAreaOptions): UrbanAreaStats {
  const stats: UrbanAreaStats = {
    areas: 0,
    roadCells: 0,
    structures: 0,
    vehicles: 0,
    infantry: 0,
    attempts: 0,
    rejections: {},
    locations: [],
  };
  const reject = (reason: string): void => {
    stats.rejections[reason] = (stats.rejections[reason] ?? 0) + 1;
  };

  const tiles = ROAD_TILES[(options.roadTheater ?? options.theaterName).toUpperCase()];
  if (!tiles) {
    console.warn(`[urban] theater "${options.roadTheater ?? options.theaterName}" 没有道路图块表，跳过城区生成`);
    return stats;
  }

  const structures = filterStructures(options.structures ?? ARES_URBAN_STRUCTURES);
  const vehicles = filterTypes(options.vehicles ?? ARES_URBAN_VEHICLES);
  const infantry = filterTypes(options.infantry ?? ARES_URBAN_INFANTRY);
  if (structures.length === 0 && vehicles.length === 0 && infantry.length === 0) {
    console.warn('[urban] 名单在 rulesmd.ini 里一个都不存在，跳过城区生成');
    return stats;
  }

  const rng = makeRng(options.seed ?? Math.floor(Math.random() * 0x7fffffff));
  const isWater = makeWaterProbe(options.minimapContent, options.theaterName);
  const [lenMin, lenMax] = options.lengthRange ?? [6, 10];
  const [stMin, stMax] = options.structuresPerArea ?? [2, 5];
  const [vhMin, vhMax] = options.vehiclesPerArea ?? [1, 2];
  const [inMin, inMax] = options.infantryPerArea ?? [1, 3];
  const safeRadius = options.waypointSafeRadius ?? 10;

  const width = WorkingMap.Width;
  const height = WorkingMap.Height;

  const waypoints = WorkingMap.WaypointList.map((wp) => [wp.X, wp.Y] as const);

  const nearWaypoint = (x: number, y: number): boolean =>
    waypoints.some(([wx, wy]) => Math.max(Math.abs(x - wx), Math.abs(y - wy)) <= safeRadius);

  /** 单格不可用的原因（null = 可用；装饰物由 clearDecor 清掉） */
  const cellProblem = (x: number, y: number, z: number): string | null => {
    if (!WorkingMap.IsValidAT(x, y)) return 'invalid';
    if (!WorkingMap.IsOnMapAT(x, y)) return 'offmap';
    const t = WorkingMap.AbsTile[x][y];
    if (t === undefined) return 'invalid';
    if (t.TileNum < 0) return 'notile';
    if (t.Z !== z) return 'z';
    if (
      t.HasStructure || t.HasUnit || t.HasAircraft || t.HasInfantry ||
      t.HasBridge || t.HasNeuralTechStructure
    ) {
      return 'occupied';
    }
    if (isWater(t.TileNum)) return 'water';
    return null;
  };

  const cellUsable = (x: number, y: number, z: number): boolean =>
    cellProblem(x, y, z) === null;

  /** 清掉格位上的树/覆盖物/污迹（街道会压过去，Ares 同样是覆盖式铺路） */
  const clearDecor = (x: number, y: number): void => {
    const t = WorkingMap.AbsTile[x][y];
    if (t === undefined) return;
    if (t.HasTerrain) {
      WorkingMap.TerrainList = WorkingMap.TerrainList.filter(
        (terrain) => !(terrain.X === x && terrain.Y === y),
      );
      t.HasTerrain = false;
      t.TerrainName = '';
    }
    if (t.HasOverlay) {
      WorkingMap.OverlayList = WorkingMap.OverlayList.filter(
        (ov) => !(ov.Tile !== null && ov.Tile.Rx === x && ov.Tile.Ry === y),
      );
      t.HasOverlay = false;
      t.OverlayID = 0;
      t.OverlayValue = 0;
    }
    if (t.HasSmudge) {
      WorkingMap.SmudgeList = WorkingMap.SmudgeList.filter(
        (smudge) => !(smudge.X === x && smudge.Y === y),
      );
      t.HasSmudge = false;
    }
  };

  /**
   * 在等距菱形范围内取一个「本体在地图上」的格子。
   *
   * 条件来自 `AbstractTile.Initialize`：
   * `x - S0 < y < x + S0` 且 `S0 - x < y < 2*S1 + S0 + 1 - x`。
   */
  const sampleOnMapCell = (): [number, number] | null => {
    const s0 = WorkingMap.Size[0];
    const s1 = WorkingMap.Size[1];
    const range = width + height;
    for (let attempt = 0; attempt < 24; attempt++) {
      const x = randInt(rng, 1, range - 2);
      const yMin = Math.max(x - s0 + 1, s0 - x + 1);
      const yMax = Math.min(x + s0 - 1, 2 * s1 + s0 - x - 1);
      if (yMax < yMin) continue;
      const y = randInt(rng, yMin, yMax);
      if (WorkingMap.IsOnMapAT(x, y)) return [x, y];
    }
    return null;
  };

  const maxAttempts = Math.max(20, options.areas * 60);
  while (stats.areas < options.areas && stats.attempts < maxAttempts) {
    stats.attempts++;
    const dir: 'ew' | 'ns' = rng() < 0.5 ? 'ew' : 'ns';
    const len = randInt(rng, lenMin, lenMax);
    const center = sampleOnMapCell();
    if (center === null) { reject('offmap'); continue; }
    const [ctx, cty] = center;
    const x0 = dir === 'ew' ? ctx - Math.floor(len / 2) : ctx;
    const y0 = dir === 'ew' ? cty : cty - Math.floor(len / 2);
    if (x0 < 1 || y0 < 1 || x0 + len >= width || y0 + len >= height) {
      reject('bounds');
      continue;
    }

    // --- 校验地面：街道格同高、无水；装饰物清掉，建筑/单位阻挡则放弃 ---
    const z = WorkingMap.AbsTile[x0][y0].Z;

    const run: FootprintCell[] = [];
    if (dir === 'ew') {
      for (let x = x0; x < x0 + len; x++) run.push({ x, y: y0 });
    } else {
      for (let y = y0; y < y0 + len; y++) run.push({ x: x0, y });
    }

    let ok = true;
    for (const c of run) {
      const problem = cellProblem(c.x, c.y, z);
      if (problem) { reject(problem); ok = false; break; }
      if (nearWaypoint(c.x, c.y)) { reject('waypoint'); ok = false; break; }
    }
    if (!ok) continue;

    // --- 铺街道 ---
    const roadTile = dir === 'ew' ? tiles.ew : tiles.ns;
    for (const c of run) {
      clearDecor(c.x, c.y);
      const tpl = new AbstractTileType();
      tpl.TileNum = roadTile;
      tpl.SubTile = 0;
      tpl.Z = z;
      WorkingMap.AbsTile[c.x][c.y].SetProperty(c.x, c.y, 0, tpl);
    }
    stats.roadCells += run.length;

    // --- 放建筑：街道两侧，逐栋 CanPlaceStructure ---
    const structureCount = structures.length > 0 ? randInt(rng, stMin, stMax) : 0;
    let placed = 0;
    for (let i = 0; i < structureCount; i++) {
      const name = structures[randInt(rng, 0, structures.length - 1)];
      const size = WorkingMap.GetStructureSize(name);
      const [sw, sh] = size;
      const preferredSide = rng() < 0.5 ? 0 : 1;
      const sides = preferredSide === 0 ? [0, 1] : [1, 0];
      for (const side of sides) {
        for (let attempt = 0; attempt < 12 && placed <= i; attempt++) {
          const cx = randInt(rng, x0 - 1, x0 + len - sw + 1);
          const cy = randInt(rng, y0 - 1, y0 + len - sh + 1);
          let bx: number;
          let by: number;
          if (dir === 'ew') {
            by = side === 0 ? y0 - sh : y0 + 1;
            bx = cx;
          } else {
            bx = side === 0 ? x0 - sw : x0 + 1;
            by = cy;
          }
          if (bx < 1 || by < 1 || bx + sw >= width || by + sh >= height) continue;

          let fits = WorkingMap.CanPlaceStructure(bx, by, name);
          for (let dx = 0; dx < sw && fits; dx++) {
            for (let dy = 0; dy < sh && fits; dy++) {
              if (!cellUsable(bx + dx, by + dy, z)) fits = false;
            }
          }
          if (!fits) continue;

          const st = new Structure();
          st.Owner = 'Neutral';
          st.Name = name;
          st.Strength = 256;
          st.X = bx;
          st.Y = by;
          st.RelativeX = bx;
          st.RelativeY = by;
          st.Direction = 64;
          st.Tag = 'None';
          st.Sellable = 0;
          st.Rebuild = 0;
          st.EnergySupport = 1;
          st.UpgradeCount = 0;
          st.SpotLight = 0;
          st.Upgrade1 = 'None';
          st.Upgrade2 = 'None';
          st.Upgrade3 = 'None';
          st.AIRepairs = 1;
          st.ShowName = 0;
          WorkingMap.StructureList.push(st);
          for (let dx = 0; dx < sw; dx++) {
            for (let dy = 0; dy < sh; dy++) {
              WorkingMap.AbsTile[bx + dx][by + dy].HasStructure = true;
            }
          }
          stats.structures++;
          placed++;
          break;
        }
      }
    }

    // --- 街道上撒载具 ---
    if (vehicles.length > 0) {
      const count = randInt(rng, vhMin, vhMax);
      for (let i = 0; i < count; i++) {
        const c = run[randInt(rng, 0, run.length - 1)];
        if (!WorkingMap.CanPlaceUnit(c.x, c.y)) continue;
        const u = new Unit();
        u.Owner = 'Neutral';
        u.Name = vehicles[randInt(rng, 0, vehicles.length - 1)];
        u.Strength = 256;
        u.X = c.x;
        u.Y = c.y;
        u.RelativeX = c.x;
        u.RelativeY = c.y;
        u.Direction = randInt(rng, 0, 7) * 32;
        u.State = 'Guard';
        u.Tag = 'None';
        u.Veteran = 0;
        u.Group = -1;
        u.OnBridge = 0;
        u.FollowerID = -1;
        u.AutocreateNoRecruitable = 1;
        u.AutocreateYesRecruitable = 0;
        WorkingMap.UnitList.push(u);
        WorkingMap.AbsTile[c.x][c.y].HasUnit = true;
        stats.vehicles++;
      }
    }

    // --- 街道上撒步兵 ---
    if (infantry.length > 0) {
      const count = randInt(rng, inMin, inMax);
      for (let i = 0; i < count; i++) {
        const c = run[randInt(rng, 0, run.length - 1)];
        if (!WorkingMap.CanPlaceInfantry(c.x, c.y)) continue;
        if (WorkingMap.AbsTile[c.x][c.y].InfantryCount >= 2) continue;
        const inf = new Infantry();
        inf.Owner = 'Neutral';
        inf.Name = infantry[randInt(rng, 0, infantry.length - 1)];
        inf.Strength = 256;
        inf.X = c.x;
        inf.Y = c.y;
        inf.RelativeX = c.x;
        inf.RelativeY = c.y;
        inf.Unknown = 1;
        inf.State = 'Guard';
        inf.Direction = 64;
        inf.Tag = 'None';
        inf.Veteran = 0;
        inf.Group = -1;
        inf.OnBridge = 0;
        inf.AutocreateNoRecruitable = 1;
        inf.AutocreateYesRecruitable = 0;
        WorkingMap.InfantryList.push(inf);
        WorkingMap.AbsTile[c.x][c.y].HasInfantry = true;
        WorkingMap.AbsTile[c.x][c.y].InfantryCount++;
        stats.infantry++;
      }
    }

    stats.areas++;
    stats.locations.push({ x: x0, y: y0, dir, len });
  }

  return stats;
}
