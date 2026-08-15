# iKanban Agent Notes

## Scope And Architecture

- This is a DSH Web bundle plugin, not a standalone frontend. `@isomoes/dsh-ikanban` delegates the host startup and invariant entries to the installed `@deepseek-ai/dsh-web-app`, wraps its runtime to serve the local dist, and owns the complete browser surface in `packages/web-ui`.
- DSH runs a layered Cordis plugin tree. A patch row replaces the target row's whole `config`, not individual keys; inspect the effective tree with `pnpm dev:install && pnpm dev:config` before changing composition.
- `packages/web-ui` contains an editable source fork flattened into one package. Refresh it only through an explicit reviewed merge; builds never refresh browser source. `packages/web-ui/UPSTREAM.md` records the pinned commit and imported paths.
- Use the upstream DSH repository's [`packages/bundle/web-app`](https://github.com/deepseek-ai/deepseek-harness/tree/main/packages/bundle/web-app) and [`docs`](https://github.com/deepseek-ai/deepseek-harness/tree/main/docs) to understand upstream architecture. The installed versions in `packages/ikanban/package.json` and `pnpm-lock.yaml` are the dependency source of truth; the upstream repository may be on another prerelease.

## Commands

- Required toolchain: Node `^22.19.0 || >=24`, pnpm `11.7.0`, and a published `dsh` CLI. `pnpm install` intentionally permits `koffi`'s native install script.
- Full checks: `pnpm typecheck && pnpm test`. Tests build their package first; the main build refreshes upstream composition and packages the Web UI artifacts.
- Focus one package with `pnpm --filter @isomoes/dsh-ikanban test` or `pnpm --filter @isomoes/dsh-ikanban-web-ui test`.
- Focus one main-package test with `pnpm --filter @isomoes/dsh-ikanban build && node --test packages/ikanban/tests/client-bundle.test.mjs`; tests read generated `lib/`, so do not omit the build.
- Before publishing, additionally run `pnpm --filter @isomoes/dsh-ikanban pack`.

## Development Loop

- `pnpm dev` builds, links this checkout into the isolated `ikanban-dev` DSH profile, starts DSH (default `http://127.0.0.1:3080`), and runs tsdown/Vite source watchers. Pass app flags as in `pnpm dev -- --port 8080`.
- Dynamic plugin code lives below `packages/web-ui/src/client` and `packages/web-ui/src/extensions`. A successful rebuild copies one virtual bundle into `packages/ikanban/lib/clients/<id>` and DSH hot-reloads that package ID.
- The Vite app context lives at `packages/web-ui`; shared platform code lives below its `src/client` tree. Successful builds copy `dist` into `packages/ikanban/lib/web` and require a browser reload.
- Changes to TypeScript host entries, build scripts, dependencies, or composition require stopping `pnpm dev`, rebuilding, and restarting it.
- The profile executes built `lib/` files despite using a `link:` dependency. Use `pnpm dev:remove` to remove the linked plugin when finished.
