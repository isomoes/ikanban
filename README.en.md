# iKanban

English | [简体中文](./README.md)

iKanban is a keyboard-oriented, multi-agent coding workspace for
[DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness). It is built
for driving, reviewing, and coordinating parallel agent work across projects,
with session management, diff review, and project-aware navigation in one
place.

This monorepo contains the iKanban DSH bundle and the public, product-neutral shared browser package used by iKanban and IPaper.

## Introduction Videos

These videos introduce the iKanban workflow and its evolution, including the
current DSH-based `v0.4.2`. Videos for `v0.3` and earlier predate the current
package, so their installation steps and parts of the interface may differ.

**Bilibili videos:** [Why I made iKanban](https://www.bilibili.com/video/BV1t9AhztEjX/) · [v0.1](https://www.bilibili.com/video/BV1W3Pgz8ExJ/) · [v0.2](https://www.bilibili.com/video/BV1ZNP1znEn5/) · [v0.2.11 usage guide](https://www.bilibili.com/video/BV1Y9wMzKE2b/) · [v0.3](https://www.bilibili.com/video/BV1n9QEBSEch/) · [v0.3.14](https://www.bilibili.com/video/BV1zy3F6aEb2/) · [v0.4.2](https://www.bilibili.com/video/BV156b26eEbn/)

## Packages

- [`@isomoes/dsh-ikanban`](packages/ikanban) - the public iKanban DSH bundle, coding presets, product composition, and branding
- [`@isomoes/dsh-web-ui`](packages/web-ui) - the public product-neutral browser plugin surface and Vite shell shared with IPaper

## Usage

### 1. Install DSH

First, install the DeepSeek Harness CLI globally with npm:

```bash
npm install -g @deepseek-ai/dsh --registry=https://registry.npmjs.org
```

Users in mainland China can replace the official npm registry in the command
with a local mirror such as `https://registry.npmmirror.com`. Mirrors can have
synchronization delays; use the official `https://registry.npmjs.org` URL when
you need the latest published version.

### 2. Install iKanban

Install the published iKanban bundle and shared Web UI into an `ikanban`
profile. The `dsh plugin` command creates the profile if it does not already
exist:

```bash
dsh plugin --profile ikanban add @isomoes/dsh-ikanban @isomoes/dsh-web-ui --registry=https://registry.npmjs.org
```

`@isomoes/dsh-web-ui` must be a direct profile dependency because Cordis
resolves browser loader entries from the profile root. It is not added to
`dsh.profile.bundles`; `@isomoes/dsh-ikanban` remains the only package that
contributes the product composition patch. The `--registry` value can also be
replaced with a local mirror. Use the official npm registry when you need the
latest iKanban version.

### 3. Update iKanban

Stop the running iKanban instance, then use DSH to update both the iKanban
bundle and shared Web UI in that profile to their latest published versions:

```bash
dsh plugin --profile ikanban update @isomoes/dsh-ikanban @isomoes/dsh-web-ui --latest --config.minimumReleaseAge=0 --registry=https://registry.npmjs.org
```

`--config.minimumReleaseAge=0` bypasses pnpm's default 24-hour waiting period
for new releases during this explicit update; without it, a newly published
version may be reported as "Already up to date." Restart iKanban after the
update completes. Registry mirrors can also lag behind; use the official npm
registry shown above if the latest version is unavailable.

### 4. Run iKanban

Start iKanban through that profile:

```bash
dsh --profile ikanban
```

Pass startup options to select a different port, for example:

```bash
dsh --profile ikanban --port 9091
```

See [CHANGELOG.md](CHANGELOG.md) for the release history. The current
architecture and earlier product transitions are preserved in these documents:

**Version documents:** [`v0.4.2` current architecture and basic features (Chinese)](docs/0.4.2.md) · [`v0.1.6` to `v0.2.7`](docs/0.1.6TO0.2.7.md) · [`v0.2.7` to `v0.3.1`](docs/0.2.7TO0.3.1.md) · [`v0.3.1` to `v0.3.14`](docs/0.3.1TO0.3.14.md)

## Development

```bash
pnpm install
pnpm typecheck
pnpm build
```

Build, link both the iKanban bundle and shared Web UI checkouts into an isolated
`ikanban-dev` DSH profile, and run it:

```bash
pnpm dev
```

`pnpm dev` creates or refreshes the profile automatically and explicitly links
`@isomoes/dsh-web-ui`, allowing the isolated profile to resolve the
`@isomoes/dsh-web-ui/client/*` loader entries in the composition. The Web UI is
a plain runtime dependency, not an additional bundle layer; only iKanban
contributes the product composition patch. Use `pnpm dev:config` to inspect the
resulting composition without booting it.
It watches every forked client bundle with tsdown and the browser shell with
Vite. Client changes hot-reload their own virtual DSH package; shell changes
are copied into the linked package and require a browser reload.

See the package [development guide](packages/ikanban/README.md#local-development)
for rebuild behavior and profile cleanup.
