# 随机离子风暴（Lightning Storm）

生成器可选功能：给地图加"过一段时间某个地方就开始打雷"的闪电风暴。默认**关闭**，
开启后 `POST /api/generate` 会把下面这些内容写进 `.map`。

## 一、"随机位置"是怎么做的

引擎**没有**"随机选点"的原语：Action 102 只认一个固定 waypoint，也没有能让它每次
换地方的参数。所以这里用**多点位 + 环形轮转**逼近：

1. 按 `sites`（默认 4，范围 1..64）把地图内缩 10% 后均分成近似方形的片区；
2. 每个片区中心再由 seed 约束的 RNG 抖动 ±30% 片宽，落一个点位（同一张图 + 同一
   seed 点位可复现）；
3. 每个点位配一个独立 trigger（waypoint 16 起），**严格周期模式下走环形链**：
   每个点位只等 `intervalSeconds`，劈完用 `53` 启用下一个点位、用 `54` 关掉自己
   → 每 `intervalSeconds` 劈一次、落点在这 N 处之间轮换，走完一圈 = N × intervalSeconds；
4. 勾 `randomize` 时改成 Event 51 随机窗口：所有点位常开，每个点位在自己的
   `intervalSeconds × N` 的 0.5~1.5 倍之间随机触发 → 时间随机、落点在 N 处里随机挑。

结果：落点永远在这 N 个点位之一（不是任意格），但 N 可以开到 64，64 处基本铺满
145×139 的图，相邻两次劈落在同一处的概率很低；每处本身还有 `LightningCellSpread`
（原版 10 → 10×10 格）的散布，观感就是"随便哪里劈"。

> 早期版本有个 bug：N 个点位全部常开、间隔都写 `interval × N`，结果 N 个点**同时**劈，
> 而且要等 N × interval 秒才出现一波（4 点位 = 40 分钟一次四点齐射）。现在严格模式
> 走环形链，随机模式走 Event 51，实测每 600 秒一次、落点轮换。

## 二、为什么不用 `IonStorms=yes`

原版 `rulesmd.ini` 的 `[General] IonStorms=no ; Are random ion storms going to appear?`
看着像开关，但 ModEnc 明确标注它在 RA2/YR 里 **obsolete（会被读取但什么也不做）**，
是 TS 时代的遗留：

> IonStorms … Logic related to IonStorms, as a whole or in part, is obsolete in Tiberian Sun,
> Red Alert 2 and/or Yuri's Revenge. … While the flag is read, it does nothing.

我们早先模板里写的 `[SpecialFlags] IonStorms=no` 同理，是**无效键**，不产生任何效果。

真正能在地图里造出风暴的是 trigger：

| 元素 | 值 | 含义 |
| --- | --- | --- |
| Action | `102` | Lightning Storm strike：在指定 waypoint 起一场闪电风暴 |
| Event | `13` | Time Units Passed：经过 N 秒（trigger 循环时重新计时）→ 严格周期 |
| Event | `51` | Random Delay：在参数的 50%~150% 之间随机触发一次 → 随机窗口 |
| `[General]` | `Lightning*` | 伤害 / 持续 / 命中间隔 / 散布范围 |
| `[Lighting]` | `Ion*` | 风暴期间替换的环境光 |

## 三、写进地图的内容（默认 4 点位、600 秒平均间隔）

