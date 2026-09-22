# iKanban web application

This is the OpenCode V2 shared desktop/web frontend imported from upstream
`packages/app`, running with its browser platform. See the root
[README](../../README.en.md) for connection and deployment instructions, and
[upstream provenance](../../docs/upstream.md) for the pinned source and update process.

## Development

From the repository root:

```sh
bun install --frozen-lockfile
VITE_OPENCODE_URL=http://127.0.0.1:4096 bun run dev
```

Open `/ikanban/` at the address printed by Vite. The backend is a separately
running OpenCode V2 server. Without `VITE_OPENCODE_URL` or a saved server, the app
opens the upstream connection screen. Authentication uses the upstream fixed
`opencode` username and server password.

## Checks

```sh
bun run typecheck
bun run --cwd packages/web test:unit
bun run --cwd packages/web test:browser
bun run --cwd packages/ui test
bun run --cwd packages/session-ui test
env -u VITE_OPENCODE_URL bun run build:web
bun run --cwd packages/web test:pages
```

The Pages suite requires Playwright Chromium. Install it from this package with
`bunx playwright install chromium`. It exercises the production build with a
Pages-style static server and controlled API fixtures. It does not execute models
on a real backend.

The imported upstream `e2e/` directory contains additional reference scenarios;
`playwright.pages.config.ts` is the deployment-specific browser suite for local
release verification.

## Static deployment

`bun run build:web` emits `packages/web/dist`. Vite resources, application routes,
manifest, and service worker are scoped to `/ikanban/`. The generated `404.html`
loads the application for direct session links on GitHub Pages.

The browser connects directly to the user-configured backend. Production builds
never infer a backend from the Pages origin. A remote HTTPS backend must allow
the frontend origin through CORS and support the event stream and terminal
WebSocket endpoints.
