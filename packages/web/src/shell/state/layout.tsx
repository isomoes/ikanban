import { createStore, produce, reconcile } from "solid-js/store"
import { batch, createEffect, createMemo, onCleanup, onMount, type Accessor } from "solid-js"
import { createSimpleContext } from "@ikanban/ui/context"
import { makeEventListener } from "@solid-primitives/event-listener"
import { ServerConnection, useServers } from "@/runtime/server/registry"
import { usePlatform } from "@/runtime/platform/platform"
import type { Project } from "@/runtime/server/types"
import { Persist, persisted, removePersisted } from "@/runtime/persistence/storage"
import { same } from "@/runtime/persistence/equality"
import { createScrollPersistence, type SessionScroll } from "./scroll"
import type { ProjectAvatarVariant } from "@ikanban/ui/project-avatar"
import { SessionStateKey } from "@/runtime/server/scope"
import { createSessionKeyReader, ensureSessionKey, pruneSessionKeys } from "./helpers"
import { createSessionTabsApi } from "./session-tabs-api"
import {
  DEFAULT_FILE_TREE_WIDTH,
  DEFAULT_REVIEW_PANEL_OPENED,
  DEFAULT_SESSION_WIDTH,
  DEFAULT_TERMINAL_HEIGHT,
  initialLayout,
  layoutPersistence,
  type layoutSchema,
} from "./schema"
import { useCurrentRoute } from "./route"

export { initialLayout, layoutPersistence, layoutSchema } from "./schema"
export { currentRoute, useCurrentRoute, type LayoutRoute } from "./route"
export { createSessionKeyReader, ensureSessionKey, pruneSessionKeys }

export type { ProjectAvatarVariant }

export function getProjectAvatarVariant(key?: string): ProjectAvatarVariant {
  if (key === "mint") return "cyan"
  if (key === "lime") return "green"
  if (
    key === "orange" ||
    key === "yellow" ||
    key === "cyan" ||
    key === "green" ||
    key === "red" ||
    key === "pink" ||
    key === "blue" ||
    key === "purple" ||
    key === "gray"
  )
    return key
  return "gray"
}

export type LocalProject = Partial<Project> & { worktree: string; expanded: boolean }
export type HomeProjectSelection = typeof layoutSchema.Type.home.selection

export type ReviewDiffStyle = typeof layoutSchema.Type.review.diffStyle
export type ReviewChangeMode = NonNullable<(typeof layoutSchema.Type.sessionView)[string]["reviewMode"]>
export type ReviewPanelSource = "context-button" | "other"
export type TabPanes = {
  terminalOpened: Accessor<boolean>
  setTerminalOpened(opened: boolean): void
  terminalHeight: Accessor<number | undefined>
  setTerminalHeight(height: number): void
  reviewOpened: Accessor<boolean>
  setReviewOpened(opened: boolean): void
  sessionWidth: Accessor<number | undefined>
  setSessionWidth(width: number): void
}

