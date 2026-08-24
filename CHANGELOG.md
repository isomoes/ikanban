# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.4.18]

- Extracted the product-neutral browser surface into the publishable `@isomoes/dsh-web-ui` package while preserving iKanban branding in the bundle.
- Added trusted publishing and release artifacts for the shared Web UI package.

## [0.4.17]

- Added per-workspace persistence for model selection defaults.
- Added keyboard navigation to conversation message history.

## [0.4.16]

- Added documented support for binding the iKanban Web interface to LAN-accessible hosts.
- Hid the standard agent preset while preserving access to configured custom presets.

## [0.4.15]

- Migrated the complete DSH dependency family and owned browser source to `0.1.1-rc.1`.
- Adopted structured Web index injection, transport-aware boot loading, multiline questions, wide Markdown tables, improved reference editing, permission presentation, blank-session ordering, and exhausted-retry errors.
- Replaced the subagent catalog header action with the rc.1 lineage switcher while preserving iKanban identities, custom themes, keyboard behavior, workspace actions, and reminder sounds.

## [0.4.14]

- Added iKanban as a built-in DeepSeek Harness preset with its complete agent and plugin composition.
- Added configurable session reminder sounds for completed responses and permission requests.

## [0.4.13]

- Fixed file and session `@` references in clean published-profile startups by explicitly registering their remote API manifests.

## [0.4.12]

- Migrated the complete owned browser surface and runtime dependency family to DeepSeek Harness `0.1.0-rc.8`.
- Adopted the rc.8 module-loader facade and dynamic UI renderer, attachment, branding, and unified file/session reference plugins.
- Added command error banners, file-open failure recovery, a floating feedback-note editor, user-controlled workflow disclosures, and model-picker bulk selection.
- Preserved iKanban branding, keyboard shortcuts, timeline, workspace actions, custom themes, and release labels across the source refresh.

## [0.4.11]

- Updated DeepSeek Harness dependencies to `0.1.0-rc.7`.
- Preserved development build labels across client bundle rebuilds.
- Removed the redundant new-session button from the sidebar.

## [0.4.10]

- Added a workspace changes view for reviewing project diffs directly in the conversation interface.
- Added configurable keyboard shortcuts for switching between conversation views.

## [0.4.9]

- Added fuzzy-search workspace actions for quickly opening projects from the command palette.
- Opened the next available session automatically after archiving the active session.

## [0.4.8]

- Added customizable keyboard shortcuts with a settings interface, local persistence, and conflict-aware action registration.

## [0.4.7]

- Added a compact conversation view switcher for changing session modes with less visual clutter.
- Added a searchable session mode palette with keyboard-friendly navigation.
- Added a project-level MCP agent preset and bundled loader for project-specific MCP configuration.

## [0.4.6]

- Added a timeline branch command for starting a new session from an earlier conversation point.
- Removed obsolete upstream synchronization metadata and checks from the self-contained Web UI fork.
- Removed the session log download extension and its unused dependency.

## [0.4.5]

- Added a GitHub Dark Colorblind theme preset for higher-contrast, colorblind-friendly diffs and interface colors.
- Restored the `Cmd/Ctrl + L` sidebar toggle shortcut.
- Made Web UI builds reproducible by preserving the reviewed fork composition and discovering client entries dynamically.
- Strengthened browser bundle ownership by using local client package identities, theme styles, runtime slots, and platform module aliases.

## [0.4.4]

- Added an archive-session command with a keyboard shortcut for faster session cleanup.
- Preserved prompt focus when switching sessions.
- Displayed the package version in the sidebar brand and clearly labeled development builds.
- Excluded source maps from the published package and added package-content coverage.
- Expanded installation and update documentation, including the v0.4.2 Bilibili walkthrough.

## [0.4.3]

- Added workspace file mentions with fuzzy-search suggestions in the prompt composer.
- Stabilized file suggestions with improved matching, menu layout, and source ownership coverage.
- Refreshed README links and documented the recent release history.

## [0.4.2]

- Linked the sidebar brand to the home page for quicker navigation.
- Preserved the development build marker when client bundles rebuild during watch mode.
- Aligned tool scheduler dependencies with the packaged runtime composition.

