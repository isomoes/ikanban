# Pi Agent Web

Pi Agent Web runs local Pi coding-agent sessions behind a loopback-only browser interface. The server serves the production web build and streams agent events directly to the local browser.

## Requirements

- Node.js 24.12 or newer
- Corepack with pnpm available
- Pi provider credentials in `~/.pi/agent/auth.json`

## Install And Run

Run commands from the repository root. For normal pnpm use, Pi uses pnpm's original invocation directory (`INIT_CWD`) as its workspace even though the server package runs from `apps/server`. If pnpm does not provide `INIT_CWD`, Pi falls back to the server process working directory.

```bash
corepack pnpm install
corepack pnpm dev
corepack pnpm build
corepack pnpm start
```

`dev` starts the Vite client and local gateway for development. For production, run `build` before `start`; the build runs the protocol, web, and server packages in that order. The server detects `apps/web/dist` at startup and serves it when present.

The server prints the local browser URL. Open it directly; local mode does not require a token or login.

## Configuration

- `PI_WEB_WORKSPACE` explicitly selects the workspace and takes priority over `INIT_CWD` and the server process working directory.
- `PORT` changes the HTTP and development proxy port from `4098`.
- `PI_WEB_FAKE_RUNTIME=1` selects the deterministic echo runtime used by browser tests. Every other value uses the real Pi runtime.

Pi loads project resources from `.pi/` and skills from `.agents/skills/` within the selected workspace. Authentication remains in `~/.pi/agent/auth.json`. Pi persists sessions as JSONL using its native session storage, so existing recent sessions can continue across server restarts.

## Workspaces And Sessions

The homepage follows the iKanban `v0.3.14` session board: sessions from every opened workspace are merged into **Progress** and **Idle** columns, with active runs shown under Progress and recent inactive sessions under Idle. Use **Open workspace** to browse directories on the host running Pi Agent Web and add another path to the board.

Opening a card navigates to `/<workspace-id>/<session-id>`, where `workspace-id` is the URL-safe encoded absolute workspace path. Browser back, forward, and the Home button return to the board or reopen the selected conversation. Each loaded session has its own Pi runtime, so work in other sessions and workspaces continues while you navigate elsewhere.

The archive action hides a session from the board and selectors without deleting or modifying its native Pi JSONL file. Archive metadata is stored separately in `~/.pi/agent/pi-web-archives.json` and remains effective across server restarts.

## Security

The gateway binds only to `127.0.0.1`. It is not designed or hardened for remote access, reverse proxies, shared machines, or untrusted local users. API, directory-browser, and WebSocket access require loopback clients and local origins, but local mode intentionally has no authentication. The directory browser exposes directory names and absolute paths available to the server process. Encoded workspace IDs in conversation URLs are identifiers, not access controls. Remote access will require a separate security design.

The agent has host-level power. Pi tools such as `bash`, installed extensions, and project-provided skills can read, modify, and execute files with the permissions of the user running the server. Review workspace resources and extensions before starting the application. Loopback binding prevents network exposure but does not sandbox the agent.

`SIGINT` and `SIGTERM` trigger graceful shutdown: the HTTP server closes, active runtime work is aborted, and runtime resources are disposed before exit.

## Verification

```bash
corepack pnpm test
corepack pnpm typecheck
corepack pnpm build
corepack pnpm exec playwright install chromium
corepack pnpm test:e2e
```

The Playwright test starts the built application on port `4177` with the fake runtime.

## Deferred From V1

V1 intentionally excludes database-backed storage, remote access, child-agent management, embedded terminals, git review workflows, and extension management. Session persistence and credentials remain Pi-native rather than being duplicated by this application.
