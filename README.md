# iKanban

[English](./README.en.md) | 简体中文

iKanban 是一个面向键盘操作、基于 [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) 的多智能体编码工作空间。它专为跨项目地驱动、审查和协调并行智能体工作而构建，将会话管理、差异审查和项目感知导航集于一处。

本 monorepo 包含公开发布的 DSH bundle，以及完整浏览器界面的私有可编辑 fork。

## 介绍视频

以下视频介绍了 iKanban 最初的工作流及其贯穿 `v0.3` 系列版本的演进。这些视频早于当前基于 DSH 的软件包，因此安装步骤和部分界面可能有所不同。

**Bilibili 视频：** [为什么做它](https://www.bilibili.com/video/BV1t9AhztEjX/) · [v0.1](https://www.bilibili.com/video/BV1W3Pgz8ExJ/) · [v0.2](https://www.bilibili.com/video/BV1ZNP1znEn5/) · [v0.2.11 如何使用](https://www.bilibili.com/video/BV1Y9wMzKE2b/) · [v0.3](https://www.bilibili.com/video/BV1n9QEBSEch/) · [v0.3.14](https://www.bilibili.com/video/BV1zy3F6aEb2/)

## 软件包

- [`@isomoes/dsh-ikanban`](packages/ikanban) - 公开发布的 DSH bundle、宿主适配器、生成的组合配置和浏览器构建产物
- [`packages/web-ui`](packages/web-ui) - 完整浏览器插件界面和 Vite shell 的私有可编辑 TS/TSX/CSS fork

## 使用方法

### 1. 安装 DSH

首先通过 npm 全局安装 DeepSeek Harness CLI：

```bash
npm install -g @deepseek-ai/dsh --registry=https://registry.npmjs.org
```

中国大陆用户可以将命令中的 npm 官方 registry 替换为国内镜像，例如
`https://registry.npmmirror.com`。镜像同步可能存在延迟；如果需要最新发布的版本，请使用官方地址 `https://registry.npmjs.org`。

### 2. 安装 iKanban

将已发布的插件安装到 `ikanban` profile 中。如果该 profile 尚不存在，`dsh plugin` 命令会自动创建：

```bash
dsh plugin --profile ikanban add @isomoes/dsh-ikanban --registry=https://registry.npmjs.org
```

这里的 `--registry` 同样可以替换为国内镜像；需要最新 iKanban 版本时请使用 npm 官方 registry。

### 3. 运行 iKanban

通过该 profile 启动 iKanban：

```bash
dsh --profile ikanban
```

发布历史请参阅 [CHANGELOG.md](CHANGELOG.md)。当前架构与产品演进记录保留在以下文档中：

**版本文档：** [`v0.4.2` 当前架构与基础功能](docs/0.4.2.md) · [`v0.1.6` 到 `v0.2.7`](docs/0.1.6TO0.2.7.md) · [`v0.2.7` 到 `v0.3.1`](docs/0.2.7TO0.3.1.md) · [`v0.3.1` 到 `v0.3.14`](docs/0.3.1TO0.3.14.md)

## 开发

```bash
pnpm install
pnpm typecheck
pnpm build
```

构建项目，将当前 checkout 以链接方式安装到隔离的 `ikanban-dev` DSH profile，然后运行：

```bash
pnpm dev
```

`pnpm dev` 会自动创建或刷新 profile。使用 `pnpm dev:config` 可以在不启动应用的情况下检查最终组合配置。该命令通过 tsdown 监视所有 fork 后的客户端 bundle，并通过 Vite 监视浏览器 shell。客户端变更会热重载对应的虚拟 DSH 软件包；shell 变更会复制到链接的软件包中，需要刷新浏览器。

有关重新构建行为和 profile 清理方式，请参阅软件包的[开发指南](packages/ikanban/README.md#local-development)。
