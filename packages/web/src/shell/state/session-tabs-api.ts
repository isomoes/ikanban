import { batch, createMemo, type Accessor } from "solid-js"
import { produce, type SetStoreFunction, type Store } from "solid-js/store"
import { createSessionKeyReader } from "./helpers"
import { normalizeSessionTab, normalizeSessionTabList, sessionPath, type layoutSchema } from "./schema"
import { closeSessionTab, openSessionTab, previewSessionTab } from "./session-tabs"

type LayoutState = typeof layoutSchema.Type
type LayoutEphemeral = {
  reviewPanelSource: "context-button" | "other"
  sessionTabPreview: Record<string, string | undefined>
}

export function createSessionTabsApi(
  deps: {
    store: Store<LayoutState>
    setStore: SetStoreFunction<LayoutState>
    ephemeral: Store<LayoutEphemeral>
    setEphemeral: SetStoreFunction<LayoutEphemeral>
    ensureKey: (key: string) => string
  },
  sessionKey: string | Accessor<string>,
) {
  const { store, setStore, ephemeral, setEphemeral, ensureKey } = deps
  const key = createSessionKeyReader(sessionKey, ensureKey)
  const path = createMemo(() => sessionPath(key()))
  const tabs = createMemo(() => store.sessionTabs[key()] ?? { all: [] })
  const normalize = (tab: string) => normalizeSessionTab(path(), tab)
  const normalizeAll = (all: string[]) => normalizeSessionTabList(path(), all)
  const apply = (session: string, next: ReturnType<typeof openSessionTab>) => {
    batch(() => {
      setStore("sessionTabs", session, next.tabs)
      setEphemeral("sessionTabPreview", session, next.preview)
    })
  }
  return {
    tabs,
    active: createMemo(() => tabs().active),
    all: createMemo(() => tabs().all.filter((tab) => tab !== "review")),
    preview: createMemo(() => ephemeral.sessionTabPreview[key()]),
    setActive(tab: string | undefined) {
      const session = key()
      const next = tab ? normalize(tab) : tab
      if (!store.sessionTabs[session]) {
        setStore("sessionTabs", session, { all: [], active: next })
      } else {
        setStore("sessionTabs", session, "active", next)
      }
    },
    setAll(all: string[]) {
      const session = key()
      const next = normalizeAll(all).filter((tab) => tab !== "review")
      batch(() => {
        if (!store.sessionTabs[session]) {
          setStore("sessionTabs", session, { all: next, active: undefined })
        } else {
          setStore("sessionTabs", session, "all", next)
        }
        const preview = ephemeral.sessionTabPreview[session]
        if (preview && !next.includes(preview)) setEphemeral("sessionTabPreview", session, undefined)
      })
    },
    async open(tab: string) {
      const session = key()
      apply(
        session,
        openSessionTab(
          { tabs: store.sessionTabs[session] ?? { all: [] }, preview: ephemeral.sessionTabPreview[session] },
          normalize(tab),
        ),
      )
    },
    previewTab(tab: string) {
      const session = key()
      apply(
        session,
        previewSessionTab(
          { tabs: store.sessionTabs[session] ?? { all: [] }, preview: ephemeral.sessionTabPreview[session] },
          normalize(tab),
        ),
      )
    },
    close(tab: string) {
      const session = key()
      const current = store.sessionTabs[session]
      if (!current) return
      apply(session, closeSessionTab({ tabs: current, preview: ephemeral.sessionTabPreview[session] }, normalize(tab)))
    },
    move(tab: string, to: number) {
      const session = key()
      const current = store.sessionTabs[session]
      if (!current) return
      const index = current.all.findIndex((f) => f === tab)
      if (index === -1) return
      setStore(
        "sessionTabs",
        session,
        "all",
        produce((opened) => {
          opened.splice(to, 0, opened.splice(index, 1)[0])
        }),
      )
    },
  }
}
