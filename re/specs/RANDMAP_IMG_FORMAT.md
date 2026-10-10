# `.img` 格式调查 —— RandMap.img 不是最终地图（2026-10-07）

## 一、结论摘要

**`RandMap.img` 是 RMG 的中间产物/缓存，不是可直接对拍的最终地图。**
最终地图是 `RandMap.Map`（INI 文本）。所以"拿 `RandMap.img` 做逐字节对拍"
这条路**走不通** —— 目标选错了。

## 二、字符串证据（来自 gamemd.exe，最权威）

三处字符串上下文（`pe_probe` 读 `0x82BB20` / `0x829A90`）：

```
0x82BB20: cache.RandomMap … mmp … rmcache\ … RandMap.Map … Random Map …
          Resources … UrbanPresence … Vegetation … TiberiumLayout … WaterAmount
          Accessibility … Ruggedness …
0x829A90: … Alliance … Name:Americans … Name:Observer … RandMap.img …
          D:\ra2mdpost\LdPrgMgr.cpp …
```

1. **`RandMap.img` 紧邻 `D:\ra2mdpost\LdPrgMgr.cpp`** —— 同源文件的产物，
   即 RMG 管理器写出的中间文件。
2. **`RandMap.Map` 与全部 SED 选项键同段**（Resources / UrbanPresence /
   Vegetation / TiberiumLayout / WaterAmount / Accessibility / Ruggedness）
   ⇒ `.Map` 才承载最终地图。
