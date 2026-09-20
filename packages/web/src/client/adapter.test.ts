import { describe, expect, test } from "bun:test"
import type { SessionInfo, SessionMessageInfo } from "@opencode/client"
import { createUIClient } from "./adapter"
import { messageViews, fileView } from "./convert"
import { patchConfig, globalConfigPath } from "./config"
import { parse } from "jsonc-parser"
import { createSdkForServer } from "@/utils/server"

const session: SessionInfo = {
  id: "ses_test",
  projectID: "project",
  title: "Migration",
  location: { directory: "/workspace" },
  agent: "build",
  model: { providerID: "provider", id: "model" },
  cost: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  time: { created: 1, updated: 2 },
}
const user: SessionMessageInfo = { type: "user", id: "msg_1", time: { created: 1 }, text: "Review this" }
const assistant: SessionMessageInfo = {
  type: "assistant",
  id: "msg_2",
  agent: "build",
  model: { providerID: "provider", id: "model" },
  time: { created: 2 },
  content: [{ type: "text", text: "Checking" }],
}

type Call = { url: URL; headers: Headers; method: string; body: Record<string, unknown> }
function transport(handle: (call: Call) => unknown) {
  const calls: Call[] = []
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init)
    const call = {
      url: new URL(req.url),
      headers: req.headers,
      method: req.method,
      body: req.body ? ((await req.json()) as Record<string, unknown>) : {},
    }
    calls.push(call)
    const data = handle(call)
    return data instanceof Response ? data : Response.json(data)
  }) as typeof fetch
  const client = createUIClient({
    baseUrl: "https://backend.example",
    headers: { Authorization: "Bearer test-only" },
    directory: "/workspace",
    fetch: fetcher,
  })
  return { client, calls }
}

