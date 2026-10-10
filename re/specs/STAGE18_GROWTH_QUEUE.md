# 阶段 18 —— 矿场生长/扩散队列（`0x722240` / `0x722D00`）

**证据等级**：机器码级自读（`re/pe_probe.py` + capstone，2026-10-07）。
IDA 不可用（未安装，`gamemd.exe.i64` 数据库在 `G:\ida-yr-work\` 但无程序），
故 `sub_7228B0` / `sub_7233A0` 的规格由**直接反汇编**补齐，而非 Hex-Rays 伪码。
下方每条断言都可用 `pe_probe.py dis <addr> <len>` 复核。

目标二进制：`F:\RA2YRLauncher\gamemd.exe`（4,813,072 B，MD5 `fe2301a1f48841aa084aade100b25335`）。

---

## 0. 先纠正一处此前的误读

`re/decomp/722D00_GrowthQueue_Init.c` 与 `722240_GrowthQueue_Spread.c`
**不是两个阶段，是同一函数的孪生副本**。`diff` 仅两处差别：

| | `0x722D00` | `0x722240` |
|---|---|---|
| CellClass 字段组 | `+268 / +272 / +276 / +280` | `+240 / +244 / +248 / +252` |
| 末尾调用 | `sub_7233A0(cell)` | `sub_7228B0(cell)` |

两者 `size=149` 完全相同，逐指令同构 ⇒ **两套并行的生长通道**（普通矿 / 宝石矿，
或宝石 /  Tiberium 扩散），各自持有独立的队列三元组。

字段组差 = `0x1C`（268−240=40=0x28… 实为 `0x110−0xF0=0x20`，见下），
在 `sub_7228B0` vs `sub_7233A0` 的机器码里同样成立。

**调用点证据（决定性）**：`pe_probe.py calls 0x598960 0xBC8` 显示二者在生成器入口里
**背靠背相邻**：

```
00599387  call  0x578290      ; 迭代器 next
00599399  call  eax
0059939B  call  0x722d00      ; 通道 A（+268 组）
005993A0  call  0x722240      ; 通道 B（+240 组）  ← 紧邻上一行
005993AA  call  0x4068e0
```

⇒ 它们**不是阶段 17 与 18 的分界**，而是**同一阶段内并列的两条通道**
（对应矿场生长 vs 矿场扩散两种来源，疑分别对应 Tiberium 矿与宝石矿）。
README 把 `0x722D00 / 0x722240` 同列为「阶段 18」是正确的，
但把两个函数名读成 "Init / Spread"（先后关系）是错的。

## 1. CellClass 字段布局（本阶段相关）

来自 `sub_7228B0`（`ecx = cell`）：

| 偏移 | 类型 | 语义 |
|---|---|---|
| `+0xF0` | i32 | **堆计数**（入队元素数），初值 0 |
| `+0xF4` | ptr | 堆容器（`{count:int, ?}`, 数据在 `+8`） |
| `+0xF8` | ptr | **已访问位图**（byte/格） |
| `+0xFC` | ptr | 堆元素数组（每项 **8 字节**：`[+0]=cellId`, `[+4]=float 优先级`） |
| `+0x98` | i32 | 地图宽度（与 `iter` 取出的 cell 的宽度字段比较） |

孪生通道整体 `+0x1C`：`+0x10C`(计数) / `+0x110`(容器) / `+0x114`(位图) / 堆数组同构。

## 2. `sub_7228B0` —— 蛇形迭代 + **二叉堆**扩散

**抽数：0**（无 `g_MapGenRng` 调用；`0x42B1F0`/`0x42B1C0` 是尺寸查询/取格，非 RNG）。
这一条与既有 README「阶段 18 抽数 0」一致 —— 已被机器码证实。

```
size ≈ 0x166（0x7228B0 .. 0x722A16 `ret`）

1. 计数/容器/位图全部清零重置
   for (i = 0; i <= heap.count; i++) heap.data[i] = 0;
   heap.count = 0;
   for (i = cellCount; i >= 0; i--) visited[i] = 0;

2. do { … } while ( next )  ← 蛇形迭代器
   0x578350 → 迭代器 begin    （ecx = 0x87F7E8 全局迭代器对象）
   0x578290 → 迭代器 next     → 返回 cell 指针（edi），NULL 则退出

3. 过滤：仅处理 "地面" cell
   0x485010(cell) == cell.mapWidth?      ← 不等则 skip     [0x72291E]
   0x483690(cell) 返回 bool，0 则 skip                [0x722931]

4. 入堆（ sift-up / 插入 ）
   heap.data[count].cellId   = *(cell + 0x24)
   heap.data[count].priority = 0.0f                  // float32 零
   count++
   然后沿 parent = (i-1)>>1 上浮：
     while (i > 1 && heap.data[i>>1].priority > new.priority) 交换
   末更新 heap.max（[ebp+0xC]）与 heap.min（[ebp+0x10]）

