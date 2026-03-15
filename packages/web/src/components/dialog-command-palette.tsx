import { useDialog } from "ikanban-ui/context/dialog"
import { Dialog } from "ikanban-ui/dialog"
import { Keybind } from "ikanban-ui/keybind"
import { List } from "ikanban-ui/list"
import { createMemo, Show } from "solid-js"
import { formatKeybind, useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"

export function DialogCommandPalette() {
  const command = useCommand()
  const dialog = useDialog()
  const language = useLanguage()

  const items = createMemo(() =>
    command.options.filter((option) => !option.disabled && !option.id.startsWith("suggested.") && option.id !== "file.open"),
  )

  return (
    <Dialog class="pt-3 pb-0 !max-h-[480px]" transition>
      <List
        search={{
          placeholder: language.t("palette.search.placeholder"),
          autofocus: true,
          hideIcon: true,
        }}
        emptyMessage={language.t("palette.empty")}
        items={items}
        key={(item) => item.id}
        filterKeys={["title", "description", "category"]}
        groupBy={(item) => item.category ?? language.t("palette.group.commands")}
        onSelect={(item) => {
          if (!item) return
          dialog.close()
          item.onSelect?.("palette")
        }}
      >
        {(item) => (
          <div class="w-full flex items-center justify-between gap-4">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-14-regular text-text-strong whitespace-nowrap">{item.title}</span>
              <Show when={item.description}>
                <span class="text-14-regular text-text-weak truncate">{item.description}</span>
              </Show>
            </div>
            <Show when={item.keybind}>
              <Keybind class="rounded-[4px]">{formatKeybind(item.keybind ?? "")}</Keybind>
            </Show>
          </div>
        )}
      </List>
    </Dialog>
  )
}
