import { Component } from "solid-js"
import { useLocal } from "@/providers/models/selection"
import { useDialog } from "@ikanban/ui/context/dialog"
import { Button } from "@ikanban/ui/button"
import { Dialog, DialogBody, DialogHeader, DialogTitle } from "@ikanban/ui/dialog"
import { Icon } from "@ikanban/ui/icon"
import { useLanguage } from "@/runtime/i18n/language"
import { decode64 } from "@/runtime/persistence/base64"
import { ModelList } from "./model-list"
import type { ModelState } from "./selector-controller"
import "@/settings/settings.css"

export { ModelSelectorPopover } from "./selector-popover"

export const DialogSelectModel: Component<{ provider?: string; model?: ModelState }> = (props) => {
  const dialog = useDialog()
  const language = useLanguage()
  const local = useLocal()
  const directory = () => decode64(local.slug())

  const provider = () => {
    void import("@/providers/connect/dialog").then((x) => {
      void dialog.show(() => <x.DialogConnectProvider directory={directory()} />)
    })
  }

  const manage = () => {
    void import("./manage").then((x) => {
      dialog.show(() => <x.DialogManageModels />)
    })
  }

  return (
    <Dialog size="large" variant="settings">
      <DialogHeader hideClose closeLabel={language.t("common.close")}>
        <DialogTitle>{language.t("dialog.model.select.title")}</DialogTitle>
        <Button icon="plus" onClick={provider}>
          {language.t("command.provider.connect")}
        </Button>
      </DialogHeader>
      <DialogBody class="flex min-h-0 flex-1 flex-col">
        <ModelList provider={props.provider} model={props.model} onSelect={() => dialog.close()} />
        <div class="shrink-0 border-t border-v2-border-border-muted px-4 py-3">
          <button
            type="button"
            class="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-[13px] font-[530] leading-text-compact tracking-[-0.04px] text-v2-text-text-base hover:bg-v2-overlay-simple-overlay-hover focus-visible:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none"
            onClick={manage}
          >
            <Icon name="outline-sliders" size="small" />
            <span class="min-w-0 flex-1 truncate">{language.t("dialog.model.manage")}</span>
          </button>
        </div>
      </DialogBody>
    </Dialog>
  )
}
