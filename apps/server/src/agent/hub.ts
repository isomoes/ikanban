import { realpath, stat } from "node:fs/promises";
import { basename, isAbsolute } from "node:path";
import type { ClientCommand, RuntimeSnapshot, ServerMessage, SessionOption, WorkspaceOption } from "@pi-web/protocol";
import { AgentController } from "./controller.js";
import type { SessionArchiveStore } from "./archive.js";
import type { PiRuntimeFactory } from "./types.js";

type MessageListener = (message: ServerMessage) => void;
type WithoutServerEnvelope<T> = T extends unknown ? Omit<T, "protocolVersion" | "sequence"> : never;
type UnsequencedServerMessage = WithoutServerEnvelope<ServerMessage>;

interface ControllerEntry {
  workspace: string;
  sessionId: string;
  openedAt: string;
  controller: AgentController;
}

export interface AgentHubOptions {
  workspace: string;
  runtimeFactory: PiRuntimeFactory;
  resolveWorkspace?: (path: string) => Promise<string>;
  archiveStore?: SessionArchiveStore;
}

function createMemoryArchiveStore(): SessionArchiveStore {
  const archived = new Set<string>();
  const key = (workspace: string, sessionId: string) => JSON.stringify([workspace, sessionId]);
  return {
    has: (workspace, sessionId) => archived.has(key(workspace, sessionId)),
    archive: async (workspace, sessionId) => { archived.add(key(workspace, sessionId)); },
  };
}

async function resolveDirectory(path: string): Promise<string> {
  if (!isAbsolute(path)) throw new Error("Workspace path must be absolute.");
  const resolved = await realpath(path);
  if (!(await stat(resolved)).isDirectory()) throw new Error(`${path} is not a directory.`);
  return resolved;
}

export class AgentHubConnection {
  readonly #hub: AgentHub;
  readonly #listeners = new Set<MessageListener>();
  #selected: ControllerEntry;
  #sequence = 0;
  #disposed = false;

  constructor(hub: AgentHub, selected: ControllerEntry) {
    this.#hub = hub;
    this.#selected = selected;
  }

  snapshot(): RuntimeSnapshot {
    return this.#hub.decorate(this.#selected.controller.snapshot());
  }

