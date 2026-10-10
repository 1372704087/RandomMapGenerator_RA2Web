# RMG —— gamemd 精确随机地图生成管线

> ⚠ **2026-10-09 起本管线已被 rmg/cxx/ 取代**：与 G:MapGenerator C++ 工程
> 逐字节对齐的新管线（env 0/1/2 全矩阵已验证与 MapGenerator.exe 输出一致）。
> 见 [cxx/README.md](./cxx/README.md)。本文件保留作历史逆向记录。


**目标判据**：同一条 `.SED`（同种子 + 同选项）⇒ 与 `gamemd.exe`（YR 1.001）生成**逐字节相同**的地图。
不是「生成一张看起来像 YR 随机图的地图」——那是项目现有的 `packages/server/src/generator.ts` 在做的事，两者是两套范式，**不要试图合并**。

| | 现有 `generator.ts` | 本模块 |
|---|---|---|
| 范式 | 把预置「地图单元」片段拼到网格上 | 从零程序化构造（水体→区域→山丘→矿场） |
| 随机源 | `Math.random()` | 私有 RNG，种子 = `MapSeed.seed`，Lag-250 XOR |
| 可复现 | 否 | 是（位精确） |
| 素材依赖 | `resources/MapUnits/<THEATER>/` | 只需 theater 的 tileset 索引与 `RMGMD.INI` |
| 与原版一致 | 风格相似 | 逐字节一致（验收标准） |

## 当前状态

已落地并**通过真机 golden 向量对拍**（`src/test/rmg.test.ts`）：

| 模块 | 内容 | 验证 |
|---|---|---|
| `x87.ts` | 53 位 + 向零截断的 mul/add/sub/div、`ftol`、表驱动近似 `sqrt`、`RANGE_K` | 16/16 Box-Muller 位精确；拒绝循环分离点断言 |
| `rng.ts` | 250 状态字的种子哈希（逐指令还原）、Lag-250 XOR 抽取、`randomRanged`、Box-Muller 高斯 | **5 种子 × 250 状态字 + 5×16 抽取全部逐位一致** |
| `options.ts` | 16 个字段 + clamp 表 + 尺寸推导（含 x87 的 float32/double 细节） | 端点值、派生几何、1.2 上限边界 |
| `sed.ts` | `.SED` `[RandomMap]` 17 键读写；Description hex-CSV UTF-16；carry-default | 键序/编码 round-trip；缺键保默认 |
| `rmgmd.ts` | `[General]` 逐键 fallback + 构造器缺省 2500/5500/500 | 无文件=缺省；零售文本=900/1050/600 |
| `cell.ts` | `RmgCell` / `RmgGrid` / `DIRECTION_OFFSETS` / 菱形带 | 方向序、带内外读写、emit 坐标 |
| `emit.ts` | grid → `MapFile`；`loadGridFromMapIni` 往返 | 既有成功图 tile/overlay 往返一致 |
| `theater.ts` | theater INI → tileset 基址族（0x545150 机制还原） | 温带实证：水 314/岸 89/绿 494，838 tiles，82 set |
| `native.ts` | 512×512 cell 表（哨兵格）+ 0x50 暂存 + 蛇形迭代器（0x578350/290 逐指令） | 迭代器覆盖序单测（含交错带） |
| `water.ts` | 阶段 3+4：水体形状 0/1/2 + blob 洪泛 + 终结器 + 岸线三趟/掩码/盖章 | 结构 + 抽数 + 确定性单测（parity 待真机 golden） |
| `pipeline.ts` | map-prep 等价（0x599650 状态部分）+ 水体驱动入口 | 同上 |

golden 向量 `src/test/fixtures/*.json` 由 `vera20k-main/tools/rmg_oracle/`（unicorn 直接跑真 `gamemd.exe`）抓取，本仓库只带**数值向量**，不携带任何游戏数据表。

### 真机 `.SED` 样本（2026-10-07 采集并入库）

