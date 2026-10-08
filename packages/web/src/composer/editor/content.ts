import { Skill } from "@opencode/schema/skill"
import type { ComposerAttachment, ComposerPrompt } from "../types"
import { isAttachment } from "../prompt-parts"

const mentionParts = new WeakMap<HTMLElement, Exclude<ComposerPrompt[number], ComposerAttachment | { type: "text" }>>()

export function renderComposerEditor(editor: HTMLDivElement, prompt: ComposerPrompt) {
  const active = document.activeElement === editor
  editor.replaceChildren(
    ...prompt.flatMap<Node>((part) => {
      if (isAttachment(part)) return []
      if (part.type === "text") return [document.createTextNode(part.content)]
      const mention = document.createElement("span")
      mentionParts.set(mention, part)
      mention.textContent = part.content
      mention.contentEditable = "false"
      mention.dir = "auto"
      mention.style.unicodeBidi = "isolate"
      mention.dataset.mention =
        part.type === "file" && part.mime === "application/x-directory" ? "reference" : part.type
      if (part.type === "agent") mention.dataset.name = part.name
      if (part.type === "skill") {
        mention.dataset.id = part.id
        mention.dataset.name = part.name
      }
      if (part.type === "file") {
        mention.dataset.path = part.path
        if (part.mime) mention.dataset.mime = part.mime
        if (part.filename) mention.dataset.filename = part.filename
      }
      return [mention]
    }),
  )
  if (!active) return
  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(editor)
  range.collapse(false)
  selection?.removeAllRanges()
  selection?.addRange(range)
}

export function parseComposerEditor(editor: HTMLDivElement) {
  const parts: Exclude<ComposerPrompt[number], ComposerAttachment>[] = []
  let buffer = ""
  let position = 0

  const flush = () => {
    if (!buffer) return
    parts.push({ type: "text", content: buffer, start: position, end: position + buffer.length })
    position += buffer.length
    buffer = ""
  }
  const mention = (element: HTMLElement) => {
    flush()
    const content = element.textContent ?? ""
    const original = mentionParts.get(element)
    if (element.dataset.mention === "agent") {
      parts.push({
        ...(original?.type === "agent" ? original : {}),
        type: "agent",
        name: element.dataset.name ?? content.slice(1),
        content,
        start: position,
        end: position + content.length,
      })
      position += content.length
      return
    }
    if (element.dataset.mention === "skill") {
      parts.push({
        ...(original?.type === "skill" ? original : {}),
        type: "skill",
        id: Skill.ID.make(element.dataset.id ?? content.slice(1)),
        name: Skill.Name.make(element.dataset.name ?? content.slice(1)),
        content,
        start: position,
        end: position + content.length,
      })
      position += content.length
      return
    }
    parts.push({
      ...(original?.type === "file" ? original : {}),
      type: "file",
      path: element.dataset.path ?? content.slice(1),
      content,
      start: position,
      end: position + content.length,
      ...(element.dataset.mime ? { mime: element.dataset.mime } : {}),
      ...(element.dataset.filename ? { filename: element.dataset.filename } : {}),
    })
    position += content.length
  }
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      buffer += node.textContent ?? ""
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (node.dataset.mention) {
      mention(node)
      return
    }
    if (node.tagName === "BR") {
      buffer += "\n"
      return
    }
    Array.from(node.childNodes).forEach(visit)
  }

  Array.from(editor.childNodes).forEach((node, index, nodes) => {
    visit(node)
    if (node instanceof HTMLElement && ["DIV", "P"].includes(node.tagName) && index < nodes.length - 1) buffer += "\n"
  })
  flush()
  if (
    parts.every((part) => part.type === "text") &&
    parts.every((part) => part.content.replace(/[\n\u200B]/g, "") === "")
  ) {
    return [{ type: "text" as const, content: "", start: 0, end: 0 }]
  }
  if (parts.length > 0) return parts
  return [{ type: "text" as const, content: "", start: 0, end: 0 }]
}

// Browsers cannot reliably delete a non-editable mention pill at the caret, e.g. at the end of the editor.
export function removeAdjacentMention(editor: HTMLDivElement, direction: "backward" | "forward") {
  const selection = window.getSelection()
  if (!selection?.rangeCount || !selection.isCollapsed || !editor.contains(selection.anchorNode)) return false
  const mention = adjacentMention(editor, selection.anchorNode!, selection.anchorOffset, direction)
  if (!mention) return false
  const range = document.createRange()
  range.setStartBefore(mention)
  range.collapse(true)
  mention.remove()
  selection.removeAllRanges()
  selection.addRange(range)
  editor.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: direction === "backward" ? "deleteContentBackward" : "deleteContentForward",
    }),
  )
  return true
}

function adjacentMention(editor: HTMLElement, node: Node, offset: number, direction: "backward" | "forward") {
  const backward = direction === "backward"
  const inside = (node instanceof HTMLElement ? node : node.parentElement)?.closest<HTMLElement>("[data-mention]")
  if (inside && editor.contains(inside)) return inside
  let current: Node | null
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? "").replace(/\u200B/g, "")
    const before = (node.textContent ?? "").slice(0, offset).replace(/\u200B/g, "")
    if (backward ? before.length > 0 : before.length < text.length) return
    current = node
  } else {
    const child = (backward ? node.childNodes[offset - 1] : node.childNodes[offset]) ?? null
    if (child instanceof HTMLElement && child.dataset.mention) return child
    if (child && (child.nodeType !== Node.TEXT_NODE || (child.textContent ?? "").replace(/\u200B/g, ""))) return
    current = child ?? node
    if (!child && node === editor) return
  }
  while (current && current !== editor) {
    let sibling = backward ? current.previousSibling : current.nextSibling
    while (sibling && sibling.nodeType === Node.TEXT_NODE && !(sibling.textContent ?? "").replace(/\u200B/g, "")) {
      sibling = backward ? sibling.previousSibling : sibling.nextSibling
    }
    if (sibling) return sibling instanceof HTMLElement && sibling.dataset.mention ? sibling : undefined
    current = current.parentNode
  }
}

export function composerCursor(editor: HTMLDivElement) {
  const selection = window.getSelection()
  if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return editor.textContent?.length ?? 0
  const range = selection.getRangeAt(0).cloneRange()
  range.selectNodeContents(editor)
  range.setEnd(selection.anchorNode!, selection.anchorOffset)
  return range.toString().length
}

// Programmatic multiline insertion does not reliably reveal the caret.
export function revealCaret(editor: HTMLElement, viewport: HTMLElement) {
  const selection = window.getSelection()
  if (!selection?.isCollapsed || !selection.rangeCount) return
  if (!editor.contains(selection.anchorNode)) return
  const caret = selection.getRangeAt(0).getBoundingClientRect()
  if (!caret.height) return
  const bounds = viewport.getBoundingClientRect()
  if (caret.bottom > bounds.bottom - 8) viewport.scrollTop += caret.bottom - bounds.bottom + 8
  if (caret.top < bounds.top + 8) viewport.scrollTop += caret.top - bounds.top - 8
}
