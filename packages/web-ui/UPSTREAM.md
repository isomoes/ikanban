# Upstream provenance

The editable browser source in this package is a reviewed fork of DeepSeek Harness.

- Repository: https://github.com/deepseek-ai/deepseek-harness
- Current source baseline: `dsh-v0.1.2-alpha.2`
- Commit: `0a53fb55bea101816fa226bb964ae2bed71c343b`
- Previous fork baseline: `528c682e061696f5a160f363f236ecbf53cbd006`

Imported source roots are flattened into this package:

- `apps/web/index.html`, `apps/web/public/`, and `apps/web/src/`
- `packages/client/modules/src/`
- `packages/client/locale/src/`
- `packages/client/web/src/`
- `packages/client/ui-*/src/`
- `packages/client/tsdown.client.ts`
- `packages/extensions/ui-cordis/src/`

The source is MIT licensed under the upstream repository's license. Builds never refresh this fork. This neutral package is the only product layer that tracks DSH Web upstream; future updates must be explicit, reviewed three-way merges. Product branding and composition live in each consuming product package, so iKanban and IPaper can independently pin and release a tested `@isomoes/dsh-web-ui` version.