3. 出现 `rmcache\` 前缀 ⇒ RMG 有独立缓存目录，`.img` 属缓存层。

`push "RandMap.img"`（字符串 VA `0x829ABC`）的代码引用点 5 处：

| 引用点 | 上下文 | 判读 |
|---|---|---|
| `0x55358D` | — | 非 RMG 主干 |
| `0x595C60` | `call 0x6406F0` + `0x7C8B3D`(free) | **读取**路径 |
| `0x5960D9` | `call 0x7B05C0` | **写入**路径 |
| `0x596214` / `0x596264` | — | 邻近续做 |

## 三、已确认的 `.img` 头部结构（双样本交叉验证）

**两份真机样本**（同一游戏目录，两次生成）：

| | A | B |
|---|---|---|
| SED | NumPlayers=2, Seed=16093, MapType=4, Theater=1 | NumPlayers=8, Seed=16730, MapType=4, Theater=1 |
| `.img` 体积 | 25 518 B | 49 599 B |

按 u16 读头部，**两份逐字节同构**：

```
off  0 : u16 1290, 2049        ← 恒定（两样本相同）
off  4 : u16 0, 0
off  8 : u16 W, H, W+1, H+1    ← A: 157,79,158,80   B: 237,119,238,120
off 16 : 24 × u16 全 0          ← 零区（实测 off16..63 全零）
off 64 : u16 768, W+1, 1, W+1, H+1   ← A: 768,158,1,158,80   B: 768,238,1,238,120
```

**已确立的关系**（两样本都成立，可作回归判据）：
- `u16[6] == u16[4] + 1`（W+1）
- `u16[7] == u16[5] + 1`（H+1）
- `off 64` 的第 2/4 项 = `W+1`，第 5 项 = `H+1`，第 1 项恒 `768`、第 3 项恒 `1`
- `u16[0..1] = (1290, 2049)` 与 `768`、`1` 均为**恒定**

样本已存 `re/samples/`（`randmap_2p_seed16093.img/.sed`、`randmap_8p_seed16730.img/.sed`）。

## 四、已排除的格式假设（都实测不成立）

| 假设 | 实测 |
|---|---|
| 裸 MiniLZO 整体解压 | `lzo1x_decompress` 静默失败 |
| Format5 分块（u16 size_in/size_out） | 块头解出 `NaN`，游标冲出文件 |
| Format80 | `srcIndex >= destIndex` |
| base64 + 分块 LZO | 只解出 597 B / 25 518 |
| `4 + w*h*2` 单层 | `(L−4)/2 = 12757`，无合理因数对 |
| `u8 layerCount` 逐层（MapLayerSet） | layerCount=10，游标冲到 80 909 |
| `off16 = layerCount(u16)` | 读到 0 |

**联立检验**：`len − Hs = f(W,H) × cellBytes` 在 Hs∈[2,64]、rows∈{H,H+1}、
cols∈{W,W+1}、cell∈{1,2,4} 全组合下**无匹配** ⇒ 数据是**变长/压缩**的。
佐证：`(len−16)/(W*H)` 在 A 为 2.0561、B 为 1.7581 —— **不是常数**。

**字节分布**（off 80 之后）：唯一字节值 A=87/256、B=92/256，
高频值集中在 `0xC1/0xC2/0xF0/0xE8/0xF8/0xF4/0xE0/0xC4`
⇒ 形态像**调色板索引**（符合 RA2 地形 8bit 索引），但**尚无定论**。

**头字段来源**：`0x595C00..0x596300` 与 `0x553500..0x553620` 两段内
**搜不到任何头部特征值立即数**（1290/2049/768/157/79/237 全零命中）
⇒ 头部字段是**运行时计算**的，不是硬编码常量。

## 四之二、真正的对拍目标：`templateMap.map`（第三方 RMG 的输出模板）

**用户线索**："`RandMap.Map` 我有点印象应该是有这个文件" ⇒ 全盘搜索找到
`H:\RA2YRLauncher\RA2YRdata\RandomMapGenerator_RA2\templateMap.map`。

那是一个**完整的第三方 RMG**（C# `RandomMapGenerator.exe`，作者 Handama，
2022-09，92 KB）：

```
RandomMapGenerator_RA2/
  RandomMapGenerator.exe      92160   ← 主程序
  CommandLine.dll            225280
  WeightedRandomizer.dll      17408   ← 加权随机（区域/矿场分布）
  templateMap.map              6442   ← ★ 输出模板 = RMG 产出的 .map 骨架
  minimap.ini               1089055
  rulesmd.ini / artmd.ini
  MapUnits/{DESERT,NEWURBAN,TEMPERATE,TEMPERATE_Islands}
  Map Renderer/CNCMaps.Renderer_x64.exe
  settings.ini: TemplateMap=templateMap.map, OutputExtension=yrm
  run.bat: -w 200 -h 200 --nwp 2 --sep 2 --nep 2 --swp 2 -d --type DESERT
