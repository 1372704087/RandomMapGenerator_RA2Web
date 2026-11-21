# VERA20k / 原版 硬上限

本仓库所有"能塞多少人、能画多大图"的数字都收在 **`packages/server/src/limits.ts`** 一个文件里。
前端不再自己抄一份，而是开机向 `GET /api/limits` 拉。

| 常量 | 值 | 谁在用 | 出处 |
| --- | --- | --- | --- |
| `MAX_PLAYERS_RETAIL` | 8 | `/api/generate` 人数校验、`fileio` 的 `[Waypoints]` | 原版 `[Waypoints]` 只认 0..7（gamemd 读 8 个槽） |
| `MAX_PLAYERS_VERA20K` | 30 | VERA20k 的 `[Basic] MaxPlayers`、`CalculateStartingWaypoints` | `vera20k/src/skirmish_launch.rs:24` `NETWORK_PLAYER_SLOT_COUNT = 30` |
| `VERA20K_MAX_SIDE` | 512 | 尺寸校验、overlay 平面 | `[Map] Size` 单边上限 |
| `VERA20K_MAX_SPAN` | 1024 | 尺寸校验、overlay 平面 | `[Map] Size` 宽 + 高 ≤ 1024 |
| `MAX_PLAYERS_CARDINAL` | 4 | `playerLocations.N/S/W/E` 各自上限 | `PlacePlayerLocation` 只实现了 4 组偏移，第 5 个会被静默丢弃 |

## 30 为什么不能往上抬

`vera20k/src/map/waypoints.rs:31-40` 的 `skirmish_player_capacity()`：

```rust
// 大意
if (9..=NETWORK_PLAYER_SLOT_COUNT).contains(&max_players)
    && (0..max_players).all(|i| waypoint(i) 写了非 0 / 非 -1 的坐标)
{
    max_players as usize
} else {
    SKIRMISH_PLAYER_SLOT_COUNT // = 8
}
```

也就是说：

- `MaxPlayers` 超出 `9..=30` → **整张图被当成 8 人图**，不是"多 2 人"。
- 就算卡在 30 以内，只要 `[Waypoints] 0..29` 里有一个是 `0` 或 `-1`，同样回落 8。
  → 所以 30 人图的验收必须逐条查 waypoint 坐标，不能只看 `MaxPlayers=30`。

## 接口

`GET /api/limits` →

```json
{
  "limits": {
    "maxPlayersRetail": 8,
    "maxPlayersVera20k": 30,
    "vera20kMaxSide": 512,
    "vera20kMaxSpan": 1024,
    "maxPlayersCardinal": 4
  },
  "provenance": {
    "maxPlayersVera20k": "vera20k/src/skirmish_launch.rs:24 NETWORK_PLAYER_SLOT_COUNT",
    "capacityFallback": "vera20k/src/map/waypoints.rs:34-37（MaxPlayers 越界回落 8）"
  }
}
```

前端 `GeneratePage.tsx` 用 `FALLBACK_LIMITS` 兜底，成功拿到接口值后覆盖；拉不到（离线/老后端）就退回同一组数字，不影响可用性。

## 报错文案

越界一律 400，且说明"为什么不行"，不只说"超了"：

| 场景 | 文案 |
| --- | --- |
| 总人数 > 30（VERA20k） | `Total player count (32) must not exceed 30（VERA20k 的 NETWORK_PLAYER_SLOT_COUNT = 30，超过时引擎会把 [Basic] MaxPlayers 判无效并回落到 8 人）` |
| 总人数 > 8（原版） | `Total player count (9) must not exceed 8` |
| 正向单方向 > 4 | `VERA20k: playerLocations.N must be at most 4 (cardinal placement pattern)` |
| 尺寸越界 | `VERA20k size limit is each side <= 512 and width+height <= 1024; got 513x500` |

## 实测（3055，2026-11-21）

**30 人 500×500，seed 7**，`playerLocations = {N:4,S:4,W:4,E:4,NE:4,SE:4,NW:3,SW:3}`：

- HTTP 200，生成耗时 **1932 ms**，实际 `Width=495 Height=489`
- `[Header] NumberStartingPoints=30`，`Waypoint1..Waypoint30` 全都有值
- `[Waypoints]` 恰好 30 条，`0=487037` … `29=517952`，**全部非 0 / 非 -1**（这是不回落 8 的关键）
- `[Basic] Name=随机地图 | MaxPlayer=30 | MinPlayer=2 | MaxPlayers=30 | MinPlayers=2`
- 文件 5,567,598 字节（约 5.3 MB）
- cncmaps 1000px 预览正常出图（10.5 s）

200×200 / 30 人版本渲染图上能看到 **30 个红色出生点标记沿外圈均匀铺开**（`scratch/vera30_200.png`）。

31 人 / 32 人 → 400；N=5 → 400；513×500、512×513 → 400；原版 9 人 → 400、8 人 → 200。

验收：`node scripts/verify-limits.mjs` → **23 pass / 0 fail**（含逐条 waypoint 非 0 检查，以及"报错必须点明 30 / 回落 8"）。