## [0.4.1]

- Added a local command palette with searchable actions, keyboard navigation, and responsive desktop and mobile presentation.
- Identified release and development builds in the browser UI so the active build type and version are visible at runtime.
- Removed the native directory picker installation requirement by providing the picker through the iKanban bundle.
- Improved npm package metadata and installation documentation.

## [0.4.0]

- Reinitialized iKanban as the `@isomoes/dsh-ikanban` DeepSeek Harness plugin bundle.
- Removed the legacy standalone web application, Docker deployment, Bun workspace, and generated assets.
- Delegated the host runtime to the published DSH `0.1.0-rc.6` packages while replacing its browser composition with iKanban-owned clients.
- Imported the complete editable Web UI source into `packages/web-ui`, with pinned upstream provenance and explicit reviewed refreshes.
- Packaged the Vite browser shell and 30 isolated virtual client bundles inside the public plugin so profiles install only `@isomoes/dsh-ikanban`.
- Added a full development watch loop with per-client HMR, browser shell rebuilds, and an isolated `ikanban-dev` profile.
- Replaced DeepSeek browser branding with iKanban visuals and fixed Surfingkeys hints for opening sessions and session actions.
- Added self-contained package builds, browser boot and bundle coverage, upstream parity checks, and reproducible composition synchronization.
- Added tag-driven npm trusted publishing, packaged GitHub release artifacts, and documented release and local development workflows.
- Organized the publishable plugin and private Web UI fork in a pnpm workspace with standardized dependency management and scripts.

## [0.3.18]

- Web: Restored undo for pasted prompt content, including programmatic paste paths, so pasted text can be reverted reliably. (@isomoes)

## [0.3.17]

- Web: Added a project command to restart OpenCode and reload skills, MCPs, and project configuration without leaving the session. (@isomoes)
- Web: Displayed the active project name in the session status rail for clearer workspace context. (@isomoes)

## [0.3.16]

- CI: Integrated Docker image publishing into the release workflow, reusing the web build artifact and supporting Docker-only release backfills. (@isomoes)

## [0.3.15]

- Web: Prevented deleting the final configured server so the workspace always retains a usable connection. (@isomoes)
- Docker: Added a multi-stage web image and GitHub Actions workflow for publishing multi-platform releases to GitHub Container Registry. (@isomoes)
- Docs: Documented current features, Docker usage, the v0.3.1-to-v0.3.14 product evolution, and the v0.3.14 Bilibili introduction. (@isomoes)

## [0.3.14]

- Web: Linked the home icon to the iKanban GitHub repository for quicker access to the project source. (@isomoes)
- Web: Preserved the normal desktop conversation width in fullscreen so messages and the composer remain comfortably readable. (@isomoes)

## [0.3.13]

- Web: Enabled keyboard scrolling throughout session conversations so timeline navigation remains available across the full message view. (@isomoes)
- Web: Displayed MCP tool results with clearer result details and improved spacing for easier scanning. (@isomoes)

## [0.3.12]

- Web: Refined chat history spacing across conversation turns, thinking rows, context tools, and assistant text for clearer visual separation. (@isomoes)

## [0.3.11]

- Web: Compacted tool-call history and timing details for a denser, easier-to-scan conversation view. (@isomoes)
- Web: Reconstructed session and apply-patch file diffs so historical changes render reliably in review views and tool output. (@isomoes)

## [0.3.10]

- Web: Showed historical session changes in the sidebar so completed work remains visible when reviewing past sessions. (@isomoes)
- Web: Added distinct badges for tool calls so different tool types are easier to identify at a glance. (@isomoes)

## [0.3.9]

- Web: Added an expandable prompt composer with localized controls, responsive styling, and accessibility coverage for a more flexible writing area. (@isomoes)

## [0.3.8]

- Web: Refined session interactions and spacing, including improved mobile viewport handling and cleaner home and session layouts. (@isomoes)
- Docs: Added the MIT license and updated package and README licensing details. (@isomoes)

## [0.3.7]

