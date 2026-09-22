import { stat } from "node:fs/promises"
import { extname, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../dist/", import.meta.url))
const base = "/ikanban/"
const port = Number(process.env.PLAYWRIGHT_PAGES_PORT ?? 4178)
for (const name of ["index.html", "404.html"]) {
  if (!(await Bun.file(resolve(root, name)).exists())) {
    throw new Error(`Missing dist/${name}. Run bun run build:web before the Pages fixture smoke.`)
  }
}

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
}

// Static files only: no API proxy, Vite middleware, rewrite, or redirect on a deep link.
const server = Bun.serve({
  hostname: "127.0.0.1",
  port,
  async fetch(request) {
    const url = new URL(request.url)
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } })
    }
    if (url.pathname === "/ikanban") return Response.redirect(`${url.origin}${base}${url.search}`, 301)
    if (!url.pathname.startsWith(base)) return new Response("Not found", { status: 404 })

    let path: string
    try {
      path = resolve(root, decodeURIComponent(url.pathname.slice(base.length)) || "index.html")
    } catch {
      return new Response("Invalid path", { status: 400 })
    }
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) {
      return new Response("Not found", { status: 404 })
    }
    const exists = await stat(path).then((entry) => entry.isFile(), () => false)
    const file = Bun.file(exists ? path : resolve(root, "404.html"))
    return new Response(request.method === "HEAD" ? null : file, {
      status: exists ? 200 : 404,
      headers: {
        "Content-Type": exists ? (mime[extname(path)] ?? file.type) : mime[".html"]!,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  },
})
console.log(`Pages static fixture: ${server.url}ikanban/`)
