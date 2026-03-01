Web/PWA interface for the [OpenCode](https://opencode.ai) AI coding agent.

This package publishes as `ikanban-web` and runs a local web server. For the full project overview and screenshots, see the main repo:

https://github.com/isomoes/ikanban

## Installation

```bash
# No global install required
npx ikanban-web@latest --help
```

## Usage

```bash
npx ikanban-web@latest                              # Start on port 3000
npx ikanban-web@latest --port 8080                  # Custom port
npx ikanban-web@latest --daemon                     # Background mode
npx ikanban-web@latest --ui-password secret         # Password-protect UI
OPENCODE_PORT=4096 OPENCODE_SKIP_START=true npx ikanban-web@latest  # Connect to external OpenCode server
npx ikanban-web@latest stop                         # Stop server
npx ikanban-web@latest update                       # Update to latest version
```

### Environment Variables

- `OPENCODE_PORT` - Port of external OpenCode server to connect to (instead of starting embedded server)
- `OPENCODE_SKIP_START` - Skip starting embedded OpenCode server (use with `OPENCODE_PORT` to connect to external instance)

## Prerequisites

- [OpenCode CLI](https://opencode.ai) installed (`opencode`)
- Node.js 20+

## Features

### Core UI

- Integrated terminal
- Git operations with identity management and AI commit message generation
- Smart tool visualization (inline diffs, file trees, results highlighting)
- Rich permission cards with syntax-highlighted operation previews
- Per-agent permission modes (ask/allow/full) per session
- Multi-agent runs from a single prompt (isolated worktrees)
- Branchable conversations: start a new session from any assistant response
- Task tracker UI with live progress and tool summaries
- Model selection UX: favorites, recents, and configurable tool output density
- UI scaling controls (font size and spacing)
- Session auto-cleanup with configurable retention
- Memory optimizations with LRU eviction

### Web / PWA

- Mobile-first UI with gestures and optimized terminal controls
- Remote access from any device via browser (works alongside the OpenCode TUI)
- Self-serve updates (`npx ikanban-web@latest update`) without reinstalling
- Update + restart keeps previous server settings (port/password)

## License

MIT
