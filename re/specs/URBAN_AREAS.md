# 城区生成（Ares「Create Urban Areas」）

对齐 Ares 3.0 随机地图生成器里的 **Create Urban Areas** 复选框：在已生成的地图上随机挑点，
铺一段街道 + 放一批城区战斗建筑 / 载具 / 平民。

## 1. Ares 语义

Ares 自己**不画街道**，它只是打开引擎里原有的 `MapSeedClass::PlaceUrbanStructures` /
`PlacePavedRoads` 流程（`src/Misc/RMG.cpp` 的 `RMG_GenerateUrban` 钩子调用 `0x5A5020`），
并把名单换成 `rmgmd.ini` 的 `[Urban]` 三段。默认值：

| 段 | Ares 默认 |
| --- | --- |
| `Structures` | `CABUNK01,CABUNK02,CAARMY01,CAARMY02,CAARMY03,CAARMY04,CACHIG03,CANEWY01,CANEWY14,CANWY09,CANWY26,CANWY25,CATEXS07` |
| `Vehicles` | `TRUCKA,TRUCKB,COP,EUROC,SUVW,SUVB,FTRK,AMBU` |
| `Infantry` | `CIV1,CIV2,CIV3,CIVA,CIVB,CIVC` |

本仓库不读 `rmgmd.ini`（没有这个文件），直接用上表硬编码，见
`packages/core/src/urban/urbanAreas.ts` 的 `ARES_URBAN_STRUCTURES / _VEHICLES / _INFANTRY`。

## 2. 实现落点

| 位置 | 作用 |
| --- | --- |
| `packages/core/src/urban/urbanAreas.ts` | `generateUrbanAreas()`：挑点 → 铺街道 → 放建筑 / 载具 / 步兵 |
| `packages/server/src/generator.ts` | 步骤 **8b**（损坏建筑之后、污迹之前）调用；城区建筑不会被 `ChangeStructureHealth` 拆掉，街道也不会被污迹覆盖 |
| `packages/server/src/types.ts` | `GenerateOptions.urbanAreas?: boolean \| number` |
| `packages/web/src/pages/GeneratePage.tsx` | 「生成城区」复选框，透传 `urbanAreas` |

数量：`urbanAreas: true` 时按面积折算 `round(w*h/2500)`（夹在 1..8），传数字则以数字为准。

## 3. 道路图块（实测，不要照 theater ini 推）

`TileNum` 的真实编号规则是 **前面所有 `TilesInSet` 之和 + 局部序号**，但仓库里的
`packages/server/resources/theater/*.ini` 与 RA2 实际地图不同源：

* `temperatmd.ini` / `snowmd.ini` 算出 `Paved Roads = 293..313`，与实图一致；
* `urbannmd.ini` 算出 299..319、`desertmd.ini` 算出 272..292，与实图**不一致**。

因此下表的图块号是从 316 个手工城市块里实测反推的（按「同号图块长直线」统计）：

| theater | 东西向直段（常量 Y） | 南北向直段（常量 X） | 证据 |
| --- | --- | --- | --- |
| `TEMPERATE` | **293** | **294** | 59 个单元，293 长直线 3124 段 / 294 3119 段；minimap 色 `83,85,87` / `131,132,128` |
| `SNOW` | **293** | **294** | 与 TEMPERATE 完全同数据（snow 块是 temperate 的副本） |
| `NEWURBAN` | **293** | **294** | 53 个单元，293 有 8223 格（EW 占 66%）、294 有 8255 格（NS 占 66%），城块高度 z=4 |
| `TEMPERATE_Islands` | **293** | **294** | 31 个单元，293/294 各 3379 格 |
| `DESERT` | **265** | **266** | 80 个单元，265 长直线 7040 段 / 266 7040 段；minimap 色与 temperate 的 293/294 完全相同 |

`293 = 常量 Y` 方向、`294 = 常量 X` 方向（等距投影里分别是两条斜向）。

### 已否证的推断（别再走这两条路）

1. **overlay 不是道路**：手工城市块里的 `[OverlayPack]` 全是资源与装饰 —— `24=DUMMY15`、
   `25/26=BRIDGE1/2`、`30=GEM03`、`112=TIB08`、`168..177=岩石/VEINHOLE`、`203/204=FENCE20/21`、
   `237/238=LOBRDGB1/2`（`rulesmd.ini` 的 `[OverlayTypes]` 逐条对号）。自绘道路不能走 overlay 路线。
2. **`TileNum >> 8` 不是 tileset 索引**：五 theater 按 `20*256=5120..5375` 过滤命中 0 个图块；
   实际 TileNum 都 < ~2000，高字节只有 0..4，且存在 `-1`（无图块哨兵）。
3. **端头图块暂不可用**：`Paved Road Ends`（445..448）实测渲染中，445/446/448 正常，
   **447 渲染成纯黑块**（缺图或不是端头片）。所以当前版本不盖端头，街道两端是直段裸端。

## 4. 落位校验

一条街道 = 一格宽的直线（长度 6..10，方向随机 EW / NS）。选中一条街道后：

* 街道格必须 `IsOnMapAT`、`TileNum >= 0`、**同一 Z**、无水面；
* 水面判定用 `minimap.ini` 的 `[theater]` 配色：`b >= 78 && b - r >= 15 && b - g >= 12` 视为深蓝水
  （能区分 `65,67,88` 的水面与 `83,85,87` 的沥青）；
* 有建筑 / 单位 / 步兵 / 桥 / 神经科技建筑 → 放弃这个点；
* 离 `WaypointList` 的 Chebyshev 距离 ≤ 10 → 放弃（护住出生点）；
* 街道格上的树 / 矿石 / 污迹会被清掉（Ares 也是覆盖式铺路）。

建筑摆放：`Ares` 名单 ∩ `rulesmd.ini` 实际存在 ∩ 底座 ≤ 3x3，街道两侧各一排，
逐栋 `WorkingMap.CanPlaceStructure()` + 自己的同高 / 无水 / 不压街道校验；
写入 `Structure`（`Owner=Neutral`、`Strength=256`、`Direction=64`，与手工块一致）。

载具 / 步兵：落在街道格上，字段照手工块的写法（`State=Guard`、`Tag=None`、`Group=-1`、
`FollowerID=-1`、`AutocreateNoRecruitable=1`）。

## 5. 已知限制（v1）

* 只铺一条直线街道，不做转角 / 交叉，所以不需要 junction / corner 图块；
* 街道宽度 1 格，没有人行道 / 中隔（`Medians`、`Paved Road Ends` 未接）；
* 不读 `rmgmd.ini`，名单写死在代码里；
* Ares 已知问题同样适用：小地图预览与实图不完全一致（尤其沙漠）。

## 6. 调试

生成日志里有一行：

```
[generator] urban areas: 3 区 / 街道 22 格 / 建筑 8 / 载具 4 / 步兵 5 (尝试 32 次) 位置 ew@41,80/9 ns@74,55/9
```

`位置` 是 `方向@起点/长度`，可直接拿去 FA2 / cncmaps 里核对。全部尝试失败时会打出原因计数
（`invalid` / `offmap` / `z` / `occupied` / `water` / `waypoint` / `bounds`）。

cncmaps 真图渲染（需要本机有 RA2 游戏目录）：

```powershell
# 1) 起渲染服务（5174）
pwsh scripts/start-cncmaps-web.ps1
# 2) 起后端（3000），然后 POST /api/cncmaps-preview，body: { mapContent, name, width }
```
