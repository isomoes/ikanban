import { Binary } from "@/utils/binary"
import { produce, reconcile, type SetStoreFunction, type Store } from "solid-js/store"
import type {
  Message,
  Part,
  PermissionRequest,
  Project,
  Session,
  Todo,
  V2Event,
} from "@/types/opencode"
import type { State, VcsCache } from "./types"
import { trimSessions } from "./session-trim"

const emptyTokens = () => ({ input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } })

function cleanupSessionCaches(
  store: Store<State>,
  setStore: SetStoreFunction<State>,
  sessionID: string,
  setSessionTodo?: (sessionID: string, todos: Todo[] | undefined) => void,
) {
  if (!sessionID) return
  const hasAny =
    store.message[sessionID] !== undefined ||
    store.session_diff[sessionID] !== undefined ||
    store.todo[sessionID] !== undefined ||
    store.permission[sessionID] !== undefined ||
    store.question[sessionID] !== undefined ||
    store.session_status[sessionID] !== undefined
  setSessionTodo?.(sessionID, undefined)
  if (!hasAny) return
  setStore(
    produce((draft) => {
      for (const message of draft.message[sessionID] ?? []) delete draft.part[message.id]
      delete draft.message[sessionID]
      delete draft.session_diff[sessionID]
      delete draft.todo[sessionID]
      delete draft.permission[sessionID]
      delete draft.question[sessionID]
      delete draft.session_status[sessionID]
    }),
  )
}

function createdSession(event: Extract<V2Event, { type: "session.created" }>): Session {
  const data = event.data
  return {
    id: data.sessionID,
    slug: data.slug,
    projectID: data.projectID,
    workspaceID: data.location.workspaceID,
    directory: data.location.directory,
    path: data.subpath,
    parentID: data.parentID,
    title: data.title ?? data.slug,
    agent: data.agent,
    model: data.model,
    version: data.version,
    time: { created: event.created, updated: event.created },
  }
}

function nativePermission(data: Extract<V2Event, { type: "permission.asked" }>["data"]): PermissionRequest {
  return {
    id: data.id,
    sessionID: data.sessionID,
    permission: data.action,
    patterns: data.resources,
    metadata: data.metadata ?? {},
    always: data.save ?? [],
    tool: data.source && { messageID: data.source.messageID, callID: data.source.id },
  }
}

function upsertMessage(store: Store<State>, setStore: SetStoreFunction<State>, message: Message) {
  const messages = store.message[message.sessionID]
  if (!messages) {
    setStore("message", message.sessionID, [message])
    return
  }
  const result = Binary.search(messages, message.id, (item) => item.id)
  if (result.found) {
    setStore("message", message.sessionID, result.index, reconcile(message))
    return
  }
  setStore(
    "message",
    message.sessionID,
    produce((draft) => void draft.splice(result.index, 0, message)),
  )
}

function upsertPart(store: Store<State>, setStore: SetStoreFunction<State>, part: Part) {
  const parts = store.part[part.messageID]
  if (!parts) {
    setStore("part", part.messageID, [part])
    return
  }
  const result = Binary.search(parts, part.id, (item) => item.id)
  if (result.found) {
    setStore("part", part.messageID, result.index, reconcile(part))
    return
  }
  setStore(
    "part",
    part.messageID,
    produce((draft) => void draft.splice(result.index, 0, part)),
  )
}

function updatePart(
  store: Store<State>,
  setStore: SetStoreFunction<State>,
  messageID: string,
  partID: string,
  update: (part: Part) => Part,
) {
  const parts = store.part[messageID]
  if (!parts) return
  const result = Binary.search(parts, partID, (part) => part.id)
  if (!result.found) return
  setStore("part", messageID, result.index, reconcile(update(parts[result.index]!)))
}

function textPartID(messageID: string, type: "text" | "reasoning", ordinal: number) {
  return `${messageID}:${type}:${ordinal}`
}

function toolPartID(messageID: string, id: string) {
  return `${messageID}:tool:${id}`
}

function structuredError(error: { type: string; message: string; status?: number }) {
  return { name: error.type, data: { message: error.message, status: error.status } }
}

