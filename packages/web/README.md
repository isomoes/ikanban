# ikanban

iKanban is a Web interface for the [OpenCode](https://opencode.ai) AI coding agent. It unifies chat, terminal, and board workflows in a single interface so teams can plan, execute, and track coding tasks.

## UI Previews

<details>
<summary>Expand screenshots</summary>

<img width="3695" height="2149" alt="Image" src="https://github.com/user-attachments/assets/b5ca21b8-b8aa-46f6-84cc-8906f629b6c8" />

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

## Acknowledgments

- Inspired by and thanks to the [openchamber](https://github.com/btriapitsyn/openchamber) project.
- [opencode web UI](https://github.com/anomalyco/opencode/tree/dev/packages/app)
