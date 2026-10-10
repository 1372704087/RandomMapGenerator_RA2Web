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
import { cleanupStage, computeRadarImage, doneStage, saveMapFile } from './mapFile';

export { Rmg } from './mapGen';
export { rollGlobalOptions } from './startpoint';

export interface GenerateParams {
    /** UI combo indices (WinMain MapGenParams). */
    environment: number; // 0..4 -> LandType
    timeOfDay: number; // 0..3
    theater: number; // 0 temperate / 1 snow
    mapSize: number; // 0..3
    oreDensity: number; // 0..3
    playerIndex: number; // 0 -> 2 players .. 6 -> 8
    gameType: number; // 0 single .map / 1 multi .yrm
    globalSeed: number; // the global randomizer seed (exe logs it)
    mapSeed: number; // the map RNG seed (exe keeps 0)
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
): { rmg: Rmg; result: GenerateResult } {
    const rmg = new Rmg(resourceDir);

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
    recalculateCellAttributes(rmg); // 0x59912A
    scanMaxLevel('after-recalc3');

    createHills(rmg); // 0x599171
    scanMaxLevel('after-hills');
    createLats(rmg); // 0x599215
    scanMaxLevel('after-lats');
    recalculateCellAttributes(rmg); // 0x599354
    scanMaxLevel('after-recalc4');

    pruneTerrainTrees(rmg); // [port-only]
    cleanupStage(rmg); // 0x5993A5
    scanMaxLevel('after-cleanup');
    computeRadarImage(rmg); // 0x599451
    doneStage(rmg); // 0x59947E
    scanMaxLevel('after-done');

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
