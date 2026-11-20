# 地图环境光照（`[Lighting]`）

2026-11-21 新增。适用管线：`POST /api/generate`（15×15 手工切片拼装）。CXX 管线原有
`timeOfDay` 0..3 四档，见 `RMG_CXX_*`。

## 环境色到底是什么

红警2/尤里复仇里，一张图的天色就是 `[Lighting]` 段里的几个小数：

| 键 | 含义 | 典型值 |
|---|---|---|
| `Ambient` | 环境光强度，越小越暗 | 0.35（夜）… 1.00（正午） |
| `Red` / `Green` / `Blue` | 三通道色调增益，1.0 = 不偏色，>1 该色更饱和、<1 更压暗 | 0.46 … 1.54 |
| `Level` | 额外亮度层级 | 0.03（原版几乎所有图） |
| `Ion*` | 离子风暴/闪电时的替代光照，地图里可省 | 可选 |

「偏暖 / 偏冷 / 偏蓝 / 深夜」全都是这三条通道 + 环境光的组合结果，不是另一套机制。

## 改造前的现状

* 切片管线只有 `DESERT` 会写 `[Lighting]`：`packages/server/src/resourceLoader.ts` 的
  `parseLightingSettings()` 从 `settings.ini` 读 10 个区间，`generator.ts` 第 14 步调
  `MapFile.RandomSetLighting()` 在区间内随机；区间值来自
  `packages/server/resources/MapUnits/DESERT/settings.ini`。
* `TEMPERATE` / `SNOW` / `NEWURBAN` / `TEMPERATE_Islands` 生成的图里**没有 `[Lighting]` 段**，
  走游戏默认天色 —— 这是原版行为（原盘 `RandomMapGenerator_RA2/MapUnits/` 下只有沙漠那份
  `settings.ini` 带光照键，`SNOW` 连 `settings.ini` 都没有），不是提取丢字段。
* 因此改造前「环境色」既不能指定，也只有沙漠一张一个样。

## 现在的入参

`POST /api/generate` 新增可选 `lighting`：

```json
{
  "width": 150, "height": 150, "theaterType": "TEMPERATE",
  "playerLocations": { "N": 2, "S": 2 },
  "seed": 2024,
  "lighting": { "mode": "preset", "hour": 18, "environment": "temperate" }
}
```

| 字段 | 取值 | 说明 |
|---|---|---|
| `mode` | `auto`（默认）/`preset`/`random`/`custom` | 见下表 |
| `hour` | 0..23，**优先于 `timeOfDay`** | 整点时刻；00:00 / 06:00 / 12:00 / 18:00 是游戏原生四组值，其余整点在其间线性插值 |
| `timeOfDay` | 0..3，默认 1 | 原生四档：0 暖光（06:00）/ 1 正午（12:00）/ 2 冷调（18:00）/ 3 夜间（00:00） |
| `environment` | `temperate`/`snow`/`desert`/`newurban`/`islands` | 省略时由 `theaterType` 推导（`TEMPERATE`→温带、`SNOW`→雪地…） |
| `jitter` | 0..0.5，默认 0.08 | 仅 `random` 模式：每个通道 ±该比例 |
| `values` | `Ambient`/`Red`/`Green`/`Blue`/`Level`/`Ion*`，0.2..1.6 | 叠加在预设基准上，只改给出的通道 |

模式：

* `auto`：保持改造前的原版行为（沙漠按 `settings.ini` 区间随机、其余不写 `[Lighting]`）；
* `preset`：按「时段 + 环境主题」写死一组真实游戏光照值 —— 所有 theater 都生效；
* `random`：合成 preset 基准后做 ±`jitter` 抖动，用 `MapFile.Randomizer` 取数，**同 seed 必然同结果**；
* `custom`：preset（或 `random`）基准 + `values` 通道覆盖，可只改 `Ambient` 或只把 `Blue` 拉高。

响应头 **`X-Map-Lighting`** 回显本次实际写进 `[Lighting]` 的 JSON 值（已加入
`Access-Control-Expose-Headers`）。`GET /api/lighting/presets` 返回完整预设表，前端用它画色卡。

## 预设表来自游戏，不是编的

温带四档取自游戏自带光照表（实测 `POST /api/rmg/cxx/generate` 的 `timeOfDay` 输出），
这四组同时是一天里的四个锚点：**t3 = 00:00、t0 = 06:00、t1 = 12:00、t2 = 18:00**。
把它们连成一条闭合曲线（18:00 之后接回 24:00 的深夜），中间整点线性插值，
就得到 24 个整点天色 —— 锚点上的值与四档预设逐位相同。

