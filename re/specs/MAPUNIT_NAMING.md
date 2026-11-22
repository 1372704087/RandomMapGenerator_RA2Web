# MapUnit 规范化规范

> 2026-11-19 落地。工具链：`scripts/mapunit-naming.mjs`（规则）、`scripts/mapunit-index.mjs`（索引/校验）、`scripts/mapunit-rename.mjs`（改名）。
> 相关记录：[`MAPUNIT_DUPLICATES.md`](./MAPUNIT_DUPLICATES.md)（重复件）、[`MAPUNIT_INDEX.csv`](./MAPUNIT_INDEX.csv)（全量索引）。

## 一句话

**名字只描述「它是什么」（内容 + 接口 + 权重 + 序号），数据只从 `.map` 里读；索引是唯一数据源，`--check` 负责盯漂移。**

## 一、目录：一个 theater 一个根，`_` 前缀子目录是分组

```
packages/server/resources/MapUnits/
├── settings.ini, addition.ini          全局
├── SNOW/
│   ├── settings.ini                    该 theater 参数（MapUnitSize / TopCorner / Theater）
│   ├── indicator.map                   指示图块（接口 + 权重都靠它）—— 脚手架，不参与生成
│   ├── empty.map                       空白基准（splitter 画框也用它）
│   ├── cannotplacesmudge.map           可选
│   ├── _terrain/                       地形单元（kind=t）
│   ├── _spawn/                         出生点单元（kind=s）
│   └── _tiberium/                      矿单元（kind=o）
```

- **顶层目录 = theater**；`loadAllResources` 跳过顶层 `_` 开头的目录（`resourceLoader.ts:139`）。
- **theater 内部的 `_` 前缀子目录 = 同一 theater 的分组**，`listMapFilesRecursive` 递归收进来，单元名取文件名（不带目录）。所以再也不用为了分组去造一堆假 theater。
- 非 `_` 子目录同样会被递归读取，但同样不会成为新 theater。

## 二、命名：`<label>_<kind>_<code4>_w<weight>_<两序号>.map`

| 段落 | 含义 | 来源 |
|---|---|---|
| `label` | 内容类型标签，放最前面就是为了让资源管理器按类型聚在一起 | 结构族（`CA` 后首段字母，如 `bhut` / `oild` / `park`）→ 有树石则 `trees` → 只有 overlay 则 `ovl` → `plain` |
| `kind` | `t` 地形 / `s` 出生点 / `o` 矿 / `e` 空件（实际只有 `empty.map`） | 生成器按名字子串过滤，`t` 之外必须保留语义词 |
| `code4` | 四向接口码，`NW NE SW SE` 各一字符，A = 该 theater 的最小连接 ID | 从指示块读出来（`Rx/Ry = SX-3 / SX+W+2` 上的 `IndicatorNum`），**不是**从文件名抄 |
| `w<weight>` | 权重 | 余量区 `Rx < StartingX-5` 里指示块的个数 |
| `序号` | 同一 `(kind, code4)` 内按原文件名自然排序 | 只为区分同接口的多个变体，两位 |

例：`bhut_t_FBBF_w1_01.map` = 以 `CABHUT` 为主体的地形单元，接口 `FBBF`，权重 1，该接口第 1 号。

**例外（不可改名）**：`empty.map`、`indicator.map`、`cannotplacesmudge.map`（loader 与 splitter 按固定名读取）；`settings.ini` / `addition.ini`。

**语义词硬约束**：`spawn_s_…`、`tiberium_o_…` —— `workingMap.ts` 有 15 处 `MapUnitName.includes('spawn')` / `includes('tiberium')` 过滤，名字里丢了词就等于件失效。

## 三、索引：`re/specs/MAPUNIT_INDEX.csv`

```bash
node scripts/mapunit-index.mjs           # 重新生成
node scripts/mapunit-index.mjs --check   # 校验磁盘与索引一致（不一致 exit 1，打印逐行 diff）
node scripts/mapunit-index.mjs --print   # 打到 stdout
# 等价 npm script
pnpm index:mapunits   /   pnpm check:mapunits
```

