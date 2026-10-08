import { createEffect, createMemo, Show, type JSX } from "solid-js"
import { Button } from "@ikanban/ui/button"
import { Keybind } from "@ikanban/ui/keybind"
import { useI18n } from "@ikanban/ui/context/i18n"
import { ScrollView } from "@ikanban/ui/scroll-view"
import type { ComposerEditorModel } from "./interaction"
import { isAttachment } from "../prompt-parts"
import { ComposerAttachments } from "./attachment-strip"
import {
  ComposerEditorAddMenu,
  ComposerEditorAlternateDelivery,
  ComposerEditorConfiguredSelect,
  ComposerEditorSubmitButton,
} from "./controls"
import { composerCursor, parseComposerEditor, removeAdjacentMention, renderComposerEditor, revealCaret } from "./content"
import { createControlsOverflow } from "./overflow"
import { ComposerEditorPopover } from "./popover"
import "./editor.css"

export type {
  ComposerAttachment,
  ComposerComment,
  ComposerOption,
  ComposerPersistedState,
  ComposerSuggestion,
} from "../types"
export type { ComposerMode } from "./controls"
export { ComposerAttachments } from "./attachment-strip"
export { ComposerEditorAddMenu, ComposerEditorSelect, ComposerEditorSubmitButton } from "./controls"
export { ComposerEditorPopover } from "./popover"

export type ComposerEditorProps = {
  controller: ComposerEditorModel
  disabled?: boolean
  readOnly?: boolean
  borderUnderlay?: boolean
  class?: string
  modelControl?: JSX.Element
  modelControlsVisible?: boolean
  attachKeybind?: string[]
  attachShortcut?: string
  alternateKeybind?: string[]
  exitShellKeybind?: string[]
}

