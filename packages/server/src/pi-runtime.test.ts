import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent"
import { createOpenCodeEventMapper } from "./opencode-compat"
import { PiRuntime, type PiSession, type PiSessionFactory, type PiSessionInfo } from "./pi-runtime"
import type { RuntimeEvent } from "./protocol"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function workspace() {
  const root = await mkdtemp(join(tmpdir(), "ikanban-pi-runtime-"))
  temporaryDirectories.push(root)
  const first = join(root, "first")
  const second = join(root, "second")
  await Promise.all([mkdir(first), mkdir(second)])
  return { root: await realpath(root), first: await realpath(first), second: await realpath(second) }
}

function piEvent(value: unknown) {
  return value as AgentSessionEvent
}

class FakeSession implements PiSession {
  readonly listeners = new Set<(event: AgentSessionEvent) => void>()
  readonly selectedModels: unknown[] = []
  readonly prompts: string[] = []
  abortCount = 0
  disposeCount = 0
  promptResult: Promise<void> = Promise.resolve()

  constructor(
    readonly id: string,
    readonly path: string,
    readonly directory: string,
    readonly messages: readonly unknown[] = [],
  ) {}

  subscribe(listener: (event: AgentSessionEvent) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async setModel(model: unknown) {
    this.selectedModels.push(model)
  }

  prompt(text: string) {
    this.prompts.push(text)
    return this.promptResult
  }

  async abort() {
    this.abortCount++
  }

  dispose() {
    this.disposeCount++
  }

  emit(event: AgentSessionEvent) {
    for (const listener of this.listeners) listener(event)
  }
}

class FakeFactory implements PiSessionFactory {
  readonly infos = new Map<string, PiSessionInfo[]>()
  readonly sessionsByPath = new Map<string, FakeSession>()
  readonly creates: string[] = []
  readonly opens: string[] = []
  readonly model = { provider: "anthropic", id: "sonnet" }
  nextID = 1

  async list(directory: string) {
    return this.infos.get(directory) ?? []
  }

  async create(directory: string) {
    this.creates.push(directory)
    const id = `session-${this.nextID++}`
    return this.add(directory, id)
  }

  async open(path: string) {
    this.opens.push(path)
    const session = this.sessionsByPath.get(path)
    if (!session) throw new Error(`Unknown saved session: ${path}`)
    return session
  }

  async listModels() {
    return [{ id: "sonnet", providerID: "anthropic", name: "Sonnet" }]
  }

  getModel(providerID: string, modelID: string) {
    return providerID === "anthropic" && modelID === "sonnet" ? this.model : undefined
  }

  add(directory: string, id: string, title = "Saved session", messages: readonly unknown[] = []) {
    const path = join(directory, `${id}.jsonl`)
    const session = new FakeSession(id, path, directory, messages)
    this.sessionsByPath.set(path, session)
    const info = { id, path, directory, title, createdAt: 10, updatedAt: 20 }
    this.infos.set(directory, [...(this.infos.get(directory) ?? []), info])
    return session
  }
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (predicate()) return
    await Bun.sleep(1)
  }
  throw new Error("Timed out waiting for runtime work")
}

