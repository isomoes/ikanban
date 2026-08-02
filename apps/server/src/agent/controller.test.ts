import { describe, expect, it, vi } from "vitest";
import type { ClientCommand } from "@pi-web/protocol";
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
  return { session, newSession: vi.fn(async () => ({ cancelled: false })), dispose: vi.fn() };
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

  it("starts live-run controls without waiting for the prompt to settle", async () => {
    const session = new FakeSession();
    let releasePrompt!: () => void;
    session.prompt.mockImplementation(() => {
      session.isStreaming = true;
      return new Promise<void>((resolve) => { releasePrompt = resolve; });
    });
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => fakeRuntime(session) });
    const messages: Array<{ type: string; commandId?: string }> = [];
    controller.subscribe((message) => messages.push(message));

    const prompting = controller.handle({ protocolVersion: 1, commandId: "prompt", type: "prompt.send", text: "hello" });
    await vi.waitFor(() => expect(session.prompt).toHaveBeenCalledWith("hello"));
    const steering = controller.handle({ protocolVersion: 1, commandId: "steer", type: "prompt.steer", text: "left" });
    const following = controller.handle({ protocolVersion: 1, commandId: "follow", type: "prompt.followUp", text: "next" });
    const aborting = controller.handle({ protocolVersion: 1, commandId: "abort", type: "run.abort" });
    await vi.waitFor(() => expect(session.steer).toHaveBeenCalledWith("left"));
    await vi.waitFor(() => expect(session.followUp).toHaveBeenCalledWith("next"));
    await vi.waitFor(() => expect(session.abort).toHaveBeenCalledOnce());
    await controller.handle({ protocolVersion: 1, commandId: "second", type: "prompt.send", text: "again" });

    expect(session.prompt).toHaveBeenCalledOnce();
    expect(messages.at(-1)).toMatchObject({ type: "command.rejected", commandId: "second" });
    releasePrompt();
    await Promise.all([prompting, steering, following, aborting]);
  });

  it("projects each accepted prompt command into reconnect snapshots exactly once", async () => {
    const session = new FakeSession();
    session.messages = [{ id: "history-user", role: "user", content: "persisted" }];
    let releasePrompt!: () => void;
    session.prompt.mockImplementation(() => {
      session.isStreaming = true;
      return new Promise<void>((resolve) => { releasePrompt = resolve; });
    });
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => fakeRuntime(session) });

    const prompting = controller.handle({ protocolVersion: 1, commandId: "prompt", type: "prompt.send", text: "inspect" });
    await vi.waitFor(() => expect(session.prompt).toHaveBeenCalledWith("inspect"));
    await controller.handle({ protocolVersion: 1, commandId: "steer", type: "prompt.steer", text: "focus left" });
    await controller.handle({ protocolVersion: 1, commandId: "follow", type: "prompt.followUp", text: "then summarize" });

    const userTexts = controller.snapshot().items.flatMap((item) =>
      item.type === "message" && item.role === "user" ? [item.text] : []
    );
    expect(userTexts).toEqual(["persisted", "inspect", "focus left", "then summarize"]);

    releasePrompt();
    await prompting;
  });

  it("uses a distinct text item for each assistant message lifecycle", async () => {
    const session = new FakeSession();
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => fakeRuntime(session) });
    const events: Array<{ type: string; itemId?: string }> = [];
    controller.subscribe((message) => {
      if (message.type === "agent.event") events.push(message.event);
    });

    session.listener?.({ type: "agent_start" });
    session.listener?.({ type: "message_start", message: { role: "assistant" } });
    session.listener?.({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "first" } });
    session.listener?.({ type: "message_end", message: { role: "assistant", stopReason: "toolUse" } });
    session.listener?.({ type: "tool_execution_start", toolCallId: "call-1", toolName: "read" });
    session.listener?.({ type: "tool_execution_end", toolCallId: "call-1", result: { content: "done" }, isError: false });
    session.listener?.({ type: "message_start", message: { role: "assistant" } });
    session.listener?.({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "second" } });
    session.listener?.({ type: "message_end", message: { role: "assistant", stopReason: "stop" } });
    session.listener?.({ type: "agent_end" });

    expect(events.map((event) => event.type)).toEqual([
      "run.started",
      "text.delta",
      "tool.started",
      "tool.finished",
      "text.delta",
      "run.finished",
    ]);
    expect(events[1]?.itemId).not.toBe(events[4]?.itemId);
  });

  it("preserves streamed text and tool state in reconnect snapshots", async () => {
    const session = new FakeSession();
    session.messages = [{ id: "user-1", role: "user", content: "inspect it" }];
    session.isStreaming = true;
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => fakeRuntime(session) });

    session.listener?.({ type: "message_start", message: { id: "assistant-live", role: "assistant" } });
    session.listener?.({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "Looking " } });
    session.listener?.({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "now" } });
    session.listener?.({ type: "tool_execution_start", toolCallId: "call-1", toolName: "read" });
    session.listener?.({ type: "tool_execution_update", toolCallId: "call-1", partialResult: { content: "partial output" } });

    expect(controller.snapshot().items).toEqual([
      { id: "user-1", type: "message", role: "user", text: "inspect it" },
      { id: "assistant-live", type: "message", role: "assistant", text: "Looking now" },
      { id: "call-1", type: "tool", toolName: "read", status: "running", output: "partial output" },
    ]);

    session.listener?.({ type: "tool_execution_end", toolCallId: "call-1", result: { content: "done" }, isError: false });
    expect(controller.snapshot().items.at(-1)).toEqual({
      id: "call-1",
      type: "tool",
      toolName: "read",
      status: "succeeded",
      output: "done",
    });
  });

  it("reconciles final assistant text in place without disturbing tool order", async () => {
    const session = new FakeSession();
    session.messages = [
      { id: "history-user", role: "user", content: "earlier question" },
      { id: "history-assistant", role: "assistant", content: "earlier answer" },
    ];
    let releasePrompt!: () => void;
    session.prompt.mockImplementation(() => {
      session.isStreaming = true;
      return new Promise<void>((resolve) => { releasePrompt = resolve; });
    });
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => fakeRuntime(session) });

    const prompting = controller.handle({ protocolVersion: 1, commandId: "prompt", type: "prompt.send", text: "new question" });
    await vi.waitFor(() => expect(session.prompt).toHaveBeenCalledOnce());
    session.listener?.({ type: "message_start", message: { id: "streamed-assistant", role: "assistant" } });
    session.listener?.({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "partial" } });
    session.listener?.({ type: "tool_execution_start", toolCallId: "call-1", toolName: "read" });
    session.listener?.({ type: "tool_execution_end", toolCallId: "call-1", result: { content: "tool output" }, isError: false });
    session.listener?.({
      type: "message_end",
      message: {
        id: "finalized-assistant",
        role: "assistant",
        content: [
          { type: "thinking", thinking: "hidden" },
          { type: "text", text: "complete answer" },
        ],
        stopReason: "stop",
      },
    });

    expect(controller.snapshot().items).toEqual([
      { id: "history-user", type: "message", role: "user", text: "earlier question" },
      { id: "history-assistant", type: "message", role: "assistant", text: "earlier answer" },
      { id: "live-user-1", type: "message", role: "user", text: "new question" },
      { id: "streamed-assistant", type: "message", role: "assistant", text: "complete answer" },
      { id: "call-1", type: "tool", toolName: "read", status: "succeeded", output: "tool output" },
    ]);

    releasePrompt();
    await prompting;
  });

  it("uses a safe Pi ID for finalized assistant text without prior deltas", async () => {
    const session = new FakeSession();
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => fakeRuntime(session) });

    session.listener?.({
      type: "message_end",
      message: { id: "pi-assistant", role: "assistant", content: "final only", stopReason: "stop" },
    });

    expect(controller.snapshot().items).toEqual([
      { id: "pi-assistant", type: "message", role: "assistant", text: "final only" },
    ]);
  });

  it("preserves normalized errors in reconnect snapshots", async () => {
    const session = new FakeSession();
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => fakeRuntime(session) });

    session.listener?.({
      type: "message_end",
      message: { role: "assistant", stopReason: "error", errorMessage: "model failed" },
    });

    expect(controller.snapshot().items).toEqual([
      { id: "live-error-1", type: "error", message: "model failed" },
    ]);
  });

  it("replaces an idle session and publishes its fresh snapshot", async () => {
    const oldSession = new FakeSession();
    const newSession = new FakeSession();
    newSession.sessionId = "session-2";
    const runtime = fakeRuntime(oldSession);
    runtime.newSession = vi.fn(async () => {
      Object.defineProperty(runtime, "session", { value: newSession });
      return { cancelled: false };
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

  it("keeps the current session subscribed when replacement is cancelled", async () => {
    const session = new FakeSession();
    const runtime = fakeRuntime(session);
    runtime.newSession = vi.fn(async () => ({ cancelled: true }));
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => runtime });
    const messages: Array<{ type: string }> = [];
    controller.subscribe((message) => messages.push(message));

    await controller.handle({ protocolVersion: 1, commandId: "new", type: "session.new" });

    expect(session.listener).toBeTypeOf("function");
    expect(controller.snapshot()).toMatchObject({ sessionId: "session-1", status: "idle" });
    expect(messages).toEqual([expect.objectContaining({ type: "command.accepted" })]);
  });

  it("resets the transcript projection after actual session replacement", async () => {
    const oldSession = new FakeSession();
    oldSession.messages = [{ id: "old-user", role: "user", content: "old" }];
    const newSession = new FakeSession();
    newSession.sessionId = "session-2";
    newSession.messages = [{ id: "new-user", role: "user", content: "new" }];
    const runtime = fakeRuntime(oldSession);
    runtime.newSession = vi.fn(async () => {
      Object.defineProperty(runtime, "session", { value: newSession });
      return { cancelled: false };
    });
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => runtime });
    oldSession.listener?.({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "old live text" } });

    await controller.handle({ protocolVersion: 1, commandId: "new", type: "session.new" });

    expect(controller.snapshot().items).toEqual([
      { id: "new-user", type: "message", role: "user", text: "new" },
    ]);
  });

  it.each([
    { protocolVersion: 1, commandId: "another-new", type: "session.new" },
    { protocolVersion: 1, commandId: "prompt", type: "prompt.send", text: "hello" },
    { protocolVersion: 1, commandId: "steer", type: "prompt.steer", text: "left" },
    { protocolVersion: 1, commandId: "follow", type: "prompt.followUp", text: "next" },
    { protocolVersion: 1, commandId: "abort", type: "run.abort" },
  ] satisfies ClientCommand[])("rejects $type while session replacement is in flight", async (command) => {
    const session = new FakeSession();
    let releaseReplacement!: () => void;
    const runtime = fakeRuntime(session);
    runtime.newSession = vi.fn(() => new Promise<{ cancelled: boolean }>((resolve) => {
      releaseReplacement = () => resolve({ cancelled: false });
    }));
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => runtime });
    const messages: Array<{ type: string; commandId?: string; reason?: string }> = [];
    controller.subscribe((message) => messages.push(message));

    const replacing = controller.handle({ protocolVersion: 1, commandId: "new", type: "session.new" });
    await vi.waitFor(() => expect(runtime.newSession).toHaveBeenCalledOnce());
    await controller.handle(command);

    expect(runtime.newSession).toHaveBeenCalledOnce();
    expect(session.prompt).not.toHaveBeenCalled();
    expect(session.steer).not.toHaveBeenCalled();
    expect(session.followUp).not.toHaveBeenCalled();
    expect(session.abort).not.toHaveBeenCalled();
    expect(messages.at(-1)).toMatchObject({
      type: "command.rejected",
      commandId: command.commandId,
      reason: "Session replacement is in progress.",
    });
    releaseReplacement();
    await replacing;
  });

  it("waits for replacement before disposal and never subscribes the replacement session", async () => {
    const oldSession = new FakeSession();
    const newSession = new FakeSession();
    newSession.sessionId = "session-2";
    let releaseReplacement!: () => void;
    const runtime = fakeRuntime(oldSession);
    runtime.newSession = vi.fn(() => new Promise<{ cancelled: boolean }>((resolve) => {
      releaseReplacement = () => {
        Object.defineProperty(runtime, "session", { value: newSession });
        resolve({ cancelled: false });
      };
    }));
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => runtime });

    const replacing = controller.handle({ protocolVersion: 1, commandId: "new", type: "session.new" });
    await vi.waitFor(() => expect(runtime.newSession).toHaveBeenCalledOnce());
    const disposing = controller.dispose();
    await Promise.resolve();
    await Promise.resolve();

    expect(runtime.dispose).not.toHaveBeenCalled();
    releaseReplacement();
    await Promise.all([replacing, disposing]);

    expect(oldSession.listener).toBeUndefined();
    expect(newSession.listener).toBeUndefined();
    expect(runtime.dispose).toHaveBeenCalledOnce();
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

  it("rejects commands once disposal starts", async () => {
    const session = new FakeSession();
    let releaseDispose!: () => void;
    const runtime = fakeRuntime(session);
    runtime.dispose = vi.fn(() => new Promise<void>((resolve) => { releaseDispose = resolve; }));
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => runtime });
    const messages: Array<{ type: string; commandId?: string; reason?: string }> = [];
    controller.subscribe((message) => messages.push(message));

    const disposing = controller.dispose();
    await controller.handle({ protocolVersion: 1, commandId: "late", type: "prompt.send", text: "hello" });

    expect(session.prompt).not.toHaveBeenCalled();
    expect(messages.at(-1)).toMatchObject({ type: "command.rejected", commandId: "late", reason: "Controller is disposing." });
    releaseDispose();
    await disposing;
  });

  it("disposes the runtime even when abort rejects", async () => {
    const session = new FakeSession();
    session.isStreaming = true;
    session.abort.mockRejectedValue(new Error("abort failed"));
    const runtime = fakeRuntime(session);
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => runtime });

    await expect(controller.dispose()).rejects.toThrow("abort failed");

    expect(runtime.dispose).toHaveBeenCalledOnce();
  });

  it("disposes without waiting for a live prompt to settle", async () => {
    const session = new FakeSession();
    let releasePrompt!: () => void;
    session.prompt.mockImplementation(() => {
      session.isStreaming = true;
      return new Promise<void>((resolve) => { releasePrompt = resolve; });
    });
    session.abort.mockImplementation(async () => {
      session.isStreaming = false;
      releasePrompt();
    });
    const runtime = fakeRuntime(session);
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => runtime });

    const prompting = controller.handle({ protocolVersion: 1, commandId: "prompt", type: "prompt.send", text: "hello" });
    await vi.waitFor(() => expect(session.prompt).toHaveBeenCalledOnce());
    await controller.dispose();
    await prompting;

    expect(session.abort).toHaveBeenCalledOnce();
    expect(runtime.dispose).toHaveBeenCalledOnce();
  });

  it("isolates subscriber exceptions from commands and other subscribers", async () => {
    const session = new FakeSession();
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => fakeRuntime(session) });
    const received: string[] = [];
    controller.subscribe(() => { throw new Error("listener failed"); });
    controller.subscribe((message) => received.push(message.type));

    await controller.handle({ protocolVersion: 1, commandId: "one", type: "prompt.send", text: "hello" });

    expect(session.prompt).toHaveBeenCalledOnce();
    expect(received).toEqual(["command.accepted", "agent.event", "agent.event", "agent.event"]);
  });

  it("recovers error status after a later command succeeds", async () => {
    const session = new FakeSession();
    session.isStreaming = true;
    session.steer.mockRejectedValueOnce(new Error("steering failed"));
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => fakeRuntime(session) });

    await controller.handle({ protocolVersion: 1, commandId: "bad", type: "prompt.steer", text: "left" });
    expect(controller.snapshot().status).toBe("error");
    await controller.handle({ protocolVersion: 1, commandId: "good", type: "prompt.steer", text: "right" });

    expect(controller.snapshot().status).toBe("running");
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
    expect(normalizePiEvent({ type: "tool_execution_update", toolCallId: "call-1", partialResult: { content: "partial", details: { ignored: true } } }, nextId)).toEqual({ type: "tool.updated", itemId: "call-1", output: "partial" });
    expect(normalizePiEvent({ type: "tool_execution_end", toolCallId: "call-1", result: { content: [{ type: "text", text: "done" }], details: { ignored: true } }, isError: true }, nextId)).toEqual({ type: "tool.finished", itemId: "call-1", output: "[{\"type\":\"text\",\"text\":\"done\"}]", isError: true });
    expect(normalizePiEvent({ type: "message_end", message: { role: "assistant", stopReason: "error", errorMessage: "boom" } }, nextId)).toEqual({ type: "agent.error", message: "boom" });
    expect(normalizePiEvent({ type: "turn_start" }, nextId)).toBeUndefined();
  });
});
