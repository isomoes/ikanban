import { realpath } from "node:fs/promises"
import { basename, isAbsolute, relative, resolve, sep } from "node:path"
import {
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  createAgentSession,
  getAgentDir,
  type AgentSessionEvent,
} from "@earendil-works/pi-coding-agent"
import { createPiEventContext, queuePiUserMessageID, translatePiEvent, type PiEventContext } from "./pi-events"
import type {
  AgentRuntime,
  RuntimeEvent,
  RuntimeMessage,
  RuntimeModel,
  RuntimePart,
  RuntimePrompt,
  RuntimeSession,
  RuntimeSessionStatus,
} from "./protocol"

export type PiSessionInfo = {
  id: string
  path: string
  directory: string
  title: string
  createdAt: number
  updatedAt: number
}

export interface PiSession {
  readonly id: string
  readonly path: string
  readonly directory: string
  readonly messages: readonly unknown[]
  readonly isIdle?: boolean
  subscribe(listener: (event: AgentSessionEvent) => void): () => void
  setModel(model: unknown): Promise<void>
  prompt(text: string): Promise<void>
  abort(): Promise<void>
  dispose(): void
}

export interface PiSessionFactory {
  list(directory: string): Promise<PiSessionInfo[]>
  create(directory: string): Promise<PiSession>
  open(path: string): Promise<PiSession>
  listModels(): Promise<RuntimeModel[]>
  getModel(providerID: string, modelID: string): unknown | undefined | Promise<unknown | undefined>
}

export type PiRuntimeOptions = {
  roots: string[]
  sessionFactory?: PiSessionFactory
  now?: () => number
}

type LoadedSession = {
  session: PiSession
  unsubscribe: () => void
  info: PiSessionInfo
  context: PiEventContext
}

type Listener = {
  directory?: string
  callback: (event: RuntimeEvent) => void
}

function sessionKey(directory: string, sessionID: string) {
  return `${directory}\0${sessionID}`
}

function toRuntimeSession(info: PiSessionInfo): RuntimeSession {
  return {
    id: info.id,
    directory: info.directory,
    title: info.title,
    createdAt: info.createdAt,
    updatedAt: info.updatedAt,
  }
}

function textFromPart(part: Record<string, unknown>) {
  return part.type === "text" && typeof part.text === "string" ? part.text : undefined
}

function promptText(input: RuntimePrompt) {
  return input.parts
    .map((part) => textFromPart(part))
    .filter((text): text is string => text !== undefined)
    .join("\n")
}

function persistedMessage(sessionID: string, index: number, value: unknown): RuntimeMessage | undefined {
  if (!value || typeof value !== "object" || !("role" in value) || !("timestamp" in value)) return
  const message = value as Record<string, unknown>
  if (message.role !== "user" && message.role !== "assistant") return
  if (typeof message.timestamp !== "number") return
  const id = `${sessionID}:message:${index + 1}`
  const content = typeof message.content === "string"
    ? [{ type: "text", text: message.content }]
    : Array.isArray(message.content) ? message.content : []
  const parts = content.flatMap((item, partIndex): RuntimePart[] => {
    if (!item || typeof item !== "object" || !("type" in item)) return []
    const part = item as Record<string, unknown>
    if (part.type === "text" && typeof part.text === "string") {
      return [{ id: `${id}:text:${partIndex}`, type: "text", text: part.text }]
    }
    if (part.type === "thinking" && typeof part.thinking === "string") {
      return [{ id: `${id}:reasoning:${partIndex}`, type: "reasoning", text: part.thinking }]
    }
    if (
      part.type === "toolCall" &&
      typeof part.id === "string" &&
      typeof part.name === "string"
    ) {
      return [{
        id: `${sessionID}:tool:${part.id}`,
        type: "tool",
        name: part.name,
        callID: part.id,
        state: "completed",
        input: part.arguments,
      }]
    }
    return []
  })
  return {
    id,
    sessionID,
    role: message.role,
    createdAt: message.timestamp,
    ...(message.role === "assistant" && typeof message.provider === "string" && typeof message.model === "string"
      ? { model: { providerID: message.provider, modelID: message.model } }
      : {}),
    parts,
  }
}

export class PiRuntime implements AgentRuntime {
  private readonly factory: PiSessionFactory
  private readonly now: () => number
  private readonly rootPaths: Promise<string[]>
  private readonly index = new Map<string, PiSessionInfo>()
  private readonly loaded = new Map<string, Promise<LoadedSession>>()
  private readonly promptQueues = new Map<string, Promise<void>>()
  private readonly listeners = new Set<Listener>()

