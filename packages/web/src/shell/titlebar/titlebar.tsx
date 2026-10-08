import { createMemo, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { IconButton } from "@ikanban/ui/icon-button"
import { Icon } from "@ikanban/ui/icon"
import { Keybind } from "@ikanban/ui/keybind"
import { Tooltip } from "@ikanban/ui/tooltip"

import { useLayout } from "@/shell/state/layout"
import { useCommand } from "@/shell/commands/command"
import { useLanguage } from "@/runtime/i18n/language"
import { useSettings } from "@/settings/model"
import { TitlebarTabStrip } from "@/shell/titlebar/tab-strip"
import { createMediaQuery } from "@solid-primitives/media"
import { tabKey, useTabs } from "@/shell/tabs/tabs"
import "./titlebar.css"
import { newTabTooltipKeybind } from "@/shell/commands/tooltip-keybind"
import { TitlebarRightMount } from "@/shell/titlebar/right-slot"
import { ChannelIndicator } from "./channel-indicator"
import { createTitlebarController } from "./controller"
import { TitlebarMobileTabs } from "./mobile-tabs"

export function Titlebar(props: { verticalTabs?: { mount?: HTMLElement } }) {
  const command = useCommand()
  const language = useLanguage()
  const settings = useSettings()
  const mobile = createMediaQuery("(max-width: 767px)")
  const bottom = createMemo(() => mobile() && settings.general.mobileTitlebarPosition() === "bottom")
  const controller = createTitlebarController({ mobile })
  const layout = useLayout()
  const tabs = useTabs()
  const tabsStore = tabs.store
  const tabsStoreActions = tabs
  const { currentTab, openNewTab, goHome } = controller
  const hideVerticalTitlebar = createMemo(() => !!props.verticalTabs)

  return (
    <header
      data-slot="titlebar-v2"
      hidden={hideVerticalTitlebar()}
      classList={{
        "shrink-0 relative flex flex-row h-9 bg-v2-background-bg-deep overflow-visible": true,
        "order-last": bottom(),
      }}
      style={{
        height: bottom()
          ? "calc(28px + max(8px, var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))))"
          : "calc(28px + max(8px, env(safe-area-inset-top, 0px)))",
        "padding-top": bottom() ? "0px" : "env(safe-area-inset-top, 0px)",
        "padding-bottom": bottom() ? "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))" : "0px",
        "padding-left": 0,
      }}
    >
      <div
        class="h-full flex-1 overflow-hidden flex flex-row items-center gap-1.5 px-2 md:pe-3"
        classList={{
          "pt-[max(0px,calc(8px-env(safe-area-inset-top,0px)))]": !bottom(),
          "pb-[max(0px,calc(8px-var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px))))]": bottom(),
        }}
      >
        <Show when={!mobile() && !props.verticalTabs}>
          <ChannelIndicator horizontal active={layout.route().type === "home"} onClick={goHome} />
        </Show>

        <Show when={!mobile()} fallback={<TitlebarMobileTabs controller={controller} />}>
          <Show
            when={props.verticalTabs}
            fallback={
              <>
                <TitlebarTabStrip
                  tabs={tabsStore}
                  currentTab={currentTab()}
                  onNavigate={(tab, el) => {
                    tabs.select(tab)
                    el?.scrollIntoView({ behavior: "instant" })
                  }}
                  onClose={(tab) => {
                    const index = tabsStore.findIndex((item) => tabKey(item) === tabKey(tab))
                    if (index !== -1) tabsStoreActions.closeTab(index)
                  }}
                  onReorder={(keys) => tabsStoreActions.reorder(keys)}
                />
                <Tooltip
                  placement="bottom"
                  value={
                    <>
                      {language.t("command.session.new")}
                      <Keybind keys={newTabTooltipKeybind(command)} variant="neutral" />
                    </>
                  }
                >
                  <IconButton
                    type="button"
                    variant="ghost-muted"
                    size="large"
                    class="shrink-0"
                    icon={<Icon name="plus" />}
                    onClick={openNewTab}
                    aria-label={language.t("command.session.new")}
                  />
                </Tooltip>
              </>
            }
          >
            {(vertical) => (
              <Show when={vertical().mount} keyed>
                {(mount) => (
                  <Portal mount={mount} ref={(element) => (element.className = "flex size-full min-h-0 flex-col")}>
                    <ChannelIndicator sidebar active={layout.route().type === "home"} onClick={goHome} />
                    <button
                      type="button"
                      data-titlebar-tab-action
                      data-action="vertical-tabs-new-session"
                      class="group flex h-7 w-full shrink-0 items-center gap-1.5 rounded-[6px] ps-1.5 pe-2 text-[13px] leading-4 text-v2-text-text-faint hover:text-v2-text-text-base"
                      onClick={openNewTab}
                      aria-label={language.t("command.session.new")}
                    >
                      <Icon name="edit" class="shrink-0" />
                      <span class="min-w-0 truncate">{language.t("command.session.new")}</span>
                      <span
                        class="ms-auto hidden min-w-0 truncate text-v2-text-text-faint group-hover:block group-focus-visible:block"
                        aria-hidden="true"
                      >
                        <bdi dir="ltr">{command.keybind("tab.new")}</bdi>
                      </span>
                    </button>
                    <div class="h-4 w-full shrink-0" aria-hidden="true" />
                    <div class="flex min-h-0 flex-1 flex-col gap-1">
                      <TitlebarTabStrip
                        orientation="vertical"
                        tabs={tabsStore}
                        currentTab={currentTab()}
                        onNavigate={(tab, el) => {
                          tabs.select(tab)
                          el?.scrollIntoView({ behavior: "instant", block: "nearest" })
                        }}
                        onClose={(tab) => {
                          const index = tabsStore.findIndex((item) => tabKey(item) === tabKey(tab))
                          if (index !== -1) tabsStoreActions.closeTab(index)
                        }}
                        onReorder={(keys) => tabsStoreActions.reorder(keys)}
                      />
                    </div>
                  </Portal>
                )}
              </Show>
            )}
          </Show>
        </Show>
        <Show when={!mobile()}>
          <div class="flex-1" />
        </Show>
        <Show when={!props.verticalTabs}>
          <TitlebarRight />
        </Show>
      </div>
    </header>
  )
}

function TitlebarRight() {
  return (
    <div class="relative z-20 flex shrink-0 items-center justify-end gap-0 overflow-visible">
      <TitlebarRightMount />
    </div>
  )
}
