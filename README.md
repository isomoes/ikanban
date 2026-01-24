# iKanban

AI-Powered Kanban Task Management with Full Vim-Style Keyboard Navigation

## Features

- **Full Keyboard Control**: Complete Vim-style keyboard navigation (h/j/k/l, gg/G, dd, etc.)
- **Multiple Modes**: Normal, Insert, Visual, and Command modes like Vim
- **AI Agent Integration**: Spawn AI coding agents for tasks using git worktrees
- **Session Management**: Track agent execution with real-time logs
- **Native Desktop UI**: Built with egui for fast, native Wayland support

## Quick Start

Build and run:

```bash
cargo build --release
./target/release/ikanban
```

## Keyboard Navigation

iKanban is designed for full keyboard operation. See [KEYBOARD.md](KEYBOARD.md) for complete keyboard shortcuts.

### Quick Reference

- **Navigation**: `h/j/k/l` or arrow keys
- **Jump**: `gg` (top), `G` (bottom), `1-4` (columns)
- **Actions**: `n` (new), `e` (edit), `dd` (delete), `s` (start session)
- **Modes**: `i` (insert), `v` (visual), `:` (command), `Esc` (normal)
- **Quit**: `q` or `:q`

## Architecture

See [ARCH.md](ARCH.md) for detailed architecture documentation.

## License

MIT
