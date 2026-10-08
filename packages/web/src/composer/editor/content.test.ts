import { describe, expect, test } from "bun:test"
import type { ComposerPrompt } from "../types"
import { composerCursor, parseComposerEditor, removeAdjacentMention, renderComposerEditor } from "./content"

describe("Composer editor content", () => {
  test("render and parse round-trip text with a file mention", () => {
    const editor = document.createElement("div")
    const prompt: ComposerPrompt = [
      { type: "text", content: "see ", start: 0, end: 4 },
      { type: "file", path: "src/a.ts", content: "@src/a.ts", start: 4, end: 13 },
      { type: "text", content: " now", start: 13, end: 17 },
    ]
    renderComposerEditor(editor, prompt)

    expect(editor.querySelector<HTMLElement>("[data-mention=file]")?.dataset.path).toBe("src/a.ts")
    expect<unknown>(parseComposerEditor(editor)).toEqual(prompt)
  })

  test("parse returns a single empty text part for blank content", () => {
    const editor = document.createElement("div")
    editor.append(document.createTextNode("\u200B"), document.createElement("br"))

    expect(parseComposerEditor(editor)).toEqual([{ type: "text", content: "", start: 0, end: 0 }])
  })

  test("composerCursor falls back to the text length without a selection", () => {
    const editor = document.createElement("div")
    editor.textContent = "hello"
    window.getSelection()?.removeAllRanges()

    expect(composerCursor(editor)).toBe(5)
  })

  test("removeAdjacentMention removes the pill before the caret", () => {
    const editor = document.createElement("div")
    document.body.append(editor)
    renderComposerEditor(editor, [
      { type: "text", content: "a ", start: 0, end: 2 },
      { type: "file", path: "b", content: "@b", start: 2, end: 4 },
    ])
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    expect(removeAdjacentMention(editor, "backward")).toBe(true)
    expect(editor.querySelector("[data-mention]")).toBeNull()
    editor.remove()
  })
})
