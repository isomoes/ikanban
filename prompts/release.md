# Release Prompt

1. Add the target version's release notes to `CHANGELOG.md`.
2. Run `bun run bump-version <version>` to update the root manifest,
   `packages/web/package.json`, and `bun.lock`.
3. Verify:
   - `bun install --frozen-lockfile`
    - `bun run typecheck && bun run build:web`
   - `node scripts/check-release.mjs v<version>`
4. Commit the release files with `git commit -m "release v<version>"`.
5. Push the branch with `git push origin main`.
6. Create and push `v<version>`:
   - `git tag v<version>`
   - `git push origin v<version>`

The workflow deploys **only static files to GitHub Pages** at `/ikanban/`.
Set the repository's Pages source to **GitHub Actions**. The optional repository
variable `VITE_OPENCODE_URL` sets the default OpenCode V2 server for the build.
Both workspace manifests are private.

Use the workflow's manual `tag` input to deploy an existing tag. Releases use the current application
version sequence; restoring the architecture does not reset versions to 0.3.x.

The current frontend is a migration foundation page. Describe that state accurately
in release notes until the new OpenCode V2 interface is implemented.
