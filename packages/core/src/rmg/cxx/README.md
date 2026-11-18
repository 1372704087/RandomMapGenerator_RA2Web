# rmg/cxx —— gamemd 随机地图生成器逆向管线

**目标**：按 gamemd 原生语义复刻随机地图生成（以 VERA20k `src/map/rmg/` 的逆向
实现为参照）：同参数 + 同种子 ⇒ 与 gamemd 相同的 .map。`G:\MapGenerator` 的 C++
重写版仅作历史来源，**不再作为对齐目标**（其自身有缺陷，且源码正在移植 Phobos）。

**状态（2026-10-10 深夜）**：

> **2026-11-18 基准切换 —— 验收改为 gamemd / vera20k**
>
> **2026-11-18 收网：11 场 conformance 全等。** 三处根因（按影响力排序）：
>
> 1. **掩码算错了区域** —— `carveRampAt` 曾把**低地**（被刻下去那一侧）的 id
>    传给 `rampMask`，原生 `BuildRampOrientationMask(scratch, cell,
>    regions.region, leniency)` 传的是**高地=刻坡方** id
>    （`carve_driver.rs:158`）。八位窗口全反相，分派必然走反方向形状。
>    plateau 五场（case 4/5/6/7 与 8）由此一次性归位。
> 2. **边界表用错版本** —— carve 采样的是 `CollectRegionBorderCells
>   0x005A0700`（按 scratch 线性序 `y*workSide+x` 扫），不是
>    `0x0058D410`（cell iterator 的等距序）。新增 `collectRegionBorderLinear`
>   专供 carve 路径；同一随机索引在两种顺序下对应完全不同的格子。
> 3. **盖章只写砖、不写 slope/高度** —— 原生 `stamp_iso_block` 是逐 subtile：
>   `sub_tile=index`、`level=sub.height+base-4`、`slope=sub.slope`。原
>   `placeWaterDetailTile` 写死 `slopeIndex=0` 且用 footprint z 代替 frame
>   高度，导致 14–16 格 slope 错。新增 `Rmg.tileSubtileOverrides`，生产链路
>   由 `loadTileCellAttrs` 从 TMP 帧的 `+0x28`（高度）/`+0x2A`（slope）灌入。
>
> 结果：`rmgBridgeOracle.test.ts` 11/11 逐格全等（tile/sub/level/slope/
> overlay/object、逐格区域 id、`listed`、`next_region_id`），全部升为硬断言。
> 原生逐次尝试轨迹工具：`scratch/trace_ramp_attempts.py`（挂钩
> `0x590970`/四个 carver，并 dump 刻坡前 scratch 区域表）。
>
> `MapGenerator.exe` 自身存在缺陷，不再作为对齐对象（`G:\MapGenerator` 源码
> 正在移植 Phobos，也不要动）。参考实现改为 VERA20k 的
> `src/map/rmg/phases/{carve,carve_driver,ramp,connector}.rs`，其中逐函数标了
> gamemd 原生地址（`CarveConnectorsOrBridges 0x005905D0`、
> `TryCarveConnectorAtCell 0x00590970`、`RectIsCarveable 0x00594010`）。
>
> 已按此修正：
> 1. 去掉 `rampRectClear` 的 ±2 halo 扫描 —— `RectIsCarveable` 只有四角
>    playfield + 逐格归属/空地两段。
> 2. 去掉刻后验收层（`sideHighClash` + owner 高地块计数）：exe 的拒绝全部在
>    刻前，这层是移植期自造的，曾直接导致 env3/4 取消集与参照不一致。
> 3. 四条直坡改回 gamemd 端点：每形状 2 个 0/1 jitter，fallback 用固定几何
>    且从 leniency > 0.5（第 51 次）才启用；角坡不抽数。原
>    `stripPlan/stripCorners` 的随机条带循环来自 C++ 重写版（0x14001EDDB..），
>    不属于 gamemd。
>
> 复核结论：`rampBuilder4/5/6/7` 与 20k `clear_west/east/north/south` 的 rect
> 与四个 fill 矩形逐项相同（含 half 的 `+3`/`+0` 差异、tail 的 4/3/2/1 面序）；
> 三个角坡 builder 的 rect 与端点公式也对得上。直坡拒绝条件
> （`run > length - 5`）两边本已一致。
>
> `src/test/rmgCxxParity.test.ts` 的两条 exe golden 断言已降级为 diagnostic
> （非阻断），仅保留 R250 抽数冒烟；后续门禁应改成按 20k 语义写的 spec 测试
> （拒绝不写格/不抽数、fallback 第 51 次、角坡不抽数）。

