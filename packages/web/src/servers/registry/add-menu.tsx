import { Button } from "@ikanban/ui/button"
import { Icon } from "@ikanban/ui/icon"
import { IconButton } from "@ikanban/ui/icon-button"
import { Show } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"

export function AddServerMenu(props: { onAddServer: () => void; compact?: boolean }) {
  const language = useLanguage()
  return (
    <Show
      when={props.compact}
      fallback={
        <Button variant="ghost-muted" icon="plus" onClick={props.onAddServer}>
          {language.t("dialog.server.add.button")}
        </Button>
      }
    >
      <IconButton
        variant="ghost-muted"
        size="small"
        icon={<Icon name="plus" />}
        aria-label={language.t("dialog.server.add.button")}
        onClick={props.onAddServer}
      />
    </Show>
  )
}
