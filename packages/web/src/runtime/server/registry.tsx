import { createSimpleContext } from "@ikanban/ui/context"
import { batch, createMemo } from "solid-js"
import { type SetStoreFunction, type Store } from "solid-js/store"
import { Persist, persisted } from "@/runtime/persistence/storage"
import { pathKey } from "@/workspaces/path-key"
import { ServerScope } from "@/runtime/server/scope"
import { ServerHttp, ServerHttpBase, ServerKey, serverState } from "./persistence"

type ServerState = ReturnType<typeof serverState>["current"]["Type"]
// Retain closed paths until reopened so settings can exclude them from the server inventory.
// The Home page independently limits the visible recently closed entries.
export const RECENTLY_CLOSED_DISPLAY_LIMIT = 5

export function normalizeServerUrl(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return
  const withProtocol = /^https?:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`
  return withProtocol.replace(/\/+$/, "")
}

export function serverName(conn?: ServerConnection.Http, ignoreDisplayName = false) {
  if (!conn) return ""
  if (conn.displayName && !ignoreDisplayName) return conn.displayName
  return conn.http.url.replace(/^https?:\/\//, "").replace(/\/+$/, "")
}

function isLocalHost(url: string) {
  const host = url.replace(/^https?:\/\//, "").split(":")[0]
  if (host === "localhost" || host === "127.0.0.1") return "local"
}

export function createServerProjects(input: {
  scope: () => ServerScope
  store: Store<ServerState>
  setStore: SetStoreFunction<ServerState>
}) {
  const setStore = input.setStore
  const current = () => input.store.projects[input.scope()] ?? []
  const currentClosed = () => input.store.recentlyClosed?.[input.scope()] ?? []
  const remove = (directory: string) => {
    setStore(
      "projects",
      input.scope(),
      current().filter((project) => project.worktree !== directory),
    )
  }
  return {
    list: current,
    closed: currentClosed,
    recentlyClosed: currentClosed,
    remove,
    open(directory: string) {
      const scope = input.scope()
      const key = pathKey(directory)
      const closed = currentClosed()
      if (closed.some((worktree) => pathKey(worktree) === key)) {
        setStore(
          "recentlyClosed",
          scope,
          closed.filter((worktree) => pathKey(worktree) !== key),
        )
      }
      if (current().some((project) => project.worktree === directory)) return
      setStore("projects", scope, [{ worktree: directory, expanded: true }, ...current()])
    },
    // User-initiated close: removes the project and records it in recently closed.
    // Internal, non-user removals (e.g. sandbox/worktree normalization) should use remove().
    close(directory: string) {
      remove(directory)
      const key = pathKey(directory)
      const closed = [directory, ...currentClosed().filter((worktree) => pathKey(worktree) !== key)]
      setStore("recentlyClosed", input.scope(), closed)
    },
    expand(directory: string) {
      const index = current().findIndex((project) => project.worktree === directory)
      if (index !== -1) setStore("projects", input.scope(), index, "expanded", true)
    },
    collapse(directory: string) {
      const index = current().findIndex((project) => project.worktree === directory)
      if (index !== -1) setStore("projects", input.scope(), index, "expanded", false)
    },
    move(directory: string, toIndex: number) {
      const fromIndex = current().findIndex((project) => project.worktree === directory)
      if (fromIndex === -1 || fromIndex === toIndex) return
      const next = [...current()]
      const [item] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, item)
      setStore("projects", input.scope(), next)
    },
    last() {
      return input.store.lastProject[input.scope()]
    },
    touch(directory: string) {
      setStore("lastProject", input.scope(), directory)
    },
  }
}

export function resolveServerList(input: {
  props?: Array<ServerConnection.Http>
  stored: ServerConnection.Http[]
}): Array<ServerConnection.Http> {
  const deduped = new Map<ServerConnection.Key, ServerConnection.Http>(
    input.props?.map((v) => [ServerConnection.key(v), v]) ?? [],
  )

  for (const conn of input.stored) {
    const key = ServerConnection.key(conn)

    const existing = deduped.get(key)
    if (existing)
      deduped.set(key, {
        ...existing,
        ...conn,
        http: { ...existing.http, ...conn.http },
      })
    else deduped.set(key, conn)
  }

  return [...deduped.values()]
}

export function canRemoveServer(input: {
  key: ServerConnection.Key
  provided?: Array<ServerConnection.Http>
  stored: ServerConnection.Http[]
}) {
  if (input.provided?.some((server) => ServerConnection.key(server) === input.key)) return false
  return input.stored.some((server) => server.http.url === input.key)
}

export namespace ServerConnection {
  export type HttpBase = typeof ServerHttpBase.Type

  export type Http = typeof ServerHttp.Type

  export const key = (conn: Http): Key => Key.make(conn.http.url)

  export const Key = ServerKey
  export type Key = typeof Key.Type

  export const local = (conn?: Http) => !!conn && isLocalHost(conn.http.url) === "local"
}

export const { use: useServers, provider: ServersProvider } = createSimpleContext({
  name: "Server",
  gate: true,
  init: (props: {
    defaultServer?: ServerConnection.Key
    canonicalLocalServer?: ServerConnection.Key
    servers?: Array<ServerConnection.Http>
  }) => {
    const [store, setStore, _] = persisted(
      {
        ...Persist.global("server"),
        sync: true,
        previousKey: "server.v3",
      },
      serverState(() => props.canonicalLocalServer),
      { list: [], hidden: {}, projects: {}, lastProject: {}, recentlyClosed: {} },
    )

    const allServers = createMemo((): Array<ServerConnection.Http> => {
      return resolveServerList({ stored: store.list, props: props.servers })
    })

    function add(input: ServerConnection.Http) {
      const url_ = normalizeServerUrl(input.http.url)
      if (!url_) return
      const conn: ServerConnection.Http = { ...input, authToken: undefined, http: { ...input.http, url: url_ } }
      return batch(() => {
        const existing = store.list.findIndex((x) => x.http.url === url_)
        if (existing !== -1) {
          setStore("list", existing, conn)
        } else {
          setStore("list", store.list.length, conn)
        }
        return conn
      })
    }

    function remove(key: ServerConnection.Key) {
      const list = store.list.filter((x) => x.http.url !== key)
      batch(() => {
        setStore("list", list)
      })
    }

    function canRemove(key: ServerConnection.Key) {
      return canRemoveServer({ key, provided: props.servers, stored: store.list })
    }

    const scope = (key: ServerConnection.Key) => ServerScope.fromServerKey(key, props.canonicalLocalServer)
    const projectStores = new Map<ServerConnection.Key, ReturnType<typeof createServerProjects>>()
    const projectsForServer = (key: ServerConnection.Key) => {
      const existing = projectStores.get(key)
      if (existing) return existing
      const next = createServerProjects({ scope: () => scope(key), store, setStore })
      projectStores.set(key, next)
      return next
    }

    return {
      get list() {
        return allServers()
      },
      add,
      remove,
      canRemove,
      scope,
      projects: {
        forServer: projectsForServer,
      },
    }
  },
})
