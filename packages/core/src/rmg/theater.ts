/**
 * Theater tileset 基址表 —— 从 `<THEATER>MD.INI` 计算原生运行时全局
 *
 * 原生机制（`Read_Theater_TileSets_INI @ 0x00545150`，逆向 + temperatmd.ini 实证）：
 *   1. 读 `[General]` 的 WaterSet / ShorePieces / GreenTile / ClearTile / RampBase …
 *      —— 这些值是 **tileset 序号**，不是 tile 序号；
 *   2. 从 TileSet0000 起逐节累加 `TilesInSet`（缺节即停），得到每个 tileset 的
 *      首 tile 基址；若某节带 `LastTilesInSet` 且 ≠ TilesInSet，则按 `LastTilesInSet`
 *      推进累加器（旧地图兼容路径；温带 theater 不用）；
 *   3. 基址写入全局：
 *        g_WaterSet_TileSetBase = 0x00AA0738   g_ShorePiecesBase = 0x00ABAD28
 *        g_GreenTile            = 0x00AA0E18   g_ClearTile       = 0x00AA10B0
 *        g_RampBase             = 0x00ABC1D8   g_RoughTile       = 0x00ABC2B8
 *        g_SandTile             = 0x00ABB104   g_PaveTile        = 0x00ABC2B0
 *        g_WaterfallEast        = 0x00AA073C   g_WaterfallWest   = 0x00ABB110
 *        g_WaterfallNorth       = 0x00AA10A0   g_WaterfallSouth  = 0x00AA1050
 *        g_ClearToGreenLAT      = 0x00AA0748   g_Rocks           = 0x00ABB10C
 *        g_WaterCliffs          = 0x00ABB10C?? —— 注意 Rocks 与 WaterCliffs 是两个键
 *
 *   水族测试（`0x004865D0`）的范围常数就是这些 tileset 的 TilesInSet：
 *     [ShorePieces, +42) / [WaterSet, +14) / [WaterfallEast|West|North|South, +4)
 *   绿族（`0x004867B0`）：[ClearToGreenLAT, +16)。
 *
 * 温带实证（temperatmd.ini，82 个 TileSet，838 tiles）：
 *   WaterSet base = 314（14）、ShorePieces = 89（42）、GreenTile = 493、
 *   ClearToGreenLAT = 494（16）、RampBase tileset 9 → base 29。
 */

import { IniFile } from '../io/iniFile';

/** 一个 tileset 的最小元数据（RMG 阶段会用到） */
export interface TileSetInfo {
  /** 该 tileset 首 tile 的全局索引（前面所有 tileset 的 TilesInSet 累加） */
  base: number;
  /** TilesInSet */
  tilesInSet: number;
  setname: string;
  /** RequiredForRMG 标志（`+739`），温带全缺省 0 */
  requiredForRmg: boolean;
}

/** RMG 阶段消费的 theater 基址族（全部为 tile 全局索引） */
export interface TheaterTables {
  theater: string;
  /** TileSet%04d → 元数据，按序号连续 */
  tileSets: TileSetInfo[];
  /** 全 theater tile 总数 */
  totalTiles: number;

  clearTile: number;
  roughTile: number;
  sandTile: number;
  greenTile: number;
  paveTile: number;
  rampBase: number;
  rampSmooth: number;
  cliffSet: number;
  shorePieces: number;
  waterSet: number;
  waterCliffs: number;
  waterCaves: number;
  waterBridge: number;
  cliffRamps: number;
  rocks: number;
  clearToRoughLat: number;
  clearToSandLat: number;
  clearToGreenLat: number;
  clearToPaveLat: number;
  waterfallEast: number;
  waterfallWest: number;
  waterfallNorth: number;
  waterfallSouth: number;
  bridges: number;
  woodBridges: number;
  pavedRoads: number;
  pavedRoadEnds: number;
  /** DestroyableCliffs（缺省 **-2**，不是 -1） */
  destroyableCliffs: number;
  slopeSetPieces: number;
  miscPaveTile: number;
  medians: number;
}

/**
 * General 键 → 输出字段名（与原生写入的全局一一对应，见文件头）。
 * 键名大小写不敏感（IniFile 已处理），这里统一小写。
 */
