# 随机离子风暴（Lightning Storm）

生成器可选功能：给地图加一场"过一段时间就劈一次"的闪电风暴。默认**关闭**，开启后
`POST /api/generate` 会把下面三段内容写进 `.map`。

## 一、为什么不用 `IonStorms=yes`

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

## 二、写进地图的内容

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
16=<Y><XXX>                  ; 风暴中心 = 地图正中

[Triggers]
0E000000=Neutral,<none>,Random Ion Storm,0,1,1,1,2   ; 末位 2 = 循环
[Events]
0E000000=13,0,600            ; 每 600 秒一场（randomize=true 时为 51,0,600）
[Actions]
0E000000=102,0,0,0,0,0,0,16  ; 第 7 个参数是 waypoint 编号
[Tags]
0E000001=2,RANDOM ION STORM,0E000000
```

触发器行的字段顺序照抄游戏自带模板地图（`packages/server/resources/MapUnits/*` 里
`spawn_s_*.map` 的 `[Triggers] 01000000=Americans,<none>,cell,0,1,1,1,0`）：
`House,<嵌套触发器>,名字,禁用?,简单,普通,困难,循环标志`。

## 三、与 FlyingZ 脚本的差异（有意为之）

| FlyingZ 脚本做的事 | 本功能 | 原因 |
| --- | --- | --- |
| `TechLevel=11` 写 `GACSPH/GAWEAT/NAIRON/NAMISL/YAGNTC/YAPPET` | **不写** | 那不是"禁用超级武器"，而是把 6 个超武强行开放到全科技等级；会覆盖玩家/规则里的设置 |
| `[LightningStormSpecial] DisableableFromShell=no` | **不写** | 该键只影响"禁止超级武器"勾选项是否关掉闪电风暴这个**超武**；本功能走 trigger，不改超武定义 |
| `LightningPrintText=false` | **不写** | YR 的 `rulesmd.ini` 里没有这个键（TS 遗留） |
| 数值 40 / 2000 / 2000 / 180 | **不用**，用原版 250 / 180 / 10 / 10 | 脚本那套是"面积覆盖全图、几乎打不死东西"的观赏型；本功能按原版实战强度 |
| 只触发一次（`Type` 末位 0） | **循环**（末位 2） | 需求是"周期性" |
| waypoint 放在 `(Width, Height)` 角落 | **地图中心** | 角落 + 散布会把一半的雷打在地图外 |

## 四、接口

`POST /api/generate` 新增可选体 `ionStorm`：

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `enabled` | boolean | `false` | 只有 `true` 才写任何风暴相关键 |
| `intervalSeconds` | 30..3600 整数 | `600` | 两场风暴之间的秒数 |
| `randomize` | boolean | `false` | `false` = Event 13 严格周期；`true` = Event 51，实际为 0.5~1.5 倍 |
| `values` | 对象 | 原版 | 可覆盖 `damage/deferment/duration/hitDelay/cellSpread/scatterDelay/separation` |

响应头 `X-Map-IonStorm`（JSON）回显：
`{"intervalSeconds":600,"randomize":false,"cell":{"x":72,"y":69},"eventId":13}`。

校验错误文案：

- `ionStorm must be an object`
- `ionStorm.enabled must be a boolean`
- `ionStorm.intervalSeconds must be an integer between 30 and 3600`
- `ionStorm.randomize must be a boolean`
- `ionStorm.values.<key> is not a known key (damage, deferment, duration, hitDelay, cellSpread, scatterDelay, separation)`
- `ionStorm.values.<key> must be a number between 0 and 1000`

## 五、实现要点

- `packages/core/src/ionstorm.ts`：`applyIonStorm(iniContent, options, width, height)`
  返回 `{ iniContent, ionStorm? }`。中心格优先取 `[Header]` 的真实 `Width/Height`
  （请求 150×150 实际生成 145×139，直接用请求尺寸会把中心算偏 5 格）。
- 必须在**环境光照之后**调用：`MapFile.ChangeLighting` 会把未显式给出的 `Ion*` 删掉。
- 生成器里挂在步骤 16b（光照 + `addition.ini` 合并之后、改名之前）。
- waypoint 编号取 `16`：两位数以内的编号在 action 参数里直接写十进制；
  超过 99 的 waypoint 在 FA2 的 action 参数里要写成两位字母编码，容易踩坑。

## 六、验收

- `scripts/verify-ionstorm.mjs`：**36 pass / 0 fail**（开关行为、七条原版数值、
  触发链格式、Event 13/51 切换、中心格、不写超武段、五种非法参数 400）
- core 单测：**219 pass / 0 fail**（`ionstorm.test.ts` 10 例）
- 生成后 cncmaps 渲染正常（`POST /api/cncmaps-preview` → 200 image/png）

## 七、已知限制

1. **风暴中心固定在地图正中**：Action 102 只认一个 waypoint，做不到"每次都换地方"。
   需要全图随机就只能放多个 trigger、各自不同 waypoint，风暴会各自独立触发（未做）。
2. 覆盖范围由 `LightningCellSpread`（原版 10）决定，不是全图；想扫全图要调大这个值。
3. 额外写了 `[Waypoints] 16`。**把这张图再走 `/api/split` 切片时，这个点会被当成出生点，
   多切出一个出生点单元**；只生成地图、不切片则无影响。
4. 触发链的字段顺序是从模板地图反推的（游戏自带 `spawn_s_*.map` 与 FA2 输出一致），
   但**没法在 CI 里进游戏验证**，实战效果需要开一局确认。
