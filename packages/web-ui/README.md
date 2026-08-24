# `@isomoes/dsh-web-ui`

Product-neutral shared Web UI for [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) browser products.

This package publishes the reviewed DSH Web source fork used by iKanban and IPaper. It owns the common Vite shell, locale support, UI primitives, slot contracts, and isolated browser client plugins. Product packages provide their own branding, personas, tools, and Cordis composition patches.

## Installation

```bash
pnpm add @isomoes/dsh-web-ui
```

Pin an exact version in each product package so UI upgrades can be tested independently:

```json
{
  "dependencies": {
    "@isomoes/dsh-web-ui": "0.4.17"
  }
}
```

## Published surface

The package exposes isolated DSH client packages under `client/*`, including:

```text
@isomoes/dsh-web-ui
├── client/locale
├── client/ui-layout
├── client/ui-sidebar
├── client/ui-conversation
├── client/ui-settings
├── client/ui-slots
├── client/ui-primitives
├── client/ui-tool
└── web/index.html and assets
```

A product composition references the shared runtime identities directly:

```yaml
- id: ui-conversation
  name: '@isomoes/dsh-web-ui/client/ui-conversation'
```

The browser shell is published below `web/`. It is a DSH bundle asset, not a standalone Vite application: the DSH Web host must inject `window.__DSH_BOOT__` and serve the generated files.

## Branding

The common roster intentionally does not include product branding. Product packages register occupants into the branding slots supplied by the shared sidebar and conversation clients:

```text
@isomoes/dsh-ikanban/client/ui-brand-ikanban
@isomoes/dsh-ipaper/client/ui-brand-ipaper
```

## Upstream maintenance

Only this package tracks the DSH Web upstream. The pinned source commit and imported paths are recorded in [`UPSTREAM.md`](./UPSTREAM.md). Updates are explicit reviewed merges; builds never refresh the fork automatically.

## Development

From the repository root:

```bash
pnpm install
pnpm --filter @isomoes/dsh-web-ui typecheck
pnpm --filter @isomoes/dsh-web-ui test
pnpm --filter @isomoes/dsh-web-ui pack
```

The Vite shell cannot be served directly. Use a consuming DSH product bundle such as `@isomoes/dsh-ikanban` for runtime verification.