export const { use: useLayout, provider: LayoutProvider } = createSimpleContext({
  name: "Layout",
  gate: false,
  init: () => {
    const servers = useServers()
    const platform = usePlatform()

    const [store, setStore, _, ready] = persisted(
      { ...Persist.global("layout"), previousKey: "layout.v6" },
      layoutPersistence,
      initialLayout(servers.list[0] ? ServerConnection.key(servers.list[0]) : undefined),
    )
    const [ephemeral, setEphemeral] = createStore({
      reviewPanelSource: "other" as ReviewPanelSource,
      sessionTabPreview: {} as Record<string, string | undefined>,
    })

    const MAX_SESSION_KEYS = 50
    const PENDING_MESSAGE_TTL_MS = 2 * 60 * 1000
    const usage = {
      active: undefined as string | undefined,
      pruned: false,
      used: new Map<string, number>(),
    }

    const SESSION_STATE_KEYS = ["prompt", "terminal", "file-view"] as const

    const dropSessionState = (keys: string[]) => {
      for (const key of keys) {
        const scope = SessionStateKey.scope(key)
        const parts = SessionStateKey.route(key).split("/")
        const dir = parts[0]
        const session = parts[1]
        if (!dir) continue

        for (const entry of SESSION_STATE_KEYS) {
          const target = session
            ? Persist.serverSession(scope, dir, session, entry)
            : Persist.serverWorkspace(scope, dir, entry)
          void removePersisted(target, platform)
        }
      }
    }

    function prune(keep?: string) {
      const drop = pruneSessionKeys({
        keep,
        max: MAX_SESSION_KEYS,
        used: usage.used,
        view: Object.keys(store.sessionView),
        tabs: Object.keys(store.sessionTabs),
      })
      if (drop.length === 0) return

      setStore(
        produce((draft) => {
          for (const key of drop) {
            delete draft.sessionView[key]
            delete draft.sessionTabs[key]
          }
        }),
      )

      scroll.drop(drop)
      dropSessionState(drop)
      setEphemeral(
        "sessionTabPreview",
        produce((draft) => {
          for (const key of drop) delete draft[key]
        }),
      )

      for (const key of drop) {
        usage.used.delete(key)
      }
    }

    function touch(sessionKey: string) {
      usage.active = sessionKey
      usage.used.set(sessionKey, Date.now())

      if (!ready()) return
      if (usage.pruned) return

      usage.pruned = true
      prune(sessionKey)
    }

    const scroll = createScrollPersistence({
      debounceMs: 250,
      getSnapshot: (sessionKey) => store.sessionView[sessionKey]?.scroll,
      onFlush: (sessionKey, next) => {
        const current = store.sessionView[sessionKey]
        const keep = usage.active ?? sessionKey
        if (!current) {
          setStore("sessionView", sessionKey, { scroll: next })
          prune(keep)
          return
        }

        setStore("sessionView", sessionKey, "scroll", (prev) => ({ ...prev, ...next }))
        prune(keep)
      },
    })

    const ensureKey = (key: string) => ensureSessionKey(key, touch, (sessionKey) => scroll.seed(sessionKey))

    createEffect(() => {
      if (!ready()) return
      if (usage.pruned) return
      const active = usage.active
      if (!active) return
      usage.pruned = true
      prune(active)
    })

    onMount(() => {
      const flush = () => batch(() => scroll.flushAll())
      const handleVisibility = () => {
        if (document.visibilityState !== "hidden") return
        flush()
      }

      makeEventListener(window, "pagehide", flush)
      makeEventListener(document, "visibilitychange", handleVisibility)

      onCleanup(() => {
        scroll.dispose()
      })
    })

    return {
      route: useCurrentRoute(),
      ready,
      home: {
        selection: createMemo(() => store.home.selection),
        setSelection(selection: HomeProjectSelection) {
          setStore("home", "selection", reconcile(selection))
        },
      },
      terminal: {
        height: createMemo(() => store.terminal.height),
        resize(height: number) {
          setStore("terminal", "height", height)
        },
      },
      review: {
        diffStyle: createMemo(() => store.review?.diffStyle ?? "split"),
        setDiffStyle(diffStyle: ReviewDiffStyle) {
          if (!store.review) {
            setStore("review", { diffStyle, panelOpened: DEFAULT_REVIEW_PANEL_OPENED })
            return
          }
          setStore("review", "diffStyle", diffStyle)
        },
      },
      fileTree: {
        opened: createMemo(() => store.fileTree?.opened ?? true),
        width: createMemo(() => store.fileTree?.width ?? DEFAULT_FILE_TREE_WIDTH),
        tab: createMemo(() => store.fileTree?.tab ?? "changes"),
        setTab(tab: "changes" | "all") {
          if (!store.fileTree) {
            setStore("fileTree", { opened: true, width: DEFAULT_FILE_TREE_WIDTH, tab })
            return
          }
          setStore("fileTree", "tab", tab)
        },
        open() {
          if (!store.fileTree) {
            setStore("fileTree", { opened: true, width: DEFAULT_FILE_TREE_WIDTH, tab: "changes" })
            return
          }
          setStore("fileTree", "opened", true)
        },
        close() {
          if (!store.fileTree) {
            setStore("fileTree", { opened: false, width: DEFAULT_FILE_TREE_WIDTH, tab: "changes" })
            return
          }
          setStore("fileTree", "opened", false)
        },
        toggle() {
          if (!store.fileTree) {
            setStore("fileTree", { opened: true, width: DEFAULT_FILE_TREE_WIDTH, tab: "changes" })
            return
          }
          setStore("fileTree", "opened", (x) => !x)
        },
        resize(width: number) {
          if (!store.fileTree) {
            setStore("fileTree", { opened: true, width, tab: "changes" })
            return
          }
          setStore("fileTree", "width", width)
        },
      },
      session: {
        width: createMemo(() => store.session?.width ?? DEFAULT_SESSION_WIDTH),
        resize(width: number) {
          if (!store.session) {
            setStore("session", { width })
            return
          }
          setStore("session", "width", width)
        },
      },
      mobileSidebar: {
        opened: createMemo(() => store.mobileSidebar?.opened ?? false),
        hide() {
          setStore("mobileSidebar", "opened", false)
        },
        toggle() {
          setStore("mobileSidebar", "opened", (x) => !x)
        },
      },
      pendingMessage: {
        set(sessionKey: string, messageID: string) {
          const at = Date.now()
          touch(sessionKey)
          const current = store.sessionView[sessionKey]
          if (!current) {
            setStore("sessionView", sessionKey, {
              scroll: {},
              pendingMessage: messageID,
              pendingMessageAt: at,
            })
            prune(usage.active ?? sessionKey)
            return
          }

          setStore(
            "sessionView",
            sessionKey,
            produce((draft) => {
              draft.pendingMessage = messageID
              draft.pendingMessageAt = at
            }),
          )
        },
        consume(sessionKey: string) {
          const current = store.sessionView[sessionKey]
          const message = current?.pendingMessage
          const at = current?.pendingMessageAt
          if (!message || !at) return

          setStore(
            "sessionView",
            sessionKey,
            produce((draft) => {
              delete draft.pendingMessage
              delete draft.pendingMessageAt
            }),
          )

          if (Date.now() - at > PENDING_MESSAGE_TTL_MS) return
          return message
        },
      },
      view(sessionKey: string | Accessor<string>, panes?: TabPanes) {
        const key = createSessionKeyReader(sessionKey, ensureKey)
        const s = createMemo(() => store.sessionView[key()] ?? { scroll: {} })
        const reviewMode = createMemo(() => {
          const mode = s().reviewMode
          if (mode === "git" || mode === "branch" || mode === "turn") return mode
        })
        const reviewFile = createMemo(() => {
          const file = s().reviewFile
          if (typeof file === "string") return file
        })
        const terminalOpened = panes?.terminalOpened ?? createMemo(() => store.terminal?.opened ?? false)
        const terminalHeight = createMemo(() =>
          panes
            ? (panes.terminalHeight() ?? DEFAULT_TERMINAL_HEIGHT)
            : (store.terminal?.height ?? DEFAULT_TERMINAL_HEIGHT),
        )
        const reviewPanelOpened =
          panes?.reviewOpened ?? createMemo(() => store.review?.panelOpened ?? DEFAULT_REVIEW_PANEL_OPENED)
        const sessionWidth = createMemo(() =>
          panes ? (panes.sessionWidth() ?? DEFAULT_SESSION_WIDTH) : store.session.width,
        )
        const reviewPanelSource = createMemo(() => (reviewPanelOpened() ? ephemeral.reviewPanelSource : "other"))

        function setTerminalOpened(next: boolean) {
          if (panes) {
            panes.setTerminalOpened(next)
            return
          }
          const current = store.terminal
          if (!current) {
            setStore("terminal", { height: DEFAULT_TERMINAL_HEIGHT, opened: next })
            return
          }

          const value = current.opened ?? false
          if (value === next) return
          setStore("terminal", "opened", next)
        }

        function setReviewPanelOpened(next: boolean, source: ReviewPanelSource) {
          const nextSource = next ? source : "other"
          if (panes) {
            batch(() => {
              panes.setReviewOpened(next)
              setEphemeral("reviewPanelSource", nextSource)
            })
            return
          }
          const current = store.review
          if (!current) {
            batch(() => {
              setStore("review", { diffStyle: "split" as ReviewDiffStyle, panelOpened: next })
              setEphemeral("reviewPanelSource", nextSource)
            })
            return
          }

          const value = current.panelOpened ?? DEFAULT_REVIEW_PANEL_OPENED
          if (value === next) {
            if (ephemeral.reviewPanelSource !== nextSource) setEphemeral("reviewPanelSource", nextSource)
            return
          }
          batch(() => {
            setStore("review", "panelOpened", next)
            setEphemeral("reviewPanelSource", nextSource)
          })
        }

        return {
          scroll(tab: string) {
            return scroll.scroll(key(), tab)
          },
          setScroll(tab: string, pos: SessionScroll) {
            scroll.setScroll(key(), tab, pos)
          },
          terminal: {
            opened: terminalOpened,
            height: terminalHeight,
            resize(height: number) {
              if (panes) {
                panes.setTerminalHeight(height)
                return
              }
              setStore("terminal", "height", height)
            },
            open() {
              setTerminalOpened(true)
            },
            close() {
              setTerminalOpened(false)
            },
            toggle() {
              setTerminalOpened(!terminalOpened())
            },
          },
          reviewPanel: {
            opened: reviewPanelOpened,
            source: reviewPanelSource,
            width: sessionWidth,
            resize(width: number) {
              if (panes) {
                panes.setSessionWidth(width)
                return
              }
              setStore("session", "width", width)
            },
            open(source: ReviewPanelSource = "other") {
              setReviewPanelOpened(true, source)
            },
            close() {
              setReviewPanelOpened(false, "other")
            },
            toggle() {
              setReviewPanelOpened(!reviewPanelOpened(), "other")
            },
          },
          review: {
            mode: reviewMode,
            setMode(mode: ReviewChangeMode) {
              const session = key()
              const current = store.sessionView[session]
              if (!current) {
                setStore("sessionView", session, { scroll: {}, reviewMode: mode })
                prune(session)
                return
              }
              if (current.reviewMode === mode) return
              setStore("sessionView", session, "reviewMode", mode)
              prune(session)
            },
            file: reviewFile,
            setFile(file: string) {
              const session = key()
              const current = store.sessionView[session]
              if (!current) {
                setStore("sessionView", session, { scroll: {}, reviewFile: file })
                prune(session)
                return
              }
              if (current.reviewFile === file) return
              setStore("sessionView", session, "reviewFile", file)
              prune(session)
            },
            open: createMemo(() => s().reviewOpen ?? []),
            setOpen(open: string[]) {
              const session = key()
              const next = Array.from(new Set(open))
              const current = store.sessionView[session]
              if (!current) {
                setStore("sessionView", session, {
                  scroll: {},
                  reviewOpen: next,
                })
                return
              }

              if (same(current.reviewOpen, next)) return
              setStore("sessionView", session, "reviewOpen", next)
            },
            openPath(path: string) {
              const session = key()
              const current = store.sessionView[session]
              if (!current) {
                setStore("sessionView", session, {
                  scroll: {},
                  reviewOpen: [path],
                })
                return
              }

              if (!current.reviewOpen) {
                setStore("sessionView", session, "reviewOpen", [path])
                return
              }

              if (current.reviewOpen.includes(path)) return
              setStore("sessionView", session, "reviewOpen", current.reviewOpen.length, path)
            },
          },
        }
      },
      tabs(sessionKey: string | Accessor<string>) {
        return createSessionTabsApi({ store, setStore, ephemeral, setEphemeral, ensureKey }, sessionKey)
      },
    }
  },
})
