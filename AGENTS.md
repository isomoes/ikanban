# iKanban Agent Notes

- Reuse the SolidJS UI restored from `v0.3.18`; migrate integrations rather than
  rebuilding the interface. `packages/web` is the only application.
- All backend traffic uses `@opencode/client` for OpenCode V2. The client factory
  is `packages/web/src/client.ts`; typed UI adapters live in `src/client/`.
- Keep backend sessions, execution, providers, and credentials owned by OpenCode.
  DSH and the old CLI/proxy are retired.
- Deploy static files only to GitHub Pages at `/ikanban/`. Never default API calls
  to the Pages origin. Authentication uses headers; the backend must allow CORS.
- Toolchain: Bun 1.3.12, Node ^22.19.0 or >=24. Install with
  `bun install --frozen-lockfile`.
- Check changes with `bun run typecheck`,
  `bun run --cwd packages/web test:unit`, and `bun run build:web`.
- Use `VITE_OPENCODE_URL=http://127.0.0.1:4096 bun run dev` for development.
  Read README.md and docs/architecture.md for V2 differences; follow
  prompts/release.md for releases.
