import { createMemo } from "solid-js"
import { ServerConnection, serverName, useServers } from "@/runtime/server/registry"
import type { ServerCtx } from "@/runtime/server/runtime"
import { pathKey } from "@/workspaces/path-key"

export function settingsProjects(context: {
  projects: Pick<ServerCtx["projects"], "list" | "closed">
  sync: { data: Pick<ServerCtx["sync"]["data"], "project"> }
}) {
  const tracked = context.projects.list()
  const paths = new Set(tracked.map((project) => pathKey(project.worktree)))
  const closed = new Set(context.projects.closed().map(pathKey))
  return [
    ...tracked,
    // Inventory reads must not allocate directory stores: async cache hydration can trigger an eviction/reload loop.
    ...context.sync.data.project
      .filter((project) => !paths.has(pathKey(project.worktree)) && !closed.has(pathKey(project.worktree)))
      .map((project) => ({ ...project, expanded: false })),
  ]
}

export type SettingsServer = {
  key: ServerConnection.Key
  name: string
  connection: ServerConnection.Http
}

export function settingsServers(connections: readonly ServerConnection.Http[]): SettingsServer[] {
  return connections.map((connection) => {
    const key = ServerConnection.key(connection)
    return { key, name: serverName(connection) || key, connection }
  })
}

export function useSettingsServers() {
  const servers = useServers()
  return createMemo(() => settingsServers(servers.list))
}
