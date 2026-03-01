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

### Install

```bash
# No global install required
npx ikanban-web@latest --help
```

### Use

```bash
npx ikanban-web@latest                              # Start on port 3000
npx ikanban-web@latest --port 8080                  # Custom port
npx ikanban-web@latest --daemon                     # Background mode
npx ikanban-web@latest --ui-password secret         # Password-protect UI
OPENCODE_PORT=4096 OPENCODE_SKIP_START=true npx ikanban-web@latest  # Connect to external OpenCode server
npx ikanban-web@latest stop                         # Stop server
npx ikanban-web@latest update                       # Update to latest version
```

## Acknowledgments

- Inspired by and thanks to the [openchamber](https://github.com/btriapitsyn/openchamber) project.
