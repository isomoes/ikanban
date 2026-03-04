# ikanban

iKanban is a Web/PWA interface for the [OpenCode](https://opencode.ai) AI coding agent. It unifies chat, terminal, and board workflows in a single interface so teams can plan, execute, and track coding tasks with shared context.

## UI Previews

<details>
<summary>Expand screenshots</summary>

### Prompt Panel

<img width="2700" alt="Prompt panel" src="https://github.com/user-attachments/assets/2b103547-9194-4a53-ab70-78be0ed823ab" />

### Diff Panel

<img width="2700" alt="Diff panel" src="https://github.com/user-attachments/assets/f0e965b7-0103-45ad-9201-dc4d3b9934f0" />

</details>

## Quick Start

```bash
npx ikanban-web@latest                        # Start on port 3000
npx ikanban-web@latest --port 8080            # Custom port
OPENCODE_URL=http://myserver:4096 npx ikanban-web@latest  # External OpenCode server
```

## Acknowledgments

- Inspired by and thanks to the [openchamber](https://github.com/btriapitsyn/openchamber) project.
