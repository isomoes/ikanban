# Full Client Surface Fork Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace iKanban's three compiled-JavaScript UI patches with a complete, locally owned TypeScript/TSX/CSS fork of the DSH browser surface while continuing to consume the published DSH host and agent runtime.

**Architecture:** Add one private `@isomoes/dsh-ikanban-web-ui` workspace containing the forked Vite shell, shared browser libraries, and every Web UI plugin. Build each plugin as an isolated module-loader bundle under a virtual package subpath such as `@isomoes/dsh-ikanban/client/ui-layout`; nested `package.json` files let DSH's existing client-module registry discover each subpath independently while one npm package ships every artifact. The public package replaces stock UI composition names with those subpaths, uses a minimal local directory-picker chooser adapter so adaptive native/browse selection points at local surfaces, and wraps the upstream Web runtime only to serve the local Vite dist; all backend implementations remain published DSH packages.

**Tech Stack:** pnpm 11.7, TypeScript 6, React 18, Vite 6, tsdown 0.22, Lightning CSS, Cordis 4, Node test runner.

## Global Constraints

- Fork source from `/home/isomoes/code/js/deepseek-harness` commit `47f943859b`; record this provenance and never refresh it automatically during a build.
- Keep all editable browser implementation as tracked `.ts`, `.tsx`, and `.css`; generated `lib/` and `dist/` remain ignored.
- Publish and install only `@isomoes/dsh-ikanban`; virtual client packages are exported subpaths with nested manifests, not separately published npm packages.
- Do not fork DSH host, API, session, workspace, storage, tools, agent, or CLI packages.
- Preserve upstream package specifiers inside forked source where they identify shared runtime services or declaration-merging contracts; use build aliases to point shell-owned libraries at local source.

---

### Task 1: Establish Fork Provenance And Build Boundary

**Files:**
- Create: `packages/web-ui/package.json`
- Create: `packages/web-ui/UPSTREAM.md`
- Create: `packages/web-ui/src/entries.json`
- Create: `packages/web-ui/tests/source-ownership.test.mjs`
- Modify: `packages/ikanban/package.json`

**Interfaces:**
- Produces: private workspace package `@isomoes/dsh-ikanban-web-ui` with build outputs `lib/clients/<id>/client.js`, matching nested manifests, and `dist/index.html`.
- Produces: `entries.json`, the single mapping from stock package names to iKanban virtual package names and source entries.

- [ ] **Step 1: Write the failing ownership test**

Create a Node test that asserts `UPSTREAM.md` names commit `47f943859b` and `entries.json` starts with the three currently forked shell packages.

```js
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('pins the source fork and declares its client entries', async () => {
  const provenance = await readFile(new URL('../UPSTREAM.md', import.meta.url), 'utf8')
  assert.match(provenance, /47f943859b/)
  const entries = JSON.parse(await readFile(new URL('../src/entries.json', import.meta.url), 'utf8'))
  assert.equal(entries['@deepseek-ai/dsh-client-ui-layout'], 'packages/client/ui-layout/src/client/index.ts')
  assert.equal(entries['@deepseek-ai/dsh-client-ui-sidebar'], 'packages/client/ui-sidebar/src/client/index.ts')
  assert.equal(entries['@deepseek-ai/dsh-client-ui-workspace'], 'packages/client/ui-workspace/src/client/index.ts')
})
```

- [ ] **Step 2: Run the test and verify the missing workspace fails**

Run: `node --test packages/web-ui/tests/source-ownership.test.mjs`

Expected: FAIL because `packages/web-ui/UPSTREAM.md` does not exist.

- [ ] **Step 3: Create the private package and provenance record**

Set `private: true`, `type: module`, and scripts `build`, `typecheck`, and `test`. Add a private workspace dev dependency from `packages/ikanban` so recursive builds order `web-ui` before the public package without publishing the private package.

`UPSTREAM.md` must identify the source repository, commit, imported directories, and state that upstream refreshes are explicit reviewed merges rather than build steps.

