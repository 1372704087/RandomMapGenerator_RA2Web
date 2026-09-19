# 项目长期笔记（ra2-web-mapgen）

## 仓库定位

handama/RandomMapGenerator_RA2（C#）的 TS 移植 + Web 界面。
pnpm workspace：`packages/core`（核心库）、`packages/server`（Express API）、`packages/web`（React+Vite）。

**两套并列的生成范式，不要合并：**

| | `packages/server/src/generator.ts` | `packages/core/src/rmg/**` |
|---|---|---|
| 范式 | 预置「地图单元」片段拼装 | 从零程序化构造（gamemd 精确管线） |
| 随机源 | `Math.random()`（不可复现） | 私有 RNG，种子 = `MapSeed.seed` |
| 验收 | 风格相似 | 逐字节一致 |

## 构建 / 验证命令（本机精确写法）

`node` 必须自带 PATH 前缀（bash 环境里 PATH 不全）：

```bash
export PATH="/c/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-3:/c/Users/Administrator/.workbuddy/binaries/PortableGit/versions/1.2.0/usr/bin:/c/Windows/System32:/c/Windows"
cd /g/ra2-web-mapgen/packages/core  && node node_modules/typescript/bin/tsc && node --test "dist/test/**/*.test.js"
cd /g/ra2-web-mapgen/packages/server && node node_modules/typescript/bin/tsc
cd /g/ra2-web-mapgen/packages/web    && node node_modules/typescript/bin/tsc --noEmit && node node_modules/vite/bin/vite.js build
```

- 长命令一律 `run_in_background`（前台偶发被 SIGTERM 且无输出）。
- web 的 `package.json` 里 `build` 是 `tsc && vite build`；曾经长期是坏的（见下「已知坑」）。

## 两个访问入口（别搞混）

`packages/server/src/index.ts` 启动时会 `fs.existsSync(web/dist)`，存在就用 `express.static` 托管，
所以有**两套并行入口**：

| 入口 | 内容来源 | 改了前端要不要重新构建 |
|---|---|---|
| `http://localhost:3000/` | `packages/web/dist`（构建产物） | **要**，否则看到旧版 |
| `http://localhost:5173/` | `src/`（vite dev + HMR，`/api` 反代到 3000） | 不用 |

后端进程启动时只判断一次 `dist` 是否存在，但 `express.static` 是请求时读盘，
所以重新 `vite build` 后 **3000 入口无需重启**即可生效。
`express.static` 之前 `/api/*` 路由已注册，因此两者不会冲突。

只想起后端：`packages/server/dist` 必须是新的（`node node_modules/typescript/bin/tsc` 后 `node dist/index.js`）；
项目自带 `pnpm dev:server`（tsx watch）与 `pnpm dev:web`。

## 后端接口清单（packages/server/src/index.ts）

| 接口 | 用途 |
|---|---|
| `GET  /api/health` | 健康检查 |
| `GET  /api/theaters` | theater 列表（返回对象数组，取 `.name`） |
| `GET  /api/theaters/:name/info` | 单个 theater 详情 |
| `POST /api/generate` | 预置拼装生成地图 → `.yrm` 文件流 |
| `POST /api/split` | 完整地图 → 若干 `.map` 切片（JSON，**默认自动识别 theater**） |
| `POST /api/split/detect` | 只从地图文本识别 theater，不拆解 |
| `GET  /api/rmg/meta` | RMG 字段元数据 / 默认值 / RMGMD 缺省 / 阶段状态 |
| `POST /api/rmg/derive` | RMG clamp + 尺寸推导 |
| `POST /api/rmg/sed/read` | 读 `.SED` 还原选项（carry-default，不 clamp） |
| `POST /api/rmg/sed/write` | 选项写出 `.SED` |
| `POST /api/rmg/generate` | 跑 RMG 管线产出地图（当前为 S1 骨架） |

`POST /api/generate` 的请求体字段名是 **`playerLocations`**（不是 `players`），
结构 `{N,S,W,E,NE,SE,NW,SW}`；`totalRandom: true` 时**不要**传该字段
（传全 0 对象会让后端不触发随机出生点）。

## 切片必须按源地图自身的 theater（重要契约）

切片参数（`MapUnitSize` / `TopCorner` / indicator 图块）**按 theater 目录不同而不同**：

