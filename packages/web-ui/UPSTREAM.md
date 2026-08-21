# Upstream provenance

The editable browser source in this package is a reviewed fork of DeepSeek Harness.

- Repository: https://github.com/deepseek-ai/deepseek-harness
- Current source baseline: `dsh-v0.1.1-rc.1`
- Commit: `528c682e061696f5a160f363f236ecbf53cbd006`
- Previous fork baseline: `141eb6fef83422698aef7a981029e843e8161534`

Imported source roots are flattened into this package:

- `apps/web/index.html`, `apps/web/public/`, and `apps/web/src/`
- `packages/client/modules/src/`
- `packages/client/locale/src/`
- `packages/client/web/src/`
- `packages/client/ui-*/src/`
- `packages/client/tsdown.client.ts`
- `packages/extensions/ui-cordis/src/`

The source is MIT licensed under the upstream repository's license. Builds never refresh this fork. Future upstream updates must be explicit, reviewed three-way merges that preserve iKanban package identities, branding, keyboard behavior, workspace actions, themes, and release presentation.
