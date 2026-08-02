import type { ModelOption, SessionOption, SlashCommandOption } from "@pi-web/protocol";

export type PiEvent = Readonly<Record<string, unknown> & { type: string }>;

export interface PiSessionPort {
  readonly sessionId: string;
  readonly isStreaming: boolean;
  readonly messages: readonly unknown[];
  readonly model?: { provider: string; id: string };
  readonly thinkingLevel?: string;
  readonly thinkingLevels: readonly string[];
  prompt(text: string): Promise<void>;
  steer(text: string): Promise<void>;
  followUp(text: string): Promise<void>;
  abort(): Promise<void>;
  setModel(provider: string, modelId: string): Promise<void>;
  setThinkingLevel(level: string): void;
  subscribe(listener: (event: PiEvent) => void): () => void;
}

export interface PiRuntimePort {
  readonly session: PiSessionPort;
  readonly models: readonly ModelOption[];
  readonly sessions: readonly SessionOption[];
  readonly commands: readonly SlashCommandOption[];
  newSession(): Promise<{ cancelled: boolean }>;
  switchSession(sessionId: string): Promise<{ cancelled: boolean }>;
  dispose(): void | Promise<void>;
}

export type PiRuntimeFactory = (workspace: string, sessionId?: string | null) => Promise<PiRuntimePort>;
