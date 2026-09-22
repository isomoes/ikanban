# iKanban Agent Notes

- Base the frontend on the OpenCode `v2` branch's shared desktop/web application.
  `packages/web` is the only application; `packages/ui` and `packages/session-ui`
  contain its upstream shared components. Track the imported upstream revision in
  `docs/upstream.json`; follow `docs/upstream.md` when syncing.
- Use native OpenCode V2 types and `@opencode/client` (including its Solid data
  layer). Follow the upstream server connection and authentication implementation.
- Keep backend sessions, execution, providers, and credentials owned by OpenCode.
  DSH and the old CLI/proxy are retired.
- Deploy static files only to GitHub Pages at `/ikanban/`. Never default API calls
  to the Pages origin or implicit localhost in production. With no configured or
  saved server, show the upstream connection screen. Use upstream Basic auth
  (`opencode` + server password); the backend must allow the frontend origin via CORS.
- Toolchain: Bun 1.3.12, Node ^22.19.0 or >=24. Install with
  `bun install --frozen-lockfile`.
- Check changes with `bun run typecheck`,
  `bun run --cwd packages/web test:unit`, and `bun run build:web`.
- For Pages browser checks, build with `VITE_OPENCODE_URL` unset, then run
  `bun run --cwd packages/web test:pages` (requires Playwright Chromium).
- Keep the root/web iKanban release version separate from the shared libraries'
  upstream version. Validate releases with `node scripts/check-release.mjs v<version>`.
- Use `VITE_OPENCODE_URL=http://127.0.0.1:4096 bun run dev` for development.
  Read README.md and docs/architecture.md for V2 differences; follow
  prompts/release.md for releases.