| 目录 | MapUnitSize | TopCorner |
|---|---|---|
| TEMPERATE | **15x15** | 13,13 |
| DESERT | 25x25 | 18,18 |
| NEWURBAN | 25x25 | 18,18 |
| TEMPERATE_Islands | **30x30** | 25,25 |

选错 theater ⇒ 按错的单元尺寸切 ⇒ 切片地形错位、无法被生成器复用。
实测同一张 90×90 温带图：**自动（15x15）= 89 张，手动选 DESERT（25x25）= 39 张**。

权威来源是地图自己的 `[Map] Theater=`。`packages/server/src/splitter.ts` 提供：

- `detectMapTheater(content)` —— 读 `[Map] Theater`（先走 IniFile，失败退回逐行扫）
- `resolveTheaterDir(engineName)` —— 引擎名 → 本地目录。**优先「目录名与引擎名精确相等」**，
  这一条同时解决了 `TEMPERATE` / `TEMPERATE_Islands` 的撞名（两者 settings.ini 的 `Theater` 都是 `TEMPERATE`）。
- `detectTheater(content)` / `buildTheaterWarnings(...)` —— 组合入口与告警文案

`POST /api/split` 的 `autoTheater` **默认 true**（不传 `theaterType` 也行）；
返回 `theaterDir` / `detectedTheater` / `theaterSource` / `warnings`，前端原样展示、不自行推导。
本地没有该地形（如 SNOW / URBAN）时自动模式返回 400 并列出可用目录；手动覆盖仍允许，但会带告警。

`frame` 参数（**网页层默认 true**，core 的 `MapSplitOptions.frame` 默认 false）：
用各 theater 自己的 `empty.map` 给切片画**窗外框**（手工单元同款画法）。
窗外格对生成器不可见（`AbstractMapUnit` 只读 `[SX,SX+W)×[SY,SY+H)`），已机器证明惰性：
开框后平均覆盖率 27%→66%，窗口内逐格不变，indicator 不被覆盖。
**红线**：框只允许写窗口外、必须晚于 indicator 写、用 `TileNum===-1` 过滤；
块内的 −1 是显式记录（非缺格），改一个格都会变单元模型（verify-split 有牙齿断言）。

前端 `SplitPage.tsx` 默认勾选「按地图内容自动识别地图类型」，粘贴/上传后防抖 350ms 调
`/api/split/detect` 并展示 `地图 Theater → 使用目录`；取消勾选才出现手动下拉，且与识别结果不符时显示错配告警。

## 前端结构（packages/web/src）

- `App.tsx`：外壳 + 页签导航，hash 路由（`#/generate`、`#/split`、`#/rmg`）。
- `pages/GeneratePage.tsx`、`pages/SplitPage.tsx`、`pages/RmgPage.tsx`。
- `api.ts`：所有接口封装 + 类型 + `downloadText`。**新页面一律走 api.ts，不要内联 fetch**。
- `styles.css`：单文件样式，军事风（金 + 深蓝 / 深灰）。新增控件请追加到文件末尾的分区注释下。

## 已知坑（踩过的）

1. **RMG 选项的构造器默认值可能落在 clamp 范围外**（`tiberium` 默认 0 / 下限 1；
   `seed` 默认 −1 / 下限 0）⇒ 表单**不要**靠 input 的 `min/max` 原生校验拦提交
   （会把整个 form 的 submit 拦死）。用 `<form noValidate>` + 就地提示会被收敛成多少。
2. **改前端 payload 字段名要对齐 server 的校验**：`playerLocations` 曾经被前端写成 `players`，
   导致手动配置玩家时恒 400；随机模式又因传全 0 对象导致 0 出生点。
3. web 的 `damagedBuilding` 字段后端接受 `boolean | {min,max,destroyP}`，类型别写成 `boolean`。

## RMG 当前边界（务必如实转述，不要美化）

20 个阶段只有 **0/1/2** 落地（播种 RNG、map-prep、读 RMGMD.INI）；
地形阶段 **3–19 未实现**（水体→区域→台地→桥→绿地→起点→矿场→山丘→LAT→雷达）。
⇒ `/api/rmg/generate` 产出 **S1（map-prep）骨架**：尺寸/Theater/cell 初态正确，地块未赋值。
响应里的 `outputLevel` / `missing` / `stages` 必须原样展示给用户。
位精确 parity 目前只有 RNG 与 Box-Muller 有真机 golden，地形阶段一律 **UNVERIFIED**。

