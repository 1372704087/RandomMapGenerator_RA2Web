# RMG —— gamemd 随机地图生成（TS 平移）

> **2026-11-18 起只剩 `cxx/`**：TS 原生平行实现（`pipeline.ts` 那 30 个模块）产出不可用，
> 已整体删除。本文件是精简后的现状说明，历史逆向记录见 `re/specs/`。

## 唯一实现：`cxx/`

`cxx/` 是按 vera20k 源码逐函数平移的 gamemd 管线（每个函数在注释里标了原生地址），
入口 `generateMap(params, outPath, resourceDir?)`，从一个全局种子产出完整 `.map`。

```
generateCxxMap(seed, { environment, theater, mapSize, playerIndex, oreDensity, ... })
  → core/src/rmg/cxx/generate.ts
  → 阶段顺序与 vera20k src/map/rmg/pipeline.rs 一致：
     carve_driver::connect_regions → cliff_materialization::jitter
     → materialize → cliff_variants::run →（起点 / 矿 / 树 / 建筑）
```

对外只暴露三件：

| 导出 | 说明 |
| --- | --- |
| `generateCxxMap` | 种子 → `{ mapContent, width, height, waterAmount, cellCount, options }` |
| `saveCxxMapFile` | 写盘（`.map` / `.yrm`） |
| `CxxGenerateParams` | 入参类型 |

16 个 MAPSEEDCLASS 字段（vera20k `rmg/options.rs::RmgOptions`）**由种子摇出**：
`cxx/startpoint.ts::rollGlobalOptions(seed)` 对应 `randomize.rs::derive_from_map_type`；
对话框的「Surprise Me」走同一套过程 RNG。

## 基础件（cxx 之外仍被引用的）

| 文件 | 内容 | 依据 |
| --- | --- | --- |
| `x87.ts` | 浮点契约（80-bit 舍入、`_ftol`、`_sqrt`、常数表） | 真机 golden：Box-Muller 16/16 位精确 |
| `rng.ts` | 私有 RNG（LCG + `GetRandomValue` 范围映射） | 真机 golden：5 种子 × 250 状态字位精确 |
| `options.ts` | 16 选项 + `ClampFields(0x005975E0)` + 尺寸推导 | 反汇编 + 语料 |
| `sed.ts` | `.SED` `[RandomMap]` 读写（carry-default，Description hex-CSV） | 语料 + 单测 |
| `rmgmd.ts` | `RMGMD.INI` 读取（构造器缺省 + 零售值） | 安装目录 INI |
| `cell.ts` | cell 级状态、方向契约、菱形带 | 真机 golden + 单测 |
| `emit.ts` | `emitMapFile` 拼装 `[Map]/[Basic]/…` | 单测覆盖 |

## 已删除（2026-11-18）

`pipeline.ts`、`water.ts`、`waterMt34.ts`、`bridge.ts`、`bridgeRamp.ts`、`cliff.ts`、
`cliffPlacer.ts`、`regions.ts`、`regionSplit.ts`、`regionPlateau.ts`、`green.ts`、
`recalc.ts`、`hills.ts`、`lat.ts`、`start.ts`、`ore.ts`、`tech.ts`、`zones.ts`、
`emitRmg.ts`、`templateKnown.ts`、`templateReverse.ts`、`native.ts`、`theater.ts`
及其 8 个测试。服务端 5 条旧路由、`rmgService.ts` / `rmgFullService.ts`、
前端 16 字段表单同步删除。

## 参考

- 逆向源码：`G:\_ref\vera20k`（`src/map/rmg/**`、`src/map/corner_heights.rs`、`src/map/lat.rs`）
- 规格与语料：`re/specs/*.md`、`re/decomp/*`、`G:\MapGenerator\x64\Release\{temperatmd,snowmd}.ini`

> `G:\MapGenerator` 是正在移植 Phobos 的另一套源码树，**只读，不要改**。
