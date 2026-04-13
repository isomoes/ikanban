#!/usr/bin/env node
import http from "http"
import https from "https"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(__dirname, "../dist")

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
}

const args = process.argv.slice(2)
const portFlag = args.indexOf("--port")
const PORT = portFlag !== -1 ? parseInt(args[portFlag + 1], 10) : 3000

// OpenCode backend: honour OPENCODE_URL or default to localhost:4097
const OPENCODE_URL = process.env.OPENCODE_URL || "http://localhost:4097"

function proxyRequest(req, res, overridePath) {
  const target = new URL(req.url, OPENCODE_URL)
  if (overridePath !== undefined) target.pathname = overridePath
  const mod = target.protocol === "https:" ? https : http
  const options = {
    hostname: target.hostname,
    port: target.port || (target.protocol === "https:" ? 443 : 80),
    path: target.pathname + target.search,
    method: req.method,
    headers: { ...req.headers, host: target.host },
  }
  const proxy = mod.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res)
  })
  proxy.on("error", () => {
    res.writeHead(502)
    res.end("Bad Gateway: could not reach OpenCode backend")
  })
  req.pipe(proxy)
}

const BASE = "/ikanban"

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  // Redirect bare /ikanban to /ikanban/
  if (url.pathname === BASE) {
    res.writeHead(301, { Location: BASE + "/" })
    res.end()
    return
  }

  // Proxy OpenCode API paths to backend.
  // These are the top-level path segments used by @opencode-ai/sdk.
  const API_PREFIXES = [
    "/agent",
    "/auth",
    "/command",
    "/config",
    "/event",
    "/experimental",
    "/file",
    "/find",
    "/formatter",
    "/global",
    "/instance",
    "/log",
    "/lsp",
    "/mcp",
    "/path",
    "/permission",
    "/project",
    "/provider",
    "/pty",
    "/question",
    "/session",
    "/skill",
    "/tui",
    "/vcs",
  ]
  // Support both /session/... (SDK default, same-origin) and
  // /ikanban/session/... (prefixed, e.g. from a reverse proxy).
  // Determine the effective API pathname by stripping the base prefix if present.
  let apiPathname = url.pathname
  if (apiPathname.startsWith(BASE + "/")) {
    const stripped = apiPathname.slice(BASE.length)
    if (API_PREFIXES.some((p) => stripped === p || stripped.startsWith(p + "/"))) {
      apiPathname = stripped
    }
  }
  const isApi = API_PREFIXES.some(
    (p) => apiPathname === p || apiPathname.startsWith(p + "/"),
  )
  if (isApi) {
    // Pass the stripped path so the backend never sees the /ikanban prefix
    return proxyRequest(req, res, apiPathname !== url.pathname ? apiPathname : undefined)
  }

  // Strip /ikanban prefix before resolving static files
  let pathname = url.pathname
  if (pathname.startsWith(BASE + "/")) {
    pathname = pathname.slice(BASE.length) || "/"
  } else if (pathname !== BASE) {
    // Anything outside /ikanban/ that isn't an API call gets a 404
    res.writeHead(404)
    res.end("Not found")
    return
  }

  // Serve static files from dist/
  let filePath = path.join(DIST, pathname)
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, "index.html")
  }

  const ext = path.extname(filePath)
  const contentType = MIME[ext] || "application/octet-stream"

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404)
      res.end("Not found")
      return
    }
    res.writeHead(200, { "Content-Type": contentType })
    res.end(data)
  })
})

server.listen(PORT, () => {
  console.log(`iKanban running at http://localhost:${PORT}${BASE}/`)
  console.log(`OpenCode backend: ${OPENCODE_URL}`)
  console.log("Press Ctrl+C to stop")
})
