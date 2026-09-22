# Upstream provenance and updates

## Imported baseline

- Repository: <https://github.com/anomalyco/opencode>
- Branch: `v2`
- Full commit: [`dcfe1ec7bd4922d4f44c141ba33047402bffc57e`](https://github.com/anomalyco/opencode/tree/dcfe1ec7bd4922d4f44c141ba33047402bffc57e)
- Upstream version: **2.0.12**
- Machine-readable record: [`upstream.json`](./upstream.json)

The complete shared application is imported from `packages/app` into
`packages/web`. `packages/ui` and `packages/session-ui` retain their directory names.
The application/root version is iKanban **0.6.1**; the shared libraries retain the
upstream version and are private workspaces.

This source pin records the frontend import, not a claim that every backend
version has been tested. Native OpenCode packages used from the registry must be
kept compatible with the imported source and pinned in the lockfile.

## Local integration changes

Keep the local patch surface focused on:

1. Workspace manifests, registry dependencies replacing unavailable upstream-only
   workspaces, TypeScript/build wiring, and the Bun lockfile.
2. The `/ikanban/` Vite/router base, static assets, `404.html` shell, and scoped PWA.
   Tailwind's explicit source paths must scan `packages/web`, including its HTML
   entry, after the upstream `packages/app` directory is relocated.
3. An optional explicit `VITE_OPENCODE_URL` default and upstream runtime server
   selection; an empty setup opens the connection screen.
4. iKanban browser-storage namespacing and application metadata.
5. Pages CI, release/version tooling, and project documentation.
6. Timeline auto-follow releases on plugin-driven upward scrolling, excluding
   the virtualizer's own anchoring writes.
7. The GitHub Dark Colorblind theme in `packages/ui/src/theme`, restored from
   iKanban `v0.5.3` with its original color overrides and blue/orange diffs.
   The source is
   `packages/web-ui/src/client/ui-theme/themes/github-dark-colorblind.json`
   at that tag. Adapt its seeds to the current `palette` format (background
   `neutral` and foreground `ink`) and map its explicit UI colors through
   `v2Overrides`; copying the legacy seeds produces washed-out V2 backgrounds.

8. Top session tabs support Ctrl+H / Ctrl+L for previous / next navigation.
   The focus-input command has no default shortcut to free Ctrl+L for tabs.

Server authentication and the native client/Solid data model follow upstream.
Desktop-only features remain governed by the upstream web platform. Do not restore
the old V1-shaped adapter as part of an upstream update.

## Reproduce the baseline

From the iKanban root, fetch and export the exact recorded source into a temporary
directory for comparison. These commands do not overwrite the working tree:

```sh
UPSTREAM=$(mktemp -d)
git clone --filter=blob:none --no-checkout --branch v2 https://github.com/anomalyco/opencode.git "$UPSTREAM/source"
git -C "$UPSTREAM/source" checkout --detach dcfe1ec7bd4922d4f44c141ba33047402bffc57e
mkdir -p "$UPSTREAM/baseline"
git -C "$UPSTREAM/source" archive dcfe1ec7bd4922d4f44c141ba33047402bffc57e packages/app packages/ui packages/session-ui LICENSE | tar -x -C "$UPSTREAM/baseline"
git diff --no-index "$UPSTREAM/baseline/packages/app" packages/web
git diff --no-index "$UPSTREAM/baseline/packages/ui" packages/ui
git diff --no-index "$UPSTREAM/baseline/packages/session-ui" packages/session-ui
```

`git diff --no-index` exits with status 1 when differences exist, as expected for
the local integration patch. Generated output and installed dependencies should
be excluded when reviewing a populated working tree.

## Update procedure

1. Start from a clean iKanban branch. Reproduce the recorded baseline above and
   save/review the local diff for each mapped package.
2. Fetch upstream `v2`, select a specific new commit, and record its full SHA with
   `git rev-parse`. Inspect its package versions and native-client dependency changes.
3. Export that commit to a separate directory with `git archive`, using the same
   package mapping. Compare old upstream, new upstream, and local source as a
   three-way update; bring in additions and removals as well as modified files.
   Do not blindly overwrite local integration changes or unrelated user work.
4. Reapply/reconcile the local changes listed above. Keep root and web versions on
   the iKanban release sequence; update both shared-library versions to the chosen
   upstream version. Resolve upstream workspace/catalog references consistently,
   then regenerate `bun.lock` with Bun 1.3.12.
5. Update `upstream.json`, the baseline links/versions in these docs and both READMEs,
   and release notes. Retain upstream license notices and any asset-specific licenses.
6. Run `bun install --frozen-lockfile`, `bun run typecheck`,
   `bun run --cwd packages/web test:unit`, `bun run build:web`, and
   `node scripts/check-release.mjs v<ikanban-version>`.
7. Run the Pages browser checks with no build-time backend default. Verify the
   runtime URL/password changes and separately record any real-backend smoke tests,
   including the backend version. Commit the source, integration changes,
   lockfile, and provenance record together.

## Licensing

The imported OpenCode code is MIT licensed, copyright (c) 2025 opencode. The full
upstream notice is preserved in [`upstream-license.txt`](./upstream-license.txt)
and the imported `packages/ui/LICENSE`. iKanban's own MIT notice remains in the
root `LICENSE`. Keep both notices with distributed copies; Pages CI includes them
in its static artifact. Fonts, icons, and other third-party assets retain their
own applicable notices.
