import { For, Show, type Component } from "solid-js"
import { Button } from "@ikanban/ui/button"
import { IconButton } from "@ikanban/ui/icon-button"
import { DockPrompt } from "@ikanban/session-ui/dock-prompt"
import { Icon } from "@ikanban/ui/icon"
import type { FormInfo } from "@opencode/client/promise"
import { createQuestionDock } from "./question-dock-model"

function Mark(props: { multi: boolean; picked: boolean; onClick?: (event: MouseEvent) => void }) {
  return (
    <span data-slot="question-option-check" aria-hidden="true" onClick={props.onClick}>
      <span data-slot="question-option-box" data-type={props.multi ? "checkbox" : "radio"} data-picked={props.picked}>
        <Show when={props.multi} fallback={<span data-slot="question-option-radio-dot" />}>
          <Icon name="check-small" size="small" />
        </Show>
      </span>
    </span>
  )
}

function Option(props: {
  multi: boolean
  picked: boolean
  label: string
  description?: string
  disabled: boolean
  ref?: (el: HTMLButtonElement) => void
  onFocus?: VoidFunction
  onClick: VoidFunction
}) {
  return (
    <button
      type="button"
      ref={props.ref}
      data-slot="question-option"
      data-picked={props.picked}
      role={props.multi ? "checkbox" : "radio"}
      aria-checked={props.picked}
      disabled={props.disabled}
      onFocus={props.onFocus}
      onClick={props.onClick}
    >
      <Mark multi={props.multi} picked={props.picked} />
      <span data-slot="question-option-main">
        <span data-slot="option-label">{props.label}</span>
        <Show when={props.description}>
          <span data-slot="option-description">{props.description}</span>
        </Show>
      </span>
    </button>
  )
}

