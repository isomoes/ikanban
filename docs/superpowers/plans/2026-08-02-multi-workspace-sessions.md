# Multi-Workspace Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore `0.3.14`-style navigation across multiple filesystem paths while allowing multiple Pi sessions in each workspace to keep running concurrently.

**Architecture:** Add a process-wide session hub that owns one `AgentController` and Pi runtime per loaded workspace/session pair. Each WebSocket gets a lightweight connection context selecting which controller it views, while the hub keeps background controllers alive and broadcasts workspace/session status metadata. The browser presents opened workspaces and sessions in a grouped sidebar and uses a local-only server directory API to choose paths.

**Tech Stack:** TypeScript, Zod, Fastify WebSocket, Node filesystem APIs, React 19, Vitest, Testing Library.

## Global Constraints

- Preserve existing uncommitted model, thinking-level, session-list, slash-command, and keyboard interaction changes.
- Keep the server loopback-only and apply the existing local-origin guard to directory browsing.
- Resolve and store canonical absolute workspace paths; reject files, missing paths, and relative paths.
- Give every concurrently loaded session a distinct Pi runtime; switching the visible session must not abort another session.
- Keep desktop and mobile navigation usable without adding a UI dependency.

---

### Task 1: Addressable Runtime Protocol

**Files:**
- Modify: `packages/protocol/src/index.ts`
- Test: `packages/protocol/src/index.test.ts`

**Interfaces:**
- Produces: `WorkspaceOption`, session status metadata, `workspace.open`, and workspace-qualified `session.switch` commands.
- Produces: runtime snapshots carrying all opened workspace summaries.

- [ ] **Step 1: Write failing protocol tests** for absolute workspace-open commands, workspace-qualified session selection, and workspace summaries containing concurrently running session statuses.
- [ ] **Step 2: Run `corepack pnpm --filter @pi-web/protocol test`** and confirm the new schema expectations fail because those fields and commands do not exist.
- [ ] **Step 3: Extend the Zod schemas minimally** with `WorkspaceOptionSchema`, session `status`, `workspace.open`, and a `workspace` field on session selection.
- [ ] **Step 4: Run the protocol tests** and confirm they pass.

### Task 2: Concurrent Session Hub

**Files:**
- Create: `apps/server/src/agent/hub.ts`
- Create: `apps/server/src/agent/hub.test.ts`
- Modify: `apps/server/src/agent/controller.ts`
- Modify: `apps/server/src/agent/types.ts`
- Modify: `apps/server/src/agent/pi-runtime.ts`
- Modify: `apps/server/src/agent/fake-runtime.ts`

**Interfaces:**
- Consumes: workspace-qualified protocol commands and workspace summary types from Task 1.
- Produces: `AgentHub.create`, `AgentHub.connect`, and idempotent `AgentHub.dispose`.
- Produces: `PiRuntimeFactory(workspace, sessionId?)`, where a string resumes that session and `null` creates a fresh session.

- [ ] **Step 1: Write failing hub tests** proving two sessions in one workspace and sessions in two workspaces receive prompts through different runtime instances, selection does not dispose or abort background runs, duplicate opens reuse controllers, and hub disposal releases every controller once.
- [ ] **Step 2: Run the focused hub tests** and confirm failure because `AgentHub` is absent.
- [ ] **Step 3: Implement the hub** with canonical path keys, one controller promise per workspace/session, per-connection selection, metadata snapshots, and race-safe cleanup.
- [ ] **Step 4: Extend runtime creation** so a session ID resumes its exact JSONL path and `null` starts a new session rather than replacing another runtime.
- [ ] **Step 5: Run hub and controller tests** and confirm all pass.

### Task 3: Local Directory Browser And Gateway Integration

**Files:**
- Create: `apps/server/src/directories.ts`
- Create: `apps/server/src/directories.test.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/app.test.ts`
- Modify: `apps/server/src/server.ts`
- Modify: `apps/server/src/server.test.ts`

**Interfaces:**
- Consumes: `AgentHub.connect()` from Task 2.
- Produces: `GET /api/directories?path=<absolute-path>` returning `{ path, parent, directories }`.
- Produces: one independent hub connection per WebSocket.

- [ ] **Step 1: Write failing filesystem tests** for sorted directory-only results, canonical paths, inaccessible entries, relative paths, and file paths.
- [ ] **Step 2: Write failing gateway tests** proving directory requests use local guards and separate sockets can select separate sessions without changing each other.
- [ ] **Step 3: Run focused server tests** and confirm expected route/interface failures.
- [ ] **Step 4: Implement the directory reader and route**, preserving API/static path isolation.
- [ ] **Step 5: Update server lifecycle wiring** to construct and dispose the hub while each socket owns and disposes only its connection context.
- [ ] **Step 6: Run server tests** and confirm all pass.

### Task 4: Multi-Session Client State

**Files:**
- Modify: `apps/web/src/agent/reducer.ts`
- Modify: `apps/web/src/agent/reducer.test.ts`
- Modify: `apps/web/src/agent/use-agent-connection.ts`
- Modify: `apps/web/src/agent/use-agent-connection.test.tsx`

**Interfaces:**
- Consumes: workspace summaries and connection-specific snapshots from Tasks 1-3.
- Produces: `openWorkspace(path)`, `selectSession(workspace, sessionId)`, `newSession(workspace)`, and `browseDirectories(path)` on `AgentConnection`.

- [ ] **Step 1: Write failing reducer and hook tests** for workspace metadata updates, workspace-qualified selection commands, reconnect restoration, and directory API errors.
- [ ] **Step 2: Run focused web tests** and confirm failure for missing state and methods.
- [ ] **Step 3: Extend connection state and commands minimally**, persist only opened workspace paths and the last selected target in local storage, and replay workspace opens after reconnect.
- [ ] **Step 4: Run reducer and hook tests** and confirm all pass.

### Task 5: Grouped Sidebar And Directory Picker

**Files:**
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/app.test.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/styles.test.ts`

**Interfaces:**
- Consumes: the expanded `AgentConnection` from Task 4.
- Produces: accessible grouped workspace/session navigation, background running indicators, new-session actions, and directory picker dialog.

- [ ] **Step 1: Write failing UI tests** for grouped paths, selecting sessions, creating simultaneous sessions, traversing the directory picker, opening a chosen path, and mobile sidebar toggling.
- [ ] **Step 2: Run focused app/style tests** and confirm the controls are absent.
- [ ] **Step 3: Implement the grouped sidebar and picker** using semantic buttons/dialog/list markup and preserve all existing composer controls.
- [ ] **Step 4: Add responsive styles** with a fixed desktop rail and modal mobile drawer while retaining the established visual language.
- [ ] **Step 5: Run app/style tests** and confirm all pass.

### Task 6: End-To-End Verification

**Files:**
- Modify if needed: `tests/e2e/local-agent.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: completed server and browser behavior.
- Produces: documented multi-workspace operation and regression coverage.

- [ ] **Step 1: Add an end-to-end assertion** that two workspace groups can be opened and remain independently selectable with the fake runtime.
- [ ] **Step 2: Update README usage and security notes** for host directory browsing and concurrent session runtimes.
- [ ] **Step 3: Run `corepack pnpm test`, `corepack pnpm typecheck`, and `corepack pnpm build`** and resolve all regressions without discarding unrelated worktree changes.
- [ ] **Step 4: Run the applicable Playwright test** and confirm desktop and mobile navigation load without console errors.
