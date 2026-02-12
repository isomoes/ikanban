import { resolve } from "node:path";

import type { OpenCodeRuntime } from "./opencode-runtime";

type RuntimeClientProvider = Pick<OpenCodeRuntime, "getClient">;

type WorktreeApiResponse<TData> = {
  data?: TData;
  error?: unknown;
};

type WorktreeCreatePayload = {
  name: string;
  branch: string;
  directory: string;
};

export type WorktreeCleanupPolicy = "keep" | "remove";

export type CreateTaskWorktreeInput = {
  projectDirectory: string;
  taskId: string;
  startCommand?: string;
  timestamp?: number;
};

export type ManagedWorktree = WorktreeCreatePayload & {
  taskId: string;
  projectDirectory: string;
  createdAt: number;
};

export type CleanupTaskWorktreeInput = {
  projectDirectory: string;
  taskId: string;
  policy: WorktreeCleanupPolicy;
  worktreeDirectory?: string;
};

export type CleanupTaskWorktreeResult = {
  policy: WorktreeCleanupPolicy;
  taskId: string;
  worktreeDirectory?: string;
  removed: boolean;
};

const WORKTREE_TASK_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export class WorktreeManager {
  private readonly runtime: RuntimeClientProvider;
  private readonly taskToWorktreeDirectory = new Map<string, string>();

  constructor(runtime: RuntimeClientProvider) {
    this.runtime = runtime;
  }

  async createTaskWorktree(input: CreateTaskWorktreeInput): Promise<ManagedWorktree> {
    const projectDirectory = normalizeDirectory(input.projectDirectory, "Project directory");
    const taskId = normalizeTaskId(input.taskId);
    const createdAt = normalizeTimestamp(input.timestamp ?? Date.now());
    const name = buildTaskWorktreeName(taskId, createdAt);
    const client = await this.runtime.getClient(projectDirectory);
    const payload = await readDataOrThrow<WorktreeCreatePayload>(
      client.worktree.create({
        directory: projectDirectory,
        worktreeCreateInput: {
          name,
          startCommand: input.startCommand,
        },
      }),
      "Failed to create worktree",
    );

    const worktreeDirectory = normalizeDirectory(payload.directory, "Worktree directory");
    this.taskToWorktreeDirectory.set(taskId, worktreeDirectory);

    return {
      taskId,
      projectDirectory,
      createdAt,
      name: payload.name,
      branch: payload.branch,
      directory: worktreeDirectory,
    };
  }

  async listWorktrees(projectDirectory: string): Promise<string[]> {
    const normalizedProjectDirectory = normalizeDirectory(projectDirectory, "Project directory");
    const client = await this.runtime.getClient(normalizedProjectDirectory);
    const directories = await readDataOrThrow<string[]>(
      client.worktree.list({
        directory: normalizedProjectDirectory,
      }),
      "Failed to list worktrees",
    );

    return directories.map((directory) => normalizeDirectory(directory, "Worktree directory"));
  }

  async resetWorktree(projectDirectory: string, worktreeDirectory: string): Promise<boolean> {
    const normalizedProjectDirectory = normalizeDirectory(projectDirectory, "Project directory");
    const normalizedWorktreeDirectory = normalizeDirectory(worktreeDirectory, "Worktree directory");
    const client = await this.runtime.getClient(normalizedProjectDirectory);

    return readDataOrThrow<boolean>(
      client.worktree.reset({
        directory: normalizedProjectDirectory,
        worktreeResetInput: {
          directory: normalizedWorktreeDirectory,
        },
      }),
      "Failed to reset worktree",
    );
  }

  async removeWorktree(projectDirectory: string, worktreeDirectory: string): Promise<boolean> {
    const normalizedProjectDirectory = normalizeDirectory(projectDirectory, "Project directory");
    const normalizedWorktreeDirectory = normalizeDirectory(worktreeDirectory, "Worktree directory");
    const client = await this.runtime.getClient(normalizedProjectDirectory);
    const wasRemoved = await readDataOrThrow<boolean>(
      client.worktree.remove({
        directory: normalizedProjectDirectory,
        worktreeRemoveInput: {
          directory: normalizedWorktreeDirectory,
        },
      }),
      "Failed to remove worktree",
    );

    if (wasRemoved) {
      for (const [taskId, directory] of this.taskToWorktreeDirectory.entries()) {
        if (directory === normalizedWorktreeDirectory) {
          this.taskToWorktreeDirectory.delete(taskId);
        }
      }
    }

    return wasRemoved;
  }

  async cleanupTaskWorktree(input: CleanupTaskWorktreeInput): Promise<CleanupTaskWorktreeResult> {
    const taskId = normalizeTaskId(input.taskId);
    const policy = resolveCleanupPolicy(input.policy);
    const normalizedProjectDirectory = normalizeDirectory(input.projectDirectory, "Project directory");
    const explicitDirectory = input.worktreeDirectory
      ? normalizeDirectory(input.worktreeDirectory, "Worktree directory")
      : undefined;
    const resolvedDirectory =
      explicitDirectory ?? this.taskToWorktreeDirectory.get(taskId) ?? undefined;

    if (!resolvedDirectory) {
      return {
        policy,
        taskId,
        removed: false,
      };
    }

    if (!shouldRemoveWorktree(policy)) {
      this.taskToWorktreeDirectory.set(taskId, resolvedDirectory);
      return {
        policy,
        taskId,
        worktreeDirectory: resolvedDirectory,
        removed: false,
      };
    }

    const removed = await this.removeWorktree(normalizedProjectDirectory, resolvedDirectory);

    if (removed) {
      this.taskToWorktreeDirectory.delete(taskId);
    }

    return {
      policy,
      taskId,
      worktreeDirectory: resolvedDirectory,
      removed,
    };
  }

  getTaskWorktreeDirectory(taskId: string): string | undefined {
    return this.taskToWorktreeDirectory.get(normalizeTaskId(taskId));
  }
}

export function buildTaskWorktreeName(taskId: string, timestamp: number = Date.now()): string {
  const normalizedTaskId = normalizeTaskId(taskId);
  const normalizedTimestamp = normalizeTimestamp(timestamp);

  return `task-${normalizedTaskId}-${normalizedTimestamp}`;
}

export function shouldRemoveWorktree(policy: WorktreeCleanupPolicy): boolean {
  return policy === "remove";
}

export function resolveCleanupPolicy(
  policy: WorktreeCleanupPolicy | undefined,
  fallback: WorktreeCleanupPolicy = "keep",
): WorktreeCleanupPolicy {
  return policy ?? fallback;
}

async function readDataOrThrow<TData>(
  request: Promise<WorktreeApiResponse<TData>>,
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

function normalizeTaskId(taskId: string): string {
  const normalizedTaskId = taskId.trim();

  if (!normalizedTaskId) {
    throw new Error("Task id is required.");
  }

  if (!WORKTREE_TASK_ID_PATTERN.test(normalizedTaskId)) {
    throw new Error(
      "Task id can only include letters, numbers, hyphen, and underscore for worktree naming.",
    );
  }

  return normalizedTaskId;
}

function normalizeDirectory(directory: string, label: string): string {
  const normalizedDirectory = directory.trim();

  if (!normalizedDirectory) {
    throw new Error(`${label} is required.`);
  }

  return resolve(normalizedDirectory);
}

function normalizeTimestamp(timestamp: number): number {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw new Error("Timestamp must be a positive finite number.");
  }

  return Math.floor(timestamp);
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
