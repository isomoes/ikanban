import { describe, expect, test } from "bun:test"
import type { WorktreeDirectory } from "@opencode/client/promise"
import { createWorktreeInventory, withWorktreeInventory } from "./inventory"
import { normalizeProjectInfo } from "@/runtime/server/global-sync/utils"

function setup(list: (directory: string) => Promise<WorktreeDirectory[]>) {
  const refreshed = Promise.withResolvers<void>()
  const refreshes: string[] = []
  const calls: string[] = []
  const inventory = createWorktreeInventory({
    api: () => ({
      list: (input) => {
        const directory = input.projectID
        calls.push(directory)
        return list(directory)
      },
      refresh: (input) => {
        refreshes.push(input.projectID)
        return refreshed.promise
      },
    }),
  })
  return { calls, inventory, refreshed, refreshes }
}

describe("createWorktreeInventory", () => {
  test("lists a project, shares in-flight work, and stores each result", async () => {
    const gate = Promise.withResolvers<void>()
    const setupResult = setup(async (directory) => {
      await gate.promise
      return [{ directory }, { directory: `${directory}/feature`, strategy: "git" }]
    })
    const first = setupResult.inventory.list("/repo")
    const second = setupResult.inventory.list("/repo")
    expect(setupResult.calls).toEqual(["/repo"])
    expect(setupResult.inventory.cached("/repo")).toBeUndefined()
    gate.resolve()
    expect(await first).toHaveLength(2)
    expect(await second).toHaveLength(2)
    expect(setupResult.inventory.cached("/repo")).toHaveLength(2)
    await setupResult.inventory.list("/repo")
    expect(setupResult.calls).toEqual(["/repo", "/repo"])
    expect(setupResult.refreshes).toEqual([])
  })

  test("list reads saved inventory without discovery", async () => {
    const setupResult = setup(async (directory) => [{ directory }])
    await setupResult.inventory.list("/opened")
    expect(setupResult.calls).toEqual(["/opened"])
    expect(setupResult.refreshes).toEqual([])
  })

  test("a failed list is not cached and never rejects the caller", async () => {
    let fail = true
    const setupResult = setup(async (directory) => {
      if (fail) throw new Error("Location unavailable")
      return [{ directory }]
    })
    expect(await setupResult.inventory.list("/repo")).toBeUndefined()
    expect(setupResult.inventory.cached("/repo")).toBeUndefined()
    fail = false
    expect(await setupResult.inventory.list("/repo")).toEqual([{ directory: "/repo" }])
    expect(setupResult.calls).toEqual(["/repo", "/repo"])
  })

  test("refresh discovers without changing cached inventory until the next list", async () => {
    const rows = [{ directory: "/repo" }]
    const result = setup(async () => [...rows])
    expect(await result.inventory.list("project")).toEqual(rows)
    const pending = result.inventory.refresh("project")
    rows.push({ directory: "/external" })
    expect(result.inventory.cached("project")).toEqual([{ directory: "/repo" }])
    result.refreshed.resolve()
    expect(await pending).toBeUndefined()
    expect(result.calls).toEqual(["project"])
    expect(result.refreshes).toEqual(["project"])
    expect(await result.inventory.list("project")).toEqual(rows)
    expect(result.inventory.cached("project")).toEqual(rows)
  })
})

describe("withWorktreeInventory", () => {
  const metadata = {
    id: "project",
    canonical: "/repo",
    name: "Before",
    time: { created: 1, updated: 1, active: 1 },
    sandboxes: [],
  }

  test("derives the workspace list from the inventory, excluding the project root", () => {
    const worktrees = [
      { directory: "/repo/" },
      { directory: "/repo/feature", strategy: "git" },
      { directory: "/elsewhere" },
    ]
    expect(withWorktreeInventory(normalizeProjectInfo(metadata), worktrees)).toMatchObject({
      worktree: "/repo",
      sandboxes: ["/repo/feature", "/elsewhere"],
      worktrees,
    })
  })

  test("leaves metadata untouched without an inventory and survives metadata updates", () => {
    const project = normalizeProjectInfo(metadata)
    expect(withWorktreeInventory(project, undefined)).toBe(project)
    const cached = [{ directory: "/repo" }, { directory: "/repo/feature", strategy: "git" }]
    const updated = normalizeProjectInfo({ ...metadata, name: "After" })
    expect(withWorktreeInventory(updated, cached)).toMatchObject({ name: "After", sandboxes: ["/repo/feature"] })
  })
})
