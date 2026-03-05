## Debugging

- NEVER try to restart the app, or the server process, EVER.

## Local Dev

- Do not use `opencode dev web` for this repo.
- From repo root, run `bun dev` (or `bun run dev:web`).
- From `packages/web`, run `bun dev`.
- Open the local Vite URL shown in terminal (usually `http://localhost:5173`) to verify UI/CSS changes.

## SolidJS

- Always prefer `createStore` over multiple `createSignal` calls

## Tool Calling

- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.

## Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands.

Core workflow:

1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes
