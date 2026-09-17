/**
 * 地图拆解器（Map Splitter）
 *
 * 把一张**完整地图**按 `MapUnitWidth × MapUnitHeight` 的网格切割成若干张
 * "地图单元" 切片（slice）。每张切片都是可独立复用、能被生成器选中并拼接的
 * `.map` 单元文件，从而大幅扩充地图单元模板库。
 *
 * 核心思路：
 *   1. 网格切割：把整张地图的图块按绝对 (Rx, Ry) 坐标划分到 `gx × gy` 个单元块；
 *   2. 边签名：对每个单元块的 4 条边（东南/西北 纵向缝、东北/西南 横向缝）
 *      计算特征签名并哈希为 0..MapUnitWidth-1 的"连接 ID"；
 *   3. 写指示图块：在切片地图的外围按连接 ID 摆放指示图块，与
 *      AbstractMapUnit.Initialize 的检测约定逐字节一致，保证生成器能正确读回；
 *   4. 平移对象：把属于该块的单位/建筑/地形等对象坐标改写到切片本地坐标。
 *
 * 连接一致性保证：相邻切片共享同一条缝，因此两边朝向该缝的连接 ID 相同，
 * 重拼时生成器的连接校验（NW↔SE、NE↔SW 等）会自动通过。
 *
 * 本模块为纯函数、不依赖 Node fs，可在浏览器与 Node 两端的 core 包内复用。
 */

import { MapFile } from './fileio';
import { IniFile } from './io/iniFile';
import { Overlay } from './tile/overlay';
import { Theater } from './tile/enums';
import { IsoTile } from './tile/isoTile';

/** 拆解配置 */
export interface MapSplitConfig {
  /** 地图单元宽（图块数），通常来自 settings.ini 的 MapUnitSize */
  mapUnitWidth: number;
  /** 地图单元高（图块数） */
  mapUnitHeight: number;
  /** 顶角坐标 X，通常来自 settings.ini 的 TopCorner 第一个值 */
  startingX: number;
  /** 顶角坐标 Y，TopCorner 第二个值 */
  startingY: number;
  /** 剧场（决定切片文件里的 Theater 字段） */
  theater: Theater;
  /** 指示图块编号，来自 indicator.map 的 IsoTileList[0].TileNum */
  indicatorNum: number;
}

/** 单张切片结果 */
export interface MapSplitSlice {
  /** 切片文件名（不含 .map 后缀） */
  name: string;
  /** 网格横坐标（单元列） */
  gridX: number;
  /** 网格纵坐标（单元行） */
  gridY: number;
  /** 切片 .map 文件内容（INI 文本） */
  content: string;
}

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------

/** FNV-1a 32 位哈希（确定性、稳定）。 */
function hashFnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * 计算一条"缝"的连接 ID。
 *
 * 把一条边上的图块（TileNum + SubTile，并叠加覆盖物的 OverlayID）拼接成签名，
 * 哈希后取模到 [0, mapUnitWidth)。两条边只要签名一致就映射到同一 ID，
 * 从而在生成器里被判定为"可互相拼接"。
 */
function seamId(signature: string, mod: number): number {
  return hashFnv1a(signature) % mod;
}

/**
 * 判断某个 (rx, ry) 单元是否落在边长为 s 的菱形地图内。
 * 与 CreateIsoTileList / CreateEmptyMap 的坐标换算保持一致。
 */
function cellValidInDiamond(rx: number, ry: number, s: number): boolean {
  const dx = rx - ry + s - 1;
  const dy = rx + ry - s - 1;
  return dx >= 0 && dx < 2 * s && dy >= 0 && dy < 2 * s;
}

// ---------------------------------------------------------------------------
// 主函数：拆解整张地图
// ---------------------------------------------------------------------------

/** 拆解选项 */
export interface MapSplitOptions {
  /**
   * 是否跳过"内部完全没有实际地形"的空块（即整块图块都是空 -1）。
   * 这类块通常出现在完整地图菱形边角之外，没有保留价值。
   * 默认 true。
   */
  skipEmpty?: boolean;
}

