import type { ClientCommand, RuntimeSnapshot, ServerMessage } from "@pi-web/protocol";
import { normalizePiEvent, transcriptFromMessages } from "./transcript.js";
import type { PiEvent, PiRuntimeFactory, PiRuntimePort } from "./types.js";

type WithoutEnvelope<T> = T extends unknown ? Omit<T, "protocolVersion" | "sequence"> : never;
type UnsequencedServerMessage = WithoutEnvelope<ServerMessage>;

export interface AgentControllerOptions {
  workspace: string;
  runtimeFactory: PiRuntimeFactory;
}

export class AgentController {
  readonly #workspace: string;
  readonly #runtime: PiRuntimePort;
  readonly #listeners = new Set<(message: ServerMessage) => void>();
  #tail: Promise<void> = Promise.resolve();
  #unsubscribe: (() => void) | undefined;
  #sequence = 0;
  #itemSequence = 0;
  #textItemId: string | undefined;
  #activePrompt: Promise<void> | undefined;
  #status: RuntimeSnapshot["status"] | undefined;
  #disposing = false;
  #disposePromise: Promise<void> | undefined;

  private constructor(workspace: string, runtime: PiRuntimePort) {
    this.#workspace = workspace;
    this.#runtime = runtime;
    this.#subscribeToSession();
  }

  static async create(options: AgentControllerOptions): Promise<AgentController> {
    return new AgentController(options.workspace, await options.runtimeFactory(options.workspace));
  }

  subscribe(listener: (message: ServerMessage) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  snapshot(): RuntimeSnapshot {
    const session = this.#runtime.session;
    const snapshot: RuntimeSnapshot = {
      workspace: this.#workspace,
      sessionId: session.sessionId,
      status: this.#status ?? (this.#activePrompt || session.isStreaming ? "running" : "idle"),
      items: transcriptFromMessages(session.messages),
    };
    if (session.model) snapshot.model = `${session.model.provider}/${session.model.id}`;
    return snapshot;
  }

  handle(command: ClientCommand): Promise<void> {
    if (this.#disposing) {
      this.#reject(command.commandId, "Controller is disposing.");
      return Promise.resolve();
    }

    let completion = Promise.resolve();
    const admission = this.#tail.then(() => {
      completion = this.#handle(command);
    });
    this.#tail = admission.catch(() => undefined);
    return admission.then(() => completion);
  }

  dispose(): Promise<void> {
    if (!this.#disposePromise) {
      this.#disposing = true;
      this.#disposePromise = this.#tail.then(async () => {
        this.#unsubscribe?.();
        this.#unsubscribe = undefined;
        let failure: unknown;
        try {
          if (this.#activePrompt || this.#runtime.session.isStreaming) await this.#runtime.session.abort();
        } catch (error) {
          failure = error;
        }
        try {
          await this.#runtime.dispose();
        } catch (error) {
          failure ??= error;
        }
        if (failure) throw failure;
      });
      this.#tail = this.#disposePromise.catch(() => undefined);
    }
    return this.#disposePromise;
  }

  async #handle(command: ClientCommand): Promise<void> {
    try {
      if (command.type === "prompt.send" && (this.#activePrompt || this.#runtime.session.isStreaming)) {
        this.#reject(command.commandId, "A run is already active; steer, follow up, or abort it.");
        return;
      }
      if (command.type === "session.new" && (this.#activePrompt || this.#runtime.session.isStreaming)) {
        this.#reject(command.commandId, "A run is already active; abort it before starting a new session.");
        return;
      }
      if ((command.type === "prompt.steer" || command.type === "prompt.followUp" || command.type === "run.abort") && !this.#activePrompt && !this.#runtime.session.isStreaming) {
        this.#reject(command.commandId, "No run is active.");
        return;
      }

      this.#status = undefined;
      this.#emit({ type: "command.accepted", commandId: command.commandId });
      switch (command.type) {
        case "prompt.send": {
          const prompt = this.#runtime.session.prompt(command.text);
          this.#activePrompt = prompt;
          try {
            await prompt;
          } finally {
            if (this.#activePrompt === prompt) this.#activePrompt = undefined;
          }
          break;
        }
        case "prompt.steer":
          await this.#runtime.session.steer(command.text);
          break;
        case "prompt.followUp":
          await this.#runtime.session.followUp(command.text);
          break;
        case "run.abort":
          await this.#runtime.session.abort();
          break;
        case "session.new":
          this.#status = "replacing";
          if ((await this.#runtime.newSession()).cancelled) {
            this.#status = undefined;
            break;
          }
          this.#unsubscribe?.();
          this.#resetTransientIds();
          this.#subscribeToSession();
          this.#status = undefined;
          this.#emit({ type: "state.snapshot", snapshot: this.snapshot() });
          break;
      }
    } catch (error) {
      this.#status = "error";
      this.#reject(command.commandId, error instanceof Error ? error.message : "Unknown command failure");
    }
  }

  #subscribeToSession(): void {
    this.#unsubscribe = this.#runtime.session.subscribe((event) => this.#onEvent(event));
  }

  #onEvent(event: PiEvent): void {
    if (event.type === "agent_start") {
      this.#status = undefined;
      this.#textItemId = undefined;
    } else if (event.type === "message_start") {
      const message = typeof event.message === "object" && event.message !== null
        ? event.message as Record<string, unknown>
        : undefined;
      if (message?.role === "assistant") {
        this.#textItemId = typeof message.id === "string" ? message.id : `live-${++this.#itemSequence}`;
      }
    }
    const normalized = normalizePiEvent(event, () => {
      this.#textItemId ??= `live-${++this.#itemSequence}`;
      return this.#textItemId;
    });
    if (normalized) {
      this.#emit({ type: "agent.event", sessionId: this.#runtime.session.sessionId, event: normalized });
    }
    if (event.type === "agent_end" || event.type === "message_end") this.#textItemId = undefined;
  }

  #resetTransientIds(): void {
    this.#itemSequence = 0;
    this.#textItemId = undefined;
  }

  #reject(commandId: string, reason: string): void {
    this.#emit({ type: "command.rejected", commandId, reason });
  }

  #emit(message: UnsequencedServerMessage): void {
    const sequenced = { ...message, protocolVersion: 1 as const, sequence: ++this.#sequence } as ServerMessage;
    for (const listener of this.#listeners) {
      try {
        listener(sequenced);
      } catch {
        // A subscriber cannot interrupt runtime control or other subscribers.
      }
    }
  }
}
