# iKanban

中文 | [English](./README.en.md)

iKanban 是面向 **OpenCode V2** 的独立静态前端，直接采用上游共享的桌面 / Web 应用。浏览器直连后端，无需安装桌面客户端。

<img width="900" alt="iKanban 界面截图" src="https://github.com/user-attachments/assets/034542d2-c944-4821-ab2d-8085bcdf45b2" />

## 功能

| 模块 | 说明 |
| --- | --- |
| 项目与会话 | 最近项目、worktree 工作区、按时间分组的会话、项目和会话搜索、多标签页。 |
| 会话工作台 | 流式消息、待办、提问、权限请求、后台任务、消息搜索，以及实时会话指标（tok/s、轮次、步数、工具调用、耗时和 Token）。 |
| 输入框 | 拖入图片、PDF 或文本文件，`@` 引用文件，`/` 执行命令，切换模型、智能体与 MCP，支持 Shell 模式。 |
| 审查与文件 | 基于 Git 的 Diff 审查、文件树和文件预览、手动刷新，以及将选中行加入上下文；未初始化 Git 时可一键创建仓库。 |
| 终端 | 侧边或底部布局、多标签，通过 WebSocket 直连后端。 |
| 提供商与模型 | OAuth 或 API 密钥连接，并提示认证失败；支持模型收藏、最近使用和按提供商批量隐藏。 |
| 多服务器 | 运行时添加、编辑和切换服务器，无需重新构建。 |
| Web / PWA | 响应式移动布局、安装到桌面或主屏幕、深浅色与色盲主题、通知与音效、中英文界面。 |
| 效率 | 命令面板、可自定义快捷键、撤销/重做、Fork、压缩会话和导出 JSON。 |

## 快速开始

1. **启动 OpenCode V2 后端**。在能访问项目目录的机器上运行：

   ```sh
   opencode serve --hostname 127.0.0.1 --port 4096 --cors https://isomoes.github.io
   ```

   记下服务输出的密码。远程访问还需要 HTTPS 和正确的 CORS。

2. **连接 iKanban**。打开 <https://isomoes.github.io/ikanban/>，填写 OpenCode V2 服务地址和密码。
   也可以运行 `opencode pair`，在连接页面扫码配对；之后可在“设置 > 服务器”中管理多个后端。

3. **添加项目**。在主页点击“添加项目”，选择 OpenCode 后端上的项目目录。

4. **新建会话**。选择项目和工作区（主分支或新建 worktree），确认模型与智能体，输入提示词并发送。
   使用 `@` 引用文件，拖入图片、PDF 或文本文件，或用 `/` 调用命令。

5. **审查与运行**。打开“审查”面板查看本次会话的 Diff；在文件树中打开文件、刷新内容，或把选中行加入上下文。
   通过命令面板（默认 `Ctrl/Cmd+P`）执行“切换终端”，在侧边或底部运行命令。

6. **配置提供商与模型**。进入“设置 > 提供商”，用 OAuth 或 API 密钥连接服务；
   在“设置 > 模型”中管理或隐藏模型。模型选择器会优先显示收藏和最近使用。

7. **安装 PWA（可选）**。通过浏览器的“安装”入口添加到桌面或主屏幕；移动端提供适配的导航和会话标签。

## 历史版本介绍视频

以下 Bilibili 视频记录了 iKanban 的早期工作流与版本演进，其中的界面和安装方式对应各自历史版本；当前版本请以上方说明为准。

**Bilibili 视频：** [为什么做它](https://www.bilibili.com/video/BV1t9AhztEjX/) · [v0.1](https://www.bilibili.com/video/BV1W3Pgz8ExJ/) · [v0.2](https://www.bilibili.com/video/BV1ZNP1znEn5/) · [v0.2.11 如何使用](https://www.bilibili.com/video/BV1Y9wMzKE2b/) · [v0.3](https://www.bilibili.com/video/BV1n9QEBSEch/) · [v0.3.14](https://www.bilibili.com/video/BV1zy3F6aEb2/) · [v0.4.2](https://www.bilibili.com/video/BV156b26eEbn/) · [v0.5.0](https://www.bilibili.com/video/BV1QC886JEts/) · [v0.6.2](https://www.bilibili.com/video/BV1Mrhn69EyS/)
