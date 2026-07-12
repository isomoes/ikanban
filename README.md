# ikanban

[English](./README.en.md) | 简体中文

iKanban 是一个由 [OpenCode](https://opencode.ai) 驱动的多智能体（multi-agent）编码工作空间。它专为跨项目地驱动、审查和协调并行的智能体工作而构建，将会话管理、差异（diff）审查以及项目感知的导航集于一处。

**Bilibili 视频** [为什么做它](https://www.bilibili.com/video/BV1t9AhztEjX/) [v0.1](https://www.bilibili.com/video/BV1W3Pgz8ExJ/) [v0.2](https://www.bilibili.com/video/BV1ZNP1znEn5/) [v0.2.11 如何使用](https://www.bilibili.com/video/BV1Y9wMzKE2b/) [v0.3](https://www.bilibili.com/video/BV1n9QEBSEch/)

<details>
  <summary>界面截图</summary>

  <img width="3258" height="1460" alt="Image" src="https://github.com/user-attachments/assets/2dc21dcc-124e-4a89-9577-357ebe30b8f0" />

  <img width="3258" height="1460" alt="Image" src="https://github.com/user-attachments/assets/b3cc7c31-0b9c-45ac-98d8-90178af31e2f" />
</details>

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

iKanban 是一个 Web 前端，可连接到任意机器上运行的 OpenCode 服务器（本地、远程主机、SSH 隧道或 WSL）。这让你可以从浏览器远程驱动智能体：创建/管理会话、发送提示词、审批权限请求、审查差异，以及查看多智能体任务图。

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

## Star 历史

<a href="https://star-history.com/#isomoes/ikanban&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=isomoes/ikanban&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=isomoes/ikanban&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=isomoes/ikanban&type=Date" />
  </picture>
</a>
