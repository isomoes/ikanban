# Upstream Provenance

The browser source fork is based on [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) commit `47f943859bef60e4160492346772ded9b24f765a`.

No upstream source directories are imported in this initial build-boundary task. The approved import roots for the browser fork are:

- `apps/web`
- `packages/client`
- `packages/extensions/ui-cordis`

The first declared client entries come from `packages/client/ui-layout`, `packages/client/ui-sidebar`, and `packages/client/ui-workspace`.

Upstream refreshes are explicit, reviewed merges. They are never performed as part of a build.
