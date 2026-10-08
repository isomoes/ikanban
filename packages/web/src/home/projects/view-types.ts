import type { useLanguage } from "@/runtime/i18n/language"
import { ServerConnection } from "@/runtime/server/registry"
import type { ServerHealth } from "@/runtime/server/health"
import type { HomeProjectSelection, LocalProject } from "@/shell/state/layout"

export const HOME_PROJECT_NAV_LABEL = "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"

export const serverContextMenuID = (server: ServerConnection.Http) => `server:${ServerConnection.key(server)}`
export const projectContextMenuID = (server: ServerConnection.Http, directory: string) =>
  `project:${ServerConnection.key(server)}:${directory}`

export type HomeProjectsViewProps = {
  dropdown?: boolean
  language: ReturnType<typeof useLanguage>
  servers: ServerConnection.Http[]
  projects: LocalProject[]
  recentlyClosed: LocalProject[]
  selection: HomeProjectSelection
  homedir: string
  serverHealth: (server: ServerConnection.Http) => ServerHealth | undefined
  projectsForServer: (server: ServerConnection.Http) => LocalProject[]
  collapsed: (server: ServerConnection.Http) => boolean
  canDefaultServer: boolean
  defaultServerKey: ServerConnection.Key | null | undefined
  unseenCount: (server: ServerConnection.Http, project: LocalProject) => number
  onWheel: (event: WheelEvent) => void
  onChooseProject: (server: ServerConnection.Http) => void
  onFocusServer: (server: ServerConnection.Http) => void
  onToggleCollapsed: (server: ServerConnection.Http) => void
  onEditServer: (server: ServerConnection.Http) => void
  onSetDefaultServer: (server: ServerConnection.Http | undefined) => void
  canRemoveServer: (server: ServerConnection.Http) => boolean
  onRemoveServer: (server: ServerConnection.Http) => void
  onMoveProject: (server: ServerConnection.Http, worktree: string, index: number) => void
  onSelectProject: (server: ServerConnection.Http, directory: string) => void
  onAddProjects: (server: ServerConnection.Http, directories: string[]) => void
  onOpenProjectNewSession: (server: ServerConnection.Http, directory: string) => void
  onEditProject: (server: ServerConnection.Http, project: LocalProject) => void
  onClearNotifications: (server: ServerConnection.Http, project: LocalProject) => void
  onCloseProject: (server: ServerConnection.Http, directory: string) => void
  onOpenSettings: () => void
  onOpenHelp: () => void
}

export type HomeProjectsContextMenuProps = {
  contextMenuOpen: (id: string) => boolean
  onSetContextMenuOpen: (id: string, open: boolean) => void
}

export type HomeProjectListProps = HomeProjectsViewProps &
  HomeProjectsContextMenuProps & {
    server: ServerConnection.Http
    items: LocalProject[]
  }
