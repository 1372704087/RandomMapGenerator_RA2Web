# RandomMapGenerator_RA2Web

红警2 / 尤里的复仇 随机地图生成器 - 网页版

将 [RandomMapGenerator_RA2](https://github.com/handama/RandomMapGenerator_RA2) 从 C# 移植到 TypeScript，并提供 Web 界面。

## 快速开始

```bash
# 安装依赖
pnpm install

# 构建核心库
pnpm build:core

# 启动后端 (端口 3000)
pnpm dev:server

# 启动前端 (端口 5173)
pnpm dev:web
```

打开 http://localhost:5173 即可使用。

### cncmaps 预览渲染服务（可选，端口 5174）

生成后的真贴图预览由同机运行的另一套渲染器提供；不启动时预览会失败但地图产出不受影响。

```powershell
# 需要设堆：500×500 地图的全尺寸画布约 4.4 亿像素，默认堆会 abort（exit 134 → 前端 502）
.\scripts\start-cncmaps-web.ps1 -GameDir 'F:\Red-Alert-2-Yuris-Revenge'
```

| env | 作用 |
| --- | --- |
| `CNCMAPS_WEB_PORT` | 渲染服务端口（默认 5174） |
| `CNCMAPS_GAME_DIR` | 指向含 `ra2.mix`/`language.mix` 的游戏目录，否则渲染 exit 1 |
| `NODE_OPTIONS` | 脚本设为 `--max-old-space-size=8192`，子进程继承 |

主后端可用 `CNCMAPS_WEB_URL` 指向别的渲染服务（默认 `http://127.0.0.1:5174`）。
预览结果按「地图内容 sha1 + 预览宽度」缓存在 `packages/server/.cache/cncmaps/`，
同一种子重复生成直接命中（1 s → 14 ms）；`CNCMAPS_CACHE_DIR` / `CNCMAPS_CACHE_BYTES`
（默认 512 MB，LRU 淘汰）可调。

渲染器在超大图上改为**按条带绘制**（`--band-height`，默认按画布宽度自动取，每片约 160 MB），
条带画完立刻降采样并拼进预览，所以 500×500（投影 2.9 万×1.5 万）不再需要 2.2 GB 画布：
实测峰值 1.6 GB、耗时 10 s（其中大部分是游戏资源和地图模型本身）。
`CNCMAPS_MAX_PIXELS`（默认 10 亿）只是拦住真正离谱的尺寸。

### 非温带/雪地的 theater 瓦片（城市 / 沙漠 / 新城市 / 月球）

原版 MapGenerator 只把 **温和** 和 **雪地** 两套 TMP 解包进 `Tile资源/`；城市、
沙漠、新城市的 `.urb` / `.des` / `.ubn` 瓦片还在游戏的 theater mix 里。RMG 的
recalc 要靠每张 TMP 的 Height / RampType 判断「这格有没有这一帧」，缺 TMP 会把
整张图擦成 `0xFFFF`（渲染出来是一片没有海岸和边框的沙地），所以先抽一次：

```powershell
node scripts/extract-theater-tiles.mjs --game-dir 'F:\Red-Alert-2-Yuris-Revenge'
# 只抽一套：--theater desert / urban / newurban / lunar
```

产物落在 `packages/server/resources/theater-tiles/<theater>/`（游戏素材，已
gitignore）。`Rmg.artDir()` 优先用游戏 `Tile资源/<theater>`，没有才回落到这个缓存；
两边都没有时后端会打一条警告并说明怎么抽。

#### 月球（LUNAR，theater index 5）

`lunarmd.ini` 是引擎自带、但原版随机地图从来不用的那一档（YR 的游戏里也调不到）。
本仓库把它作为扩展档接进来，走的是 VERA20k 的同一套语义：

- 引擎 `ReadTheater` 对 `LUNAR` 会把 `BridgeSet` / `WoodBridgeSet` /
  `CliffRanges.{CliffSet, WaterCliffs, BridgeSet, WoodBridgeSet}` /
  `RMGTiles.{WaterSet, ShorePieces, WaterBridge}` 七个全局清零
  （VERA20k `apply_lunar_global_zeroing`）。我们照做：`loadTheaterTiles` 末尾把
  这七个族置为 `-1`，也就是「该 theater 没有这一族瓦片」。
- 族索引为 `-1` 时必须按「不存在」处理，不能用 `tile >= base && tile < base+n`
  去比较 —— `-1` 比任何瓦片号都小，不设防的话整张地表的瓦片都会落进水域 / 海岸
  族的区间里（水面 14 个、海岸 42 个、四向瀑布各 4 个），流水线会把平地当成水，
  `growPatch` 反复失败并把格子回滚成 `tile = -1`。`inTileFamily()` 就是这道闸。
- 没有水域族 ⇒ 没有水可填：掷出来的 `waterAmount` 归零，`generateTerrain`
  的基础填充回落到 `ClearTile`（否则每格都盖 `-1`，后续陆地块只覆盖一部分，剩下
  的空格渲染成黑缝）。
- 枫叶光照沿用雪地表（`theater != 0` 走 snow lighting），月面偏冷白，与游戏里
  TS 月面一致。
- `CliffSet` 清零的连带影响：`shoreTileIndex` 变成 `-1` 之后，`hills.ts` 里两处
  悬崖族的比较也必须走 `inTileFamily()`。`-1` 基址下内联区间 `[-1, 38/39]` 会把
  `0` 号裸地（Clear）判成 CliffSet 立面，于是 `finalizeElevationSlopes` 的
  「相邻崖面 2 级以上」保护条件对裸地误命中、直接 `continue` 跳过整格（连
  `level` 都不写），`mergeSlopeBlocks` 的 `touchesArt` 判定也会误拒合并 ——
  结果是裸地之间留下 1 级台阶，预览里表现为黑色 V 形缺口（111×111 的图上约 8 处，
  只在月球出现，温带/城市/沙漠/新城市均为 0）。已修，修完月球「裸地-裸地 1 级差
  边」从 28 条降到 0 条，其余四档地图 SHA256 逐字节不变。
- **美术限制（不影响成图）**：`lunarmd.ini` 的 `HeightBase`（`hyte01..15`）与
  `Mrmfx01..12` 是 Tiberian Sun 的高度件，YR 的 `isolun.mix` / `isolunmd.mix`
  里没打包（逐条探针确认 MISSING）。月面靠 `RampBase` / `RampSmooth` 覆盖台阶，
  现有成图已无黑缝；这两个族只在 TS 地图里用得到。

## 项目结构

```
packages/
  core/      - 核心库（地图格式、压缩算法、数据模型）
  server/    - Express 后端 API
    resources/
      MapUnits/  - 预置地图单元片段（各 theater 地形）
      theater/   - theater 控制 INI 副本（temperatmd/snowmd/urbanmd/desertmd/urbannmd/lunarmd）
      theater-tiles/ - 城市/沙漠/新城市/月球的 TMP 瓦片缓存（脚本现抽，gitignore）
      rulesmd.ini / artmd.ini - 游戏规则配置
      minimap.ini - 小地图颜色配置
  web/       - React + Vite 前端界面
```

## 功能

- 支持 4 种地图主题：沙漠、新城市、温带、温带岛屿
- vera20k 管线（`/api/rmg/cxx/generate`）额外支持按 theater 表出图：温带 / 雪地 / 城市 / 沙漠 / 新城市 / 月球（引擎顺序 0..4，月球是 5 的扩展档）
- 可配置地图尺寸、玩家数量、游戏模式
- 建筑损坏/摧毁设置
- 污迹密度控制
- 城区生成（对齐 Ares 的 Create Urban Areas，挂在**原版 RMG 管线**）：`POST /api/rmg/cxx/generate` 传 `urbanAreas: true`（或数字=城区数量），按 gamemd `0x5A5020` 的顺序每区跑最多 10 轮「长路径（`0x5A5360`）→ 取包围盒 → 10 格步进铺**街道栅格**（`Proad` 多格图块逐子格盖章 + 中隔 + 两端 `p_end` 端头）」→ 街区里放城区建筑 → 车道上放载具、街边放步兵（写出 `[Units]` / `[Infantry]`）；规则见 [`re/specs/URBAN_AREAS.md`](re/specs/URBAN_AREAS.md)
- 自动生成缩略图预览
- 完全随机模式 / 手动配置模式
- 随机离子风暴（`POST /api/generate` 的 `ionStorm`）：按原版 `rulesmd.ini` 的闪电数值，在地图中心周期性起风暴（间隔可设 30-3600 秒，可切换"严格周期/随机窗口"），风暴期间切 `[Lighting] Ion*` 光照；不触碰任何超级武器设置。规则与实测见 [`re/specs/IONSTORM.md`](re/specs/IONSTORM.md)
- 环境光照（`POST /api/generate` 的 `lighting`）：24 个整点时刻 × 五套环境主题（温带/雪地/沙漠/新城市/岛屿），可 `preset` 写死、`random` 受种子约束抖动、`custom` 改单条通道；夜晚按「入夜→夜间→深夜→黎明」压暗（比 YR 苏联第 7 关的夜景更黑），不传则保持原版行为（只有沙漠随机写 `[Lighting]`）。规则与实测见 [`re/specs/LIGHTING.md`](re/specs/LIGHTING.md)
- 昼夜交替（`POST /api/generate` 的 `dayNight`）：把 24 小时压成一轮 60–7200 秒（默认 600 秒／4 档／06 点起），用一条环形触发器链（`Action 73` 改环境光 + `142/143/144` 改 RGB + `53/54` 启用/禁用下一档 + `Event 13` 计时）在**游戏内**循环切光；档数 2–24，24 档 = 逐整点（00…23）走一遍；开局那一刻的 `[Lighting]` 直接写成"当前钟点"的天色，所以进游戏第一眼就对。规则、完整 ini 与编码踩坑见 [`re/specs/DAYNIGHT.md`](re/specs/DAYNIGHT.md)
- 随机种子（`seed` + `X-Map-Seed` 回显）：同种子 ⇒ 逐字节相同的地图，见 [`re/specs/SEED_REPRO.md`](re/specs/SEED_REPRO.md)

## MapUnit 资源规范

`packages/server/resources/MapUnits/<THEATER>/` 下的手工地图单元改名与分组已规范化，规则见 [`re/specs/MAPUNIT_NAMING.md`](re/specs/MAPUNIT_NAMING.md)。

- 命名：`<label>_<kind>_<code4>_w<weight>_<seq>.map`（例 `bhut_t_FBBF_w1_01.map`）；`empty.map` / `indicator.map` / `cannotplacesmudge.map` 与 `*.ini` 不动。
- 目录：`_terrain/` `_spawn/` `_tiberium/` 是同一 theater 的分组，loader 递归读取；顶层 `_` 目录不会当成 theater。
- 索引与校验：`re/specs/MAPUNIT_INDEX.csv`（321 件，权重/接口都是从 `.map` 读出来的）

```bash
pnpm index:mapunits     # 重建索引
pnpm check:mapunits     # 校验磁盘与索引是否漂移（不一致 exit 1）
pnpm rename:mapunits    # 生成改名映射表（加 --apply 才落盘）
pnpm verify:theaters    # 五个 theater 各生成一张图，检查各节内容数
```

改完 `.map` 必须重建索引并提交 `MAPUNIT_INDEX.csv`；CI（`.github/workflows/mapunits.yml`）会在改动 `MapUnits/**`、`scripts/mapunit-*.mjs` 或索引 CSV 时自动跑 `check:mapunits`，索引与磁盘不一致则构建失败。

## 致谢

- [handama/RandomMapGenerator_RA2](https://github.com/handama/RandomMapGenerator_RA2) - 原始 C# 项目
- Olaf van der Spek for XCC and XWIS
- The OpenRA project
- All contributors to ModEnc
- The CNCMaps Renderer's maker zzattack.

## License

The MIT License

Copyright (c) 2024