export function applyGlobalEvent(input: {
  event: V2Event
  project: Project[]
  setGlobalProject: (next: Project[] | ((draft: Project[]) => void)) => void
  refresh: () => void
}) {
  if (
    input.event.type === "server.connected" ||
    input.event.type === "project.directories.updated" ||
    input.event.type === "catalog.updated" ||
    input.event.type === "config.updated"
  ) {
    input.refresh()
  }
}

export function applyDirectoryEvent(input: {
  event: V2Event
  store: Store<State>
  setStore: SetStoreFunction<State>
  push: (directory: string) => void
  directory: string
  vcsCache?: VcsCache
  setSessionTodo?: (sessionID: string, todos: Todo[] | undefined) => void
}) {
  const event = input.event
  switch (event.type) {
    case "server.connected":
    case "project.directories.updated":
    case "config.updated":
    case "catalog.updated": {
      input.push(input.directory)
      return
    }
    case "session.created": {
      const info = createdSession(event)
      const result = Binary.search(input.store.session, info.id, (session) => session.id)
      if (result.found) {
        input.setStore("session", result.index, reconcile(info))
        return
      }
      const next = input.store.session.slice()
      next.splice(result.index, 0, info)
      const trimmed = trimSessions(next, { limit: input.store.limit, permission: input.store.permission })
      input.setStore("session", reconcile(trimmed, { key: "id" }))
      if (!info.parentID) input.setStore("sessionTotal", (value) => value + 1)
      return
    }
    case "session.deleted": {
      const result = Binary.search(input.store.session, event.data.sessionID, (session) => session.id)
      const info = result.found ? input.store.session[result.index] : undefined
      if (result.found) {
        input.setStore(
          "session",
          produce((draft) => void draft.splice(result.index, 1)),
        )
      }
      cleanupSessionCaches(input.store, input.setStore, event.data.sessionID, input.setSessionTodo)
      if (info && !info.parentID) input.setStore("sessionTotal", (value) => Math.max(0, value - 1))
      return
    }
    case "session.renamed":
    case "session.agent.selected":
    case "session.model.selected":
    case "session.usage.updated": {
      const result = Binary.search(input.store.session, event.data.sessionID, (session) => session.id)
      if (!result.found) return
      input.setStore("session", result.index, (session) => ({
        ...session,
        ...(event.type === "session.renamed" ? { title: event.data.title } : {}),
        ...(event.type === "session.agent.selected" ? { agent: event.data.agent } : {}),
        ...(event.type === "session.model.selected" ? { model: event.data.model } : {}),
        ...(event.type === "session.usage.updated" ? { cost: event.data.cost, tokens: event.data.tokens } : {}),
        time: { ...session.time, updated: event.created },
      }))
      return
    }
    case "session.moved": {
      const result = Binary.search(input.store.session, event.data.sessionID, (session) => session.id)
      if (!result.found) return
      if (event.data.location.directory !== input.directory) {
        const info = input.store.session[result.index]
        input.setStore(
          "session",
          produce((draft) => void draft.splice(result.index, 1)),
        )
        if (!info?.parentID) input.setStore("sessionTotal", (value) => Math.max(0, value - 1))
        return
      }
      input.setStore("session", result.index, (session) => ({
        ...session,
        directory: event.data.location.directory,
        workspaceID: event.data.location.workspaceID,
        projectID: event.data.projectID ?? session.projectID,
        path: event.data.subpath,
        time: { ...session.time, updated: event.created },
      }))
      return
    }
    case "session.status": {
      input.setStore("session_status", event.data.sessionID, reconcile(event.data.status))
      if (event.data.status.type === "idle") {
        input.setStore(
          produce((draft) => {
            delete draft.session_diff[event.data.sessionID]
            delete draft.project_diff[input.directory]
          }),
        )
        input.push(input.directory)
      }
      return
    }
    case "session.input.admitted": {
      if (event.data.input.type !== "user") return
      upsertMessage(input.store, input.setStore, {
        id: event.data.inputID,
        sessionID: event.data.sessionID,
        role: "user",
        time: { created: event.created },
        agent: "",
        model: { providerID: "", modelID: "" },
      })
      upsertPart(input.store, input.setStore, {
        id: `${event.data.inputID}:text`,
        sessionID: event.data.sessionID,
        messageID: event.data.inputID,
        type: "text",
        text: event.data.input.data.text,
        metadata: event.data.input.data.metadata,
      })
      return
    }
    case "session.step.started": {
      const messages = input.store.message[event.data.sessionID] ?? []
      const parent = [...messages].reverse().find((message) => message.role === "user")
      upsertMessage(input.store, input.setStore, {
        id: event.data.assistantMessageID,
        sessionID: event.data.sessionID,
        role: "assistant",
        time: { created: event.created },
        parentID: parent?.id ?? "",
        modelID: event.data.model.id,
        providerID: event.data.model.providerID,
        mode: event.data.agent,
        agent: event.data.agent,
        path: { cwd: input.directory, root: input.directory },
        cost: 0,
        tokens: emptyTokens(),
        variant: event.data.model.variant,
      })
      return
    }
    case "session.step.ended": {
      const messages = input.store.message[event.data.sessionID]
      const index = messages?.findIndex((message) => message.id === event.data.assistantMessageID) ?? -1
      if (index < 0) return
      input.setStore("message", event.data.sessionID, index, (message) =>
        message.role === "assistant"
          ? {
              ...message,
              time: { ...message.time, completed: event.created },
              finish: event.data.finish,
              cost: event.data.cost,
              tokens: event.data.tokens,
            }
          : message,
      )
      return
    }
    case "session.execution.failed":
    case "session.step.failed": {
      const messages = input.store.message[event.data.sessionID]
      const messageID = event.type === "session.step.failed" ? event.data.assistantMessageID : undefined
      const index = messageID
        ? (messages?.findIndex((message) => message.id === messageID) ?? -1)
        : (messages?.findLastIndex((message) => message.role === "assistant") ?? -1)
      if (!messages || index < 0) return
      input.setStore("message", event.data.sessionID, index, (message) =>
        message.role === "assistant"
          ? { ...message, time: { ...message.time, completed: event.created }, error: structuredError(event.data.error) }
          : message,
      )
      return
    }
    case "session.text.started":
    case "session.reasoning.started": {
      const type = event.type === "session.text.started" ? "text" : "reasoning"
      const id = textPartID(event.data.assistantMessageID, type, event.data.ordinal)
      const base = {
        id,
        sessionID: event.data.sessionID,
        messageID: event.data.assistantMessageID,
        type,
        text: "",
      } as Part
      upsertPart(
        input.store,
        input.setStore,
        type === "reasoning"
          ? {
              ...base,
              time: { start: event.created },
              metadata: event.type === "session.reasoning.started" ? event.data.state : undefined,
            } as Part
          : base,
      )
      return
    }
    case "session.text.delta":
    case "session.reasoning.delta": {
      const type = event.type === "session.text.delta" ? "text" : "reasoning"
      const id = textPartID(event.data.assistantMessageID, type, event.data.ordinal)
      const parts = input.store.part[event.data.assistantMessageID]
      if (!parts?.some((part) => part.id === id)) {
        upsertPart(input.store, input.setStore, {
          id,
          sessionID: event.data.sessionID,
          messageID: event.data.assistantMessageID,
          type,
          text: "",
          ...(type === "reasoning" ? { time: { start: event.created } } : {}),
        } as Part)
      }
      updatePart(input.store, input.setStore, event.data.assistantMessageID, id, (part) =>
        part.type === type ? { ...part, text: part.text + event.data.delta } : part,
      )
      return
    }
    case "session.text.ended":
    case "session.reasoning.ended": {
      const type = event.type === "session.text.ended" ? "text" : "reasoning"
      const id = textPartID(event.data.assistantMessageID, type, event.data.ordinal)
      const previous = input.store.part[event.data.assistantMessageID]?.find((part) => part.id === id)
      const base = {
        id,
        sessionID: event.data.sessionID,
        messageID: event.data.assistantMessageID,
        type,
        text: event.data.text,
        metadata: event.data.state,
      } as Part
      upsertPart(
        input.store,
        input.setStore,
        type === "reasoning"
          ? ({
              ...base,
              time: { start: previous?.type === "reasoning" ? previous.time.start : event.created, end: event.created },
            } as Part)
          : base,
      )
      return
    }
    case "session.tool.input.started": {
      upsertPart(input.store, input.setStore, {
        id: toolPartID(event.data.assistantMessageID, event.data.id),
        sessionID: event.data.sessionID,
        messageID: event.data.assistantMessageID,
        type: "tool",
        callID: event.data.id,
        tool: event.data.name,
        state: { status: "pending", input: {}, raw: "" },
      })
      return
    }
    case "session.tool.input.delta": {
      updatePart(
        input.store,
        input.setStore,
        event.data.assistantMessageID,
        toolPartID(event.data.assistantMessageID, event.data.id),
        (part) =>
          part.type === "tool" && part.state.status === "pending"
            ? { ...part, state: { ...part.state, raw: part.state.raw + event.data.delta } }
            : part,
      )
      return
    }
    case "session.tool.called": {
      updatePart(
        input.store,
        input.setStore,
        event.data.assistantMessageID,
        toolPartID(event.data.assistantMessageID, event.data.id),
        (part) =>
          part.type === "tool"
            ? {
                ...part,
                state: { status: "running", input: event.data.input, metadata: {}, time: { start: event.created } },
              }
            : part,
      )
      return
    }
    case "session.tool.progress": {
      updatePart(
        input.store,
        input.setStore,
        event.data.assistantMessageID,
        toolPartID(event.data.assistantMessageID, event.data.id),
        (part) =>
          part.type === "tool" && part.state.status === "running"
            ? { ...part, state: { ...part.state, metadata: event.data.metadata } }
            : part,
      )
      return
    }
    case "session.tool.success":
    case "session.tool.failed": {
      updatePart(
        input.store,
        input.setStore,
        event.data.assistantMessageID,
        toolPartID(event.data.assistantMessageID, event.data.id),
        (part) => {
          if (part.type !== "tool") return part
          const inputValue = part.state.input
          const start = "time" in part.state ? part.state.time.start : event.created
          if (event.type === "session.tool.failed") {
            return {
              ...part,
              state: {
                status: "error",
                input: inputValue,
                error: event.data.error.message,
                metadata: event.data.metadata,
                time: { start, end: event.created },
              },
            }
          }
          return {
            ...part,
            state: {
              status: "completed",
              input: inputValue,
              output: event.data.content.flatMap((content) => (content.type === "text" ? [content.text] : [])).join("\n"),
              title: part.tool,
              metadata: event.data.metadata ?? {},
              time: { start, end: event.created },
            },
          }
        },
      )
      return
    }
    case "vcs.branch.updated": {
      if (input.store.vcs?.branch === event.data.branch) return
      const next = { ...input.store.vcs, branch: event.data.branch }
      input.setStore("vcs", next)
      input.vcsCache?.setStore("value", next)
      return
    }
    case "permission.asked": {
      const permission = nativePermission(event.data)
      const permissions = input.store.permission[permission.sessionID]
      if (!permissions) {
        input.setStore("permission", permission.sessionID, [permission])
        return
      }
      const result = Binary.search(permissions, permission.id, (item) => item.id)
      if (result.found) {
        input.setStore("permission", permission.sessionID, result.index, reconcile(permission))
        return
      }
      input.setStore(
        "permission",
        permission.sessionID,
        produce((draft) => void draft.splice(result.index, 0, permission)),
      )
      return
    }
    case "permission.replied": {
      const permissions = input.store.permission[event.data.sessionID]
      if (!permissions) return
      const result = Binary.search(permissions, event.data.requestID, (item) => item.id)
      if (!result.found) return
      input.setStore(
        "permission",
        event.data.sessionID,
        produce((draft) => void draft.splice(result.index, 1)),
      )
      return
    }
    case "question.asked": {
      const question = event.data
      const questions = input.store.question[question.sessionID]
      if (!questions) {
        input.setStore("question", question.sessionID, [question])
        return
      }
      const result = Binary.search(questions, question.id, (item) => item.id)
      if (result.found) {
        input.setStore("question", question.sessionID, result.index, reconcile(question))
        return
      }
      input.setStore(
        "question",
        question.sessionID,
        produce((draft) => void draft.splice(result.index, 0, question)),
      )
      return
    }
    case "question.replied":
    case "question.rejected": {
      const questions = input.store.question[event.data.sessionID]
      if (!questions) return
      const result = Binary.search(questions, event.data.requestID, (item) => item.id)
      if (!result.found) return
      input.setStore(
        "question",
        event.data.sessionID,
        produce((draft) => void draft.splice(result.index, 1)),
      )
      return
    }
  }
}
