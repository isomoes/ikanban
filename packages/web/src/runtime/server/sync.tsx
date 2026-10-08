import { createEffect, createMemo, getOwner, onCleanup } from "solid-js"
import { useQueryClient } from "@tanstack/solid-query"
import { useLanguage } from "@/runtime/i18n/language"
import { type ServerSDK } from "./client"
import { createChildStoreManager } from "./global-sync/child-store"
import type { ProjectMeta } from "./global-sync/types"
import { directoryKey, locationPath, projectList } from "./global-sync/utils"
import { persisted } from "@/runtime/persistence/storage"
import type { Data } from "@opencode/client/solid"
import { createWorktreeInventory } from "@/workspaces/inventory"

// Client-side view over `Data`. Server resources (projects, locations, sessions, ...) are owned by `Data`;
// this context only derives app-shaped views from them, owns the worktree inventory, and keeps
// per-workspace local state. See docs/data-layer.md.
export function createServerSyncContextInner(serverSDK: ServerSDK, data: Data) {
  const language = useLanguage()
  const owner = getOwner()
  if (!owner) throw new Error("ServerSync must be created within owner")

  const queryClient = useQueryClient()
  const worktrees = createWorktreeInventory({ api: () => serverSDK.api.worktree })

  const projects = createMemo(() => projectList(data.project.list(), worktrees.cached))
  const path = createMemo(() => locationPath(data.location.info()))

  const children = createChildStoreManager({
    owner,
    scope: serverSDK.scope,
    persist: persisted,
    translate: language.t,
  })

  // Cached request/response queries are stale once the event stream drops; refetch them on next use.
  createEffect(() => {
    if (serverSDK.connection.status() === "connected") return
    void queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === serverSDK.scope,
      refetchType: "none",
    })
  })

  // Project metadata changes arrive as `project.updated` events handled by `Data`; the project list
  // only needs a reload when a mutation response or a worktree change may not have produced one.
  const reloadProjects = () => {
    data.project.invalidate()
    return data.project.sync().catch(() => undefined)
  }

  const unsub = serverSDK.event.listen((event) => {
    if (event.type === "worktree.updated") {
      void worktrees.list(event.data.projectID)
      void reloadProjects()
      return
    }

    if (!event.location) return
    const key = directoryKey(event.location.directory)
    if (!children.children[key]) return
    children.mark(key)
  })

  onCleanup(unsub)
  onCleanup(() => {
    for (const directory of Object.keys(children.children)) {
      children.disposeDirectory(directoryKey(directory))
    }
  })

  const projectApi = {
    update: reloadProjects,
    meta(directory: string, patch: ProjectMeta) {
      children.projectMeta(directory, patch)
    },
    icon(directory: string, value: string | undefined) {
      children.projectIcon(directory, value)
    },
  }

  return {
    data: {
      get project() {
        return projects()
      },
      get path() {
        return path()
      },
    },
    child: children.child,
    project: projectApi,
    worktrees,
  }
}

export function createServerSyncContext(serverSDK: ServerSDK, data: Data) {
  return createServerSyncContextInner(serverSDK, data)
}

export type ServerSync = ReturnType<typeof createServerSyncContext>
