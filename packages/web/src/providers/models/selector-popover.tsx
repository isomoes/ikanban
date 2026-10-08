import { Popover } from "@kobalte/core/popover"
import { ComponentProps, createEffect, createMemo, For, JSX, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useDialog } from "@ikanban/ui/context/dialog"
import { Badge } from "@ikanban/ui/badge"
import { Icon } from "@ikanban/ui/icon"
import { ScrollView } from "@ikanban/ui/scroll-view"
import { Tooltip } from "@ikanban/ui/tooltip"
import { Menu } from "@ikanban/ui/menu"
import { ModelTooltip } from "./tooltip"
import { useLanguage } from "@/runtime/i18n/language"
import { handleDocumentSearchKeydown } from "@/shell/commands/search-keydown"
import { createMenuDismissController } from "@/shell/commands/menu-dismiss"
import { createEventListener } from "@solid-primitives/event-listener"
import {
  createModelSelectorController,
  isFree,
  manageKey,
  modelKey,
  type ModelItem,
  type ModelState,
} from "./selector-controller"

type ModelSelectorTriggerProps = Omit<ComponentProps<typeof Popover.Trigger>, "as" | "ref">
type ModelSelectorTrigger = (props: ModelSelectorTriggerProps) => JSX.Element
export function ModelSelectorPopover(props: {
  provider?: string
  model?: ModelState
  trigger: ModelSelectorTrigger
  onClose?: () => void
}) {
  const dialog = useDialog()
  const controller = createModelSelectorController({
    model: props.model,
    provider: () => props.provider,
    onSelect: () => props.onClose?.(),
  })

  return (
    <ModelSelectorPopoverView
      trigger={props.trigger}
      models={controller.models}
      groups={controller.groups}
      current={controller.current()}
      select={controller.select}
      onManage={() => {
        void import("./manage").then((module) => {
          void dialog.show(() => <module.DialogManageModels />)
        })
      }}
      onClose={() => props.onClose?.()}
    />
  )
}

