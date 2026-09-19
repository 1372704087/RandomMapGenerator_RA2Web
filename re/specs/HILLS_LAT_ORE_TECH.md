# 山丘 / LAT / 树石 / 矿场 / 科技 / 绿地 / 生长队列 —— 反编译 × 语料交叉比对结论

来源：`re/decomp/` × `vera20k-main/docs/research/skirmish-ui/RMG_*.md`。
逆向代理 2026-09-19 全文比对产出，实现阶段 11-18 时以此为准。

## 新确认全局

| 全局 | 含义 |
|---|---|
| `dword_A8ED38` | IsoTileTypeCount（tile 上界） |
| `dword_A8ED2C` | IsoTileType 指针数组（**per-tile** 对象，0x30C 字节）；+736 Morphable |
| `dword_AA10B0` / `dword_ABC1D8` | g_ClearTile / g_RampBase（slope≥1 → tile=RampBase+slope−1） |
| `dword_ABC2B8` / `dword_ABB104` | g_RoughTile / g_SandTile |
| `dword_AA0748` | 绿 LAT 族基址（span 16） |
| `dword_ABAD28` | 岸线片族基址（span 42） |
| `dword_ABBEC4` / `dword_ABBEC8` | 4-tile 桥端族 / 15-tile 族 |
| `dword_87F914/18` `87F90C/10` | 内部图宽高/原点（角点网格 = 各 +1） |
| `dword_8871E0` | RulesClass；[696]=科技楼类型表、[699]=数量、+1636 CliffBackImpassability |
| `dword_ABDF94/ABDFA0` | region 数组/数量 |
| `dword_ABDFB8` | 高斯状态（Box-Muller 缓存） |
| `dword_87F850`(s4)/`87F858`(s10) | 每格镜像表（+0x4C 通行、level） |
| `dword_B0F4EC/B0F4F8` | TiberiumClass 实例数组/数量 |
| `off_83FF18` | **19 行 slope→(NW,NE,SE,SW) Δ 表**（已抓取：`_data_ramp_tables.txt`；行 0 全 0 占位） |
| `0x82A7F4`/`0x82A89C` | 岸线兼容表 42 项（已抓取全表） |

RNG 契约全部吻合（65C780/7C5F00/K/5980C0）。常数：0.005=0x3F747AE147AE147B、
25K≈5.820766092701993e-9、5K≈1.164153218540399e-9、3K≈6.984919311242392e-10、
2K≈4.656612874161595e-10、21/2³²≈4.889443517869674e-9。

## 1. Hills 5A35F0（本函数零 RNG；RNG 全在 5A33F0/5A2F50 —— 未反编译，待补）

1. `5A33F0()`（水/岸种子）→ `5A2F50(this)`（随机游走）→ `6B2A70()` 建角点网格。
2. 线性扫暂存（坐标非零槽）：target = cell.level(s8) + scratch+0x08；cur = 6B4100(cell)；
   delta = ftol(target−cur)；|delta| 次 {mask=6B4240(cell,dir) → 6B3E60(dir,0,coord,mask)}。
3. `6B3850()` 收尾。4) 2×2 清理：slope==5 且四格 {0,+1,+0x10001,+0x10000}
   slope∈{5,6,7,8} → 四格 tile=0xFFFF、subtile=0、slope=0；slope==11 且 ∈{11,12,9,10} →
   同上但 **level+=1**。

### 角点引擎
- **6B2A70 建格**：new(8·(W+1)·(H+1))，槽 {i32 height, b LOCK(+4), b VISITED(+5)}。
  属主解析：自身 → (0,−1) → (−1,−1) → (−1,0) 第一个过菱形测试者；全败 → LOCK=1。
  height = off_83FF18[owner.slope][0] + 15·owner.level（**恒用 NW 列**）。
  LOCK（对北/西北格内联）：出域 ‖ overlay!=−1 ‖ occupier!=0 ‖ scratch+0x45!=0 ‖
  (tile<count && tile!=0xFFFF && Morphable==0)；西格/自身经 6B2520。
- **6B4100 当前等级**：四角 [NW,NE,SE,SW] min/15；资格门（域内+overlay+occupier+
  +0x45+Morphable）不过 → 返回 cell.level。
- **6B4240 掩码**：4bit，bit i ↔ 角 i∈[NW,NE,SE,SW]：全等 → 非 LOCK 全选；
  dir<=0 → h>mn && !LOCK；dir>0 → h<mx && !LOCK。
- **6B3E60 MorphAt**：入口清撤销栈；掩码重映射 `(m&3)|((m&4)<<1)|((m>>1)&4)`（SE↔SW）；
  2×2 角块行主序（位 1,2,4,8 = NW,NE,SW,SE）：LOCK 角 force==0 → LIFO 回滚返回 0；
  h±15 越界 [0,180] → 还原不入栈；两种情况都 VISITED=1；递归 6B3A80。
