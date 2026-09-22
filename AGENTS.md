# iKanban Agent Notes

- Base the frontend on the OpenCode `v2` branch's shared desktop/web application.
  `packages/web` is the only application; `packages/ui` and `packages/session-ui`
  contain its upstream shared components.
- Use native OpenCode V2 types and `@opencode/client` (including its Solid data
  layer). Follow the upstream server connection and authentication implementation.
- Keep backend sessions, execution, providers, and credentials owned by OpenCode.
  DSH and the old CLI/proxy are retired.
- Toolchain: Bun 1.3.12, Node ^22.19.0 or >=24. Install with
  `bun install --frozen-lockfile`.
- Check changes with `bun run typecheck`,
  `bun run --cwd packages/web test:unit`, and `bun run build:web`.
