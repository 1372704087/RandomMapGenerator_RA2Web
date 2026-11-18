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

## 项目结构

```
packages/
  core/      - 核心库（地图格式、压缩算法、数据模型）
  server/    - Express 后端 API
    resources/
      MapUnits/  - 预置地图单元片段（各 theater 地形）
      rulesmd.ini / artmd.ini - 游戏规则配置
      minimap.ini - 小地图颜色配置
  web/       - React + Vite 前端界面
```

## 功能

- 支持 4 种地图主题：沙漠、新城市、温带、温带岛屿
- 可配置地图尺寸、玩家数量、游戏模式
- 建筑损坏/摧毁设置
- 污迹密度控制
- 自动生成缩略图预览
- 完全随机模式 / 手动配置模式

## 致谢

- [handama/RandomMapGenerator_RA2](https://github.com/handama/RandomMapGenerator_RA2) - 原始 C# 项目
- Olaf van der Spek for XCC and XWIS
- The OpenRA project
- All contributors to ModEnc
- The CNCMaps Renderer's maker zzattack.

## License

The MIT License

Copyright (c) 2024
