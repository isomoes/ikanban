import { createRoot, getOwner, onCleanup, runWithOwner, type Owner } from "solid-js"
import { createStore, type SetStoreFunction, type Store } from "solid-js/store"
import { Persist, persisted } from "@/runtime/persistence/storage"
import {
  DIR_IDLE_TTL_MS,
  MAX_DIR_STORES,
  type DirState,
  type IconCache,
  type MetaCache,
  type ProjectMeta,
  type State,
} from "./types"
import { canDisposeDirectory, pickDirectoriesToEvict } from "./eviction"
import { directoryKey, type DirectoryKey } from "./utils"
import type { ServerScope } from "@/runtime/server/scope"
import { IconState, ProjectState } from "../persistence"

// Client-owned, per-workspace state only: the project a directory was linked to and the
// locally persisted display overrides. Server resources live in `Data`.
export function createChildStoreManager(input: {
  owner: Owner
  scope: ServerScope
  persist: typeof persisted
  translate: (key: string, vars?: Record<string, string | number>) => string
}) {
  const children: Record<string, [Store<State>, SetStoreFunction<State>]> = {}
  const metaCache = new Map<string, MetaCache>()
  const iconCache = new Map<string, IconCache>()
  const lifecycle = new Map<string, DirState>()
  const pins = new Map<string, number>()
  const ownerPins = new WeakMap<object, Set<string>>()
  const disposers = new Map<string, () => void>()

  const markKey = (key: DirectoryKey) => {
    if (!key) return
    lifecycle.set(key, { lastAccessAt: Date.now() })
    runEviction(key)
  }

  const mark = (directory: string) => {
    const key = directoryKey(directory)
    markKey(key)
  }

  const pin = (directory: string) => {
    const key = directoryKey(directory)
    if (!key) return
    pins.set(key, (pins.get(key) ?? 0) + 1)
    markKey(key)
  }

  const unpin = (directory: string) => {
    const key = directoryKey(directory)
    if (!key) return
    const next = (pins.get(key) ?? 0) - 1
    if (next > 0) {
      pins.set(key, next)
      return
    }
    pins.delete(key)
    runEviction()
  }

  const pinned = (directory: string) => (pins.get(directoryKey(directory)) ?? 0) > 0

  const pinForOwner = (directory: string) => {
    const current = getOwner()
    if (!current) return
    if (current === input.owner) return
    const key = current as object
    const set = ownerPins.get(key)
    if (set?.has(directory)) return
    if (set) set.add(directory)
    if (!set) ownerPins.set(key, new Set([directory]))
    pin(directory)
    onCleanup(() => {
      const set = ownerPins.get(key)
      if (set) {
        set.delete(directory)
        if (set.size === 0) ownerPins.delete(key)
      }
      unpin(directory)
    })
  }

  function disposeDirectory(directory: DirectoryKey) {
    const key = directory
    if (!canDisposeDirectory({ directory: key, hasStore: !!children[key], pinned: pinned(key) })) {
      return false
    }

    metaCache.delete(key)
    iconCache.delete(key)
    lifecycle.delete(key)
    const dispose = disposers.get(key)
    if (dispose) {
      dispose()
      disposers.delete(key)
    }
    delete children[key]
    return true
  }

  function runEviction(skip?: string) {
    const stores = Object.keys(children)
    if (stores.length === 0) return
    const list = pickDirectoriesToEvict({
      stores,
      state: lifecycle,
      pins: new Set(stores.filter(pinned)),
      max: MAX_DIR_STORES,
      ttl: DIR_IDLE_TTL_MS,
      now: Date.now(),
    }).filter((directory) => directory !== skip)
    if (list.length === 0) return
    for (const directory of list) {
      if (!disposeDirectory(directoryKey(directory))) continue
    }
  }

  function ensureChild(directory: string) {
    const key = directoryKey(directory)
    if (!key) console.error("No directory provided")
    if (!children[key]) {
      const meta = runWithOwner(input.owner, () =>
        input.persist(Persist.serverWorkspace(input.scope, directory, "project"), ProjectState, { value: undefined }),
      )
      if (!meta) throw new Error(input.translate("error.childStore.persistedProjectMetadataCreateFailed"))
      metaCache.set(key, { store: meta[0], setStore: meta[1], ready: meta[3] })

      const icon = runWithOwner(input.owner, () =>
        input.persist(Persist.serverWorkspace(input.scope, directory, "icon"), IconState, { value: undefined }),
      )
      if (!icon) throw new Error(input.translate("error.childStore.persistedProjectIconCreateFailed"))
      iconCache.set(key, { store: icon[0], setStore: icon[1], ready: icon[3] })

      const init = () =>
        createRoot((dispose) => {
          const child = createStore<State>({
            project: "",
            get projectMeta() {
              return meta[0].value
            },
            get icon() {
              return icon[0].value
            },
          })
          children[key] = child
          disposers.set(key, dispose)
        })

      runWithOwner(input.owner, init)
    }
    markKey(key)
    const childStore = children[key]
    if (!childStore) throw new Error(input.translate("error.childStore.storeCreateFailed"))
    return childStore
  }

  function child(directory: string) {
    const key = directoryKey(directory)
    const childStore = ensureChild(directory)
    pinForOwner(key)
    return childStore
  }

  function projectMeta(directory: string, patch: ProjectMeta) {
    const key = directoryKey(directory)
    const [store] = ensureChild(directory)
    const cached = metaCache.get(key)
    if (!cached) return
    const previous = store.projectMeta ?? {}
    const icon = patch.icon ? { ...previous.icon, ...patch.icon } : previous.icon
    const commands = patch.commands ? { ...previous.commands, ...patch.commands } : previous.commands
    const next = {
      ...previous,
      ...patch,
      icon,
      commands,
    }
    cached.setStore("value", next)
  }

  function projectIcon(directory: string, value: string | undefined) {
    const key = directoryKey(directory)
    const [store] = ensureChild(directory)
    const cached = iconCache.get(key)
    if (!cached) return
    if (store.icon === value) return
    cached.setStore("value", value)
  }

  return {
    children,
    ensureChild,
    child,
    projectMeta,
    projectIcon,
    mark,
    pin,
    unpin,
    pinned,
    disposeDirectory,
    runEviction,
    metaCache,
    iconCache,
  }
}
