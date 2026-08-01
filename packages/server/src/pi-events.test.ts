import { describe, expect, test } from "bun:test"
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent"
import { createPiEventContext, translatePiEvent } from "./pi-events"

const usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
}

function event(value: unknown) {
  return value as AgentSessionEvent
}

describe("translatePiEvent", () => {
  test("translates user and assistant message lifecycles with stable ordered identifiers", () => {
    const context = createPiEventContext("session-1")
    const user = { role: "user", content: "hello", timestamp: 10 }
    const assistant = {
      role: "assistant",
      content: [],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "claude-sonnet",
      usage,
      stopReason: "pending",
      timestamp: 20,
    }

    expect(translatePiEvent(context, event({ type: "message_start", message: user }))).toEqual([
      {
        type: "message",
        action: "created",
        message: {
          id: "session-1:message:1",
          sessionID: "session-1",
          role: "user",
          createdAt: 10,
          parts: [{ id: "session-1:message:1:text:0", type: "text", text: "hello" }],
        },
      },
    ])
    expect(translatePiEvent(context, event({ type: "message_end", message: user }))[0]).toMatchObject({
      type: "message",
      action: "updated",
      message: { id: "session-1:message:1" },
    })
    expect(translatePiEvent(context, event({ type: "message_start", message: assistant }))).toEqual([
      {
        type: "message",
        action: "created",
        message: {
          id: "session-1:message:2",
          sessionID: "session-1",
          role: "assistant",
          createdAt: 20,
          model: { providerID: "anthropic", modelID: "claude-sonnet" },
          parts: [],
        },
      },
    ])
    expect(translatePiEvent(context, event({ type: "message_end", message: assistant }))[0]).toMatchObject({
      type: "message",
      action: "updated",
      message: { id: "session-1:message:2" },
    })
  })

  test("creates text and thinking parts before their ordered deltas", () => {
    const context = createPiEventContext("session-1")
    const assistant = {
      role: "assistant",
      content: [],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "claude-sonnet",
      usage,
      stopReason: "pending",
      timestamp: 20,
    }
    translatePiEvent(context, event({ type: "message_start", message: assistant }))

    expect(
      translatePiEvent(context, event({
        type: "message_update",
        message: assistant,
        assistantMessageEvent: { type: "text_start", contentIndex: 0, partial: assistant },
      })),
    ).toEqual([
      {
        type: "part",
        action: "created",
        sessionID: "session-1",
        messageID: "session-1:message:1",
        part: { id: "session-1:message:1:text:0", type: "text", text: "" },
      },
    ])
    expect(
      translatePiEvent(context, event({
        type: "message_update",
        message: assistant,
        assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "Hi", partial: assistant },
      })),
    ).toEqual([
      {
        type: "delta",
        sessionID: "session-1",
        messageID: "session-1:message:1",
        partID: "session-1:message:1:text:0",
        field: "text",
        delta: "Hi",
      },
    ])
    expect(
      translatePiEvent(context, event({
        type: "message_update",
        message: assistant,
        assistantMessageEvent: { type: "thinking_start", contentIndex: 1, partial: assistant },
      })),
    ).toEqual([
      {
        type: "part",
        action: "created",
        sessionID: "session-1",
        messageID: "session-1:message:1",
        part: { id: "session-1:message:1:reasoning:1", type: "reasoning", text: "" },
      },
    ])
    expect(
      translatePiEvent(context, event({
        type: "message_update",
        message: assistant,
        assistantMessageEvent: { type: "thinking_delta", contentIndex: 1, delta: "Because", partial: assistant },
      })),
    ).toEqual([
      {
        type: "delta",
        sessionID: "session-1",
        messageID: "session-1:message:1",
        partID: "session-1:message:1:reasoning:1",
        field: "text",
        delta: "Because",
      },
    ])
  })

  test("correlates tool start, update, and completion to the active assistant message", () => {
    const context = createPiEventContext("session-1")
    const assistant = {
      role: "assistant",
      content: [],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "claude-sonnet",
      usage,
      stopReason: "pending",
      timestamp: 20,
    }
    translatePiEvent(context, event({ type: "message_start", message: assistant }))

    const start = translatePiEvent(context, event({
      type: "tool_execution_start",
      toolCallId: "call-1",
      toolName: "bash",
      args: { command: "pwd" },
    }))
    const update = translatePiEvent(context, event({
      type: "tool_execution_update",
      toolCallId: "call-1",
      toolName: "bash",
      args: { command: "pwd" },
      partialResult: { output: "/work" },
    }))
    const end = translatePiEvent(context, event({
      type: "tool_execution_end",
      toolCallId: "call-1",
      toolName: "bash",
      result: { output: "/workspace" },
      isError: false,
    }))

    expect(start).toEqual([{
      type: "part",
      action: "created",
      sessionID: "session-1",
      messageID: "session-1:message:1",
      part: {
        id: "session-1:tool:call-1",
        type: "tool",
        name: "bash",
        callID: "call-1",
        state: "running",
        input: { command: "pwd" },
      },
    }])
    expect(update[0]).toMatchObject({
      type: "part",
      action: "updated",
      part: { id: "session-1:tool:call-1", state: "running", output: { output: "/work" } },
    })
    expect(end[0]).toMatchObject({
      type: "part",
      action: "updated",
      part: { id: "session-1:tool:call-1", state: "completed", output: { output: "/workspace" } },
    })
  })

  test("translates busy, idle, and terminal assistant errors without sharing run state", () => {
    const first = createPiEventContext("session-1")
    const second = createPiEventContext("session-2")
    const failed = {
      role: "assistant",
      content: [],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "claude-sonnet",
      usage,
      stopReason: "error",
      errorMessage: "provider unavailable",
      timestamp: 20,
    }

    expect(translatePiEvent(first, event({ type: "agent_start" }))).toEqual([
      { type: "status", sessionID: "session-1", status: "busy" },
    ])
    expect(translatePiEvent(second, event({ type: "agent_start" }))).toEqual([
      { type: "status", sessionID: "session-2", status: "busy" },
    ])
    translatePiEvent(first, event({ type: "message_start", message: failed }))
    expect(translatePiEvent(first, event({ type: "message_end", message: failed }))).toEqual([
      expect.objectContaining({ type: "message", action: "updated" }),
      { type: "error", sessionID: "session-1", message: "provider unavailable" },
    ])
    expect(translatePiEvent(first, event({ type: "agent_settled" }))).toEqual([
      { type: "status", sessionID: "session-1", status: "idle" },
    ])
  })
})
