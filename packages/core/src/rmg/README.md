# RMG —— gamemd 精确随机地图生成管线

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

## 逆向语料（IDA，2026-09-19 本轮新增）

- `re/decomp/` —— 89 个函数的 Hex-Rays 伪代码 + 关键函数原始反汇编 + 静态数据表
  （19 行 slope 表、岸线兼容表 82A7F4/82A89C、LandType 映射）。IDA 9.4 headless
  （`idat -A -S`）批量产出，脚本 `re/decomp*.py`，数据库复用现成 `gamemd.exe.i64`。
- `re/specs/REGIONS_START_POINTS.md` —— 阶段 5-8/13 逐函数规格 + 语料矛盾裁决
  （区域洪泛实为 LIFO DFS、≤100 分支同样走 level-delta、选择器空向量语义等）。
- `re/specs/HILLS_LAT_ORE_TECH.md` —— 阶段 11-18 规格；LAT_Apply(0x5A4280) 完整算法
  已补全（语料原标缺失）；树名公式 TREE01..25（永无 TREE00）；角点引擎 19 行表结构。
- 水体管线（阶段 1/3/4）已按伪代码逐行移植为 `native.ts` + `water.ts` + `pipeline.ts`。

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
| 3 | 水体（3/4 型 → `0x0059C580`；否则 `0x0059A6C0`） | `0x0059A6C0`/`0x0059C580` | 多 | 🔶 0/1/2 形状全接；3/4 河/湖伪代码已有待接 |
| 4 | 水体终结器 | `0x0059C630` | 每底水格 1~2 | ✅ 含岸线三趟/掩码/盖章（`water.ts`） |
| 5 | 区域划分（洪泛） | `0x0058CF90` + `0x0058C800` | 1 | ✅ `regions.ts`（LIFO 洪泛 + 溶解分支） |
| 6 | 区域 BFS / 层级 | `0x0058E740` / `0x0058E9B0` / `0x0058D010` | 0 | ✅ `regions.ts`（趟数 4+(>8000)+(!mode34)） |
| 7 | 仅 3/4：台地阈值 + 分裂 | `0x0058EBC0` / `0x0058D620` | 6 类站点 | ⬜ |
| 8 | 仅 3/4：桥/连接 pass | `0x0058EF10` / `0x0058F0C0` / `0x005905D0` | 15 站点 | ⬜ |
| 9 | 仅 3/4：悬崖落差 | `0x005A19E0` | 0/1 | ⬜ |
| 10 | 仅 3/4：桥坡 / 水砖再锚定 | `0x00578E60` / `0x005A17F0` | 0 | ⬜ |
| 11 | 绿地扩散 | `0x0059B740` | 每步 1 | ✅ `green.ts` |
| 12 | 细胞属性重算 | `0x47D2B0`（迭代器 `0x578350/0x578290`） | 0 | ✅ `recalc.ts`（无 overlay 全分支 + LAT 修复 `0x47CA80`；overlay/动画/隧道待矿树阶段） |
| 13 | 起始点（循环至成功） | `0x00594B50` + `0x005A1FB0` | 2/候选 | ✅ `start.ts` + `zones.ts`（class/分区/重映射 + 配额 + 最远选择器 + 保护圈） |
| 14 | 中立科技建筑（MapType≠0） | `0x005A95B0` | 少量 | ✅ `tech.ts`（零售 6 建筑池；足迹按 1×1 锚点门 UNVERIFIED，待接 rules 足迹） |
| 15 | 矿场 | `0x005A23A0` | 每入队邻 1 | ✅ `ore.ts`（BFS 放置器 + TIBTRE 锚 + 重播种 ≤10 + 双基址矿/宝石；驱动槽位用最远点采样简化，UNVERIFIED） |
| 16 | 山丘（x87 密集） | `0x005A35F0` + 角点引擎 | 每格 2 次高斯 | ✅ `hills.ts`（种子/游走/角点引擎/收尾/2×2 清理；角点网格几何推定 UNVERIFIED） |
| 17 | LAT / 树 / 石（`Theater==0` 完整；否则只填概率） | `0x005A38C0` / `0x005A3AE0` / `0x005A4280` | 多 | ✅ `lat.ts`（贴片团块/树/岩石；树为 Terrain 对象列表待接 emit） |
| 18 | 矿场生长/扩散队列 | `0x00722D00` / `0x00722240` | 0 | ⬜ |
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

## 未认证与风险

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
