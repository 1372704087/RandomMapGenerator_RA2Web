# 昼夜交替（游戏内循环切光）

> 一句话：把 24 小时压缩成「一轮 N 秒」，用一条环形触发器链在游戏里每隔 N/档数 秒改一次环境光，
> 走完一圈从头再来。开局那一刻的 `[Lighting]` 直接写成"当前钟点"的天色，所以进游戏第一眼就是对的。

- core：`packages/core/src/daynight.ts`（`applyDayNight`）、`packages/core/src/trigger.ts`（`[Events]`/`[Actions]` 编码）
- server：`packages/server/src/generator.ts` 步骤 **14b**、`packages/server/src/index.ts` 的 `validateDayNightRequest` + `X-Map-DayNight`
- web：`packages/web/src/pages/GeneratePage.tsx` 的「昼夜交替」区块
- 验收：`scripts/verify-daynight.mjs`

## 一、为什么必须用触发器

`[Lighting]` 只是**开局那一刻**的静态光照，游戏跑起来引擎不会再读它。
想让一局里天黑、天亮，只能用地图触发器在运行时改光照。YR 里能改光的动作只有下面几条
（ModEnc `Actions (maps)/RA2YR`，实测摘要）：

| 动作 | 名称 | 参数 | 说明 |
|---|---|---|---|
| **73** | Set ambient light | P2 = 0..100 | 环境光亮度，百分比即 `Ambient × 100` |
| **142** | Retint Red | P2 = 百分比 | 红色通道 |
| **143** | Retint Green | P2 = 百分比 | 绿色通道 |
| **144** | Retint Blue | P2 = 百分比 | 蓝色通道 |
| **53** | Enable Trigger | P2 = 触发器 ID | 启用另一个触发器 |
| **54** | Disable Trigger | P2 = 触发器 ID | 禁用一个触发器 |

计时用 **Event 13 = Time Units Passed**，它的基准是「触发器被激活之后过了多久」：
被 54 禁掉就停表，被 53 重新启用就**从 0 重计**。这正是环形链能严格周期的原因。

> **`Level`（高差光照）运行时改不了** —— 没有任何动作能改它。所以 `[Lighting] Level` 这一项
> 只按"开局那一档"写死；深夜那几档更小的 Level 只体现在静态图（比如夜间渲染预览）里，
> 实战中高地的亮度差异会比静态图略大。

## 二、环形链怎么排

设档数 N，各档时长 d₀…d_(N-1)（等分 cycleSeconds，余数补最后一档）：

```
开局：基础 [Lighting] = 第 0 档；T0 启用，T1..T_(N-1) 全部禁用
T0   等 d0 秒 → 切到第 1 档 → 启用 T1，禁用自己
T1   等 d1 秒 → 切到第 2 档 → 启用 T2，禁用自己
...
T_(N-1) 等 d_(N-1) 秒 → 回到第 0 档 → 启用 T0，禁用自己
```

一轮总时长 = Σdᵢ = `cycleSeconds`，且因为 53/54 是"激活即重新计时"，**不会累积漂移**。

默认参数（4 档 / 600 秒 / 6 点起）实际写进地图的样子：

```ini
[Lighting]                       ; 开局 = 06:00 温带锚点
Ambient=0.750000
Red=1.090000
Green=0.800000
Blue=0.490000
Level=0.030000

[Triggers]                       ; HOUSE,<linked>,NAME,DISABLED,EASY,NORMAL,HARD,TRANSFERABLE
16100000=Neutral,<none>,Day Night Cycle 1,0,1,1,1,0   ; 只有第 0 档开局启用
16100001=Neutral,<none>,Day Night Cycle 2,1,1,1,1,0
16100002=Neutral,<none>,Day Night Cycle 3,1,1,1,1,0
16100003=Neutral,<none>,Day Night Cycle 4,1,1,1,1,0

[Events]                         ; NUM,E1,E1P1,E1P2
16100000=1,13,0,150              ; 150 秒 = 600 / 4
16100001=1,13,0,150
16100002=1,13,0,150
16100003=1,13,0,150

[Actions]                        ; NUM,A1,A1P1..A1P7,...
16100000=6,
  73,0,75,0,0,0,0,A,             ; 环境光 75%（0.75×100）
  142,0,109,0,0,0,0,A,           ; Red 1.09
  143,0,80,0,0,0,0,A,            ; Green 0.80
  144,0,49,0,0,0,0,A,            ; Blue 0.49
  53,0,16100001,0,0,0,0,A,       ; 启用下一档
  54,0,16100000,0,0,0,0,A        ; 禁用自己
16100001=6,73,0,100,…,53,0,16100002,…,54,0,16100001,…
16100002=6,73,0,75,…,53,0,16100003,…,54,0,16100002,…
16100003=6,73,0,8,…,53,0,16100000,…,54,0,16100003,…

[Tags]                           ; 持久值,NAME,TRIGGERID（2 = 永久，否则 tag 用一次就自我销毁）
16110000=2,DAY NIGHT 1,16100000
16110001=2,DAY NIGHT 2,16100001
16110002=2,DAY NIGHT 3,16100002
16110003=2,DAY NIGHT 4,16100003

[CellTags]                       ; tag 必须挂到格子上才会被评估
49050=16110000
49051=16110001
49052=16110002
49053=16110003
```

