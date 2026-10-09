import { For, Match, Show, Switch, createMemo, type JSX } from "solid-js"
import { Tabs } from "@ikanban/ui/tabs"
import { IconButton } from "@ikanban/ui/icon-button"
import { Icon } from "@ikanban/ui/icon"
import { Keybind } from "@ikanban/ui/keybind"
import { Tooltip } from "@ikanban/ui/tooltip"
import { SessionContextUsage } from "@/session/timeline/session-context-usage"
import { SortableTab } from "@/session/files/tab"
import { useCommand } from "@/shell/commands/command"
import { useLanguage } from "@/runtime/i18n/language"
import { SESSION_OPEN_FILE_TAB, SESSION_BTW_TAB } from "@/session/helpers"
import { useSessionLayout } from "@/session/session-layout"

export const reviewTabID = "session-side-panel-review-tab"
export const reviewTabPanelID = "session-side-panel-review-tabpanel"

export function SessionSideTabList(props: {
  listRef: (el: HTMLDivElement) => void
  sidebarToggle: JSX.Element
  activeTab: string | undefined
  showReview: boolean
  hasReview: boolean
  reviewCount: number
  contextOpen: boolean
  panelTabs: string[]
  temporaryTab: string | undefined
  openTab: (tab: string) => void
  openFileBrowser: () => void
}) {
  const language = useLanguage()
  const command = useCommand()
  const { tabs } = useSessionLayout()
  const openFileKeybind = createMemo(() => command.keybindParts("file.open"))
  const closeTabKeybind = createMemo(() => command.keybindParts("file.close"))

  return (
    <Tabs.List ref={props.listRef} class="min-w-0 flex-1">
      <div class="session-review-v2-sidebar-toggle-slot h-full shrink-0 sticky start-0 z-10 flex items-center justify-center bg-v2-background-bg-base">
        {props.sidebarToggle}
      </div>
      <Show when={props.showReview}>
        <Tabs.Trigger
          value="review"
          id={reviewTabID}
          aria-controls={props.activeTab === "review" ? reviewTabPanelID : undefined}
        >
          {props.hasReview
            ? language.t("session.review.filesChanged", { count: props.reviewCount })
            : language.t("session.tab.review")}
        </Tabs.Trigger>
      </Show>
      <Show when={props.contextOpen}>
        <Tabs.Trigger
          value="context"
          onMiddleClick={() => tabs().close("context")}
          closeButton={
            <Tooltip
              value={
                <>
                  {language.t("common.closeTab")}
                  <Show when={closeTabKeybind().length > 0}>
                    <Keybind keys={closeTabKeybind()} variant="neutral" />
                  </Show>
                </>
              }
              placement="bottom"
              gutter={10}
            >
              <Tabs.CloseButton
                onClick={() => tabs().close("context")}
                aria-label={language.t("common.closeTab")}
              />
            </Tooltip>
          }
          hideCloseButton
        >
          <div class="flex items-center gap-2">
            <SessionContextUsage variant="indicator" />
            <div>{language.t("session.tab.context")}</div>
          </div>
        </Tabs.Trigger>
      </Show>
      <For each={props.panelTabs}>
        {(tab) => (
          <Switch
            fallback={
              <SortableTab
                tab={tab}
                index={tabs().all().indexOf(tab)}
                temporary={props.temporaryTab === tab}
                onTabClose={tabs().close}
                onTabDoubleClick={props.temporaryTab === tab ? props.openTab : undefined}
              />
            }
          >
            <Match when={tab === SESSION_BTW_TAB}>
              <SortableTab tab={tab} index={tabs().all().indexOf(tab)} onTabClose={tabs().close}>
                <div class="flex items-center gap-1.5">
                  <Icon name="bubble-5" size="small" />
                  <span>{language.t("session.tab.btw")}</span>
                </div>
              </SortableTab>
            </Match>
            <Match when={tab === SESSION_OPEN_FILE_TAB}>
              <Tabs.Trigger
                value={SESSION_OPEN_FILE_TAB}
                class="group"
                onMiddleClick={() => tabs().close(SESSION_OPEN_FILE_TAB)}
                closeButton={
                  <Tooltip
                    value={
                      <>
                        {language.t("common.closeTab")}
                        <Show when={closeTabKeybind().length > 0}>
                          <Keybind keys={closeTabKeybind()} variant="neutral" />
                        </Show>
                      </>
                    }
                    placement="bottom"
                    gutter={10}
                  >
                    <IconButton
                      size="small"
                      variant="ghost-muted"
                      class="hover-reveal relative z-10 group-hover:opacity-100"
                      classList={{ "opacity-100": props.activeTab === SESSION_OPEN_FILE_TAB }}
                      onPointerDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                      }}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        tabs().close(SESSION_OPEN_FILE_TAB)
                      }}
                      icon={<Icon name="xmark-small" />}
                      aria-label={language.t("common.closeTab")}
                    />
                  </Tooltip>
                }
                hideCloseButton
              >
                <div class="flex items-center gap-1.5">
                  <Icon name="file-tree" size="small" />
                  <span>{language.t("command.file.open")}</span>
                </div>
              </Tabs.Trigger>
            </Match>
          </Switch>
        )}
      </For>
      <div class="h-full shrink-0 sticky end-0 z-10 flex items-center justify-center bg-v2-background-bg-base">
        <Tooltip
          value={
            <>
              {language.t("command.file.open")}
              <Show when={openFileKeybind().length > 0}>
                <Keybind keys={openFileKeybind()} variant="neutral" />
              </Show>
            </>
          }
          placement="bottom"
          class="flex items-center"
        >
          <IconButton
            icon={<Icon name="plus" />}
            variant="ghost-muted"
            size="large"
            onClick={() => props.openFileBrowser()}
            aria-label={language.t("command.file.open")}
          />
        </Tooltip>
      </div>
    </Tabs.List>
  )
}
