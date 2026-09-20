# Restored UI, OpenCode V2 backend

## Baseline

The frontend reuses **v0.3.18**: SolidJS, Kobalte, Tailwind, and the existing
project/session layout, composer, themes, file viewer, and settings. Application
versions continue the current release sequence; restoring UI code does not roll
the manifests back to 0.3.18.

`packages/web` remains the only application. Both workspace manifests are private.
Build output is static and deployed to GitHub Pages at `/ikanban/`. The build also
emits `404.html` so Pages can load the router on direct project/session links.

## Boundaries

```text
Restored SolidJS components and stores
    │ UI view models
src/client/{adapter,convert,events,types}.ts
    │ native, typed V2 operations
src/client.ts → @opencode/client 2.0.11
    │ HTTP + authenticated event subscription + CORS
Independent OpenCode V2 server
    sessions · tools · providers · permissions · execution
```

- `src/client.ts` is the network-client factory. It accepts an explicit URL,
  headers, and optional fetch implementation. Server credentials travel in headers.
- `src/client/adapter.ts` implements the operations consumed by the restored UI.
  Its response envelopes are UI conveniences, not V1 HTTP contracts. There is no
  dependency on `@opencode-ai/sdk` and no V1 network fallback.
- `src/client/convert.ts` projects native sessions, inline message content,
  tool results, provider models, file bytes, and permission requests into stable
  view models. `src/client/types.ts` describes these presentation models.
- `src/client/events.ts` consumes native V2 events. Execution changes are coalesced
  into message snapshots with stable part IDs; only changed messages are emitted.
  The global context reconnects and resynchronizes loaded timelines because V2
  subscriptions have no replay. Quiet streams are not mistaken for failed ones.
- Native session and integration forms share `components/form-fields.tsx`.
  Replies use field keys and option values, including conditional and typed fields.
- `src/client/config.ts` preserves JSONC comments and unrelated settings when
  updating the existing global document identified by the server. Configuration
  writes and reloads use native V2 file/location APIs. No home path is guessed.

The browser initially uses `VITE_OPENCODE_URL`, a saved server, or
`http://127.0.0.1:4096`. API requests never default to the Pages origin.
Pages requires a reachable HTTPS backend with CORS allowing the frontend origin.

## Backend differences

- Archive visibility is stored locally, scoped by backend URL. V2 does not expose
  server-side archive mutations.
- Session sharing and worktree reset actions are unavailable. LSP is not run by V2.
- Worktree creation returns a ready directory; the old asynchronous-ready wait
  is no longer used for new worktrees.
- Message history uses opaque V2 cursors, including control records and the user
  message preceding a long assistant turn. Cursor requests omit `order`.
- Provider authentication uses integration keys and OAuth attempt IDs. Polling is
  cancelled when the dialog closes, and credentials remain backend-owned.

DSH packages, plugin composition, npm packaging, the CLI/proxy, and the former
multi-product release pipeline remain retired.

## Verification

```sh
bun install --frozen-lockfile
bun run typecheck
bun run --cwd packages/web test:unit
bun run build:web
```

Adapter tests exercise the generated client's HTTP serialization, pagination,
permissions/forms, OAuth attempts, file decoding, and JSONC preservation. Validate
provider-specific authentication and actual model execution against the target
server as part of release testing; fixture responses do not exercise a provider.
