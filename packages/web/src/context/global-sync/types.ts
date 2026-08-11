import type {
  AgentInfo,
  CommandInfo,
  ConfigEntry,
  McpServer,
  ModelInfo,
  PermissionRequest,
  Project,
  ProviderInfo,
  QuestionRequest,
  SessionInfo,
  SessionMessageInfo,
  SessionStatus,
  VcsInfo,
  IntegrationInfo,
} from "@opencode-ai/client"
import type { LspStatus, RuntimeLocations, TodoItem } from "@/types/app"
import type { FileDiff } from "@/context/file/types"
import type { Accessor } from "solid-js"
import type { SetStoreFunction, Store } from "solid-js/store"

export type ProjectMeta = {
  name?: string
  icon?: {
    override?: string
    color?: string
  }
  commands?: {
    start?: string
  }
}

export type State = {
  status: "loading" | "partial" | "complete"
  agent: AgentInfo[]
  command: CommandInfo[]
  project: string
  projectMeta: ProjectMeta | undefined
  icon: string | undefined
  provider: {
    providers: ProviderInfo[]
    models: ModelInfo[]
    integrations: IntegrationInfo[]
    defaultModel: ModelInfo | null
  }
  config: ConfigEntry[]
  path: RuntimeLocations
  session: SessionInfo[]
  sessionTotal: number
  session_status: {
    [sessionID: string]: SessionStatus
  }
  session_diff: {
    [sessionID: string]: FileDiff[]
  }
  project_diff: {
    [directory: string]: FileDiff[]
  }
  todo: {
    [sessionID: string]: TodoItem[]
  }
  permission: {
    [sessionID: string]: PermissionRequest[]
  }
  question: {
    [sessionID: string]: QuestionRequest[]
  }
  mcp: {
    [name: string]: McpServer["status"]
  }
  lsp: LspStatus[]
  vcs: VcsInfo | undefined
  limit: number
  message: {
    [sessionID: string]: SessionMessageInfo[]
  }
}

export type VcsCache = {
  store: Store<{ value: VcsInfo | undefined }>
  setStore: SetStoreFunction<{ value: VcsInfo | undefined }>
  ready: Accessor<boolean>
}

export type MetaCache = {
  store: Store<{ value: ProjectMeta | undefined }>
  setStore: SetStoreFunction<{ value: ProjectMeta | undefined }>
  ready: Accessor<boolean>
}

export type IconCache = {
  store: Store<{ value: string | undefined }>
  setStore: SetStoreFunction<{ value: string | undefined }>
  ready: Accessor<boolean>
}

export type ChildOptions = {
  bootstrap?: boolean
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
  booting: boolean
  loadingSessions: boolean
}

export type RootLoadArgs = {
  directory: string
  limit: number
  list: (query: { directory: string; roots: true; limit?: number }) => Promise<{ data?: SessionInfo[] }>
}

export type RootLoadResult = {
  data?: SessionInfo[]
  limit: number
  limited: boolean
}

export const MAX_DIR_STORES = 30
export const DIR_IDLE_TTL_MS = 20 * 60 * 1000
export const SESSION_RECENT_WINDOW = 4 * 60 * 60 * 1000
export const SESSION_RECENT_LIMIT = 50