describe("OpenCode V2 browser adapter", () => {
  test("preserves saved Basic authentication and supports explicit Bearer credentials", async () => {
    const headers: Headers[] = []
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init)
      headers.push(request.headers)
      return Response.json({ version: "2.0.11" })
    }) as typeof fetch
    await createSdkForServer({
      server: { url: "https://server.example", password: "saved-password" },
      headers: new Headers({ "x-example": "preserved" }),
      fetch: fetcher,
    }).global.health()
    await createSdkForServer({
      server: { url: "https://server.example", password: "test-token", authType: "bearer" },
      fetch: fetcher,
    }).global.health()
    expect(headers[0].get("authorization")).toBe(`Basic ${btoa("opencode:saved-password")}`)
    expect(headers[0].get("x-example")).toBe("preserved")
    expect(headers[1].get("authorization")).toBe("Bearer test-token")
  })

  test("consumes native SSE lazily and coalesces execution events into a final message snapshot", async () => {
    const paths: string[] = []
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init)
      const path = new URL(req.url).pathname
      paths.push(path)
      if (path === "/api/event") {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const encoder = new TextEncoder()
            for (let i = 0; i < 5; i++)
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ id: `event_${i}`, created: i, type: "session.status", location: session.location, data: { sessionID: session.id, status: { type: "busy" } } })}\n\n`,
                ),
              )
            req.signal.addEventListener(
              "abort",
              () => {
                try {
                  controller.close()
                } catch {}
              },
              { once: true },
            )
          },
        })
        return new Response(stream, { headers: { "content-type": "text/event-stream" } })
      }
      if (path.endsWith("/message")) return Response.json({ data: [assistant, user], cursor: {} })
      return Response.json({ data: session })
    }) as typeof fetch
    const client = createUIClient({ baseUrl: "https://server.example", fetch: fetcher })
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 2000)
    const events = await client.global.event({ signal: abort.signal })
    expect(paths).toHaveLength(0)
    let text = ""
    try {
      for await (const event of events.stream) {
        if (event.payload.type !== "message.parts.updated") continue
        const part = event.payload.properties.parts.find((part) => part.type === "text")
        if (part?.type !== "text") continue
        text = part.text
        if (text === "Checking") break
      }
    } finally {
      clearTimeout(timer)
      abort.abort()
    }
    expect(text).toBe("Checking")
    expect(paths.filter((path) => path.endsWith("/message"))).toHaveLength(1)
  })

  test("creates sessions with native location and sends attachments after selecting agent/model", async () => {
    const { client, calls } = transport((call) => {
      if (call.url.pathname === "/api/session") return { data: session }
      if (call.url.pathname === "/api/session/ses_test") return { data: session }
      if (call.url.pathname.endsWith("/prompt"))
        return {
          data: {
            id: "msg_3",
            sessionID: session.id,
            type: "user",
            time: { created: 3 },
            payload: { text: "Hi" },
            delivery: "steer",
          },
        }
      return new Response(null, { status: 204 })
    })
    await client.session.create()
    await client.session.promptAsync({
      sessionID: session.id,
      messageID: "msg_3",
      agent: "build",
      model: { providerID: "provider", modelID: "model" },
      variant: "high",
      parts: [
        { type: "text", text: "Hi" },
        { type: "file", mime: "image/png", url: "data:image/png;base64,AQ==", filename: "image.png" },
        { type: "agent", name: "review" },
      ],
    })
    expect(calls.map((call) => call.url.pathname)).toEqual([
      "/api/session",
      "/api/session/ses_test",
      "/api/session/ses_test/agent",
      "/api/session/ses_test/model",
      "/api/session/ses_test/prompt",
    ])
    expect(calls[0].body.location).toEqual({ directory: "/workspace" })
    expect(calls[3].body.model).toEqual({ providerID: "provider", id: "model", variant: "high" })
    expect(calls[4].body).toMatchObject({
      id: "msg_3",
      text: "Hi",
      files: [{ uri: "data:image/png;base64,AQ==", name: "image.png" }],
      agents: [{ name: "review" }],
    })
    expect(calls.every((call) => call.headers.get("authorization") === "Bearer test-only")).toBe(true)
    expect(calls.every((call) => !call.url.search.includes("test-only"))).toBe(true)
  })

  test("follows opaque message cursors without order, including a preceding user for long turns", async () => {
    const { client, calls } = transport(({ url }) => {
      if (url.pathname.endsWith("/ses_test")) return { data: session }
      if (!url.searchParams.has("cursor")) return { data: [assistant], cursor: { next: "older" } }
      return { data: [user], cursor: { next: null } }
    })
    const messages = await client.session.messages({ sessionID: session.id, limit: 1 })
    expect(messages.data.map((item) => item.info.id)).toEqual(["msg_1", "msg_2"])
    expect(messages.data[1].info).toMatchObject({ role: "assistant", parentID: "msg_1" })
    expect(messages.cursor).toBeUndefined()
    const older = calls.find((call) => call.url.searchParams.has("cursor"))!
    expect(older.url.searchParams.get("cursor")).toBe("older")
    expect(older.url.searchParams.has("order")).toBe(false)
  })

  test("uses session-scoped permission and form replies, mapping option labels to native values", async () => {
    const { client, calls } = transport(({ url, method }) => {
      if (url.pathname.endsWith("/form/form_1") && method === "GET")
        return {
          data: {
            id: "form_1",
            sessionID: session.id,
            title: "Choose",
            fields: [{ key: "color", type: "string", options: [{ value: "blue", label: "Blue sky" }] }],
            state: { status: "pending" },
          },
        }
      return new Response(null, { status: 204 })
    })
    await client.permission.respond({ sessionID: session.id, permissionID: "perm_1", response: "once" })
    await client.question.reply({ sessionID: session.id, requestID: "form_1", answers: [["Blue sky"]] })
    expect(calls[0].url.pathname).toBe("/api/session/ses_test/permission/perm_1/reply")
    expect(calls[0].body).toEqual({ decision: "once" })
    expect(calls.at(-1)?.body).toEqual({ answer: { color: "blue" } })
  })

  test("OAuth polling is tied to its attempt ID and cancellation signal", async () => {
    const { client, calls } = transport(({ url, method }) => {
      if (url.pathname === "/api/provider")
        return {
          location: session.location,
          data: [{ id: "provider", name: "Provider", integrationID: "login", activation: "auto", package: "test" }],
        }
      if (url.pathname === "/api/integration")
        return {
          location: session.location,
          data: [
            {
              id: "login",
              name: "Login",
              connections: [],
              methods: [{ id: "oauth", type: "oauth", label: "Sign in" }],
            },
          ],
        }
      if (url.pathname.endsWith("/connect/oauth") && method === "POST")
        return {
          location: session.location,
          data: {
            attemptID: "attempt_1",
            url: "https://login.example",
            mode: "code",
            instructions: "Enter code",
            time: { created: 1, expires: 99999 },
          },
        }
      if (method === "GET")
        return { location: session.location, data: { status: "complete", time: { created: 1, expires: 99999 } } }
      return new Response(null, { status: 204 })
    })
    await client.provider.oauth.authorize({ providerID: "provider", method: 0 })
    await client.provider.oauth.callback({ providerID: "provider", code: "code_123" })
    expect(calls.find((call) => call.url.pathname.endsWith("/complete"))?.body).toEqual({ code: "code_123" })
    expect(calls.at(-1)?.url.pathname).toBe("/api/integration/login/connect/oauth/attempt_1")
  })

  test("converts streamed content and binary files without inventing completion or losing tool results", () => {
    const running = messageViews(session, [user, assistant])[1]
    expect(running.info.time).not.toHaveProperty("completed")
    expect(running.parts[0]).toMatchObject({ type: "text", text: "Checking", messageID: "msg_2" })
    expect(fileView(new Uint8Array([0, 1, 255]), "image.png")).toEqual({
      type: "binary",
      content: "AAH/",
      encoding: "base64",
      mimeType: "image/png",
    })
  })

  test("edits JSONC settings while preserving comments and unrelated provider values", () => {
    const original =
      '{\n  // keep this comment\n  "providers": { "existing": { "settings": { "baseURL": "https://example.com" } } },\n  "permissions": [{ "action": "shell", "resource": "git push *", "effect": "ask" }],\n}\n'
    const next = patchConfig(original, { providers: { new: { name: "New provider" } } })
    expect(next).toContain("// keep this comment")
    expect(parse(next)).toMatchObject({
      providers: { existing: { settings: { baseURL: "https://example.com" } }, new: { name: "New provider" } },
      permissions: [{ action: "shell", resource: "git push *", effect: "ask" }],
    })
    expect(() => patchConfig("broken", { shell: "/bin/zsh" })).toThrow()
    expect(
      globalConfigPath([
        { type: "document", path: "/config/opencode.jsonc", info: {} },
        { type: "directory", path: "/config" },
        { type: "document", path: "/project/opencode.json", info: {} },
      ]),
    ).toBe("/config/opencode.jsonc")
    expect(() => globalConfigPath([{ type: "document", path: "/project/opencode.json", info: {} }])).toThrow()
  })

  test("global settings exclude project overrides while directory configuration includes them", async () => {
    const { client } = transport(() => [
      {
        type: "document",
        path: "/config/opencode.json",
        info: { model: "provider/global", providers: { shared: { name: "Shared" } } },
      },
      { type: "directory", path: "/config" },
      {
        type: "document",
        path: "/workspace/opencode.json",
        info: { model: "provider/project", providers: { local: { name: "Local" } } },
      },
    ])
    const global = (await client.global.config.get()).data
    const directory = (await client.config.get()).data
    expect(global.model).toBe("provider/global")
    expect(global.providers).not.toHaveProperty("local")
    expect(directory.model).toBe("provider/project")
    expect(Object.keys(directory.providers ?? {})).toEqual(["shared", "local"])
  })
})
