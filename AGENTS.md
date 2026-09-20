# iKanban Agent Notes

## Architecture

- iKanban is one static browser application in `packages/web`, deployed only to
  GitHub Pages. The application boundary follows v0.3.18; both workspace
  manifests are private, and there is no package publishing or server runtime.
- The backend is an independently managed OpenCode **V2** server. Use
  `@opencode/client` to connect directly to the V2 API from the browser.
- The DSH implementation and the old v0.3 frontend have been retired. Build the
  new UI from a clean foundation. Its framework has not yet been selected; the
  current vanilla TypeScript page is an intentional migration placeholder.
- `packages/web/src/client.ts` is the browser-client entry point. Pass server
  credentials in headers. Static hosting needs an explicit backend URL and CORS.
- Keep backend authentication, sessions, tools, providers, and execution owned by
  OpenCode. Do not add DSH plugin composition or restore old frontend code.

## Commands

- Toolchain: Bun `1.3.12`, Node `^22.19.0 || >=24`.
- Install: `bun install --frozen-lockfile`.
- Development: `VITE_OPENCODE_URL=http://127.0.0.1:4096 bun run dev`.
- Build: `bun run build:web`; local preview: `bun run preview:web --port 3000`.
- Checks: `bun run typecheck && bun run build:web`.
- The app base is `/ikanban/`. The API belongs to the configured OpenCode server;
  never default API requests to the Pages origin.

## Release

- Follow `prompts/release.md`. `bun run bump-version <version>` updates both
  manifests and the Bun lockfile.
- `.github/workflows/publish.yml` checks, builds, and deploys static files to Pages.
  The optional repository variable `VITE_OPENCODE_URL` sets the default backend.
- Historical notes in `docs/` and `CHANGELOG.md` describe previous architectures;
  use this file and the current README for development instructions.
