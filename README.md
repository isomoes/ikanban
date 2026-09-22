# iKanban

中文 | [English](./README.en.md)

iKanban 是面向 **OpenCode V2** 的独立静态前端，直接采用上游共享的桌面 / Web 应用。

## 历史版本介绍视频

以下 Bilibili 视频记录了 iKanban 的早期工作流与版本演进，其中的界面和安装方式对应各自历史版本；当前版本的使用方式见下文。

**Bilibili 视频：** [为什么做它](https://www.bilibili.com/video/BV1t9AhztEjX/) · [v0.1](https://www.bilibili.com/video/BV1W3Pgz8ExJ/) · [v0.2](https://www.bilibili.com/video/BV1ZNP1znEn5/) · [v0.2.11 如何使用](https://www.bilibili.com/video/BV1Y9wMzKE2b/) · [v0.3](https://www.bilibili.com/video/BV1n9QEBSEch/) · [v0.3.14](https://www.bilibili.com/video/BV1zy3F6aEb2/) · [v0.4.2](https://www.bilibili.com/video/BV156b26eEbn/) · [v0.5.0](https://www.bilibili.com/video/BV1QC886JEts/)

## 原生 V2 前端

当前 iKanban 版本为 **0.6.2**。前端基于 OpenCode `v2` 分支 **2.0.12**，
上游提交为 `dcfe1ec7bd4922d4f44c141ba33047402bffc57e`。

- `packages/web`：唯一应用，由上游 `packages/app` 引入。
- `packages/ui`、`packages/session-ui`：上游共享组件，作为私有 workspace 使用。
- 使用原生 V2 类型、`@opencode/client` 及其 Solid 数据层，替换旧 v0.3.18 UI 和适配层。
- 保留上游项目 / 会话导航、消息时间线、输入框、文件与 Diff、终端、模型选择和设置；
  桌面专属功能由上游 Web 平台能力判断控制。

会话、执行、工具、模型供应商及其凭据均由独立 OpenCode 后端管理。
详见[架构说明](./docs/architecture.md)和[上游来源与同步流程](./docs/upstream.md)。

## 连接后端

打开 [iKanban](https://isomoes.github.io/ikanban/)，在连接页面填写 OpenCode V2 服务地址和密码。
认证沿用上游 **HTTP Basic**：用户名固定为 `opencode`，密码为服务密码。
可通过服务器管理界面在运行时添加、编辑和切换后端，无需重新构建。

没有保存的服务器且未设置 `VITE_OPENCODE_URL` 时，显示上游连接页面；
不会隐式连接 Pages 域名或本机 `localhost`。新的浏览器存储使用 iKanban 命名空间，
旧 UI 的连接和布局状态不会自动迁入；升级后可能需要重新添加服务器。

GitHub Pages 仅托管静态文件，浏览器直接连接后端。远程后端需要：

- 可从浏览器访问的 **HTTPS** 地址。
- CORS 允许来源 **`https://isomoes.github.io`**，不包含 `/ikanban/` 路径。
- 保留认证头、事件流，以及终端使用的 WebSocket 连接。

例如，在 HTTPS 反向代理后以前台模式启动后端，并允许 Pages 来源：

```sh
opencode serve --hostname 127.0.0.1 --port 4096 --cors https://isomoes.github.io
```

按实际部署配置监听地址和 HTTPS 代理，在界面中输入服务输出的密码。
如使用已有共享服务，`opencode pair` 可显示连接地址和凭据。
参见 [OpenCode V2 Web 文档](https://opencode.ai/v2/docs/cli/web)。

## 开发

需要 Bun **1.3.12**、Node **^22.19.0 或 >=24.0.0**。

```sh
bun install --frozen-lockfile
VITE_OPENCODE_URL=http://127.0.0.1:4096 bun run dev
```

访问 Vite 输出地址下的 `/ikanban/`。另行运行 OpenCode V2 后端：

```sh
opencode serve --hostname 127.0.0.1 --port 4096
```

在界面中填写服务输出的密码；如需允许额外开发来源，为 `serve` 添加
`--cors <Vite 来源>`，来源需包含实际端口，不包含路径。
`4096` 是本示例显式指定的端口，不是应用的隐式默认值。

```sh
bun run typecheck
bun run --cwd packages/web test:unit
bun run build:web
bun run preview:web --port 3000
```

构建后在 `http://localhost:3000/ikanban/` 预览。
`VITE_OPENCODE_URL` 仅用于提供可选的构建默认后端地址，运行时仍可更换服务器。
不要将密码、token 或其他凭据放入 Vite 环境变量。

可选的 Pages 浏览器检查使用无默认后端的生产构建和 Playwright Chromium：

```sh
(cd packages/web && bunx playwright install chromium)
env -u VITE_OPENCODE_URL bun run build:web
env -u VITE_OPENCODE_URL bun run --cwd packages/web test:pages
```

检查包含首次连接、Basic 认证测试服务、深层链接和 PWA 范围；不代表已验证真实模型执行。

## 发布

标签工作流运行版本检查、类型检查、Web 单元测试、静态构建和 Pages 浏览器测试，然后将 `packages/web/dist`
部署到 **GitHub Pages** 的 `/ikanban/`。仓库 Pages 来源需设置为 **GitHub Actions**。
部署成功后，工作流从该标签的 `CHANGELOG.md` 提取对应版本条目，创建 GitHub Release；重复运行会更新同一 Release 的说明。
工作流支持同名仓库变量 `VITE_OPENCODE_URL`；留空即可由用户在连接页面输入后端。

应用使用 history 路由，`404.html` 提供深层链接的应用入口；PWA 限定在 `/ikanban/` 范围。
根项目及三个 workspace 均为私有；根项目和 Web 应用使用 iKanban 版本号，两个共享库保留上游版本号。

发布流程见 [prompts/release.md](./prompts/release.md)。`CHANGELOG.md` 及旧迁移记录描述各自历史版本，
当前实现以架构说明和上游来源记录为准。
