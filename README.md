# ikanban

[English](./README.en.md) | 简体中文

iKanban 是一个面向 [Pi coding agent](https://github.com/earendil-works/pi) 的浏览器工作空间。单个 Bun 服务同时运行 Pi、为 Web UI 提供兼容 API，并在 `/ikanban/` 路径提供应用，同时按项目管理会话。

**Bilibili 视频** [为什么做它](https://www.bilibili.com/video/BV1t9AhztEjX/) [v0.1](https://www.bilibili.com/video/BV1W3Pgz8ExJ/) [v0.2](https://www.bilibili.com/video/BV1ZNP1znEn5/) [v0.2.11 如何使用](https://www.bilibili.com/video/BV1Y9wMzKE2b/) [v0.3](https://www.bilibili.com/video/BV1n9QEBSEch/) [v0.3.14](https://www.bilibili.com/video/BV1zy3F6aEb2/)

<details>
  <summary>界面截图</summary>

  <img width="3258" height="1460" alt="Image" src="https://github.com/user-attachments/assets/2dc21dcc-124e-4a89-9577-357ebe30b8f0" />

  <img width="3688" height="1988" alt="Image" src="https://github.com/user-attachments/assets/c94c5114-b55c-4cd6-959b-f16a4ba4ff8b" />
</details>

## 当前功能

| 功能 | 说明 |
| --- | --- |
| 📋 会话面板 | 在主页集中查看和切换多个项目中的活跃会话。 |
| 💬 智能体对话 | 流式显示助手文本和工具活动，包括调用耗时、会话总时长及键盘滚动。 |
| ✍️ 提示词编辑 | 可展开的响应式编辑器，支持长任务描述和中英文界面。 |
| 🔍 代码审查 | PR 风格的项目差异视图，包含变更统计、文件筛选、已读进度、历史会话及补丁差异。 |
| 🌐 单一服务 | 在同一个端口运行 Pi、兼容 API 和 Web UI。 |
| 🔄 会话持久化 | iKanban 重启后可恢复 Pi JSONL 会话。 |
| 📱 响应式界面 | 适配桌面、移动端和全屏模式，并提供无障碍交互与快捷键导航。 |

## 快速开始

### 环境要求

- [Bun 1.3.10 或更高版本](https://bun.sh/)
- Pi 支持的模型提供商凭据

### 配置 Pi 凭据

iKanban 使用 Pi 的标准凭据存储。最简单的配置方式是先运行一次 Pi，输入 `/login`，再按提示选择模型提供商或订阅登录：

```bash
bunx @earendil-works/pi-coding-agent@0.83.0
# 在 Pi 中输入：/login
```

Pi 会把登录凭据保存到 `~/.pi/agent/auth.json`，iKanban 会自动读取。也可以直接在该文件中配置 API Key：

```json
{
  "anthropic": { "type": "api_key", "key": "sk-ant-..." }
}
```

Pi 官方也支持通过 `ANTHROPIC_API_KEY` 配置 Anthropic API Key：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

`auth.json` 中的凭据优先于环境变量。不要提交凭据或凭据文件。

### 选择模型

通过认证后，可用模型会显示在 iKanban 的模型选择器中。如需设置 Pi 的初始默认模型，请创建或修改 `~/.pi/agent/settings.json`：

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514"
}
```

请使用你的账户实际可用的提供商和模型 ID。在 Web UI 中选择其他模型后，该会话会切换到所选模型。

### 运行 iKanban

```bash
bunx ikanban@latest --port 3000 --project /path/to/repo
```

打开：http://localhost:3000/ikanban/

`--port` 默认值为 `3000`。`--project` 可以重复指定；服务只允许访问这些项目根目录及其后代目录。如果不传 `--project`，则使用当前目录。

全局安装方式：

```bash
bun add --global ikanban
ikanban --port 3000 --project /path/to/repo
```

### Docker

```bash
docker run --rm -p 3000:3000 \
  -v /path/to/repo:/workspace \
  -v "$HOME/.pi/agent:/home/bun/.pi/agent" \
  ghcr.io/isomoes/ikanban:latest
```

镜像同时支持 AMD64 和 ARM64。挂载的 Pi 目录包含凭据和会话，请妥善保护。若会话另行持久化，也可以只挂载 `auth.json` 和 `settings.json`。

## 会话持久化

Pi 会自动将每个会话以 JSONL 格式保存到 `~/.pi/agent/sessions/`，并按工作目录组织。使用相同的主目录和允许的项目路径重启服务后，这些会话会重新可用。

## 当前里程碑限制

- 提示词提交只接受文本部分；图片、文件和其他提示词部分会被忽略。
- 暂不支持 worktree 创建、revert/undo/redo、会话总结和项目重启。
- 本里程碑未集成 MCP、LSP、权限请求和智能体提问。
- 服务只实现当前 UI 所需的 OpenCode 兼容 API 子集；它不是 OpenCode 服务器，也不是通用 OpenCode 代理。

## 致谢

- 灵感来源于 [openchamber](https://github.com/btriapitsyn/openchamber) 项目，并向其致谢。
- [opencode web UI](https://github.com/anomalyco/opencode/tree/dev/packages/app)

## 许可证

本项目基于 [MIT 许可证](./LICENSE) 开源。
