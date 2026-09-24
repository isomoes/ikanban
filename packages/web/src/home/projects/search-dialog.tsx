import { useDialog } from "@opencode/ui/context/dialog"
import { useLanguage } from "@/runtime/i18n/language"
import { ServerConnection } from "@/runtime/server/registry"
import { displayName } from "@/shell/layout/helpers"
import { CommandPaletteView, matchesCommandPaletteEntry } from "@/shell/commands/dialog"
import type { CommandPaletteEntry } from "@/shell/commands/palette"
import type { LocalProject } from "@/shell/state/layout"

export function HomeProjectSearch(props: {
  servers: () => ServerConnection.Any[]
  projects: (server: ServerConnection.Any) => LocalProject[]
  onSelect: (server: ServerConnection.Any, directory: string) => void
}) {
  const dialog = useDialog()
  const language = useLanguage()
  const entries = () =>
    props.servers().flatMap((server) =>
      props.projects(server).map(
        (project): CommandPaletteEntry => ({
          id: `project:${ServerConnection.key(server)}:${project.worktree}`,
          type: "command",
          title: displayName(project),
          description: project.worktree,
          category: language.t("command.category.project"),
          option: {
            id: project.worktree,
            title: displayName(project),
            onSelect: () => props.onSelect(server, project.worktree),
          },
        }),
      ),
    )

  return (
    <CommandPaletteView
      placeholder={language.t("session.new.project.search")}
      items={(query) => entries().filter((entry) => matchesCommandPaletteEntry(entry, query))}
      sources={[]}
      highlight={() => {}}
      select={(entry) => {
        if (!entry) return
        dialog.close()
        void entry.option?.onSelect?.("palette")
      }}
      close={() => dialog.close()}
    />
  )
}
