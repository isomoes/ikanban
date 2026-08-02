# Pi Agent Web

Pi Agent Web runs a local Pi coding-agent session behind a loopback-only browser interface. The server serves the production web build, exchanges a startup token for an HTTP-only session cookie, and streams agent events over an authenticated WebSocket.

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

The server prints a browser URL containing a startup token. Open that exact URL. The client exchanges the token for a session cookie and removes it from the address bar. Treat the printed URL as a secret while it remains valid.

## Configuration

- `PI_WEB_WORKSPACE` explicitly selects the workspace and takes priority over `INIT_CWD` and the server process working directory.
- `PORT` changes the HTTP port from `4097`.
- `PI_WEB_STARTUP_TOKEN` explicitly overrides the generated startup token. It is intended primarily for deterministic integration tests and should not be used routinely.
- `PI_WEB_FAKE_RUNTIME=1` selects the deterministic echo runtime used by browser tests. Every other value uses the real Pi runtime.

Pi loads project resources from `.pi/` and skills from `.agents/skills/` within the selected workspace. Authentication remains in `~/.pi/agent/auth.json`. Pi persists sessions as JSONL using its native session storage, so existing recent sessions can continue across server restarts.

## Security

The gateway binds only to `127.0.0.1`. It is not designed or hardened for remote access, reverse proxies, shared machines, or untrusted local users. Token exchange, authenticated API requests, and WebSocket connections enforce a loopback client address and a local Origin when one is supplied. API and WebSocket access also require the exchanged session cookie; the startup token is not returned by bootstrap responses.

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

The Playwright test starts the built application on port `4177` with the fake runtime and a deterministic startup token.

## Deferred From V1

V1 intentionally excludes database-backed storage, remote access, project switching, multiple active sessions, child-agent management, embedded terminals, git review workflows, and extension management. Session persistence and credentials remain Pi-native rather than being duplicated by this application.
