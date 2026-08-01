# ikanban

Browser workspace for the Pi coding agent. This package provides the `ikanban` executable and runs Pi, the compatibility API, and the iKanban web UI as one Bun service.

Requires Bun 1.3.10 or newer and a Pi credential in `~/.pi/agent/auth.json`.

```bash
bunx ikanban@latest --port 3000 --project /path/to/repo
```

Open http://localhost:3000/ikanban/. Repeat `--project` to admit multiple project roots.

See the [full documentation](https://github.com/isomoes/ikanban#readme) for Pi login, model selection, persistence, Docker usage, and current limitations.
