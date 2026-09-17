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
  Theater,
} from '@ra2/core';
import { getTheaterResources, TheaterResources } from './resourceLoader';

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
function buildSplitConfig(theater: TheaterResources): MapSplitConfig {
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