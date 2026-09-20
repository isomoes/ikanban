/** View models for the restored UI. Network contracts live in @opencode/client. */
import type * as V2 from "@opencode/client"
export type OpencodeClient = ReturnType<typeof import("./adapter").createUIClient>
export type SessionStatus = V2.SessionStatus
export type SnapshotFileDiff = {
  file: string
  before?: string
  after?: string
  additions: number
  deletions: number
  status?: "added" | "deleted" | "modified"
  patch?: string
}
export type VcsFileStatus = V2.VcsFileStatus
export type VcsInfo = { branch?: string }
export type Path = { home: string; state: string; config: string; worktree: string; directory: string }
export type Project = Omit<V2.Project, "canonical"> & { worktree: string; canonical?: string }
export type Session = {
  id: string
  parentID?: string
  projectID: string
  directory: string
  title: string
  slug: string
  version: string
  time: { created: number; updated: number; archived?: number; compacting?: number }
  summary?: { additions: number; deletions: number; files: number; diffs?: SnapshotFileDiff[] }
  revert?: { messageID: string; partID?: string; snapshot?: string; diff?: string }
  share?: { url: string }
}
export type Tokens = V2.TokenUsageInfo & { total?: number }
export type MessageError = { name: string; data: { message: string; [key: string]: unknown } }
export type UserMessage = {
  id: string
  sessionID: string
  role: "user"
  time: { created: number }
  agent: string
  model: { providerID: string; modelID: string }
  variant?: string
  system?: string
  summary?: { title?: string; body?: string; diffs: SnapshotFileDiff[] }
  tools?: Record<string, boolean>
}
export type AssistantMessage = {
  id: string
  sessionID: string
  role: "assistant"
  time: { created: number; completed?: number }
  parentID: string
  modelID: string
  providerID: string
  agent: string
  mode: string
  path: { cwd: string; root: string }
  cost: number
  tokens: Tokens
  finish?: string
  error?: MessageError
  summary?: boolean
  variant?: string
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
  time: { start: number; end?: number }
  metadata?: Record<string, unknown>
}
export type FilePart = PartBase & {
  type: "file"
  mime: string
  url: string
  filename?: string
  source?: { type: "file"; path: string; text: { value: string; start: number; end: number } }
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
    | {
        status: "running"
        input: Record<string, unknown>
        title?: string
        metadata?: Record<string, any>
        time: { start: number }
      }
    | {
        status: "completed"
        input: Record<string, unknown>
        output: string
        title: string
        metadata: Record<string, any>
        time: { start: number; end: number; compacted?: number }
        attachments?: FilePart[]
      }
    | {
        status: "error"
        input: Record<string, unknown>
        error: string
        metadata?: Record<string, any>
        time: { start: number; end: number }
      }
}
export type Part =
  | TextPart
  | ReasoningPart
  | FilePart
  | AgentPart
  | ToolPart
  | (PartBase & { type: "step-start"; snapshot?: string })
  | (PartBase & { type: "step-finish"; reason: string; snapshot?: string; cost: number; tokens: Tokens })
  | (PartBase & { type: "patch"; hash: string; files: string[] })
  | (PartBase & { type: "snapshot"; snapshot: string })
  | (PartBase & { type: "compaction"; auto: boolean; overflow?: boolean })
  | (PartBase & { type: "retry"; attempt: number; error: MessageError; time: { created: number } })
  | (PartBase & {
      type: "subtask"
      prompt: string
      description: string
      agent: string
      model?: { providerID: string; modelID: string }
      command?: string
    })