```ini
[General]
LightningDamage=250          ; 单雷伤害（原版 250）
LightningDeferment=250       ; 预警帧数（原版 250）
LightningStormDuration=180   ; 风暴持续帧数（原版 180）
LightningHitDelay=10         ; 中心目标被击中间隔帧数（原版 10）
LightningCellSpread=10       ; 随机落雷散布（n×n 格，原版 10）
LightningScatterDelay=5      ; 两道雷间隔帧数（官方注释：不要调小）
LightningSeparation=3        ; 云块间距（街区）

[Lighting]
IonAmbient=0.650000
IonRed=0.695000
IonGreen=0.445000
IonBlue=0.775000

[Waypoints]
16=<Y><XXX>   ; 点位 1
17=<Y><XXX>   ; 点位 2
18=<Y><XXX>   ; 点位 3
19=<Y><XXX>   ; 点位 4

[Triggers]                        ; HOUSE,<linked>,NAME,DISABLED,EASY,NORMAL,HARD,TRANSFERABLE
0E000000=Neutral,<none>,Random Ion Storm,0,1,1,1,0   ; 只有第 0 个开局启用
0E000001=Neutral,<none>,Random Ion Storm,1,1,1,1,0
0E000002=Neutral,<none>,Random Ion Storm,1,1,1,1,0
0E000003=Neutral,<none>,Random Ion Storm,1,1,1,1,0
[Events]                          ; NUM,E1,E1P1,E1P2 —— 第一个字段是"数量"
0E000000=1,13,0,600               ; 1 个事件：等 600 秒（不是 600×4）
0E000001=1,13,0,600
0E000002=1,13,0,600
0E000003=1,13,0,600
[Actions]                         ; NUM,A1,A1P1..A1P7
0E000000=3,102,0,0,0,0,0,0,Q,53,0,0E000001,0,0,0,0,A,54,0,0E000000,0,0,0,0,A
                                  ; 3 个动作：在 waypoint16（Q）劈 → 启用下一个 → 关掉自己
0E000001=3,102,0,0,0,0,0,0,R,53,0,0E000002,0,0,0,0,A,54,0,0E000001,0,0,0,0,A
0E000002=3,102,0,0,0,0,0,0,S,53,0,0E000003,0,0,0,0,A,54,0,0E000002,0,0,0,0,A
0E000003=3,102,0,0,0,0,0,0,T,53,0,0E000000,0,0,0,0,A,54,0,0E000003,0,0,0,0,A
                                  ; 末档的 53 指回第一个 → 严格周期、首尾相接
[Tags]                            ; 持久值,NAME,TRIGGERID（2 = 永久，循环的载体）
0E000010=2,RANDOM ION STORM 1,0E000000
0E000011=2,RANDOM ION STORM 2,0E000001
0E000012=2,RANDOM ION STORM 3,0E000002
0E000013=2,RANDOM ION STORM 4,0E000003
[CellTags]                        ; tag 必须挂到格子上才会被评估，每点位挂自己的格子
<Y><XXX>=0E000010                 ; 点位 1 的格子
<Y><XXX>=0E000011                 ; 点位 2
<Y><XXX>=0E000012                 ; 点位 3
<Y><XXX>=0E000013                 ; 点位 4
```

`randomize=true` 时不再走环形链：四个 trigger 全部 `DISABLED=0`、`[Events]` 换成
`1,51,0,2400`、`[Actions]` 只剩一个 `102`（每点位在 0.5~1.5 × 2400 秒里随机触发）。

触发器行的字段顺序照抄游戏自带模板地图（`packages/server/resources/MapUnits/*` 里
`spawn_s_*.map` 的 `[Triggers] 01000000=Americans,<none>,cell,0,1,1,1,0`）：
`House,<嵌套触发器>,名字,禁用?,简单,普通,困难,TRANSFERABLE`。
**第 8 位不是循环标志**：0 = 不可 transfer（tag 易手时触发器不跟着走），
循环由 `[Tags]` 的持久值控制（0 = 触发一次即销毁、1 = 可用两次、2 = 永久）。

> 三个编码坑（上一版写错过，现已修，`verify-ionstorm.mjs` 里逐条断言）：
> ① `[Events]`/`[Actions]` 少了开头的**数量**字段；② `Action 102` 的 P7 写成十进制 `16` 而非字母 `Q`；
> ③ 只写 `[Tags]` 没写 `[CellTags]`，tag 无载体、永不触发。
> 详见 `re/specs/DAYNIGHT.md` 第三节。

## 四、与 FlyingZ 脚本的差异（有意为之）

| FlyingZ 脚本做的事 | 本功能 | 原因 |
| --- | --- | --- |
| `TechLevel=11` 写 `GACSPH/GAWEAT/NAIRON/NAMISL/YAGNTC/YAPPET` | **不写** | 那不是"禁用超级武器"，而是把 6 个超武强行开放到全科技等级；会覆盖玩家/规则里的设置 |
| `[LightningStormSpecial] DisableableFromShell=no` | **不写** | 该键只影响"禁止超级武器"勾选项是否关掉闪电风暴这个**超武**；本功能走 trigger，不改超武定义 |
| `LightningPrintText=false` | **不写** | YR 的 `rulesmd.ini` 里没有这个键（TS 遗留） |
| 数值 40 / 2000 / 2000 / 180 | **不用**，用原版 250 / 180 / 10 / 10 | 脚本那套是"面积覆盖全图、几乎打不死东西"的观赏型；本功能按原版实战强度 |
| 只触发一次 | **循环**（`[Tags]` 持久值 2 + Event 13 重新计时） | 需求是"周期性" |
| waypoint 放在 `(Width, Height)` 角落 | **内缩 10% 的片区内随机** | 角落 + 散布会把一半的雷打在地图外 |

## 五、接口

