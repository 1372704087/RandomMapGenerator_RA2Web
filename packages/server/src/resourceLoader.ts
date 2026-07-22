/**
 * 资源加载器
 *
 * 在服务器启动时加载所有资源文件到内存，为每个 theater 预加载 WorkingMapConfig，
 * 并缓存 SterilizeMapUnit 的结果（AbstractMapUnitList / CannotPlaceSmudgeList）。
 *
 * 由于 WorkingMap 是静态类，全局共享状态，资源加载阶段需要逐个 theater 执行
 * Initialize + SterilizeMapUnit，然后将结果缓存下来。后续生成时只需 Initialize
 * 重置地图网格，再恢复缓存的 AbstractMapUnitList 即可。
 */

import fs from 'fs';
import path from 'path';
import {
  WorkingMap,
  WorkingMapConfig,
  LightingSettings,
  IniFile,
  AbstractMapUnit,
  AbstractTileType,
} from '@ra2/core';
import {
  TheaterInfo,
  TheaterSizeConfig,
  SizeRange,
} from './types';

// ---------------------------------------------------------------------------
// 资源路径
// ---------------------------------------------------------------------------

/**
 * 资源目录路径。
 *
 * 编译后运行 dist/index.js 时，__dirname 为 packages/server/dist，
 * ../resources 指向 packages/server/resources。
 *
 * 开发模式 tsx 运行 src/index.ts 时，__dirname 为 packages/server/src，
 * ../resources 同样指向 packages/server/resources。
 */
const RESOURCES_DIR = path.join(__dirname, '..', 'resources');
const MAP_UNITS_DIR = path.join(RESOURCES_DIR, 'MapUnits');

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 单个 theater 的全部已加载资源 */
export interface TheaterResources {
  /** 目录名，如 "TEMPERATE"、"DESERT" */
  name: string;
  /** Theater 枚举名（来自 settings.ini 的 Theater 字段） */
  theaterEnum: string;
  /** WorkingMap 初始化配置 */
  config: WorkingMapConfig;
  /** 底部空间（来自 settings.ini 的 BottomSpace，默认 4） */
  bottomSpace: number;
  /** 光照范围设置（可选，仅 DESERT 等有光照范围的 theater） */
  lightingSettings: LightingSettings | null;
  /** addition.ini 内容（可选） */
  additionIniContent: string | null;
  /** 缓存的 AbstractMapUnitList（SterilizeMapUnit 的结果） */
  cachedAbstractMapUnitList: AbstractMapUnit[];
  /** 缓存的 CannotPlaceSmudgeList */
  cachedCannotPlaceSmudgeList: AbstractTileType[];
  /** 地图单元尺寸字符串，如 "15x15" */
  mapUnitSize: string;
  /** 顶角坐标字符串，如 "13,13" */
  topCorner: string;
  /** 地图尺寸范围配置（可选） */
  sizeConfig: TheaterSizeConfig | null;
  /** 玩家人数对应的尺寸增量 */
  playerAdditions: Record<string, number> | null;
  /** 地图单元文件数量 */
  mapUnitCount: number;
  /** 是否有 cannotplacesmudge.map */
  hasCannotPlaceSmudge: boolean;
}

/** 全局共享资源 */
export interface GlobalResources {
  /** 模板地图内容 (templateMap.map) */
  templateMapContent: string;
  /** 游戏规则 (rulesmd.ini) */
  rulesContent: string;
  /** 艺术配置 (artmd.ini) */
  artContent: string;
  /** 小地图配置 (minimap.ini) */
  minimapContent: string;
  /** 默认输出名称 */
  outputName: string;
  /** 默认输出扩展名 */
  outputExtension: string;
}

// ---------------------------------------------------------------------------
// 模块级状态
// ---------------------------------------------------------------------------

/** 所有 theater 资源，按目录名索引 */
const theaters: Map<string, TheaterResources> = new Map();

/** 全局资源 */
let globalResources: GlobalResources | null = null;

/** 是否已加载 */
let loaded = false;

// ---------------------------------------------------------------------------
// 公共 API
// ---------------------------------------------------------------------------

