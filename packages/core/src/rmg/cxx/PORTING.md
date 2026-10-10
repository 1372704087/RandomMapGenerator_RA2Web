# cxx/ — C++ 工程对齐移植规范

本目录是 `G:\MapGenerator`（Win32 C++ 随机地图生成器）的**逐函数 TS 转译**。
对齐契约：**同参数 + 同种子 ⇒ 与 MapGenerator.exe 逐字节相同的格状态与 .map 输出**。
每个 TS 模块头部注明来源 C++ 文件；所有分歧以 C++ 源码为准。

## 模块映射（C++ 文件 → TS 模块）

| C++ 文件 | TS 模块 | 内容 |
|---|---|---|
| MapGen.h | types.ts + mapGen.ts | 数据模型 + Rmg 类状态 |
| MapGen.cpp | mapGen.ts (class Rmg) + mathTables.ts + r250.ts + winapi.ts | 主管线、GrowPatch、三陆型、R250 |
| MapGenFastSqrt.h / MapGenAtanTable.h | mathTables.ts（已生成，勿手改） | yrSqrt / tableAtan / F2I64 / K_UNIT_SCALE |
| MapGenRiver.cpp | river.ts | 河/三角洲/平滑/岸片/LoadTheaterTiles/PlaceIsoTile/崖修复 |
| MapGenLake.cpp | lake.ts | 湖生长 + LakeHeap + ClearPreviousGeneration |
| MapGenMaking.cpp | making.ts | InitRegions + MakeRegions 阶段体 |
| MapGenMakingSub.cpp | makingSub.ts | 区域分裂/坡道/悬崖/绿地 全部下属 |
| MapGenRecalc.cpp | recalc.ts | RecalcAttributes + TMP 解析 + overlay/ground/tiberium 表 |
| MapGenStartpoint.cpp | startpoint.ts | RollGlobalOptions + 起始点 + 移动区重建 |
| MapGenTech.cpp | tech.ts | 科技建筑 + 足迹 + LoadNeutral/LoadMultiplayer |
| MapGenTiberium.cpp | tiberium.ts | 矿场 + GrowTiberiumField + 群岛矿柱 |
| MapGenHills.cpp | hills.ts | 山丘 6 步 + 高程网格 |
| MapGenLAT.cpp | lat.ts | LAT/树/石 + PruneTerrainTrees |
| MapGenMapFile.cpp | mapFile.ts | SaveMapFile / SaveStageSnapshot |
| MapGenCleanup/Done/Radar.cpp | cleanup.ts | 释放/收尾（无格状态影响） |
| WinMain.cpp OnGenerate | generate.ts | 无头编排（种子/参数 → 全管线） |

## 转译规则（必须逐条遵守）

1. **数值语义**
   - C++ `int` → `number`；可能溢出的 32 位运算用 `| 0`；
     **32 位乘法必须 `Math.imul(a, b)`**（`a*b` 在 2^53 以上丢位）。
   - C++ `uint32` → `>>> 0`。
   - C++ `float` 存储（含结构体字段、`static_cast<float>`）→ `Math.fround(...)`。
     最常见的坑：优先级堆的 key、aspect 权重、`Sqrt` 返回值（本身已 fround）。
   - 截断 cast `(int)v` → `F2I64(v)`（向零截断，mathTables 导出）。
   - `std::sqrt` → `Math.sqrt`；`YRMath::sqrt` → `yrSqrt`；`std::log` → `Math.log`；
     `TableAtan` → `tableAtan`。
   - 双精度运算**保持 C++ 的结合顺序**（先乘先除的次序不能变）。

2. **坐标**
   - 打包坐标 `int`（低16 X 高16 Y）：`packXY/unpX/unpY/unpYS`（types.ts）。
     `unpX` = 低16符号扩展；`unpY` = 高16零扩展；`unpYS` = 高16符号扩展——
     **严格按 C++ 写了哪种 cast 就用哪个**。
   - `CellStruct` 参数/返回值一律用打包 number。