游戏生成随机地图时会在**游戏目录写 `.SED`**。采自 `H:\测试\Red-Alert-2-Yuris-Revenge\`，
已固化进 `src/test/fixtures/` + `src/test/rmgRealSed.test.ts`（10 断言）：

| 样本 | MapType | Theater | Seed | 要点 |
|---|---|---|---|---|
| `randmap_maptype4_theater1.sed` | **4** | 1 | 16093 | **第一份 3/4 型真实输入**（阶段 7-10 目标） |
| `save0029_maptype1_width0.sed` | 1 | 0 | 2147 | **Width=0/Height=0** —— 覆盖非 clamp 路径 |
| `randmap_maptype4.img` | — | — | — | 25518 B 生成产物（逐字节对拍基准） |

⇒ **`sed.ts` 已对真实文件验证**（17 键、CRLF、Description hex-CSV UTF-16LE、
round-trip 稳定）。⚠ 样本只含**输入**，不含 cell 网格输出；
且 `.img` **不是自描述格式**（解析需 mix 里的 tileset），
故"活 gamemd cell 网格 golden"仍未解决。

## 逆向语料（IDA，2026-09-19 本轮新增）

- `re/decomp/` —— 89 个函数的 Hex-Rays 伪代码 + 关键函数原始反汇编 + 静态数据表
  （19 行 slope 表、岸线兼容表 82A7F4/82A89C、LandType 映射）。IDA 9.4 headless
  （`idat -A -S`）批量产出，脚本 `re/decomp*.py`，数据库复用现成 `gamemd.exe.i64`。
- `re/specs/REGIONS_START_POINTS.md` —— 阶段 5-8/13 逐函数规格 + 语料矛盾裁决
  （区域洪泛实为 LIFO DFS、≤100 分支同样走 level-delta、选择器空向量语义等）。
- `re/specs/HILLS_LAT_ORE_TECH.md` —— 阶段 11-18 规格；LAT_Apply(0x5A4280) 完整算法
  已补全（语料原标缺失）；树名公式 TREE01..25（永无 TREE00）；角点引擎 19 行表结构。
- 水体管线（阶段 1/3/4）已按伪代码逐行移植为 `native.ts` + `water.ts` + `pipeline.ts`。
- `re/specs/STAGE18_GROWTH_QUEUE.md`（2026-10-07 新增）—— 阶段 18 规格。**IDA 不可用时用自写 `re/pe_probe.py`（PE32 + capstone）定点反汇编补齐**，探针已用四项已知真值自证。纠正两处此前误读：①`722D00`/`722240` 是**同阶段并列的两条通道**（入口 `0x59939B`/`0x5993A0` 背靠背调用），不是 Init→Spread 的先后关系；②两个 callee（`sub_7228B0`/`sub_7233A0`）只做「清零 + 蛇形遍历 + 双谓词过滤 + 按 f32 优先级入堆」，**扩散主体不在其中**（7 个 call 已穷举）。

## 已验证的两条关键结论

1. **`RANGE_K = 0x3DF0000000100000` = `2^-32 + 2^-64`**，精确等于 `fl64(1/(2^32-1))`，**不等于** `1/2^32`。用后者做整数区间归约会差一个 ULP。
2. **桥砖/水砖的拒绝采样循环在真实控制字下永不触发**：常数 `n/(2^32-1)` 的最近 double 略小于精确值，`chopMul(0xFFFFFFFF, nK) < n` ⇒ `ftol` 得 `n-1`。
   移植侧若用普通 `f64`（就近舍入）算出 `6.0` 再判 `>5`，会**凭空多抽一次**，RNG 流当场错位。
   这条已写成测试固定下来（`chopMul 与就近舍入在「差一个 ULP」处分离`）。

## 可直接复用的项目资产

- `workingMap.ts` 的 tile/overlay/tileType 模型与 `fileio.ts` 的 `.map/.yrm` 输出 —— 是**产出靶子**（emit 阶段的目标），不必重写。
- `io/iniFile.ts` —— 读写 `RMGMD.INI` 与生成 `[Basic]/[Map]/[Lighting]` 段。
- `objects/*` —— 地形对象（树）、waypoint 的写出。
- `packages/server` + `packages/web` —— API 与界面骨架可直接挂新入口。

## 缺口（必须新建）

1. ~~cell 级状态层~~ → **已建** `cell.ts`（tile/level/slope/overlay + scratch 子集）。
2. ~~tileset 基址表~~ → **已建** `theater.ts`（解析 `<THEATER>MD.INI`，累加 TilesInSet；温带已实证）。19 行 slope 表数据在 `re/decomp/_data_ramp_tables.txt`，接入待阶段 16。
3. ~~`RMGMD.INI` 读取器~~ → **已建** `rmgmd.ts`。
4. **阶段函数**：3/4（MapType 0/1/2）→ **已建** `water.ts`；3/4 型河/湖（0x59D510/0x59C920 伪代码已有）与 5-19 待接（规格见 `re/specs/`）。
5. ~~`.SED` 读写~~ → **已建** `sed.ts`。
6. **活 gamemd cell 网格 golden**（S3 前置）：固定 `.SED` 导出逐格 tile/level/overlay。
7. ~~DiamondScan 精确遍历序~~ → **已解明**：蛇形反对角带（含交错带边缘格），`native.ts` 逐指令移植并有覆盖序单测。

## 阶段清单

编号即原生执行顺序（入口 `0x00598960`）。「抽数」指对 `g_MapGenRng` 的消耗，属契约的一部分。

| # | 阶段 | 原生地址 | 抽数 | 状态 |
|---|---|---|---|---|
| 0 | 播种 RNG | `0x0065C6D0` | 0 | ✅ 已实现 |
| 1 | map-prep：尺寸/INI/光照/暂存分配/waypoint700 | `0x00599650` | 1（河桥位 `rand<0.25`） | ✅ 尺寸 + cell 初态已建；光照写出待接 |
| 2 | 读 `RMGMD.INI` | `0x005981F0` | 0 | ✅ `rmgmd.ts` |
| 3 | 水体（3/4 型 → `0x0059C580`；否则 `0x0059A6C0`） | `0x0059A6C0`/`0x0059C580` | 多 | ✅ 0/1/2 形状全接；**3/4 型已接**（`waterMt34.ts`）—— ✅ 湖生长 `0x59C920` **已落水**（实测 302 格水面）；✅ 河切割 `0x59D510` **已移植**（`waterRiverCut`，2026-10-07）|
| 4 | 水体终结器 | `0x0059C630` | 每底水格 1~2 | ✅ 含岸线三趟/掩码/盖章（`water.ts`） |
| 5 | 区域划分（洪泛） | `0x0058CF90` + `0x0058C800` | 1 | ✅ `regions.ts`（LIFO 洪泛 + 溶解分支） |
| 6 | 区域 BFS / 层级 | `0x0058E740` / `0x0058E9B0` / `0x0058D010` | 0 | ✅ `regions.ts`（趟数 4+(>8000)+(!mode34)） |
| 7 | 仅 3/4：台地阈值 + 分裂 | `0x0058EBC0` / `0x0058D620` | 6 类站点 | ✅ **两者已接**（`regionPlateau.ts` + `regionSplit.ts`）。实测区域数 19 → **2467** |
| 8 | 仅 3/4：桥/连接 | `0x0058EF10`/`0x0058F0C0`/`0x0058F2C0`/`0x005905D0` | 6 类站点 | 🟡 邻区收集 + 区域配对已接（`bridge.ts`）；**连桥动作 `0x58F2C0` 未移植 ⇒ 只记账不落地** |
| 9 | 仅 3/4：悬崖落差 | `0x005A19E0` | 0/1 | ✅ `cliff.ts`（2026-10-07）。**注：在山丘之前跑，图上无崖 tile ⇒ 调整数常为 0，属正确行为** |
| 10 | 仅 3/4：桥坡 / 水砖再锚定 | `0x00578E60` / `0x005A17F0` | 0 | ✅ 两者**已接**（`bridgeRamp.ts`）。判定语义经 capstone 实测校正：`stamped` 从死路径的 0 → 全图规模 |
| 11 | 绿地扩散 | `0x0059B740` | 每步 1 | ✅ `green.ts` |
| 12 | 细胞属性重算 | `0x47D2B0`（迭代器 `0x578350/0x578290`） | 0 | ✅ `recalc.ts`（无 overlay 全分支 + LAT 修复 `0x47CA80`；overlay/动画/隧道待矿树阶段） |
| 13 | 起始点（循环至成功） | `0x00594B50` + `0x005A1FB0` | 2/候选 | ✅ `start.ts` + `zones.ts`（class/分区/重映射 + 配额 + 最远选择器 + 保护圈） |
| 14 | 中立科技建筑（MapType≠0） | `0x005A95B0` | 少量 | ✅ `tech.ts`（零售 6 建筑池；足迹按 1×1 锚点门 UNVERIFIED，待接 rules 足迹） |
| 15 | 矿场 | `0x005A23A0` | 每入队邻 1 | ✅ `ore.ts`（BFS 放置器 + TIBTRE 锚 + 重播种 ≤10 + 双基址矿/宝石；驱动槽位用最远点采样简化，UNVERIFIED） |
| 16 | 山丘（x87 密集） | `0x005A35F0` + 角点引擎 | 每格 2 次高斯 | ✅ `hills.ts`（种子/游走/角点引擎/收尾/2×2 清理；角点网格几何推定 UNVERIFIED） |
| 17 | LAT / 树 / 石（`Theater==0` 完整；否则只填概率） | `0x005A38C0` / `0x005A3AE0` / `0x005A4280` | 多 | ✅ `lat.ts`（贴片团块/树/岩石；树为 Terrain 对象列表待接 emit） |
| 18 | 矿场生长/扩散队列 | `0x00722D00` / `0x00722240` | **每 cell 1 + 0..8 次**（`0x65C780` + `0x65C7E0`） | 🟡 规格已补齐（机器码+IDA 双源）；`RmgCell` 字段已补（`cell.ts`），**算法实现待接** —— 见 `re/specs/STAGE18_GROWTH_QUEUE.md` |
| 19 | 雷达界 + 表面重建 | `0x00654490` / `0x00654650` | 0 | ➖ 运行时显示，无地图产出 —— 不移植 |

## 落地顺序建议

1. **S0（已完成）** 决定论核心：`x87` + `rng` + golden 对拍。地基不稳后面全是浪费。
2. **S1（已完成）** 选项 / clamp / 尺寸 / `RMGMD.INI` / `.SED` 读写。
3. **S2（已完成骨架）** cell 级状态层 + `emit`（→ 现有 `MapFile`），用成功图 round-trip 验证。
4. **S3** 按上表顺序接阶段，**每个阶段都在单测里断言抽数**（用 `countDraws()`）——这是发现错位最便宜的手段，远早于像素比对。
5. **S4** 先做 MapType 0/1/2 + 温带（避开 3/4 的桥/台地），跑通一条端到端。
6. **S5** 再补 3/4 与其它 theater。

## 服务器集成（2026-09-19）

- `POST /api/rmg/generate` 默认走完整管线（`mode:'full'`，可传 `'skeleton'` 回退旧 S1 骨架）；响应含 `stats`（起点/矿/树/建筑计数）与 `elapsedMs`。
- theater tileset 基址表：`packages/server/resources/theater/<NAME>MD.INI`（5 剧院已入库），由 `rmgFullService.loadTheaterTables` 解析缓存。
- 扫描界修复：带公式 x/y 最大 = W+H−1（H 可大于 W）—— 所有「2W」界在 H>W 地图上会漏格/越界（coordOfCell/zones/start/pipeline/test 五处），统一改 W+H+4。
- `[Header] NumberStartingPoints` = 玩家数（原生 map-prep 等价）。

## 修复记录（2026-09-19）

- **岸线掩码缓存污染（关键）**：原生 `0x57A0C0` 入口把全部暂存 +0x40 清 -1，移植初版漏掉 → blob 阶段的陈旧掩码让 Pass34 在内陆盖出棋盘状岸线片，陆地被切碎、起点无处放置。已修。
- **578640 参数语义**：第一矩形实参 = 内缩 4 的地图矩形（候选坐标须落在其中），非 6×6 候选框。
- **水/岸线 tile 的 land=8**（TMP terrainIndex → 不可通行）：FlatTemplateProvider 已按 theater 区分，否则起点区会包含水面。
- **Zone ref 开放问题**：原生 0x56C510 返回「全图最大区」（可能为水域），其 remap 为 1 时起点洪水门将无匹配 —— 与原生实际产出矛盾，说明 0x56CB90 的线性数组洪水语义仍有未解明处。当前按设计意图取「最大可行走（tier==1）区」。


### `0x58D620` 区域分裂：两次重写后成功（2026-10-07 capstone 实测）

**第一版失败**：产出 **31 504 个区域**（每格一个区），超时 >2 分钟。

**根因（capstone 实测发现）**：洪泛时写的是 **`+0x38`，不只是 `+0x3C`**
```asm
0x58D72F  mov [eax+edx+0x38], 0xFFFFFFFE   ; −2 = 本区域待分裂
0x58D830  mov [eax+ecx+0x3C], 0xFFFFFFFD   ; −3 = 抢占标记（种子）
0x58D920  mov [eax+edx+0x38], 0xFFFFFFFD   ; −3 = 抢占标记（**也写 +0x38**）
0x58DA5B  mov [eax+ecx+0x3C], 0xFFFFFFFD
```
建区只收 `regionId == -2`（实测 `0x58DCA8: cmp eax,-1; jge skip`），
所以**抢占过的格（−3）被排除** ⇒ 成区数 = 格数 − 抢占数。
第一版只标 `+0x38 = -2`、洪泛时只改 `patchId(+0x3C)`
⇒ 洪泛过的格**仍是 −2** ⇒ 全部建区 ⇒ 爆炸。

**第二版修正后的实测结论**：
- **没有配额除法**：capstone 扫全函数 1 249 条指令，
  `imul` 全部是 ×`0x89C2DC`（菱形索引换算），
  **无任何配额乘/除法** ⇒ 伪码里的 `cellCount/3`、`/8` 是编译器产物，
  **不是真实配额**（我第一版据此设计的 quota 逻辑本身就是错的）。
- 真实长度 **0xFAB**（伪码标注 `size=0xFAC` 吻合）；
  「扫到第一个 `ret` 得 0x28」是因为 `0x58D648` 是 `finalised != 0` 的**早退**。
- 建区段：`for (edx=…; edx>=0; edx--)` 遍历 `region.cells`，
  每格调 `cell[idx].regionId`，`>= -1` 跳过，`== -2` 则 `new Region`。

**效果**：MapType=4 样本区域数 **19 → 2467**，耗时 26 ms，邻接关系真实产出。

### 旧记录（第一版的教训，已修）

`rmg/regionSplit.ts` 有一版实现（守卫 → 标记 -2 → 抢占配额 → 优先队列洪泛 → 建区），
**但建区语义理解有误，已回退为 stub**。

实测后果：MapType=4 样本上产出 **31 504 个区域**（每格一个区），
且整条管线**超时 > 2 分钟**。原生是 **O(quota)** 个区
（`quota = cellCount/8 .. cellCount/3`，即 4 千量级而非 3 万）。

误读处：建区循环遍历「所有 `regionId == -2` 的格」，
但**被抢占的格已归入抢占者的区域**，只有剩下的才各自成区 ——
**数量由抢占配额决定，不由格数决定**。

⇒ 教训：伪码里 `for (格 of 本区域) if (未被抢) { 建区 }` 这种形态，
**必须区分「遍历对象集合」与「成区单位数」**。
看到 `operator new(0x50)` 每格调一次就该警觉 ——
原生 `0x58BF70` 是**每个新区域**调一次，不是每格。

⚠ 同时修掉一个真 bug：`regionPlateauThreshold` 原从 `cell.regionId` 读
（**NativeCell 上没这个字段** ⇒ 恒 `undefined` ⇒ `region.cells` 永不填充）。
现改从 `scratch.at(x,y).regionId` 读 —— 与 `bridge.ts` 是同一族错误。

### 阶段 10：桥坡 + 水砖再锚定（`0x578E60` / `0x5A17F0`，2026-10-07 部分接入）

新文件 `rmg/bridgeRamp.ts`。原生序（`0x598D62` 调用块）：
`0x5A19E0` → **`0x578E60`（`push -1; push ebx` ⇒ `a2 = -1`）** → **`0x5A17F0`** → 阶段 11。

#### ✅ `0x5A17F0` 水砖再锚定（语义明确，已接入）
蛇形扫全图，对每个 water tile（`tile ∈ [AA1020, AA1020+40)`）：
- 取 `+4` 方向（`v3`）与 `+2` 方向（`v4`）
- 需 `+4` 与本格**同 tile** 且 `+4.level > 本格.level`
  ⇒ 本格是从 `+4` 方向延伸出来的水砖，需重新锚定
- **按 level 在 tileset 宽高里解出模板原点**：
  `originX = v4.x − (v4.level % tilesetW)`、`originY = v4.y − (v4.level / tilesetW)`
- `sub_5A6C10(目标格regionId, -1)` = 本仓 `placeTileBlock(…, tag, levelDelta = -1)`
  —— ✅ 该函数仓里**已有**（`water.ts:848`）

#### ✅ `0x578E60` 桥坡（**已接入**，2026-10-07 capstone 实测校正）

**校正一：`0x579010`（size=0x2B3）的返回值语义**
```asm
mov  bl, 1                  ; bl = 上一次返回值，初值 1
loop:
  j = 578290();  cmp eax, ebp;  je exit
  test bl, bl;  je exit       ; ← 检查【上一次】的返回值
  call 579010(j, a2)
  mov  bl, al                 ; bl ← 本次返回值
  j = 578290();  cmp;  jne loop
```
⇒ **它返回「工作是否推进」，不是「格是否可生长」**
（末尾 `sub_5A00C0()` 的闸门：`≤0` / `==输入` / `输入==-1` ⇒ return 0）。
位掩码序列：`0xA0`(复合) `0x20` `0x02` `0x20` `0x80` `0x80` `0xE0` `0x0E` `0x83` `0x38`
⇒ 筛的是「**同 tileset 内的连通关系**」，不是具体 tile 号。

**校正二：伪码把循环控制流写反了**
伪码写 `v2 = 579010(j); if (v2 == 0) break;`，
实测是 `bl` 作**累积成功标志**（见上）⇒
只要上一格成功就继续，**首个返回 0 才终止**（且该 0 本身算一次迭代）。
我先前照伪码写 ⇒ 第 42 格即中止 ⇒ 桥坡永不生效。

**效果**：`stamped` **0 → 32 481**（不再是死路径）。

⚠ `0x579620`（盖坡本体，size=0x539）**未逐指令移植** ——
它调 9 次 `0x579B70`（= 仓里 `cellAtD` ✅）做多方向扫描，
还调 `0x598030` / `0x57B440`（未反编译）⇒ 盖坡动作以
`placeTileBlock(levelDelta = -1)` 近似。

#### 🔴 旧记录（已过时，保留作对照）
`0x578E60` 是**包装器**，伪码里只有框架：分配 80 字节网格 → `579010` 筛选
→ 重置迭代器 → `579620` 盖坡 → 清理。
真正的动作在 `sub_579010` / `sub_579620` 里，**两者未反编译**。

⚠ 本移植的第一轮近似（"全图都要可生长"）**实测会让桥坡永不生效**：
第 1 808 格遇到水就 `pass1Ok=false` ⇒ 第二轮不执行 ⇒ `stamped=0`。
根因：原生 `v2 = sub_579010(j, a2)` 是「**逐格处理并返回状态**」，
我把它简化成「返回可生长性」—— **把「返回状态」当「返回判定」是典型的过度简化**。

⇒ `runBridgeRampStage` **只调 `waterReanchor`**，桥坡不参与管线。
`bridgeRamp.ts` 保留作参考，并在文件顶部写明未接入原因。

### 阶段 9：悬崖落差（`0x5A19E0`，2026-10-07 已接）

新文件 `rmg/cliff.ts`（97 行伪码，size=0x285）。**原生序已核实**（`0x598D62` 调用块）：

```
if (mapType == 3 || mapType == 4) {
    0x58EBC0  阶段 7  台地阈值+分裂
    0x58EF10  阶段 8  桥/连接
    0x5A19E0  阶段 9  悬崖落差   ← 本阶段
    0x578E60  阶段 10 桥坡
    0x5A17F0  阶段 10 水砖再锚定
}
```

算法：蛇形扫全图，按本格 tile 分三族，调整邻格 level 并把源格 `regionId` 抄给目标格：

| 族 | 原生 tile | 本仓判据 | 条件 | 动作 | RNG |
|---|---|---|---|---|---|
| 干崖 | 131 | `theater.roughTile` | +3 同族 且 +2 可生长 | +2 格 `level −4` | 50% 跳过 |
| 水崖 | 56 | `cliffSet + 7` | +3 同族 且 +6 可生长 | +6 格 `level −4` | 50% 跳过 |
| 抬升崖 | 224 | `cliffSet + 175` | +5/+1 同族 且 本格可生长 | 本格 `level +4` | **无** |

⚠ 三个关键点：
1. **level 台阶是 ±4 不是 ±1**（原生 `*(_BYTE*)(cell+283) ±= 4`）——
   原生把「4 格」当一个 level 台阶。
2. **131/56/224 是原生硬编码**，但 56/224 是 `cliffSet` 的**族内偏移**
   （+7 / +175 = 12×14+7）⇒ 本移植按相对值算，**换 theater 仍可用**。
3. 邻域方向是**固定序号 +1/+2/+3/+5/+6**，不是"周围 8 格"。

⚠ **端到端调整数常为 0**：阶段 9 在**山丘（阶段 16）之前**，
此时图上还没有崖 tile ⇒ 无族可匹配。**这是正确行为，不是缺陷。**
要让崖落差真正生效，需确认原生是否在山丘后再跑一次
（当前只找到 `0x598D6E` 一处调用，在山丘之前）。

### 🔴 事故记录：桥坡曾把 87% 的图变成水（2026-10-07，已修 + 加分布回归测试）

`bridgeRampStamp` 曾用 `placeTileBlock`（= 原生 `0x5A6C10` 的**模板铺设**：
`cell.tile = templateIndex` 且循环 `w×h`）来实现未移植的「盖坡」：
```ts
placeTileBlock(ctx, cell.tile, x, y, tag, -1);   // ← 错：模板铺设 ≠ 改单格
```
⇒ **27 504 个水格各铺一遍水族模板**，实测（MapType=4）：
```
clear 31950 → 4238      water 115 → 28242      水占比 1.6% → 87%
```
⚠ **单测当时全绿** —— 因为断言只写 `stamped > 0`（事故时 `stamped = 28243`）。

⇒ 现在**盖坡只记账不落笔**（等 `0x579620` size=0x539 逐指令移植），
并新增**分布断言**（clear 占比 > 50%、水格 < 10%）——
分布断言比"数量 > 0"更能抓住这类事故。

**教训**：用近似 API 干真动作时，必须先确认它是「记账」还是「落笔」；
跑完立刻看**分布**，不要只看「有没有产出」。

### 对拍现状（`re/duo_compare3.js`，5 样本 + theater 族分类）
| 样本 | Level | TileIdx | SubIdx | 耗时 |
|---|---|---|---|---|
| **基线**（MT1 真机）| **13档**(0..12) | **163种** | **22种** | — |
| MT1(2p) | 4档(2..5) | 67种 | 1种 | 7.0s |
| MT4(8p) | 4档(2..5) | 35种 | 1种 | 11.6s |
| MT4(theater1) | 3档(3..5) | 35种 | 1种 | 4.6s |

基线族分布：`ramp:9339 ground:8892 clear:5783 cliff:3209 other:1937 sand:1`
—— **基线 SubIndex 22 种，我们恒 1 种** ⇒ 模板系统（`TemplateProvider`）是 Level/SubIdx 差距的根因。

⚠ `randmap_maptype4_theater1.sed` 与 `save4823_maptype4_theater1.sed`
的 **17 个字段全部相同** ⇒ 输出相同是正确行为，不是 bug。

### 🔴 `emitRmg` 重复格 bug（2026-10-08 已修，水占比 44.4% → 49.6%）

`emitRmg.ts` 曾用 `dy < 2*H` × `dx < 2*W−1` 的**双重循环**枚举，
但 `(rx,ry) = ((dx+dy)/2+1, dy−rx+W+1)` 是**多对一**映射 ——
相邻的 `(dx,dy)` 与 `(dx+1,dy−1)` 落在同一格上：
```
双循环枚举 46368  ⇒ 去重后 23184（正好 2 倍），重复 11536
```
每格 push 两遍 ⇒ `IsoTileList` 里 **7700 个格重复**，读者顺序取用时看到**错位 tile**
（水格被后面的 clear 覆盖）。

**修法**：改用权威单循环 `createEmptyMapCells(W,H)`（`cell.ts:291`，
`dy = y*2 + (x%2)`，每格只出现一次，`(2W−1)·H` 个）。

| 指标 | 修前 | 修后 | 真机 |
|---|---|---|---|
| 水格数 | 10289 | **11409** | 11463 |
| 水占比 | 44.4% | **49.6%** | 49.4% |
| **(Dx,Dy) 重复** | **7700** | **0** | 0 |
| 唯一格数 | 15484 | **23019** | 23184 |

### ⚠ 两个断言本身写错了（靠这个 bug 恰好"通过"）
1. **`IsoMapPack 格数 === (2W−1)·H`** —— 永不可能成立：菱形带角上有一批格
   原生就没分配，另有少量 `0xFFFF` 哨兵格，两者都必须跳过。
   实测 `理论 13005 − 无格 76 − 0xFFFF 29 = 12900`。
   ⇒ 改为「≤ 理论值且 ≥ 97%」+ **新增 `(Dx,Dy)` 唯一性断言**。
2. **`max(dx) ≤ 2*Width`** —— 真机也不满足（`dx 1..215` vs `2*W=198`）。
   ⇒ 改为「与基线同量级」口径。

**教训：断言失败时先独立验算真值，再决定改代码还是改断言。**
本例两次都是断言写错，但第一次若不验算就会去"修"正确的代码。

### ✅ `TemplateProvider` 子格数修正（2026-10-08，根治水量 24.7% → 44.4%）

`recalc.ts` 的 `FlatTemplateProvider.subExists` 原本写 **`subtile === 0`**，
而原生 `0x544C20 Tile_FrameValidQ`（capstone 实测）的判据是
「**模板里该子格是否存在**」：
```c
TileTemplate* tmpl = this->vtable->slot156(this);   // call [eax+0x9C]
return tmpl != null && subtile < tmpl->width*tmpl->height
    && tmpl->subtiles[subtile] != null;
```

**后果（MapType=1 / RandMap.Sed，与真机同参数）**：
```
generateWaterStage 后   water=11124 (48.2%)   ← 与真机 49.4% 吻合，水量本来是对的
runRecalcStage         water=4287  (18.6%)   ← ★ 被抹掉 6837
```
探针定位到丢失量**完美均分**：`subtile=1/2/3` **各 2279 格**、`subtile=0` **零丢失**
—— `waterFinalize` 用 `placeTileBlock` 写出的水格 `subtile = j·w+i`（≠0），
而真机实测水格 `subIndex={0,1,2,3}` 四种各占 1/4 ⇒ **模板里水 tile 有 4 个有效子格**。

**修法**（只改 `subExists`，其余方法保持扁平占位，避免连带影响）：
```
水族 waterSet..+14      → 4 子格（真机实测）
岸线片 shorePieces..+42 → 4 子格（同族连续段）
ground / ramp           → 1 子格（反推表实测全单子格）
```

**效果**：
| 指标 | 改前 | 改后 | 真机 |
|---|---|---|---|
| water 格数 | 5731 (24.7%) | **10289 (44.4%)** | 11463 (49.4%) |
| **独立水体数** | **239** | **1** | 2 |
| **最大水体** | 1548 | **6867** | 11356 |
| **water subIndex 种** | **1** | **4** ✅ | 4 |
| water tile 种 | 7 | 7 | 14 |

⚠ **blob 碎片化（239 → 1）是被这个修复顺带解决的** ——
之前查「配额 / `regionId` 阻挡 / 迭代轮数」全都不是原因（那些实验都零变化）。

新增 `test/rmgTemplateSubCells.test.ts`（5 断言），含**分布断言**
（水占比 40%~60%、subIndex ≥ 4 种）而非「数量 > 0」
—— 按桥坡那次事故的教训（87% 变水时 `stamped > 0` 依然通过）。

⚠ 崖族/岸线片子格数仍是**近似下界**，取真值需解 MIX 加密的 `.TEM`
或 unicorn dump 运行时 Tile 对象图。

### 🔴 模板盖章写入的是 **tile 号**，不是 tileset 基址（2026-10-08 已修）

**根因**：旧注释断言「模板实参是 tile 序号，写入值 = 该 tile 所属 tileset 的基址」，
于是 `placeTileBlock` 与 `shoreStampTile` 都写 `ts.base`。这让**同一族内所有格
写出同一个 tile 值**（shore 恒 89、cliff 恒 49、water 恒 314）。

**伪码铁证**（`re/decomp/57B440_Shore_StampTile.c`，`0x57B440` size=0x350）：
```c
LABEL_32:
  v14[14] = *(_DWORD *)(v29 + 660);          // v29 = dword_880990 = 被选中的模板对象
  *((_BYTE *)v14 + 282) = v15;                // subtile
  *((_BYTE *)v14 + 283) = a3 + *(_BYTE *)(v16 + 40);   // level = levelBase + tmpl.subHeight
```
`+660` 存的是**模板对象自己的 tile 号**。同一字段在兼容性判定里也被当 tile 号用：
```c
v24 = *(_DWORD *)(v29 + 660) - dword_ABAD28;   // 直接减 ShorePieces 基址
if (v23 < 0 || v24 < 0 || v23 > 41 || v24 > 41 || dword_82A7F4[v23] != dword_82A7F4[v24])
```
只有「tile 号」才减得通；若 `+660` 是 tileset 基址，该减法**恒为 0**，42 项兼容表就完全用不上。

**真机双向验证**（新工具 `re/tile_hist.js` 扫真机、`re/our_hist.js` 扫我们的输出）：
| 族 | 原生公式值域 | 真机观测 | 旧口径（tileset 基址）|
|---|---|---|---|
| shore | `89+v12−1`，v12∈[1,41] ⇒ **89..129** | **89..128**（38~40 种）| 恒 **89**（1 种）|
| ramp | `29+slope−1`，slope∈[1,19] ⇒ **29..47** | **29..46** | 恒 **29**（1 种）|

修正后 shore 从 1 种变 29~40 种、与真机同量级。

### 🔴 岸线 tag 是**独立堆**，不是 `scratch.regionId`（2026-10-08 已修）

`sub_5A00C0`（查）/ `sub_5A0090`（写）操作的是 `dword_ABED10`：
```c
// 0x5A00C0 Shore_QueryTag
return *((_DWORD *)dword_ABED10 + 20 * *a1 + 20 * dword_89C2DC * a1[1] + 14);   // +56
```
而 `0x57A0C0` 入口**每次调用都重建这堆**：
```c
v3 = (char *)operator new(80 * dword_89C2DC * dword_89C2DC);
... sub_58BDC0(v6);          // 构造器把 +56（即 tag）清为 0
```
⇒ tag 初值恒为 **0**，且**与 scratch 数组毫无关系**。

本仓此前把 `scratch.regionId` 当 tag 用，而水体阶段已把它写成 **−1**
（`regionId = -1` 初始化），于是 Pass1 的中止条件
`v33 > 0 && v33 != a4 && a5 == 0`（`0x57A430`）被误判成恒真
⇒ `shoreFinalize` 在第一趟就 `return 0`，**整条盖章链全被掐断**。

**实测影响**（`re/probe_shore2.js`）：

| 基线 | 修正前 shore | 修正后 shore | 真机 |
|---|---|---|---|
| RandMap6 (MT1) | 0 | 1163 | 1356 |
| RandMap4 (MT3) | 1 | 1166 | 544 |
| RandMap5 (MT3) | 1 | 115 | 717 |

⇒ 新增 `WaterContext.shoreTags`（`Int32Array`）+ `shoreTagIndex()`，
`shoreFinalize` 入口按原生语义分配/清零。

⚠ **连带影响（已处理）**：Pass34 每格抽 1 次 rng，修正前第一趟就中止 ⇒
全图 ~2.5 万次 rng 抽取**没发生**；修正后真正跑完 ⇒ **后续所有阶段的 rng 序列全变**。
两个原本"恰好通过"的脆弱断言因此失效，已按原生契约重写（不是放宽）：
- `区域 id 唯一且从 0 递增`：区域数 **合法地** 变成 1（岸线片落盘后水区域
  从 690 涨到 1065 格，BFS 5 趟把 clear 吸收完）。原生的不变量是
  「每个已分配格都归入一个区域」+「id 连续」，已改断言后者。
- `lat 有岩石 overlay`：`placeRocks` 的 `target = U[0, limit]`，
  **`target == 0` 是合法原生结果**（limit=63 ⇒ 1/64 概率，已用编译产物打点核实）。
  改为**多子聚合断言**（6 个种子至少一个产出岩石），保留强度不靠运气。

### 🔴 `waterFinalize` 的除数是 **40**，不是 10（2026-10-08 已修）

`0x59C630` 汇编 `59C74B..59C75C`：
```asm
cmp  ecx, 0F0h
jl   loc_59C74B                     ; ecx < 240 → 走除法
mov  edi, 0F7h / sub edi, ecx      ; 否则 edi = 247 − ecx  ∈ {6,7}
loc_59C74B:
mov  eax, 66666667h
imul ecx                           ; 64 位积
sar  edx, 4                        ; >>36
mov  ecx, edx / shr ecx,1Fh / add edx, ecx   ; 符号修正
mov  edi, edx                      ; edi = floor(ecx / 40)
```
`0x66666667 / 2^36 = 0.025 = 1/40`（标准魔数除法）。旧实现写 `(v/10)|0`
⇒ 值域 [0,23] ⇒ tile **314..337**，**越出水族 14 格边界**（真机绝无 328..337）。

**真机分布逐档验证**（概率结构吻合，不只是范围吻合）：
`/40` 给出 edi∈[0,7] 共 8 档，其中 edi∈[0,5] 各约 16.5%（每档 40 个 ecx），
edi=6/7 各仅 1 个 ecx（~0.41%）⇒ **6 高 + 2 稀**。
真机 RandMap6 实测 `314..319` 各 1660~2164（高频）、`320:52 321:48`（极稀有）—— 逐档吻合。

（另一处 `0xCCCCCCCD / 2^37 = 1/40` 本来就写对了，未动。）

### 🔴 MapType 3/4 水体：四处「写错值 / 读错存储」（2026-10-08 已修）

六份真机基线（`F:\YTLauncher\RandMap1..6.{Map,Sed}`，其中 1–5 是 MT3）交叉验证出四个根因。
MT3 水量从「差 19 倍」收敛到 **RandMap5 2954 vs 真机 3024**。

#### ① `dilateRingsToWater` 漏了「区域本体落水」

旧实现只把**外扩的那一圈**写成水，`mark` 集合内部的格从未落水
⇒ `waterUsedArea = 2061` 而实际水格仅 **584**（正好是周长量级）。
`0x5A0160` 的语义是「区域本体 + 外扩 `a2` 圈」**一起**落水。

#### ② 湖心是**随机拒绝采样**，不是地图中心

`0x59C920` 采样 `u = trunc(rand×W)`、`v = trunc(rand×H)`（各拒绝上界 −1，最多 200 次），
再经菱形→笛卡尔 `x = v+u+1`、`y = W−u+v`。
该变换与本仓 `createEmptyMapCells` 的偶数格 `dx=2u, dy=2v` **逐点一致**
（`rx = (2u+2v)/2+1 = u+v+1`、`ry = 2v −(u+v+1) + W+1 = W−u+v`）。
旧实现固定取 `(W>>1)+1, H>>1` ⇒ 湖位置恒不变、且中心格从不做地形校验。

#### ③ ⚠ `rng.next()` 是**原始 uint32**，不是 0..1 浮点

`RmgRng.next()` 返回如 `3099944058`；归一化接口是 **`nextUnit()`**（`× RANGE_K = 2⁻³²`）。
`randBelow` / `randRange` 直接 `chopMul(next(), range)` ⇒ 结果 3.4e11 量级
⇒ 拒绝循环 1000 次全失败 ⇒ **恒返回 0** ⇒ 湖心/河起点永远落在 `(u,v)=(0,0)`。

#### ④ 湖生长的 σ 是 `remain/6`，不是 `remain/3`

原生 `v89 = remain/6`（σ）、`v88 = remain/3`（μ）。旧实现 σ = `remain/3` = 原生的 **2 倍**
⇒ 采样方差翻倍、湖规模失控。

#### ⑤ 河切割主循环：段推进 + 几何终止 + `v81 ≥ 40`

原生 `0x59D510`：
```
do {
   v30 = trunc(段长 + 0.5);
   以河头为中心沿朝向画 v30 格，逐格做菱形带 / blob 领地 / 地形测试；
   河头沿朝向推进 **1 格**；        ← 画 v30 推进 1 正是「河宽」的来源
   if (v81 > 5) 朝向 += 采样 ∈ ±0.314 rad;
   if (v91 > 0) 段长 += 采样 ∈ ±0.5;
   v22 = rand; ++v81;
} while (v22 >= 0.005);             ← 几何分布，期望约 200 段
if (v81 < 40) v78 = 0;              ← ★ 段数不足 40 直接判失败
```
旧实现把 `steps` 当**总步数上限**（`steps*8`，WA=76 时仅 40 步）且每段只画 1 格
⇒ 河只有 3~9 格。另有两处坐标错误：
- 起点 `(u,v)` **未做菱形→笛卡尔变换**（与 ② 同一个坑）⇒ 起点被压在 `[0,W)×[0,H)`
  矩形里，菱形带可达空间砍掉大半 ⇒ 河动辄撞界；
- 起始朝向由象限决定：`v10 = 5.497787143782138 − q·1.570796326794897`（315° − q·90°）。

#### ⑥ ⚠ blob 领地必须用 `blobOwner`，**不能**用 `patchId`

原生是**两个不同存储**：
- `+56`（本仓 `ScratchSlot.blobOwner`）= **blob 领地**，跨调用持久
  （河切割写完，随后的湖生长仍看得到，撞上即 `v76 = 0` 整体中止 ⇒ 真机大量「只有河、没有湖」）；
- `+3C`（`patchId`）= **BFS 戳**，`0x59C920` 入口每轮清零（`s.patchId = 0`）。

把领地塞进 `patchId` 会被那次清零抹成 **0**，而 `0 >= 0` 被判成「已被别的 blob 认领」
⇒ **湖洪泛第一格就中止、整张图无水**。

### 阶段 8：桥 / 连接（`0x58EF10`，2026-10-07 部分接入）

新文件 `rmg/bridge.ts` + `runBridgeStage`（仅 3/4 型）。三个函数的分工：

| 函数 | 作用 | 本仓对应 |
|---|---|---|
| `0x58EF10` | 主入口：清场 → 逐区域两轮 | `bridgeConnectPass` |
| `0x58F0C0` | 边界格取 8 邻 → 收集**邻接区域 id 列表** | `bridgeCollectNeighbors` → `RmgRegion.neighbors` |
| `0x5905D0` | 区域配对（5×5） | `bridgePair5x5` → `RmgRegion.bridges` |

**两轮分开的序不能合并**：第一轮给所有区域填 `neighbors`，
第二轮的配对要读别人刚填好的 `neighbors`。

配对门槛：`(候选数 > 1 || 格数 > 50)` 且 `merged == 0` 且两侧 `merged` 相等。

⚠ **只记账不落地** —— 原生配对成功后会调 `sub_58F2C0(A, B)` 真正写
ramp/brick tile，该函数**未移植** ⇒ `bridges` 有值但地图上不会有桥。

**✅ 上游缺口已修（2026-10-07）**：此前阶段 8 运行时区域表为空，根因有两处：

1. **`ScratchSlot.regionId` 构造默认值是 `0`，而区域代码全用 `-1` 判"未认领"**
   （`regionPartition` / `regionFallback` 的守卫 `if (slot.regionId !== -1 || …) continue`）。
   0/1/2 型由 `waterBasic` 第 4 步（`water.ts:787`）重置，
   **3/4 型不走 `waterBasic` ⇒ 整张图 regionId=0 ⇒ 全部格被跳过**。
   已在 `waterBasicMt34` 开头补同样的重置。
2. **`0x59C920` 的落水条件写错了**：原生洪泛**只标记不落水**
   （写 `cell+0x3C = blobId` 并入优先队列），
   真正落水在函数末尾的 `sub_5A0160(blobId, 1, …)` = **区域膨胀 1 圈成水**。
   且落水有门槛 `marked > 75 && marked > v85/4`。
   另：原生靠优先队列出队次序把 blob 控制在 `v85` 量级，
   本实现是 BFS，**必须加 `mark.size >= radiusI` 的规模上限**，
   否则整个菱形带（3 万+ 格）会被吃光 ⇒ 反而全图变水。

修复后实测（MapType=4, seed=16730）：**水体 302 格 ⇒ 区域表 8 个区域
⇒ 阶段 8 产出真实邻接关系**（如 `[7,1,5,4,6]`、`[0,7,3,6]`），
`TileIndex` 种类由 27 升到 **34**、范围 0..147→0..326（基线 163 种）。

⚠ 仍需注意：`generateFullMap` 的**后续阶段（起点/矿场）会重建区域表**，
实测最终只剩 1 个区域 —— 阶段 8 的成果要在 `generateThroughGreen` 层断言。

### 阶段 7：台地阈值 + 区域分裂（`0x58EBC0`，2026-10-07 部分接入）

新文件 `rmg/regionPlateau.ts`。算法（逐行对照 `58EBC0_Region_PlateauThreshold.c`）：
1. 重置各区域：`cells` 清空、`cellCount=0`、**`bbox = {9999, 9999, 0, 0}`**
   ⚠ bbox 初值是 **9999**（不是 0），之后靠 `bbox.w == 0` 判首格。
2. **倒序**遍历全图（原生从 `linear²−1` 递减）：菱形带四条不等式 →
   `++cellCount`、push `cells`、更新 bbox（四方向扩张/收缩都要**先存旧值**）。
   ⚠ 顺序影响 `region.cells` 排列，阶段 13 起点选择会读它。
3. 阈值 `trunc(v21 + v21)`，`v21 = (scale·0.005 + 0.05)·W·H`
   —— 伪码是**自己乘 2**。
4. `cellCount <= 阈值` ⇒ `finalised = 1`（标记保留）；否则调 `regionSplit`。

#### ★ 台地抬升（`0x58D620` 尾部，2026-10-09 补齐）—— Level 双峰的唯一来源

真机 MT3 的 Level 是**双峰**（RandMap1：主峰 `4` 11 603 格、次峰 `8` 9 882 格，
两群合计各约 50%），而此前本仓恒为单峰 4。空间渲染（`re/ascii_map.js`）显示
真机是**中央一大片连续高地** + 四周低地，且高地内部的 tile 构成与低地
**完全一致**（都是 `0`/`131`/ramp/绿地）⇒ 不是特殊 tile 铺出来的，
而是「同一批 tile 的 level 被整体抬高 4」。

根因在 `0x58D620` 尾部（伪码 757-843 行）：区域自带 **`+0x10` 台地高度**
（本仓 `RmgRegion.level`），分裂收尾按区域大小分两路：

```c
邻区（merged==0）高度 min=v101 / max=v102
if (v102 != v101) {                     // 邻区不等高
  if (v102-v101 == 4) cand.push(v102);
  else if (v102-v101 == 8) cand.push((v101+v102)/2);
} else {                                // 邻区全等高
  if (v101 >= 4) cand.push(v101 - 4);
  if (v102 <= 7) cand.push(v102 + 4);
}
if (mapType == 3 || mapType == 4) 删除 cand 里值为 0 的项;

if (cellCount > 100) {                  // ★ 大区域：随机择一
  pick = cand[randInt(jj)];  Δ = pick - region.level;  region.level = pick;
  for (cell : 本区域) *(_BYTE*)(cell + 283) += Δ;
} else if (最大邻区存在) {              // 小区域：跟随 cellCount 最大的邻区
  Δ = big.level - region.level;  region.level = big.level;
  for (cell : 本区域) *(_BYTE*)(cell + 283) += Δ;
  region.merged = 1;
}
```

⚠ 初值全部是 4：首次分裂时邻区等高 ⇒ 候选 = `4-4=0`（MT3/4 删掉）与
`4+4=8` ⇒ **只剩 8** ⇒ 大区域被抬到 level 8。这正解释真机的 4/8 双峰。

⚠ **抬升范围 = 被洪泛抢占的那一块（`-3`），不是整个区域**。
真机实证：RandMap1 的 level 8 群只占大区域的 ~37%（9 882/26 474），
整个区域都抬升会得到 100%。

#### ⚠ 洪泛配额：旧注释「没有配额」是错的（2026-10-09 纠正）

`0x58D620` 伪码 254-258 行：

```c
v19 = cellCount / 3;  v20 = cellCount / 8;
do { v172 = trunc(rand01 * (v19 - v20 + 1) + v20); } while (v172 > v19);
```

⇒ 配额 = `U[cellCount/8, cellCount/3]`，主循环 `if ((int)n >= v172) break;`
（伪码 314 行）。此前本仓**没有配额** ⇒ 洪泛吃光整个区域
（RandMap1：`grabbed=26463` / 仅剩 11 格），只剩一堆 1 格碎片。

同段还有两处 `rng.next()` 未归一化（返回 uint32），已改 `nextUnit()`。

#### ⚠ 建区必须做**连通块聚合**，且要同步 `cells` / `cellCount`

配额只抢走 `n/8..n/3`，剩余上万格若「每格建一区」会爆到 **22 996 个区域**。
原生靠 `regionCtor` 之后的洪泛把连通格吸进新区，本仓显式做 BFS 聚合。

⚠ `regionCtor` 给的 `cells: []` 与 `cellCount: 0` **必须**在聚合时填好：
- `cells` 空 ⇒ 下一轮分裂 `owned.length === 0` ⇒ 二次分裂直接失败（只分裂 1 轮）
- `cellCount` 为 0 ⇒ 阶段 7 阈值判定把它当小区域 `finalised = 1` ⇒ 不再分裂

**效果**（RandMap1）：Level 档数 **4 → 7**（2..9），
level 4 由 5 335 → **10 399**（真机 11 603）、level 8 出现（真机 9 882）。
MT1（RandMap6）不受影响（阶段 7 对 0/1/2 型直接 return）。

### 河切割 `0x59D510`（2026-10-07 移植，`waterRiverCut`）

依据 `re/decomp/59D510_Water_CarveRiver.c`（589 行，size=0x1122）。
算法主干：

1. 入口判定 `*(int16*)a2 == 0 && *(int16*)(a2+2) == 0`
   （`0x59C580` 每次传 `v6=0, v7=0` ⇒ 恒满足）。
2. **随机起点 + 象限**（三次拒绝采样）：`trunc(rand×W)`、`trunc(rand×H)`、`trunc(rand×4)`。
3. 菱形带校验（四条不等式）⇒ 不在带内 `return 0`。
4. **河长** `max(1, WaterAmount × 0.07)`，再拒绝采样出实际步数。
5. 河宽半径 `= steps / 2`。
6. 首步弧长偏置 `trunc(rand × 125 + 35)`。
7. **主循环 = 极坐标推进 + 8 邻微抖动**：每点经 `sub_486380` 地形测试后
   写 `cell+0x38 = blobId`（**只标记不落水**）；撞到别的 blob / 越界 / 地形不合格 ⇒ 中止。
8. **落水** `sub_5A0160(blobId, 2, …)` = 区域膨胀 2 圈成水
   （原生有三处调用：1 圈 / 6 圈 / 2 圈，本移植走 2 圈）。
9. 收尾 `this[193] += 已涂格数`。

⚠ **与湖生长共享同一机制**：洪泛只标记，落水统一由
`dilateRingsToWater`（= `0x5A0160` Region_DilateRings）完成。
所以修「洪泛别写 tile」这条规则时**两个函数都要改**。

**效果**（MapType=4, seed=16730）：水面 **302 → 517 格**、
区域 **8 → 19 个**、邻接关系大幅丰富、`TileIndex` **34 → 35 种**。

**未移植**：`sub_5A08D0`（河宽自适应）—— 调用点保留，返回 0。

### MapType 3/4 水体（2026-10-07 接入，解除阻塞项）

此前 `MapType 3/4` 直接抛错 ⇒ **手头最有价值的两份真实 `.SED`
（`RandMap.Sed` / `SAVE4823.SED`，MapType=4）根本跑不了**，是全项目的阻塞项。
现已在 `rmg/waterMt34.ts` 接入：

| 函数 | 原生 | 状态 |
|---|---|---|
| `waterDriverMt34` | `0x0059C580`（44 行薄驱动） | ✅ 完整移植 |
| `waterGrowLake` | `0x0059C920`（547 行湖生长） | ✅ 移植（拒绝采样 + 优先队列 blob 洪泛）|
| `waterRiverCut` | `0x0059D510`（河切割） | 🟡 **未反编译**，暂返回 0（湖生长照常跑）|

⚠ **3/4 型与 0/1/2 型是两条独立路径**：`0/1/2` 先把全图铺成 `waterSet` 再按形状打洞
（`waterBasic`）；`3/4` **不铺满**，在清地上生长河/湖（`waterBasicMt34`）。
混用会让整图变水 —— `rmgWaterMt34.test.ts` 有专门断言守住。

伪码索引对照（`int*` 口径）：`this+19`=WaterAmount、`+96/97`=W/H、
`+193`=已用水面积（新增 `ctx.waterUsedArea`）、`+194`=blob 计数器。
⚠ **`0x59C580` 开头有一次无条件 `++(*(this+194))`**，
之后每次成功再 `++` —— 漏掉会让 blob 标号错位、
「已属其他 blob」判定误判冲突。

## 未认证与风险

- **阶段 18 抽数（2026-10-07 两轮修正）**：最初记作「0」，**两次都错**。
  ①内层 `0x722440` 有 `call 0x65C780`（RNG next）；
  ②更深一层 `0x483780`（结算）内还有 **`sub_65C7E0`** —— 随机起始方向 + 最多 8 次
  线性试探找"可生长"邻格。**每 cell 至少 1 次 RNG**。
  ⚠ 但 unicorn 实跑裁决：**`word_89F6B8` 方向表恒为全 0**（全 `.text` 仅一处**清零**引用，
  从无填表代码）⇒ 方向偏移全为 0，**"8 次方向试探"退化为"只试原格一次"**。
  移植时按"恒等偏移 + 一次 RNG"写，**但标待真机确认**。
  另：`0x7C5F00` 是 **x87 向零截断**（`(int64)double`），**不是** ceil/round。
  同阶段的堆是 **int32 min-heap**（`fld/fcomp` 加载的是 dword 整数，
  **不是 float32**；照抄成浮点比较会在坐标 ≫ 2^24 时排错序），堆键 = `cell+0x24` 菱形坐标。
  扩散规则 = **Moore 邻域多数**：`可生长邻居==0` 停 / `==1` 只结算 / `>1` 入堆继续。
  ✅ `DIRECTION_OFFSETS` 已由 unicorn 实跑验证 **8/8 全对**（`re/oracle/dump_runtime_tables.py`）。
  ✅ 门 5 的 LandType 表基址 = **`0x89EA60`**（Hex-Rays 给的 `0x89EA90` 是错的，
  已用 `re/oracle/adjudicate_tables.py` 逐字节裁决），磁盘全 0、运行时填充，
  **仍需 theater 表标定**。详见 `re/specs/STAGE18_GROWTH_QUEUE.md` §2e–§2i。

- **`ln`（x87 `FYL2X`）**：本实现用 `Math.log`，与 unicorn 抓取的 16 个向量**逐位一致**；但 unicorn 的 FYL2X 是 QEMU 软件近似，
  真实硬件 FYL2X 的末位差需真机捕获才能排除。这是整条管线唯一未认证环节，影响所有含高斯的阶段（山丘、补丁尺寸）。
- **`sqrt`**：原生是表近似（精度约 2^-14）。表在本实现里**按公式现算**，不落盘（二进制里的表属游戏数据）。
- **add/sub 的 x87 对齐语义**：真实 x87 是先对齐到 64 位有效位再相加，本实现是精确求和后截断。RMG 的取值范围内无差异，极端指数差下可能差末位。
- **`g_DirectionOffsets 0x0089F688`** 在磁盘映像里全 0、运行时才填；实现任何邻遍历前必须按 `N,NE,E,SE,S,SW,W,NW` 次序硬编码（该次序是契约，写错方向就会错位）。
- ~~LAT 装饰 pass 完整算法缺失~~ → **2026-09-19 已补全**（IDA 反编译 0x5A4280/0x5A3AE0/0x5A45E0/0x47CA80，见 `re/specs/HILLS_LAT_ORE_TECH.md`）。
- **山丘 RNG 上游 0x5A33F0/0x5A2F50 未反编译**（水/岸种子 + 随机游走）—— 阶段 16 的最高优先缺口。
- **水模板 w/h 与逐子格 level/slope 来自 .TMP 资产**（TileSetClass+740/744/+156 表）：`water.ts` 现按平水假设（2×2、slope 0、Δlevel 0），UNVERIFIED。
- **岸线变体锚点偏移表 word_ABDB64/66**：磁盘全 0xFFFF 且全库唯一引用是读取者本身 → 运行时值即 (-1,-1)（锚=西北邻格）；盖章链上方的 `sub_4A91B0`（视图相关）按直通近似。均 UNVERIFIED，待 oracle 真机标定。
- **全流水线 parity 未认证**：目前只有 RNG 与 Box-Muller 有真机向量；地形阶段需要「活 gamemd 导出固定 `.SED` 的 cell 网格」作为 golden 才能验收。

## 逆向来源

目标二进制 `gamemd.exe` YR 1.001（4,813,072 B，MD5 `fe2301a1f48841aa084aade100b25335`）。
完整逆向规格书见会话产出 `YR_RMG_REVERSE_ENGINEERING.md`；报告语料在 `vera20k-main/docs/research/skirmish-ui/RMG_*`。
