# Data layer

How the web app reads and mutates server state. The goal is one mechanism per kind of data, so
a value has exactly one owner and nothing is copied from one store into another.

## Mechanisms

| Kind of data | Mechanism | Lives in |
| --- | --- | --- |
| OpenCode resources that `@opencode/client/solid` `Data` covers (sessions, messages, permissions, forms, projects, shells, and per-location info/vcs/agents/commands/config/integrations/MCP/models/providers/references/skills/web search) | **`Data`** (`createData`, wrapped by `createAppData`). Read with `data.<resource>.list/get`, load with `.sync`, force a reload with `.invalidate()` + `.sync`. `Data` applies the SSE events itself. | `runtime/server/runtime.tsx`, `runtime/server/data.ts` |
| OpenCode request/response reads that `Data` does not cover (VCS diffs, file search, worktree directory scans, plugins, session export, home session index, delete inspection, ...) | **`@tanstack/solid-query`** with `[scope, ...]` keys over `@opencode/client/promise` | the feature that needs it |
| Mutations with pending/error UI state | `useMutation` over the promise client | the feature that needs it |
| Client-owned state (workspace name/icon overrides, tabs, layout, settings, composer drafts) | Solid stores via `persisted(...)` | `runtime/persistence`, feature models |
| App-shaped views of the above (project list with worktree inventory, current path) | `createMemo` derived from `Data` + the owning store; never a second copy | `runtime/server/sync.tsx` |

`@opencode/client/promise` is the transport under all of them. Calling it directly from a
component is only right for a one-shot action (a mutation, an export); a value that is rendered
should come from `Data` or a query.

## Rules for new code

1. Check `Data` first. If it exposes the resource, use it. Do not add a query, `createResource`
   or store for something `Data` already keeps live.
2. Do not copy `Data` (or query) results into a store, signal or another query cache. Derive with
   `createMemo` or a plain function. If a derived view needs extra client data (the worktree
   inventory), that data has its own owner and the view reads both.
3. Do not add effects that mirror state (`createEffect(() => setX(y()))`). Effects are for
   outside-world sync: subscriptions, timers, storage, invalidating a cache on disconnect.
4. After a mutation, refresh through the owner: `data.<resource>.invalidate()` + `.sync()` for
   `Data` resources, `invalidateQueries` for queries. Optimistic overlays live next to the owner
   (`createAppData` removes sessions optimistically); do not patch caches by hand
   (`setQueryData`) unless there is no refetch that is cheap enough.
5. Query keys start with the server scope (`[scope, ...]`) so the disconnect invalidation in
   `runtime/server/sync.tsx` reaches them.
6. `createResource` for server reads exists in older code. New code uses a query, or `Data` when
   covered.

## What `sync.tsx` is now

`createServerSyncContext(sdk, data)` no longer bootstraps or stores server state. It provides:

- `sync.data.project` – `projectList(data.project.list(), worktrees.cached)`: normalized,
  filtered and sorted projects with the loaded worktree inventory applied.
- `sync.data.path` – `locationPath(data.location.info())`: the default location.
- `sync.worktrees` – worktree inventory (`workspaces/inventory.ts`): a keyed store, in-flight
  de-duplicated `list`, `refresh`. `Data` has no worktree resource, so this is the single owner.
  `worktree.updated` re-lists the project's inventory and reloads `data.project`.
- `sync.project.update()` – reloads `data.project` after a project mutation (`Data` also applies
  `project.updated` events); `sync.project.meta/icon` write the persisted per-workspace overrides.
- `sync.child(directory)` – small per-directory store (`project` id link plus persisted
  `projectMeta`/`icon` read straight from their persisted stores) with the pin/idle-eviction
  lifecycle (`global-sync/child-store.ts`, `eviction.ts`).
- one effect that marks cached `[scope, ...]` queries stale while the event stream is down.

## Mapping of the previous state

| Previous piece | Decision |
| --- | --- |
| `globalStore.project` filled by the `bootstrap` query + `bootstrapGlobal`, patched by `project.updated` and by the worktree inventory | (a) duplicated `data.project` → derived memo; `bootstrap.ts`, `updateProjectInfo` removed |
| `globalStore.path` from a `[scope, null, "path"]` query | (a) duplicated `data.location.info()` → `locationPath` |
| `globalStore.config`, `provider_auth`, `reload`, `updateConfig` (stub query / always-throwing mutation, no readers) | dead → removed |
| Child store getters `provider`, `agent`, `command`, `reference`, `mcp`, `mcp_resource`, `vcs`, `path`, `*_ready`, `lsp` (+ stub LSP query), `config`, `status` | (a) read-through or dead duplicates of `Data`, no readers outside tests → removed |
| `bootstrapInstance` / `bootstrapDirectory` / refresh queue / `booting` / `isLoadingSessions` | `Data` already refreshes agents, commands, config, MCP etc. on their events and the workspace `LocationProvider` syncs the location it shows → removed |
| `sync.mcp.toggle`, `disableMcp`, `global-sync/mcp.ts` | dead duplicate of `providers/connect/mcp.ts` → removed |
| Persisted `vcs` cache (`VcsState`) | only fed the removed `vcs` getter → removed |
| Child store `projectMeta`/`icon` copied from persisted stores after async init | (a) mirror → getters over the persisted stores |
| Worktree inventory as a query whose result was mirrored into `globalStore.project` and two view query keys by `setQueryData` | (b) not in `Data` → one keyed store; the settings view query refetches on `worktree.updated` instead of being patched |
| Settings workspace metadata query over `api.project.list()` | (a) duplicate of `data.project` → `data.project.sync()` |
| Project language servers query over `api.config.get()` + manual `config.updated` refetch | (a) duplicate of `data.location.config` → `Data` with a first-load resource |
| Home session index query (`["home-sessions", conn]`) | (b) paged history is not in `Data`; merged with `data.session.list()` at read time. Kept |
| VCS diff, session details, file search, delete inspection, plugin lists, question dock / composer queue / connect dialogs / credentials / MCP toggle mutations | (b)/(c) keep solid-query (or `useMutation`) |

## Known leftovers

- `settings/general/controllers.ts` reads global config with `api.config.get()` and optimistically
  edits the shell. `data.location.config` covers the read; the optimistic write path was not
  changed.
- `createResource` is still used for plugin lists, the shell list and a few other one-off reads
  (22 files). They are request/response reads and can move to queries opportunistically.
- `sync.data.project` is a plain array recomputed when `data.project` or an inventory changes
  (the old store gave per-field reactivity). If a list becomes hot, project it with
  `createProjection`/`reconcile` inside the memo.
- `sync.project.update()` refetches the project list instead of applying the PATCH response.
  `Data` has no "remember project" API; add one upstream if the extra request matters.