（上面 `[Actions]` 为了可读做了换行，文件里是单行逗号串：`6,73,0,75,0,0,0,0,A,142,…`）

### 逐整点（24 档）

`stages: 24` 时 `stageHours` 就是**每个整点一档**：`startHour` 决定起点，往后每小时一档、绕满 24 小时
（6 点起 → 06…05），每档的天色就是 24 小时光照表在该整点的值 —— 和手选 `lighting.preset hour=<该整点>`
逐位相同。

代价与建议：

- 24 组 trigger + 24 个 tag + 24 个 celltag；120×120 图实测 ini 从 319,759 → 324,831 字节（+5,072，约 +1.6%）；
- 每档时长 = `cycleSeconds / 24`。600 秒一轮只有 25 秒/档，天色会闪；**建议 `cycleSeconds ≥ 1440`（≥60 秒/档）**。
  前端选 24 档时若一轮低于 `档数 × 30` 会自动抬高（30 秒/档是硬下限），接口侧不额外限制；
- 仍然只在整点跳变，整点之间没有插值（见第七节「已知限制」）。

## 三、格式上踩过的三个坑（也是上一版离子风暴的 bug）

ModEnc 三页（`Triggers`、`Events`、`Actions (maps)/RA2YR`）明确写死，之前都没遵守：

1. **`[Events]` / `[Actions]` 的值第一个字段是"数量"**。
   上一版本写的是 `0E000000=13,0,2400` / `102,0,…,16`，引擎会把 `13` / `102` 当数量读
   （后者等于声明了 102 个动作），整条链实际是废的。现在统一走 `formatEvents` / `formatActions`：
   `1,13,0,2400`、`1,102,0,0,0,0,0,0,Q`。
2. **动作 P7 要写字母**（0=A、1=B、…、25=Z、26=AA）。
   `Action 102` 的 P7 是 waypoint，waypoint 16 必须写 `Q` 而不是 `16`。有 `waypointLetter()` 统一处理。
3. **tag 不挂 `[CellTags]` 就永远不会被评估**。
   只写 `[Tags]` 等于创建了一个没有载体的 tag；必须再写 `[CellTags] <y><xxx>=<TAGID>`
   （键的格式与 `[Waypoints]` 的值相同）。现在昼夜每档挂一个中线格，离子风暴每个点位挂自己的格子。

顺带纠正一个概念：`[Triggers]` 第 8 位是 **TRANSFERABLE**（是否随物体易手），
**不是**"0=只触发一次 / 2=循环"。循环由 `[Tags]` 的持久值控制：0 = 一次就销毁、2 = 永久。

## 四、接口

`POST /api/generate` 增加可选字段 `dayNight`：

| 字段 | 类型 | 说明 |
|---|---|---|
| `enabled` | boolean | 不传/false = 只写静态光照，不写任何触发器 |
| `cycleSeconds` | int 60..7200 | 一轮（白天 + 黑夜）总时长，默认 600 |
| `stages` | int 2..24 | 关键帧数，默认 4（06/12/18/00 点）；24 = 逐整点走一遍 00…23 |
| `startHour` | int 0..23 | 开局钟点，默认 6 |
| `retint` | boolean | 是否追加 142/143/144 改 RGB，默认 true |

响应头 `X-Map-DayNight`：