export type TextPartInput = Omit<TextPart, keyof PartBase> & { id?: string }
export type FilePartInput = Omit<FilePart, keyof PartBase> & { id?: string }
export type AgentPartInput = Omit<AgentPart, keyof PartBase> & { id?: string }
export type Todo = { id?: string; content: string; status: string; priority: string }
export type PermissionRequest = {
  id: string
  sessionID: string
  permission: string
  patterns: string[]
  always: string[]
  metadata: Record<string, unknown>
  tool?: { messageID: string; callID: string }
}
export type QuestionInfo = {
  question: string
  header: string
  options: { label: string; description: string }[]
  multiple?: boolean
  custom?: boolean
}
export type QuestionAnswer = string[]
export type QuestionRequest = {
  id: string
  sessionID: string
  questions: QuestionInfo[]
  tool?: { messageID: string; callID: string }
  form?: V2.FormInfo
}
export type FileNode = { name: string; path: string; absolute: string; type: "file" | "directory"; ignored: boolean }
export type FileContent = {
  type: "text" | "binary"
  content: string
  mimeType?: string
  encoding?: "base64"
  patch?: import("diff").StructuredPatch
  diff?: string
}
export type Agent = {
  name: string
  description?: string
  mode: "primary" | "subagent" | "all"
  hidden?: boolean
  native?: boolean
  color?: string
  model?: { providerID: string; modelID: string }
  variant?: string
  permission: V2.PermissionRuleset
  options: Record<string, unknown>
}
export type Command = {
  name: string
  description?: string
  agent?: string
  model?: string
  template: string
  subtask?: boolean
  source?: "command" | "mcp" | "skill"
  hints?: string[]
}
export type LspStatus = { id: string; name: string; root: string; status: "connected" | "error" }
export type McpStatus = V2.McpServer["status"]
export type Model = {
  id: string
  providerID: string
  name: string
  family?: string
  release_date: string
  status?: string
  limit: { context: number; input?: number; output: number }
  cost: { input: number; output: number; cache_read?: number; cache_write?: number }
  capabilities: {
    temperature: boolean
    reasoning: boolean
    attachment: boolean
    toolcall: boolean
    input: { text: boolean; audio: boolean; image: boolean; video: boolean; pdf: boolean }
    output: { text: boolean; audio: boolean; image: boolean; video: boolean; pdf: boolean }
    interleaved: boolean
  }
  variants?: Record<string, Record<string, unknown>>
  options: Record<string, unknown>
  headers: Record<string, string>
  api: { id: string; url: string; npm: string }
}
export type Provider = {
  id: string
  name: string
  source: "env" | "api" | "config" | "custom"
  env: string[]
  options: Record<string, unknown>
  models: Record<string, Model>
  integrationID?: string
}
export type ProviderListResponse = { all: Provider[]; connected: string[]; default: Record<string, string> }
export type ProviderAuthResponse = Record<
  string,
  { type: "api" | "oauth"; label: string; methodID?: string; form?: V2.FormFields }[]
>
export type ProviderAuthAuthorization = {
  url: string
  method: "auto" | "code"
  instructions: string
  attemptID: string
  integrationID: string
}
export type Config = Extract<V2.ConfigEntry, { type: "document" }>["info"]
export type EventSessionError = { type: "session.error"; properties: { sessionID?: string; error?: MessageError } }
export type UIEvent =
  | {
      type: "server.connected" | "global.disposed" | "server.instance.disposed" | "lsp.updated"
      properties: Record<string, never>
    }
  | { type: "session.created" | "session.updated" | "session.deleted"; properties: { info: Session } }
  | { type: "session.status"; properties: { sessionID: string; status: SessionStatus } }
  | { type: "session.idle"; properties: { sessionID: string } }
  | EventSessionError
  | { type: "message.updated"; properties: { info: Message } }
  | { type: "message.parts.updated"; properties: { messageID: string; parts: Part[] } }
  | { type: "message.part.updated"; properties: { part: Part } }
  | {
      type: "message.part.delta"
      properties: { sessionID: string; messageID: string; partID: string; field: string; delta: string }
    }
  | { type: "message.removed"; properties: { sessionID: string; messageID: string } }
  | { type: "permission.asked"; properties: PermissionRequest }
  | { type: "permission.replied"; properties: { sessionID: string; requestID: string } }
  | { type: "question.asked"; properties: QuestionRequest }
  | { type: "question.replied" | "question.rejected"; properties: { sessionID: string; requestID: string } }
  | { type: "project.updated"; properties: Project }
  | { type: "file.watcher.updated"; properties: { file: string; event: "add" | "change" | "unlink" } }
  | { type: "vcs.branch.updated"; properties: { branch: string } }
  | { type: "worktree.ready"; properties: { directory: string; name: string; branch: string } }
  | { type: "worktree.failed"; properties: { message: string } }
  | { type: "todo.updated"; properties: { sessionID: string; todos: Todo[] } }
export type GlobalEvent = { directory: string; payload: UIEvent }
