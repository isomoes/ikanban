import { resolve } from "node:path";

import type { OpenCodeRuntime } from "./opencode-runtime";
import { noopRuntimeLogger, type RuntimeLogger } from "./runtime-logger";

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

export type MergeTaskWorktreeInput = {
  projectDirectory: string;
  taskId: string;
  worktreeDirectory: string;
};

export type MergeTaskWorktreeResult = {
  taskId: string;
  branch: string;
  merged: boolean;
};

export type ReviewTaskWorktreeDiffInput = {
  projectDirectory: string;
  taskId: string;
  worktreeDirectory: string;
};

export type ReviewTaskWorktreeDiffResult = {
  taskId: string;
  branch: string;
  defaultBranch: string;
  summary: string;
  diff: string;
  hasChanges: boolean;
};

const WORKTREE_TASK_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export class WorktreeManager {
  private readonly runtime: RuntimeClientProvider;
  private readonly logger: RuntimeLogger;
  private readonly taskToWorktreeDirectory = new Map<string, string>();

  constructor(
    runtime: RuntimeClientProvider,
    options?: { logger?: RuntimeLogger },
  ) {
    this.runtime = runtime;
    this.logger = options?.logger ?? noopRuntimeLogger;
  }

  async createTaskWorktree(
    input: CreateTaskWorktreeInput,
  ): Promise<ManagedWorktree> {
    const projectDirectory = normalizeDirectory(
      input.projectDirectory,
      "Project directory",
    );
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

    const worktreeDirectory = normalizeDirectory(
      payload.directory,
      "Worktree directory",
    );
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
    const normalizedProjectDirectory = normalizeDirectory(
      projectDirectory,
      "Project directory",
    );
    const client = await this.runtime.getClient(normalizedProjectDirectory);
    const directories = await readDataOrThrow<string[]>(
      client.worktree.list({
        directory: normalizedProjectDirectory,
      }),
      "Failed to list worktrees",
    );

    return directories.map((directory) =>
      normalizeDirectory(directory, "Worktree directory"),
    );
  }

  async resetWorktree(
    projectDirectory: string,
    worktreeDirectory: string,
  ): Promise<boolean> {
    const normalizedProjectDirectory = normalizeDirectory(
      projectDirectory,
      "Project directory",
    );
    const normalizedWorktreeDirectory = normalizeDirectory(
      worktreeDirectory,
      "Worktree directory",
    );
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

  async removeWorktree(
    projectDirectory: string,
    worktreeDirectory: string,
  ): Promise<boolean> {
    const normalizedProjectDirectory = normalizeDirectory(
      projectDirectory,
      "Project directory",
    );
    const normalizedWorktreeDirectory = normalizeDirectory(
      worktreeDirectory,
      "Worktree directory",
    );
    // Resolve the branch name before removing the worktree
    let worktreeBranch: string | undefined;
    try {
      worktreeBranch =
        (
          await Bun.$`git -C ${normalizedWorktreeDirectory} rev-parse --abbrev-ref HEAD`.text()
        ).trim() || undefined;
    } catch {
      // Worktree dir may already be gone; ignore
    }

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
      // Delete the branch associated with the worktree
      if (worktreeBranch && worktreeBranch !== "HEAD") {
        try {
          await Bun.$`git -C ${normalizedProjectDirectory} branch -D ${worktreeBranch}`.quiet();
        } catch {
          // Branch may already be gone; ignore
        }
      }

      for (const [
        taskId,
        directory,
      ] of this.taskToWorktreeDirectory.entries()) {
        if (directory === normalizedWorktreeDirectory) {
          this.taskToWorktreeDirectory.delete(taskId);
        }
      }
    }

    return wasRemoved;
  }

  async cleanupTaskWorktree(
    input: CleanupTaskWorktreeInput,
  ): Promise<CleanupTaskWorktreeResult> {
    const taskId = normalizeTaskId(input.taskId);
    const policy = resolveCleanupPolicy(input.policy);
    const normalizedProjectDirectory = normalizeDirectory(
      input.projectDirectory,
      "Project directory",
    );
    const explicitDirectory = input.worktreeDirectory
      ? normalizeDirectory(input.worktreeDirectory, "Worktree directory")
      : undefined;
    const resolvedDirectory =
      explicitDirectory ??
      this.taskToWorktreeDirectory.get(taskId) ??
      undefined;

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

    const removed = await this.removeWorktree(
      normalizedProjectDirectory,
      resolvedDirectory,
    );

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

  async mergeTaskWorktree(
    input: MergeTaskWorktreeInput,
  ): Promise<MergeTaskWorktreeResult> {
    const taskId = normalizeTaskId(input.taskId);
    const projectDirectory = normalizeDirectory(
      input.projectDirectory,
      "Project directory",
    );
    const worktreeDirectory = normalizeDirectory(
      input.worktreeDirectory,
      "Worktree directory",
    );
    const logSource = "worktree-manager.merge";

    this.logger.log({
      level: "info",
      source: logSource,
      message: `Starting merge for task ${taskId}.`,
      context: { taskId, projectDirectory, worktreeDirectory },
    });

    // Get the branch name of the worktree
    const branchResult =
      await Bun.$`git -C ${worktreeDirectory} rev-parse --abbrev-ref HEAD`.text();
    const branch = branchResult.trim();
    if (!branch) {
      throw new Error(
        `Failed to determine branch for worktree at ${worktreeDirectory}.`,
      );
    }

    this.logger.log({
      level: "info",
      source: logSource,
      message: `Worktree branch resolved: ${branch}.`,
      context: { taskId, branch, worktreeDirectory },
    });

    // Get the default branch of the main worktree
    const defaultBranchResult =
      await Bun.$`git -C ${projectDirectory} rev-parse --abbrev-ref HEAD`.text();
    const defaultBranch = defaultBranchResult.trim();
    if (!defaultBranch) {
      throw new Error(
        `Failed to determine default branch for project at ${projectDirectory}.`,
      );
    }

    this.logger.log({
      level: "info",
      source: logSource,
      message: `Default branch resolved: ${defaultBranch}.`,
      context: { taskId, defaultBranch, projectDirectory },
    });

    // Commit any uncommitted changes in the worktree branch first
    const statusResult =
      await Bun.$`git -C ${worktreeDirectory} status --porcelain`.text();
    if (statusResult.trim()) {
      this.logger.log({
        level: "info",
        source: logSource,
        message: `Committing uncommitted changes in worktree branch ${branch}.`,
        context: { taskId, branch, worktreeDirectory },
      });

      try {
        await Bun.$`git -C ${worktreeDirectory} add -A`.text();
        await Bun.$`git -C ${worktreeDirectory} commit -m ${taskId + " (ikanban)"}`.text();
      } catch (error) {
        throw new Error(
          `Failed to commit uncommitted changes in worktree ${branch}: ${formatUnknownError(error)}`,
        );
      }
    }

    // Check if there are any commits to merge
    const logResult =
      await Bun.$`git -C ${projectDirectory} log ${defaultBranch}..${branch} --oneline`.text();
    if (!logResult.trim()) {
      this.logger.log({
        level: "info",
        source: logSource,
        message: `No commits to merge from ${branch} into ${defaultBranch}.`,
        context: { taskId, branch, defaultBranch },
      });

      return {
        taskId,
        branch,
        merged: false,
      };
    }

    this.logger.log({
      level: "info",
      source: logSource,
      message: `Merging ${branch} into ${defaultBranch}.`,
      context: { taskId, branch, defaultBranch },
    });

    // Squash merge the worktree branch into the default branch (single commit)
    try {
      await Bun.$`git -C ${projectDirectory} merge --squash ${branch}`.text();
      await Bun.$`git -C ${projectDirectory} commit -m ${taskId + " (ikanban)"}`.text();
    } catch (error) {
      throw new Error(
        `Failed to merge ${branch} into ${defaultBranch}: ${formatUnknownError(error)}`,
      );
    }

    this.logger.log({
      level: "info",
      source: logSource,
      message: `Squash-merged ${branch} into ${defaultBranch} for task ${taskId}.`,
      context: { taskId, branch, defaultBranch },
    });

    return {
      taskId,
      branch,
      merged: true,
    };
  }

  async getTaskWorktreeDiff(
    input: ReviewTaskWorktreeDiffInput,
  ): Promise<ReviewTaskWorktreeDiffResult> {
    const taskId = normalizeTaskId(input.taskId);
    const projectDirectory = normalizeDirectory(
      input.projectDirectory,
      "Project directory",
    );
    const worktreeDirectory = normalizeDirectory(
      input.worktreeDirectory,
      "Worktree directory",
    );
    const logSource = "worktree-manager.review-diff";

    const branchResult =
      await Bun.$`git -C ${worktreeDirectory} rev-parse --abbrev-ref HEAD`.text();
    const branch = branchResult.trim();
    if (!branch) {
      throw new Error(
        `Failed to determine branch for worktree at ${worktreeDirectory}.`,
      );
    }

    const defaultBranchResult =
      await Bun.$`git -C ${projectDirectory} rev-parse --abbrev-ref HEAD`.text();
    const defaultBranch = defaultBranchResult.trim();
    if (!defaultBranch) {
      throw new Error(
        `Failed to determine default branch for project at ${projectDirectory}.`,
      );
    }

    const statusResult =
      await Bun.$`git -C ${worktreeDirectory} status --porcelain`.text();
    const hasUncommittedChanges = statusResult.trim().length > 0;

    const summaryCommand = hasUncommittedChanges
      ? Bun.$`git -C ${worktreeDirectory} diff --no-color --stat ${defaultBranch}`
      : Bun.$`git -C ${projectDirectory} diff --no-color --stat ${defaultBranch}...${branch}`;
    const diffCommand = hasUncommittedChanges
      ? Bun.$`git -C ${worktreeDirectory} diff --no-color ${defaultBranch}`
      : Bun.$`git -C ${projectDirectory} diff --no-color ${defaultBranch}...${branch}`;

    const summary = (await summaryCommand.text()).trim();
    const diff = (await diffCommand.text()).trim();
    const hasChanges = summary.length > 0 || diff.length > 0;

    this.logger.log({
      level: "info",
      source: logSource,
      message: `Loaded review diff for task ${taskId}.`,
      context: {
        taskId,
        branch,
        defaultBranch,
        hasUncommittedChanges,
        hasChanges,
      },
    });

    return {
      taskId,
      branch,
      defaultBranch,
      summary,
      diff,
      hasChanges,
    };
  }

  getTaskWorktreeDirectory(taskId: string): string | undefined {
    return this.taskToWorktreeDirectory.get(normalizeTaskId(taskId));
  }
}

export function buildTaskWorktreeName(
  taskId: string,
  _timestamp?: number,
): string {
  const normalizedTaskId = normalizeTaskId(taskId);
  return normalizedTaskId;
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
