import { Binary } from "@/utils/binary"
import { produce, reconcile, type SetStoreFunction, type Store } from "solid-js/store"
import type { PermissionRequest, Project, SessionInfo, SessionMessageInfo, V2Event } from "@opencode-ai/client"
import type { TodoItem } from "@/types/app"
import type { State, VcsCache } from "./types"
import { trimSessions } from "./session-trim"

const emptyTokens = () => ({ input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } })

function cleanupSessionCaches(
  store: Store<State>,
  setStore: SetStoreFunction<State>,
  sessionID: string,
  setSessionTodo?: (sessionID: string, todos: TodoItem[] | undefined) => void,
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
      delete draft.message[sessionID]
      delete draft.session_diff[sessionID]
      delete draft.todo[sessionID]
      delete draft.permission[sessionID]
      delete draft.question[sessionID]
      delete draft.session_status[sessionID]
    }),
  )
}

function createdSession(event: Extract<V2Event, { type: "session.created" }>): SessionInfo {
  const data = event.data
  return {
    id: data.sessionID,
    projectID: data.projectID,
    location: data.location,
    subpath: data.subpath,
    parentID: data.parentID,
    title: data.title,
    agent: data.agent,
    model: data.model,
    cost: 0,
    tokens: emptyTokens(),
    time: { created: event.created, updated: event.created },
  }
}

function upsertMessage(store: Store<State>, setStore: SetStoreFunction<State>, sessionID: string, message: SessionMessageInfo) {
  const messages = store.message[sessionID]
  if (!messages) {
    setStore("message", sessionID, [message])
    return
  }
  const result = Binary.search(messages, message.id, (item) => item.id)
  if (result.found) {
    setStore("message", sessionID, result.index, reconcile(message))
    return
  }
  setStore(
    "message",
    sessionID,
    produce((draft) => void draft.splice(result.index, 0, message)),
  )
}

type AssistantMessage = Extract<SessionMessageInfo, { type: "assistant" }>
type AssistantContent = AssistantMessage["content"][number]

function updateAssistant(
  store: Store<State>,
  setStore: SetStoreFunction<State>,
  sessionID: string,
  messageID: string,
  update: (message: AssistantMessage) => AssistantMessage,
) {
  const messages = store.message[sessionID]
  const index = messages?.findIndex((message) => message.id === messageID) ?? -1
  if (!messages || index < 0) return
  const message = messages[index]
  if (message?.type !== "assistant") return
  setStore("message", sessionID, index, reconcile(update(message)))
}

function updateTextContent(
  message: AssistantMessage,
  type: "text" | "reasoning",
  ordinal: number,
  update: (content: Extract<AssistantContent, { type: typeof type }> | undefined) => Extract<AssistantContent, { type: typeof type }>,
) {
  const content = message.content.slice()
  const matches = content.flatMap((item, index) => item.type === type ? [index] : [])
  const index = matches[ordinal]
  if (index === undefined) content.push(update(undefined))
  if (index !== undefined) content[index] = update(content[index] as Extract<AssistantContent, { type: typeof type }>)
  return { ...message, content }
}