3. **签名约定**
   - 类方法 → 自由函数，首参 `r: Rmg`（即 C++ `this`）。
     例：`bool GenerateRiver(int*, double, bool)` → `generateRiver(r, startXY: Box<number>, initialAngle: number, isTributary: boolean): boolean`。
   - C++ `T*` 出/入参 → `Box<T>`（types.ts）；`std::vector<T>&` 出参 → 传入 `T[]` 原地填充或按 C++ 注释返回。
   - `std::vector<CellStruct>` → `number[]`（打包坐标）。
   - `std::string` → `string`；`const char*` 名称字段 → `string`。
   - C++ 默认参数照抄。

4. **Rmg 状态**
   - 字段已按 MapGen.h 声明在 mapGen.ts（camleCase：`shorePieces_`→`shorePieces`）。
   - 只**读写字段**，不要改 mapGen.ts；若确需新字段，写进你模块的
     `interface RmgExtras` 并 `declare module` 合并……（不允许——直接报告，
     我们统一加）。
   - `cellAt/rawSlot/getNeighbourCell/cellExists/workIndex/isWaterTile/
     isPlaceholderTile/growPatch/patchInBounds` 等已是 Rmg 方法。

5. **导入规则（避免运行时环）**
   - 类型导入一律 `import type { Rmg } from './mapGen'`（编译期擦除）。
   - 运行时只允许：mathTables / r250 / diag / winapi / types / lake→(无) /
     river→lake / making→makingSub / makingSub→river,lake / recalc→(无) /
     startpoint→recalc,makingSub / tech→(无) / tiberium→making,lat /
     hills→river,makingSub / lat→(无) / mapFile→(无)。
     出现别的依赖先看能否调换方向；确实成环就报告。

6. **DiagLog（对拍命脉）**
   - C++ 每个 `DiagLog("FMT", ...)` 调用点必须 1:1 保留，用 `diag()` 输出
     **逐字符相同**的行：
     - `%d`/`%u`/`%zu` → 模板串直接内插（%u/%zu 用 `>>> 0`）
     - `%08X` → `x8(v)`，`0x%02X` → `'0x' + x2(v)`（diag.ts）
     - `%.3f` → `f3(v)`，`%.4f` → `f4(v)`
     - `%s` → 内插；`%hs` → 内插
     - 中文诊断串原样保留（ORE-PILLAR 等）。
   - 条件分支里 DiagLog 的求值次序（先格式化后写文件）无关紧要，但**哪些行、
     什么顺序、什么值**必须一致。

7. **控制流**
   - C++ 循环/goto 结构尽量直译；`do {} while`、`for` 的**迭代次数与
     RNG 消耗次序是契约**，一个 continue/break 的错位都会毁掉对齐。
   - 递归函数（FloodFill、tributary 河、ValidateElevationStep）注意 TS 无
     尾调用优化，深度上限放宽到 C++ 等价（原生递归深度受图尺寸约束，安全）。

8. **注释**
   - 保留 C++ 函数头的 vanilla 地址注释（一行即可），实现注释挑关键保留。
   - 不新增任何"改进"——**哪怕 C++ 的写法看起来是 bug 也照抄**（对齐优先）。

## 验收（每个模块完成时）

- `node -e "require('./packages/core/src/rmg/cxx/<你的模块>.ts')"` 无法直接跑
  TS —— 用 `npx tsc --noEmit -p packages/core` 会因兄弟模块缺失报错，
  **忽略其他模块的报错，只保证自己文件无语法/类型错误**：
  `npx tsc --noEmit --target ES2020 --module commonjs --strict packages/core/src/rmg/cxx/<模块>.ts --outDir /tmp/x`（导入缺失错误可忽略）。
- 报告：导出清单 + 你添加的跨模块导入 + 任何拿不准的转译点（逐条列出）。
