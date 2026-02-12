import { describe, expect, test } from "bun:test";

import { ConversationManager } from "./conversation-manager";

type SessionCall = {
  directory?: string;
  title?: string;
  sessionID?: string;
  parts?: Array<{ type: string; text: string }>;
  model?: {
    providerID: string;
    modelID: string;
  };
};

type EventCall = {
  directory?: string;
};

function createManagerHarness() {
  const calls: {
    clientDirectories: string[];
    create: SessionCall[];
    prompt: SessionCall[];
    messages: SessionCall[];
    subscribe: EventCall[];
    unsubscribeCalls: number;
  } = {
    clientDirectories: [],
    create: [],
    prompt: [],
    messages: [],
    subscribe: [],
    unsubscribeCalls: 0,
  };

  const manager = new ConversationManager({
    async getClient(directory: string) {
      calls.clientDirectories.push(directory);

      return {
        session: {
          create: async (parameters?: SessionCall) => {
            calls.create.push(parameters ?? {});
            return {
              data: {
                sessionID: "session-demo-1",
                title: parameters?.title,
                createdAt: 1700000001000,
                updatedAt: 1700000001000,
              },
            };
          },
          prompt: async (parameters?: SessionCall) => {
            calls.prompt.push(parameters ?? {});
            return {
              data: {
                accepted: true,
              },
            };
          },
          messages: async (parameters?: SessionCall) => {
            calls.messages.push(parameters ?? {});
            return {
              data: [
                {
                  id: "msg-1",
                  sessionID: parameters?.sessionID,
                  role: "assistant",
                  createdAt: 1700000002000,
                  parts: [{ text: "Ready." }],
                },
                {
                  id: "msg-2",
                  sessionID: parameters?.sessionID,
                  role: "unknown-role",
                  createdAt: 1700000003000,
                  parts: [{ content: "Follow-up details" }],
                },
              ],
            };
          },
        },
        event: {
          subscribe: async (parameters?: EventCall) => {
            calls.subscribe.push(parameters ?? {});
            return {
              data: {
                unsubscribe: () => {
                  calls.unsubscribeCalls += 1;
                },
              },
            };
          },
        },
      } as never;
    },
  });

  return {
    manager,
    calls,
  };
}

describe("ConversationManager session lifecycle", () => {
  test("creates session in worktree-scoped directory", async () => {
    const { manager, calls } = createManagerHarness();

    const session = await manager.createTaskSession({
      projectId: "project-a",
      taskId: "task-1",
      projectDirectory: "/tmp/project",
      worktreeDirectory: "/tmp/project/.worktrees/task-1",
      title: "Task one",
      timestamp: 1700000000000,
    });

    expect(session).toEqual({
      sessionID: "session-demo-1",
      projectId: "project-a",
      taskId: "task-1",
      directory: "/tmp/project/.worktrees/task-1",
      title: "Task one",
      createdAt: 1700000001000,
      updatedAt: 1700000001000,
    });
    expect(calls.create[0]).toEqual({
      directory: "/tmp/project/.worktrees/task-1",
      title: "Task one",
    });
    expect(manager.getTaskSessionID("task-1")).toBe("session-demo-1");
    expect(manager.getSessionDirectory("session-demo-1")).toBe("/tmp/project/.worktrees/task-1");
  });

  test("sends initial and follow-up prompts", async () => {
    const { manager, calls } = createManagerHarness();

    await manager.createTaskSession({
      projectId: "project-a",
      taskId: "task-2",
      projectDirectory: "/tmp/project",
      worktreeDirectory: "/tmp/project/.worktrees/task-2",
    });

    await manager.sendInitialPrompt({
      sessionID: "session-demo-1",
      prompt: "Start implementation",
    });
    await manager.sendFollowUpPrompt({
      sessionID: "session-demo-1",
      prompt: "Add tests",
    });

    expect(calls.prompt).toEqual([
      {
        sessionID: "session-demo-1",
        parts: [{ type: "text", text: "Start implementation" }],
        model: undefined,
      },
      {
        sessionID: "session-demo-1",
        parts: [{ type: "text", text: "Add tests" }],
        model: undefined,
      },
    ]);
  });
});

describe("ConversationManager messages and events", () => {
  test("lists and normalizes messages for UI rendering", async () => {
    const { manager, calls } = createManagerHarness();

    await manager.createTaskSession({
      projectId: "project-a",
      taskId: "task-3",
      projectDirectory: "/tmp/project",
      worktreeDirectory: "/tmp/project/.worktrees/task-3",
    });

    const messages = await manager.listConversationMessages({
      sessionID: "session-demo-1",
    });

    expect(calls.messages[0]).toEqual({
      sessionID: "session-demo-1",
    });
    expect(messages).toEqual([
      {
        id: "msg-1",
        sessionID: "session-demo-1",
        role: "assistant",
        createdAt: 1700000002000,
        partCount: 1,
        preview: "Ready.",
        hasError: false,
      },
      {
        id: "msg-2",
        sessionID: "session-demo-1",
        role: "assistant",
        createdAt: 1700000003000,
        partCount: 1,
        preview: "Follow-up details",
        hasError: false,
      },
    ]);
  });

  test("wraps event subscription and exposes unsubscribe", async () => {
    const { manager, calls } = createManagerHarness();

    await manager.createTaskSession({
      projectId: "project-a",
      taskId: "task-4",
      projectDirectory: "/tmp/project",
      worktreeDirectory: "/tmp/project/.worktrees/task-4",
    });

    const subscription = await manager.subscribeToEvents({
      sessionID: "session-demo-1",
    });

    expect(calls.subscribe[0]).toEqual({
      directory: "/tmp/project/.worktrees/task-4",
    });

    await subscription.unsubscribe();

    expect(calls.unsubscribeCalls).toBe(1);
  });
});
