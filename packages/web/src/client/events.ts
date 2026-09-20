import type { OpenCodeClient, SessionInfo } from "@opencode/client"
import type { GlobalEvent, Session, UIEvent } from "./types"
import { messageViews, permissionView, projectView, questionView } from "./convert"

/** Coalesce V2 execution events into UI snapshots without dropping final updates.
 * The stream is live-only; callers reconnect and re-bootstrap after server.connected.
 */
export async function* subscribeUIEvents(
  client: OpenCodeClient,
  options: {
    signal?: AbortSignal
    sessionView: (session: SessionInfo) => Session
  },
): AsyncGenerator<GlobalEvent> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener("abort", abort, { once: true })
  if (options.signal?.aborted) abort()
  const signal = controller.signal
  const queue: GlobalEvent[] = []
  let wake: (() => void) | undefined
  let done = false
  let failure: unknown
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const pending = new Map<string, Promise<void>>()
  const dirty = new Map<string, string>()
  const known = new Map<string, Session>()
  const snapshots = new Map<string, Map<string, string>>()
  const removed = new Set<string>()
  const emit = (directory: string, payload: UIEvent) => {
    if (signal.aborted) return
    queue.push({ directory, payload })
    wake?.()
  }
  const refresh = (sessionID: string, directory: string) => {
    dirty.set(sessionID, directory)
    if (timers.has(sessionID) || pending.has(sessionID)) return
    timers.set(
      sessionID,
      setTimeout(() => {
        timers.delete(sessionID)
        dirty.delete(sessionID)
        const work = (async () => {
          const [session, page] = await Promise.all([
            client.session.get({ sessionID }, { signal }),
            client.message.list({ sessionID, order: "desc", limit: 100 }, { signal }),
          ])
          const info = options.sessionView(session)
          if (removed.has(sessionID)) return
          known.set(sessionID, info)
          const dir = session.location.directory
          emit(dir, { type: "session.updated", properties: { info } })
          const previous = snapshots.get(sessionID) ?? new Map<string, string>()
          const next = new Map<string, string>()
          const parentID = page.data.some((message) => message.type === "user")
            ? ""
            : ((await client.message.list({ sessionID, type: "user", order: "desc", limit: 1 }, { signal })).data[0]
                ?.id ?? "")
          for (const message of messageViews(
            session,
            page.data.slice().sort((a, b) => a.id.localeCompare(b.id)),
            parentID,
          )) {
            const serialized = JSON.stringify(message)
            next.set(message.info.id, serialized)
            if (previous.get(message.info.id) === serialized) continue
            emit(dir, { type: "message.updated", properties: { info: message.info } })
            emit(dir, {
              type: "message.parts.updated",
              properties: { messageID: message.info.id, parts: message.parts },
            })
            for (const part of message.parts) {
              if (part.type !== "tool" || !["todo", "todowrite"].includes(part.tool)) continue
              const todos = part.state.input.todos
              if (!Array.isArray(todos)) continue
              emit(dir, {
                type: "todo.updated",
                properties: {
                  sessionID,
                  todos: todos
                    .filter((todo) => todo && typeof todo.content === "string" && typeof todo.status === "string")
                    .map((todo) => ({
                      content: todo.content,
                      status: todo.status,
                      priority: todo.priority ?? "medium",
                    })),
                },
              })
            }
          }
          snapshots.set(sessionID, next)
        })()
          .catch((error) => {
            if (signal.aborted) return
            failure = error
            controller.abort()
            wake?.()
          })
          .finally(() => {
            pending.delete(sessionID)
            const next = dirty.get(sessionID)
            if (next !== undefined && !signal.aborted) refresh(sessionID, next)
          })
        pending.set(sessionID, work)
      }, 100),
    )
  }
  const pump = (async () => {
    try {
      for await (const event of client.event.subscribe({ signal })) {
        const directory = event.location?.directory ?? "global"
        switch (event.type) {
          case "server.connected":
            emit("global", { type: "server.connected", properties: {} })
            break
          case "location.shutdown":
            emit(directory, { type: "server.instance.disposed", properties: {} })
            break
          case "config.updated":
          case "provider.updated":
          case "model.updated":
          case "agent.updated":
          case "integration.updated":
          case "credential.updated":
          case "mcp.status.changed":
          case "session.revert.committed":
            emit("global", { type: "global.disposed", properties: {} })
            break
          case "project.updated":
            emit("global", { type: "project.updated", properties: projectView(event.data) })
            break
          case "permission.asked":
            emit(directory, { type: "permission.asked", properties: permissionView(event.data) })
            break
          case "permission.replied":
            emit(directory, { type: "permission.replied", properties: event.data })
            break
          case "form.created":
            emit(directory, { type: "question.asked", properties: questionView(event.data.form) })
            break
          case "form.replied":
          case "form.cancelled":
            emit(directory, {
              type: event.type === "form.replied" ? "question.replied" : "question.rejected",
              properties: { sessionID: event.data.sessionID, requestID: event.data.id },
            })
            break
          case "filesystem.changed":
            emit(directory, { type: "file.watcher.updated", properties: event.data })
            break
          case "vcs.branch.updated":
            emit(directory, { type: "vcs.branch.updated", properties: { branch: event.data.branch ?? "" } })
            break
          case "session.status":
            emit(directory, { type: "session.status", properties: event.data })
            break
          case "session.idle":
            emit(directory, { type: "session.idle", properties: event.data })
            emit(directory, {
              type: "session.status",
              properties: { sessionID: event.data.sessionID, status: { type: "idle" } },
            })
            break
          case "session.execution.failed":
            emit(directory, {
              type: "session.error",
              properties: {
                sessionID: event.data.sessionID,
                error: { name: "APIError", data: { message: event.data.error.message } },
              },
            })
            break
          case "session.deleted": {
            const id = event.data.sessionID
            const info = known.get(id) ?? {
              id,
              directory,
              projectID: "",
              title: "",
              slug: id,
              version: "2",
              time: { created: event.created, updated: event.created },
            }
            emit(directory, { type: "session.deleted", properties: { info } })
            known.delete(id)
            snapshots.delete(id)
            removed.add(id)
            clearTimeout(timers.get(id))
            timers.delete(id)
            dirty.delete(id)
            break
          }
        }
        if (
          event.type.startsWith("session.") &&
          event.type !== "session.deleted" &&
          "data" in event &&
          "sessionID" in event.data &&
          typeof event.data.sessionID === "string"
        )
          refresh(event.data.sessionID, directory)
      }
    } catch (error) {
      if (!signal.aborted) failure = error
    } finally {
      done = true
      wake?.()
    }
  })()
  const onAbort = () => wake?.()
  signal.addEventListener("abort", onAbort)
  try {
    while ((!done && !signal.aborted) || queue.length) {
      if (queue.length) {
        yield queue.shift()!
        continue
      }
      await new Promise<void>((resolve) => {
        wake = resolve
      })
      wake = undefined
    }
    if (failure) throw failure
  } finally {
    controller.abort()
    options.signal?.removeEventListener("abort", abort)
    signal.removeEventListener("abort", onAbort)
    for (const timer of timers.values()) clearTimeout(timer)
    await pump
    await Promise.all(pending.values())
  }
}
