import { queryOptions, useQueryClient } from "@tanstack/solid-query"
import type { Accessor } from "solid-js"
import type { ServerConnection } from "@/runtime/server/registry"
import { useServerCtx, type ServerCtx } from "@/runtime/server/runtime"
import { normalizeProjectInfo } from "@/runtime/server/global-sync/utils"
import { worktreeInventoryViewKey } from "@/workspaces/inventory"

// Projects are owned by `Data`; this waits for the first load, or reloads when the view needs fresh metadata.
async function loadProjects(context: ServerCtx, fresh = false) {
  if (fresh) context.data.project.invalidate()
  await context.data.project.sync()
  return context.data.project.list()
}

export function workspaceInventoryQuery(
  context: ServerCtx,
  projectID?: string,
  shouldRefresh = projectID !== undefined,
) {
  return queryOptions({
    queryKey: worktreeInventoryViewKey(context.sdk.scope, projectID),
    queryFn: async () =>
      Promise.all(
        (await loadProjects(context, true))
          .filter((project) => projectID === undefined || project.id === projectID)
          .map(async (project) => {
            const worktrees = (await context.sync.worktrees.list(project.id)) ?? [
              { directory: project.canonical },
              ...project.sandboxes.map((directory) => ({ directory })),
            ]
            if (shouldRefresh) void context.sync.worktrees.refresh(project.id)
            return normalizeProjectInfo({ ...project, worktrees })
          }),
      ),
    staleTime: 30_000,
  })
}

export function useWorkspacesPrefetch(
  server: Accessor<ServerConnection.Http | undefined>,
  projectID?: Accessor<string | undefined>,
) {
  const client = useQueryClient()
  const context = useServerCtx(server)
  return () => {
    const current = context()
    if (!current || current.sdk.connection.status() !== "connected") return
    const project = projectID?.()
    if (project) {
      void client.prefetchQuery(workspaceInventoryQuery(current, project, false))
      return
    }
    // Server-level hover warms metadata without booting every project's Location.
    void loadProjects(current).catch(() => undefined)
  }
}
