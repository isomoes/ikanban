# iKanban web

The private static iKanban frontend for OpenCode V2, deployed to GitHub Pages.
The SolidJS interface is restored from v0.3.18 and uses `@opencode/client` 2.0.11.

From the repository root:

```sh
VITE_OPENCODE_URL=http://127.0.0.1:4096 bun run dev
bun run typecheck
bun run --cwd packages/web test:unit
bun run build:web
bun run preview:web --port 3000
```

The application base is `/ikanban/`. `src/client.ts` connects directly to an
explicit OpenCode V2 server URL, or a `VITE_OPENCODE_URL` build-time default.
The server must allow the frontend origin via CORS. Select a server in the UI;
leave the Basic username empty to use a Bearer token in the password/token field.
See the root README for V2 feature differences and deployment requirements.

Source and development instructions: https://github.com/isomoes/ikanban
