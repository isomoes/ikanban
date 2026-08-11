export type { QuestionInfo, SessionStatus, V2Event, VcsFileStatus } from "@opencode-ai/client"

export type SnapshotFileDiff = {
  file?: string
  patch?: string
  additions: number
  deletions: number
  status?: "added" | "deleted" | "modified"
}

export type Session = {
  id: string
  slug: string
  projectID: string
  workspaceID?: string
  directory: string
  path?: string
  parentID?: string
  title: string
  agent?: string
  model?: { id: string; providerID: string; variant?: string }
  version: string
  cost?: number
  tokens?: TokenUsage
  summary?: { additions: number; deletions: number; files: number; diffs?: SnapshotFileDiff[] }
  share?: { url: string }
  metadata?: Record<string, unknown>
  time: { created: number; updated: number; compacting?: number; archived?: number }
  revert?: { messageID: string; partID?: string; snapshot?: string; diff?: string }
}

export type TokenUsage = {
  total?: number
  input: number
  output: number
  reasoning: number
  cache: { read: number; write: number }
}

export type MessageError = { name: string; data: { message?: string; [key: string]: unknown } }
export type UserMessage = {
  id: string
  sessionID: string
  role: "user"
  time: { created: number }
  summary?: { title?: string; body?: string; diffs: SnapshotFileDiff[] }
  agent: string
  model: { providerID: string; modelID: string; variant?: string }
  system?: string
  tools?: Record<string, boolean>
}
export type AssistantMessage = {
  id: string
  sessionID: string
  role: "assistant"
  time: { created: number; completed?: number }
  error?: MessageError
  parentID: string
  modelID: string
  providerID: string
  mode: string
  agent: string
  path: { cwd: string; root: string }
  summary?: boolean
  cost: number
  tokens: TokenUsage
  variant?: string
  finish?: string
}
export type Message = UserMessage | AssistantMessage

type PartBase = { id: string; sessionID: string; messageID: string }
export type TextPart = PartBase & {
  type: "text"
  text: string
  synthetic?: boolean
  ignored?: boolean
  time?: { start: number; end?: number }
  metadata?: Record<string, unknown>
}
export type ReasoningPart = PartBase & {
  type: "reasoning"
  text: string
  metadata?: Record<string, unknown>
  time: { start: number; end?: number }
}
export type FilePartSource = {
  text: { value: string; start: number; end: number }
  type: "file" | "symbol" | "resource"
  path?: string
  [key: string]: unknown
}
export type FilePart = PartBase & {
  type: "file"
  mime: string
  filename?: string
  url: string
  source?: FilePartSource
}
export type AgentPart = PartBase & {
  type: "agent"
  name: string
  source?: { value: string; start: number; end: number }
}
export type ToolPart = PartBase & {
  type: "tool"
  callID: string
  tool: string
  state:
    | { status: "pending"; input: Record<string, unknown>; raw: string }
    | { status: "running"; input: Record<string, unknown>; title?: string; metadata?: Record<string, unknown>; time: { start: number } }
    | {
        status: "completed"
        input: Record<string, unknown>
        output: string
        title: string
        metadata: Record<string, unknown>
        time: { start: number; end: number; compacted?: number }
        attachments?: FilePart[]
      }
    | {
        status: "error"
        input: Record<string, unknown>
        error: string
        metadata?: Record<string, unknown>
        time: { start: number; end: number }
      }
  metadata?: Record<string, unknown>
}
export type Part =
  | TextPart
  | ReasoningPart
  | FilePart
  | AgentPart
  | ToolPart
  | (PartBase & { type: "step-start"; snapshot?: string })
  | (PartBase & { type: "step-finish"; reason: string; snapshot?: string; cost: number; tokens: TokenUsage })
  | (PartBase & { type: "snapshot"; snapshot: string })
  | (PartBase & { type: "patch"; hash: string; files: string[] })
  | (PartBase & { type: "retry"; attempt: number; error: MessageError; time: { created: number } })
  | (PartBase & { type: "compaction"; auto: boolean; overflow?: boolean; tail_start_id?: string })
  | (PartBase & { type: "subtask"; prompt: string; description: string; agent: string; command?: string })

