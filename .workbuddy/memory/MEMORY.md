# 项目长期笔记（ra2-web-mapgen）

## 仓库定位

handama/RandomMapGenerator_RA2（C#）的 TS 移植 + Web 界面。
pnpm workspace：`packages/core`、`packages/server`（Express）、`packages/web`（React+Vite）。

**两套并列的生成范式，不要合并：**

| | `packages/server/src/generator.ts` | `packages/core/src/rmg/**` |
|---|---|---|
| 范式 | 预置「地图单元」片段拼装 | 从零程序化构造 |
| 随机源 | `Math.random()` | 私有 RNG，种子 `MapSeed.seed` |
| 验收 | 风格相似 | 逐字节一致 |

## 当前主线（2026-10）：`packages/core/src/rmg/cxx/` 与 exe 对齐

目标：与 `G:\MapGenerator` 的 `MapGenerator.exe`（gamemd RMG 的 C++ 重写版）**同参数同种子 ⇒ .map 逐字节相同**。
模块映射与转译规则见 `packages/core/src/rmg/cxx/PORTING.md`，进度与分歧见 `cxx/README.md`。

- 陆型 0/1/2（群岛/大岛/大岛群）：✅ 全矩阵逐字节一致
- 陆型 3/4（内陆/山地）：🔴 **整图级别分歧（约 70% 格不同），远不止坡带**
  （⚠️ 不是 placeCliffs。RIDING / 悬崖 那些都是下游效应，别再往那儿挖了。见下「2026-10-10 重大修正」）
- 对拍：`re/oracle/run_mapgenerator.ps1`（exe）、`re/cxx_port/run_ts.cjs`（TS）、`re/cxx_port/compare_matrix.cjs`（矩阵）
- 回归：`src/test/rmgCxxParity.test.ts`（golden `rmgcxx_seed00ff01eb.map/.diag.log`，无 G:/ 资源时 skip）
- 诊断日志 DiagLog 是命脉：每个调用点 1:1 保留，逐字符相同
- **最小复现**：seed `05CC51D7` env=3 size=0 ore=0 → .map 12054 格中 9004 格不同（≈75%，非早前估的 8856）；
  首个 diag 分歧是 `RAMP-SIDE-CANCEL`（行 10419），但那是**下游表现**，根因在上游 env3/4 结构性阶段（见上）。
  这个 bug **挑种子**：seed `016B4FD0` 下坡道阶段两端一致，分歧要拖到 RIDING 第 47 条才现形。

**已机械核对与 exe 一致（全部排除，脚本在 `.tmp_oracle/`，详见 2026-10-09 日志）**：
placeCliffs 驱动、CellIterator、cliffPass、cliffMask、placeCliffPiece slot 级联、
kCliffFootprints、cliffPieceHitsRamp、isCliffWallRiding、placeIsoTile、
SideHighClash（0x14001FE30 块）、快照参数（x-20/y-20/41×41）、三套方向表 + 两张斜坡表。

**2026-10-10 重大修正（推翻旧「只剩 RampBuilder 坡带」假设）**：
用 4 个 exe 真实种子做同参数 1:1 对拍后，量化证据显示 env3/4 的分歧是**整图级别**，
而非局部坡带。关键测验（脚本均在 `.tmp_oracle/`）：
- **位移搜索** `shift_search.cjs`：把 TS 整图相对 exe 平移 ±2 格，差异格不降反升（9181→12000+）→ 排除「坐标系整体偏移」。
- **tile 差非固定表基址** `analyze_delta.cjs`：level-same 格的 `ts.TileNum-exe.TileNum` 在 [-520..521] 宽幅散布 → 排除「tile 表整体偏移一格」。
- 差异拆解：最大一桶是「**高度相同、仅 tile 不同**」(~4800 格)，高度差多为 ±1（局部扰动，非全局恒定偏移）。
- **可见「缺口」不是越界 tile** `gap_locator.cjs`：05a/05c 各自仅 1 个越界 tile 且位置不重合 → 缺口是合法 tile 摆错位置的地形缺陷，属整图分歧里最显眼处。
→ **根因应在 env3/4 专属的早期/结构性阶段**（高度场/elevation、或地形类型判定 water/shore/ground/cliff），
   而非晚期的 RampBuilder。env0/1/2 仍逐字节一致，说明 bug 在 env3/4 独有代码路径。