/**
 * 将一张完整的 `.map` 文本按网格拆解成若干切片。
 *
 * @param sourceIni 完整地图的 INI 文本内容
 * @param config    拆解配置（单元尺寸、顶角、指示图块等）
 * @param options   可选项
 * @returns 切片列表（每个含文件内容与网格坐标）
 */
export function splitMap(
  sourceIni: string,
  config: MapSplitConfig,
  options?: MapSplitOptions,
): MapSplitSlice[] {
  const { mapUnitWidth: W, mapUnitHeight: H, startingX: SX, startingY: SY } =
    config;
  const skipEmpty = options?.skipEmpty ?? true;

  // 1. 读取源地图的等距图块（绝对坐标）
  const sourceMap = new MapFile();
  sourceMap.CreateIsoTileList(sourceIni);
  if (sourceMap.IsoTileList.length === 0) {
    throw new Error('源地图没有可拆解的图块（IsoTileList 为空）。');
  }

  // 以绝对 (rx,ry) 索引源图块，便于快速查找
  const tileByRxRy = new Map<string, IsoTile>();
  let minRx = Infinity,
    maxRx = -Infinity;
  let minRy = Infinity,
    maxRy = -Infinity;
  for (const t of sourceMap.IsoTileList) {
    tileByRxRy.set(`${t.Rx},${t.Ry}`, t);
    if (t.Rx < minRx) minRx = t.Rx;
    if (t.Rx > maxRx) maxRx = t.Rx;
    if (t.Ry < minRy) minRy = t.Ry;
    if (t.Ry > maxRy) maxRy = t.Ry;
  }

  // 源地图原点（统一到单元尺寸的倍数，让单元块与整图坐标对齐）
  const OX = Math.floor(minRx / W) * W;
  const OY = Math.floor(minRy / H) * H;
  const gx = Math.floor((maxRx - OX) / W) + 1;
  const gy = Math.floor((maxRy - OY) / H) + 1;

  // 读取源地图覆盖物（绝对坐标）
  const sourceOverlays = sourceMap.ReadOverlay(sourceIni) ?? [];
  const overlayByIdx = new Map<string, Overlay>();
  for (const ov of sourceOverlays) {
    if (ov.Tile !== null) {
      overlayByIdx.set(`${ov.Tile.Rx},${ov.Tile.Ry}`, ov);
    }
  }

  // 2. 计算每条"缝"的连接 ID
  //    seamV[c][r]：纵向缝（单元列边界 c，单元行 r），采样绝对列 X = OX + c*W
  //    seamH[r][c]：横向缝（单元行边界 r，单元列 c），采样绝对行 Y = OY + r*H
  const seamV: number[][] = [];
  const seamH: number[][] = [];

  const lineSig = (
    rx: number,
    ry: number,
    count: number,
    dx: number,
    dy: number,
  ): string => {
    let sig = '';
    for (let k = 0; k < count; k++) {
      const tx = rx + dx * k;
      const ty = ry + dy * k;
      const t = tileByRxRy.get(`${tx},${ty}`);
      const ov = overlayByIdx.get(`${tx},${ty}`);
      if (t) {
        sig += `${t.TileNum}:${t.SubTile}:${t.Z}|`;
      } else {
        sig += `_|`;
      }
      if (ov && ov.Tile) {
        sig += `O${ov.OverlayID}@${ov.OverlayValue}|`;
      } else {
        sig += 'O|';
      }
    }
    return sig;
  };

  // 纵向缝采样：绝对列 X = OX + cW，Y 从 OY+rH 起、步长 1，共 H 行
  for (let c = 0; c <= gx; c++) {
    seamV[c] = [];
    for (let r = 0; r < gy; r++) {
      seamV[c][r] = seamId(
        lineSig(OX + c * W, OY + r * H, H, 0, 1),
        W,
      );
    }
  }
  // 横向缝采样：绝对行 Y = OY + rH，X 从 OX+cW 起、步长 1，共 W 列
  for (let r = 0; r <= gy; r++) {
    seamH[r] = [];
    for (let c = 0; c < gx; c++) {
      seamH[r][c] = seamId(
        lineSig(OX + c * W, OY + r * H, W, 1, 0),
        W,
      );
    }
  }

  /** 该块内容区是否含非空图块（缺格或 TileNum=-1 视为空）。 */
  const blockHasTerrain = (i: number, j: number): boolean => {
    const blockRX0 = OX + i * W;
    const blockRY0 = OY + j * H;
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        const tile = tileByRxRy.get(`${blockRX0 + x},${blockRY0 + y}`);
        if (tile && tile.TileNum !== -1) return true;
      }
    }
    return false;
  };

  // 3. 逐块生成切片
  const slices: MapSplitSlice[] = [];
  for (let i = 0; i < gx; i++) {
    for (let j = 0; j < gy; j++) {
      if (skipEmpty && !blockHasTerrain(i, j)) continue;
      const content = buildSlice(
        i,
        j,
        W,
        H,
        SX,
        SY,
        OX,
        OY,
        config,
        tileByRxRy,
        overlayByIdx,
        seamV,
        seamH,
        sourceIni,
      );
      slices.push({
        name: `split_${i}_${j}`,
        gridX: i,
        gridY: j,
        content,
      });
    }
  }

  return slices;
}

