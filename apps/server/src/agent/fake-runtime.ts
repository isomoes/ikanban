import type { PiEvent, PiRuntimeFactory, PiSessionPort } from "./types.js";

function createFakeSession(): PiSessionPort {
  const listeners = new Set<(event: PiEvent) => void>();
  const emit = (event: PiEvent) => {
    for (const listener of listeners) listener(event);
  };
  const prompt = async (text: string) => {
    emit({ type: "agent_start" });
    emit({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: `Echo: ${text}` } });
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