/**
 * 加载所有资源文件到内存。
 *
 * 在服务器启动时调用一次。包括：
 * - 全局资源：rulesmd.ini、artmd.ini、minimap.ini、settings.ini
 * - 每个 theater 的资源：settings.ini、所有 .map 文件、indicator.map、
 *   cannotplacesmudge.map（可选）、addition.ini（可选）
 * - 为每个 theater 预执行 Initialize + SterilizeMapUnit，缓存结果
 *
 * 重复调用是安全的（幂等），不会重复加载。
 */
export function loadAllResources(): void {
  if (loaded) return;

  console.log('[resourceLoader] Loading resources from:', RESOURCES_DIR);

  // 加载全局资源
  globalResources = loadGlobalResources();
  console.log(
    `[resourceLoader] Global resources loaded: outputName="${globalResources.outputName}", extension="${globalResources.outputExtension}"`,
  );

  // 加载每个 theater
  const entries = fs.readdirSync(MAP_UNITS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const theaterDir = path.join(MAP_UNITS_DIR, entry.name);
    console.log(`[resourceLoader] Loading theater: ${entry.name}`);
    const theaterRes = loadTheaterResources(theaterDir, globalResources);
    theaters.set(entry.name, theaterRes);
    console.log(
      `[resourceLoader] Theater "${entry.name}" loaded: ${theaterRes.mapUnitCount} map units, ` +
        `theater=${theaterRes.theaterEnum}, ` +
        `lighting=${theaterRes.lightingSettings !== null}, ` +
        `additionIni=${theaterRes.additionIniContent !== null}`,
    );
  }

  console.log(`[resourceLoader] All resources loaded. ${theaters.size} theaters.`);
  loaded = true;
}

/**
 * 获取全局资源。
 * 必须在 loadAllResources() 之后调用。
 */
export function getGlobalResources(): GlobalResources {
  if (!globalResources) {
    throw new Error('Resources not loaded. Call loadAllResources() first.');
  }
  return globalResources;
}

/**
 * 获取指定 theater 的资源。
 * @param name theater 目录名
 */
export function getTheaterResources(name: string): TheaterResources | null {
  return theaters.get(name) ?? null;
}

/**
 * 获取所有已加载的 theater 资源列表。
 */
export function getAllTheaters(): TheaterResources[] {
  return Array.from(theaters.values());
}

/**
 * 获取所有 theater 的信息（用于 API 返回）。
 */
export function getTheaterInfoList(): TheaterInfo[] {
  return getAllTheaters().map((res) => ({
    name: res.name,
    theater: res.theaterEnum,
    mapUnitSize: res.mapUnitSize,
    topCorner: res.topCorner,
    bottomSpace: res.bottomSpace,
    hasLighting: res.lightingSettings !== null,
    hasAdditionIni: res.additionIniContent !== null,
    hasCannotPlaceSmudge: res.hasCannotPlaceSmudge,
    sizeConfig: res.sizeConfig ?? undefined,
    playerAdditions: res.playerAdditions ?? undefined,
    mapUnitCount: res.mapUnitCount,
  }));
}

// ---------------------------------------------------------------------------
// 内部实现
// ---------------------------------------------------------------------------

/**
 * 加载全局资源文件。
 */
function loadGlobalResources(): GlobalResources {
  const settingsPath = path.join(RESOURCES_DIR, 'settings.ini');
  const settingsContent = readTextFile(settingsPath);
  const settings = new IniFile(settingsContent);

  return {
    templateMapContent: readTextFile(
      path.join(RESOURCES_DIR, 'templateMap.map'),
    ),
    rulesContent: readTextFile(path.join(RESOURCES_DIR, 'rulesmd.ini')),
    artContent: readTextFile(path.join(RESOURCES_DIR, 'artmd.ini')),
    minimapContent: readTextFile(path.join(RESOURCES_DIR, 'minimap.ini')),
    outputName: settings.GetStringValue('settings', 'OutputName', '随机地图'),
    outputExtension: settings.GetStringValue(
      'settings',
      'OutputExtension',
      'yrm',
    ),
  };
}

/**
 * 加载单个 theater 的资源并预执行 SterilizeMapUnit 缓存结果。
 */
