import { createStore } from "solid-js/store"
import type { WorktreeDirectory } from "@opencode/client/promise"
import type { ServerApi } from "@/runtime/server/api"
import type { ServerScope } from "@/runtime/server/scope"
import type { Project } from "@/runtime/server/types"
import { sameDirectory } from "./paths"

export function worktreeInventoryViewKey(scope: ServerScope, projectID?: string) {
  return [scope, "settings-workspace-inventory", projectID ?? null] as const
}

// Project metadata arrives without worktrees; a loaded inventory supplies the workspace list.
export function withWorktreeInventory(project: Project, worktrees: readonly WorktreeDirectory[] | undefined): Project {
  if (!worktrees) return project
  return {
    ...project,
    worktrees: [...worktrees],
    sandboxes: worktrees
      .map((item) => item.directory)
      .filter((directory) => !sameDirectory(project.worktree, directory)),
  }
}

// Reads use saved inventory; explicit demand also discovers external worktree changes.
// The store is the only copy of each project's inventory: project lists and views derive from it.
export function createWorktreeInventory(input: { api: () => Pick<ServerApi["worktree"], "list" | "refresh"> }) {
  const [store, setStore] = createStore<Record<string, WorktreeDirectory[]>>({})
  const loading = new Map<string, Promise<WorktreeDirectory[]>>()
  return {
    cached: (projectID: string): readonly WorktreeDirectory[] | undefined => store[projectID],
    list: (projectID: string) => {
      const active = loading.get(projectID)
      if (active) return active.catch(() => undefined)
      const request = input
        .api()
        .list({ projectID })
        .then((items) => {
          setStore(projectID, items)
          return items
        })
        .finally(() => loading.delete(projectID))
      loading.set(projectID, request)
      return request.catch(() => undefined)
    },
    refresh: (projectID: string) =>
      input
        .api()
        .refresh({ projectID })
        .catch(() => undefined),
  }
}
