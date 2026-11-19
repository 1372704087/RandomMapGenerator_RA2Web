# 城区生成（Ares「Create Urban Areas」，逆向 gamemd 后重做）

对齐 Ares 3.0 的 **Create Urban Areas** 复选框：在 `RmgPage`（原版随机地图生成器）的
cxx 管线里插一个阶段，按 gamemd `0x5A5020` 的处理顺序挑点 → 铺街道栅格 → 放城区建筑。

> 只挂在**原版管线**（`packages/core/src/rmg/cxx/`，vera20k 逐函数平移 gamemd）。
> 切片管线（`POST /api/generate` → `generator.ts`）没有任何城区代码。

## 1. Ares 语义与引擎函数族

Ares 自己不画街道，只是打开引擎原有的城区阶段（`0x598FB8` 那次
`recalculateCellAttributes` 之后 `CALL(0x5A5020)`），名单换成 `rmgmd.ini [Urban]` 三段。
仓库没有 `rmgmd.ini`，用 Ares 默认值硬编码：

| 段 | 名单 |
| --- | --- |
| `Structures` | `CABUNK01,CABUNK02,CAARMY01,CAARMY02,CAARMY03,CAARMY04,CACHIG03,CANEWY01,CANEWY14,CANWY09,CANWY26,CANWY25,CATEXS07` |
| `Vehicles` | `TRUCKA,TRUCKB,COP,EUROC,SUVW,SUVB,FTRK,AMBU` |
| `Infantry` | `CIV1,CIV2,CIV3,CIVA,CIVB,CIVC` |

Vehicles / Infantry 目前只是常量占位：cxx 的 `.map` 写出只有
`[IsoMapPack5]/[OverlayPack]/[OverlayDataPack]/[Structures]`，没有 `[Units]` / `[Infantry]` 段。

引擎侧（`G:\ida-yr-work\urban2.i64` 反编译，`out_urban_dec.txt` / `out_urban_calls.txt`）：

| 地址 | 作用 | 本仓库对应 |
| --- | --- | --- |
| `0x5A5020` | 城区总调度：算区数 → 挑锚点 → 定街长 → 依次调下面四个 | `addUrbanAreas` 主循环 |
| `0x5A5360` | 随机游走出脊线（8 邻域 best-first，键 `max(|dx|,|dy|) + rand*3`），收满后取包围盒，路径太瘦（`count*1.6 <= w*h`）整条作废 | 包围盒尺寸 + 「最长可通行段」剪裁 |
| `0x5A5B50` | `PlacePavedRoads`：包围盒里按 10 格间距铺横/竖街道，两端盖 `p_end` | 街道栅格 + 端头 |
| `0x5A6510` | `PlaceUrbanStructures`：沿街放建筑 | 街区里放建筑 |
| `0x5A6920` | 步兵 / 载具 | 未实现（没有 `[Units]`/`[Infantry]` 写出） |
| `0x5A6C10` | 多格图块盖章（`ecx` = 图块号，写 `cell.height = 子格序号`） | `river.ts` 的 `placeWaterDetailTile` |

## 2. 关键：街道图块是多格图块，必须逐子格盖章

这是上一版「效果太烂」的真因。`Proad01.tem` 的 TMP 头实测：

```
Proad01.tem  cellsInX=1 cellsInY=3
  cell 0: x=0    y=0  w=1852 h=952
  cell 1: x=-30  y=15 w=1852 h=952
  cell 2: x=-60  y=30 w=1852 h=952
Proad02.tem  cellsInX=3 cellsInY=1（三个子格沿 +x 偏移 +30/+15）
```

* 1852×952 像素 ≈ **30 格长的一条完整街道**（沥青 + 白边线 + 中线虚线 + 人行道），
  所以一次盖章就画一整条街，而不是一格；
* 一条街必须按 `sub_5A6C10` 逐子格写进相邻格子（`cell.height = 0/1/2`）；
  只写 `isoTileTypeIndex`、子格序号留着地形值的写法，画出来是一条细边；
* 手工城市块里可以观察到两种写法并存（`447` 端头存 `sub=0/1/2` 三格，
  而 `293` 直段常只存 `sub=0`），引擎两种都能画，但只有多格盖章能拿到完整街宽。

因此本实现统一走 `placeWaterDetailTile`（= `0x5A6C10`），并在盖章前用
`ensureRichFootprints` 把街道 / 端头 / 铺装族的 TMP 画幅灌进
`r.tileFootprintOverrides`（`findFamilyFootprint` 只给悬崖、岸边等族备了静态表）。

