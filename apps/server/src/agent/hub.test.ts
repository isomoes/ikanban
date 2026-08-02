import type { ClientCommand } from "@pi-web/protocol";
import { describe, expect, it, vi } from "vitest";
import { AgentHub } from "./hub.js";
import type { PiRuntimeFactory, PiSessionPort } from "./types.js";

type WithoutCommandEnvelope<T> = T extends unknown ? Omit<T, "protocolVersion" | "commandId"> : never;

function command(input: WithoutCommandEnvelope<ClientCommand>): ClientCommand {
  return { ...input, protocolVersion: 1, commandId: crypto.randomUUID() } as ClientCommand;
}

function runtimeHarness(includeSessions = true) {
  let nextSession = 0;
  const prompts = new Map<string, ReturnType<typeof vi.fn>>();
  const aborts = new Map<string, ReturnType<typeof vi.fn>>();
  const disposals: ReturnType<typeof vi.fn>[] = [];
  const factory: PiRuntimeFactory = vi.fn(async (workspace, requestedSession) => {
    const sessionId = requestedSession ?? (requestedSession === null ? `new-${++nextSession}` : `recent-${workspace.split("/").pop()}`);
    const prompt = vi.fn(async () => undefined);
    const abort = vi.fn(async () => undefined);
    prompts.set(`${workspace}:${sessionId}`, prompt);
    aborts.set(`${workspace}:${sessionId}`, abort);
    const session: PiSessionPort = {
      sessionId,
      isStreaming: false,
      messages: [],
      thinkingLevels: [],
      prompt,
      steer: prompt,
      followUp: prompt,
      abort,
      setModel: async () => undefined,
      setThinkingLevel: () => undefined,
      subscribe: () => () => undefined,
    };
    const dispose = vi.fn();
    disposals.push(dispose);
    return {
      session,
      models: [],
      sessions: includeSessions ? [{ id: sessionId, title: sessionId, modified: "2026-08-02T00:00:00.000Z", messageCount: 0 }] : [],
      commands: [],
      newSession: async () => ({ cancelled: false }),
      switchSession: async () => ({ cancelled: false }),
      dispose,
    };
  });
  return { factory, prompts, aborts, disposals };
}

describe("AgentHub", () => {
  it("keeps distinct runtimes for sessions across multiple workspaces", async () => {
    const harness = runtimeHarness();
    const hub = await AgentHub.create({
      workspace: "/work/one",
      runtimeFactory: harness.factory,
      resolveWorkspace: async (path) => path,
    });
    const connection = hub.connect();

    await connection.handle(command({ type: "prompt.send", text: "one" }));
    await connection.handle(command({ type: "session.new", workspace: "/work/one" }));
    await connection.handle(command({ type: "prompt.send", text: "new" }));
    await connection.handle(command({ type: "workspace.open", path: "/work/two" }));
    await connection.handle(command({ type: "prompt.send", text: "two" }));

    expect(harness.prompts.get("/work/one:recent-one")).toHaveBeenCalledWith("one");
    expect(harness.prompts.get("/work/one:new-1")).toHaveBeenCalledWith("new");
    expect(harness.prompts.get("/work/two:recent-two")).toHaveBeenCalledWith("two");
    expect(connection.snapshot().workspaces.map((workspace) => workspace.path)).toEqual(["/work/one", "/work/two"]);

    await hub.dispose();
  });

  it("selects an existing session without replacing or aborting another runtime", async () => {
    const harness = runtimeHarness();
    const hub = await AgentHub.create({
      workspace: "/work/one",
      runtimeFactory: harness.factory,
      resolveWorkspace: async (path) => path,
    });
    const connection = hub.connect();

    await connection.handle(command({ type: "session.switch", workspace: "/work/one", sessionId: "saved" }));
    await connection.handle(command({ type: "prompt.send", text: "saved prompt" }));
    await connection.handle(command({ type: "session.switch", workspace: "/work/one", sessionId: "recent-one" }));

    expect(harness.factory).toHaveBeenCalledWith("/work/one", "saved");
    expect(harness.prompts.get("/work/one:saved")).toHaveBeenCalledWith("saved prompt");
    expect(harness.aborts.get("/work/one:saved")).not.toHaveBeenCalled();
    expect(harness.disposals.every((dispose) => dispose.mock.calls.length === 0)).toBe(true);

    await hub.dispose();
    expect(harness.disposals.every((dispose) => dispose.mock.calls.length === 1)).toBe(true);
  });

  it("canonicalizes and reuses a workspace opened more than once", async () => {
    const harness = runtimeHarness();
    const hub = await AgentHub.create({
      workspace: "/work/one",
      runtimeFactory: harness.factory,
      resolveWorkspace: async (path) => path.replace(/\/$/, ""),
    });
    const connection = hub.connect();

    await connection.handle(command({ type: "workspace.open", path: "/work/two/" }));
    await connection.handle(command({ type: "workspace.open", path: "/work/two" }));

    expect(harness.factory).toHaveBeenCalledTimes(2);
    expect(connection.snapshot().workspaces.map((workspace) => workspace.path)).toEqual(["/work/one", "/work/two"]);
    await hub.dispose();
  });

  it("hides archived sessions without aborting or disposing their runtimes", async () => {
    const harness = runtimeHarness();
    const archived = new Set<string>();
    const archiveStore = {
      has: (workspace: string, sessionId: string) => archived.has(`${workspace}:${sessionId}`),
      archive: vi.fn(async (workspace: string, sessionId: string) => {
        archived.add(`${workspace}:${sessionId}`);
      }),
    };
    const hub = await AgentHub.create({
      workspace: "/work/one",
      runtimeFactory: harness.factory,
      resolveWorkspace: async (path) => path,
      archiveStore,
    });
    const connection = hub.connect();
    await connection.handle(command({ type: "session.switch", workspace: "/work/one", sessionId: "saved" }));

    await connection.handle(command({ type: "session.archive", workspace: "/work/one", sessionId: "saved" }));

    expect(archiveStore.archive).toHaveBeenCalledWith("/work/one", "saved");
    expect(connection.snapshot().workspaces[0]?.sessions.map((session) => session.id)).toEqual(["recent-one"]);
    expect(harness.aborts.get("/work/one:saved")).not.toHaveBeenCalled();
    expect(harness.disposals.every((dispose) => dispose.mock.calls.length === 0)).toBe(true);
    await hub.dispose();
  });

  it("uses the runtime-open time for sessions without persisted metadata", async () => {
    const harness = runtimeHarness(false);
    const startedAt = Date.now();
    const hub = await AgentHub.create({
      workspace: "/work/one",
      runtimeFactory: harness.factory,
      resolveWorkspace: async (path) => path,
    });

    const modified = hub.snapshot().workspaces[0]?.sessions[0]?.modified;
    expect(Date.parse(modified ?? "")).toBeGreaterThanOrEqual(startedAt);
    await hub.dispose();
  });
});
