import type {
  RuntimeEvent,
  RuntimeMessage,
  RuntimeModel,
  RuntimePart,
  RuntimeProject,
  RuntimeSession,
} from "./protocol"

const emptyTokens = () => ({
  input: 0,
  output: 0,
  reasoning: 0,
  cache: { read: 0, write: 0 },
})

function modelReference(model?: RuntimeMessage["model"]) {
  return model ?? { providerID: "unknown", modelID: "unknown" }
}

function toText(value: unknown) {
  if (typeof value === "string") return value
  if (value === undefined) return ""
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function toInput(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export function toOpenCodeProviderList(models: RuntimeModel[]) {
  const providers = new Map<string, {
    id: string
    name: string
    source: "custom"
    env: string[]
    options: Record<string, unknown>
    models: Record<string, unknown>
  }>()
  const defaults: Record<string, string> = {}

  for (const model of models) {
    let provider = providers.get(model.providerID)
    if (!provider) {
      provider = {
        id: model.providerID,
        name: model.providerID,
        source: "custom",
        env: [],
        options: {},
        models: {},
      }
      providers.set(model.providerID, provider)
      defaults[model.providerID] = model.id
    }
    provider.models[model.id] = {
      id: model.id,
      providerID: model.providerID,
      api: { id: model.id, url: "", npm: "" },
      name: model.name,
      capabilities: {
        temperature: false,
        reasoning: false,
        attachment: false,
        toolcall: true,
        input: { text: true, audio: false, image: false, video: false, pdf: false },
        output: { text: true, audio: false, image: false, video: false, pdf: false },
        interleaved: false,
      },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 0, output: 0 },
      status: "active",
      options: {},
      headers: {},
      release_date: "",
      variants: {},
    }
  }

  return {
    all: [...providers.values()],
    connected: [...providers.keys()],
    default: defaults,
  }
}

export function toOpenCodeAgents(models: RuntimeModel[]) {
  const model = models[0]
  return [{
    name: "build",
    description: "Build with Pi",
    mode: "primary" as const,
    native: true,
    hidden: false,
    permission: [],
    ...(model ? { model: { providerID: model.providerID, modelID: model.id } } : {}),
    options: {},
  }]
}

export function toOpenCodeProject(project: RuntimeProject) {
  return {
    id: project.id,
    name: project.name,
    worktree: project.directory,
    time: { created: 0, updated: 0 },
    sandboxes: [],
  }
}

export function toOpenCodeSession(session: RuntimeSession) {
  return {
    id: session.id,
    slug: session.id,
    projectID: session.directory,
    directory: session.directory,
    title: session.title,
    version: "pi",
    time: { created: session.createdAt, updated: session.updatedAt },
  }
}

export function toOpenCodePart(
  part: RuntimePart,
  sessionID: string,
  messageID: string,
  timestamp = 0,
) {
  const common = { id: part.id, sessionID, messageID }
  if (part.type === "text") return { ...common, type: "text" as const, text: part.text }
  if (part.type === "reasoning") {
    return { ...common, type: "reasoning" as const, text: part.text, time: { start: timestamp } }
  }

  const input = toInput(part.input)
  const state = (() => {
    if (part.state === "pending") return { status: "pending" as const, input, raw: "" }
    if (part.state === "running") {
      return { status: "running" as const, input, title: part.name, metadata: {}, time: { start: timestamp } }
    }
    if (part.state === "error") {
      return {
        status: "error" as const,
        input,
        error: part.error ?? toText(part.output),
        metadata: {},
        time: { start: timestamp, end: timestamp },
      }
    }
    return {
      status: "completed" as const,
      input,
      output: toText(part.output),
      title: part.name,
      metadata: {},
      time: { start: timestamp, end: timestamp },
    }
  })()
  return { ...common, type: "tool" as const, callID: part.callID, tool: part.name, state }
}

export function toOpenCodeMessage(
  message: RuntimeMessage,
  directory: string,
  parentID?: string,
) {
  const model = modelReference(message.model)
  if (message.role === "user") {
    return {
      id: message.id,
      sessionID: message.sessionID,
      role: "user" as const,
      time: { created: message.createdAt },
      agent: "build",
      model,
    }
  }
  return {
    id: message.id,
    sessionID: message.sessionID,
    role: "assistant" as const,
    time: { created: message.createdAt },
    parentID: parentID ?? `${message.id}:parent`,
    modelID: model.modelID,
    providerID: model.providerID,
    mode: "build",
    agent: "build",
    path: { cwd: directory, root: directory },
    cost: 0,
    tokens: emptyTokens(),
  }
}

export function toOpenCodeMessages(messages: RuntimeMessage[], directory: string) {
  let lastUserID: string | undefined
  return messages.map((message) => {
    if (message.role === "user") lastUserID = message.id
    return {
      info: toOpenCodeMessage(message, directory, lastUserID),
      parts: message.parts.map((part) =>
        toOpenCodePart(part, message.sessionID, message.id, message.createdAt)
      ),
    }
  })
}

export function createOpenCodeEventMapper() {
  let nextID = 1
  const lastUser = new Map<string, string>()

  return (directory: string, event: RuntimeEvent) => {
    const id = `pi-event-${nextID++}`
    let payload: Record<string, unknown>

    if (event.type === "session") {
      payload = {
        id,
        type: `session.${event.action}`,
        properties: { sessionID: event.session.id, info: toOpenCodeSession(event.session) },
      }
    } else if (event.type === "status") {
      payload = {
        id,
        type: "session.status",
        properties: { sessionID: event.sessionID, status: { type: event.status } },
      }
    } else if (event.type === "message") {
      if (event.message.role === "user") lastUser.set(event.message.sessionID, event.message.id)
      payload = {
        id,
        type: "message.updated",
        properties: {
          sessionID: event.message.sessionID,
          info: toOpenCodeMessage(
            event.message,
            directory,
            lastUser.get(event.message.sessionID),
          ),
        },
      }
    } else if (event.type === "part") {
      payload = {
        id,
        type: "message.part.updated",
        properties: {
          sessionID: event.sessionID,
          part: toOpenCodePart(event.part, event.sessionID, event.messageID, Date.now()),
          time: Date.now(),
        },
      }
    } else if (event.type === "delta") {
      payload = {
        id,
        type: "message.part.delta",
        properties: {
          sessionID: event.sessionID,
          messageID: event.messageID,
          partID: event.partID,
          field: event.field,
          delta: event.delta,
        },
      }
    } else {
      payload = {
        id,
        type: "session.error",
        properties: {
          ...(event.sessionID ? { sessionID: event.sessionID } : {}),
          error: { name: "UnknownError", data: { message: event.message } },
        },
      }
    }

    return { directory, payload }
  }
}
