import { Schema, SchemaGetter } from "effect"
import type { ServerConnection } from "@/runtime/server/registry"
import { Persistence } from "@/runtime/persistence/schema"
import { TabStorage } from "@/shell/tabs/schema"
import { decode64 } from "@/runtime/persistence/base64"
import { createPathHelpers } from "@/workspaces/files/path"
import { SessionStateKey } from "@/runtime/server/scope"
import { SESSION_BTW_TAB, type SessionTabs } from "./session-tabs"

export const DEFAULT_SIDEBAR_WIDTH = 344
export const DEFAULT_FILE_TREE_WIDTH = 200
export const DEFAULT_SESSION_WIDTH = 600
export const DEFAULT_TERMINAL_HEIGHT = 280
export const DEFAULT_REVIEW_PANEL_OPENED = false

export const sessionPath = (key: string) => {
  const dir = SessionStateKey.route(key).split("/")[0]
  if (!dir) return
  const root = decode64(dir)
  if (!root) return
  return createPathHelpers(() => root)
}

export const normalizeSessionTab = (path: ReturnType<typeof createPathHelpers> | undefined, tab: string) => {
  if (!tab.startsWith("file://")) return tab
  if (!path) return tab
  return path.tab(tab)
}

export const normalizeSessionTabList = (path: ReturnType<typeof createPathHelpers> | undefined, all: string[]) => {
  const seen = new Set<string>()
  return all.flatMap((tab) => {
    const value = normalizeSessionTab(path, tab)
    if (seen.has(value)) return []
    seen.add(value)
    return [value]
  })
}

const normalizeStoredSessionTabs = (key: string, tabs: SessionTabs) => {
  const path = sessionPath(key)
  return {
    all: normalizeSessionTabList(path, tabs.all).filter((tab) => tab !== SESSION_BTW_TAB),
    active:
      tabs.active === SESSION_BTW_TAB ? undefined : tabs.active ? normalizeSessionTab(path, tabs.active) : tabs.active,
  }
}

const sessionTabsSchema = Persistence.struct({
  all: Persistence.array(Schema.String),
  active: Persistence.optional(Schema.String),
})
const sessionViewSchema = Persistence.struct({
  scroll: Persistence.record(Schema.Struct({ x: Schema.Finite, y: Schema.Finite })),
  reviewOpen: Schema.optional(Persistence.array(Schema.String)),
  reviewMode: Schema.optional(Schema.Literals(["git", "branch", "turn"])),
  reviewFile: Schema.optional(Schema.String),
  pendingMessage: Schema.optional(Schema.String),
  pendingMessageAt: Schema.optional(Schema.Finite),
})

export const layoutSchema = Persistence.struct({
  sidebar: Persistence.struct({
    opened: Schema.Boolean,
    width: Schema.Finite,
    workspaces: Persistence.record(Schema.Boolean),
    workspacesDefault: Schema.Boolean,
  }),
  terminal: Persistence.struct({ height: Schema.Finite, opened: Schema.Boolean }),
  review: Persistence.struct({
    diffStyle: Schema.Literals(["unified", "split"]),
    panelOpened: Schema.Boolean,
  }),
  fileTree: Persistence.struct({
    opened: Schema.Boolean,
    width: Schema.Finite,
    tab: Schema.Literals(["changes", "all"]),
  }),
  session: Persistence.struct({ width: Schema.Finite }),
  mobileSidebar: Persistence.struct({ opened: Schema.Boolean }),
  sessionTabs: Persistence.record(Persistence.fallback(sessionTabsSchema, () => ({ all: [] }))),
  sessionView: Persistence.record(Persistence.fallback(sessionViewSchema, () => ({ scroll: {} }))),
  home: Persistence.struct({
    selection: Persistence.struct({
      server: Schema.optional(TabStorage.ServerKey),
      directory: Schema.optional(Schema.String),
    }),
  }),
})

export const layoutPersistence = Persistence.migrate(
  layoutSchema,
  Schema.Struct({
    sidebar: Persistence.optional(
      Schema.Struct({
        workspaces: Persistence.optional(Schema.Union([Schema.Boolean, Schema.Record(Schema.String, Schema.Boolean)])),
        workspacesDefault: Persistence.optional(Schema.Boolean),
      }),
    ),
    review: Persistence.optional(Schema.Struct({ panelOpened: Persistence.optional(Schema.Boolean) })),
    fileTree: Persistence.optional(
      Schema.Struct({
        opened: Persistence.optional(Schema.Boolean),
        width: Persistence.optional(Schema.Finite),
        tab: Persistence.optional(Schema.Literals(["changes", "all"])),
      }),
    ),
    sessionTabs: layoutSchema.fields.sessionTabs,
    sessionView: layoutSchema.fields.sessionView,
  }).pipe(
    Schema.decode({
      decode: SchemaGetter.transform((value) => ({
        ...value,
        sidebar:
          typeof value.sidebar?.workspaces === "boolean"
            ? { ...value.sidebar, workspaces: {}, workspacesDefault: value.sidebar.workspaces }
            : value.sidebar,
        // Only an existing review section inherits the old file-tree panel flag.
        review: value.review
          ? { ...value.review, panelOpened: value.review.panelOpened ?? value.fileTree?.opened }
          : value.review,
        fileTree:
          value.fileTree && !value.fileTree.tab
            ? {
                ...value.fileTree,
                opened: true,
                width: value.fileTree.width === 260 ? DEFAULT_FILE_TREE_WIDTH : value.fileTree.width,
                tab: "changes" as const,
              }
            : value.fileTree,
        sessionTabs: Object.fromEntries(
          Object.entries(value.sessionTabs)
            .filter(([key]) => SessionStateKey.is(key))
            .map(([key, tabs]) => [key, normalizeStoredSessionTabs(key, tabs)]),
        ),
        sessionView: Object.fromEntries(Object.entries(value.sessionView).filter(([key]) => SessionStateKey.is(key))),
      })),
      encode: SchemaGetter.transform((value) => value),
    }),
  ),
)

export function initialLayout(server?: ServerConnection.Key): typeof layoutSchema.Type {
  return {
    sidebar: { opened: false, width: DEFAULT_SIDEBAR_WIDTH, workspaces: {}, workspacesDefault: false },
    terminal: { height: DEFAULT_TERMINAL_HEIGHT, opened: false },
    review: { diffStyle: "split", panelOpened: DEFAULT_REVIEW_PANEL_OPENED },
    fileTree: { opened: false, width: DEFAULT_FILE_TREE_WIDTH, tab: "changes" },
    session: { width: DEFAULT_SESSION_WIDTH },
    mobileSidebar: { opened: false },
    sessionTabs: {},
    sessionView: {},
    home: { selection: server ? { server } : {} },
  }
}
