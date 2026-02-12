import { resolve } from "node:path";

import {
  toConversationMessageMeta,
  type ConversationMessageLike,
  type ConversationMessageMeta,
  type ConversationSessionMeta,
} from "../domain/conversation";
import type { OpenCodeRuntime } from "./opencode-runtime";

type RuntimeClientProvider = Pick<OpenCodeRuntime, "getClient">;

type ConversationApiResponse<TData> = {
  data?: TData;
  error?: unknown;
};

type CreateSessionPayload = {
  id?: string;
  sessionID?: string;
  title?: string;
  createdAt?: number;
  updatedAt?: number;
};

export type CreateConversationSessionInput = {
  projectId: string;
  taskId: string;
  projectDirectory: string;
  worktreeDirectory: string;
  title?: string;
  timestamp?: number;
};

export type SendInitialPromptInput = {
  sessionID: string;
  prompt: string;
  worktreeDirectory?: string;
  model?: {
    providerID: string;
    modelID: string;
  };
};

export type SendFollowUpPromptInput = {
  sessionID: string;
  prompt: string;
  worktreeDirectory?: string;
  model?: {
    providerID: string;
    modelID: string;
  };
};

export type PromptSubmission = {
  sessionID: string;
  prompt: string;
  submittedAt: number;
};

export type ListConversationMessagesInput = {
  sessionID: string;
  worktreeDirectory?: string;
};

export type SubscribeToConversationEventsInput = {
  sessionID?: string;
  worktreeDirectory?: string;
  onEvent?: (event: unknown) => void;
};

export type ConversationEventSubscription = {
  directory: string;
  unsubscribe: () => Promise<void>;
};

type EventSubscribeHandle = {
  unsubscribe?: () => void | Promise<void>;
  [Symbol.asyncIterator]?: () => AsyncIterator<unknown>;
};

export class ConversationManager {
  private readonly runtime: RuntimeClientProvider;
  private readonly taskToSessionID = new Map<string, string>();
  private readonly sessionToDirectory = new Map<string, string>();
  private readonly sessionsByID = new Map<string, ConversationSessionMeta>();

  constructor(runtime: RuntimeClientProvider) {
    this.runtime = runtime;
  }

  async createTaskSession(input: CreateConversationSessionInput): Promise<ConversationSessionMeta> {
    const projectId = normalizeId(input.projectId, "Project id");
    const taskId = normalizeId(input.taskId, "Task id");
    const projectDirectory = normalizeDirectory(input.projectDirectory, "Project directory");
    const worktreeDirectory = normalizeDirectory(input.worktreeDirectory, "Worktree directory");
    const title = normalizeOptionalTitle(input.title);
    const fallbackTimestamp = normalizeTimestamp(input.timestamp ?? Date.now(), "Timestamp");
    const client = await this.runtime.getClient(worktreeDirectory);
    const payload = await readDataOrThrow<CreateSessionPayload>(
      client.session.create({
        directory: worktreeDirectory,
        title,
      }),
      "Failed to create conversation session",
    );
    const sessionID = normalizeSessionID(payload.sessionID ?? payload.id);
    const createdAt = normalizeOptionalTimestamp(payload.createdAt, fallbackTimestamp);
    const updatedAt = normalizeOptionalTimestamp(payload.updatedAt, createdAt);

    const session: ConversationSessionMeta = {
      sessionID,
      projectId,
      taskId,
      directory: worktreeDirectory,
      title: payload.title ?? title,
      createdAt,
      updatedAt,
    };

    this.taskToSessionID.set(taskId, sessionID);
    this.sessionToDirectory.set(sessionID, worktreeDirectory);
    this.sessionsByID.set(sessionID, session);

    return session;
  }

  async sendInitialPrompt(input: SendInitialPromptInput): Promise<PromptSubmission> {
    return this.sendPrompt(input, "Failed to send initial prompt");
  }

  async sendFollowUpPrompt(input: SendFollowUpPromptInput): Promise<PromptSubmission> {
    return this.sendPrompt(input, "Failed to send follow-up prompt");
  }

