import type { Accessor } from "solid-js"
import type { SetStoreFunction, Store } from "solid-js/store"
import { IconState, ProjectState } from "../persistence"

export type ProjectMeta = NonNullable<typeof ProjectState.Type.value>

export type State = {
  project: string
  projectMeta: ProjectMeta | undefined
  icon: string | undefined
}

export type MetaCache = {
  store: Store<typeof ProjectState.Type>
  setStore: SetStoreFunction<typeof ProjectState.Type>
  ready: Accessor<boolean>
}

export type IconCache = {
  store: Store<typeof IconState.Type>
  setStore: SetStoreFunction<typeof IconState.Type>
  ready: Accessor<boolean>
}

export type DirState = {
  lastAccessAt: number
}

export type EvictPlan = {
  stores: string[]
  state: Map<string, DirState>
  pins: Set<string>
  max: number
  ttl: number
  now: number
}

export type DisposeCheck = {
  directory: string
  hasStore: boolean
  pinned: boolean
}

export const MAX_DIR_STORES = 30
export const DIR_IDLE_TTL_MS = 20 * 60 * 1000
export const SESSION_RECENT_WINDOW = 4 * 60 * 60 * 1000
export const SESSION_RECENT_LIMIT = 50
