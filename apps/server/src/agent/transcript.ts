import type { AgentEvent, TranscriptItem } from "@pi-web/protocol";
import type { PiEvent } from "./types.js";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "";

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function toolResultContent(value: unknown): unknown {
  const result = record(value);
  return result && "content" in result ? result.content : value;
}

function textContent(content: unknown): string | undefined {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return undefined;

  const text = content.flatMap((block) => {
    const value = record(block);
    return value?.type === "text" && typeof value.text === "string" ? [value.text] : [];
  }).join("");
  return text || undefined;
}

export function transcriptFromMessages(messages: readonly unknown[]): TranscriptItem[] {
  return messages.flatMap((message, index) => {
    const value = record(message);
    if (!value || (value.role !== "user" && value.role !== "assistant")) return [];

    const text = textContent(value.content);
    if (text === undefined) return [];

    return [{
      id: typeof value.id === "string" ? value.id : `history-${index}`,
      type: "message" as const,
      role: value.role,
      text,
    }];
  });
}

export function normalizePiEvent(event: PiEvent, nextId: () => string): AgentEvent | undefined {
  switch (event.type) {
    case "agent_start":
      return { type: "run.started" };
    case "agent_end":
      return { type: "run.finished" };
    case "message_update": {
      const update = record(event.assistantMessageEvent);
      if (update?.type !== "text_delta" || typeof update.delta !== "string") return undefined;
      return { type: "text.delta", itemId: nextId(), delta: update.delta };
    }
    case "tool_execution_start":
      return {
        type: "tool.started",
        itemId: typeof event.toolCallId === "string" ? event.toolCallId : nextId(),
        toolName: typeof event.toolName === "string" ? event.toolName : "unknown",
      };
    case "tool_execution_update":
      return {
        type: "tool.updated",
        itemId: typeof event.toolCallId === "string" ? event.toolCallId : nextId(),
        output: stringify(toolResultContent(event.partialResult)),
      };
    case "tool_execution_end":
      return {
        type: "tool.finished",
        itemId: typeof event.toolCallId === "string" ? event.toolCallId : nextId(),
        output: stringify(toolResultContent(event.result)),
        isError: event.isError === true,
      };
    case "message_end": {
      const message = record(event.message);
      if (message?.role !== "assistant" || message.stopReason !== "error") return undefined;
      return {
        type: "agent.error",
        message: typeof message.errorMessage === "string" ? message.errorMessage : "Unknown agent error",
      };
    }
    default:
      return undefined;
  }
}
