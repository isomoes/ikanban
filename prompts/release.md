# Release Prompt

1. Add the target version's release notes to `CHANGELOG.md`.
   - Starting with 0.6.1, use headings `## [<version>] - YYYY-MM-DD` with the release
     date and entries `- Area: Change description. (@username) [short-hash](commit-url)`,
     following [apaper-plugin's changelog](https://github.com/ai4paper/apaper-plugin/blob/main/CHANGELOG.md)
     with clickable commit hashes.
   - Use a plain-text area label (for example, `Web`, `Docs`, or `CI`), credit the
     change's author, and link the seven-character hash to
     `https://github.com/isomoes/ikanban/commit/<full-hash>`.
   - Use the commit that implements the change; include multiple commit links if
     an entry summarizes multiple commits.
   - Uncommitted `Unreleased` entries may omit the hash. Commit the implementation
     first, then add its actual commit link when preparing the release notes.
2. Run `bun run bump-version <version>` to update the root manifest,
   `packages/web/package.json`, and `bun.lock`. The shared libraries in
   `packages/ui` and `packages/session-ui` retain the imported upstream version
   recorded in `docs/upstream.json`; do not bump them to the iKanban release version.
3. Verify:
   - `bun install --frozen-lockfile`
   - `bun run typecheck`
   - `bun run --cwd packages/web test:unit`
   - `env -u VITE_OPENCODE_URL bun run build:web`
   - `(cd packages/web && bunx playwright install chromium)` (once per machine)
   - `env -u VITE_OPENCODE_URL bun run --cwd packages/web test:pages`
   - `node scripts/check-release.mjs v<version>`
   - Record real-backend checks separately: backend version, URL/password
     connection, server switching, session loading, prompt/streaming response,
     permissions/forms, files/diffs, and terminal WebSocket. Report untested
     interactions accurately; build and fixture tests do not verify a live backend.
4. Commit the release files with `git commit -m "release v<version>"`.
5. Push the branch with `git push origin main`.
6. Create and push `v<version>`:
   - `git tag v<version>`
   - `git push origin v<version>`

The workflow deploys **only static files to GitHub Pages** at `/ikanban/`.
Set the repository's Pages source to **GitHub Actions**. The optional repository
variable `VITE_OPENCODE_URL` sets the default OpenCode V2 server for the build.
Leave it empty to use the runtime connection screen. Never put credentials in build
variables. The backend must allow CORS from `https://isomoes.github.io`, support
HTTPS and terminal WebSockets, and accept upstream Basic authentication with
username `opencode` and the server password.

The root manifest and all three workspaces are private. The release checker
validates the root/web release version and the shared libraries' upstream version.
The workflow runs typecheck, web unit tests, a build without a backend default,
and Pages browser tests. If the repository defines `VITE_OPENCODE_URL`, it then
rebuilds with that default for deployment. The Pages artifact includes the SPA
fallback and license notices.

After Pages deployment succeeds, the workflow creates a GitHub Release using the
matching version section from the tagged `CHANGELOG.md`. Missing or empty entries
fail the release job. Rerunning the workflow updates the existing release's title
and notes.

Use the workflow's manual `tag` input to release and deploy an existing tag. Releases use the current application
version sequence; restoring the architecture does not reset versions to 0.3.x.

The frontend imports the complete upstream shared desktop/web UI and uses native
V2 client types and the Solid data layer. Describe the pinned upstream revision
and any local integration changes in release notes; see `docs/architecture.md`
and `docs/upstream.md`. Historical release notes retain their original context.