function updateToolContent(
  message: AssistantMessage,
  id: string,
  update: (content: Extract<AssistantContent, { type: "tool" }> | undefined) => Extract<AssistantContent, { type: "tool" }>,
) {
  const content = message.content.slice()
  const index = content.findIndex((item) => item.type === "tool" && item.id === id)
  if (index < 0) content.push(update(undefined))
  if (index >= 0) content[index] = update(content[index] as Extract<AssistantContent, { type: "tool" }>)
  return { ...message, content }
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
  setSessionTodo?: (sessionID: string, todos: TodoItem[] | undefined) => void
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
        location: event.data.location,
        projectID: event.data.projectID ?? session.projectID,
        subpath: event.data.subpath,
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
      upsertMessage(input.store, input.setStore, event.data.sessionID, {
        id: event.data.inputID,
        type: "user",
        time: { created: event.created },
        text: event.data.input.data.text,
        files: event.data.input.data.files,
        agents: event.data.input.data.agents,
        skills: event.data.input.data.skills,
        metadata: event.data.input.data.metadata,
      })
      return
    }
    case "session.step.started": {
      const messages = input.store.message[event.data.sessionID] ?? []
      upsertMessage(input.store, input.setStore, event.data.sessionID, {
        id: event.data.assistantMessageID,
        type: "assistant",
        time: { created: event.created },
        agent: event.data.agent,
        model: event.data.model,
        content: [],
        cost: 0,
        tokens: emptyTokens(),
      })
      return
    }
    case "session.step.ended": {
      const messages = input.store.message[event.data.sessionID]
      const index = messages?.findIndex((message) => message.id === event.data.assistantMessageID) ?? -1
      if (index < 0) return
      input.setStore("message", event.data.sessionID, index, (message) =>
        message.type === "assistant"
          ? {
              ...message,
              time: { ...message.time, completed: event.created },
              finish: event.data.finish as Extract<SessionMessageInfo, { type: "assistant" }>["finish"],
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
        : (messages?.findLastIndex((message) => message.type === "assistant") ?? -1)
      if (!messages || index < 0) return
      input.setStore("message", event.data.sessionID, index, (message) =>
        message.type === "assistant"
          ? { ...message, time: { ...message.time, completed: event.created }, error: event.data.error }
          : message,
      )
      return
    }
    case "session.text.started":
    case "session.reasoning.started": {
      const type = event.type === "session.text.started" ? "text" : "reasoning"
      updateAssistant(input.store, input.setStore, event.data.sessionID, event.data.assistantMessageID, (message) =>
        updateTextContent(message, type, event.data.ordinal, () =>
          event.type === "session.reasoning.started"
            ? { type: "reasoning", text: "", state: event.data.state, time: { created: event.created } }
            : { type, text: "" },
        ),
      )
      return
    }
    case "session.text.delta":
    case "session.reasoning.delta": {
      const type = event.type === "session.text.delta" ? "text" : "reasoning"
      updateAssistant(input.store, input.setStore, event.data.sessionID, event.data.assistantMessageID, (message) =>
        updateTextContent(message, type, event.data.ordinal, (content) => ({
          ...(content ?? (type === "reasoning" ? { type, time: { created: event.created } } : { type })),
          text: (content?.text ?? "") + event.data.delta,
        })),
      )
      return
    }
    case "session.text.ended":
    case "session.reasoning.ended": {
      const type = event.type === "session.text.ended" ? "text" : "reasoning"
      updateAssistant(input.store, input.setStore, event.data.sessionID, event.data.assistantMessageID, (message) =>
        updateTextContent(message, type, event.data.ordinal, (content) =>
          type === "reasoning"
            ? {
                type,
                text: event.data.text,
                state: event.data.state,
                time: { created: content?.type === "reasoning" ? (content.time?.created ?? event.created) : event.created, completed: event.created },
              }
            : { type, text: event.data.text, state: event.data.state },
        ),
      )
      return
    }
    case "session.tool.input.started": {
      updateAssistant(input.store, input.setStore, event.data.sessionID, event.data.assistantMessageID, (message) =>
        updateToolContent(message, event.data.id, () => ({
          type: "tool",
          id: event.data.id,
          name: event.data.name,
          state: { status: "streaming", input: "" },
          time: { created: event.created },
        })),
      )
      return
    }
    case "session.tool.input.delta": {
      updateAssistant(input.store, input.setStore, event.data.sessionID, event.data.assistantMessageID, (message) =>
        updateToolContent(message, event.data.id, (content) => ({
          ...(content ?? { type: "tool", id: event.data.id, name: "tool", time: { created: event.created } }),
          state: {
            status: "streaming",
            input: (content?.state.status === "streaming" ? content.state.input : "") + event.data.delta,
          },
        })),
      )
      return
    }
    case "session.tool.called": {
      updateAssistant(input.store, input.setStore, event.data.sessionID, event.data.assistantMessageID, (message) =>
        updateToolContent(message, event.data.id, (content) => ({
          ...(content ?? { type: "tool", id: event.data.id, name: "tool", time: { created: event.created } }),
          executed: event.data.executed,
          state: { status: "running", input: event.data.input, metadata: {} },
          time: { ...(content?.time ?? { created: event.created }), ran: event.created },
        })),
      )
      return
    }
    case "session.tool.progress": {
      updateAssistant(input.store, input.setStore, event.data.sessionID, event.data.assistantMessageID, (message) =>
        updateToolContent(message, event.data.id, (content) => content
          ? { ...content, state: content.state.status === "running" ? { ...content.state, metadata: event.data.metadata } : content.state }
          : {
              type: "tool",
              id: event.data.id,
              name: "tool",
              state: { status: "running", input: {}, metadata: event.data.metadata },
              time: { created: event.created, ran: event.created },
            }),
      )
      return
    }
    case "session.tool.success":
    case "session.tool.failed": {
      updateAssistant(input.store, input.setStore, event.data.sessionID, event.data.assistantMessageID, (message) =>
        updateToolContent(message, event.data.id, (content) => {
          const base = content ?? { type: "tool" as const, id: event.data.id, name: "tool", time: { created: event.created } }
          const toolInput = content && content.state.status !== "streaming" ? content.state.input : {}
          return event.type === "session.tool.failed"
            ? {
                ...base,
                executed: event.data.executed,
                state: { status: "error", input: toolInput, error: event.data.error, metadata: event.data.metadata },
                time: { ...base.time, completed: event.created },
              }
            : {
                ...base,
                executed: event.data.executed,
                state: { status: "completed", input: toolInput, content: event.data.content, metadata: event.data.metadata },
                time: { ...base.time, completed: event.created },
              }
        }),
      )
      return
    }
    case "vcs.branch.updated": {
      if (input.store.vcs?.branch.current === event.data.branch) return
      const next = { branch: { ...input.store.vcs?.branch, current: event.data.branch } }
      input.setStore("vcs", next)
      input.vcsCache?.setStore("value", next)
      return
    }
    case "permission.asked": {
      const permission: PermissionRequest = event.data
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
