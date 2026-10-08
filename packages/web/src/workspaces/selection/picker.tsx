import { useDialog } from "@ikanban/ui/context/dialog"
import { ServerConnection } from "@/runtime/server/registry"
import { lazy } from "solid-js"
import type { LocationRef } from "@opencode/client/promise"

const DirectoryPickerDialog = lazy(() =>
  import("./dialog").then((module) => ({ default: module.DirectoryPickerDialog })),
)

type DirectoryPickerInput = {
  server: ServerConnection.Http
  location?: LocationRef
  title?: string
  multiple?: boolean
  onSelect: (result: string | string[] | null) => void
}

export function useDirectoryPicker() {
  const dialog = useDialog()

  return (input: DirectoryPickerInput) => {
    let selected = false
    const onSelect = (result: string | string[] | null) => {
      selected = result !== null
      input.onSelect(result)
    }
    const cancel = () => {
      if (!selected) input.onSelect(null)
    }
    dialog.show(() => <DirectoryPickerDialog {...input} onSelect={onSelect} />, cancel)
  }
}