## 3. 图块语义（手工城市块实测反推）

图块号 = 前面所有 `TilesInSet` 之和 + 局部序号。`packages/server/resources/theater/*.ini`
与实图同源（`PavedRoads = 20`、`PavedRoadEnds = 36`、`Medians = 40`），
`cxx` 的 `loadTheaterTiles` 已经算出这些基址，直接读 `r.pavedRoadsIndex` 等字段。

| 用途 | 温带 | 说明 |
| --- | --- | --- |
| 东西向直段 | `293`（`Proad01`，1x3） | 一条街的「北侧」整条 |
| 南北向直段 | `294`（`Proad02`，3x1） | 一条街的「东侧」整条 |
| 中央带 | `479` 起（`proadc`，1x1） | `[General] Medians = 40`；填两条车行道之间 |
| 端头 | `445/446/447/448`（`p_end01..04`） | `+0` 横街远端、`+1` 竖街北端、`+2` 横街近端、`+3` 竖街南端（与 `MapGenMapFile.cpp` 桥面路段端头编号一致） |

双向各族的实测画幅：

```
TEMPERATE 车道 293/294 帧3  端头 445..448   中隔 479 帧1
SNOW      车道 293/294 帧3  端头 444..447   中隔 = 无（snowmd.ini 没有 Medians）
DESERT    车道 265/266 帧3  端头 686..689   中隔 392 帧1
URBAN     = 温带编号                        中隔 479
NEWURBAN  = 温带编号                        中隔 856
```

`MEDIAN` 缺失的 theater（SNOW）就保留原地形 —— 这时街面呈「两幅车行道 + 一格原地形」，
与手工城市块里的写法一致。

### 已否证的推断（别再走）

1. **overlay 不是道路**：手工块 `[OverlayPack]` 全是资源与装饰（`DUMMY15`、`BRIDGE1/2`、`GEM03`、
   `TIB08`、岩石/`VEINHOLE`、`FENCE20/21`、`LOBRDGB1/2`）。自绘道路不能走 overlay。
2. **`TileNum >> 8` 不是 tileset 索引**：五 theater 命中 0 个图块。
3. **`293..313` 里只有 `+0/+1` 是直段**：306 个手工块里 10723 个路面格，
   直段只命中 `P0`(293, 掩码 E|W) 与 `P1`(294, 掩码 N|S)，其余偏移一次都没用到。
4. **转角 / 交叉口不需要专门图块**：交点由 `recalc` 的 `setupLAT`
   （`clearToPaveLatIndex` 块，`paveTileIndex` + `[[miscPave,13],[medians,13],[pavedRoads,20]]`）
   自动按邻接掩码修边。

## 4. 落位与铺法

* 锚点在菱形坐标里取样：合法格满足 `mapWidth < x+y <= mapWidth+2*mapHeight` 且 `|x-y| < mapWidth`，
  按 `(s=x+y, d=|x-y|)` 取样再反解 `x/y`（同奇偶），比在大网格里随机 slot 碰运气稳得多；
* 每个城区取一个 `22..32` 格的包围盒；**城区之间强制 3 格空隙**（两套栅格叠在一起会出现 1 格宽碎路）；
* 横街从包围盒顶 +2 行开始、竖街从左 +5 列开始，步进 10 格（`0x5A5B50` 的步进）；
* 每段先算「区间内最长的可通行连续段」，段长 < 6 就整段放弃，否则铺车道 + 中隔 + 两端端头；
  等价于 `0x5A5B50` 里每段先做 `TileRectClear` 再盖；
* 每格要求：在图上、`level` 与锚点相同（不压平 —— 压平会让 FA2 打开 SNOW `043.map` 崩溃）、
  可通行、无 overlay、`isoTileTypeIndex != 0xFFFF`；
* 离出生点 Chebyshev ≤ 安全半径（默认 10）的锚点放弃；
* 建筑落在街区里（离任一条街 ≥ 4 格），逐栋走 `foundationFitsAtFlat(apron=1)`
  （同高、平坦、周边 1 格净空），写入 `structures` 表（`houseName=None House`、`facing=256`）。

