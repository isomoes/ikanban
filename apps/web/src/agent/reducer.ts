import type { AgentEvent, RuntimeSnapshot, ServerMessage, TranscriptItem } from "@pi-web/protocol";

export interface AgentState extends RuntimeSnapshot {
  connected: boolean;
  lastSequence: number;
  lastError?: string;
}

export const initialAgentState: AgentState = {
  connected: false,
  workspace: "",
  sessionId: "",
  status: "idle",
  items: [],
  lastSequence: -1,
};

function replaceItem(items: TranscriptItem[], id: string, create: (existing?: TranscriptItem) => TranscriptItem): TranscriptItem[] {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return [...items, create()];

  const next = [...items];
  next[index] = create(items[index]);
  return next;
}

function reduceEvent(state: AgentState, event: AgentEvent, sequence: number): AgentState {
  const next = { ...state, lastSequence: sequence };

  switch (event.type) {
    case "run.started":
      return { ...next, status: "running" };
    case "run.finished":
      return { ...next, status: "idle" };
    case "user.message":
      return {
        ...next,
        items: replaceItem(state.items, event.itemId, () => ({
          id: event.itemId,
          type: "message",
          role: "user",
          text: event.text,
        })),
      };
    case "text.delta":
      return {
        ...next,
        items: replaceItem(state.items, event.itemId, (existing) => ({
          id: event.itemId,
          type: "message",
          role: "assistant",
          text: existing?.type === "message" && existing.role === "assistant" ? existing.text + event.delta : event.delta,
        })),
      };
    case "tool.started":
      return {
        ...next,
        items: replaceItem(state.items, event.itemId, () => ({
          id: event.itemId,
          type: "tool",
          toolName: event.toolName,
          status: "running",
          output: "",
        })),
      };
    case "tool.updated":
      return {
        ...next,
        items: replaceItem(state.items, event.itemId, (existing) => ({
          id: event.itemId,
          type: "tool",
          toolName: existing?.type === "tool" ? existing.toolName : "Tool",
          status: "running",
          output: event.output,
        })),
      };
    case "tool.finished":
      return {
        ...next,
        items: replaceItem(state.items, event.itemId, (existing) => ({
          id: event.itemId,
          type: "tool",
          toolName: existing?.type === "tool" ? existing.toolName : "Tool",
          status: event.isError ? "failed" : "succeeded",
          output: event.output,
        })),
      };
    case "agent.error":
      return {
        ...next,
        status: "error",
        items: [...state.items, { id: `error-${sequence}`, type: "error", message: event.message }],
      };
  }
}

export function reduceServerMessage(state: AgentState, message: ServerMessage): AgentState {
  if (message.type === "state.snapshot") {
    return {
      connected: state.connected,
      ...message.snapshot,
      lastSequence: message.sequence,
      ...(state.lastError === undefined ? {} : { lastError: state.lastError }),
    };
  }

  if (message.sequence <= state.lastSequence) return state;

  if (message.type === "agent.event") {
    if (message.sessionId !== state.sessionId) {
      return { ...state, lastSequence: message.sequence };
    }
    return reduceEvent(state, message.event, message.sequence);
  }

  if (message.type === "command.rejected") {
    return { ...state, lastSequence: message.sequence, lastError: message.reason };
  }

  return { ...state, lastSequence: message.sequence };
}
