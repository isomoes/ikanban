# ikanban

English | [简体中文](./README.md)

iKanban is a browser workspace for the [Pi coding agent](https://github.com/earendil-works/pi). A single Bun service runs Pi, exposes compatibility APIs for the web UI, serves the application at `/ikanban/`, and keeps sessions associated with their projects.

**Bilibili Video** [why do it](https://www.bilibili.com/video/BV1t9AhztEjX/) [v0.1](https://www.bilibili.com/video/BV1W3Pgz8ExJ/) [v0.2](https://www.bilibili.com/video/BV1ZNP1znEn5/) [v0.2.11 how to use](https://www.bilibili.com/video/BV1Y9wMzKE2b/) [v0.3](https://www.bilibili.com/video/BV1n9QEBSEch/) [v0.3.14](https://www.bilibili.com/video/BV1zy3F6aEb2/)

<details>
  <summary>UI Screenshots</summary>

  <img width="3258" height="1460" alt="Image" src="https://github.com/user-attachments/assets/2dc21dcc-124e-4a89-9577-357ebe30b8f0" />

  <img width="3688" height="1988" alt="Image" src="https://github.com/user-attachments/assets/c94c5114-b55c-4cd6-959b-f16a4ba4ff8b" />
</details>

## Current Features

| Feature | Description |
| --- | --- |
| 📋 Session board | View and switch between active sessions across projects from the home board. |
| 💬 Agent conversations | Stream assistant text and tool activity, with call durations, total run time, and keyboard scrolling. |
| ✍️ Prompt composer | Expandable, responsive editor for longer task descriptions with English and Chinese UI support. |
| 🔍 Code review | PR-style project diffs with change statistics, file filtering, viewed progress, historical sessions, and patch diffs. |
| 🌐 Single service | Run the Pi runtime, compatibility API, and web UI together on one port. |
| 🔄 Persistent sessions | Resume Pi JSONL sessions after restarting iKanban. |
| 📱 Responsive interface | Desktop, mobile, and fullscreen layouts with accessible interactions and keyboard navigation. |

## Quick Start

### Requirements

- [Bun 1.3.10 or newer](https://bun.sh/)
- A Pi-supported provider credential

### Configure Pi credentials

iKanban uses Pi's standard credential store. The easiest way to configure a provider or subscription is to run Pi once, enter `/login`, and follow its provider flow:

```bash
bunx @earendil-works/pi-coding-agent@0.83.0
# In Pi: /login
```

Pi saves login credentials in `~/.pi/agent/auth.json`, which iKanban reads automatically. You can also create that file directly for an API key:

```json
{
  "anthropic": { "type": "api_key", "key": "sk-ant-..." }
}
```

Pi also officially supports `ANTHROPIC_API_KEY` for Anthropic API-key authentication:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Credentials in `auth.json` take precedence over environment variables. Do not commit either credentials or credential files.

### Select a model

Available authenticated models appear in iKanban's model picker. To set Pi's initial default, create or update `~/.pi/agent/settings.json`:

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514"
}
```

Use a provider/model ID available to your account. Selecting another model in the web UI changes the model for that session.

### Run iKanban

```bash
bunx ikanban@latest --port 3000 --project /path/to/repo
```

Open: http://localhost:3000/ikanban/

`--port` defaults to `3000`. `--project` is repeatable, and only those project roots and their descendants are admitted. With no `--project`, the current directory is used.

For a global installation:

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

The image supports AMD64 and ARM64. The mounted Pi directory contains credentials and sessions; protect it accordingly. You may mount only `auth.json` and `settings.json` instead if session persistence is handled separately.

## Persistence

Pi automatically stores each session as JSONL under `~/.pi/agent/sessions/`, organized by working directory. Restarting the service with the same home directory and allowed project path makes those sessions available again.

## Milestone Limitations

- Prompt submission accepts text parts only. Images, files, and other prompt part types are ignored.
- Worktree creation, revert/undo/redo, session summarization, and project restart are not supported.
- MCP, LSP, permission requests, and agent questions are not integrated in this milestone.
- The service provides only the OpenCode-compatible API slice needed by the current UI; it is not an OpenCode server or a general OpenCode proxy.

## Acknowledgments

- Inspired by and thanks to the [openchamber](https://github.com/btriapitsyn/openchamber) project.
- [opencode web UI](https://github.com/anomalyco/opencode/tree/dev/packages/app)

## License

This project is licensed under the [MIT License](./LICENSE).
