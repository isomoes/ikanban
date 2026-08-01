import { afterEach, describe, expect, test } from "bun:test"
import { createIkanbanServer } from "./http"
import type {
  AgentRuntime,
  RuntimeEvent,
  RuntimeMessage,
  RuntimeModel,
  RuntimeProject,
  RuntimeSession,
} from "./protocol"

const directory = "/workspace/ikanban"

class FakeRuntime implements AgentRuntime {
  readonly projects: RuntimeProject[] = [
    { id: "project-1", name: "iKanban", directory },
  ]
  readonly models: RuntimeModel[] = [
    { id: "sonnet", providerID: "anthropic", name: "Sonnet" },
  ]
  readonly sessions: RuntimeSession[] = [
    {
      id: "session-1",
      directory,
      title: "Existing session",
      createdAt: 10,
      updatedAt: 20,
    },
  ]
  readonly messageList: RuntimeMessage[] = [
    {
      id: "message-1",
      sessionID: "session-1",
      role: "user",
      createdAt: 30,
      parts: [{ id: "part-1", type: "text", text: "hello" }],
    },
  ]
  readonly prompts: Array<{ directory: string; sessionID: string; input: unknown }> = []
  readonly aborts: Array<{ directory: string; sessionID: string }> = []
  readonly listeners = new Set<(event: RuntimeEvent) => void>()
  promptBarrier?: Promise<void>

  project = {
    list: async () => this.projects,
    get: async (_directory: string) => this.projects[0],
  }

  model = {
    list: async () => this.models,
  }

  session = {
    create: async (target: string) => ({
      id: "session-new",
      directory: target,
      title: "New session",
      createdAt: 40,
      updatedAt: 40,
    }),
    list: async () => this.sessions,
    get: async (_target: string, sessionID: string) => {
      const session = this.sessions.find((item) => item.id === sessionID)
      if (!session) throw new Error(`Unknown session: ${sessionID}`)
      return session
    },
    messages: async () => this.messageList,
    status: async () => ({ "session-1": { type: "idle" as const } }),
  }

  async prompt(target: string, sessionID: string, input: unknown) {
    this.prompts.push({ directory: target, sessionID, input })
    await this.promptBarrier
  }

  async abort(target: string, sessionID: string) {
    this.aborts.push({ directory: target, sessionID })
  }

  event(_target: string | undefined, listener: (event: RuntimeEvent) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(event: RuntimeEvent) {
    for (const listener of this.listeners) listener(event)
  }
}

const servers: Bun.Server<undefined>[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop(true)))
})

function start(runtime = new FakeRuntime()) {
  const server = createIkanbanServer({ runtime, hostname: "127.0.0.1", port: 0 })
  servers.push(server)
  return { runtime, server }
}

function request(server: Bun.Server<undefined>, path: string, init?: RequestInit) {
  return fetch(new Request(new URL(path, server.url), init))
}

async function data(response: Response) {
  return { data: await response.json() as unknown }
}

describe("HTTP bootstrap contract", () => {
  test("reports server health", async () => {
    const { server } = start()
    const response = await request(server, "/global/health")

    expect(response.status).toBe(200)
    expect(await data(response)).toEqual({ data: { healthy: true } })
  })

  test("returns path and project bootstrap data for a directory", async () => {
    const { server } = start()
    const query = `?directory=${encodeURIComponent(directory)}`

    const [pathResponse, projectsResponse, projectResponse] = await Promise.all([
      request(server, "/path").then(data),
      request(server, "/project").then(data),
      request(server, `/project/current${query}`).then(data),
    ])

    expect(pathResponse.data).toEqual({
      home: directory,
      state: directory,
      config: directory,
      worktree: directory,
      directory,
    })
    expect(projectsResponse.data).toEqual([{
      id: "project-1",
      name: "iKanban",
      worktree: directory,
      time: { created: 0, updated: 0 },
      sandboxes: [],
    }])
    expect(projectResponse.data).toEqual({
      id: "project-1",
      name: "iKanban",
      worktree: directory,
      time: { created: 0, updated: 0 },
      sandboxes: [],
    })
  })

  test("returns actual models and a usable build agent", async () => {
    const { server } = start()
    const [provider, agent] = await Promise.all([
      request(server, "/provider").then(data),
      request(server, `/agent?directory=${encodeURIComponent(directory)}`).then(data),
    ])

    expect(provider.data).toMatchObject({
      connected: ["anthropic"],
      default: { anthropic: "sonnet" },
      all: [{ id: "anthropic", models: { sonnet: { id: "sonnet", providerID: "anthropic" } } }],
    })
    expect(agent.data).toEqual([
      expect.objectContaining({
        name: "build",
        mode: "primary",
        model: { providerID: "anthropic", modelID: "sonnet" },
      }),
    ])
  })

  test("returns explicit empty values for unsupported bootstrap capabilities", async () => {
    const { server } = start()
    const query = `?directory=${encodeURIComponent(directory)}`
    const routes = [
      ["/global/config", { ikanban: { runtime: "pi" } }],
      ["/provider/auth", {}],
      ["/config", { ikanban: { runtime: "pi" } }],
      ["/command", []],
      ["/mcp", {}],
      ["/lsp", []],
      ["/vcs", {}],
      ["/permission", []],
      ["/question", []],
    ] as const

    for (const [route, expected] of routes) {
      const suffix = route === "/global/config" ? "" : query
      const response = await request(server, `${route}${suffix}`)
      expect(response.status).toBe(200)
      expect(await data(response)).toEqual({ data: expected })
    }
  })

  test("rejects a missing or non-absolute directory", async () => {
    const { server } = start()

    for (const path of ["/session", "/path?directory=relative/path"]) {
      const response = await request(server, path)
      expect(response.status).toBe(400)
      expect(response.headers.get("content-type")).toContain("application/json")
      expect(await data(response)).toEqual({ data: { message: "A valid absolute directory is required" } })
    }
  })
})

