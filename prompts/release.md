# Release Prompt

Use this flow for a normal release:

1. Update `CHANGELOG.md` with a new top section for the target version.
2. Run `node scripts/bump-version.mjs <version>`.
3. Verify the release build:
   `VITE_BASE_PATH=/ikanban/ bun run build:web`
4. Stage the release files.
5. Commit with:
   `git commit -m "release v<version>"`
6. Push the branch:
   `git push origin main`
7. Create the release tag:
   `git tag v<version>`
8. Push the tag:
   `git push origin v<version>`