  async listConversationMessages(
    input: ListConversationMessagesInput,
  ): Promise<ConversationMessageMeta[]> {
    const sessionID = normalizeSessionID(input.sessionID);
    const worktreeDirectory = this.resolveDirectoryForSession(sessionID, input.worktreeDirectory);
    const client = await this.runtime.getClient(worktreeDirectory);
    const messages = await readDataOrThrow<unknown[]>(
      client.session.messages({
        sessionID,
      }),
      "Failed to list conversation messages",
    );

    const normalizedMessages = messages.map((message, index) =>
      normalizeMessageLike(message, sessionID, index),
    );

    return normalizedMessages.map((message) => toConversationMessageMeta(message));
  }

  async subscribeToEvents(
    input: SubscribeToConversationEventsInput,
  ): Promise<ConversationEventSubscription> {
    const sessionID = input.sessionID ? normalizeSessionID(input.sessionID) : undefined;
    const worktreeDirectory = sessionID
      ? this.resolveDirectoryForSession(sessionID, input.worktreeDirectory)
      : normalizeDirectoryOrThrow(input.worktreeDirectory, "Worktree directory");
    const client = await this.runtime.getClient(worktreeDirectory);
    const subscribeResult = await client.event.subscribe({
      directory: worktreeDirectory,
    });
    const subscribePayload = unwrapResponseDataOrThrow(
      subscribeResult,
      "Failed to subscribe to conversation events",
    );
    const unsubscribe = toAsyncUnsubscribe(subscribePayload, input.onEvent);

    return {
      directory: worktreeDirectory,
      unsubscribe,
    };
  }

  getTaskSessionID(taskId: string): string | undefined {
    return this.taskToSessionID.get(normalizeId(taskId, "Task id"));
  }

  getSessionDirectory(sessionID: string): string | undefined {
    return this.sessionToDirectory.get(normalizeSessionID(sessionID));
  }

  getSession(sessionID: string): ConversationSessionMeta | undefined {
    return this.sessionsByID.get(normalizeSessionID(sessionID));
  }

  private async sendPrompt(
    input: SendInitialPromptInput | SendFollowUpPromptInput,
    failureMessage: string,
  ): Promise<PromptSubmission> {
    const sessionID = normalizeSessionID(input.sessionID);
    const prompt = normalizePrompt(input.prompt);
    const worktreeDirectory = this.resolveDirectoryForSession(sessionID, input.worktreeDirectory);
    const client = await this.runtime.getClient(worktreeDirectory);

    await readDataOrThrow<unknown>(
      client.session.prompt({
        sessionID,
        parts: [{ type: "text", text: prompt }],
        model: input.model,
      }),
      failureMessage,
    );

    const submittedAt = Date.now();
    const existing = this.sessionsByID.get(sessionID);

    if (existing) {
      this.sessionsByID.set(sessionID, {
        ...existing,
        updatedAt: submittedAt,
        lastMessageAt: submittedAt,
      });
    }

    return {
      sessionID,
      prompt,
      submittedAt,
    };
  }

  private resolveDirectoryForSession(sessionID: string, explicitDirectory?: string): string {
    if (explicitDirectory) {
      const normalizedDirectory = normalizeDirectory(explicitDirectory, "Worktree directory");
      this.sessionToDirectory.set(sessionID, normalizedDirectory);
      return normalizedDirectory;
    }

    const mappedDirectory = this.sessionToDirectory.get(sessionID);
    if (mappedDirectory) {
      return mappedDirectory;
    }

    throw new Error(`Worktree directory is required for session ${sessionID}.`);
  }
}

function normalizeMessageLike(raw: unknown, sessionID: string, index: number): ConversationMessageLike {
  const message = asRecord(raw);
  const id = typeof message?.id === "string" && message.id.trim() ? message.id : `${sessionID}:${index}`;
  const role = typeof message?.role === "string" ? message.role : "assistant";
  const createdAt = normalizeOptionalTimestamp(message?.createdAt, Date.now());
  const parts = normalizeMessageParts(message?.parts);

  return {
    id,
    sessionID,
    role,
    createdAt,
    parts,
    error: message?.error,
  };
}