> **2026-10-10 深夜续（05CC51D7 收网轮）—— 两处反汇编实锤，exe 前两个取消逐字节复现**：
>
> 0. ⚠️⚠️ **上轮"修复 #3（rampMask 门槛）把公式修反了"**：exe carveRampAt 序言
>    0x14001E4F5-0x14001E51C 实际是 `cvtps2pd ratio; 1.0-ratio; *10.0; +5.0;
>    cvttsd2si` ⇒ **threshold = (int)((1-ratio)*10+5)**（高 ratio ⇒ 高门槛）。
>    上轮把 exe 读成 `ratio*10+5`、把漂移文本读成倒置——恰好说反，TS 从此在低
>    ratio 的 attempt 上乱过 mask、消耗 strip 抽取、整条 attempt 流与 exe 错位。
>    已改回 (1-ratio)*10+5。旁证：修复前 TS（陈旧 dist，带同款公式）首个取消
>    (84,25) 与 exe (84,24) 同区域同族、第三个取消 (126,78) 逐字节一致。
> 1. **stripCorners 的 D/2 是 C trunc 除法不是 >>1**（0x14001F660 @0x14001F723）：
>    `cdq; sub eax,edx; sar eax,1` = trunc(D/2)。D=-1 时 trunc=0 而 JS `>>1`=-1，
>    整条坡带 Y 差 1 ⇒ exe 取消 #1 (84,24)R4（印章 (83,25..28)s4 的 step1）vs
>    TS (84,25)。`half = A2/2` 同款（A2≥5 恒正无差，仍已统一成 Math.trunc）。
>    已修。**两修后 exe 取消 #1 (84,24)R4、#2 (45,68)R2 逐字节一致，#3 (126,78)R2
>    仍一致；golden 00FF01EB 3/3 PASS**。.map 差异 9304→8665。
> 2. **剩余分歧（下一层）＝静默成功/静默取消的状态差**：TS 在 (83,56)R10、
>    (105,70)R8、(80,103)R8 等处 cancel，exe 无此取消（同 attempt 同抽取流）——
>    即 exe 在这些 attempt 上要么 rampRectClear 拒、要么盖了不同的章、要么
>    countBlocks 静默取消。头号嫌疑：att=42 (44,68)/att=44 (69,53) 的
>    **builder2 n=0 成功**——RAMP-STAMP 探针已扩展 `m=<markDelta> l=<levelDelta>`
>    （实测 m=91 l=89 / m=102 l=100 的大面积矩形写入），RAMP-ACC 探针记录
>    每次 accept 判决（clash 坐标或 blocks=after/before，实测压线 1/1）。
>    下一步：逐行核对 builders 1/2/3/4/6 的 phase 1-4 矩形与 PlaceWaterDetailTile
>    调用（b5/b7 已核；b2 的 origin=to-7、block=+10 已核，段循环未核完）。
> 3. 本轮全量核对过（与 TS 一致，勿再怀疑）：stripPlan(0x14001F510) 的
>    n/off 公式与符号、mode0-3 分派门与 c/base 方向、RectHasRegionCells
>    （菱形窗、mark==regionId、count>=threshold）、位表 0x74AA8、builder7 全部
>    7 个 phase、slope/level 表 0x749F0/0x74A04/0x74A18、方向表 0x74AD0(X)/
>    0x74B00(Y)——注意 X 用 0x74B00、Y 用 0x74AD0（与 TS K_SX/K_SY 对应）、
>    sideHighClash 0x14001FE30 全函数（含 slope∈[1,10] 过滤、(SY,SX) 步进方向、
>    row-major 扫描、[rsp+18h] 递进老格指针）、restore 0x14001FCF0（marks+52B
>    cell 全还原）、countBlocks 0x14001F7D0（57×57 BFS、8 连通、touch 窗口、
>    flat=row*57+col）、快照窗 41×41 @ (x-20,y-20)。**探针盲区备忘**：
>    RAMP-STAMP 只打 slope 1..10 的格子（slope 11-16 的 phase6 格不显示但已盖章）。