**下一步方向**：比对高度场形状 + 地形类型 mask（water/shore/ground/cliff）的 exe vs TS 差异，
   定位首个分叉阶段；重点查 elevation/hill/mountain 生成（内陆/山地专属的地形塑形阶段）。

老的 `packages/core/src/rmg/**`（非 cxx）是 gamemd 19 阶段逆向移植，只有阶段 0/1/2 落地，
地形阶段 3–19 未实现且无任何逐格 golden ⇒ 一律标 UNVERIFIED。

## 构建 / 验证命令（本机精确写法）

bash 里 PATH 不全，`node` / `git` 都要绝对路径：

```bash
export PATH="/c/Users/Administrator/.workbuddy/binaries/PortableGit/versions/1.2.0/usr/bin:/c/Windows/System32:/c/Windows"
NODE="/c/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-6/node.exe"     # 注意是 -6 不是 -3
GIT="/c/Users/Administrator/.workbuddy/binaries/PortableGit/versions/1.2.0/cmd/git.exe"

cd /g/ra2-web-mapgen/packages/core  && "$NODE" node_modules/typescript/bin/tsc && "$NODE" --test "dist/test/**/*.test.js"
cd /g/ra2-web-mapgen/packages/server && "$NODE" node_modules/typescript/bin/tsc
cd /g/ra2-web-mapgen/packages/web    && "$NODE" node_modules/typescript/bin/tsc --noEmit && "$NODE" node_modules/vite/bin/vite.js build
```

- 长命令一律 `run_in_background`（前台偶发被 SIGTERM 且无输出）。core 全套约 65s。
- 直接调 `git.exe` 会被沙箱拦；PowerShell 工具在本机输出恒为空，取不到 git 结果。
- 基线：core **262 tests / 261 pass / 1 fail**（fail 项未定位）。

## 两个访问入口

`packages/server/src/index.ts` 启动时 `fs.existsSync(web/dist)`，存在就 `express.static` 托管：

| 入口 | 来源 | 改前端要重建？ |
|---|---|---|
| `http://localhost:3000/` | `packages/web/dist` | **要** |
| `http://localhost:5173/` | vite dev + HMR，`/api` 反代 3000 | 不用 |

`express.static` 请求时读盘，重建后 3000 无需重启。`/api/*` 先注册，不冲突。

## 后端接口（packages/server/src/index.ts）

`GET /api/health`、`GET /api/theaters`（对象数组取 `.name`）、`GET /api/theaters/:name/info`、
`POST /api/generate`、`POST /api/split`、`POST /api/split/detect`、`POST /api/preview`、
`GET /api/rmg/meta`、`POST /api/rmg/derive`、`POST /api/rmg/sed/read`、`POST /api/rmg/sed/write`、
`POST /api/rmg/generate`。

`POST /api/generate` 的字段名是 **`playerLocations`**（不是 `players`），结构 `{N,S,W,E,NE,SE,NW,SW}`；
`totalRandom: true` 时**不要**传该字段。

## 切片契约：必须按源地图自身的 theater

切片参数按目录不同：**TEMPERATE 15x15 / TopCorner 13,13**；DESERT、NEWURBAN 25x25 / 18,18；
**TEMPERATE_Islands 30x30 / 25,25**。选错 ⇒ 地形错位。
（实测同一张 90×90 温带图：自动 15x15 = 89 张，手选 DESERT = 39 张。）