export function ComposerEditor(props: ComposerEditorProps) {
  const i18n = useI18n()
  const state = props.controller.state
  const view = props.controller.view
  let editor: HTMLDivElement | undefined
  let viewport: HTMLDivElement | undefined
  const controls = createControlsOverflow()
  const overflow = controls.overflow
  let localInput = false
  const updateCursor = () => {
    if (!editor || !window.getSelection()?.isCollapsed) return
    props.controller.onCursor(composerCursor(editor))
  }
  const mode = createMemo(() => state.mode)
  const buttons = createMemo(() => ({
    opacity: mode() === "normal" ? 1 : 0,
    "pointer-events": mode() === "normal" ? ("auto" as const) : ("none" as const),
    transition: "opacity 200ms ease",
  }))

  createEffect(() => {
    const parts = props.controller.parts()
    if (!editor) return
    if (localInput) {
      localInput = false
      return
    }
    renderComposerEditor(editor, parts)
  })

  return (
    <div class={`relative size-full flex flex-col gap-0 ${props.class ?? ""}`}>
      <input
        ref={props.controller.setFileInput}
        type="file"
        multiple
        class="hidden"
        onChange={(event) => {
          const list = event.currentTarget.files
          if (list) props.controller.addAttachments(Array.from(list))
          event.currentTarget.value = ""
        }}
      />
      <Show when={!view.draftOnly && state.popover.type !== "closed"}>
        <ComposerEditorPopover
          emptyLabel={i18n.t("ui.promptInput.noMatchingItems")}
          items={props.controller.suggestions()}
          activeID={state.popover.type === "closed" ? undefined : state.popover.activeID}
          search={
            state.popover.type === "command-menu"
              ? {
                  value: state.popover.query,
                  label: i18n.t("ui.promptInput.commands"),
                  placeholder: "/",
                  onValueChange: props.controller.setQuery,
                  onKeyDown: props.controller.onKeyDown,
                }
              : undefined
          }
          onActiveChange={(item) => props.controller.dispatch({ type: "popover.active", id: item.id })}
          onSelect={(item) => props.controller.dispatch({ type: "popover.select", item })}
        />
      </Show>
      <form
        data-component="composer"
        data-dock-border-underlay={props.borderUnderlay ? "true" : undefined}
        class="group/composer relative min-h-[96px] w-full overflow-clip rounded-xl bg-v2-background-bg-base"
        classList={{
          "shadow-[var(--v2-elevation-raised)]": !props.borderUnderlay,
        }}
        onSubmit={(event) => {
          event.preventDefault()
          if (!props.disabled) props.controller.submit()
        }}
        onDragEnter={props.controller.onDragEnter}
        onDragOver={props.controller.onDragOver}
        onDragLeave={props.controller.onDragLeave}
        onDrop={props.controller.onDrop}
      >
        <Show when={state.mode === "normal"}>
          <ComposerAttachments
            attachments={props.controller.attachments()}
            uploads={props.controller.uploads()}
            comments={props.controller.comments()}
            activeCommentID={state.activeContextID}
            removeLabel={i18n.t("ui.promptInput.removeAttachment")}
            onAttachmentClick={props.controller.openAttachment}
            onAttachmentRemove={(attachment) => props.controller.removeAttachment(attachment.id)}
            onUploadCancel={(upload) => props.controller.cancelUpload(upload.id)}
            onCommentClick={(comment) => props.controller.toggleContext(comment.key)}
            onCommentRemove={(comment) => props.controller.removeContext(comment.key)}
          />
        </Show>

        <ScrollView
          data-component="composer-scroll"
          class="min-h-[60px] max-h-[180px]"
          viewportRef={(element) => {
            viewport = element
            element.tabIndex = -1
          }}
        >
          <div
            ref={(element) => {
              editor = element
              props.controller.setEditor(element)
            }}
            data-component="composer-editor"
            role="textbox"
            aria-multiline="true"
            aria-label={i18n.t("ui.promptInput.label")}
            dir={state.mode === "normal" ? "auto" : "ltr"}
            contenteditable={!props.disabled && !props.readOnly}
            autocapitalize={state.mode === "normal" ? "sentences" : "off"}
            autocorrect={state.mode === "normal" ? "on" : "off"}
            spellcheck={state.mode === "normal"}
            // @ts-expect-error
            autocomplete="off"
            class="relative z-10 block min-h-[60px] w-full whitespace-pre-wrap bg-transparent px-4 pt-4 pb-2 text-[13px] font-[440] leading-5 text-v2-text-text-base focus:outline-none [&_[data-mention=file]]:text-syntax-property [&_[data-mention=agent]]:text-syntax-type [&_[data-mention=reference]]:text-syntax-keyword"
            classList={{ "font-mono!": state.mode === "shell", "opacity-50": props.disabled }}
            style={{
              "unicode-bidi": state.mode === "normal" ? "plaintext" : undefined,
              "text-align": "start",
            }}
            onInput={(event) => {
              const cursor = composerCursor(event.currentTarget)
              const prompt = parseComposerEditor(event.currentTarget)
              const attachments = props.controller.parts().filter(isAttachment)
              localInput = true
              props.controller.onInput(prompt.map((part) => part.content).join(""), [...prompt, ...attachments], cursor)
            }}
            onKeyDown={(event) => {
              if (!view.draftOnly && props.controller.onKeyDown(event)) return
              if (
                (event.key === "Backspace" || event.key === "Delete") &&
                !event.isComposing &&
                removeAdjacentMention(event.currentTarget, event.key === "Backspace" ? "backward" : "forward")
              ) {
                event.preventDefault()
                return
              }
              const mod = event.metaKey || event.ctrlKey
              if (mod && event.key === "ArrowUp" && !event.shiftKey && !event.altKey) {
                if (view.submit.queue?.editFirst()) event.preventDefault()
                return
              }
              if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
                event.preventDefault()
                if (event.repeat) return
                props.controller.submit(mod ? { alternate: true } : undefined)
              }
            }}
            onKeyUp={updateCursor}
            onPointerUp={updateCursor}
            onPaste={(event) => {
              props.controller.onPaste(event)
              requestAnimationFrame(() => {
                if (editor && viewport) revealCaret(editor, viewport)
              })
            }}
            onFocus={() => props.controller.dispatch({ type: "focus.editor" })}
          />
          <Show when={!props.controller.value()}>
            <div
              dir={state.mode === "normal" ? "auto" : "ltr"}
              class="pointer-events-none absolute inset-x-0 top-0 px-4 pt-4 text-[13px] font-[440] leading-5 text-v2-text-text-faint"
              classList={{ "font-mono!": state.mode === "shell" }}
              style={{ "unicode-bidi": state.mode === "normal" ? "plaintext" : undefined, "text-align": "start" }}
            >
              {view.placeholder?.() ??
                (state.mode === "shell"
                  ? i18n.t("ui.promptInput.placeholder.shell")
                  : i18n.t("ui.promptInput.placeholder.normal", { slash: "/", at: "@" }))}
            </div>
          </Show>
        </ScrollView>

        <div class="flex h-11 items-center px-2">
          <div
            class="flex shrink-0 items-center"
            aria-hidden={state.mode === "shell"}
            inert={state.mode === "shell" ? true : undefined}
            style={buttons()}
          >
            <ComposerEditorAddMenu
              disabled={view.draftOnly || state.mode === "shell"}
              title={i18n.t("ui.promptInput.add")}
              keybind={props.attachKeybind ?? ["Mod", "U"]}
              attachLabel={i18n.t("ui.promptInput.attachments")}
              attachShortcut={props.attachShortcut ?? "Mod+U"}
              commandsLabel={i18n.t("ui.promptInput.commands")}
              contextLabel={i18n.t("ui.promptInput.context")}
              shellLabel={i18n.t("ui.promptInput.shell")}
              onAttach={props.controller.attach}
              onCommands={props.controller.openCommands}
              onContext={props.controller.openContext}
              onShell={props.controller.openShell}
            />
          </div>
          <div
            ref={controls.viewportRef}
            data-slot="composer-controls"
            data-overflow-start={overflow.start}
            data-overflow-end={overflow.end}
            class="ms-1 me-3 h-full min-w-0 flex-1 overflow-x-auto overscroll-x-contain no-scrollbar"
            onScroll={controls.update}
            aria-hidden={state.mode === "shell"}
            inert={state.mode === "shell" ? true : undefined}
            style={buttons()}
          >
            <div ref={controls.contentRef} class="flex h-full w-max min-w-full items-center gap-1">
              <Show when={view.agent} keyed>
                {(control) => (
                  <ComposerEditorConfiguredSelect
                    title={i18n.t("ui.promptInput.chooseAgent")}
                    keybind={["Mod", "."]}
                    control={control}
                  />
                )}
              </Show>
              <Show when={props.modelControlsVisible ?? true}>
                {props.modelControl}
                <Show when={view.variant} keyed>
                  {(control) => (
                    <Show when={control.options().length > 1}>
                      <ComposerEditorConfiguredSelect
                        title={i18n.t("ui.promptInput.chooseVariant")}
                        keybind={["Shift", "Mod", "D"]}
                        control={control}
                        class={control.current() === "default" ? "composer-variant-default" : undefined}
                      />
                    </Show>
                  )}
                </Show>
              </Show>
            </div>
          </div>
          <div data-slot="composer-actions" class="flex shrink-0 items-center">
            <Show when={state.mode === "normal"}>
              <ComposerEditorAlternateDelivery
                controller={props.controller}
                keybind={props.alternateKeybind ?? ["Mod", "Enter"]}
              />
            </Show>
            <Show when={state.mode === "shell"}>
              <Button
                data-action="composer-exit-shell"
                type="button"
                variant="ghost-faint"
                size="small"
                class="me-3 gap-1.5 px-1.5"
                onClick={() => {
                  props.controller.dispatch({ type: "mode.normal" })
                  props.controller.restoreFocus()
                }}
              >
                {i18n.t("ui.promptInput.exitShell")}
                <span class="hidden sm:block">
                  <Keybind keys={props.exitShellKeybind ?? ["ESC"]} variant="neutral" />
                </span>
              </Button>
            </Show>
            <ComposerEditorSubmitButton
              mode={state.mode}
              stopping={view.submit.stopping()}
              disabled={!props.controller.canSubmit()}
              sendLabel={i18n.t("ui.promptInput.send")}
              stopLabel={i18n.t("ui.promptInput.stop")}
              onSubmit={() => props.controller.submit()}
              onStop={props.controller.stop}
            />
          </div>
        </div>
      </form>
    </div>
  )
}