> **2026-10-10 三连修复（clean-pair 锚定轮）**：
> 0. ⚠️ **基线警告**：`G:/MapGenerator_inst`（强制种子重编译版）= 漂移文本 + 分裂循环
>    补丁，**不等于原版 exe**（同种子 0x0621130B env4 实测 99,308/112,866 字节不同）。
>    上一会话的 `ab_05EED0005_diff.txt`（TS vs inst）基线无效，其"Trim 时机/418 族"
>    结论作废。**唯一可信 oracle = `G:/MapGenerator/x64/Release/MapGenerator.exe`
>    （GUI 随机种子）+ 4 个原版种子对拍**：0x05CC51D7 / 0x040E719D（env3 s0，含 exe 日志/
>    仅图）、0x0621130B（env4 s1）、0x0622396A（env3 s1）。
> 1. **sideHighClash oldC 索引**（makingSub.ts）：exe 的列循环底 `add r8,34h`
>    （0x1400200E9）每列推进一个 MapCell，旧态读 = `snapCells[row*snapW+col]`；
>    TS 原读 `snapCells[row*snapW]`（误注释为 [EXE-MATCH]）。已修。
> 2. **rampRectClear halo 阈值**：exe（0x14002057E-0x140020690）= 第三区域格
>    `level >= owner.level + 1` 即拒；TS 原为 "Port tuning" 的 `targetLevel + 2`，
>    会把 L8 高台外圈整片误拒。已修。
> 3. ~~**rampMask 门槛公式反了（本轮最大）**：exe（0x14001E50C）=
>    `(int)(ratio*10 + 5)`~~ **【2026-10-10 深夜推翻：此条读反了！exe 实际 =
>    `(int)((1-ratio)*10+5)`（0x14001E500 subsd 1.0-ratio 在前），见本轮顶部
>    第 0 条；`ratio*10+5` 才是错的，已改回】**；TS/漂移文本 = `(15-5)*(1-ratio)+5`
>    ——完全倒置。
>    低 ratio 时 exe 只需中心 5×5 有 ~5 格，TS 却要 ~14 格 ⇒ exe 静默刻成的坡道
>    TS 全部放弃（pair 1/0 att9 c=(57,59) 实锤：exe 图有 (58,62)t31，TS 无）。
>    这就是 env3/4「整图 70% 格分歧」的源头：坡道地盘一错，悬崖盖章、LAT 四族
>    （GrassThick/GrassRough/Sand/Grass 全部位移）全错。
>    已修。修复后 05CC51D7 日志 diff 1236→1351（路径重构，取消集从 12 个散点
>    收敛到 exe 同区域的 R4/R2 族），**迭代仍在继续**（下一分叉在 att30 附近
>    的 builder7 tail/band 几何或 mask 位）。工具：`.tmp_oracle/ts_dbg*.log`
>    （RMG_DEBUG_STAMP=1 探针：RAMP-PAIR/TRY/MASK/CORNERS/STAMP）、
>    `early_att_check.cjs`（早期 attempt 带足迹对图验证）。
>    **golden 00FF01EB 三项测试全程 PASS（无回归）。**