function loadTheaterResources(
  theaterDir: string,
  globalRes: GlobalResources,
): TheaterResources {
  const name = path.basename(theaterDir);

  // 读取 settings.ini
  const settingsContent = readTextFile(path.join(theaterDir, 'settings.ini'));
  const settings = new IniFile(settingsContent);

  const mapUnitSize = settings.GetStringValue(
    'settings',
    'MapUnitSize',
    '25x25',
  );
  const topCorner = settings.GetStringValue('settings', 'TopCorner', '18,18');
  const theaterEnum = settings.GetStringValue(
    'settings',
    'Theater',
    'TEMPERATE',
  );
  const bottomSpace = settings.GetIntValue('settings', 'BottomSpace', 4);

  // 解析光照设置
  const lightingSettings = parseLightingSettings(settings);

  // 解析尺寸范围
  const sizeConfig = parseSizeConfig(settings);

  // 解析玩家增量
  const playerAdditions = parsePlayerAdditions(settings);

  // 读取地图单元文件（排除 indicator.map 和 cannotplacesmudge.map）
  const allFiles = fs.readdirSync(theaterDir);
  const mapUnitFiles: { name: string; content: string }[] = [];
  for (const file of allFiles.sort()) {
    if (
      file.endsWith('.map') &&
      file !== 'indicator.map' &&
      file !== 'cannotplacesmudge.map'
    ) {
      mapUnitFiles.push({
        name: file,
        content: readTextFile(path.join(theaterDir, file)),
      });
    }
  }

  // 读取 indicator.map（必需）
  const indicatorMapContent = readTextFile(
    path.join(theaterDir, 'indicator.map'),
  );

  // 读取 cannotplacesmudge.map（可选）
  let cannotPlaceSmudgeMapContent: string | undefined;
  const smudgePath = path.join(theaterDir, 'cannotplacesmudge.map');
  const hasCannotPlaceSmudge = fs.existsSync(smudgePath);
  if (hasCannotPlaceSmudge) {
    cannotPlaceSmudgeMapContent = readTextFile(smudgePath);
  }

  // 读取 addition.ini（可选）
  let additionIniContent: string | null = null;
  const additionPath = path.join(theaterDir, 'addition.ini');
  if (fs.existsSync(additionPath)) {
    additionIniContent = readTextFile(additionPath);
  }

  // 构建 WorkingMapConfig
  const config: WorkingMapConfig = {
    mapUnitFiles,
    indicatorMapContent,
    cannotPlaceSmudgeMapContent,
    settingsContent,
    rulesContent: globalRes.rulesContent,
    artContent: globalRes.artContent,
  };

  // 预执行 Initialize + SterilizeMapUnit，缓存结果
  // Initialize 需要一个 width/height，但这里只是为了让 MapUnitWidth/Height、
  // StartingX/Y、IndicatorNum 等被正确设置。使用基于 MapUnitSize 的合理默认值。
  const [muW, muH] = mapUnitSize.split('x').map((s) => parseInt(s, 10));
  const dummyWidth = muW * 4;
  const dummyHeight = muH * 4;

  // 抑制 SterilizeMapUnit 期间的 console.log 噪音
  const originalConsoleLog = console.log;
  console.log = (...args: unknown[]) => {
    // 静默加载期间的日志
  };
  try {
    WorkingMap.Initialize(dummyWidth, dummyHeight, config);
    WorkingMap.SterilizeMapUnit(config);
  } finally {
    console.log = originalConsoleLog;
  }

  // 缓存 SterilizeMapUnit 的结果
  const cachedAbstractMapUnitList: AbstractMapUnit[] = [
    ...WorkingMap.AbstractMapUnitList,
  ];
  const cachedCannotPlaceSmudgeList: AbstractTileType[] = [
    ...WorkingMap.CannotPlaceSmudgeList,
  ];

  return {
    name,
    theaterEnum,
    config,
    bottomSpace,
    lightingSettings,
    additionIniContent,
    cachedAbstractMapUnitList,
    cachedCannotPlaceSmudgeList,
    mapUnitSize,
    topCorner,
    sizeConfig,
    playerAdditions,
    mapUnitCount: mapUnitFiles.length,
    hasCannotPlaceSmudge,
  };
}

