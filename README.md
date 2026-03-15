# ikanban

iKanban is a Web interface for the [OpenCode](https://opencode.ai) AI coding agent. It unifies chat, terminal, and board workflows in a single interface so teams can plan, execute, and track coding tasks.

**Bilibili Video** [why do it](https://www.bilibili.com/video/BV1t9AhztEjX/) [v0.1](https://www.bilibili.com/video/BV1W3Pgz8ExJ/) [v0.2](https://www.bilibili.com/video/BV1ZNP1znEn5/) [v0.2.11 how to use](https://www.bilibili.com/video/BV1Y9wMzKE2b/?vd_source=7c4f5b1516707ddaefcbbf124fa84a48)

<img width="3258" height="1460" alt="Image" src="https://github.com/user-attachments/assets/2dc21dcc-124e-4a89-9577-357ebe30b8f0" />

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

## Acknowledgments

- Inspired by and thanks to the [openchamber](https://github.com/btriapitsyn/openchamber) project.
- [opencode web UI](https://github.com/anomalyco/opencode/tree/dev/packages/app)
