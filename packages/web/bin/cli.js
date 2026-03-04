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

// OpenCode backend: honour OPENCODE_URL or default to localhost:4096
const OPENCODE_URL = process.env.OPENCODE_URL || "http://localhost:4096"

function proxyRequest(req, res) {
  const target = new URL(req.url, OPENCODE_URL)
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

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  // Proxy API and WebSocket upgrade paths to OpenCode backend
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/v1/")) {
    return proxyRequest(req, res)
  }

  // Serve static files from dist/
  let filePath = path.join(DIST, url.pathname)
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
  console.log(`iKanban running at http://localhost:${PORT}`)
  console.log(`OpenCode backend: ${OPENCODE_URL}`)
  console.log("Press Ctrl+C to stop")
})
