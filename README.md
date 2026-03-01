# ikanban

iKanban is a Web/PWA interface for the [OpenCode](https://opencode.ai) AI coding agent. It unifies chat, terminal, and board workflows in a single interface so teams can plan, execute, and track coding tasks with shared context.

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
