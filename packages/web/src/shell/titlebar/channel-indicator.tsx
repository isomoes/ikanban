import { Tooltip } from "@ikanban/ui/tooltip"
import { Keybind } from "@ikanban/ui/keybind"
import { useLanguage } from "@/runtime/i18n/language"
import { useCommand } from "@/shell/commands/command"
import { version } from "../../../package.json"
import { KanbanMark } from "./kanban-mark"

export function ChannelIndicator(props: {
  horizontal?: boolean
  sidebar?: boolean
  active?: boolean
  onClick: () => void
}) {
  const language = useLanguage()
  const command = useCommand()
  const build = import.meta.env.DEV ? "dev" : `v${version}`
  const label = () => `iKanban ${build}`
  return (
    <Tooltip
      placement={props.sidebar ? "right" : "bottom"}
      value={
        <>
          {language.t("home.title")}
          <Keybind keys={command.keybindParts("home.toggle")} variant="neutral" />
        </>
      }
      class={`shrink-0 ${props.sidebar ? "mb-4 ms-0.5 self-start" : ""} ${props.horizontal ? "me-1.5" : ""} ${props.horizontal ? "ps-2.5" : ""}`}
    >
      <button
        type="button"
        data-slot="channel-indicator"
        data-action="titlebar-home"
        data-state={props.active ? "pressed" : undefined}
        class="flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-[6px] pe-1 text-v2-text-text-base hover:bg-v2-background-bg-layer-02 focus-visible:outline-none focus-visible:bg-v2-background-bg-layer-02"
        onClick={() => props.onClick()}
        aria-label={`${label()} — ${language.t("home.title")}`}
        aria-pressed={props.active}
      >
        <KanbanMark class={props.sidebar ? "size-6 shrink-0" : "size-5 shrink-0"} />
        <span class="text-[11px] leading-4 text-v2-text-text-faint">{build}</span>
      </button>
    </Tooltip>
  )
}