```

### `templateMap.map` 的段骨架（26 段，即 RMG 产出的 .map 形态）

```
[Header] [Preview] [PreviewPack] [AITriggerTypesEnable]
[Africans] [Alliance] [Americans] [Arabs] [Basic] [British]
[CellTags] [Confederation] [French] [GDI] [Germans] [Houses]
[Lighting] [Map] [Neutral] [Nod]
[OverlayDataPack] [OverlayPack]      ← ★ 地形数据 + 索引
[Russians] [Special] [SpecialFlags] [Tags] [YuriCountry]
[Digest]                             ← ★ base64 SHA-1 校验和
```

关键实测：
- `[Map]` = `Size=0,0,50,50` / `Theater=TEMPERATE` / `LocalSize=2,4,46,44`
- `[Header]` = `Width=45 Height=44 StartX=233 StartY=30 NumberStartingPoints=0`
  （`NumberStartingPoints=0` = 模板占位，真实地图由 RMG 填）
- `[Basic]` = `Name=Random Map` / `Author=Handama` / `GameMode=standard`
- `[OverlayDataPack]` / `[OverlayPack]`：序号从 1 连续递增，**每行 base64 长 70
  —— 不是 4 的倍数 ⇒ 是连续 base64 流按固定字符数切片**，
  **必须拼接后整体解码，逐行解码会失败**。两段行数相同（一一配对）。
- `[Digest]` = base64 28 字符 → 解码 20 字节 = **SHA-1**
  ⇒ RMG 作者内置了地图校验和，**模板本身就是可比对的**。
- `[AITriggerTypesEnable]` 键名形如 `0A31295C-G=yes`（8 位十六进制 + `-G/-H` 阵营）

**仓内能力已验证**：`IniFile`（C# 风格 PascalCase API：`GetSection` /
`GetStringValue` / `GetIntValue` / `GetSections` / `SectionExists`，
构造函数吃字符串）**能直接解析这份真实 .map**。
已固化为 `src/test/rmg3rdparty_templateMap.map` +
`src/test/rmgThirdpartyTemplate.test.ts`（10 断言，全量 **186/186 绿**）。

### ⚠ 边界：只借**输出格式**，不借**算法**

这个第三方 RMG 走的是**「预置地图单元（MapUnits）拼接」**范式 ——
与本仓 RMG 的**「从零程序化构造（水体→区域→山丘→矿场）」**是两套范式。
本仓 README 早已定案「**不要试图合并**」。

⇒ 它的价值仅在于：**告诉我们 RMG 最终产出的 `.map` 长什么样**，
可作为 `emit.ts` 输出的**接口契约**与将来逐字节对拍的**格式基准**。
**不要**把它当gamemd 原版算法的参考。

## 四之三、⭐ 真正的对拍基线：`Random Map.yrm`（309 756 B，40 段）

**用户提示"游戏不保存 map 文件"** —— 这条反而定位到了真正的基线：
游戏把生成的地图**存为 `.yrm`**（就在游戏目录，只是名字不叫 `RandMap.Map`）。
全盘搜索命中 **`H:\Red-Alert-2-Yuris-Revenge\Random Map.yrm`**（309 756 B，7 月 22 日）。

**我上一轮"目标选错了"的结论要修正**：`RandMap.img` 与本 `.yrm` 是**同一次生成的两级产物**
（`.img` 是中间态、`.yrm` 是成品），两者都有效，缺的只是"把两者对上"的那一步。

### 段结构（40 段，实测序）

```
Header > Preview > PreviewPack > Basic > AITriggerTypesEnable
> Americans/Alliance/French/Germans/British/Africans/Arabs/Confederation
  /Russians/YuriCountry/GDI/Nod/Neutral/Special/Houses/General
  /NAYARD/GAYARD/YAYARD
