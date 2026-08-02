import { describe, expect, it, vi } from "vitest";
import { createFakeRuntime } from "./fake-runtime.js";

describe("createFakeRuntime", () => {
  it("streams a deterministic echo response", async () => {
    const runtime = await createFakeRuntime("/work");
    const listener = vi.fn();
    runtime.session.subscribe(listener);

    await runtime.session.prompt("hello");

    expect(runtime.session.sessionId).toBe("fake-session");
    expect(listener.mock.calls.map(([event]) => event)).toEqual([
      { type: "agent_start" },
      { type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "Echo: hello" } },
      { type: "agent_end" },
    ]);
  });

  it("uses prompt behavior for steer and follow-up and emits an end on abort", async () => {
    const runtime = await createFakeRuntime("/work");
    const listener = vi.fn();
    runtime.session.subscribe(listener);

    await runtime.session.steer("left");
    await runtime.session.followUp("next");
    await runtime.session.abort();

    expect(listener.mock.calls.map(([event]) => event)).toEqual([
      { type: "agent_start" },
      { type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "Echo: left" } },
      { type: "agent_end" },
      { type: "agent_start" },
      { type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "Echo: next" } },
      { type: "agent_end" },
      { type: "agent_end" },
    ]);
  });

  it("replaces the session with a fresh fake session", async () => {
    const runtime = await createFakeRuntime("/work");
    const firstSession = runtime.session;

    await expect(runtime.newSession()).resolves.toEqual({ cancelled: false });

    expect(runtime.session).not.toBe(firstSession);
    expect(runtime.session.sessionId).toBe("fake-session");
  });
});
