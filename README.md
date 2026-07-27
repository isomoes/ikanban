# ikanban

[English](./README.en.md) | 简体中文

iKanban 是一个由 [OpenCode](https://opencode.ai) 驱动的多智能体（multi-agent）编码工作空间。它专为跨项目地驱动、审查和协调并行的智能体工作而构建，将会话管理、差异（diff）审查以及项目感知的导航集于一处。

**Bilibili 视频** [为什么做它](https://www.bilibili.com/video/BV1t9AhztEjX/) [v0.1](https://www.bilibili.com/video/BV1W3Pgz8ExJ/) [v0.2](https://www.bilibili.com/video/BV1ZNP1znEn5/) [v0.2.11 如何使用](https://www.bilibili.com/video/BV1Y9wMzKE2b/) [v0.3](https://www.bilibili.com/video/BV1n9QEBSEch/)

<details>
  <summary>界面截图</summary>

  <img width="3258" height="1460" alt="Image" src="https://github.com/user-attachments/assets/2dc21dcc-124e-4a89-9577-357ebe30b8f0" />

  <img width="3688" height="1988" alt="Image" src="https://github.com/user-attachments/assets/c94c5114-b55c-4cd6-959b-f16a4ba4ff8b" />
</details>

## 当前功能

| 功能 | 说明 |
| --- | --- |
| 📋 会话面板 | 在主页集中查看和切换多个项目中的活跃会话。 |
| 💬 智能体对话 | 显示工具类型、调用耗时、会话总时长以及 MCP 工具结果，并支持键盘滚动。 |
| ✍️ 提示词编辑 | 可展开的响应式编辑器，支持长任务描述和中英文界面。 |
| 🔍 代码审查 | PR 风格的项目差异视图，包含变更统计、文件筛选、已读进度、历史会话及补丁差异。 |
| 🌐 远程控制 | 连接本地、远程、WSL 或 SSH 隧道中的 OpenCode，支持 HTTP、Basic 认证和多服务器切换。 |
| 🔄 状态同步 | 每个浏览器标签页独立保留服务器选择，并通过 OpenCode 同步会话归档状态。 |
| 📱 响应式界面 | 适配桌面、移动端和全屏模式，并提供无障碍交互与快捷键导航。 |

## 快速开始

### 方式一：使用托管应用（推荐）

打开：https://isomoes.github.io/ikanban

启动 OpenCode，并为 GitHub Pages 开启 CORS：

```bash
opencode serve --port <PORT> --cors https://isomoes.github.io
```

然后在设置中添加你的服务器地址：`http://localhost:<PORT>`。

### 方式二：使用 npx 在本地运行

```bash
npx ikanban-web@latest                        # 在端口 3000 上启动
npx ikanban-web@latest --port 8080            # 自定义端口
OPENCODE_URL=http://myserver:4096 npx ikanban-web@latest  # 外部 OpenCode 服务器
```

## 远程控制智能体

iKanban 是一个 Web 前端，可连接到任意机器上运行的 OpenCode 服务器（本地、远程主机、SSH 隧道或 WSL）。这让你可以从浏览器远程驱动智能体：创建/管理会话、发送提示词、审批权限请求、查看工具结果，以及审查当前和历史差异。

在远程主机上启动 OpenCode 并开启 CORS，即可从托管应用连接：

```bash
opencode serve --port <PORT> --cors https://isomoes.github.io
```

然后在设置中添加服务器地址（支持 HTTP、Basic 认证、多服务器切换）。

**使用场景**

- 在高性能的远程工作站/服务器上运行智能体，从笔记本或托管应用进行控制。
- 从 Windows 访问运行在 WSL 中的 OpenCode 实例，或通过 SSH 访问远程主机。
- 跨项目监督多个并行智能体/会话，在同一面板上审查输出并审批权限。

## 致谢

- 灵感来源于 [openchamber](https://github.com/btriapitsyn/openchamber) 项目，并向其致谢。
- [opencode web UI](https://github.com/anomalyco/opencode/tree/dev/packages/app)

## 许可证

本项目基于 [MIT 许可证](./LICENSE) 开源。
