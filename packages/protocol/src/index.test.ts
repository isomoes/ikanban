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

  it("accepts session, model, and effort controls", () => {
    expect(ClientCommandSchema.parse({
      protocolVersion: 1,
      commandId: "model",
      type: "model.set",
      provider: "openai",
      modelId: "gpt-5",
    })).toMatchObject({ type: "model.set", modelId: "gpt-5" });
    expect(ClientCommandSchema.parse({
      protocolVersion: 1,
      commandId: "effort",
      type: "thinking.set",
      level: "high",
    })).toMatchObject({ type: "thinking.set", level: "high" });
    expect(ClientCommandSchema.parse({
      protocolVersion: 1,
      commandId: "session",
      type: "session.switch",
      sessionId: "session-2",
    })).toMatchObject({ type: "session.switch", sessionId: "session-2" });
  });

  it("opens workspaces and qualifies session navigation by path", () => {
    expect(ClientCommandSchema.parse({
      protocolVersion: 1,
      commandId: "workspace",
      type: "workspace.open",
      path: "/work/second",
    })).toMatchObject({ type: "workspace.open", path: "/work/second" });
    expect(ClientCommandSchema.parse({
      protocolVersion: 1,
      commandId: "session",
      type: "session.switch",
      workspace: "/work/second",
      sessionId: "session-2",
    })).toMatchObject({ workspace: "/work/second", sessionId: "session-2" });
  });

  it("archives a session within its workspace", () => {
    expect(ClientCommandSchema.parse({
      protocolVersion: 1,
      commandId: "archive",
      type: "session.archive",
      workspace: "/work/second",
      sessionId: "session-2",
    })).toMatchObject({ type: "session.archive", workspace: "/work/second", sessionId: "session-2" });
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
        models: [{ provider: "openai", id: "gpt-5", name: "GPT-5" }],
        thinkingLevel: "medium",
        thinkingLevels: ["off", "low", "medium", "high"],
        sessions: [{ id: "session-1", title: "Current work", modified: "2026-08-02T10:00:00.000Z", messageCount: 2 }],
        workspaces: [{
          path: "/work/project",
          name: "project",
          sessions: [
            { id: "session-1", title: "Current work", modified: "2026-08-02T10:00:00.000Z", messageCount: 2, status: "running" },
            { id: "session-2", title: "Other work", modified: "2026-08-01T10:00:00.000Z", messageCount: 3, status: "idle" },
          ],
        }],
        commands: [{ name: "skill:review", description: "Review changes", source: "skill" }],
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
