import type { SessionInfo, SessionMessageUser } from "@opencode/client/promise"
import type { ComposerSelection } from "@/composer/adapter"
import type { ComposerState } from "@/composer/state"
import type { ServerConnection } from "@/runtime/server/registry"
import { sessionHref } from "@/shell/routes/session"
import type { TabStorage } from "./schema"

export type SessionTab = typeof TabStorage.Session.Type
export type DraftTab = typeof TabStorage.Draft.Type
export type Tab = typeof TabStorage.Tab.Type

export type PendingSession = {
  draft: DraftTab
  message: SessionMessageUser
  selection: ComposerSelection
  composer: ComposerState
}

export type TabInfo = typeof TabStorage.Info.Type

export type TabPane = "terminal" | "review"
export type TabPaneSize = "terminalHeight" | "sessionWidth"

export const draftHref = (draftID: string) => `/new-session?draftId=${encodeURIComponent(draftID)}`

export const tabHref = (tab: Tab) =>
  tab.type === "draft" ? draftHref(tab.draftID) : sessionHref(tab.server, tab.routeSessionId ?? tab.sessionId)

export const tabKey = (tab: Tab) =>
  tab.type === "draft" ? `draft:${tab.draftID}` : `${tab.server}\n${sessionHref(tab.server, tab.sessionId)}`

export function sessionHasOpenTab(tabs: Tab[], server: ServerConnection.Key, session: SessionInfo) {
  return sessionIDHasOpenTab(tabs, server, session.id)
}

export function findSessionTab(tabs: Tab[], server: ServerConnection.Key, sessionID: string) {
  return tabs.find(
    (tab) =>
      tab.type === "session" &&
      tab.server === server &&
      (tab.sessionId === sessionID || tab.routeSessionId === sessionID),
  )
}

export function sessionIDHasOpenTab(tabs: Tab[], server: ServerConnection.Key, sessionID: string) {
  return !!findSessionTab(tabs, server, sessionID)
}
