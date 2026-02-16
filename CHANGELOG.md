# Changelog

All notable changes to this project will be documented in this file.

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
