# 区域划分 / 分裂 / 起始点 —— 反编译 × 语料交叉比对结论

来源：`re/decomp/`（Hex-Rays 伪代码）× `vera20k-main/docs/research/skirmish-ui/RMG_*.md`。
逆向代理 2026-09-19 全文比对产出，实现阶段 5-8/13 时以此为准。

## 公共约定

- K = 2.3283064370807974e-10 = 1/(2³²−1)。
- 菱形有效域：`x+y > ABED04 && x−y < ABED04 && y−x < ABED04 && x+y <= ABED08`。
- 暂存 stride 0x50：+0x38 region id、+0x3C BFS/分裂戳、+0x45 起始点保护、+0x4B 水/桥旗。
- Hex-Rays x87 伪影：`sub_4CAC40`(sqrt 近似)/`sub_4CADE0`(atan) 的 ST0 返回值被
  渲染成丢弃 —— 实际写回变量。逐站标注。

## 关键裁决（修正语料）

1. **58C800 / 58E9B0 都是 LIFO 栈（DFS 序）**，不是 BFS。58C800 弹栈时声明
   +0x38/+0x3C，+0x3C 在父扫描时即盖（可重复入队）；区域集合不受影响，按序重放需按栈序。
2. **「CellCount>100 才全局改 level」不成立**：≤100 合并分支同样走全图
   level-delta 通道（`CellClass+0x11B += Δ`），>100 独占的只有 RNG 候选抽取与「不合并」。
3. **594F40 空候选 + 配额>0 → 返回非 NULL 空向量**（调用方解引用空数组 → 原生崩溃路径）；
   quota==0 时公式变 NaN → ftol=INT_MIN，NULL 分支疑似死代码（疑点 d，待反汇编核实）。
4. **迭代器失败语义 = 立即停**（矛盾登记表第 5 条裁决）：返回 0 后下一条件判定即退，
   无「先用旧值再跑一轮」。
5. **0x00ABE028（起始点配额）= 常量 4**，仅两个 UI 路径写入
   （0x007A2330 无条件；0x00595FB0 条件=WDTTerritory 获取成功），生成器内部只读。
   **0x00ABE048 = MapSeed+0x70 RegionSize**（分裂阈值输入），唯一读点 0x0058EBC0。
6. **BFS 趟数 = 4 + (CellCount > 8000) + (mode34 ? 0 : 1)**，仅对水/绿类区域，
   之后无条件 58E9B0。

## 各函数规格摘要

### 58CF90 Region_Partition（无 RNG）
扫暂存：+0x38==-1 且坐标非零 且 `sub_4865D0(cell) || sub_4867B0(cell)` → `sub_58C800(cell)`。

### 58C800 FloodHelper（RNG 1 处）
LIFO 洪水；弹出 ≥75 → 建区。**溶解分支**（种子非水/绿，只可能来自 58D010 回退）：
stamp!=0 → 并入 W/N 邻区域（tile 归 0、level 归邻 level 或 dword_ABE2E4）；stamp==0 →
**RNG**（`do{r;v=ftol(r*count*K)}while(v>count-1)` 选 `sub_5A0700(0)` 边界表项）找
level≠种子且非水的邻格后重置整组。count==0 时读数组[0]（潜在崩溃）。
建区：new(0x50) + ctor 0x58BF70；CellCount 全网扫 +0x38==id 统计。

### 58E740 Bfs1（无 RNG）
frontier = 58D410（全边界）；每趟：level 匹配邻 → 未分配+clear/绿LAT → 声明
（+0x38=id、+0x11B=Level，**无条件**，append 才受容量门控）；否则 r!=id → 销毁返回 0。

### 58E9B0 Bfs2（无 RNG，恒返回 1）
LIFO：邻 +0x38==-1 且 +0x4B!=0 → 声明 +0x38=id。

### 58D010 Hierarchy（无 RNG，a1=0）
扫暂存：+0x38==-1 且坐标非零 → 58C800；新 region+0x1A = a1。

### 58EBC0 SplitOversizedRegions（无 RNG）
1) 重建各区域格表（**降序**线性索引序）+ bbox；2) 阈值 =
   `trunc(2 × ((RegionSize*0.005 + 0.05) × genH) × genW)`（×2 最后做，FADD ST0,ST0）；
3) 环：Finalised==0 && Water==0：CellCount <= 阈值 → Finalised=1；否则 58D620，
   成功 → 删区域 + **j 从 0 重扫**。

