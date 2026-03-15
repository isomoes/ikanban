# Changelog

All notable changes to this project will be documented in this file.

## [0.2.11]

- Web: Simplified home/session routing, hid the shell view on the home screen, and added a quick return shortcut so navigation feels cleaner when moving between the dashboard and active sessions. (@isomoes)
- Command Palette: Registered the main shortcut globally so it opens more reliably from anywhere in the web app. (@isomoes)

## [0.2.10]

- Web: Added a session status board home view to give the web app a clearer at-a-glance landing surface for active session state. (@isomoes)
- Sessions: History scrolling now respects plugin-driven behavior so custom integrations can control timeline navigation more reliably. (@isomoes)
- Skills: Added a lightweight `simple` skill for requirement gathering plus an `agent-browser` skill for browser-driven testing and automation flows. (@isomoes)
- Dependencies: Updated `@opencode-ai/sdk` to `1.2.21` to stay aligned with the latest SDK fixes and compatibility updates. (@isomoes)

## [0.2.9]

- Review: Added persistent review word-wrap controls plus word-level diff highlighting, and improved the GitHub Dark Colorblind diff colors so inline changes are easier to distinguish. (@isomoes)

## [0.2.8]

- Review: Added a project-wide changes review mode alongside session diffs so you can inspect broader workspace edits from the review flow. (@isomoes)
- Sessions: Added timeline jump controls and review file toggles to make it easier to navigate conversation history and focus file review context. (@isomoes)
- Settings: Disabled update prompts and linked changelog entries from settings to reduce noise while making release notes easier to access. (@isomoes)
- Projects: Added a close-project command in the web app for faster project switching and cleanup. (@isomoes)
- Docs: Refreshed the README with a Bilibili video link and added architecture/hosted-flow documentation updates. (@isomoes)

## [0.2.7]

- Settings: Deleted prop-injected servers (e.g. the default GitHub Pages server) now stay removed after a page reload instead of reappearing on every visit. (@isomoes)
- UI: Removed session sharing actions from the session header to simplify the interface. (@isomoes)
- Settings: Narrowed built-in i18n support to English and Chinese, removing unmaintained locale files to improve translation quality going forward. (@isomoes)
- Docs: Refreshed the README and Quick Start guide with clearer setup instructions; removed unused internal documentation files. (@isomoes)

## [0.2.6]

- Web/CLI: Added runtime support for serving the app under the `/ikanban/` base path, including prefixed SPA routes and API proxy path handling for same-origin deployments. (@isomoes)
- Routing: Updated the app router and OpenCode server URL resolution to honor Vite `BASE_URL`, preventing path mismatches when deployed to GitHub Pages subpaths. (@isomoes)
- CI: Simplified release build flow by producing the web artifact once with `VITE_BASE_PATH=/ikanban/` before publishing npm and GitHub Pages outputs. (@isomoes)

## [0.2.5]

- CI: Added GitHub Pages deployment to the publish workflow so site assets can be deployed automatically during releases. (@isomoes)
- CI: Fixed asset 404s on GitHub Pages by building with `VITE_BASE_PATH=/ikanban/` so all asset paths resolve correctly under the repository subpath. (@isomoes)

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

- Release: Updated version metadata for the `0.1.3` release line. (@isomoes)

## [0.1.2]

- CLI: Renamed published npm package names to `ikanban-web` and `ikanban-ui`; update install commands to use the new names. (thanks to @isomoes)
- CLI: Added a one-line install script that checks Node.js requirements, detects your package manager, and installs `ikanban-web` automatically. (thanks to @isomoes)
- Docs: Updated CLI and setup examples to use the `ikanban` command and current repository links. (thanks to @isomoes)
- Release: Enabled npm trusted publishing (OIDC) to improve release security and reduce publish-token setup. (thanks to @isomoes)
- Release: Consolidated the publish workflow naming while keeping automated npm package and GitHub release artifact publishing. (thanks to @isomoes)

## [0.1.1]

- Release: Published the `0.1.1` release line. (@isomoes)

## [0.1.0]

- Initial release of iKanban with a web runtime for interacting with an OpenCode server.
- Added a Kanban-oriented interface with chat, settings, and terminal workflows.
- Added live OpenCode event streaming and client integration in the shared UI layer.
- Added web server support for OpenCode runtime integration, git operations, and PTY terminal sessions.
- Added a shared UI package with reusable components, theming, and typography foundations.
