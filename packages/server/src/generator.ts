/**
 * 地图生成器
 *
 * 实现 C# Program.cs 中的地图生成流程，封装为 generateMap() 函数。
 *
 * 由于 WorkingMap 是静态类，所有状态全局共享，必须用 Promise 队列串行化
 * 生成请求，确保同一时间只有一个生成任务在运行。
 */

import {
  WorkingMap,
  MapFile,
  IniSection,
  AbstractMapUnit,
  AbstractTileType,
  PreviewImage,
} from '@ra2/core';
import {
  getTheaterResources,
  getGlobalResources,
  TheaterResources,
} from './resourceLoader';
import {
  GenerateOptions,
  GenerateResult,
  PlayerLocations,
  Direction,
  ALL_DIRECTIONS,
  TheaterSizeConfig,
} from './types';

// ---------------------------------------------------------------------------
// 串行化队列
// ---------------------------------------------------------------------------

/**
 * 生成请求的串行化队列。
 *
 * WorkingMap 是静态类，所有状态全局共享，不支持并发。
 * 使用 Promise 链确保同一时间只有一个生成任务在运行。
 */
let generationChain: Promise<unknown> = Promise.resolve();

// ---------------------------------------------------------------------------
// 公共 API
// ---------------------------------------------------------------------------

/**
 * 生成随机地图。
 *
 * 对应 C# Program.cs 的完整生成流程（步骤 2-19）。
 * 由于 WorkingMap 是静态类，请求会被串行化执行。
 *
 * @param options 生成选项
 * @returns 地图内容和建议的文件名
 */
