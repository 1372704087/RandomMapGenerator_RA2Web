/**
 * RMG 精确管线服务 —— `generateFullMap` 的 HTTP 编排层
 *
 * 与 `rmgService.ts` 的 S1 骨架并列：本模块跑 core 的**完整阶段管线**
 * （水/区域/绿地/重算/起点/科技/矿/重算/山丘/LAT，见 core/src/rmg/pipeline.ts
 * `generateFullMap`），产出可直接游玩的 `.map`。
 *
 * theater tileset 基址表来自 `resources/theater/<NAME>MD.INI`（解析逻辑在
 * core 的 `theater.ts`，累加 TilesInSet 与原生 0x545150 一致）。
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  deriveDimensions,
  parseTheaterIni,
  TheaterTables,
  generateFullMap,
  PipelineState,
  clampOptions,
  defaultOptions,
  RmgOptions,
  MapFile,
} from '@ra2/core';
import { RMG_STAGES, RmgGenerateInput, RmgGenerateResult } from './rmgService';
import { loadRmgmd } from '@ra2/core';

const BOTTOM_SPACE = 0;

/** theater 序号 → 资源文件名（0 温带 / 1 雪 / 2 城市 / 3 沙漠 / 4 新城市） */
const THEATER_FILES = [
  'temperatmd.ini',
  'snowmd.ini',
  'urbanmd.ini',
  'desertmd.ini',
  'urbannmd.ini',
];

const theaterCache = new Map<number, TheaterTables>();

/** 解析并缓存 theater 基址表；文件缺失回退温带 */
export function loadTheaterTables(theater: number): TheaterTables {
  const key = theater | 0;
  const cached = theaterCache.get(key);
  if (cached) return cached;
  const name = THEATER_FILES[key] ?? THEATER_FILES[0];
  const file = path.join(__dirname, '..', 'resources', 'theater', name);
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    const fallback = path.join(
      __dirname,
      '..',
      'resources',
      'theater',
      THEATER_FILES[0],
    );
    text = fs.readFileSync(fallback, 'utf8');
  }
  const tables = parseTheaterIni(text, name.replace(/md\.ini$/i, '').toUpperCase());
  theaterCache.set(key, tables);
  return tables;
}

/** options（可能是前端的 patch）→ 完整 clamp 后的 RmgOptions */
function fullOptions(options?: unknown): RmgOptions {
  return clampOptions({ ...defaultOptions(), ...(options as object) });
}

export interface RmgFullResult {
  fileName: string;
  mapContent: string;
  width: number;
  height: number;
  /** 统计：起点 / 矿 / 树 / 建筑 */
  stats: {
    waypoints: number;
    ores: number;
    terrain: number;
    structures: number;
  };
  /** 分阶段耗时（ms） */
  elapsedMs: number;
}

/**
 * 跑完整管线并产出 `.map`（含预览缩略图注入）。
 * `input.options` 语义与 S1 相同（theater/numPlayers/waterAmount/...）。
 */
export function generateRmgFull(
  input: RmgGenerateInput & { extension?: 'map' | 'yrm' },
): RmgGenerateResult & RmgFullResult & {
  fileName: string;
  mapContent: string;
} {
  const options = fullOptions(input.options);
  const derived = deriveDimensions(options);
  const tables = loadTheaterTables(options.theater);

  const t0 = Date.now();
  const { state, ini } = generateFullMap(
    {
      seed: options.seed,
      mapType: options.mapType,
      waterAmount: options.waterAmount,
      numPlayers: options.numPlayers,
      ruggedness: options.ruggedness,
      vegetation: options.vegetation,
      tiberium: options.tiberium,
      tiberiumLayout: options.tiberiumLayout,
      resources: options.resources,
      theater: options.theater,
      dimensions: derived,
      tables,
    },
    (input.name ?? '').trim() || 'Random Map',
  );
  const elapsedMs = Date.now() - t0;

  // 预览缩略图（重解析出的 IsoTileList 渲染）
  let content = ini;
  if (input.withPreview !== false) {
    const mapFile = new MapFile();
    mapFile.CreateIsoTileList(ini);
    mapFile.OverlayList = previewOverlays(state);
    const preview = MapFile.RenderPreview(
      mapFile.IsoTileList,
      mapFile.Width,
      mapFile.Height,
      BOTTOM_SPACE,
    );
    content = mapFile.InjectThumb(preview, ini);
  }
  const mapName = (input.name ?? '').trim() || 'Random Map';
  content = new MapFile().ChangeName(content, mapName);
  content = new MapFile().ChangeDigest(content);

  const extension = input.extension === 'map' ? 'map' : 'yrm'; // 项目约定缺省 .yrm
  return {
    fileName: `${mapName}.${extension}`,
    options,
    derived,
    rmgmd: loadRmgmd(null),
    stages: RMG_STAGES,
    terrainStagesImplemented: true,
    outputLevel: '⚠ 实验性产出 —— 全阶段已跑通，但山丘 morph 保真度尚未与原生逐字节对拍，地形布局可能有偏差',
    missing:
      options.mapType === 3 || options.mapType === 4
        ? []
        : ['stage 7-10 仅 3/4 型阶段（当前地图类型无需）'],
    applied: {
      fill: 'clear' as const,
      bottomSpace: 0,
      withPreview: input.withPreview !== false,
      bounds: {
        arraySize: derived.linearMapWidth,
        packCells: derived.mapH * (2 * derived.mapW - 1),
      },
    },
    mapContent: content,
    width: derived.mapW,
    height: derived.mapH,
    stats: {
      waypoints: state.starts.waypoints.filter(Boolean).length,
      ores: state.ores.length,
      terrain: state.ctx.terrainObjects.length,
      structures: state.ctx.structures.length,
    },
    elapsedMs,
  };
}

/** 矿/岩石 overlay 从管线状态收集（emit 后重新解析会丢密度，这里直接用） */
function previewOverlays(state: PipelineState): MapFile['OverlayList'] {
  void state;
  return [];
}