  subscribe(listener: MessageListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async handle(command: ClientCommand): Promise<void> {
    if (this.#disposed) return;
    try {
      if (command.type === "workspace.open") {
        this.#selected = await this.#hub.openWorkspace(command.path);
        this.emit({ type: "command.accepted", commandId: command.commandId });
        this.emitSnapshot();
        return;
      }
      if (command.type === "session.new") {
        this.#selected = await this.#hub.newSession(command.workspace ?? this.#selected.workspace);
        this.emit({ type: "command.accepted", commandId: command.commandId });
        this.emitSnapshot();
        return;
      }
      if (command.type === "session.switch") {
        this.#selected = await this.#hub.openSession(
          command.workspace ?? this.#selected.workspace,
          command.sessionId,
        );
        this.emit({ type: "command.accepted", commandId: command.commandId });
        this.emitSnapshot();
        return;
      }
      if (command.type === "session.archive") {
        await this.#hub.archiveSession(command.workspace, command.sessionId);
        this.emit({ type: "command.accepted", commandId: command.commandId });
        this.emitSnapshot();
        return;
      }
      await this.#selected.controller.handle(command);
    } catch (error) {
      this.emit({
        type: "command.rejected",
        commandId: command.commandId,
        reason: error instanceof Error ? error.message : "Unknown workspace command failure",
      });
    }
  }

  selected(entry: ControllerEntry): boolean {
    return this.#selected === entry;
  }

  forward(message: ServerMessage): void {
    if (message.type === "state.snapshot") {
      this.emit({ type: "state.snapshot", snapshot: this.#hub.decorate(message.snapshot) });
      return;
    }
    const { protocolVersion: _protocolVersion, sequence: _sequence, ...body } = message;
    this.emit(body);
  }

  emitSnapshot(): void {
    this.emit({ type: "state.snapshot", snapshot: this.snapshot() });
  }

  dispose(): Promise<void> {
    if (!this.#disposed) {
      this.#disposed = true;
      this.#listeners.clear();
      this.#hub.disconnect(this);
    }
    return Promise.resolve();
  }

  private emit(message: UnsequencedServerMessage): void {
    const sequenced = {
      ...message,
      protocolVersion: 1 as const,
      sequence: ++this.#sequence,
    } as ServerMessage;
    for (const listener of this.#listeners) listener(sequenced);
  }
}

export class AgentHub {
  readonly #runtimeFactory: PiRuntimeFactory;
  readonly #resolveWorkspace: (path: string) => Promise<string>;
  readonly #archiveStore: SessionArchiveStore;
  readonly #entries = new Map<string, Map<string, Promise<ControllerEntry>>>();
  readonly #resolvedEntries = new Map<string, Map<string, ControllerEntry>>();
  readonly #defaults = new Map<string, Promise<ControllerEntry>>();
  readonly #knownSessions = new Map<string, Map<string, SessionOption>>();
  readonly #workspaceOrder: string[] = [];
  readonly #connections = new Set<AgentHubConnection>();
  #newSessionSequence = 0;
  #initial!: ControllerEntry;
  #disposed = false;

  private constructor(options: AgentHubOptions) {
    this.#runtimeFactory = options.runtimeFactory;
    this.#resolveWorkspace = options.resolveWorkspace ?? resolveDirectory;
    this.#archiveStore = options.archiveStore ?? createMemoryArchiveStore();
  }

  static async create(options: AgentHubOptions): Promise<AgentHub> {
    const hub = new AgentHub(options);
    hub.#initial = await hub.openWorkspace(options.workspace);
    return hub;
  }

  connect(): AgentHubConnection {
    if (this.#disposed) throw new Error("Session hub is disposed.");
    const connection = new AgentHubConnection(this, this.#initial);
    this.#connections.add(connection);
    return connection;
  }

  snapshot(): RuntimeSnapshot {
    return this.decorate(this.#initial.controller.snapshot());
  }

  async openWorkspace(path: string): Promise<ControllerEntry> {
    const workspace = await this.#resolveWorkspace(path);
    let pending = this.#defaults.get(workspace);
    if (!pending) {
      this.#workspaceOrder.push(workspace);
      pending = this.#createEntry(workspace, undefined);
      this.#defaults.set(workspace, pending);
      pending.catch(() => {
        this.#defaults.delete(workspace);
        this.#workspaceOrder.splice(this.#workspaceOrder.indexOf(workspace), 1);
      });
    }
    return pending;
  }

  async openSession(path: string, sessionId: string): Promise<ControllerEntry> {
    const workspace = await this.#resolveWorkspace(path);
    await this.openWorkspace(workspace);
    const existing = this.#entries.get(workspace)?.get(sessionId);
    if (existing) return existing;
    return this.#createEntry(workspace, sessionId, sessionId);
  }

  async newSession(path: string): Promise<ControllerEntry> {
    const workspace = await this.#resolveWorkspace(path);
    await this.openWorkspace(workspace);
    return this.#createEntry(workspace, null);
  }

  async archiveSession(path: string, sessionId: string): Promise<void> {
    const workspace = await this.#resolveWorkspace(path);
    await this.openWorkspace(workspace);
    const known = this.#knownSessions.get(workspace)?.has(sessionId)
      || this.#resolvedEntries.get(workspace)?.has(sessionId);
    if (!known) throw new Error(`Session ${sessionId} was not found.`);
    await this.#archiveStore.archive(workspace, sessionId);
    for (const connection of this.#connections) connection.emitSnapshot();
  }

  decorate(snapshot: RuntimeSnapshot): RuntimeSnapshot {
    const workspace = this.workspaces().find((item) => item.path === snapshot.workspace);
    return {
      ...snapshot,
      sessions: workspace?.sessions ?? snapshot.sessions,
      workspaces: this.workspaces(),
    };
  }

  workspaces(): WorkspaceOption[] {
    return this.#workspaceOrder.map((path) => {
      const sessions = new Map(this.#knownSessions.get(path));
      for (const entry of this.#resolvedEntries.get(path)?.values() ?? []) {
        const snapshot = entry.controller.snapshot();
        const existing = sessions.get(entry.sessionId);
        sessions.set(entry.sessionId, {
          id: entry.sessionId,
          title: existing?.title ?? "Untitled session",
          modified: existing?.modified ?? entry.openedAt,
          messageCount: existing?.messageCount ?? snapshot.items.filter((item) => item.type === "message").length,
          status: snapshot.status,
        });
      }
      return {
        path,
        name: basename(path) || path,
        sessions: [...sessions.values()].filter((session) => !this.#archiveStore.has(path, session.id)),
      };
    });
  }

  disconnect(connection: AgentHubConnection): void {
    this.#connections.delete(connection);
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const connection of [...this.#connections]) await connection.dispose();
    const entries = new Set<AgentController>();
    for (const pendingBySession of this.#entries.values()) {
      for (const pending of pendingBySession.values()) entries.add((await pending).controller);
    }
    await Promise.all([...entries].map((controller) => controller.dispose()));
  }

  async #createEntry(workspace: string, requestedSession: string | null | undefined, entryKey?: string): Promise<ControllerEntry> {
    const key = entryKey ?? (requestedSession === undefined ? "@default" : requestedSession ?? `@new:${++this.#newSessionSequence}`);
    let bySession = this.#entries.get(workspace);
    if (!bySession) {
      bySession = new Map();
      this.#entries.set(workspace, bySession);
      this.#resolvedEntries.set(workspace, new Map());
      this.#knownSessions.set(workspace, new Map());
    }
    const existing = bySession.get(key);
    if (existing) return existing;

    const pending = AgentController.create({
      workspace,
      runtimeFactory: this.#runtimeFactory,
      ...(requestedSession === undefined ? {} : { sessionId: requestedSession }),
    }).then((controller) => {
      const sessionId = controller.snapshot().sessionId;
      const entry = { workspace, sessionId, openedAt: new Date().toISOString(), controller };
      bySession!.set(sessionId, Promise.resolve(entry));
      this.#resolvedEntries.get(workspace)!.set(sessionId, entry);
      this.#refreshKnownSessions(entry);
      controller.subscribe((message) => this.#onControllerMessage(entry, message));
      return entry;
    });
    bySession.set(key, pending);
    pending.catch(() => bySession!.delete(key));
    return pending;
  }

  #refreshKnownSessions(entry: ControllerEntry): void {
    const known = this.#knownSessions.get(entry.workspace)!;
    for (const session of entry.controller.snapshot().sessions) known.set(session.id, session);
  }

  #onControllerMessage(entry: ControllerEntry, message: ServerMessage): void {
    this.#refreshKnownSessions(entry);
    for (const connection of this.#connections) {
      if (connection.selected(entry)) connection.forward(message);
    }
    if (
      message.type === "state.snapshot"
      || (message.type === "agent.event" && ["run.started", "run.finished", "agent.error"].includes(message.event.type))
    ) {
      for (const connection of this.#connections) {
        if (!connection.selected(entry)) connection.emitSnapshot();
      }
    }
  }
}
