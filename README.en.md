# ikanban

English | [简体中文](./README.md)

iKanban is a multi-agent coding workspace powered by [OpenCode](https://opencode.ai). It is built for driving, reviewing, and coordinating parallel agent work across projects, with session management, diff review and project-aware navigation in one place.

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
| 💬 Agent conversations | See tool types, call durations, total run time, and MCP results, with keyboard scrolling. |
| ✍️ Prompt composer | Expandable, responsive editor for longer task descriptions with English and Chinese UI support. |
| 🔍 Code review | PR-style project diffs with change statistics, file filtering, viewed progress, historical sessions, and patch diffs. |
| 🌐 Remote control | Connect to OpenCode locally, remotely, through WSL, or over SSH tunnels, with HTTP, Basic auth, and multiple servers. |
| 🔄 State synchronization | Keep server selection independent per browser tab and persist archived sessions in browser storage. |
| 📱 Responsive interface | Desktop, mobile, and fullscreen layouts with accessible interactions and keyboard navigation. |

## Quick Start

### Option 1: Use the hosted app (recommended)

Open: https://isomoes.github.io/ikanban

Start OpenCode with CORS enabled for GitHub Pages:

```bash
opencode serve --port <PORT> --cors https://isomoes.github.io
```

Then add your server URL in settings: `http://localhost:<PORT>`.

### Option 2: Run locally with npx

```bash
npx ikanban-web@latest                        # Start on port 3000
npx ikanban-web@latest --port 8080            # Custom port
OPENCODE_URL=http://myserver:4096 npx ikanban-web@latest  # External OpenCode server
```

### Option 3: Run with Docker

Start OpenCode on an interface reachable from Docker:

```bash
opencode serve --hostname 0.0.0.0 --port 4097
```

Then run iKanban with the OpenCode server URL:

```bash
docker run --rm -p 3000:3000 \
  --add-host=host.docker.internal:host-gateway \
  -e OPENCODE_URL=http://host.docker.internal:4097 \
  ghcr.io/isomoes/ikanban:latest
```

Open: http://localhost:3000/ikanban/

Images are published for AMD64 and ARM64. When OpenCode runs on another machine, set `OPENCODE_URL` to an address reachable from the container instead.

## Remote Control Agent

iKanban is a web front-end that connects to an OpenCode server running on any machine (local, a remote host, an SSH tunnel, or WSL). This lets you drive agents remotely from the browser: create/manage sessions, send prompts, approve permission requests, inspect tool results, and review current and historical diffs.

Start OpenCode on the remote host with CORS enabled, then connect from the hosted app:

```bash
opencode serve --port <PORT> --cors https://isomoes.github.io
```

Then add the server URL in settings (supports HTTP, Basic auth, and switching between multiple servers).

**Use cases**

- Run agents on a powerful remote workstation/server and control them from a laptop or the hosted app.
- Access an OpenCode instance in WSL from Windows, or a remote host over SSH.
- Supervise multiple parallel agents/sessions across projects, reviewing output and approving permissions from one board.

## Acknowledgments

- Inspired by and thanks to the [openchamber](https://github.com/btriapitsyn/openchamber) project.
- [opencode web UI](https://github.com/anomalyco/opencode/tree/dev/packages/app)

## License

This project is licensed under the [MIT License](./LICENSE).
