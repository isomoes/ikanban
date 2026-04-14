import { Identifier } from "@/utils/id"

export type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

type StoredNodeSessionEntry = {
  sessionID: string
  finished: boolean
}

type StoredNodeSessions = Record<string, StoredNodeSessionEntry>

type StartNodeTaskSessionInput = {
  storage: BrowserStorage
  directory: string
  taskPath: string
  nodeID: string
  agent: string
  model: { providerID: string; modelID: string }
  variant?: string
  readPrompt: (path: string) => Promise<string>
  createSession: () => Promise<{ id: string }>
  promptSession: (input: {
    sessionID: string
    agent: string
    model: { providerID: string; modelID: string }
    variant?: string
    parts: Array<{ id: string; type: "text"; text: string }>
  }) => Promise<void>
  navigateToSession: (sessionID: string) => void
}

function storageName(directory: string) {
  return `ikanban.node-sessions:${directory}`
}

export function nodeTaskSessionKey(taskPath: string, nodeID: string) {
  return `${taskPath}#${nodeID}`
}

function loadStoredNodeSessions(storage: BrowserStorage, directory: string): StoredNodeSessions {
  const raw = storage.getItem(storageName(directory))
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return {}

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, value]) => {
        if (typeof key !== "string") return []
        if (typeof value === "string") return [[key, { sessionID: value, finished: false }] satisfies [string, StoredNodeSessionEntry]]
        if (!value || typeof value !== "object") return []
        const entry = value as { sessionID?: unknown; finished?: unknown }
        if (typeof entry.sessionID !== "string") return []
        return [[key, { sessionID: entry.sessionID, finished: entry.finished === true }] satisfies [string, StoredNodeSessionEntry]]
      }),
    )
  } catch {
    return {}
  }
}

function saveStoredNodeSessions(storage: BrowserStorage, directory: string, sessions: StoredNodeSessions) {
  if (Object.keys(sessions).length === 0) {
    storage.removeItem(storageName(directory))
    return
  }

  storage.setItem(storageName(directory), JSON.stringify(sessions))
}

export function nodeTaskPromptPath(taskPath: string, nodeID: string) {
  return taskPath.replace(/\/task\.yaml$/, `/${nodeID}.md`)
}

export function getStoredNodeTaskSession(storage: BrowserStorage, directory: string, taskPath: string, nodeID: string) {
  return loadStoredNodeSessions(storage, directory)[nodeTaskSessionKey(taskPath, nodeID)]?.sessionID
}

export function getStoredNodeTaskFinished(storage: BrowserStorage, directory: string, taskPath: string, nodeID: string) {
  return loadStoredNodeSessions(storage, directory)[nodeTaskSessionKey(taskPath, nodeID)]?.finished === true
}

export function setStoredNodeTaskSession(
  storage: BrowserStorage,
  directory: string,
  taskPath: string,
  nodeID: string,
  sessionID: string | undefined,
) {
  const sessions = loadStoredNodeSessions(storage, directory)
  const key = nodeTaskSessionKey(taskPath, nodeID)

  if (sessionID) sessions[key] = { sessionID, finished: false }
  else delete sessions[key]

  saveStoredNodeSessions(storage, directory, sessions)
}

export function setStoredNodeTaskFinished(
  storage: BrowserStorage,
  directory: string,
  taskPath: string,
  nodeID: string,
  finished: boolean,
) {
  const sessions = loadStoredNodeSessions(storage, directory)
  const key = nodeTaskSessionKey(taskPath, nodeID)
  const current = sessions[key]
  if (!current) return

  sessions[key] = { ...current, finished }

  saveStoredNodeSessions(storage, directory, sessions)
}

export async function startNodeTaskSession(input: StartNodeTaskSessionInput) {
  const existingSessionID = getStoredNodeTaskSession(input.storage, input.directory, input.taskPath, input.nodeID)
  if (existingSessionID) {
    input.navigateToSession(existingSessionID)
    return { created: false, sessionID: existingSessionID }
  }

  const prompt = (await input.readPrompt(nodeTaskPromptPath(input.taskPath, input.nodeID))).trim()
  if (!prompt) throw new Error("Task prompt is empty")

  const session = await input.createSession()

  setStoredNodeTaskSession(input.storage, input.directory, input.taskPath, input.nodeID, session.id)
  input.navigateToSession(session.id)

  try {
    await input.promptSession({
      sessionID: session.id,
      agent: input.agent,
      model: input.model,
      variant: input.variant,
      parts: [{ id: Identifier.ascending("part"), type: "text", text: prompt }],
    })
  } catch (error) {
    setStoredNodeTaskSession(input.storage, input.directory, input.taskPath, input.nodeID, undefined)
    throw error
  }

  return { created: true, sessionID: session.id }
}
