# Fork Web Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three upstream web-shell plugins with locally owned iKanban forks while preserving current behavior and branding.

**Architecture:** Keep one private source workspace for each fork (`ui-layout`, `ui-sidebar`, and `ui-workspace`) and combine their browser modules into the published `@isomoes/dsh-ikanban/client` artifact. Compose host-only main-package subpaths so the DSH profile needs one dependency.

**Tech Stack:** pnpm workspaces, Node.js ESM, DSH/Cordis client modules, Node test runner

## Global Constraints

- Keep the published `@isomoes/dsh-ikanban` bundle self-contained with no profile dependency on private UI workspaces.
- Preserve all upstream behavior except the existing top-left `Ikanban` wordmark customization.
- Keep upstream package version `^0.1.0-rc.6` as the fork baseline.
- Do not fork theme, primitives, settings, or conversation packages.

---

### Task 1: Local Client Plugin Forks

**Files:**
- Create: `packages/ui-layout/**`
- Create: `packages/ui-sidebar/**`
- Create: `packages/ui-workspace/**`

**Interfaces:**
- Consumes: published `@deepseek-ai/dsh-client-ui-{layout,sidebar,workspace}/client` bundles
- Produces: private tracked browser sources consumed by the main package build

- [ ] Add private package manifests that cannot be published or installed as DSH plugins.
- [ ] Vendor each published `lib/client.js` into tracked `src/client.js`, changing only its module/package identity; retain the Ikanban wordmark in the sidebar fork.
- [ ] Add a build script that copies the tracked client fork to `lib/client.js` and emits host/type entries.
- [ ] Add tests that verify custom module identity, absence of the upstream module identity, and the sidebar wordmark.

### Task 2: Bundle Composition

**Files:**
- Modify: `packages/ikanban/package.json`
- Modify: `packages/ikanban/scripts/sync-upstream.mjs`
- Modify: `packages/ikanban/tests/upstream-parity.test.mjs`
- Modify: `package.json`
- Delete: `packages/ikanban/src/sidebar.ts`
- Delete: `packages/ikanban/scripts/sync-sidebar.mjs`
- Delete: `packages/ikanban/tests/branding.test.mjs`

**Interfaces:**
- Consumes: the three private browser sources from Task 1
- Produces: one main-package client artifact and three host subpaths

- [ ] Replace all three upstream row names with main-package subpaths in `sync-upstream.mjs` and parity expectations.
- [ ] Add main-package client metadata and aggregate all private browser modules into `lib/client.js`.
- [ ] Keep `dev:install` limited to the main bundle dependency.
- [ ] Remove the temporary compiled-sidebar transformation.

### Task 3: End-to-End Verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: built packages and installed `ikanban` profile
- Produces: documented fork boundaries and browser verification evidence

- [ ] Run `pnpm install`, `pnpm build`, `pnpm typecheck`, and `pnpm test`.
- [ ] Run `pnpm dev:install` and confirm `pnpm dev:config` resolves all three local rows.
- [ ] Launch the profile on an unused port and verify the rendered brand button says `Ikanban`.
- [ ] Document the three fork packages and their responsibilities.
