# MapUnit 重复件记录（待处置）

> 生成时间：2026-11-19　数据源：`re/specs/MAPUNIT_INDEX.csv`（由 `scripts/mapunit-index.mjs` 扫描磁盘生成）
> 判定口径：同一 theater 内 `.map` 文件 **sha1 完全一致**（逐字节重复），即两个文件内容与接口四元组都相同，等价于同一件被登记了两次。

## 现状：DESERT 3 组，共 6 个文件

（改名后位置：`DESERT/_terrain/`；下表「现文件名」与 2026-11-19 改名前的「原名」一一对应）

| dup_group | 原名 | 现文件名 | 接口四元组 (NW,NE,SW,SE) | Weight | 字节 | sha1 |
|---|---|---|---|---|---|---|
| D1 | `2,2,3,3,01.map` | `trees_t_BBCC_w1_01.map` | 961,961,962,962 | 1 | 21182 | `dcf7603262d8…` |
| D1 | `2,2,3,3,02.map` | `trees_t_BBCC_w1_02.map` | 961,961,962,962 | 1 | 21182 | `dcf7603262d8…` |
| D2 | `2,4,2,1,01.map` | `powr_t_DBBA_w1_01.map` | 963,961,961,960 | 1 | 21204 | `9ab383b2a59d…` |
| D2 | `2,4,2,1,02.map` | `powr_t_DBBA_w1_02.map` | 963,961,961,960 | 1 | 21204 | `9ab383b2a59d…` |
| D3 | `3,3,2,2,01.map` | `bhut_t_CCBB_w1_01.map` | 962,962,961,961 | 1 | 20950 | `9cdb0b88096c…` |
| D3 | `3,3,2,2,02.map` | `bhut_t_CCBB_w1_02.map` | 962,962,961,961 | 1 | 20950 | `9cdb0b88096c…` |

其余四个 theater（TEMPERATE / SNOW / NEWURBAN / TEMPERATE_Islands）**无重复件**；`scripts/mapunit-index.mjs --check` 的输出里 `dup_group` 非空即为重复件。

## 影响

- 权重是**按候选条目逐个累加**的（`workingMap.ts:1414` 累加 `abstractMapUnit.Weight`），同一件存在两份就等于该接口组合的命中率被翻倍（本例 1+1=2，相当于别处 `Weight=2` 的件）。
- 生成逻辑本身不会出错（两份内容完全一致，放哪份都一样），所以这只是**概率分布失真 + 冗余文件**，不是崩溃源。
- `GetValidAbsMapUnitList` 按接口精确匹配取候选，重复件会同时进候选表，因此 `Weight` 之和才是真实概率。

## 处置方案（未执行，等定）

1. **删除每组第二个文件**（`…02.map`），保留 `…01.map` —— 权重回到 1，与其他同类件一致；想保留原概率就把留下的那件 `Weight` 提到 2。
2. **移入 `MapUnits/_dedup/`**（loader 会跳过 `_` 前缀目录），保留证据、不影响生成。← 倾向这个，可回滚
3. 不改，仅在索引里标记（现状）。

> 说明：本轮规范化改名为 `<label>_t_<code4>_w<weight>_<seq>.map` 后，三组的重复关系仍然由 sha1 判定，索引里的 `dup_group` 列会同步更新；届时 `--check` 会把「同组内文件数 > 1」当成需要人工确认的项提示出来。
