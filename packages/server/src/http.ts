import { isAbsolute } from "node:path"
import {
  createOpenCodeEventMapper,
  toOpenCodeAgents,
  toOpenCodeMessages,
  toOpenCodeProject,
  toOpenCodeProviderList,
  toOpenCodeSession,
} from "./opencode-compat"
import type { AgentRuntime, RuntimePrompt } from "./protocol"

export type IkanbanServerOptions = {
  runtime: AgentRuntime
  hostname?: string
  port?: number
}

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

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

function getDirectory(request: Request, url: URL) {
  const query = url.searchParams.get("directory")
  const header = request.headers.get("x-opencode-directory")
  let directory: string | null = query
  if (!directory && header) {
    try {
      directory = decodeURIComponent(header)
    } catch {
      throw new HttpError("A valid absolute directory is required", 400)
    }
  }
  if (!directory || !isAbsolute(directory)) {
    throw new HttpError("A valid absolute directory is required", 400)
  }
  return directory
}

async function readJson(request: Request, required = true) {
  const body = await request.text()
  if (!body && !required) return undefined
  try {
    return JSON.parse(body) as Record<string, unknown>
  } catch {
    throw new HttpError("Invalid JSON body", 400)
  }
}

function errorResponse(error: unknown) {
  if (error instanceof HttpError) return json({ message: error.message }, error.status)
  const message = error instanceof Error ? error.message : "Internal server error"
  const status =
    error && typeof error === "object" && "status" in error && typeof error.status === "number"
      ? error.status
      : 500
  return json({ message }, status >= 400 && status <= 599 ? status : 500)
}

function eventStream(request: Request, runtime: AgentRuntime, directories: string[], global: boolean) {
  const encoder = new TextEncoder()
  const unsubscribe: Array<() => void> = []
  const mapEvent = createOpenCodeEventMapper()
  let closed = false

  const cleanup = () => {
    if (closed) return
    closed = true
    request.signal.removeEventListener("abort", cleanup)
    for (const stop of unsubscribe) stop()
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"))
      for (const directory of directories) {
        unsubscribe.push(runtime.event(directory, (event) => {
          if (closed) return
          const mapped = mapEvent(directory, event)
          controller.enqueue(encoder.encode(
            `event: message\ndata: ${JSON.stringify(global ? mapped : mapped.payload)}\n\n`,
          ))
        }))
      }
      request.signal.addEventListener("abort", cleanup, { once: true })
    },
    cancel: cleanup,
  })

  return new Response(stream, {
    headers: {
      "cache-control": "no-cache",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
    },
  })
}

async function route(request: Request, runtime: AgentRuntime) {
  const url = new URL(request.url)
  const { method } = request
  const path = url.pathname

  if (method === "GET" && path === "/global/health") return json({ healthy: true })
  if (method === "GET" && path === "/global/config") return json({ ikanban: { runtime: "pi" } })
  if (method === "GET" && path === "/project") {
    return json((await runtime.project.list()).map(toOpenCodeProject))
  }
  if (method === "GET" && path === "/global/event") {
    const projects = await runtime.project.list()
    return eventStream(request, runtime, projects.map((project) => project.directory), true)
  }

  if (method === "GET" && (path === "/provider" || path === "/agent")) {
    const requested = url.searchParams.get("directory")
    const directory = requested ? getDirectory(request, url) : (await runtime.project.list())[0]?.directory
    if (!directory) throw new HttpError("No project directory is available", 400)
    const models = await runtime.model.list(directory)
    return json(path === "/provider" ? toOpenCodeProviderList(models) : toOpenCodeAgents(models))
  }

  const emptyCapabilities: Record<string, unknown> = {
    "/provider/auth": {},
    "/config": { ikanban: { runtime: "pi" } },
    "/command": [],
    "/mcp": {},
    "/lsp": [],
    "/vcs": {},
    "/permission": [],
    "/question": [],
  }
  if (method === "GET" && path in emptyCapabilities) return json(emptyCapabilities[path])

  const directory =
    path === "/path" && !url.searchParams.has("directory")
      ? (await runtime.project.list())[0]?.directory
      : getDirectory(request, url)
  if (!directory) throw new HttpError("No project directory is available", 400)

  if (method === "GET" && path === "/path") {
    return json({ home: directory, state: directory, config: directory, worktree: directory, directory })
  }
  if (method === "GET" && path === "/project/current") {
    return json(toOpenCodeProject(await runtime.project.get(directory)))
  }

  if (method === "GET" && path === "/session") {
    return json((await runtime.session.list(directory)).map(toOpenCodeSession))
  }
  if (method === "POST" && path === "/session") {
    return json(toOpenCodeSession(await runtime.session.create(directory, await readJson(request, false))))
  }
  if (method === "GET" && path === "/session/status") return json(await runtime.session.status(directory))
  if (method === "GET" && path === "/event") return eventStream(request, runtime, [directory], false)

  const match = path.match(/^\/session\/([^/]+)(?:\/(message|prompt_async|abort))?$/)
  if (match) {
    const sessionID = decodeURIComponent(match[1])
    const action = match[2]
    if (method === "GET" && !action) {
      return json(toOpenCodeSession(await runtime.session.get(directory, sessionID)))
    }
    if (method === "GET" && action === "message") {
      return json(toOpenCodeMessages(await runtime.session.messages(directory, sessionID), directory))
    }
    if (method === "POST" && action === "prompt_async") {
      void runtime.prompt(directory, sessionID, (await readJson(request)) as RuntimePrompt).catch(() => {})
      return new Response(null, { status: 204 })
    }
    if (method === "POST" && action === "abort") {
      await runtime.abort(directory, sessionID)
      return json(true)
    }
  }

  throw new HttpError("Not found", 404)
}

export function toIkanbanApiRequest(request: Request) {
  const url = new URL(request.url)
  let pathname = url.pathname
  if (pathname.startsWith("/ikanban/")) pathname = pathname.slice("/ikanban".length)
  if (!API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return
  if (pathname === url.pathname) return request
  url.pathname = pathname
  return new Request(url, request)
}

export function createIkanbanHandler(runtime: AgentRuntime) {
  return (request: Request) => route(request, runtime).catch(errorResponse)
}

export function createIkanbanServer(options: IkanbanServerOptions): Bun.Server<undefined> {
  const fetch = createIkanbanHandler(options.runtime)
  return Bun.serve({
    hostname: options.hostname,
    port: options.port,
    fetch,
  })
}
