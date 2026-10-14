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
import { useModels } from "./models"
import { modelSelectorSections, type ModelSection } from "./selector-sections"
import { nextModelOption } from "./selector-navigation"
import "@/settings/settings.css"

export const ModelList: Component<{
  provider?: string
  onSelect: () => void
  model?: ModelState
}> = (props) => {
  const language = useLanguage()
  const preferences = useModels()
  const controller = createModelSelectorController({
    model: props.model,
    provider: () => props.provider,
    onSelect: props.onSelect,
  })
  const [store, setStore] = createStore({
    search: "",
    active: "",
    keyboard: false,
    collapsed: {} as Record<string, boolean>,
  })
  const models = createMemo(() => controller.models(store.search))
  const groups = createMemo(() =>
    modelSelectorSections({
      groups: controller.groups(models()),
      favorites: preferences.favorite.list(),
      recent: preferences.recent.list(),
      searching: store.search.trim().length > 0,
    }),
  )
  const sectionKey = (group: ModelSection<unknown>) => `${group.kind}:${group.category}`
  const expanded = (group: ModelSection<unknown>) =>
    store.search.length > 0 || !store.collapsed[sectionKey(group)]
  const visibleModels = () => groups().flatMap((group) => (expanded(group) ? group.items : []))
  let scrollRef: HTMLDivElement | undefined
  let searchRef: HTMLInputElement | undefined

  const setSearch = (value: string) => {
    setStore("search", value)
    const first = visibleModels()[0]
    setStore({ active: first ? modelKey(first) : "", keyboard: false })
  }
  const moveActive = (delta: 1 | -1) => {
    const keys = visibleModels().map(modelKey)
    if (keys.length === 0) return
    setStore({
      active: nextModelOption(keys, store.keyboard ? store.active : undefined, delta),
      keyboard: true,
    })
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
            ref={(element) => (searchRef = element)}
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
            onFocus={() => setStore("keyboard", false)}
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
                const open = () => expanded(group)

                return (
                  <section
                    class="settings-section"
                    data-model-section={group.kind}
                    data-expanded={open() ? "" : undefined}
                  >
                    <h3 class="settings-models-group-header">
                      <button
                        type="button"
                        class="settings-models-group-trigger"
                        aria-expanded={open()}
                        disabled={searching()}
                        onClick={() => setStore("collapsed", sectionKey(group), open())}
                      >
                        <span class="settings-models-group-chevron">
                          <Icon name="chevron-down" size="small" classList={{ "-rotate-90 rtl:rotate-90": !open() }} />
                        </span>
                        <span class="settings-models-group-label">
                          <Show
                            when={group.kind === "provider"}
                            fallback={<Icon name={group.kind === "favorites" ? "star" : "clock"} size="small" />}
                          >
                            <ProviderIcon id={group.category} width={16} height={16} class="shrink-0" />
                          </Show>
                          <span class="settings-models-group-title">
                            {group.kind === "favorites"
                              ? language.t("dialog.model.favorites")
                              : group.kind === "recent"
                                ? language.t("dialog.model.recent")
                                : group.items[0].provider.name}
                          </span>
                        </span>
                      </button>
                    </h3>
                    <Show when={open()}>
                      <SettingsList variant="catalog">
                        <For each={group.items}>
                          {(item) => (
                            <div
                              data-component="settings-row"
                              class="-mx-4 w-[calc(100%+32px)] !gap-2 !py-0 pl-0 pr-4 first:rounded-t-lg last:rounded-b-lg hover:bg-v2-overlay-simple-overlay-hover"
                              classList={{ "bg-v2-overlay-simple-overlay-hover": store.active === modelKey(item) }}
                              onMouseMove={() => setStore({ active: modelKey(item), keyboard: false })}
                              onMouseLeave={() => {
                                if (!store.keyboard) setStore("active", "")
                              }}
                            >
                              <button
                                type="button"
                                data-option-key={modelKey(item)}
                                aria-current={controller.current() === modelKey(item) ? "true" : undefined}
                                class="flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-md py-3 pl-4 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
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
                                  <Show when={group.kind !== "provider"}>
                                    <div data-slot="settings-row-description">{item.provider.name}</div>
                                  </Show>
                                </div>
                                <div data-slot="settings-row-control" class="size-4">
                                  <Show when={controller.current() === modelKey(item)}>
                                    <Icon name="check" size="small" class="shrink-0 text-v2-icon-icon-base" />
                                  </Show>
                                </div>
                              </button>
                              <IconButton
                                type="button"
                                size="small"
                                variant="ghost-muted"
                                data-favorite-key={modelKey(item)}
                                icon={
                                  <Icon
                                    name={
                                      preferences.favorite.has({ providerID: item.provider.id, modelID: item.id })
                                        ? "star-filled"
                                        : "star"
                                    }
                                    size="small"
                                  />
                                }
                                aria-pressed={preferences.favorite.has({ providerID: item.provider.id, modelID: item.id })}
                                aria-label={language.t(
                                  preferences.favorite.has({ providerID: item.provider.id, modelID: item.id })
                                    ? "dialog.model.favorite.remove"
                                    : "dialog.model.favorite.add",
                                  { model: item.name, provider: item.provider.name },
                                )}
                                onClick={() => {
                                  const key = { providerID: item.provider.id, modelID: item.id }
                                  preferences.favorite.set(key, !preferences.favorite.has(key))
                                  queueMicrotask(() => {
                                    const target =
                                      scrollRef?.querySelector<HTMLButtonElement>(
                                        `[data-favorite-key="${CSS.escape(modelKey(item))}"]`,
                                      ) ?? searchRef
                                    target?.focus({ preventScroll: true })
                                  })
                                }}
                              />
                            </div>
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
