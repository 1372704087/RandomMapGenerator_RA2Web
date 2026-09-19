/**
 * RMG —— gamemd 精确随机地图生成管线（进行中）
 *
 * 这一层不是「生成一张看起来像 YR 随机图的地图」，而是**复刻 gamemd 的构造过程**：
 * 同一条 `.SED`（同种子 + 同选项）⇒ 逐字节相同的地图。
 *
 * 已完成：
 *   - `x87.ts`     浮点契约（真机 golden：Box-Muller 16/16 位精确）
 *   - `rng.ts`     私有 RNG（真机 golden：5 种子 × 250 状态字位精确）
 *   - `options.ts` 16 选项 + clamp + 尺寸推导
 *   - `sed.ts`     `.SED` [RandomMap] 读写（carry-default；Description hex-CSV）
 *   - `rmgmd.ts`   RMGMD.INI 读取（构造器缺省 + 零售值）
 *   - `cell.ts`    cell 级状态 + 方向契约 + 菱形带
 *   - `emit.ts`    grid → MapFile / emit 往返
 *
 * 未完成（见 README.md 阶段清单）：水体 → … → 雷达（stage 3–19）。
 */

export * from './x87';
export * from './rng';
export * from './options';
export * from './sed';
export * from './rmgmd';
export * from './cell';
export * from './emit';
export * from './theater';
export * from './native';
export * from './water';
export * from './regions';
export * from './green';
export * from './recalc';
export * from './hills';
export * from './lat';
export * from './zones';
export * from './start';
export * from './ore';
export * from './pipeline';
