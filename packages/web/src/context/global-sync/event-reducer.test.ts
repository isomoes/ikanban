import { describe, expect, test } from "bun:test"
import type {
  Project,
  SessionInfo as Session,
  SessionMessageInfo as Message,
  V2Event,
} from "@opencode-ai/client"
import { createStore } from "solid-js/store"
import type { State } from "./types"
import { applyDirectoryEvent, applyGlobalEvent } from "./event-reducer"

const rootSession = (input: { id: string; parentID?: string }) =>
  ({
    id: input.id,
    parentID: input.parentID,
    time: { created: 1, updated: 1 },
  }) as Session

const userMessage = (id: string, _sessionID: string) =>
  ({
    id,
    type: "user",
    time: { created: 1 },
    text: "",
  }) as Message

const event = (value: Record<string, unknown>) =>
  ({ id: "evt_1", created: 10, location: { directory: "/tmp" }, ...value }) as V2Event

const baseState = (input: Partial<State> = {}) =>
  ({
    status: "complete",
    agent: [],
    command: [],
    project: "",
    projectMeta: undefined,
    icon: undefined,
    provider: {} as State["provider"],
    config: {} as State["config"],
    path: { directory: "/tmp" } as State["path"],
    session: [],
    sessionTotal: 0,
    session_status: {},
    session_diff: {},
    project_diff: {},
    todo: {},
    permission: {},
    question: {},
    mcp: {},
    lsp: [],
    vcs: undefined,
    limit: 10,
    message: {},
    ...input,
  }) as State

const apply = (state: Partial<State>, current: V2Event) => {
  const [store, setStore] = createStore(baseState(state))
  applyDirectoryEvent({ event: current, store, setStore, push() {}, directory: "/tmp" })
  return store
}

describe("applyGlobalEvent", () => {
  test("refreshes authoritative global state for connection and project-directory events", () => {
    let refreshCount = 0
    const input = {
      project: [] as Project[],
      refresh: () => refreshCount++,
      setGlobalProject() {},
    }

    applyGlobalEvent({ ...input, event: event({ type: "server.connected", data: {} }) })
    applyGlobalEvent({
      ...input,
      event: event({ type: "project.directories.updated", data: { projectID: "prj_1" } }),
    })

    expect(refreshCount).toBe(2)
  })
})

