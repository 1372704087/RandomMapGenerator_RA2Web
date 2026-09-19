/**
 * 地图拆解服务（Map Splitter 服务编排）
 *
 * 把一张**完整地图**的 INI 内容，按某个 theater 的地图单元尺寸切成若干张可复用、
 * 能被生成器选中拼接的 `.map` 切片。
 *
 * 本模块自包含地解析 theater 资源得到拆解参数（单元宽高、顶角、指示图块），
 * 不依赖 WorkingMap 的全局静态状态（服务器加载后全局态属于最后一个 theater），
 * 因此每个请求可按任意 theater 独立拆解。
 */

import {
  splitMap,
  MapSplitSlice,
  MapSplitOptions,
  MapSplitConfig,
  MapFile,
  IniFile,
  Theater,
} from '@ra2/core';
import { getTheaterResources, getAllTheaters, TheaterResources } from './resourceLoader';

/**
 * 把 theater 枚举字符串（如 "TEMPERATE"）映射到 Theater 枚举值。
 * 无法识别时回退到 Theater.TEMPERATE。
 */
function theaterFromName(name: string): Theater {
  const key = (name || '').toUpperCase().replace(/-/g, '_') as keyof typeof Theater;
  const value = (Theater as unknown as Record<string, Theater | undefined>)[key];
  return typeof value === 'number' ? value : Theater.TEMPERATE;
}

/**
 * 从 theater 资源解析拆解参数。
 */
/** 由 theater 资源构建拆解配置（导出供 verify-split 等脚本复用，避免手拼字段） */
export function buildSplitConfig(theater: TheaterResources): MapSplitConfig {
  const [mapUnitWidth = 25, mapUnitHeight = 25] = theater.mapUnitSize
    .split('x')
    .map((s) => parseInt(s.trim(), 10));
  const [startingX = 18, startingY = 18] = theater.topCorner
    .split(',')
    .map((s) => parseInt(s.trim(), 10));

  // 指示图块编号：读取该 theater 的 indicator.map 第一号图块
  const indicatorMap = new MapFile();
  indicatorMap.CreateIsoTileList(theater.config.indicatorMapContent);
  const indicatorNum =
    indicatorMap.IsoTileList.length > 0
      ? indicatorMap.IsoTileList[0].TileNum
      : 0;

  return {
    mapUnitWidth,
    mapUnitHeight,
    startingX,
    startingY,
    theater: theaterFromName(theater.theaterEnum),
    indicatorNum,
    emptyMapContent: theater.emptyMapContent,
  };
}

/**
 * 把一张完整地图拆解成若干切片。
 *
 * @param theaterName    theater 目录名，如 "TEMPERATE"
 * @param sourceIni      完整地图的 INI 文本内容（.map/.yrm 文本）
 * @param options        拆解选项（如 skipEmpty）
 * @returns 切片列表（每个含文件名、网格坐标、内容）
 */
export function splitFullMap(
  theaterName: string,
  sourceIni: string,
  options?: MapSplitOptions,
): MapSplitSlice[] {
  if (!sourceIni || sourceIni.trim().length === 0) {
    throw new Error('sourceIni must be a non-empty map content string.');
  }

  const theater = getTheaterResources(theaterName);
  if (!theater) {
    throw new Error(`Theater "${theaterName}" not found.`);
  }

  const config = buildSplitConfig(theater);
  return splitMap(sourceIni, config, options);
}

// ---------------------------------------------------------------------------
// Theater 自动识别
//
// 切片必须按**源地图自己的** theater 参数来切（MapUnitSize / TopCorner / indicator），
// 手动选错会直接导致地形不匹配 —— 例如 TEMPERATE 是 15x15 而 DESERT 是 25x25，
// 按错的单元尺寸切出来的切片无法被生成器正确复用。
// 地图的 `[Map] Theater` 就是权威来源，这里把它读出来并解析到本仓库的目录。
// ---------------------------------------------------------------------------

