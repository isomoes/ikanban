import type { SetStoreFunction } from "solid-js/store"
import type { TabStorage } from "./schema"
import { tabKey, type Tab, type TabPane, type TabPaneSize } from "./tab"

export function createTabPanes(
  panes: typeof TabStorage.Panes.Type,
  setPanes: SetStoreFunction<typeof TabStorage.Panes.Type>,
) {
  return {
    pane(tab: Tab | undefined, pane: TabPane) {
      if (!tab) return false
      return panes[tabKey(tab)]?.[pane] ?? false
    },
    setPane(tab: Tab | undefined, pane: TabPane, opened: boolean) {
      if (!tab) return
      const key = tabKey(tab)
      const current = panes[key]
      if (current?.[pane] === opened) return
      if (!current) {
        setPanes(key, { [pane]: opened })
        return
      }
      setPanes(key, pane, opened)
    },
    paneSize(tab: Tab | undefined, size: TabPaneSize) {
      if (!tab) return
      return panes[tabKey(tab)]?.[size]
    },
    setPaneSize(tab: Tab | undefined, size: TabPaneSize, value: number) {
      if (!tab) return
      const key = tabKey(tab)
      const current = panes[key]
      if (current?.[size] === value) return
      if (!current) {
        setPanes(key, { [size]: value })
        return
      }
      setPanes(key, size, value)
    },
  }
}
