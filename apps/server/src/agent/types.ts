export type PiEvent = Readonly<Record<string, unknown> & { type: string }>;

export interface PiSessionPort {
  readonly sessionId: string;
  readonly isStreaming: boolean;
  readonly messages: readonly unknown[];
  readonly model?: { provider: string; id: string };
  prompt(text: string): Promise<void>;
  steer(text: string): Promise<void>;
  followUp(text: string): Promise<void>;
  abort(): Promise<void>;
  subscribe(listener: (event: PiEvent) => void): () => void;
}

export interface PiRuntimePort {
  readonly session: PiSessionPort;
  newSession(): Promise<void>;
  dispose(): void;
}

export type PiRuntimeFactory = (workspace: string) => Promise<PiRuntimePort>;