  constructor(options: PiRuntimeOptions) {
    if (options.roots.length === 0) throw new Error("At least one project root is required")
    this.factory = options.sessionFactory ?? new ProductionPiSessionFactory()
    this.now = options.now ?? Date.now
    this.rootPaths = Promise.all(options.roots.map((root) => realpath(resolve(root))))
  }

  private async authorize(directory: string) {
    const target = await realpath(resolve(directory))
    const roots = await this.rootPaths
    const allowed = roots.some((root) => {
      const path = relative(root, target)
      return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))
    })
    if (!allowed) throw new Error(`Project directory is outside configured roots: ${directory}`)
    return target
  }

  private emit(directory: string, event: RuntimeEvent) {
    for (const listener of this.listeners) {
      if (listener.directory === undefined || listener.directory === directory) listener.callback(event)
    }
  }

  private register(directory: string, session: PiSession, info: PiSessionInfo) {
    const key = sessionKey(directory, session.id)
    const context = createPiEventContext(session.id)
    context.nextMessage = session.messages.filter((message) => {
      return !!message && typeof message === "object" && "role" in message &&
        (message.role === "user" || message.role === "assistant")
    }).length + 1
    const loaded = {} as LoadedSession
    const unsubscribe = session.subscribe((event) => {
      if (event.type === "session_info_changed") {
        loaded.info = { ...loaded.info, title: event.name ?? loaded.info.title, updatedAt: this.now() }
        this.index.set(key, loaded.info)
        this.emit(directory, { type: "session", action: "updated", session: toRuntimeSession(loaded.info) })
        return
      }
      for (const translated of translatePiEvent(context, event)) this.emit(directory, translated)
    })
    Object.assign(loaded, { session, unsubscribe, info, context })
    this.index.set(key, info)
    return loaded
  }

  private async load(directory: string, sessionID: string) {
    const key = sessionKey(directory, sessionID)
    let pending = this.loaded.get(key)
    if (!pending) {
      pending = (async () => {
        let info = this.index.get(key)
        if (!info) {
          await this.listSessions(directory)
          info = this.index.get(key)
        }
        if (!info) throw new Error(`Unknown session: ${sessionID}`)
        const session = await this.factory.open(info.path)
        if (session.id !== sessionID || session.directory !== directory) {
          session.dispose()
          throw new Error(`Saved session does not match ${directory}/${sessionID}`)
        }
        return this.register(directory, session, info)
      })()
      this.loaded.set(key, pending)
      pending.catch(() => this.loaded.delete(key))
    }
    return pending
  }

  private async listSessions(directory: string) {
    const infos = await this.factory.list(directory)
    return infos.map((listed) => {
      const key = sessionKey(directory, listed.id)
      const info = this.index.get(key) ?? { ...listed, directory }
      this.index.set(key, info)
      return toRuntimeSession(info)
    })
  }

  project = {
    list: async () => {
      const roots = await this.rootPaths
      return roots.map((directory) => ({ id: directory, name: basename(directory), directory }))
    },
    get: async (directory: string) => {
      const canonical = await this.authorize(directory)
      return { id: canonical, name: basename(canonical), directory: canonical }
    },
  }

  model = {
    list: async (directory: string) => {
      await this.authorize(directory)
      return this.factory.listModels()
    },
  }

  session = {
    create: async (directory: string, input?: Record<string, unknown>) => {
      const canonical = await this.authorize(directory)
      const session = await this.factory.create(canonical)
      if (session.directory !== canonical) {
        session.dispose()
        throw new Error("Created session directory does not match the requested project")
      }
      const timestamp = this.now()
      const info: PiSessionInfo = {
        id: session.id,
        path: session.path,
        directory: canonical,
        title: typeof input?.title === "string" ? input.title : "New session",
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      const key = sessionKey(canonical, session.id)
      const loaded = this.register(canonical, session, info)
      this.loaded.set(key, Promise.resolve(loaded))
      const result = toRuntimeSession(info)
      this.emit(canonical, { type: "session", action: "created", session: result })
      return result
    },
    list: async (directory: string) => this.listSessions(await this.authorize(directory)),
    get: async (directory: string, sessionID: string) => {
      const canonical = await this.authorize(directory)
      const key = sessionKey(canonical, sessionID)
      if (!this.index.has(key)) await this.listSessions(canonical)
      const info = this.index.get(key)
      if (!info) throw new Error(`Unknown session: ${sessionID}`)
      return toRuntimeSession(info)
    },
    messages: async (directory: string, sessionID: string) => {
      const canonical = await this.authorize(directory)
      const loaded = await this.load(canonical, sessionID)
      const messages: RuntimeMessage[] = []
      for (const message of loaded.session.messages) {
        const translated = persistedMessage(sessionID, messages.length, message)
        if (translated) messages.push(translated)
      }
      return messages
    },
    status: async (directory: string): Promise<RuntimeSessionStatus> => {
      const canonical = await this.authorize(directory)
      const sessions = await this.listSessions(canonical)
      return Object.fromEntries(await Promise.all(sessions.map(async ({ id }) => {
        const loaded = this.loaded.get(sessionKey(canonical, id))
        const active = loaded ? await loaded : undefined
        return [id, { type: active?.session.isIdle === false ? "busy" as const : "idle" as const }]
      })))
    },
  }

  async prompt(directory: string, sessionID: string, input: RuntimePrompt) {
    const key = sessionKey(resolve(directory), sessionID)
    const previous = this.promptQueues.get(key) ?? Promise.resolve()
    const pending = previous.catch(() => {}).then(async () => {
      const canonical = await this.authorize(directory)
      const loaded = await this.load(canonical, sessionID)
      if (input.model) {
        const model = await this.factory.getModel(input.model.providerID, input.model.modelID)
        if (!model) throw new Error(`Unknown model: ${input.model.providerID}/${input.model.modelID}`)
        await loaded.session.setModel(model)
      }
      if (input.messageID) queuePiUserMessageID(loaded.context, input.messageID)
      await loaded.session.prompt(promptText(input))
    })
    this.promptQueues.set(key, pending)
    void pending.catch((error: unknown) => {
      this.emit(resolve(directory), {
        type: "error",
        sessionID,
        message: error instanceof Error ? error.message : String(error),
      })
    }).finally(() => {
      if (this.promptQueues.get(key) === pending) this.promptQueues.delete(key)
    })
  }

  async abort(directory: string, sessionID: string) {
    const canonical = await this.authorize(directory)
    const loaded = await this.load(canonical, sessionID)
    await loaded.session.abort()
  }

  event(directory: string | undefined, callback: (event: RuntimeEvent) => void) {
    const listener: Listener = { directory: directory ? resolve(directory) : undefined, callback }
    this.listeners.add(listener)
    if (directory) void realpath(resolve(directory)).then((canonical) => { listener.directory = canonical }).catch(() => {})
    return () => this.listeners.delete(listener)
  }

  async dispose() {
    const loaded = await Promise.all([...this.loaded.values()].map((session) => session.catch(() => undefined)))
    for (const item of loaded) {
      if (!item) continue
      item.unsubscribe()
      item.session.dispose()
    }
    this.loaded.clear()
    this.promptQueues.clear()
    this.listeners.clear()
  }
}