- [ ] **Step 4: Add the client entry manifest**

```json
{
  "@deepseek-ai/dsh-client-ui-layout": "packages/client/ui-layout/src/client/index.ts",
  "@deepseek-ai/dsh-client-ui-sidebar": "packages/client/ui-sidebar/src/client/index.ts",
  "@deepseek-ai/dsh-client-ui-workspace": "packages/client/ui-workspace/src/client/index.ts"
}
```

Expand this to every stock browser UI package in Task 4. Generated subpath names replace `@deepseek-ai/dsh-client-` with `@isomoes/dsh-ikanban/client/`.

- [ ] **Step 5: Run the ownership test**

Run: `node --test packages/web-ui/tests/source-ownership.test.mjs`

Expected: PASS.

---

### Task 2: Import The Complete Browser Source

**Files:**
- Create: `packages/web-ui/src/upstream/apps/web/{index.html,public/**,src/**}`
- Create: `packages/web-ui/src/upstream/packages/client/{web,web-react,ui-slots,ui-primitives,ui-attachment,schema-form,locale,ui-*}/src/**`
- Create: `packages/web-ui/src/upstream/packages/extensions/ui-cordis/src/**`
- Create: `packages/web-ui/src/upstream/packages/client/tsdown.client.ts`
- Create: `packages/web-ui/src/upstream/packages/client/web/src/platform.ts`
- Modify: `packages/web-ui/UPSTREAM.md`

**Interfaces:**
- Consumes: DeepSeek Harness source at commit `47f943859b`.
- Produces: a path-preserving source mirror so upstream relative imports and CSS asset paths remain valid.

- [ ] **Step 1: Copy only source-owned browser inputs**

Copy `apps/web/index.html`, `apps/web/public`, `apps/web/src`, all 31 `packages/client/ui-*` source directories, `packages/client/locale/src`, `packages/client/web/src`, `packages/client/web-react/src`, `packages/client/schema-form/src`, and `packages/extensions/ui-cordis/src`. Exclude `node_modules`, `lib`, `dist`, test snapshots, and generated build output.

Extend `source-ownership.test.mjs` to assert `src/upstream/apps/web/src/main.ts`, representative `.tsx` and `.module.css` files, both directory-picker surfaces, and extension `ui-cordis` exist.

- [ ] **Step 2: Preserve upstream license and provenance**

Add the DeepSeek Harness MIT copyright/license reference and an exact inventory of imported roots to `UPSTREAM.md`.

- [ ] **Step 3: Verify there is no compiled client source**

Run: `find packages/web-ui/src/upstream -type f \( -path '*/lib/*' -o -path '*/dist/*' \) -print`

Expected: no output.

- [ ] **Step 4: Run the ownership test**

Run: `node --test packages/web-ui/tests/source-ownership.test.mjs`

Expected: PASS.

---

### Task 3: Build The Local Vite Shell And Shared Platform

**Files:**
- Create: `packages/web-ui/vite.config.ts`
- Create: `packages/web-ui/tsconfig.json`
- Create: `packages/web-ui/src/node-module-stub.ts`
- Create: `packages/web-ui/tests/frontend-build.test.mjs`
- Modify: `packages/web-ui/package.json`

**Interfaces:**
- Consumes: the imported `apps/web`, `client/web`, `web-react`, `ui-slots`, `ui-primitives`, `ui-attachment`, and `schema-form` sources.
- Produces: `packages/web-ui/dist/index.html` and hashed assets containing the locally owned boot shell and shared UI libraries.

- [ ] **Step 1: Write the failing frontend artifact test**

Assert that `dist/index.html` exists, references `/assets/`, and no emitted JavaScript contains a filesystem path into `../deepseek-harness`.

- [ ] **Step 2: Run the artifact test and verify it fails**

Run: `node --test packages/web-ui/tests/frontend-build.test.mjs`

Expected: FAIL because `dist/index.html` is absent.

- [ ] **Step 3: Adapt the upstream Vite configuration**

