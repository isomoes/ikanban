import { describe, expect, it } from "vitest";
import { ClientCommandSchema, ServerMessageSchema } from "./index.js";

describe("ClientCommandSchema", () => {
  it("accepts a versioned prompt command", () => {
    expect(ClientCommandSchema.parse({
      protocolVersion: 1,
      commandId: "cmd-1",
      type: "prompt.send",
      text: "List files",
    })).toMatchObject({ type: "prompt.send", text: "List files" });
  });

  it("rejects unknown commands and blank prompts", () => {
    expect(() => ClientCommandSchema.parse({
      protocolVersion: 1,
      commandId: "cmd-2",
      type: "prompt.send",
      text: "  ",
    })).toThrow();
    expect(() => ClientCommandSchema.parse({
      protocolVersion: 1,
      commandId: "cmd-3",
      type: "shell.execute",
    })).toThrow();
  });
});

describe("ServerMessageSchema", () => {
  it("accepts a complete runtime snapshot", () => {
    expect(ServerMessageSchema.parse({
      protocolVersion: 1,
      sequence: 0,
      type: "state.snapshot",
      snapshot: {
        workspace: "/work/project",
        sessionId: "session-1",
        status: "idle",
        items: [],
      },
    }).type).toBe("state.snapshot");
  });

  it("accepts a delivered user message event", () => {
    expect(ServerMessageSchema.parse({
      protocolVersion: 1,
      sequence: 1,
      type: "agent.event",
      sessionId: "session-1",
      event: { type: "user.message", itemId: "user-1", text: "Second prompt" },
    })).toMatchObject({
      event: { type: "user.message", itemId: "user-1", text: "Second prompt" },
    });
  });
});