```json
{"cycleSeconds":600,"environment":"temperate",
 "stages":[{"hour":6,"seconds":150,"ambientPercent":75},
           {"hour":12,"seconds":150,"ambientPercent":100},
           {"hour":18,"seconds":150,"ambientPercent":75},
           {"hour":0,"seconds":150,"ambientPercent":8}],
 "eventId":13,"actions":[73,142,143,144,53,54],
 "cells":["49050","49051","49052","49053"]}
```

校验错误文案（固定，验收脚本按字符串断言）：

- `dayNight must be an object`
- `dayNight.enabled must be a boolean`
- `dayNight.cycleSeconds must be an integer between 60 and 7200`
- `dayNight.stages must be an integer between 2 and 24`
- `dayNight.startHour must be an integer between 0 and 23`
- `dayNight.retint must be a boolean`

## 五、验收

- `scripts/verify-daynight.mjs`：**51 pass / 0 fail**（含 24 档逐整点 6 项）
  （不开启无痕、开局 [Lighting] = 06:00 锚点、4 组 trigger/event/action/tag/celltag、
  `[Events]` 带数量前缀且合计 = 一轮、`[Actions]` 数量 6 且动作顺序 73→142/143/144→53→54、
  六个 P7 都是字母、环形链闭合、百分比 = Ambient×100、retint=false 只剩 3 个动作、
  上下限边界、24 档逐整点（00…23 全覆盖、每档 60 秒、24 组 trigger/tag/celltag、首尾相接）、
  与静态光照/离子风暴共存、10 条非法参数 400）
- core 单测：**239 pass / 0 fail**（其中 `daynight` 16 例）
- `scripts/verify-ionstorm.mjs`：**42 pass / 0 fail**、`scripts/verify-lighting.mjs`：**41 pass / 0 fail**

四档天色的静态渲染（同 seed、`lighting.hour` = 6/12/18/0，cncmaps 渲染）：
`https://aka.doubaocdn.com/s/hVTU4c1BUj`

## 六、实现要点

- 档值直接复用 `lighting.ts` 的 `getLightingForHour(environment, hour)`：昼夜的每一帧和静态光照用同一套
  9 锚点插值，所以"静态 18:00"和"昼夜循环第 3 档 18 点"逐位相同，不会出现两套曲线打架。
- 环境主题由 `theaterToLightingEnvironment` 推导（DESERT → desert、SNOW → snow…），非温带按各自正午比例缩放。
- 触发器 ID 用**纯十进制 8 位**（`16100000..`），不用 `0E000000` 这种带字母的十六进制：
  引擎读 ID 是按十六进制还是十进制字符串解析无法在 CI 验证，纯数字在两种解释下都自洽。
  与离子风暴的 `0E0000xx` 号段不重叠，同一张图能共存。
- 步骤顺序：光照（14）→ **昼夜（14b）** → addition.ini（16）→ 离子风暴（16b）。
  昼夜会覆盖 `[Lighting]` 五个基础键，所以必须排在光照之后；离子风暴要写 `Ion*`，
  而 `ChangeLighting` 会删掉未显式给出的 `Ion*`，所以风暴必须排在昼夜之后。

## 七、已知限制

- **`Level` 改不了**（见第一节）；只有 `Ambient` + RGB 三通道能动。
- **RGB 百分比按 `channel × 100` 取整**（黄昏 Blue 1.19 → 119、夜里 Red 0.13 → 13）。
  ModEnc 只写了"to P2 percent"，没写上下限；这里按 0..200 夹取，超标值只是理论边界。
- **和静态光照重叠时以昼夜为准**：用户选了 `lighting.mode=preset hour=12` 又开了昼夜，
  开局显示的是昼夜第一档（不是 12 点）。前端有提示，接口不做报错。
- **每档只在"格子上挂 tag"**（中线格），格子上有没有建筑/单位都不影响触发，但这意味着
  如果地图后来被 `/api/split` 切片，`[CellTags]` 不会跟着走 —— 切片只切出生点单元，不复制 tag。
- **实战有效性未验证**：CI 里进不了游戏。若实机发现天色不变，排查顺序是
  ① `[Events]`/`[Actions]` 是否带数量前缀 ② `[Tags]` 持久值是否 2 ③ `[CellTags]` 是否挂了格子
  ④ Event 13 的秒数是否被读成帧数（如果是帧，实际时长会是设定值的 1/15）。
- 过渡是"瞬时切换"：没写 71/72（Set ambient step / rate）—— 那两条的参数是 float，
  ModEnc 没给明确量级，写错会把整段光照跑飞，所以宁可跳变也不冒这个险。
