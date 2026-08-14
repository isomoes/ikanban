# `@isomoes/dsh-ikanban`

Kanban plugin bundle for DeepSeek Harness.

Version `0.4.0` resets the project onto the DSH `web-app` package architecture. This repository currently contains only the package scaffold; plugin behavior will be implemented in later changes.

## Structure

```text
src/
  index.ts       bundle plugin entry
  startup.ts     startup companion entry
  invariant.ts   invariant companion entry
cordis.patch.yml bundle composition patch
```

## Development

```bash
pnpm install
pnpm build
```

See [CHANGELOG.md](CHANGELOG.md) for the retained project history.
