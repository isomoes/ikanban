import { extname, relative, resolve, sep } from "node:path"

const BASE = "/ikanban"

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

type ApiHandler = (request: Request) => Response | Promise<Response | undefined> | undefined

export type StaticHandlerOptions = {
  root: string
  api?: ApiHandler
}

function notFound() {
  return new Response("Not found", { status: 404 })
}

function safeFile(root: string, pathname: string) {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return
  }
  if (decoded.includes("\0") || decoded.split(/[\\/]/).includes("..")) return
  const file = resolve(root, `.${decoded}`)
  const path = relative(root, file)
  if (path === ".." || path.startsWith(`..${sep}`)) return
  return file
}

function fileResponse(path: string) {
  const file = Bun.file(path)
  return file.exists().then((exists) => {
    if (!exists) return
    return new Response(file, {
      headers: { "content-type": contentTypes[extname(path).toLowerCase()] ?? "application/octet-stream" },
    })
  })
}

export function createStaticHandler(options: StaticHandlerOptions) {
  const root = resolve(options.root)

  return async (request: Request): Promise<Response> => {
    const apiResponse = await options.api?.(request)
    if (apiResponse) return apiResponse

    const url = new URL(request.url)
    if (url.pathname === BASE) {
      return new Response(null, { status: 301, headers: { location: `${BASE}/${url.search}` } })
    }
    if (!url.pathname.startsWith(`${BASE}/`)) return notFound()

    const pathname = url.pathname.slice(BASE.length)
    const path = safeFile(root, pathname)
    if (!path) return notFound()

    const asset = await fileResponse(path)
    if (asset) return asset
    return await fileResponse(resolve(root, "index.html")) ?? notFound()
  }
}
