import { describe, expect, test } from "bun:test";

import {
  WorktreeManager,
  buildTaskWorktreeName,
  resolveCleanupPolicy,
  shouldRemoveWorktree,
} from "./worktree-manager";

type WorktreeCall = {
  directory?: string;
  worktreeCreateInput?: {
    name?: string;
    startCommand?: string;
  };
  worktreeResetInput?: {
    directory: string;
  };
  worktreeRemoveInput?: {
    directory: string;
  };
};

function createManagerHarness() {
  const calls: {
    create: WorktreeCall[];
    list: Array<{ directory?: string }>;
    reset: WorktreeCall[];
    remove: WorktreeCall[];
    clientDirectories: string[];
  } = {
    create: [],
    list: [],
    reset: [],
    remove: [],
    clientDirectories: [],
  };

  const manager = new WorktreeManager({
    async getClient(directory: string) {
      calls.clientDirectories.push(directory);

      return {
        worktree: {
          create: async (parameters?: WorktreeCall) => {
            calls.create.push(parameters ?? {});
            return {
              data: {
                name: parameters?.worktreeCreateInput?.name ?? "task-demo-123",
                branch: "task/demo",
                directory: `${directory}/.worktrees/task-demo-123`,
              },
            };
          },
          list: async (parameters?: { directory?: string }) => {
            calls.list.push(parameters ?? {});
            return {
              data: [
                `${directory}/.worktrees/task-demo-111`,
                `${directory}/.worktrees/task-demo-222`,
              ],
            };
          },
          reset: async (parameters?: WorktreeCall) => {
            calls.reset.push(parameters ?? {});
            return {
              data: true,
            };
          },
          remove: async (parameters?: WorktreeCall) => {
            calls.remove.push(parameters ?? {});
            return {
              data: true,
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

describe("WorktreeManager naming", () => {
  test("builds deterministic task worktree names", () => {
    expect(buildTaskWorktreeName("task42", 1700000000000)).toBe("task-task42-1700000000000");
  });

  test("rejects invalid task ids for naming", () => {
    expect(() => buildTaskWorktreeName("task 42")).toThrow(
      "Task id can only include letters, numbers, hyphen, and underscore",
    );
  });
});

describe("WorktreeManager SDK operations", () => {
  test("creates worktree through SDK and stores task mapping", async () => {
    const { manager, calls } = createManagerHarness();

    const created = await manager.createTaskWorktree({
      projectDirectory: "/tmp/project",
      taskId: "abc_42",
      timestamp: 1700000000000,
      startCommand: "bun test",
    });

    expect(created.name).toBe("task-abc_42-1700000000000");
    expect(created.projectDirectory).toBe("/tmp/project");
    expect(created.taskId).toBe("abc_42");
    expect(manager.getTaskWorktreeDirectory("abc_42")).toBe(
      "/tmp/project/.worktrees/task-demo-123",
    );
    expect(calls.create[0]).toEqual({
      directory: "/tmp/project",
      worktreeCreateInput: {
        name: "task-abc_42-1700000000000",
        startCommand: "bun test",
      },
    });
  });

  test("lists worktrees through SDK", async () => {
    const { manager, calls } = createManagerHarness();

    const directories = await manager.listWorktrees("/tmp/project");

    expect(calls.list[0]).toEqual({
      directory: "/tmp/project",
    });
    expect(directories).toEqual([
      "/tmp/project/.worktrees/task-demo-111",
      "/tmp/project/.worktrees/task-demo-222",
    ]);
  });

  test("resets and removes a worktree through SDK", async () => {
    const { manager, calls } = createManagerHarness();

    const resetResult = await manager.resetWorktree("/tmp/project", "/tmp/project/.worktrees/task-a");
    const removeResult = await manager.removeWorktree(
      "/tmp/project",
      "/tmp/project/.worktrees/task-a",
    );

    expect(resetResult).toBe(true);
    expect(removeResult).toBe(true);
    expect(calls.reset[0]).toEqual({
      directory: "/tmp/project",
      worktreeResetInput: {
        directory: "/tmp/project/.worktrees/task-a",
      },
    });
    expect(calls.remove[0]).toEqual({
      directory: "/tmp/project",
      worktreeRemoveInput: {
        directory: "/tmp/project/.worktrees/task-a",
      },
    });
  });
});

describe("WorktreeManager cleanup policy", () => {
  test("helper identifies remove policy", () => {
    expect(shouldRemoveWorktree("remove")).toBe(true);
    expect(shouldRemoveWorktree("keep")).toBe(false);
  });

  test("helper resolves undefined policy to keep", () => {
    expect(resolveCleanupPolicy(undefined)).toBe("keep");
    expect(resolveCleanupPolicy(undefined, "remove")).toBe("remove");
  });

  test("keep policy preserves task mapping", async () => {
    const { manager, calls } = createManagerHarness();

    await manager.createTaskWorktree({
      projectDirectory: "/tmp/project",
      taskId: "keep_case",
      timestamp: 1700000000001,
    });

    const result = await manager.cleanupTaskWorktree({
      projectDirectory: "/tmp/project",
      taskId: "keep_case",
      policy: "keep",
    });

    expect(result).toEqual({
      policy: "keep",
      taskId: "keep_case",
      worktreeDirectory: "/tmp/project/.worktrees/task-demo-123",
      removed: false,
    });
    expect(calls.remove.length).toBe(0);
    expect(manager.getTaskWorktreeDirectory("keep_case")).toBe(
      "/tmp/project/.worktrees/task-demo-123",
    );
  });

  test("remove policy deletes worktree and clears task mapping", async () => {
    const { manager, calls } = createManagerHarness();

    await manager.createTaskWorktree({
      projectDirectory: "/tmp/project",
      taskId: "remove_case",
      timestamp: 1700000000001,
    });

    const result = await manager.cleanupTaskWorktree({
      projectDirectory: "/tmp/project",
      taskId: "remove_case",
      policy: "remove",
    });

    expect(result).toEqual({
      policy: "remove",
      taskId: "remove_case",
      worktreeDirectory: "/tmp/project/.worktrees/task-demo-123",
      removed: true,
    });
    expect(calls.remove[0]).toEqual({
      directory: "/tmp/project",
      worktreeRemoveInput: {
        directory: "/tmp/project/.worktrees/task-demo-123",
      },
    });
    expect(manager.getTaskWorktreeDirectory("remove_case")).toBeUndefined();
  });
});
