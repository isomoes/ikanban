# ikanban

iKanban is a Web/PWA interface for the [OpenCode](https://opencode.ai) AI coding agent. It unifies chat, terminal, and board workflows in a single interface so teams can plan, execute, and track coding tasks with shared context.

## Quick Start

### Install

```bash
# Quick install (auto-detects your package manager)
curl -fsSL https://raw.githubusercontent.com/isomoes/ikanban/main/scripts/install.sh | bash

# Or install manually
bun add -g @ikanban/web    # or npm, pnpm, yarn
```

### Use

```bash
ikanban                             # Start on port 3000
ikanban --port 8080                 # Custom port
ikanban --daemon                    # Background mode
ikanban --ui-password secret        # Password-protect UI
OPENCODE_PORT=4096 OPENCODE_SKIP_START=true ikanban  # Connect to external OpenCode server
ikanban stop                        # Stop server
ikanban update                      # Update to latest version
```

## Acknowledgments

- Inspired by and thanks to the [openchamber](https://github.com/btriapitsyn/openchamber) project.
