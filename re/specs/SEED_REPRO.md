# 切片管线的随机种子（同种子 ⇒ 逐字节相同的地图）

2026-11-21 新增。适用管线：`POST /api/generate`（15×15 手工切片拼装，即 `WORKINGMAP` 那套）。
CXX 管线（`POST /api/rmg/cxx/generate` 的 `globalSeed`）原本就支持，见 `RMG_CXX_*`。

## 用法

```http
POST /api/generate
content-type: application/json

{ "width": 77, "height": 85, "theaterType": "DESERT",
  "playerLocations": { "N": 1, "S": 1 },
  "seed": 424242 }
```

* `seed` 可选，0..2147483647 的整数；越界/非整数回 `400 seed must be an integer in 0..2147483647`。
* 不给 `seed` 时由服务端现摇一个（`new Random().Seed`），并写进响应头 **`X-Map-Seed`**；
  把该值填回 `seed` 即可复现同一张图。头已加入 `Access-Control-Expose-Headers`。
* 前端「生成地图」页的基本参数区有「随机种子」输入框，留空即随机，成功后会显示上一张的 seed。

## 种子覆盖了三段随机流

| 流 | 位置 | 覆盖什么 |
|---|---|---|
| `preRng` | `packages/server/src/generator.ts` | 进 `WorkingMap` 之前的随机：`totalRandom` 的玩家位置（0..1299 分档）、随机尺寸（尺寸类别 + 区间取值）、`damagedBuilding: true` 的损坏区间 |
| `WorkingMap.Randomizer` | `WorkingMap.Initialize(width, height, config, seed)` | 切片选择/熵序放置/回溯、污迹、结构血量、小地图准备等整条生成链路 |
| `MapFile.Randomizer` | `packages/core/src/fileio.ts` | 落盘阶段的随机：`[Digest]` 的 20 个随机 nibble、`[Lighting]` 的环境光/离子光抖动。用 `(seed + 0x9e3779b9) & 0x7fffffff` 偏移，避免与前两条流耦合 |

原先这三处分别是 `Math.random()` / `new Random()`（Date.now 播种），所以之前同参数生成两张必然不同字节。

## 验收（`scripts/verify-seed.mjs`，需先起服务）

```
$env:RA2_API='http://127.0.0.1:3047'
node scripts/verify-seed.mjs
```

实测 77×85 / DESERT / 2 人：

```
1. seed=424242 连跑 3 次      -> 804520bf2a1c / 804520bf2a1c / 804520bf2a1c  identical=true
2. seed=777                   -> ce3f5b8e6bf8  differs=true
3. 不给种子（服务端给 2046359676），再拿该值重放 -> 9533fddb8261 / 9533fddb8261  replayable=true
4. totalRandom + seed=555     -> c2ae505cb158 / c2ae505cb158  identical=true
5. damagedBuilding + seed=99  -> 36e90869bf9b / 36e90869bf9b  identical=true
6. seed=1.5                   -> HTTP 400
```

## 注意

* `WorkingMap` 是静态类、生成请求已串行化，所以同一个进程内并发请求不会让随机流互相串。
* 种子只对「同一份切片素材 + 同版本代码」成立；改了 `MapUnits` 或生成逻辑，同种子也会变结果。
* `scripts/verify-seed.mjs` 是集成验收，不进 `packages/core` 的单测（它需要跑服务）。