function normalizeMessageParts(value: unknown): Array<{ text?: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  const parts: Array<{ text?: string }> = [];

  for (const part of value) {
    if (typeof part === "string") {
      parts.push({ text: part });
      continue;
    }

    const partRecord = asRecord(part);
    if (!partRecord) {
      parts.push({});
      continue;
    }

    if (typeof partRecord.text === "string") {
      parts.push({ text: partRecord.text });
      continue;
    }

    if (typeof partRecord.content === "string") {
      parts.push({ text: partRecord.content });
      continue;
    }

    parts.push({});
  }

  return parts;
}

function toAsyncUnsubscribe(payload: unknown, onEvent?: (event: unknown) => void): () => Promise<void> {
  if (typeof payload === "function") {
    const unsubscribe = payload as () => void | Promise<void>;
    return async () => {
      await unsubscribe();
    };
  }

  const handle = asRecord(payload) as EventSubscribeHandle | undefined;

  if (handle?.unsubscribe && typeof handle.unsubscribe === "function") {
    return async () => {
      await handle.unsubscribe?.();
    };
  }

  const iteratorFactory = handle?.[Symbol.asyncIterator];

  if (typeof iteratorFactory === "function" && onEvent) {
    let closed = false;
    const iterator = iteratorFactory.call(handle);
    const pump = (async () => {
      while (!closed) {
        const nextValue = await iterator.next();
        if (nextValue.done) {
          break;
        }

        onEvent(nextValue.value);
      }
    })();

    return async () => {
      closed = true;
      await iterator.return?.();
      await pump;
    };
  }

  return async () => {};
}

function unwrapResponseDataOrThrow<TData>(response: unknown, failureMessage: string): TData {
  const responseRecord = asRecord(response);

  if (!responseRecord) {
    return response as TData;
  }

  if ("error" in responseRecord && responseRecord.error) {
    throw new Error(`${failureMessage}: ${formatUnknownError(responseRecord.error)}`);
  }

  if ("data" in responseRecord) {
    const data = responseRecord.data;
    if (data === undefined) {
      throw new Error(`${failureMessage}: response did not include data.`);
    }

    return data as TData;
  }

  return response as TData;
}

async function readDataOrThrow<TData>(
  request: Promise<ConversationApiResponse<TData>>,
  failureMessage: string,
): Promise<TData> {
  const response = await request;

  if (response.error) {
    throw new Error(`${failureMessage}: ${formatUnknownError(response.error)}`);
  }

  if (response.data === undefined) {
    throw new Error(`${failureMessage}: response did not include data.`);
  }

  return response.data;
}

function normalizeId(value: string, label: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function normalizeSessionID(sessionID: string | undefined): string {
  if (!sessionID) {
    throw new Error("Session id is required.");
  }

  return normalizeId(sessionID, "Session id");
}

function normalizePrompt(prompt: string): string {
  const normalized = prompt.trim();

  if (!normalized) {
    throw new Error("Prompt is required.");
  }

  return normalized;
}

function normalizeDirectory(directory: string, label: string): string {
  const normalizedDirectory = directory.trim();

  if (!normalizedDirectory) {
    throw new Error(`${label} is required.`);
  }

  return resolve(normalizedDirectory);
}

function normalizeDirectoryOrThrow(directory: string | undefined, label: string): string {
  if (directory === undefined) {
    throw new Error(`${label} is required.`);
  }

  return normalizeDirectory(directory, label);
}

function normalizeOptionalTitle(title: string | undefined): string | undefined {
  if (!title) {
    return undefined;
  }

  const normalized = title.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeTimestamp(timestamp: number, label: string): number {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw new Error(`${label} must be a positive finite number.`);
  }

  return Math.floor(timestamp);
}

function normalizeOptionalTimestamp(value: unknown, fallback: number): number {
  if (typeof value !== "number") {
    return fallback;
  }

  return normalizeTimestamp(value, "Timestamp");
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown SDK error";
}