阶段表、抽数契约、x87/RNG 硬事实见 `packages/core/src/rmg/README.md`。

## 逆向资产地图（接阶段 3–19 前必读）

**不需要 IDA。** 阶段 3–19 的逆向规格书已经存在，而且是反编译级别的：

| 资产 | 位置 | 说明 |
|---|---|---|
| 20 份 RMG Ghidra 报告（≈690KB） | `G:\vera20k-main\docs\research\skirmish-ui\RMG_*_GHIDRA_REPORT.md` | 逐地址覆盖：水体 0x0059A6C0(73KB)、水尾/桥 0x005A0160(52KB)、3/4 型水桥(85KB)、地形塑形核心(52KB)、区域划分 0x0058CF90(30KB)、区域分裂 0x0058D620(39KB)、桥连接 0x0058EF10(44KB)、桥坡/崖面 0x00578E60(27KB)、悬崖落差/水砖重锚(30KB)、河曲(28KB)、山丘角点(27KB)、起点 0x00594B50(30KB)+评分(22KB)、矿场 0x005A23A0(29KB)+门控复核(25KB)、Zone 子系统(24KB)、WaterAmount 派生(27KB)、x87 契约(11KB)、RNG 播种(20KB)、未消费选项(23KB) |
| Rust 参考实现 | `G:\vera20k-main\src\map\rmg\` | 顶层 19 文件（pipeline.rs 38KB / build.rs 36KB / preview.rs 32KB / tiles.rs / x87.rs / grid.rs / emit.rs…）+ `phases/` 29 个阶段文件（water、water_finalize、regions、zones、carve、carve_driver、connector、ramp、bridge、bridge_deck、meander、river、shore、lake、island_passes、hills、hills_corners、green_spread、adjacency、area、blob、lat_fixup、lat_patches、rocks、trees、tiberium、starts、tech_buildings）|
| 原生阶段序（权威） | `pipeline.rs` 头部 `STAGE_ORDER` | water → finalize → regions → green spread → recalc → starts → tech → tiberium → region reset → recalc → hills → patches → recalc → trees → rocks → recalc（emit 由调用方做；三个 recalc 都是 `lat_fixup`，无 RNG） |
| 零售目标二进制 | `F:\Red-Alert-2-Yuris-Revenge\gamemd.exe`（另有 `F:\RA2YRLauncher\gamemd.exe`） | **指纹与目标完全一致**：4,813,072 B / MD5 `fe2301a1f48841aa084aade100b25335` ✓；`vera20k/config.toml` 的 `ra2_dir = "H:/Red-Alert-2-Yuris-Revenge"` |
| oracle（真机 golden 生成器） | `G:\vera20k-main\tools\rmg_oracle\harness.py`（unicorn 跑真机代码）+ `gen_rng_vectors.py` / `gen_x87_vectors.py` | 需 `VERA20K_GAMEMD_EXE` 或 `RA2_DIR` 环境变量；FPU 控制字 `NATIVE_FPCW = 0x0E7F`；`IMAGE_BASE=0x00400000`、`STACK_BASE=0x10000000`、`SCRATCH=0x20000000`、`RET_MAGIC=0x30000000` |
| IDA 数据库 | `F:\Red-Alert-2-Yuris-Revenge\gamemd.exe.i64`（71MB） | 已有的库文件，随时可开；本机常见安装路径没找到 IDA 本体 |
| 复核工具 | 技能 `gamemd-binary-static-verify` | 自写 PE32 探针 + capstone 定点反汇编 + 精确有理数算术，专门用于「不装 Ghidra/IDA 也能量化复核既有结论」 |

**真缺口（不是反汇编质量，是 golden）**：
`vera20k/tools/rmg_oracle/vectors/` 只有 `rng.json`(12KB) + `x87.json`(2.6KB)。
`tests/fixtures/retail_goldens/manifest.json` 是 **MIX/资源解码**的指纹表，**不含 RMG cell 网格**。
⇒ 地形阶段目前**没有任何逐格 golden**，因此一律只能标 UNVERIFIED。
唯一正路：用 oracle 自己造「固定 `.SED` → 真机逐格 tile/subTile/level/overlay」的向量。

**IDA 唯一值得开的场景**：LAT 装饰 pass（`packages/core/src/rmg/README.md` 点名的语料缺口）。
但先读 vera20k 的 `phases/lat_patches.rs`(15KB) + `lat_fixup.rs`(14KB)，只在仍有分歧时才开 i64。

### oracle 使用（本机已实测跑通，2026-09-18）

unicorn 装在**隔离 --target 目录**（managed python 的 `venv` 在本机建不出 `Scripts/python.exe`，别用 venv）：

```bash
export PATH="/c/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-3:/c/Users/Administrator/.workbuddy/binaries/PortableGit/versions/1.2.0/usr/bin:/c/Windows/System32:/c/Windows"
PY="/c/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/python.exe"     # 实际 3.13.14
export PYTHONPATH="C:/Users/Administrator/.workbuddy/binaries/python/pkgs"             # unicorn 2.1.4
export RA2_DIR="F:/Red-Alert-2-Yuris-Revenge"
cd /g/vera20k-main/tools/rmg_oracle
"$PY" harness.py            # 冒烟：Random__Seed 0x0065C6D0 → eax=0x20000000, idx=0/103
"$PY" gen_rng_vectors.py    # 重放，与已提交 golden 语义一致（见下 LF 坑）
```

**LF 坑（重要）**：`harness.write_vectors` 用 `Path.write_text`，在 Windows 会写成 **CRLF**，
而已提交的 `vectors/*.json` 是 LF ⇒ 重跑会脏化行尾。写完要 `tr -d '\r'` 归一化；
自己也别用 `grep -c $'\r'` 验行尾（在 Git Bash 里 `$'\r'` 会退化成字母 r，数字是假的），要用 Python 数 `b"\r\n"`。

### 表在 `.data` 的 bss 尾部 —— 不能静态 dump

实测（`probe_tables.py`）：下面这些全局**文件映像读出全是 0**，只有运行时才有值：

| 全局 | 地址 | 取值来源 |
|---|---|---|
| `g_WaterSet_TileSetBase` | `0x00AA0738` | theater INI/MIX |
| `DAT_00AA073C` / `DAT_00AA1050` / `DAT_00ABB110` | 同段 | theater INI/MIX |
| `g_GreenTile` | `0x00AA0E18` | theater INI/MIX |
| `g_BridgeSet_TileSetBase` | `0x00AA0E28` | theater INI/MIX |
| `g_nCliffSet_TileSetBase` | `0x00AA1020` | theater INI/MIX |
| `g_WoodBridgeSet_TileSetBase` | `0x00ABAD1C` | theater INI/MIX |
| `g_DirectionOffsets` | `0x0089F688` | **初始化函数 `0x0049F2F0`**（已抓成 golden）|

⇒ 两条路：**有初始化函数的** → 在 unicorn 里调完再 dump（模式已验证）；
**由 theater INI 填的** → 代码路线取不到，只能从游戏数据（theater INI/MIX）取。
`g_ClearTile` / `g_RampBase` 的符号地址尚未定位（报告只给使用点 `0x006B3850`）。

### 已产出的新 golden

`packages/core/src/test/fixtures/rmg_direction_offsets.json`（LF）+ `src/test/rmgDirectionOffsets.test.ts`。
生成器：`G:\vera20k-main\tools\rmg_oracle\gen_direction_offsets_vector.py`（调 `0x0049F2F0` 后 dump 32B）。
内容与 Ghidra 报告 `RMG_BRIDGE_RAMP_CLIFF_FACE_00578E60` §7 声称的 8 个常量**逐项一致** ——
即「邻遍历次序 N,NE,E,SE,S,SW,W,NW」现在是机器派生 + 受测守卫，不再是注释里的约定。
core 测试基线随之从 102 → **106**。

## 可视化验收（本机可行方案）

本机**没装** agent-browser（装它要拉 ~500MB Chromium）。用系统自带 Edge 即可：

```bash
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu \
  --user-data-dir=<tmp> --remote-debugging-port=9223 about:blank &
```

再用 Node 22 自带全局 `WebSocket` 直连 CDP（零依赖）做真实交互 + 截图：
`Page.navigate` → `Runtime.evaluate`（React 受控组件要用
`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set` + `dispatchEvent(new Event('input',{bubbles:true}))` 才能触发 onChange）→
`Page.captureScreenshot`，下载落盘用 `Browser.setDownloadBehavior`。
Edge 实例随父 shell 退出消失，不会影响用户自己开的浏览器。