class ProductionPiSessionFactory implements PiSessionFactory {
  private readonly runtime = ModelRuntime.create()

  private async createWithManager(directory: string, manager: SessionManager): Promise<PiSession> {
    const modelRuntime = await this.runtime
    const resourceLoader = new DefaultResourceLoader({ cwd: directory, agentDir: getAgentDir() })
    await resourceLoader.reload()
    const { session } = await createAgentSession({
      cwd: directory,
      modelRuntime,
      resourceLoader,
      sessionManager: manager,
    })
    const path = session.sessionFile
    if (!path) {
      session.dispose()
      throw new Error("Pi did not create a persistent session file")
    }
    return {
      id: session.sessionId,
      path,
      directory,
      get messages() { return session.messages },
      get isIdle() { return session.isIdle },
      subscribe: (listener) => session.subscribe(listener),
      setModel: (model) => session.setModel(model as Parameters<typeof session.setModel>[0]),
      prompt: (text) => session.prompt(text),
      abort: () => session.abort(),
      dispose: () => session.dispose(),
    }
  }

  async list(directory: string) {
    const sessions = await SessionManager.list(directory)
    return sessions.map((session) => ({
      id: session.id,
      path: session.path,
      directory,
      title: session.name || session.firstMessage || "New session",
      createdAt: session.created.getTime(),
      updatedAt: session.modified.getTime(),
    }))
  }

  async create(directory: string) {
    return this.createWithManager(directory, SessionManager.create(directory))
  }

  async open(path: string) {
    const manager = SessionManager.open(path)
    return this.createWithManager(manager.getCwd(), manager)
  }

  async listModels() {
    const models = await (await this.runtime).getAvailable()
    return models.map((model) => ({ id: model.id, providerID: model.provider, name: model.name }))
  }

  getModel(providerID: string, modelID: string) {
    return this.runtime.then((runtime) => runtime.getModel(providerID, modelID))
  }
}