### 58D620 Region_Split（RNG 6 站）
1) 最小堆（f32 键，容量 2·CellCount+10，满静默丢）；2) 格表降序 +0x38=-2；
3) #1 maxSteps = U[CellCount/8, CellCount/3]；4) #2 种子（随机格，戳-3）；
5) #3 theta = r × 1.462918079607772e-9 (2π/(2³²−1))；6) 生长环（4 正向邻）：
   门 = -2 && 戳!=-3 && clear；cost = 58C6F0（内含 #5 每格 1 均匀）；
   每弹一格 #4 theta += gauss×0.3926990816987241 (π/8)；steps>=maxSteps 先检查；
   排空堆全部置 -3；7) 连通分量 → 新 region（id=ABED14++），8 连通 DFS；
8) level：border=58E5D0；adj 邻域表；best = CellCount 最大且**非水**未合并邻域
   （严格 >，首见胜）；候选 span=0 → [min−4, max+4]（边界内），span=4 → [max, min]，
   span=8 → [(max+min)/2]，无邻 → [3]；MapType 3/4 删候选 0；
   ≤100：Level := best.Level + 全图 delta + 格移入 best + Merged（best==NULL 什么都不做）；
   >100：#6 抽候选（candCount==0 时抽一次后越界读 —— 原生缺陷，照抄）。
疑点 b：best 计数哨兵反编译显示 NaN —— 需反汇编 0x58E0EA-0x58E13E。
疑点 c：58C070 语义（是否从全局表摘除）未明 —— 删除环/分裂尾声都不压缩列表。

### 58C6F0 SplitCost（RNG 1 抽/调用，无拒绝）
dx/dy → dist=Sqrt_Approx(dx²+dy²)；dx≠0 → ang=atan(−dy/dx)，dx<0 → ang=π−ang；
否则 π/2；d=|ang−θ| 折到 (−π,π]；返回 `Next()*K*2.5 + 1.5*d + 0.15*dist`（存 f32）。
⚠ 反编译 x87 伪影 —— 以语料反汇编为准（疑点 a）。

### 5A0160 DilateRings（无 RNG）
`frontier=5A0700(a1)`；a2 圈：邻在矩形内且 (r==0 || (a7&&r==a1−1)) &&
(clear || (a7&&水族)) → 声明 a1（无条件），a7&&clear → +0x11B=a8；
r!=a1 → 返回 0（冲突）。

### 594B50 Start_Candidate（RNG：MapType==0 时每零配额桶 1 抽）
阈值 `ftol(max(genW·genH·0.03, 400))`；kind={5,5,5,0,0}[maptype]；
58CE90 拆区重置；格迭代器（菱形内 +0x38==-1 +0x4C==0 zone==ref）→ 594420 洪水建区；
删 CellCount < 阈值（N=删除前 count）；打分 `key = id + N·(500000−CellCount)` qsort 升序；
配额 `q = (i==last) ? quota−assigned : ftol(cum/total·quota + 0.5 − assigned)`；
派发 594870（offset 照加）；MapType==0：每零配额桶 `rand*K < 0.5` → 595400（无论结果都抽）。

### 5A1FB0 Start_WriteFlood（无 RNG）
每 start：读路径点槽（垃圾也读）；全图 +0x3C=0；堆容量 800 {coord,dist}；
种子=槽坐标，戳 i+1；≤400 次弹出：弹格 +0x45=1；8 邻（域内 + 戳==0 + clear）→
dist=Sqrt_Approx(到 start)，**arena 写与计数在容量检查之前**（>800 邻溢出，原生缺陷照抄）。

### 594F40 FarthestSelector（无 RNG）
`target = ftol(((TiberiumLayout*0.01*12.0)/quota + 2.0) × 本桶配额)`；
quota==0∧count>0 → target=count；target>count||target==0：quota==0 → NULL（死码）否则 count。
第一趟（count>1）：所有对最大距离 +20 跨区奖（戳不同）；之后 max-min 贪心补齐。
count==0 → 返回非 NULL 空向量。

### 0x00ABE028 写者
- 0x007A2330（联机随机图命令）：无条件 =4。
- 0x00595FB0（生成驱动）：条件（WDTTerritory 成功）=4。
- 另抽 `ABE04C`（图种）用 **0x00886B88 主 RNG**，不碰 g_MapGenRng。
