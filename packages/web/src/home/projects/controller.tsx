import { useDirectoryPicker } from "@/workspaces/selection/picker"
import { useServerActionsController } from "@/servers/registry/controller"
import { useSettingsCommand } from "@/settings/command"
import { useSettingsSurface } from "@/settings/surface"
import { type LocalProject } from "@/shell/state/layout"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { ServerConnection } from "@/runtime/server/registry"
import { closeHomeProject, homeProjectDirectories } from "@/shell/layout/helpers"
import { Persist, persisted } from "@/runtime/persistence/storage"
import { useDialog } from "@ikanban/ui/context/dialog"
import { createResource } from "solid-js"
import { Schema } from "effect"
import { Persistence } from "@/runtime/persistence/schema"
import type { HomeController } from "../model"
import { useGlobal } from "@/runtime/server/runtime"
import { useCommand } from "@/shell/commands/command"
import { IKANBAN_ISSUES } from "@/shell/links"

export const HomeServersSchema = Schema.Struct({
  collapsed: Persistence.record(Persistence.fallback(Schema.Boolean, () => false)),
})

export function createHomeProjectsController(home: HomeController) {
  const platform = usePlatform()
  const pickDirectory = useDirectoryPicker()
  const dialog = useDialog()
  const language = useLanguage()
  const openSettings = useSettingsCommand()
  const settings = useSettingsSurface()
  const serverManagement = useServerActionsController()
  const global = useGlobal()
  const command = useCommand()
  const [_state, setState, _, ready] = persisted(Persist.global("home.servers"), HomeServersSchema, { collapsed: {} })
  const [state] = createResource(
    () => ready.promise ?? Promise.resolve(),
    (promise) => promise.then(() => _state),
    { initialValue: _state },
  )
  function directories(project: LocalProject) {
    return [project.worktree, ...(project.sandboxes ?? [])]
  }

  function choose(conn: ServerConnection.Http) {
    pickDirectory({
      server: conn,
      title: language.t("command.project.open"),
      multiple: true,
      onSelect: (result) => home.project.add(conn, homeProjectDirectories(result)),
    })
  }

  function close(conn: ServerConnection.Http, directory: string) {
    const next = closeHomeProject(
      home.selection.value(),
      ServerConnection.key(conn),
      home.server.context(conn).projects,
      directory,
    )
    if (next) home.selection.set(next)
  }

  command.register("home.projects", () => [
    {
      id: "project.select",
      title: language.t("session.new.project.search"),
      category: language.t("command.category.project"),
      keybind: "mod+o",
      onSelect: async () => {
        const { HomeProjectSearch } = await import("./search-dialog")
        void dialog.show(() => (
          <HomeProjectSearch
            servers={home.server.list}
            projects={home.project.forServer}
            onSelect={home.project.select}
          />
        ))
      },
    },
    {
      id: "project.close",
      title: language.t("command.project.close"),
      category: language.t("command.category.project"),
      disabled: !home.project.selected(),
      onSelect: () => {
        const conn = home.server.focused()
        const project = home.project.selected()
        if (!conn || !project) return
        close(conn, project.worktree)
      },
    },
  ])

  return {
    copy: {
      language,
    },
    selection: {
      value: home.selection.value,
    },
    server: {
      list: home.server.list,
      health: home.server.health,
      projects: home.project.forServer,
      collapsed: (conn: ServerConnection.Http) => state().collapsed[ServerConnection.key(conn)] ?? false,
      toggleCollapsed: (conn: ServerConnection.Http) => {
        const key = ServerConnection.key(conn)
        setState("collapsed", key, !state().collapsed[key])
      },
      canDefault: serverManagement.defaults.available,
      defaultKey: serverManagement.defaults.key,
      setDefault: (conn: ServerConnection.Http | undefined) =>
        serverManagement.defaults.set(conn ? ServerConnection.key(conn) : null),
      canRemove: (conn: ServerConnection.Http) => serverManagement.connection.canRemove(ServerConnection.key(conn)),
      remove: (conn: ServerConnection.Http) => serverManagement.connection.remove(ServerConnection.key(conn)),
      edit: (conn: ServerConnection.Http) => {
        void import("@/servers/connect/dialog").then(({ DialogServer }) => {
          void dialog.show(() => <DialogServer mode="edit" server={conn} />)
        })
      },
      focus: home.selection.focusServer,
    },
    project: {
      list: home.project.list,
      recentlyClosed: home.project.recentlyClosed,
      homedir: home.project.homedir,
      select: home.project.select,
      add: home.project.add,
      openNewSession: home.project.openProjectNewSession,
      edit: (conn: ServerConnection.Http, project: LocalProject) => {
        settings.openProject({
          server: ServerConnection.key(conn),
          project: project.worktree,
        })
      },
      unseenCount: (conn: ServerConnection.Http, project: LocalProject) => {
        const notification = global.ensureServerCtx(conn).notification
        return directories(project).reduce((total, directory) => total + notification.project.unseenCount(directory), 0)
      },
      clearNotifications: (conn: ServerConnection.Http, project: LocalProject) => {
        const notification = global.ensureServerCtx(conn).notification
        directories(project)
          .filter((directory) => notification.project.unseenCount(directory) > 0)
          .forEach((directory) => notification.project.markViewed(directory))
      },
      choose: (conn: ServerConnection.Http) => {
        if (home.server.health(conn)?.healthy === false) return
        choose(conn)
      },
      close,
      move: (conn: ServerConnection.Http, worktree: string, index: number) => {
        home.server.context(conn).projects.move(worktree, index)
      },
    },
    utility: {
      settings: openSettings,
      help: () => platform.openExternal(IKANBAN_ISSUES),
    },
  }
}

export type HomeProjectsController = ReturnType<typeof createHomeProjectsController>
