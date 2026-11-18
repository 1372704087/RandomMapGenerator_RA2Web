/**
 * RMG —— gamemd 精确随机地图生成管线
 *
 * **唯一实现是 `cxx/`**：vera20k 逐函数平移（每个函数标 gamemd 地址），
 * `generateCxxMap(seed, ...)` 从一个全局种子产出完整 `.map`。
 *
 * 历史上这里还有一套 TS 原生平行实现（`pipeline.ts` + water/regions/hills…），
 * 产出不可用，已于 2026-11-18 整体删除。下面的模块只剩它当年依赖的基础件：
 *   - `x87.ts`     浮点契约（真机 golden：Box-Muller 16/16 位精确）
 *   - `rng.ts`     私有 RNG（真机 golden：5 种子 × 250 状态字位精确）
 *   - `options.ts` 16 选项 + clamp + 尺寸推导
 *   - `sed.ts`     `.SED` [RandomMap] 读写（carry-default；Description hex-CSV）
 *   - `rmgmd.ts`   RMGMD.INI 读取（构造器缺省 + 零售值）
 *   - `cell.ts`    cell 级状态 + 方向契约 + 菱形带
 */

// ---- 生成（唯一路径）------------------------------------------------------
export { generateMap as generateCxxMap } from './cxx/generate';
export type { GenerateParams as CxxGenerateParams } from './cxx/generate';
export { saveMapFile as saveCxxMapFile } from './cxx/mapFile';
export { THEATER_TABLE, MAX_THEATER_INDEX, theaterEntry, theaterName } from './cxx/theater';
export type { TheaterEntry } from './cxx/theater';

// ---- 基础件 ---------------------------------------------------------------
export * from './x87';
export * from './rng';
export * from './options';
export * from './sed';
export * from './rmgmd';
export * from './cell';
