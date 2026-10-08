import type { SessionInfo } from "@opencode/client/promise"
import type { useLanguage } from "@/runtime/i18n/language"
import type { ServerConnection } from "@/runtime/server/registry"
import { shouldOpenSessionInBackground } from "./open"
import type { HomeSessionGroup, HomeSessionRecord, OpenSessionOptions } from "./controller"

// Middle-click or Cmd+click on macOS (Ctrl+click elsewhere) opens a session
// tab in the background without navigating, matching browser conventions.
export function isBackgroundOpen(event: MouseEvent) {
  return shouldOpenSessionInBackground({
    button: event.button,
    mac: typeof navigator === "object" && /(Mac|iPod|iPhone|iPad)/.test(navigator.platform),
    meta: event.metaKey,
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey,
  })
}

export type HomeSessionsViewProps = {
  language: ReturnType<typeof useLanguage>
  groups: HomeSessionGroup[]
  loading: boolean
  showProjectName: boolean
  server: ServerConnection.Key
  canCreateSession: boolean
  searchValue: string
  searchPlaceholder: string
  searchOpen: boolean
  searchLoading: boolean
  searchResults: HomeSessionRecord[]
  searchActive: string
  searchNoResultsLabel: string
  titleOpacity: (id: HomeSessionGroup["id"]) => number
  isOpenTab: (record: HomeSessionRecord) => boolean
  onCreateSession: () => void
  onOpenSession: (session: SessionInfo, options?: OpenSessionOptions) => void
  onArchiveSession: (session: SessionInfo) => Promise<void>
  onRenameSession: (server: ServerConnection.Key, session: SessionInfo, title: string) => Promise<boolean>
  onExportSession: (server: ServerConnection.Key, session: SessionInfo) => Promise<void>
  onDeleteSession: (server: ServerConnection.Key, session: SessionInfo) => void
  onSetHoverTarget: (element: HTMLElement) => void
  onSetThumbTrack: (element: HTMLDivElement) => void
  onSetContent: (element: HTMLDivElement) => void
  onSetHeader: (id: HomeSessionGroup["id"], element: HTMLDivElement) => void
  onWheel: (event: WheelEvent) => void
  onSetSearchRoot: (element: HTMLDivElement) => void
  onSetSearchInput: (element: HTMLInputElement) => void
  onSetSearchList: (element: HTMLDivElement) => void
  onSearchFocus: () => void
  onSearchInput: (value: string) => void
  onSearchClose: () => void
  onSearchMove: (delta: number) => void
  onSearchSelectActive: () => void
  onSearchHighlight: (record: HomeSessionRecord) => void
  onSearchSelect: (record: HomeSessionRecord, options?: OpenSessionOptions) => void
}

// Session store updates recreate row components, so row-local state would
// close an open context menu or drop an in-progress rename. Keep both keyed
// by session ID at the view root, like the projects list does.
export type HomeSessionRowUI = {
  menu: { id: string; x: number; y: number } | undefined
  editor: { id: string; draft: string; renaming: boolean } | undefined
}
