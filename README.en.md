# iKanban

[中文](./README.md) | English

iKanban is a standalone frontend for **OpenCode V2**.

## Migration status

The repository has returned to the v0.3 single-application architecture.
The DSH implementation has been removed. `packages/web` is the only application,
deployed as static files to **GitHub Pages**.

This is the **cleanup and foundation stage**: the browser currently displays a
small placeholder page. The new UI will be built against `@opencode/client`;
its frontend framework is still to be selected. See [the architecture notes](./docs/architecture.md).

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
The browser connects directly to the backend. The future UI will implement server
selection and sign-in. `src/client.ts` accepts a server URL and authentication headers.

```sh
bun run typecheck
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

GitHub Pages has no proxy. A future UI hosted there must connect directly to a
reachable HTTPS OpenCode V2 server configured to allow its origin via CORS. A
custom build can set `VITE_OPENCODE_URL`; the Pages workflow also accepts it as a
repository variable. Never put credentials in Vite variables.

See [the release procedure](./prompts/release.md). Previous releases and historical
migration notes remain in `CHANGELOG.md` and `docs/`.
