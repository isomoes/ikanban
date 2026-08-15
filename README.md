# iKanban

Monorepo for the iKanban browser-surface fork for DeepSeek Harness.

## Packages

- [`@isomoes/dsh-ikanban`](packages/ikanban) - the public DSH bundle, host adapters, generated composition, and packaged browser artifacts
- [`packages/web-ui`](packages/web-ui) - the private editable TS/TSX/CSS fork of the full browser plugin surface and Vite shell

## Usage

Install the published plugin into an `ikanban` profile. The `dsh plugin`
command creates the profile if it does not already exist:

```bash
dsh plugin --profile ikanban add @isomoes/dsh-ikanban
```

Run iKanban through that profile:

```bash
dsh --profile ikanban
```

See [CHANGELOG.md](CHANGELOG.md) for project history.

## Development

```bash
pnpm install
pnpm typecheck
pnpm build
```

Build, install the linked checkout into an isolated `ikanban-dev` DSH profile, and
run it:

```bash
pnpm dev
```

`pnpm dev` creates or refreshes the profile automatically. Use
`pnpm dev:config` to inspect the resulting composition without booting it.
It watches every forked client bundle with tsdown and the browser shell with
Vite. Client changes hot-reload their own virtual DSH package; shell changes
are copied into the linked package and require a browser reload.

See the package [development guide](packages/ikanban/README.md#local-development)
for rebuild behavior and profile cleanup.