const GENERAL_KEYS: ReadonlyArray<readonly [string, keyof TheaterTables]> = [
  ['cleartile', 'clearTile'],
  ['roughtile', 'roughTile'],
  ['sandtile', 'sandTile'],
  ['greentile', 'greenTile'],
  ['pavetile', 'paveTile'],
  ['rampbase', 'rampBase'],
  ['rampsmooth', 'rampSmooth'],
  ['cliffset', 'cliffSet'],
  ['shorepieces', 'shorePieces'],
  ['waterset', 'waterSet'],
  ['watercliffs', 'waterCliffs'],
  ['watercaves', 'waterCaves'],
  ['waterbridge', 'waterBridge'],
  ['clifframps', 'cliffRamps'],
  ['rocks', 'rocks'],
  ['cleartoroughlat', 'clearToRoughLat'],
  ['cleartosandlat', 'clearToSandLat'],
  ['cleartogreenlat', 'clearToGreenLat'],
  ['cleartopavelat', 'clearToPaveLat'],
  ['waterfalleast', 'waterfallEast'],
  ['waterfallwest', 'waterfallWest'],
  ['waterfallnorth', 'waterfallNorth'],
  ['waterfallsouth', 'waterfallSouth'],
  ['bridgeset', 'bridges'],
  ['woodbridgeset', 'woodBridges'],
  ['pavedroads', 'pavedRoads'],
  ['pavedroadends', 'pavedRoadEnds'],
  ['destroyablecliffs', 'destroyableCliffs'],
  ['slopesetpieces', 'slopeSetPieces'],
  ['miscpavetile', 'miscPaveTile'],
  ['medians', 'medians'],
];

/**
 * 解析 theater INI 文本 → 基址表。
 *
 * 遍历规则与原生一致：从 TileSet0000 连续向上，**遇到缺失/无 TilesInSet 的
 * 节即停**；`LastTilesInSet` 存在且 ≠ TilesInSet 时累加器按 LastTilesInSet 推进。
 */
export function parseTheaterIni(text: string, theater: string): TheaterTables {
  const ini = new IniFile(text);
  const general = ini.GetSection('General');

  const getInt = (key: string, def: number): number => {
    if (general === null) return def;
    const raw = general.GetStringValue(key, '');
    if (raw === '') return def;
    const v = parseInt(raw, 10);
    return Number.isNaN(v) ? def : v;
  };

  const tileSets: TileSetInfo[] = [];
  let base = 0;
  for (let i = 0; ; i++) {
    const section = ini.GetSection(`TileSet${String(i).padStart(4, '0')}`);
    if (section === null) break;
    const tilesRaw = section.GetStringValue('TilesInSet', '');
    if (tilesRaw === '') break;
    const tilesInSet = parseInt(tilesInSetRaw(tilesRaw), 10);
    if (Number.isNaN(tilesInSet)) break;
    const lastRaw = section.GetStringValue('LastTilesInSet', '');
    let advance = tilesInSet;
    if (lastRaw !== '') {
      const last = parseInt(lastRaw, 10);
      if (!Number.isNaN(last) && last !== tilesInSet) advance = last;
    }
    tileSets.push({
      base,
      tilesInSet,
      setname: section.GetStringValue('SetName', 'NoName'),
      requiredForRmg: section.GetStringValue('RequiredForRMG', '0') === '1',
    });
    base += advance;
  }

  const tileSetBase = (tileSetNo: number): number => {
    const ts = tileSets[tileSetNo];
    if (ts === undefined) {
      throw new Error(
        `theater ${theater}: [General] 引用的 tileset ${tileSetNo} 不存在（共 ${tileSets.length} 个）`,
      );
    }
    return ts.base;
  };

  const tables: Pick<
    TheaterTables,
    | 'clearTile' | 'roughTile' | 'sandTile' | 'greenTile' | 'paveTile'
    | 'rampBase' | 'rampSmooth' | 'cliffSet' | 'shorePieces' | 'waterSet'
    | 'waterCliffs' | 'waterCaves' | 'waterBridge' | 'cliffRamps' | 'rocks'
    | 'clearToRoughLat' | 'clearToSandLat' | 'clearToGreenLat'
    | 'clearToPaveLat' | 'waterfallEast' | 'waterfallWest'
    | 'waterfallNorth' | 'waterfallSouth' | 'bridges' | 'woodBridges'
    | 'pavedRoads' | 'pavedRoadEnds' | 'destroyableCliffs'
    | 'slopeSetPieces' | 'miscPaveTile' | 'medians'
  > = Object.create(null);

  for (const [key, field] of GENERAL_KEYS) {
    // DestroyableCliffs 的原生缺省是 -2，其余都是 -1
    const def = key === 'destroyablecliffs' ? -2 : -1;
    const tileSetNo = getInt(key, def);
    (tables as Record<string, number>)[field] =
      tileSetNo < 0 ? tileSetNo : tileSetBase(tileSetNo);
  }

  return {
    theater,
    tileSets,
    totalTiles: base,
    ...tables,
  };
}

function tilesInSetRaw(raw: string): string {
  return raw.trim();
}
