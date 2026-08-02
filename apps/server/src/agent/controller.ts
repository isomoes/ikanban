import type { AgentEvent, ClientCommand, RuntimeSnapshot, ServerMessage, TranscriptItem } from "@pi-web/protocol";
import { normalizePiEvent, textFromMessage, transcriptFromMessages } from "./transcript.js";
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
  #transcript: TranscriptItem[];
  #tail: Promise<void> = Promise.resolve();
  #unsubscribe: (() => void) | undefined;
  #sequence = 0;
  #itemSequence = 0;
  #textItemId: string | undefined;
  #activePrompt: Promise<void> | undefined;
  #replacement: Promise<void> | undefined;
  #status: RuntimeSnapshot["status"] | undefined;
  #disposing = false;
  #disposePromise: Promise<void> | undefined;

  private constructor(workspace: string, runtime: PiRuntimePort) {
    this.#workspace = workspace;
    this.#runtime = runtime;
    this.#transcript = transcriptFromMessages(runtime.session.messages);
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
      items: [...this.#transcript],
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
      if (this.#disposing) {
        this.#reject(command.commandId, "Controller is disposing.");
        return;
      }
      if (this.#replacement) {
        this.#reject(command.commandId, "Session replacement is in progress.");
        return;
      }
      completion = this.#handle(command);
    });
    this.#tail = admission.catch(() => undefined);
    return admission.then(() => completion);
  }

  dispose(): Promise<void> {
    if (!this.#disposePromise) {
      this.#disposing = true;
      this.#disposePromise = this.#tail.then(async () => {
        let failure: unknown;
        try {
          if (this.#replacement) await this.#replacement;
        } catch (error) {
          failure = error;
        }
        this.#unsubscribe?.();
        this.#unsubscribe = undefined;
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
      if (command.type === "prompt.send" || command.type === "prompt.steer" || command.type === "prompt.followUp") {
        this.#transcript = [...this.#transcript, {
          id: `live-user-${++this.#itemSequence}`,
          type: "message",
          role: "user",
          text: command.text,
        }];
      }
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
        case "session.new": {
          this.#status = "replacing";
          const replacement = this.#replaceSession();
          this.#replacement = replacement;
          try {
            await replacement;
          } finally {
            if (this.#replacement === replacement) this.#replacement = undefined;
            if (this.#status === "replacing") this.#status = undefined;
          }
          break;
        }
      }
    } catch (error) {
      this.#status = "error";
      this.#reject(command.commandId, error instanceof Error ? error.message : "Unknown command failure");
    }
  }

  async #replaceSession(): Promise<void> {
    if ((await this.#runtime.newSession()).cancelled) return;

    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#resetTransientIds();
    this.#transcript = transcriptFromMessages(this.#runtime.session.messages);
    if (this.#disposing) return;

    this.#subscribeToSession();
    this.#status = undefined;
    this.#emit({ type: "state.snapshot", snapshot: this.snapshot() });
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
        const piId = typeof message.id === "string" ? message.id : undefined;
        this.#textItemId = piId && !this.#transcript.some((item) => item.id === piId)
          ? piId
          : `live-${++this.#itemSequence}`;
      }
    }
    if (event.type === "message_end") this.#reconcileAssistantMessage(event.message);
    const normalized = normalizePiEvent(event, () => {
      this.#textItemId ??= `live-${++this.#itemSequence}`;
      return this.#textItemId;
    });
    if (normalized) {
      this.#projectEvent(normalized);
      this.#emit({ type: "agent.event", sessionId: this.#runtime.session.sessionId, event: normalized });
    }
    if (event.type === "agent_end" || event.type === "message_end") this.#textItemId = undefined;
  }

  #reconcileAssistantMessage(message: unknown): void {
    const value = typeof message === "object" && message !== null
      ? message as Record<string, unknown>
      : undefined;
    if (value?.role !== "assistant") return;

    const text = textFromMessage(value);
    if (text === undefined) return;

    const streamedId = this.#textItemId;
    if (streamedId) {
      const streamedIndex = this.#transcript.findIndex((item) =>
        item.id === streamedId && item.type === "message" && item.role === "assistant"
      );
      if (streamedIndex !== -1) {
        this.#replaceOrAppendTranscriptItem(streamedIndex, {
          id: streamedId,
          type: "message",
          role: "assistant",
          text,
        });
        return;
      }
    }

    const piId = typeof value.id === "string" ? value.id : undefined;
    const existing = piId ? this.#transcript.find((item) => item.id === piId) : undefined;
    if (existing?.type === "message" && existing.role === "assistant" && existing.text === text) return;

    const itemId = this.#textItemId
      ?? (piId && !existing ? piId : `live-${++this.#itemSequence}`);
    this.#transcript = [...this.#transcript, {
      id: itemId,
      type: "message",
      role: "assistant",
      text,
    }];
  }

  #projectEvent(event: AgentEvent): void {
    const index = "itemId" in event
      ? this.#transcript.findIndex((item) => item.id === event.itemId)
      : -1;

    switch (event.type) {
      case "text.delta": {
        const current = this.#transcript[index];
        const item: TranscriptItem = current?.type === "message" && current.role === "assistant"
          ? { ...current, text: current.text + event.delta }
          : { id: event.itemId, type: "message", role: "assistant", text: event.delta };
        this.#replaceOrAppendTranscriptItem(index, item);
        break;
      }
      case "tool.started":
        this.#replaceOrAppendTranscriptItem(index, {
          id: event.itemId,
          type: "tool",
          toolName: event.toolName,
          status: "running",
          output: "",
        });
        break;
      case "tool.updated": {
        const current = this.#transcript[index];
        this.#replaceOrAppendTranscriptItem(index, {
          id: event.itemId,
          type: "tool",
          toolName: current?.type === "tool" ? current.toolName : "unknown",
          status: "running",
          output: event.output,
        });
        break;
      }
      case "tool.finished": {
        const current = this.#transcript[index];
        this.#replaceOrAppendTranscriptItem(index, {
          id: event.itemId,
          type: "tool",
          toolName: current?.type === "tool" ? current.toolName : "unknown",
          status: event.isError ? "failed" : "succeeded",
          output: event.output,
        });
        break;
      }
      case "agent.error":
        this.#transcript = [...this.#transcript, {
          id: `live-error-${++this.#itemSequence}`,
          type: "error",
          message: event.message,
        }];
        break;
    }
  }

  #replaceOrAppendTranscriptItem(index: number, item: TranscriptItem): void {
    if (index === -1) {
      this.#transcript = [...this.#transcript, item];
      return;
    }
    this.#transcript = this.#transcript.map((current, currentIndex) => currentIndex === index ? item : current);
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
