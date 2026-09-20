# iKanban

中文 | [English](./README.en.md)

iKanban 是面向 **OpenCode V2** 的独立前端应用。

## 当前迁移阶段

项目沿用 **v0.3.18 的 SolidJS UI**，将后端接入迁移到 **`@opencode/client` 2.0.11**。
唯一应用位于 `packages/web`，仅通过 **GitHub Pages** 发布静态页面。

保留项目与会话导航、消息时间线、输入框、文件与 Diff 查看、模型选择、主题和设置。
客户端适配层负责 V2 消息、权限、表单、模型与事件的数据转换。
详见[架构说明](./docs/architecture.md)。

## 开发

需要 Bun **1.3.12**、Node **22.19+ 或 24+**；API 功能需要独立运行的 OpenCode V2 服务。

```sh
bun install --frozen-lockfile
VITE_OPENCODE_URL=http://127.0.0.1:4096 bun run dev
```

访问 Vite 输出地址下的 `/ikanban/`。需要独立后端时，另行启动：

```sh
opencode serve --hostname 127.0.0.1 --port 4096
```

OpenCode V2 需要认证，并需通过 CORS 允许前端来源。点击界面的服务器选择器添加服务：
- Bearer 认证：用户名留空，在“密码 / Bearer Token”中填写 token。
- Basic 认证：填写用户名和密码。

浏览器直接连接后端。未配置 `VITE_OPENCODE_URL` 时，初始地址为 `http://127.0.0.1:4096`；不会向 Pages 域名请求 API。

```sh
bun run typecheck
bun run --cwd packages/web test:unit
bun run build:web
bun run preview:web --port 3000
```

构建后的静态页面可在 `http://localhost:3000/ikanban/` 预览。
需要设置默认后端时，在运行 `bun run build:web` 时指定 `VITE_OPENCODE_URL`。

## 发布

标签触发的工作流检查并构建应用，将 `packages/web/dist` 部署到
**GitHub Pages** 的 `/ikanban/` 路径。仓库 Pages 来源需设置为 **GitHub Actions**。
两个 workspace manifest 均设为私有。

GitHub Pages 是纯静态托管；界面需直接连接可访问的 HTTPS OpenCode V2 服务，
并在后端配置 CORS。自定义构建可设置 `VITE_OPENCODE_URL`，Pages 工作流也支持同名仓库变量。
不要将凭据写入 Vite 环境变量。

## V2 差异

- 会话归档为浏览器本地状态，按服务器地址隔离，不同步到其他客户端。
- V2 尚未提供会话分享、工作区重置和 LSP 状态，相关操作不启用。
- 设置保存通过 V2 文件接口修改服务端已有的全局 JSON/JSONC 配置，并重新加载配置；保留未修改字段与注释。尚无全局配置文件时，需先在服务端创建。
- 事件断线后自动重连并重新读取已加载的会话；V2 事件流本身不提供历史回放。

发布步骤见 [prompts/release.md](./prompts/release.md)。历史版本记录保留在 `CHANGELOG.md` 和 `docs/`。
