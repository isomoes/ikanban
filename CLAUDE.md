# iKanban - AI Agent Reference (verified)

## Core purpose
iKanban provides a web runtime for interacting with an OpenCode server and Kanban-oriented UI workflows.

## Runtime architecture (IMPORTANT)
- This repo only contains `web` and `ui` workspaces.
- Backend/runtime server logic lives in `packages/web/server/*`.
- Shared React UI logic and components live in `packages/ui/*`.
- There is no desktop or VS Code runtime in this repository.

## Tech stack (source of truth: `package.json`, resolved: `bun.lock`)
- Runtime/tooling: Bun (`packageManager`), Node >=20 (`engines` in workspace packages)
- UI: React, TypeScript, Vite, Tailwind v4
- State: Zustand (`packages/ui/src/stores/`)
- UI primitives: Radix UI, Remixicon
- Server: Express (`packages/web/server/index.js`)

## Monorepo layout
Workspaces are `packages/*` (see root `package.json`).
- Shared UI package: `packages/ui`
- Web app + server + CLI package: `packages/web`

## Documentation map
Before changing mapped modules, read module documentation first.

### web
Web runtime and server implementation for iKanban.

#### lib
Server-side integration modules used by API routes and runtime services.

##### quota
Quota provider registry, dispatch, and provider integrations for usage endpoints.
- Module docs: `packages/web/server/lib/quota/DOCUMENTATION.md`

## Build / dev commands (verified)
All scripts are in root `package.json`.
- Dev (full): `bun run dev`
- Dev web only: `bun run dev:web`
- Dev web server only: `bun run dev:web:server`
- Dev web full (api + build): `bun run dev:web:full`
- Build all: `bun run build`
- Build web: `bun run build:web`
- Build ui: `bun run build:ui`
- Type check: `bun run type-check`
- Lint: `bun run lint`

## Runtime entry points
- Web bootstrap: `packages/web/src/main.tsx`
- Web server: `packages/web/server/index.js`
- Web CLI: `packages/web/bin/cli.js`
- UI bootstrap: `packages/ui/src/main.tsx`

## OpenCode integration
- UI client wrapper: `packages/ui/src/lib/opencode/client.ts`
- SSE hookup: `packages/ui/src/hooks/useEventStream.ts`
- Web server OpenCode integration: `packages/web/server/index.js`

## Key UI patterns (reference files)
- Settings shell: `packages/ui/src/components/views/SettingsView.tsx`
- Settings window: `packages/ui/src/components/views/SettingsWindow.tsx`
- Settings shared primitives: `packages/ui/src/components/sections/shared/`
- Settings sections: `packages/ui/src/components/sections/`
- Chat UI: `packages/ui/src/components/chat/`
- Theme + typography: `packages/ui/src/lib/theme/`, `packages/ui/src/lib/typography.ts`
- Terminal UI: `packages/ui/src/components/terminal/`

## External / system integrations (active)
- Git integrations: `packages/ui/src/lib/gitApi.ts`, `packages/web/server/index.js` (`simple-git`)
- Terminal PTY: `packages/web/server/index.js` (`bun-pty` / `node-pty`)

## Agent constraints
- Do not run git/GitHub commands unless explicitly asked.
- Keep baseline green before finalizing: `bun run type-check`, `bun run lint`, `bun run build`.

## Development rules
- Keep diffs tight; avoid drive-by refactors.
- Follow local precedent; search nearby code first.
- TypeScript: avoid `any` and blind casts; keep ESLint/TS clean.
- React: function components + hooks by default.
- Control flow: avoid nested ternaries; prefer early returns with clear `if/else` or `switch`.
- Styling: Tailwind v4; typography via `packages/ui/src/lib/typography.ts`; theme vars via `packages/ui/src/lib/theme/`.
- Toasts: use project toast wrapper from `@/components/ui`; avoid direct `sonner` usage in feature code.
- No new dependencies unless explicitly needed.
- Never add secrets (`.env`, keys) or log sensitive data.