// ---------------------------------------------------------------------------
// 单块切片构建
// ---------------------------------------------------------------------------

/**
 * 构建单元块 (i, j) 的切片 .map 内容。
 *
 * 单元块覆盖绝对坐标 [OX+iW, OX+(i+1)W) × [OY+jH, OY+(j+1)H)。
 */
function buildSlice(
  i: number,
  j: number,
  W: number,
  H: number,
  SX: number,
  SY: number,
  OX: number,
  OY: number,
  config: MapSplitConfig,
  tileByRxRy: Map<string, IsoTile>,
  overlayByIdx: Map<string, Overlay>,
  seamV: number[][],
  seamH: number[][],
  sourceIni: string,
): string {
  const blockRX0 = OX + i * W;
  const blockRY0 = OY + j * H;

  // 该块的四个连接 ID
  //   NW = 左缝 seamV[i]、SE = 右缝 seamV[i+1]
  //   NE = 上缝 seamH[j]、SW = 下缝 seamH[j+1]
  const nwId = seamV[i][j];
  const seId = seamV[i + 1][j];
  const neId = seamH[j][i];
  const swId = seamH[j + 1][i];

  // 权值：稳定地给切片一个非零 SelectionWeight（指示图块在 Rx<SX-5 处每颗 +1）
  const weight = 1 + (hashFnv1a(`w:${i},${j}:${nwId}:${seId}`) % 4);

  // 找出能容纳所有必要单元图块的最小菱形边长 s
  const neededCells: Array<[number, number]> = [];
  // 四周指示缝（覆盖连接 ID 的全范围 0..W-1）
  neededCells.push([SX - 3, SY + W - 1]); // NW：Ry ∈ [SY, SY+W-1]
  neededCells.push([SX + W + 2, SY + W - 1]); // SE：Ry ∈ [SY, SY+W-1]
  neededCells.push([SY + W - 1, SX - 3]); // NE：Rx ∈ [SY, SY+W-1]
  neededCells.push([SY + W - 1, SX + W + 2]); // SW：Rx ∈ [SY, SY+W-1]
  // 权值指示图块
  for (let w = 0; w < Math.max(1, weight); w++) {
    neededCells.push([SX - 6, SY + w]);
  }
  // 内部四角（切片本地坐标，即真实摆放位置）
  neededCells.push([SX, SY]);
  neededCells.push([SX + W - 1, SY + H - 1]);

  // 选择边长：从 W+3 起，找到第一个能放下所有必要单元的最小 s
  let s = W + 3;
  for (; s < 300; s++) {
    let ok = true;
    for (const [rx, ry] of neededCells) {
      if (!cellValidInDiamond(rx, ry, s)) {
        // cellValidInDiamond 使用的是"本地"换算；这里 rx/ry 已是切片本地坐标，
        // 因此直接校验即可（dx = rx-ry+s-1 等）。
        ok = false;
        break;
      }
    }
    if (ok) break;
  }
  if (s >= 300) {
    throw new Error(`无法为单元块 (${i},${j}) 找到合适的切片尺寸 s。`);
  }

  // 创建空的完整菱形地图，并建立 (dx,dy) -> 图块 索引
  const sliceMap = new MapFile();
  sliceMap.MapTheater = config.theater;
  sliceMap.CreateEmptyMap(s, s);

  const localByIdx = new Map<string, IsoTile>();
  for (const t of sliceMap.IsoTileList) {
    localByIdx.set(`${t.Dx},${t.Dy}`, t);
  }

  const putTile = (
    rx: number,
    ry: number,
    tileNum: number,
    subTile: number,
    z: number,
  ): void => {
    const dx = rx - ry + s - 1;
    const dy = rx + ry - s - 1;
    const key = `${dx},${dy}`;
    const entry = localByIdx.get(key);
    if (entry) {
      entry.Rx = rx;
      entry.Ry = ry;
      entry.TileNum = tileNum;
      entry.SubTile = subTile;
      entry.Z = z;
    }
  };

  // 4. 填充内部实际地形
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const absRX = blockRX0 + x;
      const absRY = blockRY0 + y;
      const tile = tileByRxRy.get(`${absRX},${absRY}`);
      if (!tile) continue; // 源地图此格无图块 → 保持空
      const lrx = absRX - blockRX0 + SX;
      const lry = absRY - blockRY0 + SY;
      putTile(lrx, lry, tile.TileNum, tile.SubTile, tile.Z);
    }
  }

  // 5. 摆放四周的指示图块（连接 ID 编码到 Ry/Rx 的行号位置）
  //    NW： (Rx = SX-3, Ry = nwId + SY)
  putTile(SX - 3, nwId + SY, config.indicatorNum, 0, 0);
  //    SE： (Rx = SX+W+2, Ry = seId + SY)
  putTile(SX + W + 2, seId + SY, config.indicatorNum, 0, 0);
  //    NE： (Ry = SX-3, Rx = neId + SY)
  putTile(neId + SY, SX - 3, config.indicatorNum, 0, 0);
  //    SW： (Ry = SX+W+2, Rx = swId + SY)
  putTile(swId + SY, SX + W + 2, config.indicatorNum, 0, 0);
  //    权值指示图块（Rx < SX-5 计数 +1）
  for (let w = 0; w < Math.max(1, weight); w++) {
    putTile(SX - 6, SY + w, config.indicatorNum, 0, 0);
  }

  // 6. 收集覆盖物（把属于本块的覆盖物平移到本地坐标）
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const absRX = blockRX0 + x;
      const absRY = blockRY0 + y;
      const ov = overlayByIdx.get(`${absRX},${absRY}`);
      if (!ov || !ov.Tile) continue;
      const lrx = absRX - blockRX0 + SX;
      const lry = absRY - blockRY0 + SY;
      const localTile = localByIdx.get(`${lrx - lry + s - 1},${lrx + lry - s - 1}`);
      if (!localTile) continue;
      const newOv = new Overlay(ov.OverlayID, ov.OverlayValue);
      newOv.Tile = localTile;
      sliceMap.OverlayList.push(newOv);
    }
  }

  // 7. 平移对象（单位/步兵/建筑/地形/飞机/污迹/路径点）
  attachObjects(sliceMap, sourceIni, blockRX0, blockRY0, SX, SY, W, H);

  // 8. 组装并返回 INI 文本
  const content = sliceMap.SaveFullMap(undefined, { bottomSpace: 0 });
  return content;
}

