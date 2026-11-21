/**
 * VERA20k / 原版的硬上限——单一数据源。
 *
 * 这些数字不是"随手写的魔法数"，每一处都有出处，改之前先确认引擎那边真的吃：
 *
 * | 常量 | 值 | 出处 |
 * | --- | --- | --- |
 * | `MAX_PLAYERS_RETAIL` | 8 | 原版 `[Waypoints]` 只认 0..7（`gamemd` 读 8 个键） |
 * | `MAX_PLAYERS_VERA20K` | 30 | `vera20k/src/skirmish_launch.rs:24` `NETWORK_PLAYER_SLOT_COUNT = 30` |
 * | `VERA20K_MAX_SIDE` | 512 | `[Map]` Size 单边上限（正方形最大 512×512） |
 * | `VERA20K_MAX_SPAN` | 1024 | `[Map]` Size `Width + Height ≤ 1024` |
 * | `MAX_PLAYERS_CARDINAL` | 4 | `PlacePlayerLocation` 的 N/S/W/E 只有 4 组偏移 |
 *
 * **30 不是可以随便往上抬的**：`vera20k/src/map/waypoints.rs:34-37` 的
 * `skirmish_player_capacity()` 只在 `MaxPlayers ∈ 9..=NETWORK_PLAYER_SLOT_COUNT`
 * 时才采用扩展值，且要求 `[Waypoints] 0..MaxPlayers-1` 每一个都写了非 0/-1 的坐标；
 * 否则**直接回落到 8**。所以把 30 改成 32 不会"多 2 人"，而是整张图被打回 8 人。
 */

/** 原版最多 8 个出生点（waypoints 0..7）。 */
export const MAX_PLAYERS_RETAIL = 8;

/** VERA20k 的 `[Basic] MaxPlayers` 扩展上限（= NETWORK_PLAYER_SLOT_COUNT）。 */
export const MAX_PLAYERS_VERA20K = 30;

/** VERA20k `[Map] Size` 单边上限。 */
export const VERA20K_MAX_SIDE = 512;

/** VERA20k `[Map] Size` 宽高之和上限。 */
export const VERA20K_MAX_SPAN = 1024;

/** N/S/W/E 的出生点偏移序列长度（`PlacePlayerLocation` 只实现了 4 组）。 */
export const MAX_PLAYERS_CARDINAL = 4;

/** 给前端/验收脚本用的只读快照。 */
export const LIMITS = {
  maxPlayersRetail: MAX_PLAYERS_RETAIL,
  maxPlayersVera20k: MAX_PLAYERS_VERA20K,
  vera20kMaxSide: VERA20K_MAX_SIDE,
  vera20kMaxSpan: VERA20K_MAX_SPAN,
  maxPlayersCardinal: MAX_PLAYERS_CARDINAL,
} as const;

/** 引擎侧依据，方便在报错/文档里指路。 */
export const LIMITS_PROVENANCE = {
  maxPlayersVera20k: 'vera20k/src/skirmish_launch.rs:24 NETWORK_PLAYER_SLOT_COUNT',
  capacityFallback: 'vera20k/src/map/waypoints.rs:34-37（MaxPlayers 越界回落 8）',
} as const;
