# iKanban

[中文](./README.md) | English

iKanban is a standalone frontend for **OpenCode V2**.

## Migration status

The application reuses the **v0.3.18 SolidJS UI** with **`@opencode/client` 2.0.11**.
The DSH implementation has been removed. `packages/web` is the only application,
deployed as static files to **GitHub Pages**.

Project/session navigation, message timelines, the composer, file and diff views,
model selection, themes, and settings are restored. A typed adapter converts V2
messages, permissions, forms, models, and events into UI view models.
See [the architecture notes](./docs/architecture.md).

## Development

Requirements: Bun **1.3.12**, Node **22.19+ or 24+**, and a separate OpenCode V2
server for API access.

```sh
bun install --frozen-lockfile
VITE_OPENCODE_URL=http://127.0.0.1:4096 bun run dev
```

Open the Vite URL at `/ikanban/`. Start a dedicated backend separately if needed:

```sh
opencode serve --hostname 127.0.0.1 --port 4096
```

OpenCode V2 requires authentication and must allow the frontend origin via CORS.
Use the server selector to enter the backend URL. For Bearer authentication, leave
the username empty and enter the token in the password/token field. For Basic
authentication, enter both username and password. `src/client.ts` creates the V2
network client with authentication headers. Without `VITE_OPENCODE_URL`, the initial
server is `http://127.0.0.1:4096`; API calls never default to the Pages origin.

```sh
bun run typecheck
bun run --cwd packages/web test:unit
bun run build:web
bun run preview:web --port 3000
```

Preview the built static application at `http://localhost:3000/ikanban/`.
For a build-time backend default, set `VITE_OPENCODE_URL` when running
`bun run build:web`.

## Distribution

The tag-driven workflow checks and builds the app, then deploys
`packages/web/dist` to **GitHub Pages** at `/ikanban/`. Configure the repository's
Pages source as **GitHub Actions**. Both workspace manifests are private.

GitHub Pages has no proxy. The UI hosted there must connect directly to a
reachable HTTPS OpenCode V2 server configured to allow its origin via CORS. A
custom build can set `VITE_OPENCODE_URL`; the Pages workflow also accepts it as a
repository variable. Never put credentials in Vite variables.

## V2 differences

- Session archiving is a browser-local preference, isolated by server URL, and is
  not synchronized with other clients.
- Sharing, worktree reset, and LSP status are unavailable in the V2 API; their
  actions are not enabled.
- Settings update an existing global server JSON/JSONC document through the V2
  file API and reload configuration, preserving unrelated fields and comments.
  Create a global configuration on the server first if none exists.
- Event streams reconnect and reload loaded timelines after interruption; the V2
  stream itself has no replay.

See [the release procedure](./prompts/release.md). Previous releases and historical
migration notes remain in `CHANGELOG.md` and `docs/`.