describe("PiRuntime lifecycle", () => {
  test("creates a persistent session lazily and indexes it for list and get", async () => {
    const { root, first } = await workspace()
    const factory = new FakeFactory()
    const runtime = new PiRuntime({ roots: [root], sessionFactory: factory })
    const events: RuntimeEvent[] = []
    runtime.event(first, (event) => events.push(event))

    const created = await runtime.session.create(first, { title: "New work" })

    expect(factory.creates).toEqual([first])
    expect(created).toMatchObject({ id: "session-1", directory: first, title: "New work" })
    expect(await runtime.session.list(first)).toContainEqual(created)
    expect(await runtime.session.get(first, created.id)).toEqual(created)
    expect(events).toEqual([{ type: "session", action: "created", session: created }])
    expect(factory.sessionsByPath.get(join(first, "session-1.jsonl"))?.listeners.size).toBe(1)
  })

  test("reopens an indexed saved session once and keeps same public IDs isolated by directory", async () => {
    const { root, first, second } = await workspace()
    const factory = new FakeFactory()
    const firstSaved = factory.add(first, "shared")
    const secondSaved = factory.add(second, "shared")
    const runtime = new PiRuntime({ roots: [root], sessionFactory: factory })

    await Promise.all([runtime.session.list(first), runtime.session.list(second)])
    await runtime.prompt(first, "shared", { parts: [{ type: "text", text: "first prompt" }] })
    await runtime.prompt(second, "shared", { parts: [{ type: "text", text: "second prompt" }] })
    await runtime.prompt(first, "shared", { parts: [{ type: "text", text: "again" }] })
    await waitFor(() => firstSaved.prompts.length === 2 && secondSaved.prompts.length === 1)

    expect(factory.opens.toSorted()).toEqual([
      join(first, "shared.jsonl"),
      join(second, "shared.jsonl"),
    ].toSorted())
    expect(firstSaved.prompts).toEqual(["first prompt", "again"])
    expect(secondSaved.prompts).toEqual(["second prompt"])
  })

  test("preserves queued prompt IDs through Pi user events and assistant compatibility parents", async () => {
    const { root, first } = await workspace()
    const factory = new FakeFactory()
    const session = factory.add(first, "saved")
    const runtime = new PiRuntime({ roots: [root], sessionFactory: factory })
    const mapEvent = createOpenCodeEventMapper()
    const envelopes: ReturnType<typeof mapEvent>[] = []
    runtime.event(first, (event) => envelopes.push(mapEvent(first, event)))
    await runtime.session.list(first)

    await Promise.all([
      runtime.prompt(first, "saved", { messageID: "client-message-1", parts: [{ type: "text", text: "one" }] }),
      runtime.prompt(first, "saved", { messageID: "client-message-2", parts: [{ type: "text", text: "two" }] }),
    ])
    await waitFor(() => session.prompts.length === 2)

    for (const [index, text] of ["one", "two"].entries()) {
      session.emit(piEvent({
        type: "message_start",
        message: { role: "user", content: text, timestamp: 10 + index * 10 },
      }))
      session.emit(piEvent({
        type: "message_start",
        message: {
          role: "assistant",
          content: [],
          provider: "anthropic",
          model: "sonnet",
          timestamp: 11 + index * 10,
        },
      }))
    }

    expect(envelopes.map((envelope) => envelope.payload)).toEqual([
      expect.objectContaining({
        type: "message.updated",
        properties: expect.objectContaining({
          info: expect.objectContaining({ id: "client-message-1", role: "user" }),
        }),
      }),
      expect.objectContaining({
        type: "message.updated",
        properties: expect.objectContaining({
          info: expect.objectContaining({ role: "assistant", parentID: "client-message-1" }),
        }),
      }),
      expect.objectContaining({
        type: "message.updated",
        properties: expect.objectContaining({
          info: expect.objectContaining({ id: "client-message-2", role: "user" }),
        }),
      }),
      expect.objectContaining({
        type: "message.updated",
        properties: expect.objectContaining({
          info: expect.objectContaining({ role: "assistant", parentID: "client-message-2" }),
        }),
      }),
    ])
  })

  test("keeps persisted and streamed message IDs contiguous across Pi tool results", async () => {
    const { root, first } = await workspace()
    const factory = new FakeFactory()
    const session = factory.add(first, "saved", "Saved session", [
      { role: "user", content: "one", timestamp: 1 },
      {
        role: "assistant",
        content: [],
        provider: "anthropic",
        model: "sonnet",
        timestamp: 2,
      },
      { role: "toolResult", toolCallId: "call-1", content: [], timestamp: 3 },
      { role: "user", content: "two", timestamp: 4 },
    ])
    const runtime = new PiRuntime({ roots: [root], sessionFactory: factory })
    const events: RuntimeEvent[] = []
    runtime.event(first, (event) => events.push(event))
    await runtime.session.list(first)

    expect((await runtime.session.messages(first, "saved")).map((message) => message.id)).toEqual([
      "saved:message:1",
      "saved:message:2",
      "saved:message:3",
    ])
    session.emit(piEvent({
      type: "message_start",
      message: {
        role: "assistant",
        content: [],
        provider: "anthropic",
        model: "sonnet",
        timestamp: 5,
      },
    }))
    expect(events[0]).toMatchObject({ message: { id: "saved:message:4" } })
  })

  test("resolves roots and project symlinks before authorizing directories", async () => {
    const { root, first } = await workspace()
    const outside = await mkdtemp(join(tmpdir(), "ikanban-pi-outside-"))
    temporaryDirectories.push(outside)
    const alias = join(root, "first-alias")
    const escape = join(root, "escape")
    await Promise.all([symlink(first, alias), symlink(outside, escape)])
    const factory = new FakeFactory()
    const runtime = new PiRuntime({ roots: [join(root, ".")], sessionFactory: factory })

    const created = await runtime.session.create(alias)
    expect(created.directory).toBe(first)
    expect(factory.creates).toEqual([first])
    await expect(runtime.session.create(escape)).rejects.toThrow("outside configured roots")
    await expect(runtime.session.create(join(root, "missing"))).rejects.toThrow()
  })

  test("selects the requested model and returns before prompt completion while emitting failures", async () => {
    const { root, first } = await workspace()
    const factory = new FakeFactory()
    const session = factory.add(first, "saved")
    let rejectPrompt!: (error: Error) => void
    session.promptResult = new Promise((_, reject) => { rejectPrompt = reject })
    const runtime = new PiRuntime({ roots: [root], sessionFactory: factory })
    const events: RuntimeEvent[] = []
    runtime.event(undefined, (event) => events.push(event))
    await runtime.session.list(first)

    await runtime.prompt(first, "saved", {
      model: { providerID: "anthropic", modelID: "sonnet" },
      parts: [{ type: "text", text: "ship" }, { type: "text", text: "it" }],
    })
    await waitFor(() => session.prompts.length === 1)

    expect(session.selectedModels).toEqual([factory.model])
    expect(session.prompts).toEqual(["ship\nit"])
    rejectPrompt(new Error("agent failed"))
    await waitFor(() => events.some((event) => event.type === "error"))
    expect(events).toContainEqual({ type: "error", sessionID: "saved", message: "agent failed" })
  })

  test("fans out translated events, aborts, and unsubscribes and disposes on shutdown", async () => {
    const { root, first, second } = await workspace()
    const factory = new FakeFactory()
    const session = factory.add(first, "saved")
    const runtime = new PiRuntime({ roots: [root], sessionFactory: factory })
    const globalEvents: RuntimeEvent[] = []
    const projectEvents: RuntimeEvent[] = []
    const otherEvents: RuntimeEvent[] = []
    runtime.event(undefined, (event) => globalEvents.push(event))
    runtime.event(first, (event) => projectEvents.push(event))
    runtime.event(second, (event) => otherEvents.push(event))
    await runtime.session.list(first)
    await runtime.abort(first, "saved")

    session.emit(piEvent({ type: "agent_start" }))
    expect(session.abortCount).toBe(1)
    expect(globalEvents).toEqual([{ type: "status", sessionID: "saved", status: "busy" }])
    expect(projectEvents).toEqual(globalEvents)
    expect(otherEvents).toEqual([])

    await runtime.dispose()
    expect(session.listeners.size).toBe(0)
    expect(session.disposeCount).toBe(1)
  })
})
