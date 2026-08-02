import { describe, expect, it, vi } from "vitest";
import { AgentController } from "./controller.js";
import { normalizePiEvent, transcriptFromMessages } from "./transcript.js";
import type { PiEvent, PiRuntimePort, PiSessionPort } from "./types.js";

class FakeSession implements PiSessionPort {
  sessionId = "session-1";
  isStreaming = false;
  messages: readonly unknown[] = [];
  model = { provider: "test", id: "small" };
  listener: ((event: PiEvent) => void) | undefined;
  prompt = vi.fn(async (text: string) => {
    this.isStreaming = true;
    this.listener?.({ type: "agent_start" });
    this.listener?.({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: `Echo: ${text}` } });
    this.isStreaming = false;
    this.listener?.({ type: "agent_end" });
  });
  steer = vi.fn<(text: string) => Promise<void>>(async () => undefined);
  followUp = vi.fn<(text: string) => Promise<void>>(async () => undefined);
  abort = vi.fn<() => Promise<void>>(async () => undefined);
  subscribe(listener: (event: PiEvent) => void) {
    this.listener = listener;
    return () => {
      this.listener = undefined;
    };
  }
}

function fakeRuntime(session = new FakeSession()): PiRuntimePort {
  return { session, newSession: vi.fn(), dispose: vi.fn() };
}

describe("AgentController", () => {
  it("accepts one prompt and emits ordered normalized events", async () => {
    const session = new FakeSession();
    const runtime = fakeRuntime(session);
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => runtime });
    const messages: Array<{ sequence: number; type: string }> = [];
    controller.subscribe((message) => messages.push(message));

    await controller.handle({ protocolVersion: 1, commandId: "one", type: "prompt.send", text: "hello" });

    expect(session.prompt).toHaveBeenCalledWith("hello");
    expect(messages.map(({ sequence, type }) => [sequence, type])).toEqual([
      [1, "command.accepted"],
      [2, "agent.event"],
      [3, "agent.event"],
      [4, "agent.event"],
    ]);
  });

  it("rejects a normal prompt while a run is active", async () => {
    const session = new FakeSession();
    session.isStreaming = true;
    const runtime = fakeRuntime(session);
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => runtime });
    const messages: Array<{ type: string; reason?: string }> = [];
    controller.subscribe((message) => messages.push(message));

    await controller.handle({ protocolVersion: 1, commandId: "two", type: "prompt.send", text: "hello" });

    expect(session.prompt).not.toHaveBeenCalled();
    expect(messages.at(-1)).toMatchObject({ type: "command.rejected", reason: "A run is already active; steer, follow up, or abort it." });
  });

  it("serializes commands and routes active-run controls", async () => {
    const session = new FakeSession();
    let release!: () => void;
    session.steer.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
    session.isStreaming = true;
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => fakeRuntime(session) });

    const steering = controller.handle({ protocolVersion: 1, commandId: "steer", type: "prompt.steer", text: "left" });
    const following = controller.handle({ protocolVersion: 1, commandId: "follow", type: "prompt.followUp", text: "next" });
    await vi.waitFor(() => expect(session.steer).toHaveBeenCalledWith("left"));
    expect(session.followUp).not.toHaveBeenCalled();
    release();
    await Promise.all([steering, following]);

    expect(session.followUp).toHaveBeenCalledWith("next");
  });

  it("replaces an idle session and publishes its fresh snapshot", async () => {
    const oldSession = new FakeSession();
    const newSession = new FakeSession();
    newSession.sessionId = "session-2";
    const runtime = fakeRuntime(oldSession);
    runtime.newSession = vi.fn(async () => {
      Object.defineProperty(runtime, "session", { value: newSession });
    });
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => runtime });
    const messages: Array<{ type: string; snapshot?: { sessionId: string } }> = [];
    controller.subscribe((message) => messages.push(message));

    await controller.handle({ protocolVersion: 1, commandId: "new", type: "session.new" });

    expect(oldSession.listener).toBeUndefined();
    expect(newSession.listener).toBeTypeOf("function");
    expect(messages).toMatchObject([
      { type: "command.accepted" },
      { type: "state.snapshot", snapshot: { sessionId: "session-2" } },
    ]);
  });

  it("rejects failures and disposes an active runtime once", async () => {
    const session = new FakeSession();
    session.steer.mockRejectedValue(new Error("steering failed"));
    session.isStreaming = true;
    const runtime = fakeRuntime(session);
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => runtime });
    const messages: Array<{ type: string; reason?: string }> = [];
    controller.subscribe((message) => messages.push(message));

    await controller.handle({ protocolVersion: 1, commandId: "bad", type: "prompt.steer", text: "left" });
    await Promise.all([controller.dispose(), controller.dispose()]);

    expect(messages.at(-1)).toMatchObject({ type: "command.rejected", reason: "steering failed" });
    expect(session.abort).toHaveBeenCalledOnce();
    expect(runtime.dispose).toHaveBeenCalledOnce();
  });
});

describe("transcript normalization", () => {
  it("keeps only textual user and assistant messages with stable IDs", () => {
    expect(transcriptFromMessages([
      { id: "user-1", role: "user", content: "hello" },
      { role: "assistant", content: [{ type: "thinking", thinking: "hmm" }, { type: "text", text: "hi" }] },
      { role: "toolResult", content: [{ type: "text", text: "ignored" }] },
    ])).toEqual([
      { id: "user-1", type: "message", role: "user", text: "hello" },
      { id: "history-1", type: "message", role: "assistant", text: "hi" },
    ]);
  });

  it("maps tool and error events without exposing unknown events", () => {
    const ids = ["tool-1", "tool-2", "tool-3"];
    const nextId = () => ids.shift() ?? "event";

    expect(normalizePiEvent({ type: "tool_execution_start", toolName: "read", toolCallId: "call-1" }, nextId)).toEqual({ type: "tool.started", itemId: "call-1", toolName: "read" });
    expect(normalizePiEvent({ type: "tool_execution_update", toolCallId: "call-1", partialResult: { content: "partial" } }, nextId)).toEqual({ type: "tool.updated", itemId: "call-1", output: "{\"content\":\"partial\"}" });
    expect(normalizePiEvent({ type: "tool_execution_end", toolCallId: "call-1", result: "done", isError: true }, nextId)).toEqual({ type: "tool.finished", itemId: "call-1", output: "done", isError: true });
    expect(normalizePiEvent({ type: "message_end", message: { role: "assistant", stopReason: "error", errorMessage: "boom" } }, nextId)).toEqual({ type: "agent.error", message: "boom" });
    expect(normalizePiEvent({ type: "turn_start" }, nextId)).toBeUndefined();
  });
});