> **2026-10-09 三轮攻坚（坡道）**：
> 1. 独立模拟器证明填洼/reseed 100% 精确（fill_sim2.js 118/118）——分歧唯一剩余点 = 坡道雕刻内部。
> 2. **重编译 C++ 工程 + 强制种子对照**（G:/MapGenerator_inst，MSBuild 可用）实证：盘上文本在 exe 构建后被改写。
>    exe 的 CarveRampAt 四轴向条目 = 随机行数条带循环：helper 0x14001F510（消耗 2 抽：
>    n = clamp(trunc(next·K_UNIT_SCALE·4), 0, 3)，off = clamp(-n - trunc((2n+1)·(-K_UNIT_SCALE)), -n, n)，
>    数学上 off 恒 = -n）→ 每行 helper 0x14001F660（消耗 1 抽掷币，行角 from/to = (base±di/bx, C∓D/2) 的打包坐标）
>    → 每行独立调 builder + acceptBuilder（首个非零即胜）。盘上文本 = 单次固定条带 + 2 次 DrawZeroOrOne，是构建后的改写。
> 3. TS 已按反汇编实现循环（msvcSort 同目录）：**5 个取消中 3 个已逐字节一致**（(54,70) R8 / (53,70) R4 / (55,71) R4），owner=higher 重证（RampRectClear 首格 mark 拒绝证据），snapCells 预构造修复崩溃。
> 4. 剩余 2 处 (70,39)/(105,94) R10 的 clash 点 Y 差 +1：**builder5 的坡带盖章几何漂移**——exe 用寄存器链式几何（X_i = prevY + bias + toX + 3；Y_i = belowZero - i + (prevY>0 ? rowCounter : prevY) + toY；每行只有首格落在图内），且 Y 基址读的是调用方帧的陈旧栈槽（[rsp+0xC2/0xCA]，值=调用时 rbx/rdi 的高 16 位，实际恒 0）。
>    斜坡族表已从 exe .rdata 提取验证一致（kSx/kSy/坡带 [10,14,14,14,6]）。
>    ✅ **链式坡带已实现**：5 个取消 5/5 逐字节一致；builder5 坡带 = 链式 X（ecx 接前一格 Y）+ toY-1 基 Y。
>    ↓ **最终剩余（唯一分歧）**：isCliffWallRiding 方向扫描——
>    悬崖盖章账本与 CLIFF-TRIM 全一致后，exe 的 CliffPieceHitsRamp 先在
>    (57,88) 检出 riding（faceDir=3=SE），TS 先在 (56,88) 检出（faceDir=5=SW）。
>    exe 的 IsCliffWallRiding @0x140021054 起 587 行（8 方向低坡扫描），
>    与 river.ts isCliffWallRiding 的方向序/低坡判定有差异。逐行比对该函数
>    = env3/4 完全收网的最后一步。（其后 CliffPieceHitsRamp @0x140013960
>    的位掩码遍历与 TS 一致。）
> 6. **kCliffFootprints 已替换为 exe .rdata 提取表**（0x14005E8A8，40B/槽：w/h/mask u64/z[16]，
>    TS 槽 N = exe 槽 N+1 的 +1 移位关系；文本表首条目错误导致整体错位）。替换后 RAMP 取消 5/5 保持，
>    全日志 diff 收敛到 **85 行**（起点 11,948）。
> 7. **最后 85 行的根因**：exe 的 RIDING 调用在放置遍历中**跨片交错**（piece A 格、piece B 格、
>    piece A 格…）——其 CliffPieceHitsRamp 调用点（0x140026D5E）在 PlaceCliffs 的逐格行走内，
>    而 TS 是逐片预检。下一轮：重排 TS 的 placeCliffPiece/预检为 exe 的行走内调用序，即可收网。
> 8. **✅ 已实证：exe 的骑坡检查 = 全局菱形行走序**（RIDING 格按 x+y 分带排序与实际顺序完全吻合：
>    (31,44)=75, (59,16)=75, (60,16)=76, (31,45)=76, (61,15)=76...）——exe 是「先盖章、后统一
>    行走检查/修整」（global pass），TS 是「放置前逐片预检」（pre-check）。收网方案：把 TS 的
>    cliffPieceHitsRamp 预检从 placeCliffPiece 中移出，改为盖章后按菱形迭代器序的全局行走检查
>    （ RIDING 顺序即对齐），同时保留 TrimCliffPieceForRamp 的修整语义对齐 exe 的修整时机。
> 9. **最终根因（已切片待解码）**：exe 的 PlaceCliffPiece（0x140026C00-0x140026D70，
>    已含在 exe_disasm.txt）的槽位解析是极简二选一：
>    slot = (sil&0x0C || al&2) ? ((r14b&1) ? 1 : 38) : 1 ——只放 cliff01/cliff38；
>    而漂移文本/TS 是复杂级联（0xa0→34、0x82→39、0x0a→33、0x28→40、E空→9..16）。
>    下一轮：解码 sil/al/r14b 三个位源（在调用块上方的行走条件计算里），
>    用 exe 的 {1,38} 解析替换 TS 的级联 → RIDING 0 diff → env3/4 .map 字节一致 → 收网。
> 10. **✅ 三个位源已全部解出**（asm_pcp.txt = exe PlaceCliffPiece 完整 749 行反汇编切片）：
>    - sil = cliffMask(cell)（本格 8 向掩码，0x1400266EA 加载，全函数有效）；
>    - r14b = RandomFloatRange(0,5) 的 roll（0x1400266DF，prologue 一次）；
>    - al = 第二次 CliffMask 的结果（0x140026BAD 对某邻格再算掩码）。
>    **exe 的槽位解析树**（取代 TS 的 0xa0/0x82/0x0a/0x28 级联——那是漂移文本的）：
>    ```
>    0xa0 位 → 0x1400267EF 自己的分支（待翻译）
>    其余:   if ((ownMask & 0x1C) == 4 && (neighMask & 0x0A) != 0x0A)
>                slot = (roll % 3) + 35            // 35/36/37
>            else if ((ownMask & 0x0C) == 0 && (neighMask & 2) == 0)
>                slot = 1
>            else
>                slot = (roll & 1) ? 1 : 38        // roll 奇偶决定 1/38
>    slot ∈ {23,24,25} 时还有东邻 placeholder 检查→可能改 26（0x140026CA2-D34）。
>    ```
>    即 exe 只放 slot ∈ {1, 23-26, 34-38} 族（与 TS 的 34/39/33/40/9-16 完全不同族）。
>    **收网 = 按 asm_pcp.txt（749 行，已切片）完整重译 exe 的 PlaceCliffPiece**，
>    替换 river.ts…不、makingSub.ts 的级联 → RIDING 0 diff → .map 字节一致。

