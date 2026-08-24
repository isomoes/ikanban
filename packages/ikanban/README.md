# `@isomoes/dsh-ikanban`

Keyboard-oriented iKanban web application bundle for DeepSeek Harness.

The host runtime uses the published DSH `0.1.1-rc.1` backends and owns its Web startup, coding presets, composition, and iKanban branding. The common browser surface is published separately as [`@isomoes/dsh-web-ui`](../web-ui), which this package pins as a tested production dependency.

## Usage

Install the published bundle and shared Web UI into an `ikanban` profile. The
`dsh plugin` command creates the profile if it does not already exist:

```bash
dsh plugin --profile ikanban add @isomoes/dsh-ikanban @isomoes/dsh-web-ui --registry=https://registry.npmjs.org
```

The shared Web UI must be a direct profile dependency because Cordis resolves
its browser loader entries from the profile root. It remains a plain dependency
and must not be added to `dsh.profile.bundles`; only iKanban contributes the
product composition patch.

Stop iKanban before updating both published packages:

```bash
dsh plugin --profile ikanban update @isomoes/dsh-ikanban @isomoes/dsh-web-ui --latest --config.minimumReleaseAge=0 --registry=https://registry.npmjs.org
```

Run iKanban through that profile:

```bash
dsh --profile ikanban
```

Pass application options such as a custom port after the profile selection:

```bash
dsh --profile ikanban --port 9091
```

See the project [changelog](https://github.com/isomoes/ikanban/blob/main/CHANGELOG.md)
for release history.

### Opt-in project MCP

The published package ships **iKanban** as a read-only Built-in agent preset.
It mirrors the Standard preset and adds `@isomoes/dsh-ikanban/project-mcp`, so it
appears in the picker's Built-in group rather than as a user-authored Custom
preset. Select it only for trusted projects. The plugin reads `.mcp.json` from
each session's exact working directory; it is intentionally absent from the host
capability layer.

## Structure

```text
src/
  index.ts       bundle plugin entry
  startup.ts     startup companion entry
  invariant.ts   invariant companion entry
  directory-picker-auto.ts  browser-only picker loader
cordis.patch.yml bundle composition patch
scripts/
  sync-upstream.mjs  explicit maintenance helper for importing stock composition
  watch-client.mjs   tsdown and Vite development watchers
tests/
  upstream-parity.test.mjs  guard owned entries and infrastructure compatibility
```

## Local Development

Prerequisites are Node.js 22.19+ or 24+, pnpm 11.7.0, and the published DSH
CLI. Confirm that this repository and the CLI use the intended versions:

```bash
node --version
pnpm --version
dsh --version
```

Install dependencies. The primary development command then builds iKanban,
links its checkout into the dedicated `ikanban` profile, and starts that profile. It is
safe to run from a clean DSH home because it creates or refreshes the profile
before every launch:

```bash
pnpm install
pnpm dev
```

The DSH plugin command used internally links this bundle and the shared Web UI
into the profile. The Web UI remains a plain dependency rather than a bundle
layer; iKanban alone contributes its composition patch.

To inspect the composition without booting, install or refresh the profile and
then dump it. The output must contain an
`@isomoes/dsh-ikanban` bundle layer, with the `web-startup` and `web-runtime`
rows resolving to this package:

```bash
pnpm dev:install
pnpm dev:config
```

The stock server prints its URL and uses `http://127.0.0.1:3080` by default.
Pass Web application arguments after the script separator when needed:

```bash
pnpm dev -- --port 8080
```

To make the application available to other devices on the local network, bind
all interfaces. The startup output prints a detected LAN URL to open from those
devices:

```bash
pnpm dev -- --host 0.0.0.0
```

Binding `0.0.0.0` exposes the DSH session and its enabled tools to reachable
network clients. Use it only on a trusted LAN and keep the port protected from
the public Internet. The host webserver accepts only `127.0.0.1` and
`0.0.0.0`; clients connect to the machine's LAN address, not to `0.0.0.0`.

### Edit Cycle

The profile links this checkout, but DSH runs built `lib/` files. Changes to
host entries under `packages/ikanban/src`, build scripts, dependencies, or the
composition require rebuilding and restarting the running process:

```bash
pnpm build
# Stop the existing pnpm dev process, then:
pnpm dev
```

`cordis.patch.yml` is owned by the iKanban fork and is never regenerated during a
build. Edit and review it directly. It replaces startup, runtime, directory picker,
and every browser UI row while retaining published transport and backend rows.
`scripts/sync-upstream.mjs` is only an explicit maintenance helper for a deliberate
upstream re-import; running it overwrites the owned composition and requires review.

`packages/web-ui` is the editable source of the published `@isomoes/dsh-web-ui`
package. Client plugin code under its `src/client` and `src/extensions` paths is
built by tsdown as isolated virtual packages. During `pnpm dev`, successful
plugin builds keep their neutral `@isomoes/dsh-web-ui/client/<id>` identities so
both iKanban and IPaper can compose the same package version.

The Vite app context lives at the `web-ui` package root. Shared browser platform
code lives under `src/client`, including `web`, `ui-renderer`, `ui-slots`,
`ui-primitives`, dynamic `ui-attachment`, `ui-reference`, and the settings schema
service. Vite rebuilds this code into `packages/web-ui/web`; the iKanban build
copies that tested shell into `lib/web`. Reload the browser after a shell build.
A production `pnpm build` always rebuilds both artifact families.

Upstream refreshes are explicit reviewed merges, never an automatic build
step. The pinned commit and imported path inventory are recorded in
[`packages/web-ui/UPSTREAM.md`](../web-ui/UPSTREAM.md).

### Checks

Run the local checks before packing or publishing:

```bash
pnpm test
pnpm typecheck
pnpm --filter @isomoes/dsh-ikanban pack
```

Remove the development profile dependency when it is no longer needed:

```bash
pnpm dev:remove
```

The published bundle uses the browser directory picker and has no native
`koffi` install script to approve in consumer profiles.