Retain the upstream standalone-serve rejection, vendor chunking, Node module stub, and process defines. Change every source alias to the mirrored local path, including:

```ts
{ find: /^@deepseek-ai\/dsh-client-web$/, replacement: src('./src/upstream/packages/client/web/src/boot.tsx') },
{ find: /^@deepseek-ai\/dsh-client-web-react$/, replacement: src('./src/upstream/packages/client/web-react/src/index.ts') },
{ find: /^@deepseek-ai\/dsh-client-ui-slots$/, replacement: src('./src/upstream/packages/client/ui-slots/src/index.ts') },
{ find: /^@deepseek-ai\/dsh-client-ui-primitives$/, replacement: src('./src/upstream/packages/client/ui-primitives/src/index.ts') },
{ find: /^@deepseek-ai\/dsh-client-ui-attachment$/, replacement: src('./src/upstream/packages/client/ui-attachment/src/index.ts') },
{ find: /^@deepseek-ai\/dsh-client-schema-form$/, replacement: src('./src/upstream/packages/client/schema-form/src/index.ts') },
```

- [ ] **Step 4: Add exact third-party build dependencies**

Merge the dependency requirements of upstream `apps/web`, `client/web`, `web-react`, `ui-primitives`, `ui-attachment`, and `schema-form` into the private package. Keep DSH/Cordis packages aligned with `packages/ikanban/package.json` at `0.1.0-rc.6` rather than copying sibling `workspace:^` ranges.

- [ ] **Step 5: Build and test the frontend**

Run: `pnpm --filter @isomoes/dsh-ikanban-web-ui build:frontend && node --test packages/web-ui/tests/frontend-build.test.mjs`

Expected: Vite exits 0 and the artifact test passes.

---

### Task 4: Build Isolated Virtual Packages For Every Forked UI Plugin

**Files:**
- Create: `packages/web-ui/tsdown.config.ts`
- Create: `packages/web-ui/src/css-modules.d.ts`
- Modify: `packages/web-ui/src/entries.json`
- Modify: `packages/web-ui/src/upstream/packages/client/tsdown.client.ts`
- Create: `packages/web-ui/tests/client-bundle.test.mjs`
- Modify: `packages/web-ui/package.json`

**Interfaces:**
- Consumes: each composition-owned UI module's original `apply` and `inject` exports.
- Produces: one isolated bundle and nested package manifest per virtual subpath, preserving upstream Cordis fibers, optional activation, injection metadata, CSS ownership, and HMR identity.

- [ ] **Step 1: Write the failing virtual-package artifact test**

