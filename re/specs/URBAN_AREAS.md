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

## 3. 图块语义（TMP 头 + theater INI）

图块号 = 前面所有 `TilesInSet` 之和 + 局部序号。`packages/server/resources/theater/*.ini`
与 TMP 头同源（`PavedRoads = 20`、`PavedRoadEnds = 36`、`Medians = 40`），
`cxx` 的 `loadTheaterTiles` 已经算出这些基址，直接读 `r.pavedRoadsIndex` 等字段。

> 这套素材是 theater 全局的，和切片管线 / `MapUnits/*/_terrain/*.map` 那批手工块没有关系：
> 手工块属于切片那套「手工单元素材」，这里只是拿成品地图核对过图块号在真实存盘里的用法，
> 不作为城区布局或街道形态的依据。

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

## 4. 落位与铺法（按 `0x5A5020` 的顺序）

一个城区 = 最多 10 轮（`cmp ebp,0xA`），每轮都是「取锚点 → 长路径 → 取包围盒 → 铺路」：

1. **取锚点**：首轮在全图空位里取城区中心（菱形坐标取样：合法格满足
   `mapWidth < x+y <= mapWidth+2*mapHeight` 且 `|x-y| < mapWidth`，按 `(s=x+y, d=|x-y|)`
   取样再反解 `x/y`，同奇偶）；后续轮在城区中心 `sizeMax*0.6` 范围内取样 ——
   这 10 轮本来就是同一个城区的重复落脚。
2. **长路径**（`0x5A5360`）：8 邻域 best-first，优先键 `max(|dx|,|dy|) + rand*3`
   （相对起点），已访问格只入堆一次；目标长度 `(2*w*h)/15` 夹进 `[100,2000]`
   （77×85 时约 872，第二轮起按 0.55 折减）。键随距离单调增长，长出来的是一团带抖动的菱形。
3. **取包围盒**：路径的 min/max，边长再夹到 `sizeMax`。
4. **瘦包围盒作废**：`path.length * 1.6 <= w*h` 时整条丢弃（引擎原条件）。
5. **铺路**（`0x5A5B50`）：横街从包围盒顶 +2 行、竖街从左 +5 列开始，步进 10 格；
   每段先算「区间内最长的可通行连续段」，段长 < 7 就整段放弃，否则铺车道 + 中隔 + 两端端头
   （等价于引擎每段先 `TileRectClear` 再盖）。同一城区内的包围盒允许重叠，
   与已有街相距 ≤ 3 格的横/竖街直接跳过，避免叠出 1 格宽碎路。
6. **跨城区**：第一个包围盒与其它城区的盒子强制 3 格空隙。

每格要求：在图上、`level` 与锚点相同（不压平 —— 压平会让 FA2 打开 SNOW `043.map` 崩溃）、
可通行、无 overlay、`isoTileTypeIndex != 0xFFFF`；离出生点 Chebyshev ≤ 安全半径（默认 10）的锚点放弃。

建筑（`0x5A6510`）按城区收尾各跑一次：名单随机取一条、用掉就删（`Block += 1` 后删表），
所以同一个名字在一个城区里最多出现一次；每条最多试 60 格，落点从该城区的包围盒里随机取，
只查「格子本身能不能盖」（`foundationFitsAtFlat(apron=1)` + 覆盖格不能是街面），
不要求「离街 ≥4 格」—— 引擎也没有这条。

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
| `packages/core/src/rmg/cxx/urban.ts` | `addUrbanAreas(rmg, {areas})`：`growPath`（`0x5A5360`）→ 包围盒 → `placeRoadGrid`（`0x5A5B50`）→ `placeStructures`（`0x5A6510`）→ `placeCrowd`（`0x5A6920`）；`ensureRichFootprints`、`cellOkForRoad`、`loadCatalogs` |
| `packages/core/src/rmg/cxx/river.ts` | `placeWaterDetailTile`（`sub_5A6C10`）逐子格盖章 |
| `packages/core/src/rmg/cxx/mapFile.ts` | `[Units]` / `[Infantry]` 两段写出（14 字段行，照成品地图） |
| `packages/core/src/rmg/cxx/types.ts` | `MapObjectRec`（coords / typeName / houseName / facing / subCell） |
| `packages/core/src/rmg/cxx/mapGen.ts` | `Rmg.units` / `Rmg.infantry` 两个账本 |
| `packages/core/src/rmg/cxx/recalc.ts` | `setupLAT` 的 pave 块负责路口 / 街沿自动修边 |
| `packages/core/src/rmg/cxx/generate.ts` | 挂钩：`0x598FB8` 之后、`0x59912A` 之前，跟一行 `scanMaxLevel('after-urban')` |
| `packages/server/src/rmgCxxService.ts` | `CxxGenerateInput.urbanAreas?: boolean \| number` |
| `packages/web/src/pages/RmgPage.tsx` | 复选框「生成城区（Ares Create Urban Areas）」 |
| `packages/web/src/api.ts` | `generateRmgCxx` 载荷类型加 `urbanAreas?` |