权威来源 = 地图的 `[Map] Theater=`。`splitter.ts` 提供 `detectMapTheater` /
`resolveTheaterDir`（**优先目录名与引擎名精确相等**，解决 TEMPERATE 与 TEMPERATE_Islands 撞名）/
`detectTheater`。`/api/split` 的 `autoTheater` 默认 true，返回 `theaterDir` / `detectedTheater` /
`theaterSource` / `warnings`，前端原样展示不自行推导。

`frame`（网页层默认 true，core `MapSplitOptions.frame` 默认 false）：用各 theater 自己的 `empty.map`
给切片画窗外框。已机器证明惰性（窗外格不参与读取）：覆盖率 27%→66%，窗口内逐格不变。
**红线**：框只写窗口外、必须晚于 indicator、`TileNum===-1` 过滤；块内 −1 是显式记录，动一格就变模型。

## 前端结构（packages/web/src）

`App.tsx`（hash 路由 `#/generate` `#/split` `#/rmg`）、`pages/{Generate,Split,Rmg}Page.tsx`、
`api.ts`（所有接口封装，**新页面一律走它，不要内联 fetch**）、`components/MapPreviewCanvas.tsx`、
`styles.css`（单文件，军事风；新控件追加到文件末尾分区注释下）。

## 已知坑

1. RMG 选项构造器默认值可能落在 clamp 外（`tiberium` 默认 0/下限 1；`seed` 默认 −1/下限 0）
   ⇒ 表单用 `<form noValidate>`，别靠 input 的 min/max 原生校验（会拦死整个 submit）。
2. 前端 payload 字段名必须对齐 server 校验（`playerLocations` 曾写成 `players` 导致恒 400）。
3. `damagedBuilding` 后端接受 `boolean | {min,max,destroyP}`，类型别写成 `boolean`。
4. 无头 Edge 挂在 `&` 后台任务里会随任务结束被回收，跨任务连 CDP 会 ECONNREFUSED
   ⇒ 同一条命令里「起 Edge → 跑 CDP 脚本」。

## 逆向资产（接地形阶段前必读，不需要 IDA）

- 20 份 RMG Ghidra 报告 ≈690KB：`G:\vera20k-main\docs\research\skirmish-ui\RMG_*_GHIDRA_REPORT.md`
- Rust 参考实现：`G:\vera20k-main\src\map\rmg\`（`pipeline.rs` 头部 `STAGE_ORDER` 是权威阶段序）
- **exe 完整反汇编**：`.tmp_oracle/exe_disasm.txt`（5.6MB，本仓库内）；按函数名 `sed` 切段即可
- 真机二进制：`F:\Red-Alert-2-Yuris-Revenge\gamemd.exe`（4,813,072 B / MD5 `fe2301a1f48841aa084aade100b25335`）
- oracle（unicorn 跑真机代码）：`G:\vera20k-main\tools\rmg_oracle\harness.py`，
  需 `RA2_DIR`；包在 `C:/Users/Administrator/.workbuddy/binaries/python/pkgs`。
  **LF 坑**：`write_text` 在 Windows 写 CRLF，写完要 `tr -d '\r'` 归一化。
- `.data` 段 bss 尾部的全局（g_WaterSet_TileSetBase 等）文件映像读出全 0，只有运行时有值；
  有初始化函数的可在 unicorn 里调完再 dump，由 theater INI 填的只能从游戏数据取。

**真缺口是 golden**：`tools/rmg_oracle/vectors/` 只有 `rng.json` + `x87.json`，
地形阶段没有任何逐格 golden ⇒ 一律 UNVERIFIED。

## 可视化验收（本机方案）

没装 agent-browser。用系统 Edge + CDP：

```bash
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu \
  --user-data-dir=<tmp> --remote-debugging-port=9223 about:blank &
```

Node 22 自带全局 `WebSocket` 直连 CDP（零依赖）。React 受控组件要用
`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set` + `dispatchEvent(new Event('input',{bubbles:true}))`。
