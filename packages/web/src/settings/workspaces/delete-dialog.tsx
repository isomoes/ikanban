import { Dialog, DialogFooter, DialogHeader, DialogTitleGroup } from "@ikanban/ui/dialog"
import { Button } from "@ikanban/ui/button"
import { useDialog } from "@ikanban/ui/context/dialog"
import { useLanguage } from "@/runtime/i18n/language"

export function DialogDeleteWorkspaces(props: {
  title: string
  confirmation: string
  warning: string
  onDelete: () => Promise<void>
}) {
  const dialog = useDialog()
  const language = useLanguage()
  const remove = () => {
    const deleting = props.onDelete()
    dialog.close()
    void deleting
  }

  return (
    <Dialog fit>
      <DialogHeader>
        <DialogTitleGroup
          title={props.title}
          description={
            <div class="flex flex-col gap-2">
              <div>{props.confirmation}</div>
              <div>{props.warning}</div>
            </div>
          }
        />
      </DialogHeader>
      <DialogFooter>
        <Button type="button" variant="neutral" onClick={() => dialog.close()}>
          {language.t("common.cancel")}
        </Button>
        <Button type="button" variant="danger" onClick={remove}>
          {language.t("settings.workspaces.delete.button")}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
