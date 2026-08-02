import type { PiEvent, PiRuntimeFactory, PiSessionPort } from "./types.js";

function createFakeSession(): PiSessionPort {
  const listeners = new Set<(event: PiEvent) => void>();
  let messageSequence = 0;
  const emit = (event: PiEvent) => {
    for (const listener of listeners) listener(event);
  };
  const prompt = async (text: string) => {
    const userId = `fake-user-${++messageSequence}`;
    const assistantId = `fake-assistant-${++messageSequence}`;
    emit({ type: "agent_start" });
    emit({ type: "message_end", message: { id: userId, role: "user", content: text } });
    emit({ type: "message_start", message: { id: assistantId, role: "assistant" } });
    emit({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: `Echo: ${text}` } });
    emit({
      type: "message_end",
      message: { id: assistantId, role: "assistant", content: `Echo: ${text}`, stopReason: "stop" },
    });
    emit({ type: "agent_end" });
  };

  return {
    sessionId: "fake-session",
    isStreaming: false,
    messages: [],
    prompt,
    steer: prompt,
    followUp: prompt,
    abort: async () => emit({ type: "agent_end" }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const createFakeRuntime: PiRuntimeFactory = async () => {
  let session = createFakeSession();
  return {
    get session() { return session; },
    newSession: async () => {
      session = createFakeSession();
      return { cancelled: false };
    },
    dispose: () => undefined,
  };
};
