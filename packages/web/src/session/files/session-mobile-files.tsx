import { Button } from "@ikanban/ui/button"
import { Tabs } from "@ikanban/ui/tabs"
import { getFilename } from "@opencode/util/path"
import { createEffect, createMemo, For, on, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/runtime/i18n/language"
import { useSessionLayout } from "@/session/session-layout"
import { createSessionTabs, SESSION_OPEN_FILE_TAB } from "@/session/helpers"
import { useFile } from "@/workspaces/files/model"
import { SessionFileBrowserTab } from "./session-file-browser-tab"
import { publishedArtifactFromTab } from "../artifact-link"
import { useArtifactOpener } from "./open-artifact"
import { PublishedArtifactTab, PublishedArtifactTabLabel } from "./published-artifact-tab"
import type { Kind } from "./file-tree-v2"
import "./session-mobile-files.css"

export function SessionMobileFiles() {
  const file = useFile()
  const language = useLanguage()
  const layout = useSessionLayout()
  const artifacts = useArtifactOpener()
  const tabs = createSessionTabs({
    tabs: layout.tabs,
    pathFromTab: file.pathFromTab,
    normalizeTab: file.tab,
  })
  const activeArtifact = createMemo(() => publishedArtifactFromTab(tabs.activeTab()))
  const currentTab = () => activeArtifact() ? tabs.activeTab() : tabs.activeFileTab()
  const [store, setStore] = createStore({ browsing: !currentTab() })
  const browsing = () => store.browsing || !currentTab()
  createEffect(on(artifacts.publishedOpens, () => setStore("browsing", false), { defer: true }))
  const active = createMemo(() => file.pathFromTab(tabs.activeFileTab() ?? ""))
  const kinds = new Map<string, Kind>()
  const open = (path: string) => {
    layout.tabs().open(file.tab(path))
    void file.load(path)
    setStore("browsing", false)
  }
  const activate = (tab: string) => {
    if (publishedArtifactFromTab(tab)) {
      layout.tabs().setActive(tab)
      setStore("browsing", false)
      return
    }
    const path = file.pathFromTab(tab)
    if (path) open(path)
  }

  return (
    <div data-slot="session-mobile-files" data-browsing={browsing()} class="flex h-full min-h-0 flex-col">
      <div data-slot="session-mobile-files-header" class="relative flex h-11 min-w-0 shrink-0 items-center">
        <Button
          size="small"
          variant="ghost"
          class="shrink-0 mx-2"
          onClick={() => setStore("browsing", true)}
          aria-pressed={browsing()}
        >
          {language.t("session.files.all")}
        </Button>
        <Tabs
          value={browsing() ? SESSION_OPEN_FILE_TAB : currentTab()}
          onChange={(tab) => {
            // Kobalte falls back to a file tab when the browse view has no trigger.
            if (browsing()) return
            activate(tab)
          }}
          variant="line"
          class="min-w-0 flex-1 !h-auto"
        >
          <Tabs.List aria-label={language.t("session.files.openTabs")} class="!h-11 !px-0 overflow-x-auto">
            <For each={tabs.contentTabs()}>
              {(tab) => (
                <Tabs.Trigger
                  value={tab}
                  onClick={() => activate(tab)}
                  class="shrink-0 max-w-48"
                  classes={{ button: "min-w-0" }}
                  closeButton={
                    <Tabs.CloseButton
                      aria-label={language.t("common.closeTab")}
                      onClick={() => layout.tabs().close(tab)}
                    />
                  }
                >
                  <Show when={publishedArtifactFromTab(tab)} fallback={
                    <span dir="ltr" class="truncate">{getFilename(file.pathFromTab(tab) ?? tab)}</span>
                  }>
                    {(artifact) => <PublishedArtifactTabLabel artifact={artifact()} />}
                  </Show>
                </Tabs.Trigger>
              )}
            </For>
          </Tabs.List>
        </Tabs>
      </div>
      <div class="min-h-0 flex-1">
        <Show when={!browsing() && activeArtifact()} keyed fallback={<SessionFileBrowserTab
          mobile
          tab={tabs.activeFileTab() ?? SESSION_OPEN_FILE_TAB}
          placeholder={browsing()}
          active={active()}
          kinds={kinds}
          state={{
            sidebarOpened: browsing,
            sidebarWidth: () => 240,
            sidebarTransition: () => false,
            resizeSidebar: () => undefined,
            toggleSidebar: () => setStore("browsing", !browsing()),
          }}
          onSelect={open}
          onSelectPermanent={open}
        />}>
          {(artifact) => <PublishedArtifactTab artifact={artifact} />}
        </Show>
      </div>
    </div>
  )
}