/** 从地图 INI 文本里读出引擎 theater 名（如 `TEMPERATE`）；读不到返回 null */
export function detectMapTheater(mapContent: string): string | null {
  if (!mapContent || mapContent.trim().length === 0) return null;

  try {
    const ini = new IniFile(mapContent);
    const raw = ini.GetStringValue('Map', 'Theater', '').trim();
    if (raw.length > 0) return raw;
  } catch {
    /* 落到下面的容错扫描 */
  }

  // 容错：段名/大小写不规范时按 [Map] 段逐行扫
  const sec = /\[Map\]([\s\S]*?)(?=\n\s*\[|$)/i.exec(mapContent);
  if (sec) {
    const m = /^\s*Theater\s*=\s*([^\r\n;]+)/im.exec(sec[1]);
    if (m) {
      const v = m[1].trim();
      if (v.length > 0) return v;
    }
  }
  return null;
}

/** 引擎 theater 名 → 本仓库可用 theater 目录 的解析结果 */
export interface TheaterResolution {
  /** 可用的 theater 目录名；null = 没有匹配的目录 */
  dir: string | null;
  /** 匹配到的全部候选目录（>1 表示撞名） */
  candidates: string[];
  /**
   * 是否撞名：同一个引擎 theater 名对应多个目录。
   * 实例：`TEMPERATE` 同时是 `TEMPERATE`(15x15) 与 `TEMPERATE_Islands`(30x30) 的 Theater 字段。
   */
  ambiguous: boolean;
  /** `dir` 是否来自「目录名与引擎名精确相等」 */
  exactNameMatch: boolean;
  /** 命中目录的地图单元尺寸，便于前端展示 */
  mapUnitSize: string | null;
  /** 本仓库全部可用目录 */
  available: string[];
}

/**
 * 把引擎 theater 名解析到本仓库的 theater 目录。
 *
 * 优先「目录名与引擎名精确相等」（这能区分 `TEMPERATE` 与 `TEMPERATE_Islands`），
 * 否则按各目录 settings.ini 的 `Theater` 字段匹配；多个命中时取目录名字典序最小者并置 `ambiguous`。
 */
export function resolveTheaterDir(engineTheater: string | null): TheaterResolution {
  const all = getAllTheaters();
  const available = all.map((t) => t.name);
  const base: TheaterResolution = {
    dir: null,
    candidates: [],
    ambiguous: false,
    exactNameMatch: false,
    mapUnitSize: null,
    available,
  };

  if (!engineTheater || engineTheater.trim().length === 0) return base;
  const want = engineTheater.trim().toUpperCase();

  const exact = all.find((t) => t.name.toUpperCase() === want);
  if (exact) {
    return {
      ...base,
      dir: exact.name,
      candidates: [exact.name],
      exactNameMatch: true,
      mapUnitSize: exact.mapUnitSize,
    };
  }

  const byEnum = all.filter((t) => t.theaterEnum.toUpperCase() === want);
  if (byEnum.length === 0) return base;

  const picked = byEnum.slice().sort((a, b) => a.name.localeCompare(b.name))[0];
  return {
    ...base,
    dir: picked.name,
    candidates: byEnum.map((t) => t.name),
    ambiguous: byEnum.length > 1,
    exactNameMatch: false,
    mapUnitSize: picked.mapUnitSize,
  };
}

/** 地图文本 → theater 识别结果 */
export interface TheaterDetection extends TheaterResolution {
  /** 地图里读到的引擎 theater 名 */
  engineTheater: string | null;
  /** 地图里是否有 `[Map]` 段 */
  hasMapSection: boolean;
}

/** 一步到位：从地图文本识别 theater 并解析到可用目录 */
export function detectTheater(mapContent: string): TheaterDetection {
  const engineTheater = detectMapTheater(mapContent);
  const resolution = resolveTheaterDir(engineTheater);
  return {
    ...resolution,
    engineTheater,
    hasMapSection: /\[Map\]/i.test(mapContent ?? ''),
  };
}

/**
 * 组装拆解前的告警（供 API 原样回给前端，不要在前端重新推导）。
 */
export function buildTheaterWarnings(
  detection: TheaterDetection,
  effectiveDir: string,
  source: 'auto' | 'manual' | 'fallback',
): string[] {
  const out: string[] = [];

  if (!detection.hasMapSection) {
    out.push('内容里没有找到 [Map] 段，无法自动识别地图类型；将按你选择的 theater 拆解。');
  } else if (!detection.engineTheater) {
    out.push('[Map] 段里没有 Theater 键，无法自动识别地图类型；将按你选择的 theater 拆解。');
  } else if (!detection.dir) {
    out.push(
      `地图的 Theater=${detection.engineTheater}，但本仓库没有对应地形目录` +
        `（可用：${detection.available.join(' / ')}）；切出来的切片可能无法复用。`,
    );
  } else if (source === 'manual' && effectiveDir !== detection.dir) {
    out.push(
      `地图的 Theater=${detection.engineTheater}（本地目录 ${detection.dir}，单元 ${detection.mapUnitSize}），` +
        `但你手动指定为 ${effectiveDir}；单元尺寸不同会切出错位的地形。`,
    );
  }

  if (detection.ambiguous) {
    out.push(
      `Theater=${detection.engineTheater} 在本地对应多个目录（${detection.candidates.join(' / ')}），` +
        `已默认选用 ${detection.dir}；若源图来自岛屿地形请改选另一个。`,
    );
  }

  return out;
}