5. visited[cellId] = 1                          [0x7229F1]
```

**关键判据**：`0x7229AB fld dword [ebx+4]` / `0x7229AE fcomp` —— 堆是**按 float32
优先级比较的二叉堆**（`FCOMP` + `fnstsw ax` / `test ah,0x41` 取 C3/C0 标志）。
⚠ 优先级来源是 `*(cell+0x24)` 之外的第二字段，本函数只写入 `0.0f`；
真正的优先级计算在**调用方**（`0x722D00` 层不做），移植时须追调用者。

## 2b. 全函数 call 图（7 个 call，已穷举）

```
007228E6  call 0x42b1f0    ; 菱形缓冲大小查询
00722901  call 0x578350    ; 迭代器 begin
0072290B  call 0x578290    ; 迭代器 next
0072291E  call 0x485010    ; 过滤谓词 A
00722931  call 0x483690    ; 过滤谓词 B
007229EC  call 0x42b1c0    ; 菱形坐标 → 线性索引
00722A00  call 0x578290    ; 迭代器 next（回环尾）
```

**这里有一个必须纠正的推断**：本函数**没有** 8 邻域扩散、**没有** 出堆 `pop`。
最初据伪码"Spread"命名推测存在扩散主体，是错的 —— 实际 7 个 call 全是
「迭代器 / 坐标换算 / 谓词」，扩散逻辑**不在这两个函数里**。

- `0x42B1F0`：`eax = [0x87F8E0] + 4; imul eax,[0x87F8DC]; shl eax,1`
  ⇒ `(mapW+4) * 2` 类的尺寸查询（`[0x87F8DC]` = 地图宽度）。
- `0x42B1C0`：读 `word[ecx]`/`word[ecx+2]` 作菱形 (x,y)，`sar ecx,1` 后
  `imul eax,esi` + `add` ⇒ **菱形坐标 → 线性 cell 索引**，
  即 `core/src/rmg/cell.ts` 的 `coordOfCell` 同族（阶段 12/13 已用）。

⚠ 因此「阶段 18 = 矿场生长/扩散」的实际算法主体（谁入队、谁扩散、优先级何来）
**仍缺**。已知本函数只做：清零 + 蛇形遍历 + 双谓词过滤 + 按 float32 优先级**入堆** +
标记 visited。**"抽数 0" 这一条被机器码证实**（无 RNG callee）。

## 2c. 两个过滤谓词（已全部定性）

⚠ **先纠正 §1 的一处误判**：`0x5FDD20` 不是"点 in 多边形"，而是
**"由 cell 查出它所属的多边形 id"**。证据来自谓词 B 的反证（见下）：
`0x5FDD20(cell+0x44)` 的返回值 `edi` 被直接当作**数组下标**去索引
`[0xB0F4EC]`（cell 数组）—— 下标语义，不是 bool。
故 `cell + 0x98` 存的是**多边形 id**（`cmp eax,[esi+0x98]` = 校验两者一致），
§4 原先"与地图宽比较"的疑团解释为**多边形 id 一致性校验**。

### 谓词 A — `0x485010`（4 字节尾调用）

```
mov ecx, [ecx + 0x44]
jmp 0x5FDD20          ; 尾调用：regionLookup(cell + 0x44)
```

即「取 `cell+0x44` 字段作 key 查多边形」。返回 id（−1 = 无）。

### 谓词 B — `0x483690`（完整 0x60 字节，四道门 AND）

```
1. 全局开关：test byte [[0xA8B230]], 0x80 ; jne 继续 ; 否则 return false
   （[0xA8B230] = ScenarioClass 全局；bit 0x80 = 该功能启用）

2. mov ecx, [esi + 0x44] ; call 0x5FDD20   → edi = 多边形 id
   cmp edi, -1 ; jne 继续 ; 否则 return false      （无所属多边形 → 否）

3. 密度门：
   mov cl, byte [esi + 0x11E]          ; cell+0x11E = 密度/覆被字节
   mov eax, edi ; cdq ; sub eax, edx ; sar eax, 1   ; eax = id >> 1（算术）
   cmp ecx, eax ; jg 继续 ; 否则 return false
   ⇒ 要求  cell.density > (polygonId >> 1)

4. 坡度门：
   mov al, byte [esi + 0x11C]          ; cell+0x11C = slope
   test al, al ; je 继续 ; 否则 return false
   ⇒ 要求  slope == 0（平坦）

5. 高程门（f64）：
   fld  qword [cell + 0xA0]            ; cell+0xA0 = 高程/高度（double）
   fcomp qword [0x7E3810]              ; 与全局阈值比
   fnstsw ax ; test ah, 1 ; je 继续 ; 否则 return false
   ⇒ C0 置位即"小于" ⇒ 要求  cell.height >= [0x7E3810]
   （⚠ 判据是 ah bit0 = C0，方向与直觉相反，移植勿搞反）

   实测阈值（`pe_probe.py f64 0x7E3810`）= **1e-05**（bits `0x1.4f8b588e368f1p-17`）
   ⇒ 对 RMG 的高程取值（level 0..15 整数）而言**此门恒真**，
   属"精度地板"式防御性检查（挡 -0/NaN/微小负值），不是语义门。
   移植时可保留但不必视为有效筛选条件。

6. mov eax, [esi + 0xE4] ; test eax,eax ; sete al
   ⇒ return (cell + 0xE4 == 0)
