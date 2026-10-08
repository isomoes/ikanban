import { createMemo, createResource, on, createEffect, untrack, type Accessor } from "solid-js"
import { createStore, unwrap } from "solid-js/store"
import { useLocation, useNavigate } from "@solidjs/router"
import { makeEventListener } from "@solid-primitives/event-listener"
import { LayoutRoute, useLayout } from "@/shell/state/layout"
import { useCommand } from "@/shell/commands/command"
import { useLanguage } from "@/runtime/i18n/language"
import { applyPath, backPath, forwardPath, type HistoryLocation } from "./history"
import { readSessionTabsRemovedDetail, SESSION_TABS_REMOVED_EVENT } from "@/shell/titlebar/session-events"
import { useGlobal } from "@/runtime/server/runtime"
import { ServerConnection } from "@/runtime/server/registry"
import { tabKey, useTabs } from "@/shell/tabs/tabs"
import { stripBase } from "@/shell/routes/base"
import type { ComposerState } from "@/composer/persistence"
import { sessionTabTitle } from "./tab-title"
import { displayName, projectForSession } from "@/shell/layout/helpers"

export function createTitlebarController(options: { mobile: Accessor<boolean> }) {
  const command = useCommand()
  const language = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()

  const [history, setHistory] = createStore({
    stack: [] as HistoryLocation[],
    index: 0,
    action: undefined as "back" | "forward" | undefined,
  })

  // History seeds a synthetic "/" entry for deep links, so keep all entries
  // app-relative and let navigate() apply the deployment base once.
  const path = () => `${stripBase(location.pathname) ?? location.pathname}${location.search}${location.hash}`

  createEffect(() => {
    const current = { url: path(), state: location.state }

    untrack(() => {
      const next = applyPath(history, current)
      if (next === history) return
      setHistory(next)
    })
  })

  const back = () => {
    const next = backPath(history)
    if (!next) return
    setHistory(next.state)
    navigate(next.to.url, { state: unwrap(next.to.state) })
  }

  const forward = () => {
    const next = forwardPath(history)
    if (!next) return
    setHistory(next.state)
    navigate(next.to.url, { state: unwrap(next.to.state) })
  }

  command.register(() => [
    {
      id: "common.goBack",
      title: language.t("common.goBack"),
      category: language.t("command.category.view"),
      keybind: "mod+[",
      onSelect: back,
    },
    {
      id: "common.goForward",
      title: language.t("common.goForward"),
      category: language.t("command.category.view"),
      keybind: "mod+]",
      onSelect: forward,
    },
  ])

  const layout = useLayout()
  const global = useGlobal()

  const tabs = useTabs()
  const tabsStore = tabs.store
  const tabsStoreActions = tabs
  const preparing = createMemo(() => {
    const route = layout.route()
    return route.type === "session" && !!tabs.pendingSession(route.server, route.sessionId)
  })
  const [loadedSession] = createResource(
    () => {
      const route = layout.route()
      if (route.type !== "session") return undefined
      if (preparing()) return undefined
      const conn = global.servers.list().find((item) => ServerConnection.key(item) === route.server)
      return conn ? { route, ctx: global.ensureServerCtx(conn) } : undefined
    },
    ({ route, ctx }) => ctx.sdk.api.session.get({ sessionID: route.sessionId }).catch(() => {}),
  )
  const session = createMemo(() => {
    const route = layout.route()
    if (route.type !== "session") return
    if (preparing()) return
    const conn = global.servers.list().find((item) => ServerConnection.key(item) === route.server)
    const cached = conn ? global.ensureServerCtx(conn).data.session.get(route.sessionId) : undefined
    if (cached) return cached
    const loaded = loadedSession()
    return loaded?.id === route.sessionId ? loaded : undefined
  })

  const matchRoute = (route: LayoutRoute) => {
    if (route.type === "home") return
    if (route.type === "draft") {
      return tabsStore.find((item) => item.type === "draft" && item.draftID === route.draftID)
    }
    if (route.type === "session") {
      const main = tabsStore.find(
        (item) =>
          item.type === "session" &&
          item.server === route.server &&
          (item.sessionId === route.sessionId || item.routeSessionId === route.sessionId),
      )
      if (main) return main
      const s = session()
      if (s?.parentID) {
        const parentID = s.parentID
        const parent = tabsStore.find(
          (item) => item.type === "session" && item.server === route.server && item.sessionId === parentID,
        )
        if (parent) return parent
      }
    }
  }

  const currentTab = () => matchRoute(layout.route())

  createEffect(() => {
    const route = layout.route()
    if (!tabs.ready()) return
    const tab = currentTab()
    if (tab) {
      const current = session()
      if (
        route.type === "session" &&
        tab.type === "session" &&
        (route.sessionId === tab.sessionId || current?.id === route.sessionId)
      ) {
        tabs.rememberSessionRoute(tab, route.sessionId, current?.parentID)
      }
      tabs.remember(tab)
      return
    }

    if (route.type === "session") {
      if (tabs.pendingSession(route.server, route.sessionId)) {
        tabsStoreActions.addSessionTab({ server: route.server, sessionId: route.sessionId })
        return
      }
      const s = session()
      if (!s) return
      const sessionId = s.parentID ?? s.id
      const next = { server: route.server, sessionId }
      tabsStoreActions.addSessionTab(next)
    }
  })

  makeEventListener(window, SESSION_TABS_REMOVED_EVENT, (event) => {
    const detail = readSessionTabsRemovedDetail(event)
    if (!detail) return
    tabsStoreActions.removeSessions(detail)
  })

  const openNewTab = () => {
    const route = layout.route()
    switch (route.type) {
      case "session": {
        const pending = tabs.pendingSession(route.server, route.sessionId)
        if (pending) {
          const model = tabs.stateValue<ComposerState>(pending.draft, "prompt")?.model.current()
          void tabs.newDraft({ server: route.server, directory: pending.draft.directory }, "", model)
          return
        }
        const activeSession = session()
        if (!activeSession) return

        const sessionTab = {
          type: "session" as const,
          server: route.server,
          sessionId: activeSession.id,
        }
        const model = tabs.stateValue<ComposerState>(sessionTab, "prompt")?.model.current()
        void tabs.newDraft({ server: sessionTab.server, directory: activeSession.location.directory }, "", model)
        return
      }
      case "draft": {
        const activeTab = currentTab()
        if (activeTab?.type !== "draft") return

        const model = tabs.stateValue<ComposerState>(activeTab, "prompt")?.model.current()
        void tabs.newDraft({ server: activeTab.server, directory: activeTab.directory }, "", model)
        return
      }
      case "settings":
      case "home": {
        const selection = layout.home.selection()
        const conn =
          global.servers.list().find((item) => ServerConnection.key(item) === selection.server) ??
          global.servers.list()[0]
        const projects = conn ? global.ensureServerCtx(conn).projects : undefined
        const project =
          projects?.list().find((item) => item.worktree === selection.directory) ??
          projects?.list().find((item) => item.worktree === projects.last()) ??
          projects?.list()[0]
        if (conn && project) {
          void tabs.newDraft({ server: ServerConnection.key(conn), directory: project.worktree }, "")
          return
        }
      }
    }
  }
  const toggleHome = () => tabs.toggleHome({ home: layout.route().type === "home", current: currentTab() })
  const goHome = () => {
    if (layout.route().type !== "home") toggleHome()
  }

  command.register("titlebar-home", () => [
    {
      id: "home.toggle",
      title: language.t("home.title"),
      category: language.t("command.category.view"),
      keybind: "mod+b",
      hidden: true,
      onSelect: toggleHome,
    },
  ])

  command.register("tabs", () => {
    const current = currentTab()

    return [
      {
        id: "tab.new",
        category: "tab",
        title: language.t("command.session.new"),
        keybind: "mod+t,mod+n",
        hidden: true,
        onSelect: openNewTab,
      },
      current && {
        id: "tab.close",
        category: "tab",
        title: language.t("command.tab.close"),
        keybind: "mod+w",
        hidden: true,
        onSelect: () => {
          tabsStoreActions.closeTab(tabsStore.findIndex((tab) => current === tab))
        },
      },
      {
        id: "tab.reopenClosed",
        category: language.t("command.category.file"),
        title: language.t("command.tab.reopenClosed"),
        keybind: "mod+shift+t",
        onSelect: () => tabsStoreActions.reopenClosedTab(),
      },
    ].filter((v) => v !== undefined)
  })

  const [mobileTabs, setMobileTabs] = createStore({ open: false, settings: false })
  const currentProject = createMemo(() => {
    const tab = currentTab()
    const value = session()
    if (!tab || !value) return
    const conn = global.servers.list().find((item) => ServerConnection.key(item) === tab.server)
    return projectForSession(value, conn ? global.ensureServerCtx(conn).projects.list() : [])
  })
  const currentProjectName = createMemo(() => {
    const value = session()
    if (!value) return
    return displayName(currentProject() ?? { worktree: value.location.directory })
  })
  const currentTitle = () => {
    const tab = currentTab()
    if (!tab) return language.t("home.title")
    if (tab.type === "draft") return language.t("session.tab.session")
    const value = session()
    return sessionTabTitle(value ? value.title : tabs.info[tabKey(tab)]?.title, language.t("session.tab.session"))
  }
  createEffect(on([path, options.mobile], () => setMobileTabs("open", false), { defer: true }))

  return {
    preparing,
    session,
    currentTab,
    currentProject,
    currentProjectName,
    currentTitle,
    openNewTab,
    toggleHome,
    goHome,
    mobileTabs,
    setMobileTabs,
  }
}

export type TitlebarController = ReturnType<typeof createTitlebarController>