- **6B3A80 传播**：8 邻：出界 force==0 → 0；LOCK 且 force==0 → |Δ|>15 → 0；
  可动：|Δ|<=15 继续；>15：dir==1&&h<center → h=center−15；dir!=1&&h>center →
  h=center+15；压栈 {x,y,h}、VISITED=1；!LOCK → 递归（失败 force==0 → 0）。
- **6B3850 收尾**：任一角 VISITED 才处理；展度 max−min <= 15；资格门同上；
  level=min/15；四角减 min；线性扫 off_83FF18[0..18] 首 Matching (ΔNW,ΔNE,ΔSE,ΔSW) →
  slope=s、tile = s==0 ? g_ClearTile : g_RampBase+s−1；不中则只写 level。
- **6B2520**：出域 ‖ overlay ‖ occupier ‖ +0x45 → 0；tile>=count ‖ 0xFFFF → 1；
  否则 IsoTileType[tile]+736。

## 2. LAT 链

### 5A38C0 温带概率（零 RNG）
岸格（4865B0）：5×5 邻任一在域内 → 写**岸格自身** scratch：+0x28=0.005、+0x20=0、
+0x18=0.02·i·10（i=Veg·0.01）。非岸且 +0x28==0：+0x28=0.005、+0x20=0.005、
+0x18=0.02·i（=0.0002·Veg%）。

### 5A3AE0 温带贴片+树+岩
1) 全图 +0x3C=0；2) 三个均值 [20,40]（`ftol(r·21/2³²+20)` 拒绝 >0x28）顺序
rough→sand→green；3) 每格（clear+slope0+overlay-1+无占位+无水锁）顺序三抽：
r1<+0x18 → rough（Gaussian·20+mean 拒绝 [4,80]）→ 5A4B60(cell,g_RoughTile,size,coord,0)；
elif r2<+0x28 → sand（ABB104）；elif r3<+0x20 → green（AA0E18）。抽数：命中即停
（rough 1 / sand 2 / green 3 / 无 3）。4) 全图 47CA80；5) 树
`count = ftol((Width·0.1+0.7)·Veg·0.01·MaxTrees)`、≤100 轮、598030(0,W²−1) 选槽
（(0,0) 拒绝链 ≤200，回退坐标 0）、密度 G·0.1+0.2 ∈[0.05,0.4]、
尺寸 ftol(G·10+25) ∈[10,35]、5A45E0；6) 岩（仅温带）：
target=U[0,(H+4)·W·2/200]，attempts=5·target；486790（sand LAT）→ overlay=168+U[0,4]
（SROCK01-05）；clear/绿 → 173+U[0,4]（TROCK01-05）；+0x11E=0；47D2B0(cell,−1)。

### 5A4280 非温带（**语料缺口已补全**）
1) 全图 +0x3C=0；2) 每格（仅 clear+slope0+无水锁；**无 overlay/occupier 检查**）
单抽 vs +0x28(0.005) → 尺寸 G·15+20 拒绝 [4,60] → 5A4B60(g_RoughTile)；
3) 全图 47CA80；4) 树（与 5A3AE0 逐字节同，回退坐标 0 仍耗 2 高斯并调用 5A45E0）；
无岩石。

### 47CA80 LAT 自动接驳（零 RNG）
四 LAT 族（rough [ABC2B8]→LAT[AA1134,+15]；sand [ABB104]→[AA0E24,+15]；
green [AA0E18]→[AA0748,+15]（兼容岸族+41、[AA1090,+1]）；pave [ABC2B0]→[AA10A8,+15]）
+ 坡族 [ABC1D8,+19]、[AA1058,+11]：4 正交邻不兼容置 4bit 掩码 → tile=LAT基+mask
或基址；slope1..4 按双邻 slope==0 的 2bit 掩码换 AA1058+{−1,+2,+5,+8}+mask。

### 5A45E0 Trees_Plant
cap=25·size；记录 8 字节 {coord, f32 优先级}；种子 {origin, 0}，+0x47=1；
循环：弹堆 → 放置门（clear+无占位+overlay-1+LandType!=3）→ 密度抽 r<K →
**树名 `v=ftol(r·25K+1.0)` 拒绝>25（死臂）→ TREE01..25 永无 TREE00** →
71DD80 按名查找（无 −1 守卫）+71BB90；邻域 8 向：域内+未访问+无水锁 →
优先级 = **Sqrt_Approx(到 origin 的 dist²) + r·5K**（push 时即置 visited）。
抽数：每合格弹出 1（密度）+命中 1（树名）+每入堆邻 1。

