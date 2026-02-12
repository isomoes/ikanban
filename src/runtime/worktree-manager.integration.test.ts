import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, test } from "bun:test";

import { OpenCodeRuntime } from "./opencode-runtime";
import { WorktreeManager } from "./worktree-manager";

const shouldRunRealIntegration = process.env.RUN_REAL_OPENCODE_TESTS === "1";
const describeReal = shouldRunRealIntegration ? describe : describe.skip;

describeReal("WorktreeManager real lifecycle", () => {
  test("creates, lists, resets, and removes a real worktree", async () => {
    const runtime = new OpenCodeRuntime();
    const manager = new WorktreeManager(runtime);
    const repoDirectory = await createTemporaryGitRepository();

    try {
      const created = await manager.createTaskWorktree({
        projectDirectory: repoDirectory,
        taskId: "integration",
      });

      expect(created.name).toMatch(/^task-integration-\d+$/);

      const listed = await manager.listWorktrees(repoDirectory);
      expect(listed).toContain(created.directory);

      const resetResult = await manager.resetWorktree(repoDirectory, created.directory);
      expect(resetResult).toBe(true);

      const cleanupResult = await manager.cleanupTaskWorktree({
        projectDirectory: repoDirectory,
        taskId: "integration",
        policy: "remove",
      });

      expect(cleanupResult.removed).toBe(true);

      const listedAfterCleanup = await manager.listWorktrees(repoDirectory);
      expect(listedAfterCleanup).not.toContain(created.directory);
    } finally {
      await runtime.stop();
      await rm(repoDirectory, { recursive: true, force: true });
    }
  }, 120000);
});

async function createTemporaryGitRepository(): Promise<string> {
  const repoDirectory = await mkdtemp(join(tmpdir(), "ikanban-worktree-manager-"));

  await Bun.write(join(repoDirectory, "README.md"), "# integration repo\n");

  await runGit(repoDirectory, ["init"]);
  await runGit(repoDirectory, ["config", "user.email", "ikanban@example.com"]);
  await runGit(repoDirectory, ["config", "user.name", "iKanban Test"]);
  await runGit(repoDirectory, ["add", "README.md"]);
  await runGit(repoDirectory, ["commit", "-m", "init"]);

  return repoDirectory;
}

async function runGit(directory: string, args: string[]): Promise<void> {
  const process = Bun.spawn(["git", ...args], {
    cwd: directory,
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await process.exited;

  if (exitCode === 0) {
    return;
  }

  const stderr = await new Response(process.stderr).text();
  throw new Error(`git ${args.join(" ")} failed: ${stderr.trim()}`);
}
