export type RuntimeProject = {
  id: string
  name: string
  directory: string
}

export type RuntimeModel = {
  id: string
  providerID: string
  name: string
}

export type RuntimeSession = {
  id: string
  directory: string
  title: string
  createdAt: number
  updatedAt: number
}

export type RuntimePart =
  | { id: string; type: "text"; text: string }
  | { id: string; type: "reasoning"; text: string }
  | {
      id: string
      type: "tool"
      name: string
      callID: string
      state: "pending" | "running" | "completed" | "error"
      input?: unknown
      output?: unknown
      error?: string
    }

export type RuntimeMessage = {
  id: string
  sessionID: string
  role: "user" | "assistant"
  createdAt: number
  model?: { providerID: string; modelID: string }
  parts: RuntimePart[]
}

export type RuntimeEvent =
  | { type: "session"; action: "created" | "updated"; session: RuntimeSession }
  | { type: "status"; sessionID: string; status: "busy" | "idle" }
  | { type: "message"; action: "created" | "updated"; message: RuntimeMessage }
  | { type: "part"; action: "created" | "updated"; sessionID: string; messageID: string; part: RuntimePart }
  | { type: "delta"; sessionID: string; messageID: string; partID: string; field: "text"; delta: string }
  | { type: "error"; sessionID?: string; message: string }

export type RuntimeSessionStatus = Record<string, { type: "busy" | "idle" }>

export type RuntimePrompt = {
  messageID?: string
  model?: { providerID: string; modelID: string }
  agent?: string
  parts: Array<Record<string, unknown>>
  [key: string]: unknown
}

export interface AgentRuntime {
  project: {
    list(): Promise<RuntimeProject[]>
    get(directory: string): Promise<RuntimeProject>
  }
  model: {
    list(directory: string): Promise<RuntimeModel[]>
  }
  session: {
    create(directory: string, input?: Record<string, unknown>): Promise<RuntimeSession>
    list(directory: string): Promise<RuntimeSession[]>
    get(directory: string, sessionID: string): Promise<RuntimeSession>
    messages(directory: string, sessionID: string): Promise<RuntimeMessage[]>
    status(directory: string): Promise<RuntimeSessionStatus>
  }
  prompt(directory: string, sessionID: string, input: RuntimePrompt): Promise<void>
  abort(directory: string, sessionID: string): Promise<void>
  event(directory: string | undefined, listener: (event: RuntimeEvent) => void): () => void
}
