import { describe, expect, it } from "vitest";
import { initialAgentState, reduceServerMessage } from "./reducer.js";

describe("reduceServerMessage", () => {
  it("replaces local projection with a snapshot", () => {
    const state = reduceServerMessage(initialAgentState, {
      protocolVersion: 1,
      sequence: 0,
      type: "state.snapshot",
      snapshot: { workspace: "/work", sessionId: "s1", status: "idle", items: [] },
    });
    expect(state).toMatchObject({ workspace: "/work", sessionId: "s1", status: "idle", lastSequence: 0 });
  });

  it("appends text deltas to one assistant item", () => {
    const base = { ...initialAgentState, sessionId: "s1", lastSequence: 1 };
    const first = reduceServerMessage(base, { protocolVersion: 1, sequence: 2, type: "agent.event", sessionId: "s1", event: { type: "text.delta", itemId: "a1", delta: "Hel" } });
    const second = reduceServerMessage(first, { protocolVersion: 1, sequence: 3, type: "agent.event", sessionId: "s1", event: { type: "text.delta", itemId: "a1", delta: "lo" } });
    expect(second.items).toContainEqual({ id: "a1", type: "message", role: "assistant", text: "Hello" });
  });

  it("ignores duplicate or stale events", () => {
    const state = { ...initialAgentState, lastSequence: 8 };
    const result = reduceServerMessage(state, { protocolVersion: 1, sequence: 8, type: "agent.event", sessionId: "s1", event: { type: "run.started" } });
    expect(result).toBe(state);
  });

  it("ignores events from another session while advancing sequence", () => {
    const state = { ...initialAgentState, sessionId: "s1", status: "idle" as const, lastSequence: 4 };
    const result = reduceServerMessage(state, {
      protocolVersion: 1,
      sequence: 5,
      type: "agent.event",
      sessionId: "s2",
      event: { type: "run.started" },
    });

    expect(result).toEqual({ ...state, lastSequence: 5 });
  });

  it("accepts a reconnect snapshot at sequence zero", () => {
    const state = {
      ...initialAgentState,
      connected: true,
      workspace: "/old",
      sessionId: "s1",
      status: "running" as const,
      model: "old-model",
      items: [{ id: "old", type: "message" as const, role: "assistant" as const, text: "Old" }],
      lastSequence: 12,
    };
    const result = reduceServerMessage(state, {
      protocolVersion: 1,
      sequence: 0,
      type: "state.snapshot",
      snapshot: { workspace: "/new", sessionId: "s2", status: "idle", items: [] },
    });

    expect(result).toEqual({
      connected: true,
      workspace: "/new",
      sessionId: "s2",
      status: "idle",
      items: [],
      lastSequence: 0,
    });
  });

  it("upserts tool lifecycle events and records errors", () => {
    const base = { ...initialAgentState, sessionId: "s1" };
    const started = reduceServerMessage(base, { protocolVersion: 1, sequence: 1, type: "agent.event", sessionId: "s1", event: { type: "tool.started", itemId: "t1", toolName: "read" } });
    const updated = reduceServerMessage(started, { protocolVersion: 1, sequence: 2, type: "agent.event", sessionId: "s1", event: { type: "tool.updated", itemId: "t1", output: "partial" } });
    const finished = reduceServerMessage(updated, { protocolVersion: 1, sequence: 3, type: "agent.event", sessionId: "s1", event: { type: "tool.finished", itemId: "t1", output: "failed", isError: true } });
    const errored = reduceServerMessage(finished, { protocolVersion: 1, sequence: 4, type: "agent.event", sessionId: "s1", event: { type: "agent.error", message: "Runtime stopped" } });

    expect(errored.items).toEqual([
      { id: "t1", type: "tool", toolName: "read", status: "failed", output: "failed" },
      { id: "error-4", type: "error", message: "Runtime stopped" },
    ]);
    expect(errored.status).toBe("error");
  });
});