> **2026-10-09 二次复查**：
> 1. ~~PDB SHA-256 实证 exe==盘上源码~~ **已被三轮推翻**：直接反汇编证明
>    exe 的 CarveRampAt 条带循环与盘上文本不同——PDB 中的哈希命中是早期
>    编译轮次的残留。**以反汇编为准**。
> 2. **撤销了一次错误的 agent 修复**（carveRampAt 的 owner 从 higher 改回
>    region）：源码写的就是 region；exe 的取消全部 ownerL=8 可由
>    RampRectClear 的标记成员检查自然解释（owner=低地时高地格必被拒，
>    只有 region 本身是高地的对才可能刻成/取消）。
> 3. **分歧窗口收窄**：TS reseed 后区域 0 = L4（种子格 = 北尖 (74,1)，
>    level 4），而 exe 在 (54,70) 的取消 ownerL=8 ⇒ exe 的对应区域是 L8
>    ⇒ **填洼级联（cliffPass）在北侧边缘的结果不同**（与首个 RIDING 分歧
>    点 (75,9) 吻合）。cliffPass/cliffMask/CellIterator/reseed/buildRegion
>    均已逐行核对与源码一致——残余分歧必在这些函数的某种微妙语义差异
>    （如递归中间态、invalidCell 副作用、level 比较的边界），待专项。
> 4. 水利分支对本种子排除（200 次 anchor 抽样两侧同样全败、无 CABHUT）。
> **2026-10-09 复查更新**：.yrm 多人格式 bug 已修复（[Countries] 值的
> 64B→31B 双重截断 + Color 用 63B 名查段默认 Grey）——env=1 多人图已逐字节一致。
> 扩大矩阵 19 组：env≤2 全 PASS（含雪地/特大/多人/极端矿量），env=3/4 仍为坡道分歧。
> GPPS 缓冲截断已全量审计（readIntList 511 / readNameList 127 / Countries 63+31）。
> 未被任何已测种子覆盖的分支（代码已对照、无 exe 实证）：SP-TEAM 迁移、
> SHORE-CORNER-FILL、BEND-FILL、CLIFF-REPAIR/TRIM 的触发条件组合。

| 陆型 | 状态 | 说明 |
|---|---|---|
| 0 群岛 / 1 大岛屿 / 2 大岛屿群 | ✅ **逐字节一致** | 全矩阵通过（尺寸 0-3 × 人数 2-8 × 温带/雪地 × 矿量 × 时间 × 单人/多人），.map 与 exe 完全相同 |
| 3 内陆 / 4 山地 | 🟡 河路径差一步 | 全程日志对齐至**区域分裂完成**；首个分歧在 `CarveRegionRamps` 的坡道取消集（exe 5 处 vs TS 2 处，见下） |

诊断日志（`DiagLog` 1000+ 行/图）双端逐行一致（除 3 行 GBK/UTF-8 路径编码差异）。

## 模块结构（C++ 文件 → TS）

