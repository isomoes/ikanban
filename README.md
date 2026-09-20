# iKanban

中文 | [English](./README.en.md)

iKanban 是面向 **OpenCode V2** 的独立前端应用。

## 当前迁移阶段

项目已恢复 v0.3 的单前端应用架构，移除 DSH 实现。
唯一应用位于 `packages/web`，仅通过 **GitHub Pages** 发布静态页面。

本次仅完成**清理与基础设施恢复**：浏览器显示迁移占位页。
新界面将通过 `@opencode/client` 连接 OpenCode V2，前端框架尚待选择。
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

OpenCode V2 需要认证，并需通过 CORS 允许前端来源。浏览器直接连接后端；未来界面将提供服务选择与登录功能。
`src/client.ts` 已提供服务地址与认证请求头入口。

```sh
bun run typecheck
bun run build:web
bun run preview:web --port 3000
```

构建后的静态页面可在 `http://localhost:3000/ikanban/` 预览。
需要设置默认后端时，在运行 `bun run build:web` 时指定 `VITE_OPENCODE_URL`。

## 发布

标签触发的工作流检查并构建应用，将 `packages/web/dist` 部署到
**GitHub Pages** 的 `/ikanban/` 路径。仓库 Pages 来源需设置为 **GitHub Actions**。
两个 workspace manifest 均设为私有。

GitHub Pages 是纯静态托管；未来界面需直接连接可访问的 HTTPS OpenCode V2 服务，
并在后端配置 CORS。自定义构建可设置 `VITE_OPENCODE_URL`，Pages 工作流也支持同名仓库变量。
不要将凭据写入 Vite 环境变量。

发布步骤见 [prompts/release.md](./prompts/release.md)。历史版本记录保留在 `CHANGELOG.md` 和 `docs/`。
