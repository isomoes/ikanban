import type {
  JsonValue,
  SessionMessageAssistant,
  SessionMessageAssistantTool,
  SessionMessageInfo,
  SessionStatus,
} from "@opencode/client/promise"

const TIME = 1_735_689_600_000
const MODEL = { id: "claude-sonnet-4", providerID: "anthropic", variant: "balanced" }

export function storyTool(
  id: string,
  name: string,
  status: "streaming" | "running" | "completed" | "error",
  input: Record<string, JsonValue>,
  options: { metadata?: Record<string, JsonValue>; output?: string; error?: string; raw?: string } = {},
): SessionMessageAssistantTool {
  const state =
    status === "streaming"
      ? { status, input: options.raw ?? JSON.stringify(input) }
      : status === "running"
        ? { status, input, metadata: { ...options.metadata, ...(options.output ? { output: options.output } : {}) } }
        : status === "error"
          ? {
              status,
              input,
              error: { type: "ToolExecutionError", message: options.error ?? `${name} failed visibly` },
              metadata: options.metadata,
            }
          : {
              status,
              input,
              content: [{ type: "text" as const, text: options.output ?? "Complete" }] as [
                { type: "text"; text: string },
              ],
              metadata: options.metadata,
            }
  return {
    type: "tool",
    id,
    name,
    state,
    time: {
      created: TIME,
      ...(status === "streaming" ? {} : { ran: TIME + 100 }),
      ...(status === "completed" || status === "error" ? { completed: TIME + 200 } : {}),
    },
  }
}

export function storyDocument(
  content: SessionMessageAssistant["content"],
  busy = false,
): { messages: SessionMessageInfo[]; status: SessionStatus } {
  return {
    messages: [
      {
        id: "msg_user_thinking",
        type: "user",
        text: "Find why the Session header shifts after the first streamed response.",
        time: { created: TIME + 32_000 },
        metadata: { agent: "build", model: MODEL },
      },
      {
        id: "msg_tool_projection_assistant",
        type: "assistant",
        agent: "build",
        model: MODEL,
        content,
        time: { created: TIME, ...(busy ? {} : { completed: TIME + 300 }) },
      },
    ],
    status: { type: busy ? "busy" : "idle" },
  }
}
