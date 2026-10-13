import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createStore } from "solid-js/store"
import type { ComposerPrompt } from "@/composer/types"
import { createComposerEditorInput } from "@/composer/editor/input"

function setup() {
  const editor = document.createElement("div")
  document.body.append(editor)
  const value = createRoot((dispose) => {
    const [state, setState] = createStore<{ prompt: ComposerPrompt }>({
      prompt: [{ type: "text", content: "", start: 0, end: 0 }],
    })
    const input = createComposerEditorInput(() => editor, {
      parts: () => state.prompt,
      onInput: (_value, prompt) => setState("prompt", prompt!),
    })
    return { input, state, setState, dispose }
  })
  return {
    ...value,
    editor,
    cleanup() {
      value.dispose()
      editor.remove()
    },
  }
}

test("native input retains text nodes and the selection during a burst of simulated typing", () => {
  const value = setup()
  try {
    const node = document.createTextNode("")
    value.editor.replaceChildren(node)
    for (const char of "开头和结尾都不能丢失") {
      node.appendData(char)
      const selection = window.getSelection()!
      selection.collapse(node, node.length)
      value.input.onInput(new InputEvent("input", { inputType: "insertText", data: char }))
      expect(value.editor.firstChild).toBe(node)
      expect(selection.anchorNode).toBe(node)
      expect(selection.anchorOffset).toBe(node.length)
    }
    expect(value.state.prompt[0]).toMatchObject({ content: "开头和结尾都不能丢失" })
  } finally {
    value.cleanup()
  }
})

for (const finalInput of ["before", "after"] as const) {
  test(`composition commits all text when final input arrives ${finalInput} compositionend`, () => {
    const value = setup()
    try {
      value.input.onCompositionStart()
      const node = document.createTextNode("开头")
      value.editor.replaceChildren(node)
      value.input.onInput(new InputEvent("input", { isComposing: true }))
      expect(value.state.prompt[0]).toMatchObject({ content: "" })
      // An attachment completing must not destroy the active composition range.
      value.setState("prompt", (parts) => [
        ...parts,
        { type: "image", id: "image", filename: "a.png", mime: "image/png", blob: { id: "a", url: "blob:a" } },
      ])
      expect(value.editor.firstChild).toBe(node)
      node.appendData("和结尾")
      if (finalInput === "before") value.input.onInput(new InputEvent("input"))
      value.input.onCompositionEnd()
      if (finalInput === "after") value.input.onInput(new InputEvent("input"))
      expect(value.state.prompt[0]).toMatchObject({ content: "开头和结尾" })
      expect(value.state.prompt[1]).toMatchObject({ type: "image" })
      expect(value.editor.firstChild).toBe(node)
    } finally {
      value.cleanup()
    }
  })
}

test("store changes to text still render after native input", () => {
  const value = setup()
  try {
    value.editor.textContent = "输入"
    value.input.onInput(new InputEvent("input"))
    value.setState("prompt", 0, "content", "恢复草稿")
    value.setState("prompt", 0, "end", 4)
    expect(value.editor.textContent).toBe("恢复草稿")
  } finally {
    value.cleanup()
  }
})

test("attachment-only updates do not reset text nodes or move a mid-text caret", () => {
  const value = setup()
  try {
    value.editor.textContent = "前面的字后面的字"
    const node = value.editor.firstChild!
    const selection = window.getSelection()!
    selection.collapse(node, 4)
    value.input.onInput(new InputEvent("input"))
    value.setState("prompt", (parts) => [
      ...parts,
      { type: "image", id: "image", filename: "a.png", mime: "image/png", blob: { id: "a", url: "blob:a" } },
    ])
    expect(value.editor.firstChild).toBe(node)
    expect(selection.anchorNode).toBe(node)
    expect(selection.anchorOffset).toBe(4)
  } finally {
    value.cleanup()
  }
})