## 7. 调试

生成时服务端诊断行（`URBAN:`）：

```
URBAN: TEMPERATE 3 区 / 24 条街 / 街格 893 / 建筑 18 / 载具 9 / 步兵 21 (尝试 40 次) 位置 32x32@58,72/6街 ...
```

未达目标区数时打印原因计数（`anchor` / `offmap` / `z` / `slope` / `occupied` / `overlay` /
`unpassable` / `notile` / `startingpoint` / `nearanchor` / `thin` / `overlap` / `norooms` /
`path` / `emptyarea`）。

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

* 街道是包围盒栅格，不跟着 `0x5A5360` 的路径弯曲：路径只用来定包围盒（引擎也只在包围盒里铺路），
  所以同一轮里铺出来的是正交网格，不是一条蜿蜒的曲线街；
* 每轮 10 轮的上限与引擎一致，10 轮都能落脚；每轮的路径长度在第二轮起按 0.55 折减
  （引擎每轮用的是同一套 `2*w*h/15` 区间，这里为了不让 10 轮把整张图铺满做了折减）；
* 载具 / 步兵已实现：`0x5A6920` 对应 `placeCrowd`，每个城区只放 1..5 个对象、
  最多试 2n 轮；每轮在 0..6 里取号（0..2 走步兵、3..6 走载具），落点从城区包围盒里随机取，
  朝向是 `32 * rand(0..7)`（8 个方向），这正是反编译里 `place(coords, 32*v12)` 的写法；
  名单是 Ares 的 `[Urban] Vehicles` / `[Urban] Infantry` 默认值；
* `.map` 现在会写出 `[Units]` / `[Infantry]` 两段，行格式照成品地图
  （`hillbtwn.map` 的 `Neutral,CAR,256,47,100,192,Sleep,None,0,-1,0,-1,1,1`、
  `austintx.map` 的 `Neutral,COW,256,128,42,4,Guard,32,None,0,-1,0,1,1`），
  字段语义按 CNCMaps `MapFile.readUnits` / `readInfantry` 反推：
  `owner,name,health,x,y,(步兵: subCell),mission,(步兵: direction),tag,vet,...`；
* `SNOW` 没有 `Medians`，中央带是原地形；
* `LUNAR` 没有城区素材（`PavedRoads = -1`），直接跳过。


## 切片管线的分布口径（2026-11-19 实测）

拿切片管线（`WorkingMap` 的 15×15 单元 + 地标素材）在同一尺寸上跑一张作对照，
用 `scratch/slice-dist.mjs` 统计 `[Structures]` 的空间分布：

| 指标 | 切片管线（TEMPERATE 77×85） | Ares 城区（当前口径） |
| --- | --- | --- |
| 建筑数 | 25 | 24 |
| 一个建筑覆盖的面积 | 262 格 | 273 格 |
| 最近邻距离（iso 中位 / P90） | 6.7 / 15.0 格 | — |
| 单元占用 | 6×6 个 15×15 单元里 21 个带建筑 | 5 个 24×24 小街坊 |
| 建筑类型数 | 9（CAPOWR/CABUNK02/CAMACH/CASLAB/CAOILD/CATHOSP/CAAIRP/CAFRMA） | Ares 名单 13 条 |

结论：切片管线并不是「划一片大城」，而是**在整张图上均匀撒 15×15 地标**，
每个单元最多一个建筑、彼此离散。所以城区参数按它对齐：

* 片区数 `round(w*h/1200)` 夹 3..6（77×85 → 5）；
* 盒子 `18..24`，`laneCap = floor(bw/26)` → 每片只落一横一竖两条街（一个十字）；
* 街区里每块放 2..3 栋，实测 TEMPERATE 5 区 / 10 街 / 24 栋，SNOW 5 区 / 10 街 / 26 栋。

贴图方面也做了对照：把街面换成 `MiscPaveTile` 铺纯路面（`URBAN_PAVE=1` 试验开关，已删），
渲染出来只剩一条浅色土带，反而更不像街 —— 说明 `PavedRoads`（Proad01/02 的 1×3 / 3×1
深灰沥青 + 白虚线）本来就是红警温带城市的街面，观感偏「铁轨」是整图缩小时的缩小失真假象。
