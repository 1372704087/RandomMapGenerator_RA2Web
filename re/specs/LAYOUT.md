# 对局布局（symmetry / oreLayout）

对局玩法参数：把"开局长在对称位置"和"矿脉分布"做成两个可选开关。
接口在 `POST /api/generate`（不是 `/api/rmg/cxx/generate`），因为这两项都动的是
legacy C# 移植管线 `packages/core/src/workingMap.ts`。

```
POST /api/generate
{
  "width": 150, "height": 150, "theaterType": "TEMPERATE",
  "playerLocations": { "N": 1, "S": 1 }, "seed": 11,
  "symmetry": "mirror",           // none | mirror（省略 = none）
  "oreLayout": "center"           // default | center | corners（省略 = default）
}
```

响应头 `X-Map-Layout`（已加进 `Access-Control-Expose-Headers`）：

```json
{"symmetry":"mirror","oreLayout":"center","mirroredPairs":["N->S"],
 "mirroredStarts":1,"oreCells":64,"oreCellsTotal":66}
```

只要请求里出现 `symmetry` 或 `oreLayout` 就会回这个头；两个都没传时**没有该头**。

## 1. 镜像（symmetry: "mirror"）

### 1.1 为什么不做地形镜像

地形是由 `AbstractMapUnit` 模板（≈15×15 格）铺 `AbstractMapMemberMatrix` 拼出来的。
模板文件本身**只有一种朝向**，没有 180° 变体，所以"连地形一起镜像"要么给每个模板
再造一份镜像版，要么反推 tile 旋转表再重写每个模板的 `[IsoMapPack5]`——工作量和坏图
风险都远超收益。因此这里只保证**开局位置对等**：地形仍然是随机的。

### 1.2 实现：逐格点镜像（不是只对锚点）

早期版本只把"对侧锚点"设成点对称，再让对侧走自己的偏移序列。实测（2v2，seed 5）
对侧第二组出生点会漂一格对角：

```
N: (67,82) (82,67)      <- 单元 (4,5) (5,4)
S: (172,157) (157,172)  <- 期望 (157,172) (142,187)，第二个偏了 (30,-30) 格
```

原因是 `RandomSetMapUnitNoOverlap` 在目标格被占 / `IsAllOnVisibleMap=false` 时会向 8
邻域、再向地图中心漂移，对称就被破坏了。

现在的做法：

1. 第一遍只放"镜像源侧"（N / W / NW / NE），并记录每个出生点**实际落下的 abs 单元**
   （`WorkingMap.SpawnCellCapture` + `RandomSetMapUnit` 里一次 push）。
2. 第二遍对每一对（人数相等且都 > 0），把源侧每个单元做 `MirrorAbsLocation`
   = `(xLen-1-x, yLen-1-y)`，写进 `WorkingMap.PlayerSpawnCellOverrides[b]`。
3. `PlacePlayerLocation` 见到该方向的格子列表就直接落子（`RandomSetMapUnit`，不走偏移
   序列、不做就近漂移）；只有目标格非法/已占时才跳过该点。

结果：两侧出生点坐标相加恒等于 `(2W-1, 2H-1)`（cell 网格 = 2×请求边长）。
150×150 实测 `sum=(299,299)`；120×120 实测 `sum=(239,239)`。

### 1.3 配对规则

- 配对方向：`N↔S`、`W↔E`、`NW↔SE`、`NE↔SW`；**两侧人数相等且 > 0** 才配对，
  人数不等（如 N=1/S=2）时不镜像，两侧各自随机。
- `mirroredPairs` 回显实际生效的配对（ASCII 箭头，写进响应头不能用非 ASCII）；
  `mirroredStarts` 是被镜像过去的出生点数。
- 出生点附近的常规矿（`PlaceTiberiumMUNearPlayer`）是随机撒的，**不参与镜像**；
  要"矿也公平"，用下节的 `center` / `corners`，它们本身是几何对称的分布。

## 2. 矿脉（oreLayout）

### 2.1 矿石是什么