// ---------------------------------------------------------------------------
// 对象平移
// ---------------------------------------------------------------------------

/**
 * 把源地图中属于单元块 (blockRX0, blockRY0) 的对象，改写坐标到切片本地
 * （本地 = 绝对坐标 - 块原点 + 顶角）。
 *
 * 对象坐标字段位置（按 RA2 地图 [Units]/[Structures] 等段的逗号格式）：
 *   Unit/Structure/Aircraft/Infantry: 第 4/5 位（0 基下标 3/4）是 X/Y
 *   Smudge: 第 2/3 位（下标 1/2）是 X/Y
 *   Terrain / Waypoint: 键/值里的 XXX 序号
 */
function attachObjects(
  sliceMap: MapFile,
  sourceIni: string,
  blockRX0: number,
  blockRY0: number,
  SX: number,
  SY: number,
  W: number,
  H: number,
): void {
  const file = new IniFile(sourceIni);

  /** section 名 -> MapFile 对应属性（SaveFullMap 依赖这些属性） */
  const sectionTarget = (
    src: string,
  ): 'Unit' | 'Infantry' | 'Structure' | 'Terrain' | 'Aircraft' | 'Smudge' | 'Waypoint' => {
    switch (src) {
      case 'Units':
        return 'Unit';
      case 'Infantry':
        return 'Infantry';
      case 'Structures':
        return 'Structure';
      case 'Terrain':
        return 'Terrain';
      case 'Aircraft':
        return 'Aircraft';
      case 'Smudge':
        return 'Smudge';
      case 'Waypoints':
        return 'Waypoint';
      default:
        return 'Unit';
    }
  };

  /** 判断对象本地坐标是否落在单元块内 */
  const inBlock = (lx: number, ly: number): boolean =>
    lx >= 0 && lx < W && ly >= 0 && ly < H;

  // 通用：把逗号序列里的 X/Y 字段重映射到本地
  const remapIndex = (section: string, xi: number, yi: number): void => {
    const sec = file.GetSection(section);
    if (!sec) return;
    const target = sliceMap[sectionTarget(section)];
    for (const key of sec.Keys) {
      const raw = sec.GetStringValue(key, '');
      const parts = raw.split(',');
      if (parts.length <= Math.max(xi, yi)) continue;
      const absX = parseInt(parts[xi], 10);
      const absY = parseInt(parts[yi], 10);
      if (isNaN(absX) || isNaN(absY)) continue;
      const lx = absX - blockRX0;
      const ly = absY - blockRY0;
      if (!inBlock(lx, ly)) continue; // 不在此块范围内
      parts[xi] = (lx + SX).toString();
      parts[yi] = (ly + SY).toString();
      target.SetStringValue(key, parts.join(','));
    }
  };

  remapIndex('Units', 3, 4);
  remapIndex('Infantry', 3, 4);
  remapIndex('Structures', 3, 4);
  remapIndex('Aircraft', 3, 4);
  remapIndex('Smudge', 1, 2);

  // Terrain：键为 "YYYYXXX"（Y 不定长 + X 三位），值为规则名
  const terrain = file.GetSection('Terrain');
  if (terrain) {
    const target = sliceMap.Terrain;
    for (const key of terrain.Keys) {
      const value = terrain.GetStringValue(key, '');
      const x = parseInt(key.slice(-3), 10);
      const y = parseInt(key.slice(0, key.length - 3), 10);
      if (isNaN(x) || isNaN(y)) continue;
      const lx = x - blockRX0;
      const ly = y - blockRY0;
      if (!inBlock(lx, ly)) continue;
      const newKey =
        (ly + SY).toString() + (lx + SX).toString().padStart(3, '0');
      target.SetStringValue(newKey, value);
    }
  }

  // Waypoints：键为编号，值为 "YYYYXXX"
  const waypoints = file.GetSection('Waypoints');
  if (waypoints) {
    const target = sliceMap.Waypoint;
    for (const key of waypoints.Keys) {
      const value = waypoints.GetStringValue(key, '');
      const x = parseInt(value.slice(-3), 10);
      const y = parseInt(value.slice(0, value.length - 3), 10);
      if (isNaN(x) || isNaN(y)) continue;
      const lx = x - blockRX0;
      const ly = y - blockRY0;
      if (!inBlock(lx, ly)) continue;
      const newValue =
        (ly + SY).toString() + (lx + SX).toString().padStart(3, '0');
      target.SetStringValue(key, newValue);
    }
  }

  // 覆盖物已在 buildSlice 阶段处理
}

export default splitMap;