export type TextPartInput = Omit<TextPart, keyof PartBase> & { id?: string }
export type FilePartInput = Omit<FilePart, keyof PartBase> & { id?: string }
export type AgentPartInput = Omit<AgentPart, keyof PartBase> & { id?: string }

export type FileContent = {
  type: "text" | "binary"
  content: string
  diff?: string
  patch?: {
    oldFileName: string
    newFileName: string
    oldHeader?: string
    newHeader?: string
    hunks: Array<{ oldStart: number; oldLines: number; newStart: number; newLines: number; lines: string[] }>
    index?: string
  }
  encoding?: "base64"
  mimeType?: string
}
export type FileNode = { name: string; path: string; absolute: string; type: "file" | "directory"; ignored: boolean }
export type Path = { home: string; state: string; config: string; worktree: string; directory: string }
export type VcsInfo = { branch?: string; default_branch?: string }

export type Project = {
  id: string
  worktree: string
  vcs?: "git" | "hg"
  name?: string
  icon?: { url?: string; override?: string; color?: string }
  commands?: { start?: string }
  time: { created: number; updated: number; initialized?: number }
  sandboxes: string[]
}

export type Model = {
  id: string
  providerID: string
  name: string
  family?: string
  capabilities: {
    temperature: boolean
    reasoning: boolean
    attachment: boolean
    toolcall: boolean
    input: Record<string, boolean>
    output: Record<string, boolean>
    interleaved: boolean | { field: string }
  }
  cost: { input: number; output: number; cache: { read: number; write: number } }
  limit: { context: number; input?: number; output: number }
  status: "alpha" | "beta" | "deprecated" | "active"
  variants?: Record<string, Record<string, unknown>>
  time?: { released: number }
}
export type Provider = {
  id: string
  name: string
  source: "env" | "config" | "custom" | "api"
  env: string[]
  key?: string
  options: Record<string, unknown>
  models: Record<string, Model>
}
export type ProviderListResponse = { all: Provider[]; default: Record<string, string>; connected: string[] }
export type ProviderAuthMethod = { type: "oauth" | "api"; label: string; prompts?: Array<Record<string, unknown>> }
export type ProviderAuthResponse = Record<string, ProviderAuthMethod[]>
export type ProviderAuthAuthorization = {
  integrationID: string
  attemptID: string
  url: string
  method: "auto" | "code"
  instructions: string
}

export type PermissionRequest = {
  id: string
  sessionID: string
  permission: string
  patterns: string[]
  metadata: Record<string, unknown>
  always: string[]
  tool?: { messageID: string; callID: string }
}
export type Todo = { content: string; status: string; priority: string }
export type QuestionRequest = import("@opencode-ai/client").QuestionRequest
export type QuestionAnswer = import("@opencode-ai/client").QuestionAnswer

export type Command = {
  name: string
  description?: string
  agent?: string
  model?: string
  source?: "command" | "mcp" | "skill"
  template: string
  subtask?: boolean
  hints: string[]
}
export type Agent = {
  name: string
  description?: string
  mode: "subagent" | "primary" | "all"
  native?: boolean
  hidden?: boolean
  color?: string
  permission: Array<{ permission: string; pattern: string; action: "allow" | "deny" | "ask" }>
  model?: { modelID: string; providerID: string }
  variant?: string
  options: Record<string, unknown>
  steps?: number
}
export type LspStatus = { id: string; name: string; root: string; status: "connected" | "error" }
export type McpStatus =
  | { status: "connected" }
  | { status: "disabled" }
  | { status: "failed"; error: string }
  | { status: "needs_auth" }
  | { status: "needs_client_registration"; error: string }

export type ProviderConfig = {
  name?: string
  package?: string
  models?: Record<string, unknown>
}
export type Config = {
  [key: string]: unknown
  model?: string
  default_agent?: string
  username?: string
  provider?: Record<string, ProviderConfig>
}
export type OpenCodeClient = import("@opencode-ai/client").OpenCodeClient
export type OpencodeClient = OpenCodeClient
