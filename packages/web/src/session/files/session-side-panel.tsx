import { Show, createEffect, createMemo, onCleanup, type JSX } from "solid-js"
import { createMediaQuery } from "@solid-primitives/media"
import { createEventListener } from "@solid-primitives/event-listener"
import { DragDropProvider, PointerSensor } from "@dnd-kit/solid"
import { isSortable } from "@dnd-kit/solid/sortable"
import { Accessibility, AutoScroller, Feedback, PointerActivationConstraints } from "@dnd-kit/dom"
import { RestrictToHorizontalAxis } from "@dnd-kit/abstract/modifiers"
import { RestrictToElement } from "@dnd-kit/dom/modifiers"
import { Tabs } from "@ikanban/ui/tabs"
import { Mark } from "@ikanban/ui/logo"
import type { FileDiffInfo } from "@opencode/client/promise"

import { SessionContextTab } from "@/session/files/session-context-tab"
import { fileTreeKinds } from "@/session/files/side-panel-kinds"
import { SessionSideFileTree, FILE_TREE_WIDTH_MIN } from "@/session/files/side-panel-file-tree"
import { SessionSideTabList, reviewTabID, reviewTabPanelID } from "@/session/files/side-panel-tab-list"
import { useFile, type SelectedLineRange } from "@/workspaces/files/model"
import { useLanguage } from "@/runtime/i18n/language"
import { useLayout } from "@/shell/state/layout"
import { useSettings } from "@/settings/model"
import { createFileTabListSync } from "@/session/files/file-tab-scroll"
import {
  SESSION_OPEN_FILE_TAB,
  SESSION_BTW_TAB,
  createOpenSessionFileTab,
  createSessionTabs,
  shouldShowFileTree,
  type Sizing,
} from "@/session/helpers"
import { setSessionHandoff } from "@/session/handoff"
import { useSessionLayout } from "@/session/session-layout"
import { SessionFileBrowserTab, type SessionFileBrowserState } from "@/session/files/session-file-browser-tab"

const fileBrowserTabPanelID = "session-side-panel-file-browser-tabpanel"

type ReviewDiff = FileDiffInfo
type RenderDiff = FileDiffInfo

function renderDiff(value: ReviewDiff): value is RenderDiff {
  return typeof value.file === "string"
}

