import { describe, expect, test } from "bun:test"
import { canNavigateHistory, setEditorCursor } from "./history-cursor"

describe("Composer history cursor", () => {
  test("starts history only from an empty prompt going up and from the end going down", () => {
    expect(canNavigateHistory("up", "", 0, false)).toBe(true)
    expect(canNavigateHistory("up", "abc", 0, false)).toBe(false)
    expect(canNavigateHistory("down", "abc", 3, false)).toBe(true)
    expect(canNavigateHistory("down", "abc", 1, false)).toBe(false)
  })

  test("navigates within history only at the edges", () => {
    expect(canNavigateHistory("up", "abc", 0, true)).toBe(true)
    expect(canNavigateHistory("up", "abc", 3, true)).toBe(true)
    expect(canNavigateHistory("up", "abc", 1, true)).toBe(false)
  })

  test("setEditorCursor places the caret in the matching text node", () => {
    const editor = document.createElement("div")
    editor.append(document.createTextNode("ab"), document.createTextNode("cd"))
    document.body.append(editor)
    setEditorCursor(editor, 3)

    const range = window.getSelection()!.getRangeAt(0)
    expect(range.startContainer).toBe(editor.childNodes[1]!)
    expect(range.startOffset).toBe(1)
    editor.remove()
  })
})