```

⇒ **谓词 B = 全局启用 ∧ 有归属多边形 ∧ 密度 > id/2 ∧ 平坦 ∧ 高程 ≥ 阈值 ∧ `cell+0xE4 == 0`**。
五个条件里 `0x11E/0x11C/0xA0/0xE4` 都是 `RmgCell` **尚未建模**的字段
（现有 `RmgCell` 有 `density`/`slope`，但无 `height(double)`、无 `+0xE4`、无 `+0x44/+0x98` 多边形 id）。

⚠ 第 5 步的阈值 `[0x7E3810]` 是 f64，值待读（下一步 `pe_probe.py` 补 u64/f64 模式）。

## 2d. 扩散主体定位（2026-10-07 追完，全 `.text` xref 扫描）

用 `re/xref.py`（自写，扫全 `.text` 的 `E8 rel32`）得到**全部调用点**：

| 函数 | 调用点 | 角色 |
|---|---|---|
| `0x722240`（通道 B 外层） | `0x5993A0` / **`0x67E6B3`** / **`0x687A8A`** | 阶段入口 + 两处**局外人**调用 |
| `0x722D00`（通道 A 外层） | `0x59939B` / **`0x67E6AE`** / **`0x687A85`** | 同上（紧邻，成对） |
| `0x7228B0`（队列入堆） | `0x722370` `0x7224E3` `0x722886` `0x72289A` `0x722B43` | **5 个同族内部调用者** |
| `0x7233A0`（孪生入堆） | `0x722E30` `0x722FA1` `0x723376` `0x72338A` `0x7235E2` | 同上镜像 |

⇒ 阶段 18 **不是两个函数，是一个约 0x600 字节的函数族**（`0x7221B0`–`0x72360x`），
`0x722240/0x722D00` 只是它的两个"整图重置+入堆"入口。
此前把这两个当"整个阶段"是把范围看窄了。

### 函数族分工（按 xref + 反汇编定性）

| 地址 | 大小 | 角色 | 证据 |
|---|---|---|---|
| `0x7221B0` | `0x8B` | **扩散前置扫描**（per-cell 距离门 + 写三元组） | 反汇编 |
| `0x722240` | `0x95` | 通道 B 整图重置 + 入堆 | 伪码 + xref |
| `0x722390` | — | **析构/释放**（`0x7C8B3D` = free） | 反汇编 |
| `0x722440` | — | **单 cell 生长**（被 `0x722200` 调用） | 反汇编 |
| `0x7228B0` | `0x166` | 队列入堆（六道谓词 + f32 堆） | 机器码 |
| `0x722D00` | `0x95` | 通道 A 整图重置 + 入堆 | 伪码 + xref |
| `0x7233A0` | `0x166` | 孪生入堆（`+0x1C` 字段组） | 机器码 |

### `0x7221B0` 逐指令规格（扩散前置扫描）

```
sub esp,0xC ; push esi
mov eax,[0xA8B230]                    ; ScenarioClass
mov cl, byte [eax + 0x34A6]           ; 全局开关
test cl,cl ; je 0x722236              ; 关 → 直接返回（不扩散）

esi = 0
outer:
  eax = [0xB0F4F8]                    ; cellCount
  if (cellCount <= 0) goto done
  ecx = [0xB0F4EC]                    ; cell 数组
  cell = ecx[esi]

  edi = cell[+0x100]                  ; i32，−1 = 无主
  eax = cell[+0x108]                  ; i32
  if (edi != -1) {
      edx = [0xA8ED84]                ; 全局「矿脉中心/目标」标量
      edx -= edi
      if (edx < eax) {                ; cmp edx,eax ; jge skip
          eax -= edx                  ;   eax = eax - edx   ← 距离/差值
          goto writeTriple            ; 命中
      }
  }
  if (eax == 0) {                     ; test eax,eax ; jne skip
      call 0x722440                   ; ★ 单 cell 生长
      ; 命中：写三元组
      edx = cell[+0x9C]               ; 取第三个分量
      cell[+0x100] = [0xA8ED84]
      cell[+0x104] = ebx              ; ebx = 调用方传入的参数
      cell[+0x108] = edx
  }
  esi++ ; while (esi < cellCount)