export function SessionSidePanel(props: {
  canReview: boolean
  diffs: ReviewDiff[]
  diffsReady: boolean
  hasReview: boolean
  reviewHasFocusableContent: boolean
  reviewCount: number
  reviewPanel: () => JSX.Element
  reviewSidebarToggle: (disabled: boolean) => JSX.Element
  fileBrowserState: SessionFileBrowserState
  activeDiff?: string
  focusReviewDiff: (path: string) => void
  reviewPresent?: boolean
  size: Sizing
  stacked?: boolean
  btwPanel: () => JSX.Element
}) {
  const layout = useLayout()
  const settings = useSettings()
  const file = useFile()
  const language = useLanguage()
  const { sessionKey, tabs, view, params } = useSessionLayout()

  const isDesktop = createMediaQuery("(min-width: 768px)")
  const shown = settings.visibility.fileTree

  const reviewOpen = createMemo(() => isDesktop() && view().reviewPanel.opened())
  const reviewVisible = createMemo(() => reviewOpen() || !!props.reviewPresent)
  const fileOpen = createMemo(
    () =>
      isDesktop() &&
      shouldShowFileTree({
        visible: shown(),
        opened: layout.fileTree.opened(),
      }),
  )
  const open = createMemo(() => reviewOpen() || fileOpen())
  const visible = createMemo(() => reviewVisible() || fileOpen())
  const fileTreeWidth = createMemo(() => Math.max(FILE_TREE_WIDTH_MIN, layout.fileTree.width()))
  const reviewTab = createMemo(() => isDesktop())
  const panelWidth = createMemo(() => {
    if (!visible()) return "0px"
    if (reviewVisible()) return "auto"
    return `${fileTreeWidth()}px`
  })
  const treeWidth = createMemo(() => (fileOpen() ? `${fileTreeWidth()}px` : "0px"))

  const diffs = createMemo(() => props.diffs.filter(renderDiff))
  const diffFiles = createMemo(() => diffs().map((d) => d.file))
  const kinds = createMemo(() => fileTreeKinds(diffs()))

  const nofiles = createMemo(() => {
    const state = file.tree.state("")
    if (!state?.loaded) return false
    return file.tree.children("").length === 0
  })

  const normalizeTab = (tab: string) => {
    if (!tab.startsWith("file://")) return tab
    return file.tab(tab)
  }

  const openReviewPanel = () => {
    if (!view().reviewPanel.opened()) view().reviewPanel.open()
  }

  const openTab = createOpenSessionFileTab({
    normalizeTab,
    openTab: tabs().open,
    pathFromTab: file.pathFromTab,
    loadFile: file.load,
    openReviewPanel,
    setActive: tabs().setActive,
  })

  const tabState = createSessionTabs({
    tabs,
    pathFromTab: file.pathFromTab,
    normalizeTab,
    review: reviewTab,
    hasReview: () => props.canReview,
    fileBrowser: () => true,
  })
  const contextOpen = tabState.contextOpen
  const openFileOpen = tabState.openFileOpen
  const panelTabs = tabState.panelTabs
  const openedTabs = tabState.openedTabs
  const activeTab = tabState.activeTab
  const activeFileTab = tabState.activeFileTab

  const fileTreeTab = () => layout.fileTree.tab()

  const setFileTreeTabValue = (value: string) => {
    if (value !== "changes" && value !== "all") return
    layout.fileTree.setTab(value)
  }

  let fileFilter: HTMLInputElement | undefined
  let tabList: HTMLDivElement | undefined
  let selectionEvent: Event | undefined
  const temporaryTab = tabs().preview
  const previewTab = (value: string) => {
    const next = normalizeTab(value)
    tabs().previewTab(next)
    const path = file.pathFromTab(next)
    if (path) void file.load(path)
    openReviewPanel()
    queueMicrotask(() => tabs().setActive(next))
  }
  const openFileBrowser = () => {
    previewTab(SESSION_OPEN_FILE_TAB)
    queueMicrotask(() => fileFilter?.focus())
  }
  const activateTab = (value: string) => {
    const next = normalizeTab(value)
    const path = file.pathFromTab(next)
    if (path) void file.load(path)
    openReviewPanel()
    tabs().setActive(next)
  }
  const fileTab = createMemo(() => {
    const active = activeTab()
    if (active === SESSION_OPEN_FILE_TAB) return SESSION_OPEN_FILE_TAB
    if (active && file.pathFromTab(active)) return active
    return activeFileTab()
  })
  // Keep the file-browser shell mounted while any file tab exists. Kobalte briefly
  // selects Review while the tab For replaces a preview trigger, which would
  // otherwise dispose the sidebar and reset scroll.
  const fileBrowserMounted = createMemo(() => {
    return openedTabs().length > 0 || openFileOpen() || !!fileTab()
  })
  const fileBrowserVisible = createMemo(() => {
    const active = activeTab()
    return active === SESSION_OPEN_FILE_TAB || active === activeFileTab()
  })
  createEffect(() => {
    if (!file.ready()) return

    setSessionHandoff(sessionKey(), {
      files: tabs()
        .all()
        .reduce<Record<string, SelectedLineRange | null>>((acc, tab) => {
          const path = file.pathFromTab(tab)
          if (!path) return acc

          const selected = file.selectedLines(path)
          acc[path] =
            selected && typeof selected === "object" && "start" in selected && "end" in selected
              ? (selected as SelectedLineRange)
              : null

          return acc
        }, {}),
    })
  })

  return (
    <Show when={isDesktop() && !!params.id}>
      <aside
        id="review-panel"
        aria-label={language.t("session.panel.reviewAndFiles")}
        aria-hidden={!open()}
        inert={!open()}
        class="relative min-w-0 flex overflow-hidden bg-v2-background-bg-base rounded-[10px] shadow-[var(--v2-elevation-raised)]"
        classList={{
          "h-full shrink-0": !props.stacked,
          "h-full min-h-0": props.stacked,
          "pointer-events-none": !open(),
          "transition-[width] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] motion-reduce:transition-none":
            !props.size.active(),
          "flex-1": reviewVisible(),
        }}
        style={{ width: panelWidth() }}
      >
        <Show when={visible()}>
          <div
            data-slot="session-review-content"
            class="h-full flex shrink-0"
            style={{ width: "var(--session-side-content-width, 100%)" }}
          >
            <Show when={reviewVisible()}>
              <div class="relative min-w-0 h-full flex-1 overflow-hidden bg-v2-background-bg-base">
                <div class="size-full min-w-0 h-full bg-v2-background-bg-base">
                  <DragDropProvider
                    sensors={[
                      PointerSensor.configure({
                        activationConstraints: [new PointerActivationConstraints.Distance({ value: 4 })],
                        preventActivation: (event) =>
                          event.target instanceof Element &&
                          (!!event.target.closest('[data-slot="tabs-trigger-close-button"]') ||
                            !!event.target.closest(".session-review-v2-actions-slot")),
                      }),
                    ]}
                    modifiers={[
                      RestrictToHorizontalAxis,
                      RestrictToElement.configure({ element: () => tabList ?? null }),
                    ]}
                    plugins={(defaults) => [
                      ...defaults.filter((plugin) => plugin !== Accessibility),
                      AutoScroller.configure({ acceleration: 8, threshold: { x: 0.05, y: 0 } }),
                      Feedback.configure({ dropAnimation: null }),
                    ]}
                    onDragEnd={(event) => {
                      const source = event.operation.source
                      if (event.canceled || !isSortable(source) || source.initialIndex === source.index) return
                      tabs().move(source.id.toString(), source.index)
                    }}
                  >
                    <Tabs
                      value={activeTab()}
                      onChange={(value) => {
                        // Kobalte selects the first tab while session triggers register.
                        // Persist input events only; createSessionTabs owns fallback selection.
                        if (selectionEvent && selectionEvent.eventPhase !== Event.NONE) activateTab(value)
                      }}
                    >
                      <div class="session-review-v2-tabs-bar sticky top-0 shrink-0 flex items-center">
                        <SessionSideTabList
                          listRef={(el) => {
                            tabList = el
                            createEventListener(
                              el,
                              ["pointerdown", "click", "keydown"],
                              (event) => (selectionEvent = event),
                              { capture: true },
                            )
                            const stop = createFileTabListSync({ el, contextOpen })
                            onCleanup(stop)
                          }}
                          sidebarToggle={props.reviewSidebarToggle(activeTab() === SESSION_OPEN_FILE_TAB)}
                          activeTab={activeTab()}
                          showReview={reviewTab() && props.canReview}
                          hasReview={props.hasReview}
                          reviewCount={props.reviewCount}
                          contextOpen={contextOpen()}
                          panelTabs={panelTabs()}
                          temporaryTab={temporaryTab()}
                          openTab={openTab}
                          openFileBrowser={openFileBrowser}
                        />
                        <div
                          data-slot="session-side-panel-actions"
                          class="session-review-v2-actions-slot self-start shrink-0 flex items-center gap-2 pe-3"
                          classList={{ "h-[51px]": props.stacked, "h-12": !props.stacked }}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Show when={reviewVisible()}>
                            <div class="size-7 shrink-0" aria-hidden />
                          </Show>
                        </div>
                      </div>

                      <Show when={reviewTab() && props.canReview && activeTab() === "review"}>
                        <div
                          id={reviewTabPanelID}
                          role="tabpanel"
                          aria-labelledby={reviewTabID}
                          tabIndex={props.reviewHasFocusableContent ? undefined : 0}
                          data-slot="tabs-content"
                          class="flex flex-col h-full overflow-hidden contain-strict"
                        >
                          {props.reviewPanel()}
                        </div>
                      </Show>

                      <Show when={activeTab() === "empty"}>
                        <Tabs.Content value="empty" class="flex flex-col h-full overflow-hidden contain-strict">
                          <div class="relative pt-2 flex-1 min-h-0 overflow-hidden">
                            <div class="h-full px-6 pb-42 -mt-4 flex flex-col items-center justify-center text-center gap-6">
                              <Mark class="w-14 opacity-10" />
                              <div class="text-14-regular text-text-weak max-w-56">
                                {language.t("session.files.selectToOpen")}
                              </div>
                            </div>
                          </div>
                        </Tabs.Content>
                      </Show>

                      <Show when={activeTab() === "context"}>
                        <Tabs.Content value="context" class="flex flex-col h-full overflow-hidden contain-strict">
                          <div class="relative pt-2 flex-1 min-h-0 overflow-hidden">
                            <SessionContextTab />
                          </div>
                        </Tabs.Content>
                      </Show>

                      <Show when={activeTab() === SESSION_BTW_TAB}>
                        <Tabs.Content value={SESSION_BTW_TAB} class="flex h-full min-h-0 flex-col overflow-hidden">
                          {props.btwPanel()}
                        </Tabs.Content>
                      </Show>

                      <Show when={fileBrowserMounted()}>
                        <div
                          id={fileBrowserTabPanelID}
                          role="tabpanel"
                          data-slot="tabs-content"
                          class="h-full min-h-0 overflow-hidden"
                          classList={{ hidden: !fileBrowserVisible() }}
                          inert={!fileBrowserVisible() || undefined}
                        >
                          <SessionFileBrowserTab
                            tab={fileTab() ?? activeFileTab() ?? SESSION_OPEN_FILE_TAB}
                            placeholder={
                              (fileTab() ?? activeFileTab() ?? SESSION_OPEN_FILE_TAB) === SESSION_OPEN_FILE_TAB
                            }
                            active={file.pathFromTab(fileTab() ?? activeFileTab() ?? "")}
                            kinds={kinds()}
                            state={props.fileBrowserState}
                            onSelect={(path) => previewTab(file.tab(path))}
                            onSelectPermanent={(path) => openTab(file.tab(path))}
                            filterRef={(element) => (fileFilter = element)}
                          />
                        </div>
                      </Show>
                    </Tabs>
                  </DragDropProvider>
                </div>
              </div>
            </Show>

            <Show when={fileOpen()}>
              <SessionSideFileTree
                width={treeWidth()}
                fileTreeWidth={fileTreeWidth()}
                reviewOpen={reviewOpen()}
                tab={fileTreeTab()}
                onTabChange={setFileTreeTabValue}
                reviewCount={props.reviewCount}
                hasReview={props.hasReview}
                diffsReady={props.diffsReady}
                diffFiles={diffFiles()}
                kinds={kinds()}
                activeDiff={props.activeDiff}
                empty={nofiles()}
                size={props.size}
                focusReviewDiff={props.focusReviewDiff}
                openFile={(path) => openTab(file.tab(path))}
              />
            </Show>
          </div>
        </Show>
      </aside>
    </Show>
  )
}