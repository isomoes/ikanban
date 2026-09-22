# Native OpenCode V2 frontend

## Baseline and workspaces

iKanban imports OpenCode's complete shared desktop/web frontend from the `v2`
branch at `dcfe1ec7bd4922d4f44c141ba33047402bffc57e` (upstream 2.0.12).
The application version remains 0.6.0. See [upstream provenance](./upstream.md)
for source mappings, local changes, licenses, and the update procedure.

| Local workspace | Upstream source | Role | Version policy |
| --- | --- | --- | --- |
| `packages/web` | `packages/app` | Only deployable application | iKanban release |
| `packages/ui` | `packages/ui` | Shared UI primitives, themes, assets | Upstream version |
| `packages/session-ui` | `packages/session-ui` | Shared session rendering | Upstream version |

All three workspaces and the root project are private. Only static web assets are
deployed; the shared libraries are not independent applications.

## Runtime boundaries

```text
packages/web — upstream shared SolidJS desktop/web application
    ├── packages/ui — shared UI and themes
    ├── packages/session-ui — native session rendering
    └── @opencode/client/solid — native V2 data layer
            └── @opencode/client — native V2 HTTP client
                    │ authenticated HTTP, events, terminal WebSocket
                    ▼
            Independent OpenCode V2 server
            sessions · execution · tools · providers · permissions · configuration
```

The old v0.3.18 UI and `src/client/{adapter,convert,events,types}.ts` compatibility
layer have been replaced. Rendering and state management consume native V2 data
through the upstream client and Solid integration. Follow upstream implementations
for message history, permissions, forms, provider authentication, configuration,
and event recovery rather than introducing a second UI-specific API model.

The web platform controls availability of desktop-specific operations. Importing
shared desktop/web code does not provide an Electron host, local process launcher,
native updater, SSH manager, or WSL runtime in GitHub Pages. Backend sessions,
execution, provider secrets, and tools remain owned by OpenCode. DSH and the former
CLI/proxy are retired.

## Server connections and browser state

Server selection, health checks, and authentication follow the upstream connection
flow. Users enter a server URL and password in the connection screen or server
management dialog. HTTP authentication uses the upstream Basic scheme with username
`opencode`; it is not the old adapter's Bearer-token/custom-username form.

An optional `VITE_OPENCODE_URL` supplies an explicit build-time server default.
Saved connections and runtime selection use upstream persistence with an iKanban
namespace. Without a configured default or saved server, show the connection screen.
Production must not infer a backend from the Pages origin or silently use localhost.
Server addresses and connection state can be changed at runtime without rebuilding.
Legacy UI storage is not automatically migrated into the new namespace.

The browser retains the connection information needed to reconnect, including the
server password through upstream persistence. This is separate from backend-owned
provider credentials. Build variables and static assets must never contain credentials.

## GitHub Pages and networking

- Public path: `https://isomoes.github.io/ikanban/`.
- Output: `packages/web/dist` only.
- History routes use `/ikanban/` as their base. `404.html` loads the application
  shell for direct project/session URLs; Pages may return HTTP 404 for these deep
  links while the client renders the route.
- Asset paths, PWA start URL, service worker scope, and navigation fallback must
  remain within `/ikanban/`.
- Pages provides no backend or reverse proxy. The browser needs a reachable HTTPS
  OpenCode V2 server for remote use, with CORS allowing `https://isomoes.github.io`
  (an origin has no path). Use the actual origin and port for local development.
- A backend reverse proxy must preserve authentication, streaming responses, and
  WebSocket upgrades for terminal connections. HTTP CORS configuration alone does
  not establish WebSocket connectivity.

## Verification

```sh
bun install --frozen-lockfile
bun run typecheck
bun run --cwd packages/web test:unit
bun run build:web
```

Run tests locally before release. The Pages workflow installs dependencies, validates
release versions, checks types, and builds the static app. Check
the built app under `/ikanban/`, including a direct history URL, static assets, and
PWA scope. In a fresh browser state without a default backend, verify the connection
screen and absence of implicit backend requests.

`bun run --cwd packages/web test:pages` automates static-hosting smoke checks with
Playwright Chromium: first connection, a Basic-auth fixture, the `404.html` deep-link
shell, and manifest/service-worker scope. Build with `VITE_OPENCODE_URL` unset before
running it locally. CI builds once with the optional repository backend default.

For a release, separately verify URL/password connection, server switching, project
and session loading, a prompt and streamed response, permission/form interaction,
file/diff display, and a terminal against a real compatible V2 backend. Record the
backend version and what was actually exercised. Unit tests and a successful build
do not establish live-backend or provider compatibility.
