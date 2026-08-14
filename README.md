# iKanban

Monorepo for the iKanban plugin packages for DeepSeek Harness.

## Packages

- [`@isomoes/dsh-ikanban`](packages/ikanban) - the stock DSH Web repackage and keyboard-first customization base

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
