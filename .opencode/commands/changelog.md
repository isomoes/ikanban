---
description: Draft user-facing CHANGELOG.md entries for [Unreleased]
agent: build
---

You are updating @CHANGELOG.md.

Goal: write user-facing bullet points for the `## [Unreleased]` section that summarize the changes since the latest git tag up to `HEAD`.

Style rules:

- Match the writing style of the existing changelog (tone + level of detail).
- Prefer 5-9 bullets; group by platform only if it reads better.
- No new release header; only update the `[Unreleased]` bullets.
- Don't include implementation notes, commit hashes, or file paths in the changelog text.
- Use area prefixes when helpful for grouping in the main @CHANGELOG.md (e.g., "Chat:", "VSCode:", "Settings:", "Git:", "Terminal:", "Mobile:", "UI:").
- Credit contributors inline using "(@username)" at the end of the bullet. Find contributor usernames from commit authors or PR metadata when available.

Determine the base version:

- Use the latest tag (ex: `v1.3.2`) as the base.
- Inspect all commits after the base up to `HEAD`.

Now:

1. Propose the new `[Unreleased]` bullet list for the main @CHANGELOG.md.
2. Edit both files to update their respective `[Unreleased]` sections.
