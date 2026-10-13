import { batch, createEffect, createSignal } from "solid-js"
import { clonePrompt, isAttachment } from "../prompt-parts"
import type { ComposerEditorModel } from "./interaction"
import { composerCursor, parseComposerEditor, renderComposerEditor } from "./content"

// Keep browser-owned text nodes and selections intact during native input.
export function createComposerEditorInput(
  editor: () => HTMLDivElement | undefined,
  controller: Pick<ComposerEditorModel, "parts" | "onInput">,
) {
  const [composing, setComposing] = createSignal(false)
  const publish = () => {
    const element = editor()
    if (!element) return
    const prompt = parseComposerEditor(element)
    controller.onInput(
      prompt.map((part) => part.content).join(""),
      [...prompt, ...controller.parts().filter(isAttachment)],
      composerCursor(element),
    )
  }

  createEffect(() => {
    // Snapshot all part fields even when the DOM already matches the store.
    const prompt = clonePrompt(controller.parts()).filter((part) => !isAttachment(part))
    const element = editor()
    if (!element || composing()) return
    if (JSON.stringify(parseComposerEditor(element)) === JSON.stringify(prompt)) return
    renderComposerEditor(element, prompt)
  })

  return {
    composing,
    onInput(event: InputEvent) {
      if (composing() || event.isComposing) return
      publish()
    },
    onCompositionStart() {
      setComposing(true)
    },
    onCompositionEnd() {
      // Commit before re-enabling store-to-DOM synchronization. Some browsers
      // send the final input after compositionend; others send it before.
      batch(() => {
        publish()
        setComposing(false)
      })
    },
  }
}
