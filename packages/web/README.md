# iKanban web

The private static iKanban frontend for OpenCode V2, deployed to GitHub Pages.
This migration foundation currently displays a placeholder page; the new
interface is under development.

From the repository root:

```sh
bun run dev
bun run build:web
bun run preview:web --port 3000
```

The application base is `/ikanban/`. `src/client.ts` connects directly to an
explicit OpenCode V2 server URL, or a `VITE_OPENCODE_URL` build-time default.
The server must allow the frontend origin via CORS. Server selection and
authentication UI will be implemented in the next phase.

Source and development instructions: https://github.com/isomoes/ikanban
