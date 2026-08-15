# Release Prompt

Use this flow for a normal release:

1. Update `CHANGELOG.md` with a new top section for the target version.
2. Set the target version in `package.json`, `packages/ikanban/package.json`, and
   `packages/web-ui/package.json`.
3. Verify the release:
   `pnpm typecheck && pnpm test && pnpm --filter @isomoes/dsh-ikanban pack`
4. Stage the release files.
5. Commit with:
   `git commit -m "release v<version>"`
6. Push the branch:
   `git push origin main`
7. Create the release tag:
   `git tag v<version>`
8. Push the tag to trigger the npm publish and GitHub release workflow:
   `git push origin v<version>`
