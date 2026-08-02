# Session Board And Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the workspace rail with the `v0.3.14` Progress/Idle homepage and add persistent non-destructive session archiving.

**Architecture:** The hub continues owning one runtime per loaded workspace/session. A small JSON metadata store records archived workspace/session keys and filters them from workspace summaries; a new archive command updates that store. The React app starts on a board that merges all visible sessions into Progress and Idle columns, then navigates to the existing conversation view through browser history.

**Tech Stack:** TypeScript, Zod, Node filesystem APIs, React 19, Fastify WebSocket, Vitest, Testing Library, Playwright.

## Global Constraints

- Preserve Pi JSONL session files unchanged.
- Remove the persistent left workspace rail.
- Start at the homepage on every plain `/` navigation.
- Keep multi-workspace and concurrent runtime behavior.
- Match the established `v0.3.14` board information hierarchy and current dark visual language.

---

### Task 1: Archive Protocol And Persistence

**Files:**
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/protocol/src/index.test.ts`
- Create: `apps/server/src/agent/archive.ts`
- Create: `apps/server/src/agent/archive.test.ts`

- [ ] Write failing tests for `session.archive` and persisted workspace/session keys.
- [ ] Verify the focused tests fail for missing behavior.
- [ ] Implement atomic archive metadata reads/writes without touching JSONL files.
- [ ] Verify focused tests pass.

### Task 2: Hub Archive Filtering

**Files:**
- Modify: `apps/server/src/agent/hub.ts`
- Modify: `apps/server/src/agent/hub.test.ts`
- Modify: `apps/server/src/server.ts`

- [ ] Write a failing hub test proving archive commands hide one session while other workspaces and active runtimes remain intact.
- [ ] Implement archive command handling and summary filtering.
- [ ] Wire the persistent archive store into production hub creation.
- [ ] Verify server tests and typechecking.

### Task 3: Faithful Homepage Board

**Files:**
- Modify: `apps/web/src/agent/use-agent-connection.ts`
- Modify: `apps/web/src/agent/use-agent-connection.test.tsx`
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/app.test.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/styles.test.ts`

- [ ] Write failing UI tests for default homepage, Progress/Idle grouping, opening sessions, browser back/Home navigation, archive, and workspace picker access.
- [ ] Add the archive client command helper.
- [ ] Replace the rail with the responsive two-column board and separate conversation view.
- [ ] Verify web tests and typechecking.

### Task 4: End-To-End Verification

**Files:**
- Modify: `tests/e2e/local-agent.spec.ts`
- Modify: `README.md`

- [ ] Update E2E flows to begin on the board and cover archive behavior.
- [ ] Document homepage and non-destructive archive semantics.
- [ ] Run all tests, typechecks, build, Playwright, and desktop/mobile browser checks.