/**
 * 从 theater 的 settings.ini 解析光照范围设置。
 *
 * 格式示例（DESERT/settings.ini）：
 *   Red=9000,10600
 *   Green=9000,10100
 *   ...
 *
 * 解析为 LightingSettings 对象，每个值为 [min, max] 元组。
 * 如果 settings.ini 中没有任何光照字段，返回 null。
 */
function parseLightingSettings(settings: IniFile): LightingSettings | null {
  const keys: (keyof LightingSettings)[] = [
    'Red',
    'Green',
    'Blue',
    'Level',
    'Ambient',
    'IonRed',
    'IonGreen',
    'IonBlue',
    'IonLevel',
    'IonAmbient',
  ];

  // 检查是否至少有一个光照字段
  const hasAny = keys.some((k) =>
    settings.KeyExists('settings', k as string),
  );
  if (!hasAny) {
    return null;
  }

  // 默认值：颜色和 Ambient 为 [10000, 10000]（即 1.0），Level 为 [320, 320]（即 0.032）
  // Ion 系列默认与主光照相同
  const defaults: Record<keyof LightingSettings, [number, number]> = {
    Red: [10000, 10000],
    Green: [10000, 10000],
    Blue: [10000, 10000],
    Level: [320, 320],
    Ambient: [10000, 10000],
    IonRed: [10000, 10000],
    IonGreen: [10000, 10000],
    IonBlue: [10000, 10000],
    IonLevel: [320, 320],
    IonAmbient: [10000, 10000],
  };

  const result = {} as LightingSettings;
  for (const key of keys) {
    const raw = settings.GetStringValue('settings', key as string, '');
    if (raw) {
      const parsed = parseRange(raw);
      if (parsed) {
        result[key] = parsed;
      } else {
        result[key] = defaults[key];
      }
    } else {
      result[key] = defaults[key];
    }
  }

  return result;
}

/**
 * 解析 "min,max" 格式的字符串为 [min, max] 元组。
 * 失败时返回 null。
 */
function parseRange(value: string): [number, number] | null {
  const parts = value.split(',');
  if (parts.length !== 2) return null;
  const min = parseInt(parts[0].trim(), 10);
  const max = parseInt(parts[1].trim(), 10);
  if (isNaN(min) || isNaN(max)) return null;
  return [min, max];
}

/**
 * 解析地图尺寸范围配置。
 *
 * 格式示例：
 *   GiganticMapSideLength=80,120
 *   BigMapSideLength=70,100
 *   MediumMapSideLength=60,85
 *   SmallMapSideLength=50,70
 */
function parseSizeConfig(settings: IniFile): TheaterSizeConfig | null {
  const gigantic = parseSizeRange(settings, 'GiganticMapSideLength');
  const big = parseSizeRange(settings, 'BigMapSideLength');
  const medium = parseSizeRange(settings, 'MediumMapSideLength');
  const small = parseSizeRange(settings, 'SmallMapSideLength');

  if (!gigantic && !big && !medium && !small) {
    return null;
  }

  // 对缺失的范围使用默认值
  return {
    gigantic: gigantic ?? { min: 80, max: 120 },
    big: big ?? { min: 70, max: 100 },
    medium: medium ?? { min: 60, max: 85 },
    small: small ?? { min: 50, max: 70 },
  };
}

function parseSizeRange(
  settings: IniFile,
  key: string,
): SizeRange | null {
  const raw = settings.GetStringValue('settings', key, '');
  if (!raw) return null;
  const parsed = parseRange(raw);
  if (!parsed) return null;
  return { min: parsed[0], max: parsed[1] };
}

/**
 * 解析玩家人数对应的尺寸增量。
 *
 * 格式示例：
 *   1PlayerAddition=0
 *   2PlayerAddition=10
 *   ...
 *   8PlayerAddition=55
 */
function parsePlayerAdditions(
  settings: IniFile,
): Record<string, number> | null {
  const result: Record<string, number> = {};
  let hasAny = false;
  for (let i = 1; i <= 8; i++) {
    const key = `${i}PlayerAddition`;
    if (settings.KeyExists('settings', key)) {
      result[String(i)] = settings.GetIntValue('settings', key, 0);
      hasAny = true;
    }
  }
  return hasAny ? result : null;
}

/**
 * 读取文本文件，以 UTF-8 编码。
 */
function readTextFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}