| 时段 | Ambient | Red | Green | Blue |
|---|---|---|---|---|
| 0 暖光（06:00） | 0.75 | 1.09 | 0.80 | 0.49 |
| 1 正午（12:00） | 1.00 | 1.08 | 0.94 | 0.68 |
| 2 冷调（18:00） | 0.75 | 0.71 | 0.81 | 1.19 |
| 3 夜间（00:00） | 0.35 | 0.51 | 0.46 | 1.41 |

非温带（雪地/新城区/岛屿，游戏里共用一套）：

| 时段 | Ambient | Red | Green | Blue |
|---|---|---|---|---|
| 0（06:00） | 0.75 | 1.12 | 0.80 | 1.33 |
| 1（12:00） | 1.00 | 0.99 | 1.04 | 1.07 |
| 2（18:00） | 0.75 | 1.06 | 1.07 | 1.54 |
| 3（00:00） | 0.55 | 0.76 | 0.74 | 1.18 |

沙漠在游戏光照表里**没有**对应项（原版靠 `settings.ini` 区间随机），所以预设用沙漠
`settings.ini` 中值做“正午基准色”（A 0.875 / R 0.98 / G 0.955 / B 0.955 / L 0.017），
再按温带四档的相对比例缩放，保留沙漠偏黄底色；通道夹在 0.2..1.6（否则夜间蓝通道会算出 1.98）。

温带逐 3 小时的插值结果（`GET /api/lighting/presets` 的 `hourly` 字段就是全 24 个）：

| 时刻 | Ambient | Red | Green | Blue |
|---|---|---|---|---|
| 00:00 | 0.350 | 0.510 | 0.460 | 1.410 |
| 03:00 | 0.550 | 0.800 | 0.630 | 0.950 |
| 06:00 | 0.750 | 1.090 | 0.800 | 0.490 |
| 09:00 | 0.875 | 1.085 | 0.870 | 0.585 |
| 12:00 | 1.000 | 1.080 | 0.940 | 0.680 |
| 15:00 | 0.875 | 0.895 | 0.875 | 0.935 |
| 18:00 | 0.750 | 0.710 | 0.810 | 1.190 |
| 21:00 | 0.550 | 0.610 | 0.635 | 1.300 |

## 验收

```
$env:RA2_API='http://127.0.0.1:3049'
node scripts/verify-lighting.mjs      # 35 pass / 0 fail
```

覆盖：预设表接口（含每环境 24 整点）、auto 行为（温带/雪地/新城不写光照、沙漠仍随机写）、
preset 四档逐个比对、`environment` 显式覆盖、**hour 锚点/中点校验（06:00==t0、00:00==t3、
09:00 与 21:00 为中点、23:00 走 18→24 的 5/6）**、random 同 seed 逐字节一致 + 换 seed 变色 +
抖动幅度上限、`X-Map-Lighting` 回显、custom 只改给出的通道、七种非法参数 400。

单测：`packages/core/src/test/lighting.test.ts`（30 个用例，含整点曲线的锚点一致、中点、
闭合、单调区间与越界标签）。core 全量 207 pass / 0 fail。

## 渲染实测（同一张 150×150 温带图、seed 2024、cncmaps）

四档（1200px）平均像素：

| 时段 | 平均像素 RGB | 观感 |
|---|---|---|
| t0 06:00 | 124,88,27 | 暖褐（晨昏低角度光） |
| t1 12:00 | 159,133,48 | 最亮，偏黄 |
| t2 18:00 | 82,88,61 | 冷绿偏蓝 |
| t3 00:00 | 33,28,36 | 夜间，只有矿石发亮 |

八个整点（900px）的观感链条：00:00 深蓝夜 → 03:00 微亮 → 06:00 橙褐日出 → 09:00 转暖黄
→ 12:00 最亮 → 15:00 中性偏灰 → 18:00 冷绿蓝 → 21:00 入夜转暗，
即中间时刻确实有连续过渡，不是 4 档硬跳。

## 注意

* `[Lighting]` 是整张图一个值，不分区域、不随时间流动 —— 原版引擎就这机制。
* 同 seed + 同代码 + 同素材才有相同结果；`jitter` 抖动也是随机流的一部分。
* `auto` 下沙漠的抖动与 `random` 模式用的是两条不同取数路径（前者按 `settings.ini` 区间，
  后者按预设 ±比例），数值分布不完全一样，属预期。
