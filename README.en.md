# iKanban

[中文](./README.md) | English

iKanban is a standalone static frontend for **OpenCode V2**, based directly on
the upstream shared desktop/web application.

## Native V2 frontend

iKanban remains at **0.6.0**. The frontend is imported from OpenCode's `v2` branch,
version **2.0.12**, commit `dcfe1ec7bd4922d4f44c141ba33047402bffc57e`.

- `packages/web`: the only application, imported from upstream `packages/app`.
- `packages/ui` and `packages/session-ui`: upstream shared components, used as private workspaces.
- Native V2 types, `@opencode/client`, and its Solid data layer replace the old
  v0.3.18 UI and adapters.
- The upstream project/session navigation, timeline, composer, file and diff views,
  terminal, model selection, and settings are included. Desktop-only features are
  gated by the upstream web platform's capabilities.

An independent OpenCode backend owns sessions, execution, tools, providers, and
provider credentials. See [the architecture](./docs/architecture.md) and
[upstream provenance and sync instructions](./docs/upstream.md).

## Connect a backend

Open [iKanban](https://isomoes.github.io/ikanban/) and enter your OpenCode V2 server
URL and password on the connection screen. Authentication follows upstream
**HTTP Basic**, with the fixed username `opencode` and the server password.
Use server management to add, edit, and switch backends at runtime without rebuilding.

With no saved servers and no `VITE_OPENCODE_URL`, the upstream connection screen
appears. The app does not implicitly connect to the Pages origin or `localhost`.
Browser storage uses an iKanban namespace; connection and layout state from the
old UI is not automatically imported. You may need to add your server again after upgrading.

GitHub Pages serves static files only. The browser connects directly to the backend,
which requires:

- A browser-accessible **HTTPS** URL for remote use.
- CORS allowing **`https://isomoes.github.io`**, without the `/ikanban/` path.
- Authentication headers, event streaming, and WebSocket support for the terminal.

For example, run a foreground backend behind an HTTPS reverse proxy and allow the
Pages origin:

```sh
opencode serve --hostname 127.0.0.1 --port 4096 --cors https://isomoes.github.io
```

Configure the listening address and HTTPS proxy for your deployment, then enter
the password printed by the server in the UI. For an existing shared service,
`opencode pair` shows connection addresses and credentials. See the
[OpenCode V2 web guide](https://opencode.ai/v2/docs/cli/web).

## Development

Requirements: Bun **1.3.12** and Node **^22.19.0 or >=24.0.0**.

```sh
bun install --frozen-lockfile
VITE_OPENCODE_URL=http://127.0.0.1:4096 bun run dev
```

Open the Vite URL at `/ikanban/`. Run an OpenCode V2 backend separately:

```sh
opencode serve --hostname 127.0.0.1 --port 4096
```

Enter the password printed by the server in the UI. If an additional development
origin is needed, add `--cors <Vite origin>` to `serve`, including its actual port
and omitting the path. Port `4096` is explicitly selected in this example, not an
implicit application default.

```sh
bun run typecheck
bun run --cwd packages/web test:unit
bun run build:web
bun run preview:web --port 3000
```

Preview the built application at `http://localhost:3000/ikanban/`.
`VITE_OPENCODE_URL` provides an optional build-time backend default; users can still
change servers at runtime. Never put passwords, tokens, or other credentials in
Vite environment variables.

Optional Pages browser checks use a production build without a default backend
and Playwright Chromium:

```sh
(cd packages/web && bunx playwright install chromium)
env -u VITE_OPENCODE_URL bun run build:web
env -u VITE_OPENCODE_URL bun run --cwd packages/web test:pages
```

These cover first connection, a Basic-auth test fixture, deep links, and PWA scope;
they do not verify real model execution.

## Distribution

The tag-driven workflow validates release versions, checks types, and builds the
app before deploying `packages/web/dist` to **GitHub Pages** at
`/ikanban/`. Set the repository's Pages source to **GitHub Actions**. The optional
repository variable `VITE_OPENCODE_URL` sets the build default; leaving it empty
lets users enter a backend on the connection screen.

The app uses history routes with a `404.html` shell for deep links, and its PWA is
scoped to `/ikanban/`. The root and all three workspaces are private. The root and
web app use the iKanban version; the two shared libraries keep their upstream version.

See [the release procedure](./prompts/release.md). `CHANGELOG.md` and earlier
migration notes describe their historical releases; the architecture and upstream
provenance documents describe the current implementation.