```

**CellClass 新字段（本阶段）**：

| 偏移 | 语义 |
|---|---|
| `+0x100` | i32，扩散归属/来源标记，**−1 = 无** |
| `+0x104` | i32，写入调用方传入的 `ebx`（阈值/数量参数） |
| `+0x108` | i32，距离/半径（与全局 `[0xA8ED84]` 做减法比较） |
| `+0x09C` | i32，写入 `+0x108` 位置的第三分量 |

**逐条移植注意**：
1. `cmp edx, eax ; jge` 是**有符号**比较（`jge`），差值可为负 ⇒ 移植用 JS 有符号数，
   **不能**用 `>>>` 或无符号比较。
2. `0xA8B230 + 0x34A6` 是**另一个**全局开关（与谓词 B 的 `+0x80` 位标志不同，
   是一整个 byte 的开关），勿混。
3. `call 0x722440` 的参数 = `ecx = cell`（`mov ecx,[0xB0F4EC]` + `esi*4` 已在
   `0x722210` 处重载），`ebx` 走栈传参 ⇒ 该函数原型是 `(cell, ebxParam)`。
4. `[0xA8ED84]` 是运行时全局（磁盘值无意义），移植时应作为 pipeline 的入参。

## 2e. ⚠⚠ 三处重大修正（读 `0x722440` 后）

### ① 阶段 18 **抽数不是 0** —— 原 README 结论错误

`0x722440`（单 cell 生长）的 call 表：

```
0072248A  call 0x7c5f00     ; ceil/round 辅助
007224B9  call 0x65c780     ; ★ RNG（lag(250,103) XOR）
007224D5  call 0x42b1f0     ; 菱形缓冲尺寸
007224E3  call 0x7228b0     ; 入堆（谓词过滤）
0072251F  call 0x5ad870     ; free
0072253C  call 0x5657a0     ; DiamondToCell
0072254A  call 0x481810     ; AdjacentCell
00722553  call 0x4838e0     ; 可生长判定（累加计数）
0072256F  call 0x483780     ; 标记/结算
```

`0x65C780` 即技能清单里的 **RNG next**（`HouseClass::AI` 摸底也用同址）。
⇒ **阶段 18 每个入堆 cell 至少消耗 1 次 RNG**，
`README` 阶段表里「阶段 18 抽数 0」**必须改为「每入队 cell 1 次」**。

### ② 堆是**整数 min-heap**，不是 float32

先前据 `0x7228B0` 里的 `fld/fcomp` 判成 float32 优先级 —— **错**。
`0x722440` 里的入堆（`0x7225D5`–`0x72262F`）是纯整数：

```
shr esi, 1                     ; parent = i >> 1
mov ebp, [ecx + esi*4]         ; 取父元素
fld  dword [ebp + 4]            ; ← 仅把 int 当 float 加载来比较
fcomp dword [esp + 0x14]
fnstsw ax ; test ah, 0x41
```

⚠ 陷阱：它用 `fld`/`fcomp` 加载 **dword 整数**（`[ebp+4]` 是 int，不是 f32），
是"整数当浮点比大小"的写法，**语义上仍是 int 比较**。
移植时若照抄成 float 比较，在大数（坐标 ≫ 2^24）上会因精度丢失而排错序。
⇒ **按 int32 比较实现**。

堆元素布局（8 字节）：
```
heap.data[i].key   = *(int*)(cell + 0x24)     ; 菱形坐标
heap.data[i].prio  = 0                        ; int，非 f32
```
`[heap+0xC]` = key 最大值；`[heap+0x10]` = key 最小值（`cmp ecx,eax; jbe` 更新）。

### ③ 堆里存的是**菱形坐标**，不是 cellId

`0x722598`：`mov edx, [esi + 0x24] ; lea ebp, [esi + 0x24] ; mov [ecx + eax*8], edx`
⇒ 入堆的 key 取自 **`cell + 0x24`**，且 `ebp = &cell[0x24]`（指针）另存 `[esp+0x18]`。
结合 `0x722440` 末尾把 `ebp`（= `&cell+0x24`）传下去，
`cell+0x24` 是**菱形坐标对**（不是 id）。移植时入堆键须用菱形坐标。

### 扩散环（`0x722500`–`0x722657`）

```
pop  = heap.data[0]（key/prio 两 dword），堆顶下沉
if (edi > 0 && eax != 0):                       ; 两个计数门
    push eax ; mov ecx, 0x87F7E8 ; call 0x5657a0   ; DiamondToCell(菱形坐标)
    ebp = 0 ; edi = 0
    do {                                          ; ★ 8 邻域循环
        push edi ; mov ecx, esi ; call 0x481810      ; AdjacentCell(cell, dir)
        push 0    ; mov ecx, eax ; call 0x4838e0     ; 可生长?  → al
        if (al) ebp++                              ; 计数「可生长邻居」
        edi++
    } while (edi < 8)                             ; ★ 方向序 = DIRECTION_OFFSETS
    if (ebp != 0) {
        push 0 ; mov ecx, esi ; call 0x483780       ; 结算
        if (ebp > 1) { …把 cell+0x24 入堆… }        ; 多邻居才继续扩散
    }