For every `entries.json` row, assert `lib/clients/<id>/client.js`, `client.js.map`, `index.js`, and `package.json` exist; assert the bundle registers its exact virtual package ID and the nested manifest's `dsh.client.inject` equals the source package's declaration.

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test packages/web-ui/tests/client-bundle.test.mjs`

Expected: FAIL because the virtual client artifacts are absent.

- [ ] **Step 3: Complete the virtual client roster**

List locale, theme, layout, sidebar, settings, settings-general, settings-models, settings-plugin-inventory, conversation, tool, ui-cordis, workflow-run, deliverables, workspace, input-trigger, commands, skill, subagent, jobs, goal, message-feedback, model-selection, permission-presets, agent-preset, settings-plugins, plan, user-questions, trajectory, directory-picker-native, and directory-picker-browse. Each row records its stock ID and mirrored source entry:

```json
{
  "@deepseek-ai/dsh-client-ui-layout": "packages/client/ui-layout/src/client/index.ts",
  "@deepseek-ai/dsh-client-ui-directory-picker-native": "packages/client/ui-directory-picker-native/src/client/index.ts",
  "@deepseek-ai/dsh-client-ui-directory-picker-browse": "packages/client/ui-directory-picker-browse/src/client/index.ts",
  "@deepseek-ai/dsh-client-ui-cordis": "packages/extensions/ui-cordis/src/client/index.ts"
}
```

The final roster must include every visible UI row in the Web composition plus both surfaces dynamically selected by `directory-picker-auto`.

- [ ] **Step 4: Adapt the upstream client bundle preset**

Keep platform modules external, inline wire-only dependencies and ordinary npm libraries, preserve the cross-plugin value-import purity check, and preserve Lightning CSS Modules. Generate one tsdown config per entry, changing its loader ID and `data-plugin` owner to the virtual package name and writing to `lib/clients/<id>/client.js`.

For each output, generate `index.js` as `export function apply() {}` and a nested `package.json` containing the virtual `name`, `exports` for `.`, `./client`, and `./package.json`, plus the original package's `dsh.client` declaration. These nested manifests are executable loader metadata and must be package files, not test fixtures.

- [ ] **Step 5: Typecheck before bundling**

Run: `pnpm --filter @isomoes/dsh-ikanban-web-ui typecheck`

Expected: exit 0. Any rc.5-source/rc.6-contract mismatch must be resolved in the forked source, never hidden with `skipLibCheck` changes, `any`, or disabled strictness.

- [ ] **Step 6: Build and test the client artifact**

Run: `pnpm --filter @isomoes/dsh-ikanban-web-ui build:client && node --test packages/web-ui/tests/client-bundle.test.mjs`

Expected: tsdown exits 0 and the artifact test passes.

---

### Task 5: Publish The Local Surface Through The Existing Bundle

**Files:**
- Modify: `packages/ikanban/src/index.ts`
- Create: `packages/ikanban/src/directory-picker-auto.ts`
- Modify: `packages/ikanban/scripts/build-client.mjs`
- Modify: `packages/ikanban/scripts/sync-upstream.mjs`
- Modify: `packages/ikanban/package.json`
- Modify: `packages/ikanban/tests/upstream-parity.test.mjs`
- Modify: `packages/ikanban/tests/client-bundle.test.mjs`
- Create: `packages/ikanban/tests/frontend-dist.test.mjs`
- Delete: `packages/ikanban/src/{layout,sidebar,workspace}.ts`
- Delete: `packages/ui-layout/**`
- Delete: `packages/ui-sidebar/**`
- Delete: `packages/ui-workspace/**`

**Interfaces:**
- Consumes: `packages/web-ui/lib/clients/**` and `packages/web-ui/dist/**`.
- Produces: published `packages/ikanban/lib/clients/**` and `lib/web/**`, exported through `./client/*` and `./client/*/package.json` patterns.
- Produces: local `apply(ctx, config)` that delegates Web behavior upstream but resolves frontend static files from `lib/web/index.html`.

- [ ] **Step 1: Replace parity assertions with the new ownership contract**

Keep startup and invariant delegation assertions. Change runtime assertions to require local `apply`, verify the upstream `Config` remains exported, verify every stock composition UI row maps to its iKanban virtual subpath, and verify no stock composition UI package remains enabled.

- [ ] **Step 2: Run focused tests and verify the old build fails them**

Run: `pnpm --filter @isomoes/dsh-ikanban build && node --test packages/ikanban/tests/{upstream-parity,client-bundle,frontend-dist}.test.mjs`

Expected: FAIL because the patch still carries stock UI rows and no local frontend dist exists.

- [ ] **Step 3: Copy private build outputs into the public package**

Replace wrapper-string extraction in `build-client.mjs` with binary-safe recursive copies of `web-ui/lib/clients/**` and `dist/**`. Ensure `clean.mjs` removes stale copied assets and package `files` includes the copied nested manifests, bundles, maps, and Web dist.

- [ ] **Step 4: Serve the local frontend dist**

Keep upstream exports, but shadow `apply` and set the upstream runtime resolver immediately before delegation:

```ts
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { apply as applyUpstream, internals, type Config } from '@deepseek-ai/dsh-web-app'

export * from '@deepseek-ai/dsh-web-app'

export function apply(ctx: Context, config: Config): void {
  internals.resolveDistIndex = () => fileURLToPath(new URL('./web/index.html', import.meta.url))
  applyUpstream(ctx, config)
}
```

- [ ] **Step 5: Replace the complete stock UI roster**

Change `sync-upstream.mjs` so every composition UI package name is replaced from `entries.json` with its `@isomoes/dsh-ikanban/client/<id>` virtual package name. Retain published transport/runtime rows (`modules`, `connection`, `api-remotes`, `client-runtime`, `cordis-client-runner`) and all backend rows unchanged.

- [ ] **Step 6: Preserve adaptive directory picking with a composition adapter**

Copy the upstream `directory-picker-auto` chooser logic into `src/directory-picker-auto.ts`, retaining its environment probes and published backend package names but changing only `SURFACE_PACKAGES` to the two iKanban virtual subpaths. Replace the composition's chooser row with `@isomoes/dsh-ikanban/directory-picker-auto`. This adapter selects packages; it does not fork either backend implementation.

- [ ] **Step 7: Remove the obsolete three-package compiled-JS pipeline**

Delete the old UI workspaces, exports, host placeholders, tests, and watcher assumptions only after the virtual-package tests pass. Do not retain compatibility exports for unpublished private packages.

- [ ] **Step 8: Run focused public-package verification**

Run: `pnpm --filter @isomoes/dsh-ikanban test`

Expected: all Node tests pass and the package rebuilds from tracked TS/TSX/CSS source.

---

### Task 6: Restore Source-Level Development And Documentation

**Files:**
- Modify: `scripts/dev.mjs`
- Modify: `packages/ikanban/scripts/watch-client.mjs`
- Modify: `packages/ikanban/tests/watch-client.test.mjs`
- Modify: `README.md`
- Modify: `packages/ikanban/README.md`
- Modify: `AGENTS.md`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `pnpm dev` watchers for TS/TSX/CSS client bundles and the local Vite dist, with rebuild notifications sent under each changed virtual package ID through the existing DSH HMR endpoint.

- [ ] **Step 1: Write failing watcher tests**

Cover changes to `.ts`, `.tsx`, `.module.css`, and the frontend shell; assert ignored `lib/` and `dist/` writes do not trigger loops and concurrent changes coalesce into one queued rebuild.

- [ ] **Step 2: Run watcher tests and verify they fail**

Run: `node --test packages/ikanban/tests/watch-client.test.mjs`

Expected: FAIL because the current watcher knows only three `src/client.js` files.

- [ ] **Step 3: Watch source trees through tool-native watch modes**

Run tsdown watch for all virtual client entries and Vite build watch for the frontend dist. After a successful client build, copy the changed output into `packages/ikanban/lib` and notify its virtual package ID. Frontend-shell changes copy the dist and require browser reload.

- [ ] **Step 4: Update durable guidance**

Document that `packages/web-ui/src/upstream` is the editable full browser fork, distinguish dynamic UI plugin code from Vite shell/shared platform code, record the explicit upstream refresh policy, and remove every instruction referring to vendored compiled JavaScript or the three deleted packages.

- [ ] **Step 5: Run complete verification**

Run: `pnpm typecheck && pnpm test && pnpm --filter @isomoes/dsh-ikanban pack`

Expected: all commands exit 0; the tarball contains `lib/client.js`, `lib/client.js.map`, `lib/web/index.html`, all referenced frontend assets, `cordis.patch.yml`, and no private `packages/web-ui/src` source.

- [ ] **Step 6: Smoke the composed profile**

Run: `pnpm dev:install && pnpm dev:config`

Expected: startup/runtime resolve to `@isomoes/dsh-ikanban`, every UI row resolves to an iKanban virtual subpath, the adaptive chooser resolves to the iKanban adapter, and transport/runtime/backend rows remain published DSH packages.

Run: `pnpm dev -- --port 8080`

Expected: `http://127.0.0.1:8080` serves the local dist and reaches an active browser UI without missing-service or missing-module errors.