- Web: Refined the cockpit layout across sessions, prompts, settings, dialogs, mobile navigation, and error states with denser responsive styling and stronger accessibility behavior. (@isomoes)
- Web: Improved home board interactions and simplified project directory selection to a single workspace at a time. (@isomoes)
- Skills: Added the `design-taste-frontend` skill for more deliberate frontend design and redesign workflows. (@isomoes)

## [0.3.6]

- Web: Preserved the active server independently per browser tab so switching servers in one tab no longer changes another tab's selection. (@isomoes)
- Web: Persisted archived sessions through the OpenCode SDK so archive state is shared with the server instead of remaining browser-local. (@isomoes)
- Docs: Refreshed the README diff panel preview to reflect the current review UI. (@isomoes)

## [0.3.5]

- Web: Redesigned the diff panel with a PR-style review UI, fetching the project diff via a single full-context VCS diff call instead of per-file reads and fixing empty diffs for modified files. Added a summary header with file counts and +/- totals, a file filter, and per-file viewed progress that persists. (@isomoes)
- Web: Defaulted the session todo dock to collapsed so sessions start with a cleaner composer. (@isomoes)

## [0.3.4]

- Web: Showed per-tool call durations and the session total run time in the title bar so long-running work is easier to track. (@isomoes)
- Web: Replaced OpenCode branding with the iKanban icon and defaulted the ikanban panel to closed on session entry. (@isomoes)
- Docs: Added a Chinese README plus an English translation with a remote control agent section. (@isomoes)
- Dependencies: Updated `@opencode-ai/sdk` to `1.17.18` to stay current with upstream fixes. (@isomoes)

## [0.3.3]

- Web: Showed the active server name in the page title and let the meta title control the page title so browser tabs reflect the current server. (@isomoes)
- Web: Removed the ikanban node graph function and simplified the project structure by clearing out dead code. (@isomoes)

## [0.3.2]

- Web: Removed the session ikanban task graph, including the task graph pane, node details, and related session/state helpers, reverting the ikanban panel to an empty placeholder. (@isomoes)

## [0.3.1]

- Home: Excluded child sessions from the home idle board so starting an ikanban task no longer shows duplicate session cards. (@isomoes)

## [0.3.0]

- Web: Added a session ikanban task graph, moved node details into the main pane, restored session tab borders, and persisted archive state in browser storage so session workflows stay clearer and more durable. (@isomoes)
- Config: Switched the default local server to port `4097` to better match the current local setup. (@isomoes)
- Docs: Expanded the multi-agent intro, added a release prompt checklist, and refreshed the README with a star history chart. (@isomoes)

## [0.2.15]

- Build: Replaced broken `packages/web/public` asset symlinks with real tracked files so release and GitHub Pages builds no longer fail after the UI package cleanup. (@isomoes)

## [0.2.14]

- Review: Moved diff context into file tabs, removed the separate file tree review flow, and restored renderable file diff context so change review stays simpler and more reliable. (@isomoes)
- Skills: Added support for task-scoped `ikanban` skill outputs so skill results stay isolated to the active task flow. (@isomoes)
- Build: Vendored the remaining shared UI code and removed obsolete workspace packages to simplify the project structure. (@isomoes)
- Dependencies: Updated `@opencode-ai/sdk` to `1.3.2` to stay current with upstream fixes and compatibility updates. (@isomoes)

## [0.2.13]

- Home: Limited the web home status board to opened sessions so the landing view stays focused on active work instead of showing every known session. (@isomoes)
- UI: Unified inline tool duration formatting across tool cards and session turns so timing details render more consistently in the interface. (@isomoes)

## [0.2.12]

- Web: Separated server row actions in the server picker so hint navigation and row interactions behave more predictably. (@isomoes)
- UI: Removed the desktop sidebar toggle to simplify the main web layout and reduce redundant navigation controls. (@isomoes)
- Home: Skipped project bootstrap work on the home screen so the landing view loads with less unnecessary session setup. (@isomoes)
- Branding: Updated iKanban naming and copy across the web UI to keep product text consistent. (@isomoes)
- Docs: Refreshed the README Bilibili video link. (@isomoes)

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