describe("applyDirectoryEvent", () => {
  test("creates, renames, and deletes native sessions while preserving root totals", () => {
    const [store, setStore] = createStore(
      baseState({ session: [rootSession({ id: "ses_2", parentID: "ses_1" })], sessionTotal: 0 }),
    )
    const run = (current: V2Event) =>
      applyDirectoryEvent({ event: current, store, setStore, push() {}, directory: "/tmp" })

    run(
      event({
        type: "session.created",
        durable: { aggregateID: "ses_1", seq: 1, version: 1 },
        data: {
          sessionID: "ses_1",
          projectID: "prj_1",
          location: { directory: "/tmp" },
          slug: "session",
          version: "2",
        },
      }),
    )
    run(
      event({
        type: "session.renamed",
        durable: { aggregateID: "ses_1", seq: 2, version: 1 },
        data: { sessionID: "ses_1", title: "Renamed" },
      }),
    )

    expect(store.session.map((item) => item.id)).toEqual(["ses_1", "ses_2"])
    expect(store.session[0]?.title).toBe("Renamed")
    expect(store.sessionTotal).toBe(1)

    run(
      event({
        type: "session.deleted",
        durable: { aggregateID: "ses_2", seq: 1, version: 2 },
        data: { sessionID: "ses_2" },
      }),
    )
    expect(store.sessionTotal).toBe(1)

    run(
      event({
        type: "session.deleted",
        durable: { aggregateID: "ses_1", seq: 3, version: 2 },
        data: { sessionID: "ses_1" },
      }),
    )
    expect(store.sessionTotal).toBe(0)
  })

  test("updates native session status and schedules an authoritative refresh when idle", () => {
    const pushes: string[] = []
    const [store, setStore] = createStore(baseState())
    applyDirectoryEvent({
      event: event({ type: "session.status", data: { sessionID: "ses_1", status: { type: "idle" } } }),
      store,
      setStore,
      push: (directory) => pushes.push(directory),
      directory: "/tmp",
    })

    expect(store.session_status.ses_1).toEqual({ type: "idle" })
    expect(pushes).toEqual(["/tmp"])
  })

  test("builds assistant content from native step and text events", () => {
    const [store, setStore] = createStore(
      baseState({ message: { ses_1: [userMessage("msg_1", "ses_1")] } }),
    )
    const run = (current: V2Event) =>
      applyDirectoryEvent({ event: current, store, setStore, push() {}, directory: "/tmp" })

    run(
      event({
        type: "session.step.started",
        durable: { aggregateID: "ses_1", seq: 1, version: 1 },
        data: {
          sessionID: "ses_1",
          assistantMessageID: "msg_2",
          agent: "build",
          model: { providerID: "openai", id: "gpt" },
        },
      }),
    )
    run(
      event({
        type: "session.text.started",
        durable: { aggregateID: "ses_1", seq: 2, version: 1 },
        data: { sessionID: "ses_1", assistantMessageID: "msg_2", ordinal: 0 },
      }),
    )
    run(
      event({
        type: "session.text.delta",
        data: { sessionID: "ses_1", assistantMessageID: "msg_2", ordinal: 0, delta: "hello" },
      }),
    )
    run(
      event({
        type: "session.text.ended",
        durable: { aggregateID: "ses_1", seq: 3, version: 1 },
        data: { sessionID: "ses_1", assistantMessageID: "msg_2", ordinal: 0, text: "hello world" },
      }),
    )

    expect(store.message.ses_1?.map((item) => item.id)).toEqual(["msg_1", "msg_2"])
    expect(store.message.ses_1?.[1]).toMatchObject({
      type: "assistant",
      agent: "build",
      content: [{ type: "text", text: "hello world" }],
    })
  })

  test("updates native tool content through the input, call, and completion lifecycle", () => {
    const [store, setStore] = createStore(baseState())
    const run = (current: V2Event) =>
      applyDirectoryEvent({ event: current, store, setStore, push() {}, directory: "/tmp" })

    run(
      event({
        type: "session.step.started",
        durable: { aggregateID: "ses_1", seq: 0, version: 1 },
        data: {
          sessionID: "ses_1",
          assistantMessageID: "msg_1",
          agent: "build",
          model: { id: "gpt", providerID: "openai" },
        },
      }),
    )
    run(
      event({
        type: "session.tool.input.started",
        durable: { aggregateID: "ses_1", seq: 1, version: 1 },
        data: { sessionID: "ses_1", assistantMessageID: "msg_1", id: "call_1", name: "shell" },
      }),
    )
    run(
      event({
        type: "session.tool.input.delta",
        data: { sessionID: "ses_1", assistantMessageID: "msg_1", id: "call_1", delta: '{"command":"pwd"}' },
      }),
    )
    expect(store.message.ses_1?.[0]).toMatchObject({
      content: [{ type: "tool", id: "call_1", state: { status: "streaming", input: '{"command":"pwd"}' } }],
    })

    run(
      event({
        type: "session.tool.called",
        durable: { aggregateID: "ses_1", seq: 2, version: 1 },
        data: {
          sessionID: "ses_1",
          assistantMessageID: "msg_1",
          id: "call_1",
          input: { command: "pwd" },
          executed: true,
        },
      }),
    )
    run(
      event({
        type: "session.tool.success",
        durable: { aggregateID: "ses_1", seq: 3, version: 2 },
        data: {
          sessionID: "ses_1",
          assistantMessageID: "msg_1",
          id: "call_1",
          content: [{ type: "text", text: "/tmp" }],
          executed: true,
        },
      }),
    )

    expect(store.message.ses_1?.find((message) => message.id === "msg_1")).toMatchObject({
      type: "assistant",
      content: [{ type: "tool", id: "call_1", state: { status: "completed", content: [{ type: "text", text: "/tmp" }] } }],
    })
  })

  test("tracks native permission and question request lifecycles", () => {
    const [store, setStore] = createStore(baseState())
    const run = (current: V2Event) =>
      applyDirectoryEvent({ event: current, store, setStore, push() {}, directory: "/tmp" })

    run(
      event({
        type: "permission.asked",
        data: { id: "perm_1", sessionID: "ses_1", action: "shell", resources: ["git status"] },
      }),
    )
    expect(store.permission.ses_1?.[0]).toMatchObject({
      id: "perm_1",
      action: "shell",
      resources: ["git status"],
    })

    run(event({ type: "permission.replied", data: { sessionID: "ses_1", requestID: "perm_1", reply: "once" } }))
    expect(store.permission.ses_1).toEqual([])

    run(
      event({
        type: "question.asked",
        data: {
          id: "q_1",
          sessionID: "ses_1",
          questions: [{ question: "Continue?", header: "Continue", options: [] }],
        },
      }),
    )
    expect(store.question.ses_1?.[0]?.id).toBe("q_1")

    run(event({ type: "question.rejected", data: { sessionID: "ses_1", requestID: "q_1" } }))
    expect(store.question.ses_1).toEqual([])
  })

  test("updates the VCS branch from native data", () => {
    const store = apply({}, event({ type: "vcs.branch.updated", data: { branch: "feature/test" } }))
    expect(store.vcs).toEqual({ branch: { current: "feature/test" } })
  })

  test("cleans native messages when a session is deleted", () => {
    const message = userMessage("msg_1", "ses_1")
    const store = apply(
      {
        session: [rootSession({ id: "ses_1" })],
        sessionTotal: 1,
        message: { ses_1: [message] },
      },
      event({
        type: "session.deleted",
        durable: { aggregateID: "ses_1", seq: 1, version: 2 },
        data: { sessionID: "ses_1" },
      }),
    )

    expect(store.message.ses_1).toBeUndefined()
  })
})
