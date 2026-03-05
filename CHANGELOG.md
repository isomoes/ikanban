# Changelog

All notable changes to this project will be documented in this file.

## [0.2.5]

- CI: Added GitHub Pages deployment to the publish workflow so site assets can be deployed automatically during releases. (@isomoes)

## [0.2.4]

- Settings: Simplified built-in UI language support to English and Chinese while we focus translation quality for actively maintained locales. (@isomoes)
- Settings: Added a `GitHub Dark Colorblind` theme preset to improve high-contrast readability for colorblind-friendly workflows. (@isomoes)
- Chat: Model picker now shows a `Recent` group with your last-used models at the top for faster reselection. (@isomoes)
- Chat: Pressing `Escape` no longer interrupts active responses, preserving Vim-style focus behavior and reducing accidental stops. (@isomoes)
- Chat: Standardized stop-response behavior around `Ctrl/Cmd + C` so interruption shortcuts are more predictable while composing. (@isomoes)
- Dev Experience: Removed the web Playwright end-to-end test suite and related setup to keep the package focused on unit-test workflows. (@isomoes)

## [0.2.3]

- CLI: Updated `cli.js` proxy rules to match `@opencode-ai/sdk` v2 API paths for compatibility with newer SDK routing. (@isomoes)

## [0.2.2]

- Workspaces: Internal `@opencode-ai/ui` and `@opencode-ai/util` dependencies now resolve through workspace dependencies to avoid package mismatch issues. (@isomoes)

## [0.2.1]

- Release: Updated changelog/version metadata for the `0.2.1` release line. (@isomoes)

## [0.2.0]

- UI: Removed the Files tab from the main layout to streamline navigation around chat, sessions, and git workflows. (@isomoes)
- UI: Removed the `Cmd/Ctrl + L` Git Sidebar shortcut to avoid conflicting with common terminal and editor keybindings. (@isomoes)
- Projects: Active project selection is now scoped per browser tab via URL state, so different tabs can stay on different projects. (@isomoes)
- Routing: Improved project/session URL synchronization so in-app navigation and direct URL updates stay consistent. (@isomoes)
- Chat: Hardened initial message bootstrapping to make session loading more reliable. (@isomoes)
- CLI: Added `npx ikanban` usage support and updated Quick Start guidance to make first-run setup easier without a global install. (@isomoes)
- Docs: Added collapsible prompt and diff screenshots in the README to make key UI behaviors easier to preview. (@isomoes)

## [0.1.6]

- Sessions: Remapped new-session shortcuts from `Cmd/Ctrl + N` / `Cmd/Ctrl + Shift + N` to bare `N` / `Shift + N` so they work without a modifier when the chat input is not focused. (@isomoes)
- Sessions: Changed session-switching shortcuts from `Ctrl + J` / `Ctrl + K` to `Shift + J` / `Shift + K` to avoid conflicts with Vim-style line scrolling. (@isomoes)
- Chat: Changed the model selector shortcut from `Cmd/Ctrl + Shift + M` to `Cmd/Ctrl + M` for easier one-handed access. (@isomoes)
- Server: The web server and dev proxy now respect the standard `PORT` environment variable in addition to `IKANBAN_PORT`. (@isomoes)
- Server: HTTPS proxy settings (`IKANBAN_OPENCODE_HTTPS_PROXY` / `OPENCODE_HTTPS_PROXY`) are now correctly forwarded to the OpenCode SDK at startup. (@isomoes)

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
