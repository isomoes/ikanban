# Standalone frontend foundation

## Decision

Restore the single-browser-application boundary from **v0.3.18**, with
**GitHub Pages as the only publishing target**. The web workspace is private;
the build produces static files in `packages/web/dist`.

Build a new interface against the **OpenCode V2 API** using `@opencode/client`.
Frontend framework selection belongs to the next implementation phase. The
current TypeScript/Vite entry is a migration placeholder, not a functioning chat
or Kanban interface.

## Boundaries

```text
Browser: packages/web/src
    │  @opencode/client (OpenCode V2)
    ▼
Independent OpenCode V2 server
    sessions · tools · providers · permissions · execution

GitHub Pages: static files + direct connection to a configured backend
```

- `packages/web/src/client.ts` constructs the V2 network client, with an explicit
  URL/headers or a `VITE_OPENCODE_URL` build-time default. A server URL is required;
  Pages cannot handle API requests.
- `/ikanban/` is the application base. Vite provides local development and static
  build previews; API requests go directly to the OpenCode server in all environments.
- The backend must support CORS for the frontend origin and HTTPS when accessed
  from GitHub Pages. Authentication is supplied by the browser interface.

## Removed implementation

`packages/ikanban`, `packages/web-ui`, and `packages/project-mcp` were DSH-specific
packages. Their source, generated artifacts, dependencies, tests, profile-linking
scripts, and two-package release pipeline have been retired. Local `.xdg` profile
data is not part of the new application. Prior implementation history is available
in Git, including both the v0.3 frontend and the v0.4/v0.5 DSH versions.

The standalone npm packaging, CLI/proxy, and proxy tests have also been removed
in favor of static-only deployment.

## Next phase

1. Choose the new frontend framework and interaction design.
2. Implement server selection and authentication, including direct static-host connections.
3. Build the project/session interface using V2 client methods and live events.
4. Verify against a real authenticated OpenCode V2 server before claiming feature parity.

Versions continue from the existing release sequence. The next release number is
chosen during release preparation, not as part of this architectural cleanup.
