import { describe, expect, test } from "bun:test"
import {
  createOpenCodeEventMapper,
  toOpenCodeAgents,
  toOpenCodeMessages,
  toOpenCodeProject,
  toOpenCodeProviderList,
  toOpenCodeSession,
} from "./opencode-compat"
import type { RuntimeMessage, RuntimeModel, RuntimeSession } from "./protocol"

const directory = "/workspace/ikanban"
const models: RuntimeModel[] = [
  { id: "claude-sonnet-4", providerID: "anthropic", name: "Claude Sonnet 4" },
  { id: "gpt-5", providerID: "openai", name: "GPT-5" },
]

describe("OpenCode provider and agent compatibility", () => {
  test("groups actual Pi models into usable providers", () => {
    expect(toOpenCodeProviderList(models)).toEqual({
      all: [
        {
          id: "anthropic",
          name: "anthropic",
          source: "custom",
          env: [],
          options: {},
          models: {
            "claude-sonnet-4": {
              id: "claude-sonnet-4",
              providerID: "anthropic",
              api: { id: "claude-sonnet-4", url: "", npm: "" },
              name: "Claude Sonnet 4",
              capabilities: {
                temperature: false,
                reasoning: false,
                attachment: false,
                toolcall: true,
                input: { text: true, audio: false, image: false, video: false, pdf: false },
                output: { text: true, audio: false, image: false, video: false, pdf: false },
                interleaved: false,
              },
              cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
              limit: { context: 0, output: 0 },
              status: "active",
              options: {},
              headers: {},
              release_date: "",
              variants: {},
            },
          },
        },
        {
          id: "openai",
          name: "openai",
          source: "custom",
          env: [],
          options: {},
          models: {
            "gpt-5": expect.objectContaining({ id: "gpt-5", providerID: "openai", name: "GPT-5" }),
          },
        },
      ],
      connected: ["anthropic", "openai"],
      default: { anthropic: "claude-sonnet-4", openai: "gpt-5" },
    })
  })

  test("exposes one usable build agent with a real model reference", () => {
    expect(toOpenCodeAgents(models)).toEqual([
      {
        name: "build",
        description: "Build with Pi",
        mode: "primary",
        native: true,
        hidden: false,
        permission: [],
        model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
        options: {},
      },
    ])
  })
})

test("maps projects and sessions to the installed SDK shapes", () => {
  expect(toOpenCodeProject({ id: "project-1", name: "iKanban", directory })).toEqual({
    id: "project-1",
    name: "iKanban",
    worktree: directory,
    time: { created: 0, updated: 0 },
    sandboxes: [],
  })

  const session: RuntimeSession = {
    id: "session-1",
    directory,
    title: "Compatibility",
    createdAt: 10,
    updatedAt: 20,
  }
  expect(toOpenCodeSession(session)).toEqual({
    id: "session-1",
    slug: "session-1",
    projectID: directory,
    directory,
    title: "Compatibility",
    version: "pi",
    time: { created: 10, updated: 20 },
  })
})

test("maps user and assistant messages with text, reasoning, and tool parts", () => {
  const messages: RuntimeMessage[] = [
    {
      id: "message-user",
      sessionID: "session-1",
      role: "user",
      createdAt: 30,
      model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
      parts: [{ id: "part-text", type: "text", text: "hello" }],
    },
    {
      id: "message-assistant",
      sessionID: "session-1",
      role: "assistant",
      createdAt: 40,
      model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
      parts: [
        { id: "part-reasoning", type: "reasoning", text: "thinking" },
        {
          id: "part-tool",
          type: "tool",
          name: "bash",
          callID: "call-1",
          state: "completed",
          input: { command: "pwd" },
          output: directory,
        },
      ],
    },
  ]

  expect(toOpenCodeMessages(messages, directory)).toEqual([
    {
      info: {
        id: "message-user",
        sessionID: "session-1",
        role: "user",
        time: { created: 30 },
        agent: "build",
        model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
      },
      parts: [
        { id: "part-text", sessionID: "session-1", messageID: "message-user", type: "text", text: "hello" },
      ],
    },
    {
      info: {
        id: "message-assistant",
        sessionID: "session-1",
        role: "assistant",
        time: { created: 40 },
        parentID: "message-user",
        modelID: "claude-sonnet-4",
        providerID: "anthropic",
        mode: "build",
        agent: "build",
        path: { cwd: directory, root: directory },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      },
      parts: [
        {
          id: "part-reasoning",
          sessionID: "session-1",
          messageID: "message-assistant",
          type: "reasoning",
          text: "thinking",
          time: { start: 40 },
        },
        {
          id: "part-tool",
          sessionID: "session-1",
          messageID: "message-assistant",
          type: "tool",
          callID: "call-1",
          tool: "bash",
          state: {
            status: "completed",
            input: { command: "pwd" },
            output: directory,
            title: "bash",
            metadata: {},
            time: { start: 40, end: 40 },
          },
        },
      ],
    },
  ])
})

