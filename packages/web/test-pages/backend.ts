import { createServer, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"

// A deliberately small V2 HTTP fixture, not a running OpenCode backend.
// Real HTTP (including CORS and SSE) keeps browser auth/transport behavior observable.
export async function startBackend(pagesOrigin: string) {
  const password = "pages-fixture-password"
  const authorization = `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`
  const requests: { method: string; path: string; authorization?: string; origin?: string }[] = []
  const unexpected: string[] = []
  const streams = new Set<ServerResponse>()
  const location = {
    directory: "/fixture",
    project: { id: "prj_pages_fixture", directory: "/fixture", canonical: "/fixture" },
  }
  let origin = ""
  const server = createServer((request, response) => {
    const url = new URL(request.url!, origin)
    const method = request.method!
    requests.push({ method, path: url.pathname, authorization: request.headers.authorization, origin: request.headers.origin })
    response.setHeader("Access-Control-Allow-Origin", pagesOrigin)
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-OpenCode-Directory")
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
    response.setHeader("Cache-Control", "no-store")
    if (method === "OPTIONS") {
      response.writeHead(204).end()
      return
    }
    const json = (body: unknown, status = 200) => {
      response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body))
    }
    if (request.headers.authorization !== authorization) {
      json({ message: "Unauthorized" }, 401)
      return
    }
    if (method !== "GET") {
      unexpected.push(`${method} ${url.pathname}`)
      json({ message: "Fixture is read-only" }, 405)
      return
    }
    if (url.pathname === "/api/event") {
      response.writeHead(200, { "Content-Type": "text/event-stream", Connection: "keep-alive" })
      response.write(`data: ${JSON.stringify({ id: "evt_pages_connected", type: "server.connected", data: {} })}\n\n`)
      streams.add(response)
      const timer = setInterval(() => response.write(": keepalive\n\n"), 5_000)
      response.on("close", () => {
        clearInterval(timer)
        streams.delete(response)
      })
      return
    }
    const bodies: Record<string, unknown> = {
      "/api/info": { version: "2.0.0", pid: 1, urls: [origin], paths: { tmp: "/fixture/tmp" } },
      "/api/location": location,
      "/api/project": [],
      "/api/config": [],
      "/api/session": { data: [], cursor: {} },
      "/api/session/active": { data: {} },
      "/api/vcs": { location, data: { branch: { current: "main", default: "main" } } },
      "/api/model/default": { location, data: {} },
      "/api/mcp/resource": { location, data: { resources: [], templates: [] } },
    }
    for (const path of ["agent", "provider", "model", "integration", "reference", "command", "skill", "plugin", "mcp", "form", "permission/request"]) {
      bodies[`/api/${path}`] = { location, data: [] }
    }
    if (Object.hasOwn(bodies, url.pathname)) {
      json(bodies[url.pathname])
      return
    }
    unexpected.push(`${method} ${url.pathname}`)
    json({ message: "Unknown fixture endpoint" }, 404)
  })
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return {
    origin,
    password,
    authorization,
    requests,
    unexpected,
    async close() {
      for (const stream of streams) stream.destroy()
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    },
  }
}
