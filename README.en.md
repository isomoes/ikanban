# ikanban

English | [简体中文](./README.md)

iKanban is a multi-agent coding workspace powered by [OpenCode](https://opencode.ai). It is built for driving, reviewing, and coordinating parallel agent work across projects, with session management, diff review and project-aware navigation in one place.

**Bilibili Video** [why do it](https://www.bilibili.com/video/BV1t9AhztEjX/) [v0.1](https://www.bilibili.com/video/BV1W3Pgz8ExJ/) [v0.2](https://www.bilibili.com/video/BV1ZNP1znEn5/) [v0.2.11 how to use](https://www.bilibili.com/video/BV1Y9wMzKE2b/) [v0.3](https://www.bilibili.com/video/BV1n9QEBSEch/)

<details>
  <summary>UI Screenshots</summary>

  <img width="3258" height="1460" alt="Image" src="https://github.com/user-attachments/assets/2dc21dcc-124e-4a89-9577-357ebe30b8f0" />

  <img width="3258" height="1460" alt="Image" src="https://github.com/user-attachments/assets/b3cc7c31-0b9c-45ac-98d8-90178af31e2f" />
</details>

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

## Remote Control Agent

iKanban is a web front-end that connects to an OpenCode server running on any machine (local, a remote host, an SSH tunnel, or WSL). This lets you drive agents remotely from the browser: create/manage sessions, send prompts, approve permission requests, review diffs, and inspect the multi-agent task graph.

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

## Star History

<a href="https://star-history.com/#isomoes/ikanban&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=isomoes/ikanban&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=isomoes/ikanban&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=isomoes/ikanban&type=Date" />
  </picture>
</a>
