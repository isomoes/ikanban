# Changelog

All notable changes to this project will be documented in this file.

## [0.1.5]

- UI: Updated sidebar shortcuts so `Cmd/Ctrl + H` toggles the Session Sidebar, while `Cmd/Ctrl + L` now toggles the Git Sidebar. (@isomoes)
- Chat: Added Vim-style input mode controls with `i` to focus the chat input and `Escape` to blur it when no autocomplete menu is open. (@isomoes)
- Chat: Added `Ctrl + C` in the focused chat input to quickly stop an in-progress response. (@isomoes)
- Chat: Improved `@` file mentions so selecting a file inserts a relative path label when available. (@isomoes)
- Sessions: Added Vim-style session switching with `Ctrl + J` and `Ctrl + K`, cycling by most recently updated sessions. (@isomoes)
- Command Palette: Added a Projects group so you can switch active projects directly from the palette. (@isomoes)
- Chat: Improved focus behavior after closing the agent selector so the chat input restores focus reliably. (@isomoes)

## [0.1.4]

- Command Palette: Changed the main shortcut from `Cmd/Ctrl + K` to `Cmd/Ctrl + P` and updated shortcut hints in Help to match. (thanks to @isomoes)
- Chat: Added Vim-style keyboard scrolling with `j`/`k` for line movement and `d`/`u` (plus `Ctrl + d`/`Ctrl + u`) for half-page movement in scrollable chat and diff views. (thanks to @isomoes)
- Chat: Improved pin-to-bottom behavior so scrolling upward consistently unpins the view and prevents jump-to-bottom interruptions while new output streams in. (thanks to @isomoes)
- Settings: Streamlined built-in theme presets and kept a focused `Dark Colorblind High Contrast` preset as the bundled option. (thanks to @isomoes)
- Docs: Refreshed the README intro and Quick Start section with install and common usage examples to make first-run setup faster. (thanks to @isomoes)

## [0.1.3]

## [0.1.2]

- CLI: Renamed published npm package names to `ikanban-web` and `ikanban-ui`; update install commands to use the new names. (thanks to @isomoes)
- CLI: Added a one-line install script that checks Node.js requirements, detects your package manager, and installs `ikanban-web` automatically. (thanks to @isomoes)
- Docs: Updated CLI and setup examples to use the `ikanban` command and current repository links. (thanks to @isomoes)
- Release: Enabled npm trusted publishing (OIDC) to improve release security and reduce publish-token setup. (thanks to @isomoes)
- Release: Consolidated the publish workflow naming while keeping automated npm package and GitHub release artifact publishing. (thanks to @isomoes)

## [0.1.0]

- Initial release of iKanban with a web runtime for interacting with an OpenCode server.
- Added a Kanban-oriented interface with chat, settings, and terminal workflows.
- Added live OpenCode event streaming and client integration in the shared UI layer.
- Added web server support for OpenCode runtime integration, git operations, and PTY terminal sessions.
- Added a shared UI package with reusable components, theming, and typography foundations.