> Lighting > SpecialFlags > CellTags > Tags > Map
> Units/Infantry/Structures/Terrain/Aircraft/Smudge/Waypoints
> IsoMapPack5 > OverlayPack > OverlayDataPack > Digest
```

⚠ 与空模板的段序**不同**（模板是 `Basic > Preview`，本样本是 `Preview > PreviewPack > Basic`）——
**不要写死段序**。

### 关键实测值

| 项 | 值 |
|---|---|
| `[Header]` | `Width=116` `Height=107` `NumberStartingPoints>0` |
| `[Map]` | `Size=0,0,121,121` `LocalSize=2,5,117,107` `Theater=DESERT` |
| 尺寸关系 | `Size宽 − LocalSize宽 = 4`；`Size高 − LocalSize高 = 14` |
| `[Header].Width` | **= LocalSize宽 − 1**（菱形带 x 上界，比矩形少一格）|
| `[Header].Height` | = LocalSize 高 |
| `[Basic]` | `Name=Random Map` `Author=Handama` `GameMode=standard` `Official=no` |
| `[IsoMapPack5]` | **2806 个 base64 行** |
| `[Digest]` | 28 字符 base64 → **20 字节 = SHA-1** |

### `[IsoMapPack5]` 编码链（**实测打通**）

```
11 字节/tile  { X:i16, Y:i16, TileIndex:i32, TileSubIndex:u8, Level:u8, IceGrowth:u8 }
→ 每 8192 字节一块，块头 = u16 size_in + u16 size_out
→ 整块 base64，写成 INI 的 "1=…","2=…"（★ 跨行连续切断）
→ 末尾 4 字节 (0,0) 终止符
```

⚠⚠ **三个实测踩坑（写测试时抓出来的）**：
1. **base64 跨行切断** —— 首行解码仅 55 字节，而首块头声明 `size_in=4030`
   （需 4034 字节）⇒ **单行装不下一个块**。
   **必须先把全部 base64 串拼接、再整体解码**；逐行独立解码是错的。
2. **每行长度只有 74（正常）与 22（末行）两种** —— 切片按固定字符数切，不按块边界。
3. **解块时不要设块数上限** —— 未解完时末尾拿不到终止符
   （我限 32 块时末尾是 `007900a9` 这类残块）。实测约 40 块。

⚠ **`(tileFlowLen − 4) / 11` 不为整数** —— 因为 ModEnc 明说的稀疏优化
（可省略 level 0 clear tile）会打散 11 字节对齐。**这不是数据损坏**，
真实 tile 数须逐 11 字节扫描、以 `(0,0)` 终止符为准。

### 仓内能力已验证

- `IniFile`（C# 风格 PascalCase：`GetSection` / `GetStringValue` / `GetIntValue` /
  `GetSections` / `SectionExists`，构造函数吃字符串）**完整解析 40 段**。
- `minilzo.decompressRange` **可持续解出 Format5 块流**（约 40 块 / 245 760 字节）。
- 已固化：`src/test/fixtures/rmg_real_randommap.yrm` + `re/samples/rmg_real_randommap.yrm`
- 已建测试：`src/test/rmgRealMapBaseline.test.ts`（17 断言）
- **全量 203/203 绿**

### 现在的对拍口径

本仓 `emitRmg` 的输出应与本样本的 `[IsoMapPack5]` / `[OverlayPack]` /
`[OverlayDataPack]` **同构**。当前测试锁定的是**格式契约**（段名/键名/编码链）；
**逐字节内容一致仍需阶段 7-10 + cell 网格 golden 就绪后再加**。

## 四之四、✅ 首次对拍已跑通（2026-10-07 18:57）—— 修掉两个真 bug

工具：`re/duo_compare.js`（基线 vs 我们，量出结构性差距）。

### 🔴 发现的真 bug ①：`IsoMapPack5` 混入 `TileIndex = 0xFFFF`

| | 修复前 | 修复后 | 基线 |
|---|---|---|---|
| TileIndex 种数 | 68 | **67** | 163 |
| TileIndex 范围 | 0..**65535** | **0..509** | 0..715 |
| 负 TileIndex | **760 个** | **0** | **0** |

根因（`emitRmg.ts:72-75`）：`tile` 把 `0xffff` 映射成 `-1` 后**无条件 `push`**，
于是未触的格也进了输出。**原版是稀疏的 —— 基线 29161 个 tile 里
`TileIndex < 0` 的个数为 0**（`TileIndex == 0` 有 5783 个，那是**合法** clear tile）。

修复：
```ts
if (!cell || cell.tile === 0xffff) continue;   // 未分配的格不出现
```
⚠ 别误把 `TileIndex == 0` 当哨兵清掉 —— 它是合法 clear tile。

### 🔴 发现的真 bug ②：`[Header] Width/Height` 留 0

`Width/Height` 由 `fileio.ts:587` 的 `CalculateStartingWaypoints` 从 `[Map] LocalSize`
推导（`Width = localWidth − 1`、`Height = localHeight`，**该口径本来就与基线一致**），
但 `emitRmgMapIni` **没调它**。修复：调用后再写其余元信息。

修复后 `Header W/H = 69/75`（`LocalSize` 70/75 减 1）✅

### 基线自身的实测事实（已固化为断言）

- `IsoMapPack5`：**29161** 个 tile，`X`/`Y` 范围 `1..241`，
  `Header W/H = 116/107`，菱形带格数 `(2W−1)·H = 24717`
  ⇒ **tile 数 118% of 带格数** ⇒ **一格可多 tile**（不同 level 层叠），不是严格 1:1
- `Level` 分布 `{0:1435, 1:247, 2:1391, 3:5129, 4:14437, 5:1318, 6:629, 7:1195, 8:2864, 9:275, 10:25, 11:58, 12:158}`
- `TileIndex` **163 种**，范围 `0..715`（`== 0` 的有 5783 个）
- `SubIndex` 0..22（**绝大多数是 0**：27516/29161）
- `IceGrowth` **全为 0**（29161/29161）
- 段集合：**40 段**

### 我们的现状（修完两 bug 后）

| 项 | 基线 | 我们 |
|---|---|---|
| 段数 | 40 | 37（缺 `Preview`/`PreviewPack`/`Digest`）|
| tile 数 | 29161 | 12054 |
| Header W/H | 116/107 | 69/75 |
| TileIndex 种数 | 163 | 67 |
| Level 分布 | 13 档 | 4 档 `{2,3,4,5}` |

⚠ 尺寸/tile 数不可直接比 —— 基线是 `Header 116×107`（DESERT，8 人口径），
我们是 `69×75`（MapType=1，2 人，`genW/genH=70`）。**要严格比需同参数**。

### ⚠ MapType=3/4 直接抛错（重要）

用真实 `MapType=4` 的 `.SED` 驱动会抛：
```
MapType 3/4 水体驱动（0x0059C580 河切割/湖生长）尚未接线 —— 见 README 阶段表
```
⇒ **手头两份最有价值的 `.SED`（`RandMap.Sed`/`SAVE4823.SED`，MapType=4）
目前根本跑不了**。这使「阶段 7-10 + 3/4 型水体接线」从"可选"变成"**阻塞项**"。

### 产出

- `re/duo_compare.js` —— 对拍工具
- `src/test/rmgDuoCompare.test.ts` —— 8 断言，锁住基线事实 + 两个 bug 的回归
- 修复 `src/rmg/emitRmg.ts`（稀疏过滤 + 调 `CalculateStartingWaypoints`）
- **全量 211/211 绿**（原 203 + 新 8）

## 五、下一步（换目标，别再啃 `.img`）

`.img` 格式只在需要复现"RMG 缓存行为"时才有价值。
若目标是**验证生成结果正确性**，应走：

1. **让真机产出 `RandMap.Map`** —— 它是 INI 文本，可直接解析。
   注：实测游戏**只写 `.img`**，`.Map` 与 `rmcache\` 目录当前都不存在
   （可能是生成后未进入正式流程）。需在游戏里把该随机地图**另存为 .map**。
2. **对照目标改为 `.map` 的 `[Map]` / `[IsoMapPack5]` / `[OverLayPack]` 段** ——
   仓里 `emit.ts` 已在产出这些段，可直接对拍（这才是有意义的比对）。
3. `.img` 若仍需：从 `0x5960D9`（写入侧）反推缓冲区怎么填给 `0x7B05C0`。
   需 IDA 伪码（脚本已备：`D:\rmg_work\decomp_randmap_img.py`）。

## 六、⚠ 工具状态（18:25）

`idat.exe` 连续 4 次报 `Failed to initialize IDA as library (error code 4)`，
**含此前已成功的脚本也失败** ⇒ IDA 当前整体不可用（非脚本问题）。
清理残留 `python.exe`（PID 27348 / 12368）后仍失败。
**并行提示**：IDA 不可并发，同一 `.i64` 连续跑要等前一个进程完全退出。
恢复后重跑 `D:\rmg_work\decomp_randmap_img.py`（已写好，5 个引用点 → 函数边界）。
