import { Component, createMemo, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Badge } from "@ikanban/ui/badge"
import { Icon } from "@ikanban/ui/icon"
import { IconButton } from "@ikanban/ui/icon-button"
import { Tooltip } from "@ikanban/ui/tooltip"
import { TextInput } from "@ikanban/ui/text-input"
import { ProviderIcon } from "@ikanban/ui/provider-icon"
import { ModelTooltip } from "./tooltip"
import { useLanguage } from "@/runtime/i18n/language"
import { SettingsList } from "@/settings/list"
import { createModelSelectorController, isFree, modelKey, type ModelState } from "./selector-controller"
import "@/settings/settings.css"

export const ModelList: Component<{
  provider?: string
  onSelect: () => void
  model?: ModelState
}> = (props) => {
  const language = useLanguage()
  const controller = createModelSelectorController({
    model: props.model,
    provider: () => props.provider,
    onSelect: props.onSelect,
  })
  const [store, setStore] = createStore({
    search: "",
    active: "",
    collapsed: {} as Record<string, boolean>,
  })
  const models = createMemo(() => controller.models(store.search))
  const groups = createMemo(() => controller.groups(models()))
  const expanded = (provider: string) => store.search.length > 0 || !store.collapsed[provider]
  const visibleModels = () => models().filter((item) => expanded(item.provider.id))
  let scrollRef: HTMLDivElement | undefined

  const setSearch = (value: string) => {
    const first = controller.models(value).find((item) => value.length > 0 || !store.collapsed[item.provider.id])
    setStore({ search: value, active: first ? modelKey(first) : "" })
  }
  const moveActive = (delta: number) => {
    const keys = visibleModels().map(modelKey)
    if (keys.length === 0) return
    const index = keys.indexOf(store.active)
    const start = index === -1 ? (delta > 0 ? -1 : 0) : index
    setStore("active", keys[(start + delta + keys.length) % keys.length])
    queueMicrotask(() => {
      scrollRef
        ?.querySelector<HTMLElement>(`[data-option-key="${CSS.escape(store.active)}"]`)
        ?.scrollIntoView({ block: "nearest" })
    })
  }
  const selectActive = () => {
    const item = visibleModels().find((item) => modelKey(item) === store.active)
    if (item) controller.select(item)
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <div class="shrink-0 px-4 pt-px pb-3">
        <div class="relative">
          <TextInput
            type="search"
            appearance="base"
            class="!w-full self-stretch"
            placeholder={language.t("dialog.model.search.placeholder")}
            value={store.search}
            autofocus
            spellcheck={false}
            autocorrect="off"
            autocomplete="off"
            autocapitalize="off"
            onInput={(event) => setSearch(event.currentTarget.value)}
            onKeyDown={(event) => {
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
            aria-label={language.t("dialog.model.search.placeholder")}
          />
          <Show when={store.search}>
            <IconButton
              type="button"
              variant="ghost-muted"
              size="small"
              class="settings-tab-search-clear"
              icon={<Icon name="close" size="large" class="text-v2-icon-icon-muted" />}
              onClick={() => setSearch("")}
              aria-label={language.t("common.clear")}
            />
          </Show>
        </div>
      </div>
      <div class="relative min-h-0 flex-1">
        <div ref={(element) => (scrollRef = element)} class="settings-panel settings-models h-full px-4 pt-4 pb-4">
          <Show
            when={models().length > 0}
            fallback={<div class="settings-models-status">{language.t("dialog.model.empty")}</div>}
          >
            <For each={groups()}>
              {(group) => {
                const searching = () => store.search.length > 0
                const open = () => expanded(group.category)

                return (
                  <section class="settings-section" data-expanded={open() ? "" : undefined}>
                    <h3 class="settings-models-group-header">
                      <button
                        type="button"
                        class="settings-models-group-trigger"
                        aria-expanded={open()}
                        disabled={searching()}
                        onClick={() => setStore("collapsed", group.category, open())}
                      >
                        <span class="settings-models-group-chevron">
                          <Icon name="chevron-down" size="small" classList={{ "-rotate-90 rtl:rotate-90": !open() }} />
                        </span>
                        <span class="settings-models-group-label">
                          <ProviderIcon id={group.category} width={16} height={16} class="shrink-0" />
                          <span class="settings-models-group-title">{group.items[0].provider.name}</span>
                        </span>
                      </button>
                    </h3>
                    <Show when={open()}>
                      <SettingsList variant="catalog">
                        <For each={group.items}>
                          {(item) => (
                            <button
                              type="button"
                              data-component="settings-row"
                              data-option-key={modelKey(item)}
                              class="-mx-4 w-[calc(100%+32px)] px-4 text-start first:rounded-t-lg last:rounded-b-lg hover:bg-v2-overlay-simple-overlay-hover focus-visible:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none"
                              classList={{ "bg-v2-overlay-simple-overlay-hover": store.active === modelKey(item) }}
                              onMouseEnter={() => setStore("active", modelKey(item))}
                              onMouseLeave={() => setStore("active", "")}
                              onClick={() => controller.select(item)}
                            >
                              <div data-slot="settings-row-copy">
                                <div data-slot="settings-row-title" class="flex items-center gap-2">
                                  <Tooltip
                                    placement="right-start"
                                    gutter={12}
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
                                    <span class="min-w-0 truncate">{item.name}</span>
                                  </Tooltip>
                                  <Show when={isFree(item.provider.id, item.cost)}>
                                    <Badge class="shrink-0">{language.t("model.tag.free")}</Badge>
                                  </Show>
                                  <Show when={item.latest}>
                                    <Badge class="shrink-0">{language.t("model.tag.latest")}</Badge>
                                  </Show>
                                </div>
                              </div>
                              <div data-slot="settings-row-control" class="size-4">
                                <Show when={controller.current() === modelKey(item)}>
                                  <Icon name="check" size="small" class="shrink-0 text-v2-icon-icon-base" />
                                </Show>
                              </div>
                            </button>
                          )}
                        </For>
                      </SettingsList>
                    </Show>
                  </section>
                )
              }}
            </For>
          </Show>
        </div>
      </div>
    </div>
  )
}