export const SessionQuestionDock: Component<{ request: FormInfo; onSubmit: () => void }> = (props) => {
  const {
    language,
    store,
    setStore,
    questions,
    total,
    question,
    options,
    input,
    on,
    multi,
    summary,
    customLabel,
    customPlaceholder,
    last,
    hidden,
    optionsOff,
    sending,
    answered,
    picked,
    focus,
    nav,
    selectOption,
    customOpen,
    customUpdate,
    commitCustom,
    resizeInput,
    focusCustom,
    toggleCustomMark,
    next,
    back,
    jump,
    minimize,
    restore,
    reject,
    refs,
  } = createQuestionDock(props)

  return (
    <div data-component="session-question-dock">
      <DockPrompt
        kind="question"
        ref={refs.root}
        onKeyDown={nav}
        header={
          <>
            <div data-slot="question-header-title">{summary()}</div>
            <div data-slot="question-header-actions">
              <Show when={total() > 1}>
                <div data-slot="question-progress">
                  <For each={questions()}>
                    {(_, i) => (
                      <button
                        type="button"
                        data-slot="question-progress-segment"
                        data-active={i() === store.tab}
                        data-answered={answered(i())}
                        disabled={sending()}
                        onClick={() => jump(i())}
                        aria-label={language.t("ui.tool.questions.numbered", { number: i() + 1 })}
                      />
                    )}
                  </For>
                </div>
              </Show>
              <IconButton
                icon={<Icon name="chevron-down" size="small" />}
                variant="ghost"
                disabled={sending()}
                style={{ transform: `rotate(${hidden() * 180}deg)` }}
                onClick={store.minimized ? restore : minimize}
                aria-label={language.t(store.minimized ? "session.question.restore" : "session.question.minimize")}
              />
            </div>
          </>
        }
        footer={
          <>
            <Button variant="ghost" size="large" disabled={sending()} onClick={reject} aria-keyshortcuts="Escape">
              {language.t("ui.common.dismiss")}
            </Button>
            <div data-slot="question-footer-actions">
              <Show when={store.tab > 0}>
                <Button variant="neutral" size="large" disabled={sending()} onClick={back}>
                  {language.t("ui.common.back")}
                </Button>
              </Show>
              <Button
                variant={last() ? "submit" : "neutral"}
                size="large"
                disabled={sending()}
                onClick={next}
                aria-keyshortcuts="Meta+Enter Control+Enter"
              >
                {last() ? language.t("ui.common.submit") : language.t("ui.common.next")}
              </Button>
            </div>
          </>
        }
      >
        <div
          data-slot="question-text"
          style={{
            display: store.minimized ? "-webkit-box" : undefined,
            "-webkit-line-clamp": store.minimized ? "3" : undefined,
            "-webkit-box-orient": store.minimized ? "vertical" : undefined,
            overflow: store.minimized ? "hidden" : undefined,
          }}
        >
          {question()?.question}
        </div>
        <Show when={!store.minimized}>
          <Show when={multi()} fallback={<div data-slot="question-hint">{language.t("ui.question.singleHint")}</div>}>
            <div data-slot="question-hint">{language.t("ui.question.multiHint")}</div>
          </Show>
        </Show>
        <div
          ref={refs.options}
          data-slot="question-options"
          aria-hidden={store.minimized || optionsOff() ? "true" : undefined}
          classList={{ "pointer-events-none": hidden() > 0.1 }}
          style={{
            "max-height": `${Math.max(0, store.optionsHeight * (1 - hidden()))}px`,
            opacity: `${Math.max(0, Math.min(1, 1 - hidden()))}`,
            visibility: optionsOff() ? "hidden" : "visible",
          }}
        >
          <For each={options()}>
            {(opt, i) => (
              <Option
                multi={multi()}
                picked={picked(opt.value)}
                label={opt.label}
                description={opt.description}
                disabled={sending()}
                ref={(el) => refs.option(i(), el)}
                onFocus={() => setStore("focus", i())}
                onClick={() => selectOption(i())}
              />
            )}
          </For>

          <Show
            when={store.editing}
            fallback={
              <button
                type="button"
                ref={refs.custom}
                data-slot="question-option"
                data-custom="true"
                data-picked={on()}
                role={multi() ? "checkbox" : "radio"}
                aria-checked={on()}
                disabled={sending()}
                onFocus={() => setStore("focus", options().length)}
                onClick={customOpen}
              >
                <Mark multi={multi()} picked={on()} onClick={toggleCustomMark} />
                <span data-slot="question-option-main">
                  <span data-slot="option-label">{customLabel()}</span>
                  <span data-slot="option-description" dir="auto">
                    {input() || customPlaceholder()}
                  </span>
                </span>
              </button>
            }
          >
            <form
              data-slot="question-option"
              data-custom="true"
              data-picked={on()}
              role={multi() ? "checkbox" : "radio"}
              aria-checked={on()}
              onMouseDown={(e) => {
                if (sending()) {
                  e.preventDefault()
                  return
                }
                if (e.target instanceof HTMLTextAreaElement) return
                const input = e.currentTarget.querySelector('[data-slot="question-custom-input"]')
                if (input instanceof HTMLTextAreaElement) input.focus()
              }}
              onSubmit={(e) => {
                e.preventDefault()
                commitCustom()
              }}
            >
              <Mark multi={multi()} picked={on()} onClick={toggleCustomMark} />
              <span data-slot="question-option-main">
                <span data-slot="option-label">{customLabel()}</span>
                <textarea
                  ref={focusCustom}
                  data-slot="question-custom-input"
                  dir="auto"
                  placeholder={customPlaceholder()}
                  value={input()}
                  rows={1}
                  disabled={sending()}
                  style={{ "unicode-bidi": "plaintext", "text-align": "start" }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault()
                      setStore("editing", false)
                      focus(options().length)
                      return
                    }
                    if ((e.metaKey || e.ctrlKey) && !e.altKey) return
                    if (e.key !== "Enter" || e.shiftKey) return
                    e.preventDefault()
                    commitCustom()
                  }}
                  onInput={(e) => {
                    customUpdate(e.currentTarget.value)
                    resizeInput(e.currentTarget)
                  }}
                />
              </span>
            </form>
          </Show>
        </div>
      </DockPrompt>
    </div>
  )
}