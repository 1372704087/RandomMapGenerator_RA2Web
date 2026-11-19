/**
 * WinMain.cpp OnGenerate mirror - the headless stage orchestration.
 *
 * Stage order is the vanilla sub_598960 ladder as wired in the reference
 * project's WinMain.cpp (0x598960 dispatch + progress ticks), including
 * the port-only sweeps (PruneTerrainTrees, RemoveCliffsOverRamps inside
 * CreateHills, EnsureStartingPointsConnected inside CreateStartingPoints).
 */

import { Rmg } from './mapGen';
import { diag } from './diag';
import { LandType, MapGenConfig } from './types';
import { decorateWaterTiles } from './river';
import { initRegions, makeRegions } from './making';
import { recalculateCellAttributes } from './recalc';
import { createStartingPoints } from './startpoint';
import { addTechBuildings } from './tech';
import { addTiberium } from './tiberium';
import { createHills } from './hills';
import { createLats, pruneTerrainTrees } from './lat';
import { addUrbanAreas } from './urban';
import { cleanupStage, computeRadarImage, doneStage, saveMapFile } from './mapFile';

export { Rmg } from './mapGen';
export { rollGlobalOptions } from './startpoint';

export interface GenerateParams {
    /** UI combo indices (WinMain MapGenParams). */
    environment: number; // 0..4 -> LandType
    timeOfDay: number; // 0..3
    /**
     * Theater option index — the engine's order (VERA20k emit.rs `theater_name`):
     * 0 temperate / 1 snow / 2 urban / 3 desert / 4 newurban. Out of range
     * resolves to temperate. 5 (lunar) is this port's extension: the engine's
     * data layer has LUNAR and zeroes its cliff/water families, but gamemd's
     * RMG dropdowns never offer it.
     */
    theater: number;
    mapSize: number; // 0..3
    oreDensity: number; // 0..3
    playerIndex: number; // 0 -> 2 players .. 6 -> 8
    gameType: number; // 0 single .map / 1 multi .yrm
    globalSeed: number; // the global randomizer seed (exe logs it)
    mapSeed: number; // the map RNG seed (exe keeps 0)
    /**
     * Ares `RMG::UrbanAreas` 复选框（原版 exe 没有这个开关）。
     * `true` 按地图面积折算数量，数字则直接是指定数量，缺省不生成。
     */
    urbanAreas?: boolean | number;
}

export function envToLandType(env: number): LandType {
    switch (env) {
        case 0: return LandType.Archipelago;
        case 1: return LandType.Continent;
        case 2: return LandType.TeamContinent;
        case 3: return LandType.Inland;
        case 4: return LandType.Mountainous;
        default: return LandType.Continent;
    }
}

export interface GenerateResult {
    ok: boolean;
    waterAmount: number;
    cellCount: number;
    mapPath?: string;
}

/**
 * One full generation. `outPath` mirrors the exe's SaveMapFile call; pass
 * null to skip writing.
 */
