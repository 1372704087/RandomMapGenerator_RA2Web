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
