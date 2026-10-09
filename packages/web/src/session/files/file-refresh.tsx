import { Show } from "solid-js"
import { Icon } from "@ikanban/ui/icon"
import { IconButton } from "@ikanban/ui/icon-button"
import { Tooltip } from "@ikanban/ui/tooltip"
import { useLanguage } from "@/runtime/i18n/language"
import { useFile } from "@/workspaces/files/model"
import { contentBytes } from "@/workspaces/files/artifact"
import { formatBytes } from "@/workspaces/files/size"

export function SessionFileRefresh(props: { path: string | undefined }) {
  const file = useFile()
  const language = useLanguage()
  const state = () => (props.path ? file.get(props.path) : undefined)
  const size = () => {
    const content = state()?.content
    return content ? formatBytes(language.intl(), contentBytes(content)) : undefined
  }

  return (
    <Show when={props.path}>
      <Tooltip
        placement="bottom"
        value={
          <div class="flex flex-col gap-1">
            <span>{language.t(state()?.loading ? "common.loading" : "file.view.refresh")}</span>
            <Show when={size()}>{(value) => <span class="tabular-nums">{value()}</span>}</Show>
          </div>
        }
      >
        <IconButton
          data-slot="session-file-refresh"
          size="small"
          variant="ghost-muted"
          disabled={state()?.loading}
          aria-label={language.t("file.view.refresh")}
          aria-busy={state()?.loading}
          onClick={() => {
            const path = props.path
            if (path) void file.load(path, { force: true })
          }}
          icon={<Icon name="refresh" classList={{ "animate-spin motion-reduce:animate-none": state()?.loading }} />}
        />
      </Tooltip>
    </Show>
  )
}