| C++ | TS |
|---|---|
| MapGen.h | types.ts + mapGen.ts（class Rmg = 全部生成器状态） |
| MapGen.cpp | mapGen.ts + mathTables.ts + r250.ts + winapi.ts + msvcSort.ts |
| MapGenFastSqrt.h / MapGenAtanTable.h | mathTables.ts（`re/cxx_port/gen_tables.mjs` 生成，勿手改） |
| MapGenRiver.cpp | river.ts |
| MapGenLake.cpp | lake.ts |
| MapGenRegion.cpp + MapGenMaking.cpp | making.ts |
| MapGenMakingSub.cpp | makingSub.ts |
| MapGenRecalc.cpp | recalc.ts |
| MapGenStartpoint.cpp | startpoint.ts（含 RollGlobalOptions / 移动区 / Load*） |
| MapGenTech.cpp | tech.ts |
| MapGenTiberium.cpp | tiberium.ts |
| MapGenHills.cpp | hills.ts |
| MapGenLAT.cpp | lat.ts |
| MapGenMapFile.cpp + Cleanup/Done/Radar | mapFile.ts |
| WinMain.cpp OnGenerate | generate.ts |

转译规则见 `PORTING.md`。要点：32 位乘法 `Math.imul`、float 存储 `Math.fround`、
`F2I64` 截断、DiagLog 逐字符一致、**C++ 原样照抄（含怪癖）**。

## 对拍工具

```bash
# exe 侧（GUI 自动化，产出 .map + rmg_diag.log，种子从日志读）
powershell -NoProfile -ExecutionPolicy Bypass -File re/oracle/run_mapgenerator.ps1 -Env 3 -TimeoutSec 600

# TS 侧（同种子复现）
node --stack-size=65536 re/cxx_port/run_ts.cjs --global-seed 0x<seed> --env 3 \
     --out .tmp_oracle/x.map --log .tmp_oracle/ts_diag.log

# 矩阵对拍（exe vs TS，逐组 byte-compare）
node re/cxx_port/compare_matrix.cjs
```

依赖：`G:/MapGenerator/x64/Release`（exe + RMGMD.INI + 剧场 INI）、
`G:/MapGenerator/相关INI`（rulesmd/artmd）、`G:/MapGenerator/Tile资源`（.tem/.sno）。
路径由 `Rmg.resourceDir`（默认 exe 目录）+ `..\..` 相对解析，与 C++ 相同。

## 回归测试

`src/test/rmgCxxParity.test.ts`：golden `.map`（97,300 B，已验证与 exe 逐字节相同）
+ golden 诊断日志（1000 行）逐字节/逐行断言；无 `G:/MapGenerator` 资源时自动 skip。

## env=3/4 剩余分歧（下一步）

- **现象**：`CarveRegionRamps` 的 `RAMP-SIDE-CANCEL` 取消集不同
  （exe: (70,39) R10 / (54,70) R8 / (53,70) R4 / (55,71) R4 / (105,94) R10；
  TS: (114,102) R4 / (115,102) R4），下游 RIDING/悬崖随之分歧。
- **已排除**：上游全对齐（RIVER/LAKE/SMOOTH/SHORE/SPLIT 数千行日志一致；
  分裂阶段 levels/cells/marks 全对齐）；CliffPass 填洼级联**没有**分歧
  （分裂的 level 日志全对 ⇒ 填洼效果一致）；CellIterator 与老 TS
  `native.ts` 真机验证版逐行一致；msvcSort 已复刻（堆 count=v 怪癖修复后
  河流成功判定对齐）。
- **已修复的关键坑**（记录防回归）：
  1. FindCandidateCenter 堆 `Push` 结尾是 `count = v32`（插入位），不是
     `++count`——river.ts 与 GrowPatch 的堆在 C++ 里是**两个不同实现**。
  2. 分裂循环 release 后 `goto LABEL_32` 回**循环头**（重测同一槽位、
     接纳下滑记录），不是 `++j`——exe 实证：src=6 分裂后扫描落在下滑的
     区域 7 并分裂它。
  3. winapi INI 懒加载（GetPrivateProfile* 按需读文件）。
  4. MSVC `std::sort`（introsort + Tukey ninther + 插入排序边界 32）需
     逐行复刻——矿柱排序 tie 顺序依赖它。
- **下一批疑点**（按可能性排序）：区域 cells 列表序（GrowRegionBody 的
  NodeHeap 键序/tie）、LinkRegionNeighbours 后 CarveRegionRamps 对
  neighbour 向量的遍历、carveRampAt 候选格的选取序。
- 调试工件：`.tmp_oracle/`（exe_env3_diag.log 基准、fill_sim.js、
  grids_tmp.txt 等）；agent 深挖记录见会话总结。
