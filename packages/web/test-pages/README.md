# GitHub Pages fixture smoke

From the repository root, after installing the locked dependencies and building:

```sh
(cd packages/web && bunx playwright install chromium)
env -u VITE_OPENCODE_URL bun run build:web
bun run --cwd packages/web test:pages
```

Build without `VITE_OPENCODE_URL` or backend credentials: the first-visit tests
intentionally require the normal unconfigured Pages deployment. Bun must be on
`PATH`, and Playwright's Chromium system dependencies must be installed (on a
fresh Linux CI runner, run `bunx playwright install --with-deps chromium` from `packages/web`).
`PLAYWRIGHT_PAGES_PORT` optionally changes the static server port from 4178.
For an existing local Chromium installation, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`
can supply its executable; CI should use the browser matching the locked Playwright.

The config only serves the existing `packages/web/dist`; it never installs or
builds. Its static server mounts files at `/ikanban/`, returns the actual
`404.html` with HTTP 404 for missing paths, and has no API proxy. Service workers
are blocked for cold-load tests so they cannot hide a broken Pages fallback.
A separate test enables the real built service worker and verifies registration,
scope, and an offline deep-link reload.

The connection test starts a read-only, ephemeral local HTTP API fixture. It
exercises the production browser client, CORS preflight, Basic `opencode:password`
headers, a rejected password, SSE, persisted connections, and settings navigation.
It does not seed upstream persistence keys or replace browser fetch. Unrecognized
fixture endpoints fail verification. These are **fixture smoke tests**, not live
OpenCode backend, provider, or model-execution validation.

Failure screenshots and traces are written to `test-pages/test-results/`.
Typecheck just this harness with
`packages/web/node_modules/.bin/tsgo --noEmit -p packages/web/test-pages/tsconfig.json`.
