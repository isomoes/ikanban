# iKanban

[中文](./README.md) | English

iKanban is a standalone static frontend for **OpenCode V2**, based directly on the
upstream shared desktop/web application. The browser connects directly to the
backend; no desktop client is required.

<img width="900" alt="iKanban interface screenshot" src="https://github.com/user-attachments/assets/034542d2-c944-4821-ab2d-8085bcdf45b2" />

## Features

| Module | Description |
| --- | --- |
| Projects and sessions | Recent projects, worktree workspaces, time-grouped sessions, project and session search, and multiple tabs. |
| Session workbench | Streaming messages, todos, questions, permission requests, background tasks, message search, and live session metrics (tok/s, turns, steps, tool calls, time, and tokens). |
| Composer | Drag in images, PDFs, or text files; `@`-mention files; run `/` commands; switch model, agent, and MCP; Shell mode. |
| Review and files | Git-based diff review, file tree and previews, manual refresh, and adding selected lines to context; create a Git repository in one click when missing. |
| Terminal | Side or bottom layout, multiple tabs, and a direct WebSocket connection to the backend. |
| Providers and models | OAuth or API-key connections with authentication-failure feedback; model favorites and recently used models, plus hide all models per provider. |
| Multiple servers | Add, edit, and switch servers at runtime without rebuilding. |
| Web / PWA | Responsive mobile layout, install to desktop or home screen, light/dark and colorblind themes, notifications and sounds, English and Simplified Chinese UI. |
| Productivity | Command palette, customizable shortcuts, undo/redo, session forking and compaction, and JSON export. |

## Quick start

1. **Start the OpenCode V2 backend.** On a machine that can access your project directories:

   ```sh
   opencode serve --hostname 127.0.0.1 --port 4096 --cors https://isomoes.github.io
   ```

   Note the password printed by the server. Remote access also needs HTTPS and
   correct CORS.

2. **Connect iKanban.** Open <https://isomoes.github.io/ikanban/> and enter the
   OpenCode V2 server URL and password. You can also run `opencode pair` and scan
   the pairing code on the connection screen; manage multiple backends later in
   **Settings > Server**.

3. **Add a project.** On Home, click **Add project** and choose a project directory
   on the OpenCode backend.

4. **Create a session.** Choose a project and workspace (main branch or a new
   worktree), confirm the model and agent, then enter a prompt and send it. Use `@`
   to mention files, drag in images, PDFs, or text files, or use `/` to run commands.

5. **Review and run.** Open the **Review** panel to inspect this session's diff.
   Open or refresh files in the file tree, or add selected lines to context. Execute
   **Toggle terminal** from the command palette (default `Ctrl/Cmd+P`) and use the
   terminal in the side or bottom pane.

6. **Configure providers and models.** Go to **Settings > Providers** to connect
   with OAuth or an API key, then manage or hide models in **Settings > Models**.
   The model selector prioritizes favorites and recent models.

7. **Install the PWA (optional).** Use your browser's install action to add iKanban
   to your desktop or home screen; mobile provides adapted navigation and session tabs.

## Historical introduction videos

These Bilibili videos record iKanban's early workflows and version history. Their
interfaces and installation steps correspond to those historical versions; use the
instructions above for the current version.

**Bilibili videos:** [Why I built it](https://www.bilibili.com/video/BV1t9AhztEjX/) · [v0.1](https://www.bilibili.com/video/BV1W3Pgz8ExJ/) · [v0.2](https://www.bilibili.com/video/BV1ZNP1znEn5/) · [v0.2.11 how to use](https://www.bilibili.com/video/BV1Y9wMzKE2b/) · [v0.3](https://www.bilibili.com/video/BV1n9QEBSEch/) · [v0.3.14](https://www.bilibili.com/video/BV1zy3F6aEb2/) · [v0.4.2](https://www.bilibili.com/video/BV156b26eEbn/) · [v0.5.0](https://www.bilibili.com/video/BV1QC886JEts/) · [v0.6.2](https://www.bilibili.com/video/BV1Mrhn69EyS/)
