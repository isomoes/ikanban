# Changelog

All notable changes to this project will be documented in this file.

## [0.1.4]

- Command Palette: Changed the main shortcut from `Cmd/Ctrl + K` to `Cmd/Ctrl + P` and updated shortcut hints in Help to match. (thanks to @isomo)
- Chat: Added Vim-style keyboard scrolling with `j`/`k` for line movement and `d`/`u` (plus `Ctrl + d`/`Ctrl + u`) for half-page movement in scrollable chat and diff views. (thanks to @isomo)
- Chat: Improved pin-to-bottom behavior so scrolling upward consistently unpins the view and prevents jump-to-bottom interruptions while new output streams in. (thanks to @isomo)
- Settings: Streamlined built-in theme presets and kept a focused `Dark Colorblind High Contrast` preset as the bundled option. (thanks to @isomo)
- Docs: Refreshed the README intro and Quick Start section with install and common usage examples to make first-run setup faster. (thanks to @isomo)

## [0.1.3]

## [0.1.2]

- CLI: Renamed published npm package names to `ikanban-web` and `ikanban-ui`; update install commands to use the new names. (thanks to @isomo)
- CLI: Added a one-line install script that checks Node.js requirements, detects your package manager, and installs `ikanban-web` automatically. (thanks to @isomo)
- Docs: Updated CLI and setup examples to use the `ikanban` command and current repository links. (thanks to @isomo)
- Release: Enabled npm trusted publishing (OIDC) to improve release security and reduce publish-token setup. (thanks to @isomo)
- Release: Consolidated the publish workflow naming while keeping automated npm package and GitHub release artifact publishing. (thanks to @isomo)

## [0.1.0]

- Initial release of iKanban with a web runtime for interacting with an OpenCode server.
- Added a Kanban-oriented interface with chat, settings, and terminal workflows.
- Added live OpenCode event streaming and client integration in the shared UI layer.
- Added web server support for OpenCode runtime integration, git operations, and PTY terminal sessions.
- Added a shared UI package with reusable components, theming, and typography foundations.