export async function generateMap(
  options: GenerateOptions,
): Promise<GenerateResult> {
  // 将请求加入串行化队列
  const result = generationChain.then(() => doGenerateMap(options));
  // 无论成功或失败，都更新队列链，确保后续请求可以继续
  generationChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

// ---------------------------------------------------------------------------
// 内部实现
// ---------------------------------------------------------------------------

/**
 * 实际执行地图生成（同步，在串行化队列中调用）。
 *
 * 生成流程（对应 C# Program.cs）：
 *   2.  WorkingMap.Initialize(width, height, config)
 *   3.  恢复缓存的 SterilizeMapUnit 结果
 *   4.  WorkingMap.PlacePlayerLocation(count, direction) - 每个方向
 *   5.  WorkingMap.SetMapUnitByOrder()
 *   6.  WorkingMap.FillRemainingEmptyUnitMap()
 *   7.  WorkingMap.PlaceMapUnitByAbsMapMatrix()
 *   8.  可选: WorkingMap.ChangeStructureHealth(min, max, destroyP)
 *   9.  可选: WorkingMap.RandomPlaceSmudge(density)
 *   10. WorkingMap.ReadyForMiniMap()
 *   11. 创建 MapFile，设置属性和各对象 INI 段
 *   12. mapFile.SaveFullMap(undefined, { bottomSpace })
 *   13. mapFile.CalculateStartingWaypoints(ini)
 *   14. mapFile.RandomSetLighting(ini, lightingSettings)
 *   15. mapFile.ChangeGamemode(ini, gamemode)
 *   16. mapFile.AddAdditionalINI(ini, additionIniContent)
 *   17. mapFile.ChangeName(ini, name)
 *   18. mapFile.ChangeDigest(ini)
 *   19. mapFile.AddComment(ini)
 */
function doGenerateMap(options: GenerateOptions): GenerateResult {
  const theater = getTheaterResources(options.theaterType);
  if (!theater) {
    throw new Error(
      `Unknown theater: "${options.theaterType}". Available theaters: ${listTheaterNames()}`,
    );
  }

  const globalRes = getGlobalResources();

  // 在 totalRandom 模式下，随机生成玩家位置
  const playerLocations: PlayerLocations = options.totalRandom && !options.playerLocations
    ? randomPlayerLocations()
    : options.playerLocations ?? {};

  // 计算玩家总数
  const totalPlayers = countPlayers(playerLocations);
  if (totalPlayers > 8) {
    throw new Error(
      `Total player count (${totalPlayers}) exceeds maximum (8).`,
    );
  }

  // 确定地图尺寸
  let width = options.width;
  let height = options.height;
  if (options.totalRandom || width === 0 || height === 0) {
    const size = randomMapSize(theater, totalPlayers);
    width = size;
    height = size;
  }

  // 确保尺寸为正整数
  if (width <= 0 || height <= 0) {
    throw new Error(`Invalid map size: ${width}x${height}`);
  }

  console.log(
    `[generator] Generating map: ${width}x${height}, theater=${options.theaterType}, ` +
      `players=${totalPlayers}, gamemode=${options.gamemode ?? 'default'}`,
  );

  // 步骤 2: 初始化地图网格
  suppressConsoleLog(() => {
    WorkingMap.Initialize(width, height, theater.config);
  });

  // 步骤 3: 恢复缓存的 AbstractMapUnitList 和 CannotPlaceSmudgeList
  // Initialize 不会重置这两个列表，但我们仍显式恢复以确保正确性
  restoreCachedMapUnits(theater);

  // 步骤 4: 放置玩家出生点
  suppressConsoleLog(() => {
    for (const dir of ALL_DIRECTIONS) {
      const count = playerLocations[dir] ?? 0;
      if (count > 0) {
        WorkingMap.PlacePlayerLocation(count, dir);
      }
    }

    // 步骤 5-7: 放置地图单元
    WorkingMap.SetMapUnitByOrder();
    WorkingMap.FillRemainingEmptyUnitMap();
    WorkingMap.PlaceMapUnitByAbsMapMatrix();

    // 步骤 8: 可选 - 损坏建筑
    if (options.damagedBuilding) {
      let dmgMin: number, dmgMax: number, destroyP: number;
      if (typeof options.damagedBuilding === 'object') {
        dmgMin = options.damagedBuilding.min;
        dmgMax = options.damagedBuilding.max;
        destroyP = options.damagedBuilding.destroyP;
      } else {
        // C# 原版逻辑：随机生成损坏参数
        dmgMin = Math.floor(Math.random() * 80) + 10;  // r.Next(10, 90)
        dmgMax = Math.floor(Math.random() * (200 - dmgMin - 10)) + dmgMin + 10;  // r.Next(dmgMin+10, 200)
        destroyP = Math.floor((100 - dmgMin) / 10) - 2;
      }
      WorkingMap.ChangeStructureHealth(dmgMin, dmgMax, destroyP);
    }

    // 步骤 9: 可选 - 随机污迹
    if (options.smudge && options.smudge > 0) {
      WorkingMap.RandomPlaceSmudge(options.smudge);
    }

    // 步骤 10: 准备小地图
    WorkingMap.ReadyForMiniMap();
  });

  // 步骤 11: 创建 MapFile 并设置属性
  const mapFile = new MapFile();
  mapFile.Width = WorkingMap.Width;
  mapFile.Height = WorkingMap.Height;
  mapFile.MapTheater = WorkingMap.MapTheater;
  mapFile.IsoTileList = WorkingMap.CreateTileList(globalRes.minimapContent);
  mapFile.OverlayList = WorkingMap.OverlayList;

  // 附加各对象 INI 段（仅在有数据时）
  attachIniSection(mapFile, 'Unit', WorkingMap.CreateUnitINI());
  attachIniSection(mapFile, 'Infantry', WorkingMap.CreateInfantryINI());
  attachIniSection(mapFile, 'Structure', WorkingMap.CreateStructureINI());
  attachIniSection(mapFile, 'Terrain', WorkingMap.CreateTerrainINI());
  attachIniSection(mapFile, 'Aircraft', WorkingMap.CreateAircraftINI());
  attachIniSection(mapFile, 'Smudge', WorkingMap.CreateSmudgeINI());
  attachIniSection(mapFile, 'Waypoint', WorkingMap.CreateWaypointINI());

  // 步骤 12: 生成完整地图 INI
  let ini = mapFile.SaveFullMap(globalRes.templateMapContent, {
    bottomSpace: theater.bottomSpace,
  });

  // 步骤 12b: 生成并注入预览图（覆盖模板地图中的静态预览）
  {
    const preview = MapFile.RenderPreview(
      mapFile.IsoTileList,
      mapFile.Width,
      mapFile.Height,
      theater.bottomSpace,
    );
    ini = mapFile.InjectThumb(preview, ini);
  }

  // 步骤 13: 计算起始路径点
  ini = mapFile.CalculateStartingWaypoints(ini);

  // 步骤 14: 随机光照（仅有光照设置的 theater）
  if (theater.lightingSettings) {
    ini = mapFile.RandomSetLighting(ini, theater.lightingSettings);
  }

  // 步骤 15: 设置游戏模式
  if (options.gamemode) {
    ini = mapFile.ChangeGamemode(ini, options.gamemode);
  }

  // 步骤 16: 合并额外 INI（如果存在 addition.ini）
  if (theater.additionIniContent) {
    ini = mapFile.AddAdditionalINI(ini, theater.additionIniContent);
  }

  // 步骤 17: 修改名称
  const mapName = options.name || globalRes.outputName;
  ini = mapFile.ChangeName(ini, mapName);

  // 步骤 18: 修改摘要
  ini = mapFile.ChangeDigest(ini);

  // 步骤 19: 添加注释
  ini = mapFile.AddComment(ini);

  const fileName = `${mapName}.${globalRes.outputExtension}`;

  console.log(
    `[generator] Map generated: ${mapFile.Width}x${mapFile.Height}, ` +
      `fileName="${fileName}", content length=${ini.length}`,
  );

  return { mapContent: ini, fileName };
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/**
 * 恢复缓存的 AbstractMapUnitList 和 CannotPlaceSmudgeList。
 *
 * 每次生成前重置 UseTimes 计数器，确保干净的生成状态。
 */
function restoreCachedMapUnits(theater: TheaterResources): void {
  // 重置 UseTimes（PlaceMapUnitToWorkingMap 会递增此值）
  for (const mu of theater.cachedAbstractMapUnitList) {
    mu.UseTimes = 0;
  }
  WorkingMap.AbstractMapUnitList = theater.cachedAbstractMapUnitList;
  WorkingMap.CannotPlaceSmudgeList = theater.cachedCannotPlaceSmudgeList;
}

/**
 * 将生成的 INI 段附加到 MapFile 的对应属性。
 * 仅在 iniSection 不为 null 时附加。
 */
function attachIniSection(
  mapFile: MapFile,
  property: 'Unit' | 'Infantry' | 'Structure' | 'Terrain' | 'Aircraft' | 'Smudge' | 'Waypoint',
  iniSection: IniSection | null,
): void {
  if (iniSection !== null) {
    mapFile[property] = iniSection;
  }
}

/**
 * 计算所有方向的玩家总数。
 */
function countPlayers(playerLocations?: PlayerLocations): number {
  if (!playerLocations) return 0;
  let total = 0;
  for (const dir of ALL_DIRECTIONS) {
    total += playerLocations[dir] ?? 0;
  }
  return total;
}

/**
 * 随机生成玩家位置配置。
 *
 * 参考 C# Program.cs TotalRandom 逻辑：
 * 随机生成 0-1299 的数，根据范围决定各方向的玩家数量。
 */
function randomPlayerLocations(): PlayerLocations {
  const player = Math.floor(Math.random() * 1300);
  if (player > 1200) {
    return { N: 1, SW: 1, SE: 1 };
  } else if (player > 1150) {
    return { NE: 1, SW: 1 };
  } else if (player > 1100) {
    return { NW: 1, SE: 1 };
  } else if (player > 1000) {
    return { NW: 2, SW: 2, NE: 2, SE: 2 };
  } else if (player > 900) {
    return { N: 2, S: 2, SE: 2, NW: 2 };
  } else if (player > 800) {
    return { NW: 4, SE: 4 };
  } else if (player > 600) {
    return { N: 1, S: 1, W: 1, E: 1, NE: 1, SE: 1, NW: 1, SW: 1 };
  } else if (player > 500) {
    return { N: 2, S: 2, W: 2, E: 2 };
  } else if (player > 400) {
    return { SW: 3, NE: 3 };
  } else if (player > 300) {
    return { N: 3, S: 3 };
  } else if (player > 200) {
    return { E: 3, W: 3 };
  } else if (player > 100) {
    return { NW: 2, SE: 2 };
  } else {
    return { NW: 1, SW: 1, NE: 1, SE: 1 };
  }
}

/**
 * 随机生成地图尺寸。
 *
 * 参考 C# TotalRandom 逻辑：
 * 1. 随机选择一个尺寸类别（Small/Medium/Big/Gigantic）
 * 2. 在该类别的 [min, max] 范围内随机取值
 * 3. 加上玩家人数对应的增量
 *
 * 如果 theater 没有尺寸范围配置，使用默认范围。
 */
function randomMapSize(
  theater: TheaterResources,
  playerCount: number,
): number {
  const sizeConfig: TheaterSizeConfig =
    theater.sizeConfig ?? {
      gigantic: { min: 80, max: 120 },
      big: { min: 70, max: 100 },
      medium: { min: 60, max: 85 },
      small: { min: 50, max: 70 },
    };

  // 随机选择尺寸类别
  const categories: (keyof TheaterSizeConfig)[] = [
    'small',
    'medium',
    'big',
    'gigantic',
  ];
  const categoryIndex = Math.floor(Math.random() * categories.length);
  const category = categories[categoryIndex];
  const range = sizeConfig[category];

  // 在 [min, max) 范围内随机取值
  let size =
    Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;

  // 加上玩家人数对应的增量
  const clampedPlayers = Math.max(1, Math.min(8, playerCount));
  if (theater.playerAdditions) {
    const addition = theater.playerAdditions[String(clampedPlayers)] ?? 0;
    size += addition;
  }

  return size;
}

/**
 * 列出所有可用的 theater 名称。
 */
function listTheaterNames(): string {
  // 动态导入避免循环依赖
  const { getAllTheaters } = require('./resourceLoader');
  const theaters = getAllTheaters() as TheaterResources[];
  return theaters.map((t) => `"${t.name}"`).join(', ');
}

/**
 * 抑制 console.log 执行指定函数。
 *
 * WorkingMap 内部有大量 console.log 调试输出，在生成期间静默以保持日志清洁。
 * console.warn 和 console.error 仍会输出。
 */
function suppressConsoleLog<T>(fn: () => T): T {
  const originalLog = console.log;
  console.log = (..._args: unknown[]) => {
    // 静默
  };
  try {
    return fn();
  } finally {
    console.log = originalLog;
  }
}

// 导出辅助函数供测试使用
export { countPlayers, randomMapSize };