function ModelSelectorPopoverView(props: {
  trigger: ModelSelectorTrigger
  models: (search: string) => ModelItem[]
  groups: (models: ModelItem[]) => { category: string; items: ModelItem[] }[]
  current: string | undefined
  select: (item: ModelItem) => void
  onManage: () => void
  onClose: () => void
}) {
  const language = useLanguage()
  const [store, setStore] = createStore({ open: false, search: "", active: "" })
  let searchRef: HTMLInputElement | undefined
  let contentRef: HTMLDivElement | undefined
  const dismiss = createMenuDismissController(() => contentRef)

  const models = createMemo(() => props.models(store.search))
  const groups = createMemo(() => props.groups(models()))
  const keys = () => [...groups().flatMap((group) => group.items.map(modelKey)), manageKey]
  const initialActive = () => {
    const selected = props.current
    const options = keys()
    if (selected && options.includes(selected)) return selected
    return options[0] ?? ""
  }
  const activeItem = () =>
    store.active ? contentRef?.querySelector<HTMLElement>(`[data-option-key="${CSS.escape(store.active)}"]`) : undefined
  const setOpen = (open: boolean) => {
    if (open) {
      dismiss.allowTriggerRestore()
      setStore({ open: true, active: initialActive() })
      setTimeout(() =>
        requestAnimationFrame(() => {
          searchRef?.focus()
          activeItem()?.scrollIntoView({ block: "nearest" })
        }),
      )
      return
    }
    setStore({ open: false, search: "", active: "" })
  }
  const selectModel = (item: ModelItem) => {
    dismiss.preventTriggerRestore()
    setOpen(false)
    dismiss.afterClose(() => props.select(item))
  }
  const manage = () => {
    dismiss.preventTriggerRestore()
    setOpen(false)
    dismiss.afterClose(props.onManage)
  }
  const selectActive = () => {
    const item = models().find((item) => modelKey(item) === store.active)
    if (item) {
      selectModel(item)
      return
    }
    if (store.active === manageKey) manage()
  }
  const moveActive = (delta: number) => {
    const options = keys()
    if (options.length === 0) return
    const index = options.indexOf(store.active)
    const start = index === -1 ? 0 : index
    setStore("active", options[(start + delta + options.length) % options.length])
    queueMicrotask(() => activeItem()?.scrollIntoView({ block: "nearest" }))
  }
  const setSearch = (value: string) => {
    const first = props.models(value)[0]
    setStore({ search: value, active: first ? modelKey(first) : manageKey })
  }

  createEffect(() => {
    if (!store.open) return
    createEventListener(
      document,
      "keydown",
      (event: KeyboardEvent) => handleDocumentSearchKeydown(searchRef, event, store.search, setSearch),
      true,
    )
  })

  return (
    <Menu open={store.open} modal={false} placement="top-start" gutter={6} onOpenChange={setOpen}>
      <Menu.Trigger as={props.trigger} />
      <Menu.Portal>
        <Menu.Content
          ref={(element: HTMLDivElement) => (contentRef = element)}
          class="w-[284px] overflow-hidden rounded-md border-0 bg-v2-background-bg-layer-01 !p-0 shadow-[var(--v2-elevation-floating)] focus:outline-none"
          onPointerDownOutside={dismiss.preventTriggerRestore}
          onFocusOutside={dismiss.preventTriggerRestore}
          onCloseAutoFocus={dismiss.onCloseAutoFocus}
        >
          <div class="flex flex-col p-0.5">
            <div class="flex h-7 items-center gap-2 rounded-sm pl-3 pr-2.5 text-v2-icon-icon-muted">
              <Icon name="magnifying-glass" size="small" class="shrink-0" />
              <input
                ref={(el) => (searchRef = el)}
                value={store.search}
                placeholder={language.t("dialog.model.search.placeholder")}
                class="h-7 min-w-0 flex-1 border-0 bg-transparent text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-base outline-none placeholder:text-v2-text-text-faint"
                spellcheck={false}
                autocorrect="off"
                autocomplete="off"
                autocapitalize="off"
                onInput={(event) => setSearch(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Tab") return
                  event.stopPropagation()
                  if (event.key === "Escape") {
                    event.preventDefault()
                    dismiss.preventTriggerRestore()
                    setOpen(false)
                    dismiss.afterClose(props.onClose)
                    return
                  }
                  if (event.altKey || event.metaKey) return
                  if (event.key === "ArrowDown") {
                    event.preventDefault()
                    moveActive(1)
                    return
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault()
                    moveActive(-1)
                    return
                  }
                  if (event.key === "Enter" && !event.isComposing) {
                    event.preventDefault()
                    selectActive()
                  }
                }}
              />
              <Show when={store.search.trim()}>
                <button
                  type="button"
                  class="flex size-5 items-center justify-center rounded-sm text-v2-icon-icon-muted hover:bg-v2-overlay-simple-overlay-hover"
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => setSearch("")}
                  aria-label={language.t("common.clear")}
                >
                  <Icon name="close" size="small" />
                </button>
              </Show>
            </div>
          </div>
          <div class="h-px bg-v2-border-border-muted" />
          <ScrollView data-slot="model-selector-scroll" class="max-h-[220px] min-h-0">
            <div class="flex flex-col p-0.5 pt-0">
              <Show
                when={models().length > 0}
                fallback={
                  <div class="flex h-12 items-center px-3 text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-faint">
                    {language.t("dialog.model.empty")}
                  </div>
                }
              >
                <For each={groups()}>
                  {(group) => (
                    <Menu.Group>
                      <Menu.GroupLabel class="gap-2 px-3">
                        <span class="min-w-0 truncate">{group.items[0].provider.name}</span>
                      </Menu.GroupLabel>
                      <Menu.RadioGroup value={props.current}>
                        <For each={group.items}>
                          {(item) => (
                            <Tooltip
                              class="w-full"
                              placement="right-start"
                              gutter={6}
                              openDelay={0}
                              value={
                                <ModelTooltip
                                  model={item}
                                  latest={item.latest}
                                  free={isFree(item.provider.id, item.cost)}
                                  v2
                                />
                              }
                            >
                              <Menu.RadioItem
                                value={modelKey(item)}
                                data-option-key={modelKey(item)}
                                data-selected-model={props.current === modelKey(item) ? true : undefined}
                                class="scroll-my-6 w-full"
                                classList={{ "!bg-v2-overlay-simple-overlay-hover": store.active === modelKey(item) }}
                                onMouseEnter={() => {
                                  setStore("active", modelKey(item))
                                  setTimeout(() => searchRef?.focus())
                                }}
                                onSelect={() => selectModel(item)}
                              >
                                <span class="min-w-0 truncate leading-5">{item.name}</span>
                                <Show when={isFree(item.provider.id, item.cost)}>
                                  <Badge class="shrink-0">{language.t("model.tag.free")}</Badge>
                                </Show>
                                <Show when={item.latest}>
                                  <Badge class="shrink-0">{language.t("model.tag.latest")}</Badge>
                                </Show>
                              </Menu.RadioItem>
                            </Tooltip>
                          )}
                        </For>
                      </Menu.RadioGroup>
                    </Menu.Group>
                  )}
                </For>
              </Show>
            </div>
          </ScrollView>
          <div class="h-px bg-v2-border-border-muted" />
          <div class="flex flex-col p-0.5">
            <Menu.Item
              data-option-key={manageKey}
              classList={{ "!bg-v2-overlay-simple-overlay-hover": store.active === manageKey }}
              onMouseEnter={() => {
                setStore("active", manageKey)
                setTimeout(() => searchRef?.focus())
              }}
              onSelect={manage}
            >
              <Icon name="outline-sliders" size="small" />
              <span class="min-w-0 flex-1 truncate leading-5">{language.t("dialog.model.manage")}</span>
            </Menu.Item>
          </div>
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  )
}