矿石 = 名字里含 `tiberium` 的地图单元模板：

```
packages/server/resources/MapUnits/<THEATER>/_tiberium/tiberium_o_AAAA_w0_0X.map
```

TEMPERATE 1 种、SNOW 1 种、NEWURBAN 6 种；**没有任何 `_g_`（宝石）模板**。
`ResourceLoader` 会把 `_territory`/`_spawn`/`_tiberium` 这类下划线子目录递归收进同一
theater，所以模板是加载进来的。

### 2.2 顺带修掉的老 bug：地图里从来没有矿

旧代码按 `tiberium1` / `tiberium2` 匹配模板名，而实际文件名是
`tiberium_o_AAAA_w0_01`，**一个都命中不了** → `PlaceTiberiumMUNearPlayer` 从来没铺过矿
（实测 `oreCellsTotal=0`）。现在三处判定统一放宽：

- `CollectTiberiumUnitNames()`：`name.includes('tiberium')`
- `PlaceTiberiumMUNearPlayer()` 的收集循环：含 `tiberium` 且不含 `_g_` → ore 组；
  含 `_g_` → gem 组（当前为空）
- `CountTiberiumCells()`：`name.includes('tiberium')`

副作用（预期内）：`default` 布局现在也会在出生点附近各撒 1 块矿（`oreCellsTotal = 出生点数`），
以前是 0。

### 2.3 三种模式

| 模式 | 位置 | 默认比例（abs 单元占比） | 150×150 实测 |
| --- | --- | --- | --- |
| `default` | 只在出生点附近 | — | 每侧 1 块，`oreCells=0` |
| `center` | 地图正中一片 | 16% | 64 块 |
| `corners` | 四个角各一小片 | 合计 6%（四等分） | 24 块（每角 6 块） |

- 邻域半径按 `(2r+1)^2 ≈ 2.5×count` 反算（`ClusterRadiusFor`），半径太小会被"可用格子"卡住
  （早期版本 center 请求 67 块只铺下 48 块就是这个原因）。
- `corners` 的锚点不是"abs 网格的角"——斜地图四个角大半是地图外的空白三角，
  所以从角点沿对角线往里走，取第一个 `IsAllOnVisibleMap && !Placed` 的格子。
- **顺序约束**：矿脉必须在铺地形之前占位（generator 步骤 4b，玩家出生点之后、
  `SetMapUnitByEntropy` 之前），否则地形会把格子填满，没有空格放矿。
- 每块矿都是 `RandomSetMapUnit(x, y, names.slice())`——该方法会 `splice` 修改入参，
  必须传新拷贝。

## 3. 参数校验（文案固定，验收脚本按串断言）

| 字段 | 合法值 | 非法时 |
| --- | --- | --- |
| `symmetry` | `"none"` / `"mirror"` | 400 `symmetry must be "none" or "mirror"` |
| `oreLayout` | `"default"` / `"center"` / `"corners"` | 400 `oreLayout must be "default", "center" or "corners"` |

## 4. 验收

```bash
RA2_API=http://127.0.0.1:3055 node scripts/verify-layout.mjs   # 21 pass / 0 fail
```

覆盖：默认无头、两条校验文案、1v1/2v2/W-E 点对称（含"人数不等不镜像"）、
default 只有出生点矿、center/corners 铺矿且 center ≥ 2×corners、同 seed 复现、头暴露。

渲染对照图（150×150，seed 11，N1/S1）：`scratch/layout_default.png` /
`layout_center.png` / `layout_corners.png` / `layout_mirror_center.png`，
生成脚本 `scratch/render_layout.mjs`。

## 5. 已知限制

- 地形不镜像（见 1.1）。
- 出生点附近的随机矿不镜像；`center` / `corners` 是几何对称的，但每块的模板与
  内部细节仍是随机的。
- TEMPERATE 只有 1 种矿模板，铺出来的矿外观会重复；`center` 大片区看起来是
  "紫色棋盘"，像素级重复感明显，后续可以考虑给同一片矿做大小/密度分层。