数量：`urbanAreas: true` 按面积折算 `clamp(round(w*h/2500), 1, 8)`；传数字以数字为准。
（引擎的公式是 `ftol((MapSeedClass+0x60 + 0.32) * 3.0)` 与概率门 `randUnit() < 1 - field60`，
`+0x60` 字段语义未确认，所以没有硬抄。）

## 5. 前提：路面 TMP 必须齐全

`recalculateCellAttributes` 会对「TMP 表里没有这一帧」的格子直接擦成 `0xFFFF`，
所以车道 / 中隔 / 端头图块必须有对应 TMP，否则铺上去立刻被 recalc 抹掉。

五 theater 的 TMP 来源：

| theater | 目录 | 现状 |
| --- | --- | --- |
| `TEMPERATE` | `G:\MapGenerator\Tile资源\温和\` | 原版 MapGenerator 只抽了地形/建筑件，**缺 `Proad*`/`p_end*`/`proadc`**；已用 `scripts/extract-theater-tiles.mjs` 从 `isotemp.mix` 补齐 233 个 TMP |
| `SNOW` | `G:\MapGenerator\Tile资源\雪地\` | `proad01.sno`、`p_end*` 已存在 |
| `URBAN` / `DESERT` / `NEWURBAN` | `packages/server/resources/theater-tiles/<theater>/` | 由同一脚本从 theater mix 抽出 |

补齐方式（只补缺的，不覆盖已有件，幂等）：

```powershell
node scripts\extract-theater-tiles.mjs --game-dir "F:/Red-Alert-2-Yuris-Revenge" --theater temperate --merge-stock
```

## 6. 实现落点

| 位置 | 作用 |
| --- | --- |
| `packages/core/src/rmg/cxx/urban.ts` | `addUrbanAreas(rmg, {areas})`：包围盒 → 街道栅格 → 端头 → 建筑；`ensureRichFootprints`、`cellOkForRoad`、`loadCatalogs` |
| `packages/core/src/rmg/cxx/river.ts` | `placeWaterDetailTile`（`sub_5A6C10`）逐子格盖章 |
| `packages/core/src/rmg/cxx/recalc.ts` | `setupLAT` 的 pave 块负责路口 / 街沿自动修边 |
| `packages/core/src/rmg/cxx/generate.ts` | 挂钩：`0x598FB8` 之后、`0x59912A` 之前，跟一行 `scanMaxLevel('after-urban')` |
| `packages/server/src/rmgCxxService.ts` | `CxxGenerateInput.urbanAreas?: boolean \| number` |
| `packages/web/src/pages/RmgPage.tsx` | 复选框「生成城区（Ares Create Urban Areas）」 |
| `packages/web/src/api.ts` | `generateRmgCxx` 载荷类型加 `urbanAreas?` |

## 7. 调试

生成时服务端诊断行（`URBAN:`）：

```
URBAN: TEMPERATE 3 区 / 12 条街 / 街格 348 / 建筑 21 (尝试 14 次) 位置 27x24@63,58/4街 26x22@33,80/3街 25x23@81,88/5街
```

全部失败时打印原因计数（`anchor` / `offmap` / `z` / `slope` / `occupied` / `overlay` /
`unpassable` / `notile` / `startingpoint` / `overlap` / `norooms`）。

探针（`scratch/`，未跟踪）：

```powershell
node scratch\road-shapes.mjs TEMPERATE      # (偏移|邻掩码) 反推直段形状
node scratch\road-context.mjs               # 反推中隔 / 端头图块号
node scratch\tile-map.mjs                   # 图块号 → TileSet / FileName / TMP 画幅
node scratch\block-legend.mjs <map> 0 3 3 30 30   # 手工块网格 + 图块图例
node scratch\tmp-head.mjs <tmp>            # TMP 头与每个子帧的 x/y/w/h
node scratch\urban-run.mjs <theater> <seed>       # 端到端生成 + 渲染
```

渲染验收：`POST /api/cncmaps-preview { mapContent, name }`，**不传 width**（默认 1600px）。

## 8. 已知限制

* 街道是「包围盒栅格」，不是 `0x5A5360` 那条随机游走脊线本身：
  只借用它的包围盒 + `0x5A5B50` 的 10 格步进，街段不会跟着游走路径弯曲；
* 载具 / 步兵未实现（`.map` 没有 `[Units]` / `[Infantry]` 段）；
* `SNOW` 没有 `Medians`，中央带是原地形；
* `LUNAR` 没有城区素材（`PavedRoads = -1`），直接跳过。