## 3. Ore 5A23A0（BFS placer 5A28C0 未反编译，语料已逐指令验证）
gem 门：mt0 → Resources==3；1/3/4 → !=3；2 → true。gem 锚点参考点：起点数<=0 →
**raw 抽 region+0x2C 数组随机项**（驱动内唯一直接 raw）；否则起点均值。
`lerp = ftol(T%·0.01·(max−min)+min)`；`regionTotal = ftol(lerp × max(starts,0.5))`；
`perFieldBase = regionTotal IDIV 槽数`；每槽 `size = ftol(perFieldBase + G·50)` 拒绝 ±100，
负跳过；第二遍（无 gem 门）：`size = ftol((score−min)·15.0) + 500`，
gem2 = Resources==3 && mt∈{1,3,4}。⚠ lerp/regionTotal 的 ftol 链有 Hex-Rays 伪影，
以 RECHECK §2 逐指令为准。

## 4. Tech
**5A95B0**：mt==2 → n=U{0,1,2}（ftol(r·3K) 拒绝>2），每 region 595400；
否则 n=U{0..4}（ftol(r·5K)）；Neutral 房主；每栋：类型 roll（ftol(r·count·K)）+
≤100 次锚（598030(0,W²−1)+(0,0) 拒绝链>200 回退）→ 基础格链
（+0xE4==0 + clear + 同 level + LandType!=3 + 578540(cell,1) + 无水锁）→
放 (x·256+128, y·256+128, 0)。**595400**：每 region 一栋，锚 = region+0x2C 随机项
（ftol(r·region+0x38·K)）。内联副本独立（非调用）。

## 5. Green 59B740（每步 1 抽）
收集绿格（4867B0）的 clear 四正交邻 → 向量；count=min(len/3,1000)；
每轮：`ftol(r·len·K)` 选（拒绝死臂）→ 左移删除 → 染绿 g_GreenTile →
其 clear 四邻入队。入口 `5AD820(0,0)` 功能未解码（待确认）。

## 6. GrowthQueue 722D00/722240
同码两副本（偏移 +0x10C 族 / +0xF0 族）；清旧 → n=(H+4)·W·2 分配 →
种子函数 7233A0/7228B0（未反编译，待补）。本体零 RNG。

## 7. Recalc 47D2B0（零 RNG；哨兵 0xABDC50 直接返回）
overlay 分支 / tile 分支 / LandType=10 隧道分支 / a2!=-1 → level=a2 /
尾部 CliffBackImpassability（6 邻任一 level>=本格+4 且规则==2 且
Land∈{0,2,6,8} → LandType=3）/ 写镜像（87F850+4·lin、87F858+10·lin）。
详见代理原文（本文件为摘要；完整版见会话记录）。

## 7b. 山丘 RNG 上游（0x5A33F0 / 0x5A2F50，2026-09-19 第六轮已解明）

### 5A33F0 水/岸种子（零 RNG）
蛇形迭代器：岸线片格 → 第一个域内 8 邻 clear 格 → 该邻格 scratch：height(+0x08)=0、velocity(+0x10)=1.0、+0x45=1；桥/坡族格（4863D0）→ 同搜索只写 +0x45=1。

### 5A2F50 随机游走（山丘全部抽取所在；this=MapSeed）
- clamp=R·1e-4+0.1；out_vel=R·0.0025；half_step=R·0.005；out_vel<0.025（R<10）整体跳过。
- 线性扫暂存（coord!=0）：velocity:=0；W 邻(x−1,y) 出域→velocity:=out_vel，域内→height+=W.h、velocity:=W.vel、tilt+=W.h−NW.h（NW 域外按 0）；N 邻(x,y−1) 出域→velocity+=out_vel，域内→height+=N.h、velocity+=N.vel、tilt+=N.h−NW.h；height/velocity 各 ×0.5；tilt==0 保持，否则 clamp ±clamp；+0x45 锁格：h<0→0、velocity:=0.0025（0x3F847AE147AE147B）。
- Draw1：区间 [−vel, half_step−vel]；scale 默认 0.025，若区间半宽超界则 scale=(hi−lo)/2、center=scale+lo；双重拒绝；velocity += g。
- Draw2：区间 [−2−h, 2−h]；center=clamp(tilt)；center±vel 出区间则 center=(hi−lo)/2+lo；拒绝；height += g。
- 末段：全暂存 height 按符号取整（>0 ? ftol(h+0.5) : ftol(h−0.5)，半值远离零）。

## 8. 待反汇编确认清单
~~5A33F0 / 5A2F50~~ → **第六轮已解明**（见 7b 节）
- `5A28C0`（矿场 BFS placer）、`7233A0`/`7228B0`（队列种子）、`5A4B60`（贴片团块）
- `5AD820`、`483C80`、`5FDD20`、`547370`、`727FD0`/`dword_81CC20`、`42B1F0` 恒等式
- `58C070`（region 摘除语义）、58D620 best 哨兵常量、87F850/87F858 镜像布局
