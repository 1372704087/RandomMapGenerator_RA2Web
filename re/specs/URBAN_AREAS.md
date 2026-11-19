# 城区生成（Ares「Create Urban Areas」，原版管线）

对齐 Ares 3.0 的 **Create Urban Areas** 复选框：在 `RmgPage`（原版随机地图生成器）的
cxx 管线里插一个阶段，挑点 → 铺一段多格宽街道 → 街道两侧放城区建筑。

> 只挂在**原版管线**（`packages/core/src/rmg/cxx/`，vera20k 逐函数平移 gamemd）。
> 切片管线（`POST /api/generate` → `generator.ts`）不再有任何城区代码。

## 1. Ares 语义

Ares 自己不画街道，只是打开引擎原有的 `MapSeedClass::PlaceUrbanStructures` /
`PlacePavedRoads`（`0x598FB8` 处 `CALL(0x5A5020)`），名单换成 `rmgmd.ini [Urban]` 三段。
仓库没有 `rmgmd.ini`，用 Ares 默认值硬编码：

| 段 | 名单 |
| --- | --- |
| `Structures` | `CABUNK01,CABUNK02,CAARMY01,CAARMY02,CAARMY03,CAARMY04,CACHIG03,CANEWY01,CANEWY14,CANWY09,CANWY26,CANWY25,CATEXS07` |
| `Vehicles` | `TRUCKA,TRUCKB,COP,EUROC,SUVW,SUVB,FTRK,AMBU` |
| `Infantry` | `CIV1,CIV2,CIV3,CIVA,CIVB,CIVC` |

Vehicles / Infantry 目前只是常量占位：cxx 的 `.map` 写出只有
`[IsoMapPack5]/[OverlayPack]/[OverlayDataPack]/[Structures]`，没有 `[Units]` / `[Infantry]` 段。

## 2. 实现落点

| 位置 | 作用 |
| --- | --- |
| `packages/core/src/rmg/cxx/urban.ts` | `addUrbanAreas(rmg, {areas})`：挑点 → 铺街道 → 放建筑；`MEDIAN_TILES`、`loadCatalogs()`、`corridorCellOk()` |
| `packages/core/src/rmg/cxx/generate.ts` | 挂钩：`recalculateCellAttributes`（`0x598FB8`）之后、`0x59912A` 之前，之后跟 `scanMaxLevel('after-urban')` |
| `packages/server/src/rmgCxxService.ts` | `CxxGenerateInput.urbanAreas?: boolean \| number` → `GenerateParams.urbanAreas` |
| `packages/web/src/pages/RmgPage.tsx` | 复选框「生成城区（Ares Create Urban Areas）」 |
| `packages/web/src/api.ts` | `generateRmgCxx` 载荷类型加 `urbanAreas?` |

数量：`urbanAreas: true` 按面积折算 `clamp(round(w*h/2500), 1, 8)`；传数字以数字为准。

## 3. 街道必须是三格宽（车道 / 中间带 / 车道）

手工城市块里没有「一格街」这种东西，全部是 **三格带**：两条车道夹一条中间带。
一格宽的直段在实图里根本不存在，所以本实现一律铺三格：

```
EW 向： (x0+i, y0-1)=车道   (x0+i, y0)=中间带   (x0+i, y0+1)=车道
NS 向： (x0-1, y0+i)=车道   (x0,   y0+i)=中间带 (x0+1, y0+i)=车道
```

| theater | 车道 EW / NS | 中间带 | 说明 |
| --- | --- | --- | --- |
| `TEMPERATE` | 293 / 294 | 原地形 | 实图中间就是 grass（`TEMPERATE/empty.map` y=9、y=11 各一排 293，y=10 是草） |
| `SNOW` | 293 / 294 | 原地形 | `snowmd.ini` `Medians = -1` |
| `NEWURBAN` | 293 / 294 | **856** | 全库中隔 856 出现 3072 次 |
| `DESERT` | 265 / 266 | **392** | 全库中隔 392 出现 4121 次；minimap 配色与 temperate 的 293/294 同族 |
| `URBAN` / `LUNAR` | 293 / 294（`LUNAR` 无城区素材） | 原地形 | — |

`TileNum` = 前面所有 `TilesInSet` 之和 + 局部序号。`packages/server/resources/theater/*.ini`
与实图不同源（`urbannmd.ini` 推 299..319、`desertmd.ini` 推 272..292 都不对），
上表图块号是从 316 个手工城市块按「同号图块长直线」实测反推的。

### 已否证的推断（别再走）

1. **overlay 不是道路**：手工块 `[OverlayPack]` 全是资源与装饰（`DUMMY15`、`BRIDGE1/2`、`GEM03`、
   `TIB08`、岩石/`VEINHOLE`、`FENCE20/21`、`LOBRDGB1/2`）。自绘道路不能走 overlay。