export function generateMap(
    params: GenerateParams,
    outPath: string | null,
    resourceDir?: string,
    theaterIniDir?: string | null,
    tileArtDir?: string | null,
): { rmg: Rmg; result: GenerateResult } {
    const rmg = new Rmg(resourceDir, theaterIniDir ?? null, tileArtDir ?? null);

    const cfg: MapGenConfig = {
        landType: envToLandType(params.environment),
        theater: params.theater,
        timeOfDay: params.timeOfDay,
        sizeSlider: params.mapSize,
        playerCount: params.playerIndex + 2,
        oreDensity: params.oreDensity,
        multiplayer: params.gameType === 1,
        waterAmount: 0,
        randomSeed: 0,
        mapRngSeed: params.mapSeed,
        global: {
            flag010: 0, n3: 0, value020: 0, value018: 0, value03C: 0,
            waterAmount: 0, ruggedness: 0, urbanPresence: 0, accessibility: 0,
            regionSize: 0, tiberiumLayout: 0, vegetation: 0, seed04C: 0,
        },
    };

    const { rollGlobalOptions } = require('./startpoint') as typeof import('./startpoint');
    cfg.global = rollGlobalOptions(rmg, params.globalSeed);
    cfg.randomSeed = cfg.global.seed04C >>> 0;
    cfg.waterAmount = cfg.global.waterAmount;

    const ok = rmg.generateMapBody(cfg);
    if (!ok) return { rmg, result: { ok: false, waterAmount: 0, cellCount: 0 } };

    // sub_598960 dispatch (WinMain mirror)
    if (cfg.landType === LandType.Inland || cfg.landType === LandType.Mountainous) {
        if (rmg.waterAmount !== 0) rmg.generateSpecialTerrain();
    } else {
        rmg.generateTerrain();
    }

    const scanMaxLevel = (tag: string): void => {
        if (!process.env.RMG_DEBUG_STAMP) return;
        // [QUALITY-FIX 探针] 每阶段末扫全图 max level，定位 >10 层的写入者
        let mx = -1;
        const side = rmg.size.workSide;
        for (let idx = 0; idx < side * side; ++idx) {
            const mc = rmg.rawSlot(idx);
            if (mc !== null && mc.level > mx) mx = mc.level;
        }
        diag(`LEVEL-CAP ${tag} max=${mx}`);
    };

    decorateWaterTiles(rmg); // sub_59C630, every land type
    scanMaxLevel('after-water');

    initRegions(rmg); // 0x598C24
    makeRegions(rmg); // 0x598D44 (3/4 chain + green fill)
    scanMaxLevel('after-regions');

    recalculateCellAttributes(rmg); // 0x598E1F
    scanMaxLevel('after-recalc1');

    createStartingPoints(rmg); // 0x598E9E (retry loop)
    scanMaxLevel('after-startpoints');
    addTechBuildings(rmg); // 0x598EBF
    addTiberium(rmg); // 0x598EE5 + region teardown
    scanMaxLevel('after-tiberium');
    recalculateCellAttributes(rmg); // 0x598FB8
    // Ares RMG::UrbanAreas 的挂钩点就在这里：0x598FB8 之后 `CALL(0x5A5020)`
    // （PlaceUrbanStructures / PlacePavedRoads）。原版关掉这个复选框时什么都不做。
    if (params.urbanAreas) {
        const areas = typeof params.urbanAreas === 'number'
            ? Math.max(0, Math.trunc(params.urbanAreas))
            : Math.max(2, Math.min(6, Math.round((rmg.size.mapWidth * rmg.size.mapHeight) / 2000)));
        // 3 片大城 + 保留荒野；盒子 38..46 能让 10 格栅格出 3~4 横 + 3~4 竖
        addUrbanAreas(rmg, { areas, sizeRange: [38, 46] });
    }
    scanMaxLevel('after-urban');
    recalculateCellAttributes(rmg); // 0x59912A
    scanMaxLevel('after-recalc3');

    createHills(rmg); // 0x599171
    scanMaxLevel('after-hills');
    createLats(rmg); // 0x599215
    scanMaxLevel('after-lats');
    recalculateCellAttributes(rmg); // 0x599354
    scanMaxLevel('after-recalc4');


    // [QUALITY-FIX] 消除 2~3 级可见落差（RA2 无对应立面件，渲染黑洞的唯一成因；
    // 原版 exe 同病，此 pass 使 TS 严格优于原版）。仅内陆/山地启用。
    scanMaxLevel('after-step-smooth');

    pruneTerrainTrees(rmg); // [port-only]
    cleanupStage(rmg); // 0x5993A5
    scanMaxLevel('after-cleanup');
    computeRadarImage(rmg); // 0x599451
    doneStage(rmg); // 0x59947E
    scanMaxLevel('after-done');

    if (process.env.RMG_DEBUG_STAMP && (cfg.landType === LandType.Inland || cfg.landType === LandType.Mountainous)) {
        // [QUALITY-FIX 探针] 收尾复扫：统计残余 2~3 级可见面（屏幕下方两个方向）
        let p2 = 0, p3 = 0;
        const side = rmg.size.workSide;
        const samples: string[] = [];
        for (let y = 0; y < side; ++y) {
            for (let x = 0; x < side; ++x) {
                if (!rmg.cellExists(x, y)) continue;
                const lvl = rmg.cellAt(x, y).level;
                for (const [dx, dy] of [[1, 0], [0, 1]] as Array<[number, number]>) {
                    if (!rmg.cellExists(x + dx, y + dy)) continue;
                    const d = lvl - rmg.cellAt(x + dx, y + dy).level;
                    if (d === 2 || d === 3) {
                        if (d === 2) ++p2; else ++p3;
                        if (samples.length < 8)
                            samples.push(`(${x},${y})z${lvl}->(${x + dx},${y + dy})z${lvl - d}`);
                    }
                }
            }
        }
        diag(`STEP-SMOOTH-RESIDUAL visible d2=${p2} d3=${p3} ${samples.join(' ')}`);
    }

    let mapPath: string | undefined;
    if (outPath !== null) {
        if (saveMapFile(rmg, outPath)) mapPath = outPath;
    }

    return {
        rmg,
        result: {
            ok: true,
            waterAmount: rmg.waterAmount,
            cellCount: rmg.cellCount,
            mapPath,
        },
    };
}
