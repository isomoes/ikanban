# ikanban

iKanban is a browser workspace for the [Pi coding agent](https://github.com/earendil-works/pi). The published `ikanban` package runs Pi, the compatibility API, and this web UI as one Bun service.

## UI Previews

<details>
<summary>Expand screenshots</summary>

<img width="3695" height="2149" alt="Image" src="https://github.com/user-attachments/assets/b5ca21b8-b8aa-46f6-84cc-8906f629b6c8" />

</details>

## Quick Start

Install [Bun 1.3.10 or newer](https://bun.sh/), configure Pi credentials in `~/.pi/agent/auth.json`, then run:

```bash
bunx ikanban@latest --port 3000 --project /path/to/repo
```

Open http://localhost:3000/ikanban/. Repeat `--project` to admit multiple roots. Pi stores resumable JSONL sessions under `~/.pi/agent/sessions/`.

Only text prompt parts are supported in this milestone. Worktrees, revert/undo/redo, summarize, restart, MCP, LSP, permissions, and questions are not supported. See the [main documentation](../../README.en.md) for credential, model, Docker, and persistence details.

## Acknowledgments

- Inspired by and thanks to the [openchamber](https://github.com/btriapitsyn/openchamber) project.
- [opencode web UI](https://github.com/anomalyco/opencode/tree/dev/packages/app)