2. **`TileNum >> 8` 不是 tileset 索引**：五 theater 命中 0 个图块。
3. **端头片 445/446/448 可用、447 渲染成纯黑块**：当前版本不盖端头，街道两端是裸直段。

## 4. 落位校验

* 锚点在菱形坐标里取样：合法格满足 `mapWidth < x+y <= mapWidth+2*mapHeight` 且 `|x-y| < mapWidth`，
  所以按 `(s=x+y, d=|x-y|)` 取样再反解 `x/y`（同奇偶），比在大网格里随机 slot 碰运气稳得多；
* 整条街的每个格都要：在图上、`level` 与锚点相同（不用压平，压平会让 FA2 打开 SNOW `043.map` 崩溃）、
  可通行（不是水面 / 悬崖 / 已有建筑）、`isoTileTypeIndex` 不是 `0xFFFF`；
* 离出生点 Chebyshev ≤ 安全半径（默认 8）→ 放弃；
* 街道格上的 overlay（树 / 矿 / 污迹）直接清掉（Ares 也是覆盖式铺路）。

建筑：`rulesmd.ini` 里真实存在 ∩ 底座 ≤ 3x3 的名单项，街道两侧各一条带，
逐栋走 `foundationFitsAtFlat(apron=1)`（要求同高、平坦、周边 1 格净空），
写入 `structures` 表（`houseName=None House`、`facing=256`）。

## 5. 前提：路面 TMP 必须齐全

`recalculateCellAttributes` 会对「TMP 表里没有这一帧」的格子直接擦成 `0xFFFF`，
所以**车道/中间带图块必须有对应的 TMP**，否则铺上去立刻被 recalc 抹掉（表现为完全看不到街道）。

五 theater 的 TMP 来源：

| theater | 目录 | 现状 |
| --- | --- | --- |
| `TEMPERATE` | `G:\MapGenerator\Tile资源\温和\` | 原版 MapGenerator 只抽了地形/建筑件，**缺 `Proad*`/`Ovrps*`/`Medians*`**；已用 `scripts/extract-theater-tiles.mjs` 从 `isotemp.mix` 补齐 233 个 TMP（`Proad01..21.tem` 等） |
| `SNOW` | `G:\MapGenerator\Tile资源\雪地\` | `proad01.sno` 等已存在 |
| `URBAN` / `DESERT` / `NEWURBAN` | `packages/server/resources/theater-tiles/<theater>/` | 由同一脚本从 theater mix 抽出 |

补齐方式（只补缺的，不覆盖已有件）：

```powershell
node scripts\extract-theater-tiles.mjs --game-dir "F:/Red-Alert-2-Yuris-Revenge" --theater temperate --merge-stock
# -> G:\MapGenerator\Tile资源\温和   written=0 kept=494 missing=310（重复跑是幂等的）
```

补齐后用 `scratch/urban-frames-all.mjs` 复核（应看到 `laneEW/laneNS 帧3`、`median 帧1`）：

```
theater 0: laneEW=293 帧3  laneNS=294 帧3  pave=534 帧1  median=479 帧1  miscPave=449 帧1
theater 1: laneEW=293 帧3  laneNS=294 帧3  pave=734 帧0  median=-1(无)  miscPave=735 帧1
theater 3: laneEW=265 帧3  laneNS=266 帧3  pave=502 帧1  median=447 帧1  miscPave=417 帧1
theater 4: laneEW=293 帧3  laneNS=294 帧3  pave=534 帧1  median=479 帧1  miscPave=449 帧1
```

## 6. 调试

生成日志（`POST /api/rmg/cxx/generate` 时在服务端 stderr / `URBAN:` 诊断行）有一行：

```
URBAN: TEMPERATE 3 区 / 街道 48 格 / 建筑 7 (尝试 12 次) 位置 ew@55,95/10 ew@54,80/8 ns@41,72/6
```

`位置` 是 `方向@锚点/长度`（锚点指向中间带的起点）。全部失败时打印原因计数
（`anchor` / `offmap` / `bounds` / `z` / `blocked` / `notile` / `startingpoint`）。

探针：

```powershell
pnpm build:core
node scratch\urban-render.mjs 0 0x38ad52f1 scratch\cxx_urban_0.map   # 生成并落盘
# 再 POST /api/cncmaps-preview { mapContent, name }（不传 width 走默认 1600px）
```

## 7. 已知限制

* 只有直线段，没有转角 / 交叉口（不需要 junction / corner 图块）；
* 不盖端头（447 渲染黑块）；
* 载具 / 步兵未实现（`.map` 没有对应段）；
* `TEMPERATE` / `SNOW` 的中间带是原地形（与实图一致），不是铺装带。