describe("HTTP session contract", () => {
  test("accepts the SDK directory header on POST requests", async () => {
    const { runtime, server } = start()
    const headers = {
      "content-type": "application/json",
      "x-opencode-directory": encodeURIComponent(directory),
    }

    const created = await request(server, "/session", {
      method: "POST",
      headers,
    })
    const prompted = await request(server, "/session/session-1/prompt_async", {
      method: "POST",
      headers,
      body: JSON.stringify({ parts: [{ type: "text", text: "from sdk" }] }),
    })

    expect(created.status).toBe(200)
    expect(prompted.status).toBe(204)
    expect(runtime.prompts).toEqual([{
      directory,
      sessionID: "session-1",
      input: { parts: [{ type: "text", text: "from sdk" }] },
    }])
  })

  test("creates, lists, gets, and loads messages and status", async () => {
    const { server } = start()
    const query = `?directory=${encodeURIComponent(directory)}`

    const [created, listed, session, messages, status] = await Promise.all([
      request(server, `/session${query}`, { method: "POST" }).then(data),
      request(server, `/session${query}`).then(data),
      request(server, `/session/session-1${query}`).then(data),
      request(server, `/session/session-1/message${query}`).then(data),
      request(server, `/session/status${query}`).then(data),
    ])

    expect(created.data).toMatchObject({ id: "session-new", directory })
    expect(listed.data).toEqual([{
      id: "session-1",
      slug: "session-1",
      projectID: directory,
      directory,
      title: "Existing session",
      version: "pi",
      time: { created: 10, updated: 20 },
    }])
    expect(session.data).toMatchObject({ id: "session-1" })
    expect(messages.data).toEqual([
      {
        info: {
          id: "message-1",
          sessionID: "session-1",
          role: "user",
          time: { created: 30 },
          agent: "build",
          model: { providerID: "unknown", modelID: "unknown" },
        },
        parts: [{
          id: "part-1",
          sessionID: "session-1",
          messageID: "message-1",
          type: "text",
          text: "hello",
        }],
      },
    ])
    expect(status.data).toEqual({ "session-1": { type: "idle" } })
  })

  test("dispatches prompts and aborts through the injected runtime", async () => {
    const { runtime, server } = start()
    const query = `?directory=${encodeURIComponent(directory)}`
    const prompt = {
      messageID: "message-2",
      model: { providerID: "anthropic", modelID: "sonnet" },
      agent: "build",
      parts: [{ type: "text", text: "ship it" }],
    }

    let releasePrompt!: () => void
    runtime.promptBarrier = new Promise<void>((resolve) => { releasePrompt = resolve })
    const promptRequest = request(server, `/session/session-1/prompt_async${query}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(prompt),
    })
    const promptResponse = await Promise.race([
      promptRequest,
      Bun.sleep(50).then(() => "timeout" as const),
    ])
    releasePrompt()
    expect(promptResponse).not.toBe("timeout")
    if (promptResponse === "timeout") return
    const abortResponse = await request(server, `/session/session-1/abort${query}`, { method: "POST" })

    expect(promptResponse.status).toBe(204)
    expect(await promptResponse.text()).toBe("")
    expect(await data(abortResponse)).toEqual({ data: true })
    expect(runtime.prompts).toEqual([{ directory, sessionID: "session-1", input: prompt }])
    expect(runtime.aborts).toEqual([{ directory, sessionID: "session-1" }])
  })

  test("returns JSON errors for malformed input and runtime failures", async () => {
    const { server } = start()
    const query = `?directory=${encodeURIComponent(directory)}`

    const malformed = await request(server, `/session/session-1/prompt_async${query}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    })
    const missing = await request(server, `/session/missing${query}`)

    expect(malformed.status).toBe(400)
    expect(await data(malformed)).toEqual({ data: { message: "Invalid JSON body" } })
    expect(missing.status).toBe(500)
    expect(await data(missing)).toEqual({ data: { message: "Unknown session: missing" } })
  })
})

test("frames runtime events as SSE messages and unsubscribes on disconnect", async () => {
  const { runtime, server } = start()
  const controller = new AbortController()
  const response = await request(server, "/global/event", { signal: controller.signal })

  expect(response.headers.get("content-type")).toContain("text/event-stream")
  expect(runtime.listeners.size).toBe(1)
  runtime.emit({ type: "status", sessionID: "session-1", status: "busy" })

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let output = ""
  while (!output.includes("event: message")) {
    const chunk = await reader.read()
    if (chunk.done) break
    output += decoder.decode(chunk.value, { stream: true })
  }

  expect(output).toContain(
    `event: message\ndata: {"directory":"${directory}","payload":{"id":"pi-event-1","type":"session.status","properties":{"sessionID":"session-1","status":{"type":"busy"}}}}\n\n`,
  )

  controller.abort()
  await reader.cancel().catch(() => {})
  for (let attempt = 0; attempt < 20 && runtime.listeners.size > 0; attempt++) await Bun.sleep(1)
  expect(runtime.listeners.size).toBe(0)
})
