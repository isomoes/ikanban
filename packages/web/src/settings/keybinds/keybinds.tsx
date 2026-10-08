import { For, Show, createEffect, createMemo, on, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { Button } from "@ikanban/ui/button"
import { Icon } from "@ikanban/ui/icon"
import { IconButton } from "@ikanban/ui/icon-button"
import { TextInput } from "@ikanban/ui/text-input"
import { useCommand } from "@/shell/commands/command"
import { useLanguage } from "@/runtime/i18n/language"
import { useSettings } from "@/settings/model"
import { SettingsList } from "@/settings/list"
import type { KeybindGroup } from "./catalog"
import { createKeybindSettingsController } from "./controller"

export { createKeybindSettingsController }

type GroupKey =
  | "settings.shortcuts.group.general"
  | "settings.shortcuts.group.session"
  | "settings.shortcuts.group.navigation"
  | "settings.shortcuts.group.modelAndAgent"
  | "settings.shortcuts.group.terminal"
  | "settings.shortcuts.group.prompt"

const groupKey: Record<KeybindGroup, GroupKey> = {
  General: "settings.shortcuts.group.general",
  Session: "settings.shortcuts.group.session",
  Navigation: "settings.shortcuts.group.navigation",
  "Model and agent": "settings.shortcuts.group.modelAndAgent",
  Terminal: "settings.shortcuts.group.terminal",
  Prompt: "settings.shortcuts.group.prompt",
}

export function SettingsKeybinds(props: { active?: boolean; autofocus?: boolean }) {
  const command = useCommand()
  const settings = useSettings()
  const controller = createKeybindSettingsController({
    command,
    settings,
  })

  return (
    <SettingsKeybindsView
      visible={props.active}
      autofocus={props.autofocus}
      groups={controller.catalog.groups}
      filtered={controller.catalog.filtered}
      title={controller.catalog.title}
      keybind={controller.catalog.keybind}
      active={controller.capture.active()}
      onCapture={controller.capture.toggle}
      hasOverrides={controller.settings.hasOverrides()}
      onReset={controller.settings.reset}
    />
  )
}

function SettingsKeybindsView(props: {
  visible?: boolean
  autofocus?: boolean
  groups: KeybindGroup[]
  filtered: (query: string) => Map<KeybindGroup, string[]>
  title: (id: string) => string
  keybind: (id: string) => string
  active: string | null
  onCapture: (id: string) => void
  hasOverrides: boolean
  onReset: () => void
}) {
  const language = useLanguage()
  let search: HTMLInputElement | undefined
  createEffect(
    on(
      () => props.visible ?? true,
      (visible) => {
        if (!visible) return
        const frame = requestAnimationFrame(() => {
          if (props.visible !== false && props.autofocus !== false && search?.isConnected)
            search.focus({ preventScroll: true })
        })
        onCleanup(() => cancelAnimationFrame(frame))
      },
    ),
  )
  const [store, setStore] = createStore({ filter: "" })
  const filtered = createMemo(() => props.filtered(store.filter))
  const hasResults = createMemo(() => props.groups.some((group) => (filtered().get(group)?.length ?? 0) > 0))

  return (
    <>
      <div class="settings-tab-header settings-tab-header--stacked">
        <div class="settings-tab-header-row">
          <div class="flex flex-col gap-1">
            <h2 class="settings-tab-title">{language.t("settings.shortcuts.title")}</h2>
            <span class="text-11-regular text-v2-text-text-muted">{language.t("settings.shortcuts.description")}</span>
          </div>
          <Button variant="ghost" onClick={props.onReset} disabled={!props.hasOverrides}>
            {language.t("settings.shortcuts.reset.button")}
          </Button>
        </div>
        <div class="settings-tab-search">
          <TextInput
            ref={search}
            type="search"
            appearance="base"
            value={store.filter}
            onInput={(event) => setStore("filter", event.currentTarget.value)}
            placeholder={language.t("settings.shortcuts.search.placeholder")}
            spellcheck={false}
            autocorrect="off"
            autocomplete="off"
            autocapitalize="off"
            aria-label={language.t("settings.shortcuts.search.placeholder")}
          />
          <Show when={store.filter}>
            <IconButton
              type="button"
              variant="ghost-muted"
              size="small"
              class="settings-tab-search-clear"
              icon={<Icon name="close" size="large" class="text-v2-icon-icon-muted" />}
              onClick={() => setStore("filter", "")}
            />
          </Show>
        </div>
      </div>
      <div class="settings-tab-body">
        <div class="settings-shortcuts settings-section-stack">
          <For each={props.groups}>
            {(group) => (
              <Show when={(filtered().get(group) ?? []).length > 0}>
                <div class="settings-section">
                  <h3 class="settings-section-title">{language.t(groupKey[group])}</h3>
                  <SettingsList>
                    <For each={filtered().get(group) ?? []}>
                      {(id) => (
                        <div class="flex items-center justify-between gap-4 py-3 border-b border-border-weak-base last:border-none">
                          <span>{props.title(id)}</span>
                          <button
                            type="button"
                            data-keybind-id={id}
                            classList={{
                              "settings-keybind-button": true,
                              "settings-keybind-button--active": props.active === id,
                            }}
                            onClick={() => props.onCapture(id)}
                          >
                            <Show
                              when={props.active === id}
                              fallback={props.keybind(id) || language.t("settings.shortcuts.unassigned")}
                            >
                              {language.t("settings.shortcuts.pressKeys")}
                            </Show>
                          </button>
                        </div>
                      )}
                    </For>
                  </SettingsList>
                </div>
              </Show>
            )}
          </For>
          <Show when={store.filter && !hasResults()}>
            <div class="settings-shortcuts-status">
              <span>{language.t("settings.shortcuts.search.empty")}</span>
              <span class="settings-shortcuts-status-filter">&quot;{store.filter}&quot;</span>
            </div>
          </Show>
        </div>
      </div>
    </>
  )
}
