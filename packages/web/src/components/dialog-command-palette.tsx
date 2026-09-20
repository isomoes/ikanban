import { useDialog } from "@/ui/context/dialog"
import { Dialog } from "@/ui/components/dialog"
import { Keybind } from "@/ui/components/keybind"
import { List } from "@/ui/components/list"
import { createMemo, onCleanup, Show } from "solid-js"
import { type CommandOption, formatKeybind, useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"

export function DialogCommandPalette() {
  const command = useCommand()
  const dialog = useDialog()
  const language = useLanguage()
  const state = {
    cleanup: undefined as (() => void) | void,
    committed: false,
  }

  const items = createMemo(() =>
    command.options.filter((option) => !option.disabled && !option.id.startsWith("suggested.") && option.id !== "file.open"),
  )

  const handleMove = (item: CommandOption | undefined) => {
    state.cleanup?.()
    state.cleanup = item?.onHighlight?.()
  }

  onCleanup(() => {
    if (state.committed) return
    state.cleanup?.()
  })

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
        onMove={handleMove}
        onSelect={(item) => {
          if (!item) return
          state.committed = true
          state.cleanup = undefined
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
