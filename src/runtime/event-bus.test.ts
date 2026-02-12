import { describe, expect, test } from "bun:test";

import { RuntimeEventBus } from "./event-bus";

describe("RuntimeEventBus event fan-out", () => {
  test("preserves event ordering across listeners", () => {
    const bus = new RuntimeEventBus();
    const events: string[] = [];
    const uiActions: string[] = [];
    const logs: string[] = [];

    bus.subscribe((event) => {
      events.push(`${event.sequence}:${event.type}`);
    });

    bus.subscribeToUiUpdates((update) => {
      uiActions.push(`${update.sequence}:${update.eventType}`);
    });

    bus.subscribeToLogs((entry) => {
      logs.push(`${entry.sequence}:${entry.level}:${entry.message}`);
    });

    bus.emit("task.created", {
      taskId: "task-1",
      projectId: "project-a",
      state: "queued",
      createdAt: 1,
    });
    bus.emit("worktree.created", {
      taskId: "task-1",
      projectId: "project-a",
      directory: "/tmp/project/.worktrees/task-1",
      branch: "task-1",
      name: "task-task-1-1",
      createdAt: 2,
    });
    bus.emit("session.created", {
      taskId: "task-1",
      projectId: "project-a",
      sessionID: "session-1",
      directory: "/tmp/project/.worktrees/task-1",
      createdAt: 3,
      title: "Task 1",
    });
    bus.emit("log.appended", {
      level: "warn",
      message: "Retrying after transient failure",
      taskId: "task-1",
      projectId: "project-a",
      source: "orchestrator",
    });

    expect(events).toEqual([
      "1:task.created",
      "2:worktree.created",
      "3:session.created",
      "4:log.appended",
    ]);
    expect(uiActions).toEqual([
      "1:task.created",
      "2:worktree.created",
      "3:session.created",
    ]);
    expect(logs).toEqual([
      "1:info:Task task-1 created in state queued.",
      "2:info:Worktree task-task-1-1 created at /tmp/project/.worktrees/task-1.",
      "3:info:Session session-1 created.",
      "4:warn:Retrying after transient failure",
    ]);
  });
});

describe("RuntimeEventBus listener cleanup", () => {
  test("unsubscribes listeners and keeps unsubscribe idempotent", () => {
    const bus = new RuntimeEventBus();
    const events: string[] = [];
    const ui: string[] = [];
    const logs: string[] = [];

    const unsubscribeEvents = bus.subscribe((event) => {
      events.push(event.type);
    });
    const unsubscribeUi = bus.subscribeToUiUpdates((update) => {
      ui.push(update.eventType);
    });
    const unsubscribeLogs = bus.subscribeToLogs((entry) => {
      logs.push(entry.message);
    });

    bus.emit("task.created", {
      taskId: "task-2",
      projectId: "project-a",
      state: "queued",
      createdAt: 10,
    });

    expect(bus.listenerCount()).toBe(3);

    unsubscribeEvents();
    unsubscribeUi();
    unsubscribeLogs();

    unsubscribeEvents();
    unsubscribeUi();
    unsubscribeLogs();

    expect(bus.listenerCount()).toBe(0);

    bus.emit("task.completed", {
      taskId: "task-2",
      projectId: "project-a",
      completedAt: 11,
    });

    expect(events).toEqual(["task.created"]);
    expect(ui).toEqual(["task.created"]);
    expect(logs).toEqual(["Task task-2 created in state queued."]);
  });
});