`POST /api/generate` 新增可选体 `ionStorm`：

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `enabled` | boolean | `false` | 只有 `true` 才写任何风暴相关键 |
| `intervalSeconds` | 30..3600 整数 | `600` | **平均**两场风暴之间的秒数 |
| `sites` | 1..64 整数 | `4` | 点位数；1 = 只在地图正中，越多越接近"任意格" |
| `randomize` | boolean | `false` | `false` = Event 13 严格周期；`true` = Event 51，0.5~1.5 倍 |
| `values` | 对象 | 原版 | 可覆盖 `damage/deferment/duration/hitDelay/cellSpread/scatterDelay/separation` |

响应头 `X-Map-IonStorm`（JSON）回显：

```json
{"intervalSeconds":600,"randomize":false,"siteCount":4,
 "sites":[{"w":16,"x":39,"y":54},{"w":17,"x":110,"y":42},{"w":18,"x":33,"y":95},{"w":19,"x":115,"y":87}],
 "cell":{"x":39,"y":54},"eventId":13}
```

校验错误文案：

- `ionStorm must be an object`
- `ionStorm.enabled must be a boolean`
- `ionStorm.intervalSeconds must be an integer between 30 and 3600`
- `ionStorm.sites must be an integer between 1 and 12`
- `ionStorm.randomize must be a boolean`
- `ionStorm.values.<key> is not a known key (damage, deferment, duration, hitDelay, cellSpread, scatterDelay, separation)`
- `ionStorm.values.<key> must be a number between 0 and 1000`

## 六、实现要点

- `packages/core/src/ionstorm.ts`：
  - `pickStormSites(mapWidth, mapHeight, count, rng?)`：片区 + 抖动选点，同格去重；
  - `applyIonStorm(iniContent, options, width, height, rng?)` 返回 `{ iniContent, ionStorm? }`；
  - 尺寸优先取 `[Header]` 的真实 `Width/Height`（请求 150×150 实际生成 145×139，用请求尺寸会整体偏 5 格）；
  - 点位的 RNG 来自 `MapFile.Randomizer`，所以点位受 `seed` 约束、可复现。
- 必须在**环境光照之后**调用：`MapFile.ChangeLighting` 会把未显式给出的 `Ion*` 删掉。
- 生成器里挂在步骤 16b（光照 + `addition.ini` 合并之后、改名之前）。
# 步骤顺序提醒：光照 → **昼夜交替（14b）** → addition.ini → 本功能（16b）。
# 昼夜会重写 `[Lighting]` 五键，但它只改 Ambient/RGB，不动 `Ion*`，所以两者可以共存。
- waypoint 编号从 `16` 起；`Action 102` 的 P7 **必须写字母编码**（16 → `Q`、17 → `R`、
  25 → `Z`、26 → `AA`），由 `trigger.ts` 的 `waypointLetter()` 统一转换；64 个点位时编号 16..79 → `Q`…`CB`，仍在两位字母内。

## 七、验收

- `scripts/verify-ionstorm.mjs`：**50 pass / 0 fail**（开关行为、七条原版数值、
  4 组触发链、环形链（只有第 0 个启用 / 53 指下一档 / 54 关自己 / 末档指回首档）、
  `[Events]`/`[Actions]` 数量前缀、P7 字母、`[CellTags]` 挂载、
  点位在图内且互不重复、sites=1 回落、sites=64 铺满（64 组写入 + 编号 16..79）、
  Event 13/51 切换、七种非法参数 400）
- core 单测：**241 pass / 0 fail**（`ionstorm.test.ts` 17 例，含环形链、首尾相接、64 点位编码）
- 生成后 cncmaps 渲染正常（`POST /api/cncmaps-preview` → 200 image/png）

## 八、已知限制

1. 风暴落点只能在这些**固定点位**里轮转，做不到"每次任意格"——引擎没有随机 waypoint。
   想要更散就调大 `sites`（上限 64，受两字符 waypoint 编码与地图面积限制）；64 处已基本铺满全图。
2. 覆盖范围由 `LightningCellSpread`（原版 10）决定，只盖点位附近一圈，不是全图；
   想扫全图要调大这个值（API 的 `values` 已开放）。
3. 额外写了 `[Waypoints] 16..16+N-1`。**把这张图再走 `/api/split` 切片时，这些点会被
   当成出生点，多切出 N 个出生点单元**；只生成地图、不切片则无影响。
4. 触发链的字段顺序是从模板地图反推的（游戏自带 `spawn_s_*.map` 与 FA2 输出一致），
   但**没法在 CI 里进游戏验证**，实战效果需要开一局确认。

