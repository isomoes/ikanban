import { Show } from "solid-js"
import { Icon } from "@ikanban/ui/icon"
import { SessionProgressIndicatorV2 } from "@ikanban/session-ui/v2/session-progress-indicator-v2"
import { useLayout } from "@/shell/state/layout"
import { usePlatform } from "@/runtime/platform/platform"
import { useLanguage } from "@/runtime/i18n/language"
import { useSettingsDialog } from "@/settings/command"
import { tabKey, useTabs } from "@/shell/tabs/tabs"
import { TitlebarTabStrip } from "@/shell/titlebar/tab-strip"
import { MobileDrawer, MobileDrawerContent, MobileDrawerLabel, MobileDrawerTrigger } from "@/shell/mobile-drawer"
import { SessionTabAvatar } from "@/shell/layout/session-tab-avatar"
import { IKANBAN_ISSUES } from "@/shell/links"
import type { TitlebarController } from "./controller"

export function TitlebarMobileTabs(props: { controller: TitlebarController }) {
  const platform = usePlatform()
  const language = useLanguage()
  const openSettings = useSettingsDialog()
  const layout = useLayout()
  const tabs = useTabs()
  const tabsStore = tabs.store
  const tabsStoreActions = tabs
  const {
    mobileTabs,
    setMobileTabs,
    currentTab,
    session,
    preparing,
    currentProject,
    currentProjectName,
    currentTitle,
  } = props.controller
  const { openNewTab, toggleHome } = props.controller

  return (
    <MobileDrawer
      open={mobileTabs.open}
      onOpenChange={(open) => setMobileTabs("open", open)}
      onContentPresentChange={(present) => {
        if (present || !mobileTabs.settings) return
        setMobileTabs("settings", false)
        openSettings()
      }}
    >
      <MobileDrawerTrigger
        data-slot="mobile-tabs-trigger"
        class="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-[6px] px-2 text-[13px] leading-4 text-v2-text-text-base focus-visible:outline-none"
        aria-label={language.t("titlebar.tabs")}
      >
        <Show when={currentTab()} fallback={<Icon name="grid-plus" class="shrink-0" />}>
          {(tab) => (
            <span data-slot="project-avatar-slot" class="flex size-4 shrink-0 items-center justify-center">
              <Show
                when={session()}
                fallback={
                  tab().type === "draft" ? (
                    <Icon name="edit" />
                  ) : (
                    <Show
                      when={preparing()}
                      fallback={
                        <span
                          class="block size-4 rounded-[3px] border border-v2-border-border-muted"
                          aria-hidden="true"
                        />
                      }
                    >
                      <SessionProgressIndicatorV2 />
                    </Show>
                  )
                }
              >
                {(value) => (
                  <SessionTabAvatar
                    project={currentProject()}
                    directory={value().location.directory}
                    sessionId={value().id}
                    server={tab().server}
                  />
                )}
              </Show>
            </span>
          )}
        </Show>
        <Show when={currentProjectName()}>
          {(name) => (
            <span
              data-slot="mobile-tab-project"
              dir="auto"
              title={session()?.location.directory}
              class="max-w-[35%] shrink-0 truncate border-e border-v2-border-border-muted pe-2 text-[11px] text-v2-text-text-muted"
            >
              {name()}
            </span>
          )}
        </Show>
        <span data-slot="mobile-tab-title" dir="auto" class="min-w-0 flex-1 truncate text-start">
          {currentTitle()}
        </span>
        <span class="shrink-0 text-v2-text-text-muted">{tabsStore.length}</span>
      </MobileDrawerTrigger>
      <MobileDrawerContent>
        <MobileDrawerLabel class="sr-only">{language.t("titlebar.tabs")}</MobileDrawerLabel>
        <div data-slot="mobile-tabs-drawer" data-corvu-no-drag>
          <div data-slot="mobile-tabs-drawer-list">
            <TitlebarTabStrip
              orientation="vertical"
              tabs={tabsStore}
              currentTab={currentTab()}
              onNavigate={(tab) => {
                tabs.select(tab)
                setMobileTabs("open", false)
              }}
              onClose={(tab) => {
                const index = tabsStore.findIndex((item) => tabKey(item) === tabKey(tab))
                if (index !== -1) tabsStoreActions.closeTab(index)
              }}
              onReorder={(keys) => tabsStoreActions.reorder(keys)}
            />
          </div>
          <button
            type="button"
            data-action="mobile-tabs-new-session"
            class="flex h-7 w-full shrink-0 items-center gap-2 rounded-[6px] px-2 text-[13px] leading-4 text-v2-text-text-base hover:bg-v2-background-bg-layer-02 focus-visible:outline-none focus-visible:bg-v2-background-bg-layer-02"
            onClick={() => {
              openNewTab()
              setMobileTabs("open", false)
            }}
          >
            <Icon name="plus" />
            {language.t("command.session.new")}
          </button>
          <div class="flex shrink-0 flex-col gap-1 border-t border-v2-border-border-muted pt-2">
            <button
              type="button"
              data-action="mobile-tabs-home"
              data-state={layout.route().type === "home" ? "pressed" : undefined}
              aria-current={layout.route().type === "home" ? "page" : undefined}
              class="flex h-7 w-full items-center gap-2 rounded-[6px] px-2 text-[13px] leading-4 text-v2-text-text-faint data-[state=pressed]:text-v2-text-text-base focus-visible:outline-none"
              onClick={() => {
                if (layout.route().type !== "home") toggleHome()
                setMobileTabs("open", false)
              }}
            >
              <Icon name="grid-plus" />
              {language.t("home.title")}
            </button>
            <div class="flex items-center gap-1">
              <button
                type="button"
                data-action="mobile-tabs-settings"
                class="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-[6px] px-2 text-[13px] leading-4 text-v2-text-text-faint hover:bg-v2-background-bg-layer-02 focus-visible:outline-none focus-visible:bg-v2-background-bg-layer-02"
                onClick={() => setMobileTabs({ open: false, settings: true })}
              >
                <Icon name="settings-gear" size="small" />
                {language.t("sidebar.settings")}
              </button>
              <button
                type="button"
                data-action="mobile-tabs-help"
                class="flex h-7 shrink-0 items-center gap-2 rounded-[6px] px-2 text-[13px] leading-4 text-v2-text-text-faint hover:bg-v2-background-bg-layer-02 focus-visible:outline-none focus-visible:bg-v2-background-bg-layer-02"
                onClick={() => {
                  setMobileTabs("open", false)
                  platform.openExternal(IKANBAN_ISSUES)
                }}
              >
                <Icon name="help" size="small" />
                {language.t("sidebar.help")}
              </button>
            </div>
          </div>
        </div>
      </MobileDrawerContent>
    </MobileDrawer>
  )
}
