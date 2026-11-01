# Dependency patches

Bun applies these files through the root `package.json` `patchedDependencies`.
Keep the manifest, lockfile, patch filenames, and patch hunk offsets in sync when
upgrading a patched dependency. Run both web test suites as well as typecheck and
the production build after changing patches.

## Upstream audit (2026-11-01)

| Dependency | Decision | Reason |
| --- | --- | --- |
| Vite | Updated 8.2.2 → 8.3.5; removed patch | Published development client and server contain the client-side payload acknowledgement fix from vitejs/vite#23373. |
| ghostty-web | Updated anomalyco fork 83c0a07 → 6e24d04; removed patch | Reverse-applying the entire former patch to the new commit's distributed JS succeeds: all patched changes are upstream. Keep using this fork; npm's coder/ghostty-web 0.4.0 still lacks the required mouse/scroll behavior. |
| solid-js | Updated 1.9.15 → 1.9.18; retained patch | Published cleanup code still clears owned nodes and callbacks after invoking them, leaving reentrant disposal unsafe. Rebased patch offsets for the new bundles. |
| @dnd-kit/dom | Updated the dnd-kit packages 0.5.0 → 0.5.3; retained patch | Required DOM plugins are still added only in the constructor, not when the plugin list is replaced. Rebased patch offsets. |
| @pierre/trees | Kept 1.0.0-beta.4 and patch | Inspected 1.0.0-beta.6: it still does not expose the `onExpansionChange` callback used by the workspace picker. Updating would require rebasing this feature patch, not eliminate it. |
| @tanstack/virtual-core | Kept 3.17.8 override and patch | Inspected 3.19.10: it still restricts data-change anchoring to `anchorTo: "end"`, uses only one anchor, and materializes unmeasured items during snapshots. Our timeline requires start anchoring and fallback keys; the newer scrolling implementation needs a separate patch migration. |

Regression coverage includes `test-browser/solid-runtime.test.ts`,
`test-browser/dnd-plugins.test.ts`, `test-browser/solid-virtual.test.ts`,
`src/session/terminal/terminal-mouse.test.ts`, and
`src/session/files/pierre-tree.test.ts` in `packages/web`.