test("maps runtime events to global SDK envelopes and correlates assistant parents", () => {
  const map = createOpenCodeEventMapper()
  const user: RuntimeMessage = {
    id: "message-user",
    sessionID: "session-1",
    role: "user",
    createdAt: 30,
    model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
    parts: [],
  }
  const assistant: RuntimeMessage = {
    id: "message-assistant",
    sessionID: "session-1",
    role: "assistant",
    createdAt: 40,
    model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
    parts: [],
  }

  expect(map(directory, { type: "message", action: "created", message: user })).toEqual({
    directory,
    payload: {
      id: "pi-event-1",
      type: "message.updated",
      properties: { sessionID: "session-1", info: expect.objectContaining({ id: "message-user", role: "user" }) },
    },
  })
  expect(map(directory, { type: "message", action: "updated", message: assistant })).toEqual({
    directory,
    payload: {
      id: "pi-event-2",
      type: "message.updated",
      properties: {
        sessionID: "session-1",
        info: expect.objectContaining({ id: "message-assistant", role: "assistant", parentID: "message-user" }),
      },
    },
  })
  expect(map(directory, { type: "status", sessionID: "session-1", status: "busy" })).toEqual({
    directory,
    payload: {
      id: "pi-event-3",
      type: "session.status",
      properties: { sessionID: "session-1", status: { type: "busy" } },
    },
  })
  expect(
    map(directory, {
      type: "part",
      action: "updated",
      sessionID: "session-1",
      messageID: "message-assistant",
      part: { id: "part-text", type: "text", text: "hello" },
    }),
  ).toEqual({
    directory,
    payload: {
      id: "pi-event-4",
      type: "message.part.updated",
      properties: {
        sessionID: "session-1",
        part: {
          id: "part-text",
          sessionID: "session-1",
          messageID: "message-assistant",
          type: "text",
          text: "hello",
        },
        time: expect.any(Number),
      },
    },
  })
  expect(
    map(directory, {
      type: "delta",
      sessionID: "session-1",
      messageID: "message-assistant",
      partID: "part-text",
      field: "text",
      delta: "!",
    }),
  ).toEqual({
    directory,
    payload: {
      id: "pi-event-5",
      type: "message.part.delta",
      properties: {
        sessionID: "session-1",
        messageID: "message-assistant",
        partID: "part-text",
        field: "text",
        delta: "!",
      },
    },
  })
})

test("maps session lifecycle events", () => {
  const map = createOpenCodeEventMapper()
  const session: RuntimeSession = {
    id: "session-1",
    directory,
    title: "Compatibility",
    createdAt: 10,
    updatedAt: 20,
  }

  expect(map(directory, { type: "session", action: "created", session })).toEqual({
    directory,
    payload: {
      id: "pi-event-1",
      type: "session.created",
      properties: { sessionID: "session-1", info: toOpenCodeSession(session) },
    },
  })
  expect(map(directory, { type: "session", action: "updated", session })).toEqual({
    directory,
    payload: {
      id: "pi-event-2",
      type: "session.updated",
      properties: { sessionID: "session-1", info: toOpenCodeSession(session) },
    },
  })
})
