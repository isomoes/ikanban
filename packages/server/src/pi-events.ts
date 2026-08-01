import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent"
import type { RuntimeEvent, RuntimeMessage, RuntimePart } from "./protocol"

type PiMessage = Extract<AgentSessionEvent, { type: "message_start" }>["message"]

export type PiEventContext = {
  sessionID: string
  nextMessage: number
  pendingUserMessageIDs: string[]
  messageIDs: WeakMap<object, string>
  activeAssistantID?: string
  tools: Map<string, { messageID: string; name: string; input: unknown }>
}

export function createPiEventContext(sessionID: string): PiEventContext {
  return {
    sessionID,
    nextMessage: 1,
    pendingUserMessageIDs: [],
    messageIDs: new WeakMap(),
    tools: new Map(),
  }
}

function messageID(context: PiEventContext, message: PiMessage) {
  const key = message as object
  let id = context.messageIDs.get(key)
  if (!id) {
    const generated = `${context.sessionID}:message:${context.nextMessage++}`
    id = message.role === "user" ? context.pendingUserMessageIDs.shift() ?? generated : generated
    context.messageIDs.set(key, id)
  }
  return id
}

export function queuePiUserMessageID(context: PiEventContext, messageID: string) {
  context.pendingUserMessageIDs.push(messageID)
}

function messageParts(sessionID: string, id: string, message: PiMessage): RuntimePart[] {
  if (!("role" in message)) return []
  if (message.role === "user") {
    const content = typeof message.content === "string"
      ? [{ type: "text" as const, text: message.content }]
      : message.content
    return content.flatMap((part, index) =>
      part.type === "text"
        ? [{ id: `${id}:text:${index}`, type: "text" as const, text: part.text }]
        : [],
    )
  }
  if (message.role !== "assistant") return []
  return message.content.map((part, index): RuntimePart => {
    if (part.type === "text") return { id: `${id}:text:${index}`, type: "text", text: part.text }
    if (part.type === "thinking") {
      return { id: `${id}:reasoning:${index}`, type: "reasoning", text: part.thinking }
    }
    return {
      id: `${sessionID}:tool:${part.id}`,
      type: "tool",
      name: part.name,
      callID: part.id,
      state: "pending",
      input: part.arguments,
    }
  })
}

function runtimeMessage(context: PiEventContext, message: PiMessage): RuntimeMessage | undefined {
  if (!("role" in message) || (message.role !== "user" && message.role !== "assistant")) return
  const id = messageID(context, message)
  return {
    id,
    sessionID: context.sessionID,
    role: message.role,
    createdAt: message.timestamp,
    ...(message.role === "assistant"
      ? { model: { providerID: message.provider, modelID: message.model } }
      : {}),
    parts: messageParts(context.sessionID, id, message),
  }
}

function activeAssistant(context: PiEventContext) {
  return context.activeAssistantID
}

export function translatePiEvent(context: PiEventContext, event: AgentSessionEvent): RuntimeEvent[] {
  if (event.type === "agent_start") {
    return [{ type: "status", sessionID: context.sessionID, status: "busy" }]
  }
  if (event.type === "agent_settled") {
    return [{ type: "status", sessionID: context.sessionID, status: "idle" }]
  }
  if (event.type === "message_start" || event.type === "message_end") {
    const message = runtimeMessage(context, event.message)
    if (!message) return []
    if (message.role === "assistant") context.activeAssistantID = message.id
    const events: RuntimeEvent[] = [{
      type: "message",
      action: event.type === "message_start" ? "created" : "updated",
      message,
    }]
    if (
      event.type === "message_end" &&
      event.message.role === "assistant" &&
      event.message.errorMessage
    ) {
      events.push({ type: "error", sessionID: context.sessionID, message: event.message.errorMessage })
    }
    return events
  }
  if (event.type === "message_update") {
    const message = runtimeMessage(context, event.message)
    if (!message || message.role !== "assistant") return []
    context.activeAssistantID = message.id
    const update = event.assistantMessageEvent
    if (update.type === "text_start" || update.type === "thinking_start") {
      const reasoning = update.type === "thinking_start"
      return [{
        type: "part",
        action: "created",
        sessionID: context.sessionID,
        messageID: message.id,
        part: {
          id: `${message.id}:${reasoning ? "reasoning" : "text"}:${update.contentIndex}`,
          type: reasoning ? "reasoning" : "text",
          text: "",
        },
      }]
    }
    if (update.type === "text_delta" || update.type === "thinking_delta") {
      return [{
        type: "delta",
        sessionID: context.sessionID,
        messageID: message.id,
        partID: `${message.id}:${update.type === "thinking_delta" ? "reasoning" : "text"}:${update.contentIndex}`,
        field: "text",
        delta: update.delta,
      }]
    }
    if (update.type === "text_end" || update.type === "thinking_end") {
      const reasoning = update.type === "thinking_end"
      return [{
        type: "part",
        action: "updated",
        sessionID: context.sessionID,
        messageID: message.id,
        part: {
          id: `${message.id}:${reasoning ? "reasoning" : "text"}:${update.contentIndex}`,
          type: reasoning ? "reasoning" : "text",
          text: update.content,
        },
      }]
    }
    return []
  }
  if (event.type === "tool_execution_start") {
    const messageID = activeAssistant(context)
    if (!messageID) return []
    context.tools.set(event.toolCallId, { messageID, name: event.toolName, input: event.args })
    return [{
      type: "part",
      action: "created",
      sessionID: context.sessionID,
      messageID,
      part: {
        id: `${context.sessionID}:tool:${event.toolCallId}`,
        type: "tool",
        name: event.toolName,
        callID: event.toolCallId,
        state: "running",
        input: event.args,
      },
    }]
  }
  if (event.type === "tool_execution_update" || event.type === "tool_execution_end") {
    const tool = context.tools.get(event.toolCallId)
    if (!tool) return []
    const isEnd = event.type === "tool_execution_end"
    const isError = isEnd && event.isError
    return [{
      type: "part",
      action: "updated",
      sessionID: context.sessionID,
      messageID: tool.messageID,
      part: {
        id: `${context.sessionID}:tool:${event.toolCallId}`,
        type: "tool",
        name: tool.name,
        callID: event.toolCallId,
        state: isError ? "error" : isEnd ? "completed" : "running",
        input: tool.input,
        output: isEnd ? event.result : event.partialResult,
        ...(isError ? { error: "Tool execution failed" } : {}),
      },
    }]
  }
  return []
}
