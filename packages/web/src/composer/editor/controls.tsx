import { createMemo, createSignal, For, Show, type JSX } from "solid-js"
import { Icon } from "@ikanban/ui/icon"
import { IconButton } from "@ikanban/ui/icon-button"
import { createAnimatedPresence } from "@/runtime/animated-presence"
import { ProviderIcon } from "@ikanban/ui/provider-icon"
import { useI18n } from "@ikanban/ui/context/i18n"
import { Button } from "@ikanban/ui/button"
import { Keybind } from "@ikanban/ui/keybind"
import { Menu } from "@ikanban/ui/menu"
import { Tooltip } from "@ikanban/ui/tooltip"
import type { ComposerOption } from "../types"
import type { ComposerEditorModel, ComposerSelectControl } from "./interaction"

export type ComposerMode = "normal" | "shell"

export function ComposerEditorAddMenu(props: {
  disabled?: boolean
  title: string
  keybind?: string[]
  attachLabel: string
  attachShortcut?: string
  commandsLabel: string
  contextLabel: string
  shellLabel: string
  onAttach: () => void
  onCommands: () => void
  onContext: () => void
  onShell: () => void
}) {
  return (
    <Tooltip
      placement="top"
      value={
        <>
          {props.title}
          <Keybind keys={props.keybind ?? []} variant="neutral" />
        </>
      }
    >
      <Menu gutter={6} modal={false} placement="top-start">
        <Menu.Trigger
          as={IconButton}
          data-action="composer-attach"
          type="button"
          icon={<Icon name="plus" />}
          variant="ghost-muted"
          size="large"
          disabled={props.disabled}
          aria-label={props.title}
        />
        <Menu.Portal>
          <Menu.Content
            class="[&_[data-slot=menu-v2-item-shortcut]]:w-5 [&_[data-slot=menu-v2-item-shortcut]]:justify-center"
            style={{ "min-width": "180px" }}
          >
            <Menu.Item onSelect={props.onAttach} shortcut={props.attachShortcut}>
              {props.attachLabel}
            </Menu.Item>
            <Menu.Separator />
            <Menu.Item onSelect={props.onCommands} shortcut="/">
              {props.commandsLabel}
            </Menu.Item>
            <Menu.Item onSelect={props.onContext} shortcut="@">
              {props.contextLabel}
            </Menu.Item>
            <Menu.Item onSelect={props.onShell} shortcut="!">
              {props.shellLabel}
            </Menu.Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu>
    </Tooltip>
  )
}

export function ComposerEditorConfiguredSelect(props: {
  title: string
  keybind?: string[]
  control: ComposerSelectControl
  model?: boolean
  class?: string
}) {
  const current = () => props.control.current()
  const providerID = () => props.control.options().find((option) => option.id === current())?.providerID
  return (
    <ComposerEditorSelect
      title={props.title}
      class={props.class}
      keybind={props.control.keybind?.() ?? props.keybind}
      options={props.control.options()}
      current={current()}
      currentIcon={
        <Show when={props.model && providerID()}>
          <ProviderIcon id={providerID()!} class="size-4 shrink-0 opacity-60" />
        </Show>
      }
      onSelect={props.control.onSelect}
    />
  )
}

export function ComposerEditorSelect(props: {
  title: string
  keybind?: string[]
  options: ComposerOption[]
  current: string
  currentIcon?: JSX.Element
  class?: string
  onOpenChange?: (open: boolean) => void
  onSelect: (id: string) => void
}) {
  return (
    <Tooltip
      placement="top"
      value={
        <>
          {props.title}
          <Keybind keys={props.keybind ?? []} variant="neutral" />
        </>
      }
    >
      <Menu gutter={6} modal={false} placement="top-start" onOpenChange={props.onOpenChange}>
        <Menu.Trigger
          as={Button}
          variant="ghost-muted"
          size="normal"
          class={`max-w-[220px] justify-start ![font-weight:440] ${props.class ?? ""}`}
          aria-label={props.title}
        >
          {props.currentIcon}
          <span class="truncate capitalize leading-5">
            {props.options.find((option) => option.id === props.current)?.label ?? props.current}
          </span>
          <span class="-ms-0.5 -me-1 flex shrink-0">
            <Icon name="chevron-down" />
          </span>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content>
            <Menu.RadioGroup value={props.current} onChange={props.onSelect}>
              <For each={props.options}>
                {(option) => (
                  <Menu.RadioItem value={option.id} class="capitalize" closeOnSelect>
                    {option.label}
                  </Menu.RadioItem>
                )}
              </For>
            </Menu.RadioGroup>
          </Menu.Content>
        </Menu.Portal>
      </Menu>
    </Tooltip>
  )
}

// "Steer ⌘⏎" / "Queue ⌘⏎" hint next to the submit button: submits with the
// delivery opposite to what plain Enter does. Visible only while the queue
// exposes an alternate (turn running and composer holding a value), so it
// disappears on its own when the current turn ends.
export function ComposerEditorAlternateDelivery(props: { controller: ComposerEditorModel; keybind: string[] }) {
  const i18n = useI18n()
  const view = props.controller.view
  const action = createMemo(() => {
    const queue = view.submit.queue
    if (!queue || !props.controller.canSubmit()) return undefined
    if (queue.editing()) return "steer" as const
    return queue.alternate()
  })
  const [button, setButton] = createSignal<HTMLButtonElement>()
  const presence = createAnimatedPresence(action, () => button() ?? null)
  return (
    <Show when={presence.present() && presence.value()} keyed>
      {(delivery) => (
        <Tooltip placement="top" inactive={delivery !== "steer"} value={i18n.t("ui.promptInput.steerHint")}>
          <Button
            ref={setButton}
            data-action="composer-alternate-delivery"
            type="button"
            variant="ghost-faint"
            size="small"
            class="me-3 gap-1.5 px-1.5 ![font-weight:530] duration-150 motion-reduce:animate-none"
            classList={{
              "animate-in fade-in": presence.animate() && presence.show(),
              "animate-out fade-out fill-mode-forwards": presence.animate() && !presence.show(),
            }}
            onClick={() => props.controller.submit({ alternate: true })}
          >
            {delivery === "steer" ? i18n.t("ui.promptInput.steer") : i18n.t("ui.promptInput.queue")}
            <span class="hidden sm:block">
              <Keybind keys={props.keybind} variant="neutral" />
            </span>
          </Button>
        </Tooltip>
      )}
    </Show>
  )
}

export function ComposerEditorSubmitButton(props: {
  mode: ComposerMode
  stopping: boolean
  disabled: boolean
  sendLabel: string
  stopLabel: string
  onSubmit: () => void
  onStop: () => void
}) {
  return (
    <Tooltip
      placement="top"
      inactive={!props.stopping && props.disabled}
      value={
        <>
          {props.stopping ? props.stopLabel : props.sendLabel}
          <Show when={props.stopping}>
            <Keybind keys={["Mod", "C"]} variant="neutral" />
          </Show>
        </>
      }
    >
      <IconButton
        data-action="composer-submit"
        type="button"
        disabled={!props.stopping && props.disabled}
        tabIndex={props.mode === "normal" ? undefined : -1}
        icon={<Icon name={props.stopping ? "stop" : props.mode === "shell" ? "arrow-undo-down" : "arrow-up"} />}
        variant="submit"
        class="size-7 rounded-md p-[6px]"
        aria-label={props.stopping ? props.stopLabel : props.sendLabel}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (props.stopping) {
            props.onStop()
            return
          }
          props.onSubmit()
        }}
      />
    </Tooltip>
  )
}
