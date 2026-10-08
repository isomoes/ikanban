export function shouldHandlePasteAsAttachment(clipboard: DataTransfer | null) {
  return Array.from(clipboard?.items ?? []).some((item) => item.kind === "file")
}

export function insertPastedText(event: ClipboardEvent, text: string) {
  event.preventDefault()
  // insertText emits input events per line, repeatedly parsing and saving the draft.
  // Escaped HTML inserts multiline text once and preserves native selection and undo.
  const normalized = text.replace(/\r\n?/g, "\n")
  const multiline = normalized.includes("\n")
  const value = multiline
    ? normalized.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    : normalized
  if (
    typeof document.execCommand === "function" &&
    document.execCommand(multiline ? "insertHTML" : "insertText", false, value)
  )
    return
  const target = event.currentTarget
  const selection = window.getSelection()
  if (!(target instanceof HTMLElement) || !selection?.rangeCount || !target.contains(selection.anchorNode)) return
  const range = selection.getRangeAt(0)
  range.deleteContents()
  const node = document.createTextNode(normalized)
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
  target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste", data: normalized }))
}