```

⇒ **扩散规则**：`8 邻域`中可生长者计数 `ebp`；`ebp == 0` → 停止；
`ebp == 1` → 只结算不再入堆；`ebp > 1` → 把自己入堆继续扩散。
（`0x722580` 的 `cmp ebp,1 / jle` 门。）

## 2f. `0x4838E0` —— 「可生长」判定（六道门，2026-10-07 双源交叉验证）

> ✅ **IDA 9.4 找到了**（在 `D:\Program Files\IDA Professional 9.4\`，此前误判为不可用；
> 配套 `D:\rmg_work\gamemd.i64` 数据库）。本节规格由
> **探针机器码 + Hex-Rays 伪码双源对照**得出，伪码见
> `re/decomp/4838E0_Growable_Check.c`（272 B）。
> 批量脚本：`D:\rmg_work\decomp_stage18.py`（13 个函数全 OK，见 `_log_stage18.txt`）。

字段对照（IDA 的 `this` 偏移 = CellClass 偏移）：

| CellClass | IDA `this` | 语义 |
|---|---|---|
| `+0x24` | `this+36` | 菱形坐标（word ×2） |
| `+0x38` | `this+56` | 附属表下标 |
| `+0x44` | `this+68` | 多边形 id（须 == −1） |
| `+0xEC` | `this+236` | LandType |
| `+0xE4` | `this+228` | 附着物链表头 |
| `+0x11C` | `this+284` | slope（须 == 0） |
| `+0x11E` | `this+286` | density |
| `+0x140` | `this+320` | flags |

```c
char __thiscall sub_4838E0(CellClass* this, int a2)   // a2 = 方向码（未使用）
{
  // ── 门 1+2 ──
  if ( sub_578460(this+36, 1) != 0                    // 菱形坐标合法
       && (*(uint*)(this+320) & 0x500) == 0 ) {       // flags 位mask
    // ── 门 3：附着物 tag==6 ──
    if ( unk_A8E9D0 != 0 ) {                            // 全局开关
      v3 = this->attachments;                           // +0xE4
      if (v3) {
        while (v3->vtable->tag44(v3) != 6) {            // +0x2C 虚表
          v3 = v3->next;                                // +0x30
          if (!v3) goto LABEL_11;
        }
        if ((int)v3[27] > 0) {                          // +0x6C
          v4 = v3[328];                                 // +0x520
          if (*(byte*)(v4+3226) == 0                    // +0xC9A
              && *(byte*)(v4+5889) == 0)                 // +0x1701
            return 0;                                    // ★ 提前否决
        }
      }
    LABEL_11:
    // ── 门 4：附着物 tag==36 (0x24) ──
    if (unk_A8E9D0 != 0) {
      v5 = this->attachments;
      if (v5) {
        while (v5->vtable->tag44(v5) != 36) {
          v5 = v5->next;
          if (!v5) goto LABEL_17;
        }
        if (*(byte*)(v5[50] + 689) == 0)                // +0xC8 → +0x2B1
          goto LABEL_17;                                // 走到门 5
        return 0;
      }
    }
  LABEL_17:
    // ── 门 5+6 ──
    if (byte_89EA90[36 * this->landType] != 0           // 门5：LandType 通行表
        && this->polyId44 == -1                        // 门6a：无多边形
        && this->slope11C == 0) {                      // 门6b：平坦
      v6 = this->idx38;
      if (v6 < 0 || v6 >= unk_A8ED68) return 1;         // 门6c：越界直接过
      if (*(byte*)(table_A8ED5C[v6] + 774) != 0)        // 门6c：附属表 +0x306
        return 1;
    }
  }
  return 0;
}
```

**修正我先前机器码分析的两处偏差**：
1. ~~**LandType 表地址是 `0x89EA90`，不是我算的 `0x89EA60`**（差 0x30）~~
   🟢 **2026-10-07 撤回**：见 §2i③，`adjudicate_tables.py` 在本函数体内扫立即数，
   `0x89EA60` 命中 1 处（`0x4839A8`）、`0x89EA90` **命中 0 处**
   ⇒ **我最初算的 `0x89EA60` 是对的，Hex-Rays 的 `byte_89EA90` 是错的**。
   `lea edx,[eax+eax*8]` + `*4` = ×36 的表项步长也正确。
2. 门 3 的尾部是 **`&&` 两条件同时为 0 才否决**（`+0xC9A==0 && +0x1701==0 → return 0`），
   我先前写成"两段独立判断"，逻辑等价但控制流描述不准。

**`byte_89EA90` 磁盘全 0**（实测 36 字节零）⇒ 与 `g_DirectionOffsets 0x89F688` 同类，
**运行时填充**，静态无法定值 ⇒ 需 theater 表标定（§4 新增缺口）。

## 2g. `0x7C5F00` —— 不是 ceil/round，是 **x87 向零截断**

```c
__int64 __usercall sub_7C5F00@<edx:eax>(double a1@<st0>) { return (__int64)a1; }
```
伪码 61 B。⇒ `0x722440` 里的
`fild dword[count] ; fmul qword[cell+0xA0] ; call 0x7C5F00` = **直接截断取整（truncate）**，
**不是** `ceil`/`round`。移植用 `Math.trunc`，用 `Math.round` 会差 1，整条管线偏移。

## 2h. `0x483780`（结算）—— 内含**第二处 RNG**

伪码 `re/decomp/483780_Growable_Settle.c`（340 B）：

```c
char __thiscall sub_483780(CellClass* this, char a2)
{
  if (a2 == 0) {                                        // 门 A（a2==0 才走）
    if (*(char*)&byte_A8B260 >= 0) return 0;
    v4 = regionLookup(this->polyId44);                  // +0x44
    if (v4 == -1
        || *(uint8*)(this+286) <= v4 / 2                // density <= id/2
        || *(byte*)(this+284) != 0                      // slope != 0
        || *(double*)(*(uint32*)(HIDWORD(dbl_B0F518) + 4*v4) + 160) < 2.098e-307
        || *(uint32*)(this+228) != 0)                   // 附着物非空
      return 0;
  }
  v5 = regionLookup(this->polyId44);
  v13 = v5;
  if (a2 != 0) { if (v5 == -1) { v13 = 0; v5 = 0; } }
  else if (v5 == -1) return 0;

  v12 = *(uint32*)(HIDWORD(dbl_B0F518) + 4*v5);         // ★ 取 cell 指针
  v7  = sub_65C7E0((uint32*)&byte_A8B260 + 536, 0, 7);  // ★★ RNG！起点 0，范围 0..7
  v8  = 0;
  while (1) {                                           // 随机方向试探
    v9 = (v8 + v7) & 7;
    v11 = *(uint32*)(this+36);                          // +0x24 菱形坐标
    LOWORD(v10)  = word_89F6B8[2*v9] + LOWORD(v11);     // 方向偏移表 ★
    HIWORD(v10) = HIWORD(v11) + word_89F6BA[2*v9];
    if (DiamondToCell(&stru_87F7E8, &v11) != nullptr
        && (uint8)Growable_Check(v12) != 0) break;      // ★ 复用 0x4838E0
    if (++v8 >= 8) return 0;
  }
  return sub_487190(v13, 3);
}
```

**⚠⚠ 这推翻了「阶段 18 每 cell 1 次 RNG」的估计**：
- `sub_65C7E0` 是**第二处 RNG**（我在探针 call 表里漏了它 —— 因为它在
  `0x483780` 内，而我只扫了 `0x722440` 的 call 表）。
- 它是**随机起点 + 8 次线性试探**：从 `rand(0..7)` 起始方向开始，
  按 `DIRECTION_OFFSETS` 序试探最多 8 次，找第一个"可生长"的邻格。
  ⇒ **每格扩散的 RNG 次数 = 1（选起点）+ 试探轮数不确定（0..8）**，
  **与邻居分布相关，不是常数**。这是本阶段对 RNG 流最敏感的地方。
- `word_89F6B8` / `word_89F6BA` 是**方向偏移表**（连续 word 数组，
  与 `g_DirectionOffsets 0x89F688` 语义同族但地址不同），
  索引 `2*v9` 取 x 偏移、`2*v9+1` 取 y 偏移（交错 word 布局）。
  ⚠ 磁盘实测 `0x89F6B8` 起 32 字节**全 0**（运行时填充）。

### 方向偏移表的真实编码（`0x49F2F0` 填充函数给的定论）

`re/decomp/49F2F0_DirectionOffsets_Filler.c`：

```c
dword_89F688 = -65536;   // 0xFFFF0000
dword_89F68C = -65535;   // 0xFFFF0001
dword_89F690 = 1;        // 0x00010000
dword_89F694 = 65537;    // 0x00010001
dword_89F69C = 0x1FFFF;
dword_89F698 = 0x10000;
dword_89F6A0 = 0xFFFF;   // 0x0000FFFF
dword_89F6A4 = -1;       // 0xFFFFFFFF
```

⇒ **菱形坐标编码成单个 dword：`x = 低 16 位（signed）`, `y = 高 16 位（signed）`**。
逐项还原：

| 下标 | dword | x | y | 方向 |
|---|---|---|---|---|
| 0 | `0xFFFF0000` | 0 | −1 | N |
| 1 | `0xFFFF0001` | +1 | −1 | NE |
| 2 | `0x00010000` | 0 | +1 | S |
| 3 | `0x00010001` | +1 | +1 | SE |
| 4 | `0x00010000` | 0 | +1 | （与 2 重复，疑未用/填充） |
| 5 | `0x0000FFFF` | −1 | 0 | W |
| 6 | `0x0000FFFF` | −1 | 0 | （与 5 重复） |
| 7 | `0xFFFFFFFF` | −1 | −1 | NW |

⚠ **本表不是 `N,NE,E,SE,S,SW,W,NW` 顺序** —— 与既有 `cell.ts` 的
`DIRECTION_OFFSETS` **有出入**（此表缺 E 与 SW，第 4/6 项与 2/5 重复）。
`0x89F6B8`（阶段 18 用的 word 版）与本 dword 表**地址相邻、布局不同**，
且两表都有重复项 ⇒ **两张表必须分别标定，不能互相套用**。
移植前须在真机 dump `0x89F6B8` 的运行时值（抓 golden 时一并做）。

> 🟢 **本节结论已于 2026-10-07 被 §2i 推翻，保留作为过程记录**：
> 上述"含重复项、缺 E 与 SW"是**读 Hex-Rays 伪码时看错 dword 常量**所致
> （IDA 把 `dword_89F690 = 1` 渲染成 `0x00010000`，真值 `0x00000001`）。
> unicorn 实跑 `0x49F2F0` 后确认 **`cell.ts` 现表 8/8 全对**，
> 而 `0x89F6B8` **恒为全 0**（全 `.text` 仅一处清零引用，从无填表代码）。
> ⇒ 详见 §2i①②。

**门 A 复用谓词 B 的逻辑**：`density <= id/2`、`slope != 0`、高程 `< 1e-5`
（`2.098e-307` 是 `dbl_…+160` 字段被 IDA 误解释的产物，须以机器码
`fcomp qword[0x7E3810]` 为准 = `1e-05`）⇒ 门 A 与 §2c 谓词 B **同源**，
差别是 A 用 `<` 侧、B 用 `>=` 侧。

## 2i. ✅ 运行时真值裁决（2026-10-07 unicorn 实跑，两个阻塞项已解）

工具：`re/oracle/dump_runtime_tables.py` + `adjudicate_tables.py`（unicorn 2.1.4 直跑真 gamemd.exe）。
**先复现既有 oracle（`gen_iterator_order.py` 4 组尺寸全 OK，32481 格逐格验证）
确认工具链可信，再抓新数据。**

### ① `cell.ts` 的 `DIRECTION_OFFSETS` 是**正确的** —— 疑点撤销

直接调 `0x49F2F0`（dword 表填表函数）后 dump `0x89F688`：

| 下标 | 原生 dword | (x, y) | 与 `cell.ts` 现表 |
|---|---|---|---|
| 0 | `0xFFFF0000` | (0, −1) | ✅ N |
| 1 | `0xFFFF0001` | (+1, −1) | ✅ NE |
| 2 | `0x00000001` | (+1, 0) | ✅ E |
| 3 | `0x00010001` | (+1, +1) | ✅ SE |
| 4 | `0x00010000` | (0, +1) | ✅ S |
| 5 | `0x0001FFFF` | (−1, +1) | ✅ SW |
| 6 | `0x0000FFFF` | (−1, 0) | ✅ W |
| 7 | `0xFFFFFFFF` | (−1, −1) | ✅ NW |

**8/8 全部一致。** §2h 里"含重复项、缺 E 与 SW"的结论**是错的** ——
错在**我读 Hex-Rays 伪码时看错了赋值**：IDA 把 `dword_89F690 = 1` 渲染成
`0x00010000`，而真值是 `0x00000001`（x=+1）。**教训：伪码的 dword 常量
不可尽信，关键数值一律回机器码或 unicorn 实跑复核。**

⇒ `cell.ts` 头部与 §2h 的"待标定"警告**可以撤销**，`DIRECTION_OFFSETS` 保持原样。
`rmgCellFields.test.ts` 最后一条测试的注释也需同步更正（断言本身仍有效）。

### ② `word_89F6B8` 恒为全 0 —— 阶段 18 的方向试探是**退化**的

- 字节级扫描全 `.text`：对 `0x89F6B8` **仅 1 处引用**，位于 `0x49F280`
  ```
  0x49F280  xor eax,eax
  0x49F282  mov word [0x89F6B8], ax     ← 清零
  0x49F288  mov word [0x89F6BA], ax     ← 清零
  0x49F28E  ret
  ```
  是**清零函数，不是填表函数**。
- 实跑验证：磁盘全 0 → 调 `0x49F280` 后仍全 0 → 再调 `0x49F2F0` **仍全 0**
  （后者只写 `0x89F688` 的 8×4 字节）。

⇒ **`0x483780` 里的 `word_89F6B8[2*v9] + LOWORD(v11)` 恒等于 `0 + x`**，
即"随机起始方向 + 最多 8 次方向试探"**实际只试 (x+0, y+0) 一次**。
`sub_65C7E0` 仍消耗一次 RNG（RNG 流位置仍受影响），
但**邻格选择退化为"原格"**，8 次循环里第 2 次起 `DiamondToCell` 必失败或重复。

⚠ **这条彻底改变了阶段 18 的移植写法**：
不要实现"8 邻域方向试探"，实现"恒等偏移 + 一次 RNG"即可。
但**必须标注为待真机确认** —— unicorn 里没人把 `0x89F6B8` 填上，
真实对局可能有别的代码路径（构造期/战役脚本）填它。
字节扫描已排除"填表代码存在"，故此风险较低但非零。

### ③ `0x4838E0` 门 5 的 LandType 表基址 = **`0x89EA60`**（我最初算的对，IDA 错）

`adjudicate_tables.py` 在 `0x4838E0` 的 0x120 字节体内扫立即数：
- `0x89EA60`（LT_A）**命中 1 处：偏移 `0x004839A8`**
- `0x89EA90`（LT_B，IDA 伪码所说）**命中 0 处**

⇒ **Hex-Rays 给的 `byte_89EA90` 是错的**，正确基址 `0x89EA60`（表项步长 36 字节）。
§2f 的"修正我先前机器码分析"那条**本身是错的，要撤回**。

**教训（与 ① 同源）**：IDA 伪码在**常量/地址**上有错误（两处），
但在**控制流/结构**上准确（13 个函数全解、控制流与我的机器码分析一致）。
⇒ 规格书应分档标注：**控制流信 IDA，常量信机器码/unicorn。**

## 2j. ✅ 真机 `.SED` 样本（2026-10-07 采自 `H:\测试\Red-Alert-2-Yuris-Revenge\`）

用户指出**游戏生成随机地图时会在游戏目录写 `.SED`**。实地采集到 3 份：

| 文件 | MapType | Theater | Seed | 其它要点 |
|---|---|---|---|---|
| `RandMap.Sed` | **4** | 1 | 16093 | Width/Height=3/3，Resources=2，UrbanPresence=0 |
| `SAVE4823.SED` | 4 | 1 | 16093 | 与上者**内容相同**（游戏另存副本） |
| `SAVE0029.SED` | 1 | 0 | 2147 | **Width=0 / Height=0**（clamp 边界） |
| `RandMap.img` | — | — | — | 25518 B，上者的生成产物 |

`[RandomMap]` 共 **17 键**（16 int + `Description`），行尾 **CRLF**。
`Description=968f,673a,5730,56fe,` = hex-CSV UTF-16LE = **"随机地图"**。

### 三点对移植的直接价值

1. **`sed.ts` 已被真实文件验证** —— 17 键全解、CRLF 容忍、Description 解码正确、
   round-trip 稳定。已固化为 `src/test/rmgRealSed.test.ts`（10 断言）
   + 4 份 fixture 入 `src/test/fixtures/`。**全量 167/167 绿。**
2. **`MapType=4` 就是 3/4 型** —— 阶段 7-10（台地/桥/悬崖/坡）的目标类型，
   且 `deriveDimensions` 已有 `mapType === 3 || 4` 的未 clamp 分支。
   仓里此前只有 0/1/2 型有实现，**这是第一份 3/4 型的真实输入**。
3. **`Width=0` 覆盖非 clamp 路径** —— 印证技能表补正：
   `.SED` 加载器（原生 `0x00597A30` 与本仓 `loadSed`）**都不 clamp**，
   clamp 只发生在对话框/随机化路径。已固化为回归测试。

### 仍缺的一半

样本只含**输入**（选项），**不含 cell 网格输出**。
⚠ **更正（同日后续调查）**：`RandMap.img` **不是**最终地图，而是 RMG 的
**中间产物/缓存**（exe 字符串表里它紧邻 `D:\ra2mdpost\LdPrgMgr.cpp`，
而 `RandMap.Map` 与全部 SED 选项键同段）。游戏实测**只写 `.img`**，
不产出 `.map` / `rmcache\`。要拿到可对拍的 `.map` INI，需在游戏里另存。

`.img` 已确认的头部结构（双样本交叉验证，见 `re/specs/RANDMAP_IMG_FORMAT.md`）：

```
off  0 : u16 1290, 2049           恒定
off  4 : u16 0, 0
off  8 : u16 W, H, W+1, H+1       A(2人)=157,79,158,80  B(8人)=237,119,238,120
off 16 : 48 × u16 全 0
off 64 : u16 768, W+1, 1, W+1, H+1
```

⇒ 阶段 18 的 cell 网格 golden **仍未解决**；
LandType 表 `0x89EA60` 运行时真值也仍未定值。
**下一步建议**：目标从 `.img` 改为 `.map` INI 的 `[IsoMapPack5]` 段对拍
（`emit.ts` 已在产出该段，是有意义的比对）。

## 3. 与既有实现的关系

- `re/decomp/` 已有 151 个 `.c`，但 `7228B0` / `7233A0` **不在其中** ⇒ 阶段 18
  此前标 ⬜ 的根因是**缺伪码**，不是缺实现思路。
- 伪码文件名 `GrowthQueue_Init` / `GrowthQueue_Spread` 的
  "Init/Spread" 命名**有误导**：二者都是 Init（重置+入堆），
  真正的 Spread（出堆+扩散）在本文件未覆盖的迭代体后半段。

## 4. 未解项（移植前须追）

1. ~~`0x485010` 语义~~ **已解**：regionLookup 尾调用（§2c）。
2. ~~`0x483690` 语义~~ **已解**：六道门 AND（§2c）。
3. ~~`+0x98` 语义~~ **已解**：多边形 id，一致性校验（§2c）。
4. ~~堆优先级由谁算~~ **已解**：本就是 **int32**，`cell+0x24` 菱形坐标做键（§2e②③）。
5. ~~扩散主体在哪~~ **已解**：`0x7221B0` 前置扫描 + `0x722440` 生长 + 8 邻域环（§2d/§2e）。
6. ~~`0x4838E0` 语义~~ **已解**：六道门（§2f，双源验证）。
7. ~~`0x483780` 语义~~ **已解**：随机方向试探 + 复用 `0x4838E0`（§2h）。
8. ~~`0x7C5F00` 语义~~ **已解**：x87 向零截断 `(int64)double`（§2g）。

**仍缺（按优先级）**：
- 🔴 **两张方向偏移表的运行时真值**。`0x89F688`（dword 版，全管线共用，
  被 `0x58E740`/`0x58E9B0`/`0x58F0C0`/`0x59BBC0` 等大量既有实现依赖）与
  `0x89F6B8`（word 版，阶段 18 用）磁盘均全 0。
  `0x49F2F0` 填的 `0x89F688` 值**含重复项**（下标 4≡2、6≡5），
  与 `cell.ts` 现有 `DIRECTION_OFFSETS`（N,NE,E,SE,S,SW,W,NW）**不一致**。
  ⚠ **不要据此改 `cell.ts`** —— 既有阶段 5/6/12 都基于现表跑通并有单测；
  这属于"两表之一可能读法不同"或"伪码 dword 赋值被 IDA 归并"。
  **必须真机 dump 两表运行时值再定**（与 golden 抓取同批做）。
- 🔴 `byte_89EA90` LandType 通行表（9 项 × 36 字节，运行时填充）。
  是 `0x4838E0` 门 5 的唯一判据。需 theater 表标定。
- 🟡 `cell+0xE4` **附着物链表**（`+0x30` next、`+0x2C` vtable tag=6/36）
  与 tag 对应的两种互斥检查。RMG cell 与附着物概念的唯一耦合点，
  `RmgCell` 无对应建模。
- 🟡 `0x487190(v13, 3)`（`0x483780` 的返回路径，`v13` = 多边形 id）。
- 🟡 `0xA8ED84`（扩散前置扫描的全局标量）、`0xA8E9D0`（附着物检查开关）、
  `0xA8ED38/0xA8ED2C`（附属表与上限）由哪一阶段写入。
- 🟡 `dbl_B0F518 + 160` 那条高程门：IDA 渲染成 `2.098e-307`，须以机器码
  `fcomp qword[0x7E3810]` 为准（=`1e-05`）。
- **`RmgCell` 需补字段**：`+0x24` 菱形坐标、`+0x38` 附属表下标、
  `+0x44/+0x98` 多边形 id、`+0x09C`、`+0xA0` height(f64)、`+0xE4` 附着物、
  `+0x100/+0x104/+0x108` 扩散三元组、堆四元组。
  ⚠ 现有 `RmgCell.regionId` 是"RMG scratch 区域 id"，
  与 `+0x44/+0x98`（**多边形** id）**未必同一概念，勿直接复用**。

## 5. 复核命令

```bash
cd G:/ra2-web-mapgen/re
P=C:/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/python.exe
$P pe_probe.py dis 0x7228B0 0x166      # 主体
$P pe_probe.py dis 0x7233A0 0x60       # 孪生头（字段偏移对照）
$P pe_probe.py dis 0x722240 0x95       # Init/Spread 外层
$P pe_probe.py calls 0x00598960 0xBC8  # 阶段顺序：确认 18 在何处被调
```

探针自证（2026-10-07，四项全中，勿在未复核时改动 `pe_probe.py` 的节表解析）：

| 断言 | 地址 | 期望 | 实测 |
|---|---|---|---|
| `RANGE_K = 2^-32+2^-64` | `0x7ED898` | `3DF0000000100000` | `00 00 10 00 00 00 F0 3D` ✅ |
| FPU 控制字 | `0x822D80` | `0x0E7F`（53位+向零截断） | `7F 0E` ✅ |
| 尺寸缩放 1/3 | `0x7ED968` | `0.3333333433` | （float32 1/3）✅ |
| 方向偏移表磁盘全 0 | `0x89F688` | 全 0 ⇒ 运行时填充 | 全 0 ✅ |
