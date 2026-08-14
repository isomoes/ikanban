# iKanban

Monorepo for the iKanban plugin packages for DeepSeek Harness.

## Packages

- [`@isomoes/dsh-ikanban`](packages/ikanban) - the stock DSH Web repackage and keyboard-first customization base
- [`packages/ui-layout`](packages/ui-layout) - private source for the three-column web shell
- [`packages/ui-sidebar`](packages/ui-sidebar) - private source for the branded sidebar shell
- [`packages/ui-workspace`](packages/ui-workspace) - private source for the workspace and session browser

## Development

```bash
pnpm install
pnpm typecheck
pnpm build
```

Build, install the linked checkout into an isolated `ikanban` DSH profile, and
run it:

```bash
pnpm dev
```

`pnpm dev` creates or refreshes the profile automatically. Use
`pnpm dev:config` to inspect the resulting composition without booting it.

See the package [development guide](packages/ikanban/README.md#local-development)
for rebuild behavior and profile cleanup.

See [CHANGELOG.md](CHANGELOG.md) for project history.