列：`theater,path,file,kind,code4,NW,NE,SW,SE,weight,bytes,sha1,struct,terrain,overlay,units,dominant,ztop,label,dup_group`

- 权重、四元组都是**读 `.map` 算出来的**，所以「保存的权重和磁盘不一致」「接口被改坏」「文件重复」都能被 `--check` 抓出来。
- `dup_group` 非空 = 同 theater 内 sha1 完全相同的重复件（见 DUPLICATES 文档）。
- `dominant` / `struct` / `terrain` / `overlay` / `units` / `ztop` 是内容画像，改名时 `label` 由 `dominant` 得出。

改动的正确流程：**改 `.map` → 改名脚本 → 重建索引 → `--check` → 重启服务**。

## 四、改名操作

```bash
node scripts/mapunit-rename.mjs            # 只生成 re/specs/MAPUNIT_RENAME_MAP.csv，不落盘
node scripts/mapunit-rename.mjs --apply    # 执行改名
```

脚本内置校验：同 theater 内新名唯一（大小写不敏感）、地形件名不含 `spawn`/`tiberium`、语义词件名含对应词、文件名无非法字符；任一不满足直接退出。

## 五、当前分布（2026-11-22，含岛屿三兄弟）

| theater | 件 | 地形 | 权重分布 | 重复 |
|---|---|---|---|---|
| DESERT | 91 | 80 | `{1:71, 2:9}` | 6（3 组） |
| DESERT_Islands | 26 | 18 | `{1:12, 2:6}` | 0 |
| NEWURBAN | 65 | 53 | `{1:49, 2:3, 4:1}` | 0 |
| SNOW | 63 | 59 | `{1:20, 2:2, 3:25, 4:10, 9:2}` | 0 |
| SNOW_Islands | 39 | 31 | `{1:16, 2:15}` | 0 |
| TEMPERATE | 63 | 59 | `{1:20, 2:2, 3:25, 4:10, 9:2}` | 0 |
| TEMPERATE_Islands | 39 | 31 | `{1:16, 2:15}` | 0 |

> SNOW_Islands / DESERT_Islands 由 `scripts/mapunit-retheater.mjs` 从 TEMPERATE_Islands
> 做 tile 重映射生成（--theater snow|desert 选配对表），接口码/权重与温带版逐件一致；
> 同时改写单元内嵌 `[Map] Theater`。
> - SNOW：set 0..30 恒等，31 起雪地插 Ice 系列错位、按 set 语义配对。
> - DESERT：set 结构与温带同构（同名同数）全恒等；沙漠缺水景装饰（15 个空集）且
>   无"崖入水"美术 ⇒ **沙滩岛**：全图压平 z→0，WCliff(15)/WaterCaves(57)/瀑布/沉船
>   走翼区克隆（Cliff piece 22..27 沙漠无 subtile 美术，fold 71..76→65..70），水线
>   由单元自带的 Shore Pieces 自然衔接。零黑面零空洞。
> - 2026-11-22 用户手修全部单元后删除 13 个问题件（bhut×7/bunk/farm/msc_ABBB/trees×3），
>   剩 26 件；若重跑 --apply 会从温带源恢复全 41 件，删除需重做。

label 分布：`trees×105`、`spawn×26`、`newy×22`、`ovl×19`、`bhut×17`、`oild×14`、`bunk×13`、`park×12`、`farm×9`、`tiberium×8`、`mach×8`、`airp×8`，其余 20 类均 ≤6。

## 六、还没做的

1. DESERT 3 组重复件处置（删/移入 `_dedup/`/只记录）。
2. DESERT 权重几乎全 1（71/80）——权重档位没有区分度，是否按用途重标。
3. `MENU`：`re/specs/MAPUNIT_INDEX.csv` 进 CI（`pnpm check:mapunits` 挂在预生成/prebuild 上）。
