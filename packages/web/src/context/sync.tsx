import { batch, createMemo } from "solid-js"
import { createStore, produce, reconcile, type SetStoreFunction } from "solid-js/store"
import { Binary } from "@/utils/binary"
import { retry } from "@/utils/retry"
import { createSimpleContext } from "@/ui/context/index"
import { applyPatch, parsePatch, reversePatch, type StructuredPatch } from "diff"
import { useGlobalSync } from "./global-sync"
import { useSDK } from "./sdk"
import type { FileContent, Message, Part, VcsFileStatus } from "@opencode-ai/sdk/v2/client"
import { snapshotToFileDiff, type FileDiff } from "@/context/file/types"

type ProjectDiffEntry = FileDiff & {
  lazy?: boolean
  loading?: boolean
  binary?: boolean
}

/**
 * Context lines requested from `vcs.diff` so per-file patches carry the full
 * file contents. This lets the UI reconstruct complete before/after texts from
 * a single request instead of reading every changed file individually.
 */
const PROJECT_DIFF_CONTEXT_LINES = 100_000
const PROJECT_DIFF_READ_CONCURRENCY = 4
const BINARY_FILE_RE = /\.(?:png|jpe?g|gif|webp|bmp|ico|avif|mp3|wav|ogg|flac|mp4|mov|avi|mkv|webm|pdf|zip|gz|tar|7z|woff2?|ttf|eot|otf|exe|bin|so|dylib|dll|class|jar|wasm)$/i

function isLikelyBinaryPath(path: string) {
  return BINARY_FILE_RE.test(path)
}

function createProjectPlaceholder(
  file: VcsFileStatus,
  input: { lazy?: boolean; loading?: boolean; binary?: boolean } = {},
): ProjectDiffEntry {
  return {
    file: file.file,
    before: "",
    after: "",
    additions: file.additions,
    deletions: file.deletions,
    status: file.status,
    lazy: input.lazy,
    loading: input.loading,
    binary: input.binary,
  }
}

function getStructuredPatch(content?: FileContent): StructuredPatch | undefined {
  if (!content) return
  if (content.diff) {
    const parsed = parsePatch(content.diff)[0]
    if (parsed) return parsed
  }
  if (!content.patch) return
  return {
    oldFileName: content.patch.oldFileName,
    newFileName: content.patch.newFileName,
    oldHeader: content.patch.oldHeader,
    newHeader: content.patch.newHeader,
    hunks: content.patch.hunks.map((hunk) => ({
      oldStart: hunk.oldStart,
      oldLines: hunk.oldLines,
      newStart: hunk.newStart,
      newLines: hunk.newLines,
      lines: [...hunk.lines],
    })),
  }
}

/**
 * Fallback for files the single `vcs.diff` call cannot cover (for example
 * binary files, or edge cases where a changed file is missing from the patch
 * set). Reads the file once and reconstructs `before` from the patch metadata.
 */
function buildWorkspaceDiff(file: VcsFileStatus, content?: FileContent): ProjectDiffEntry | undefined {
  const patch = getStructuredPatch(content)

  if (content?.type === "binary") {
    return createProjectPlaceholder(file, { binary: true })
  }

  if (file.status === "added") {
    const after = content?.content ?? (patch ? applyPatch("", patch) || "" : "")
    return {
      file: file.file,
      before: "",
      after,
      additions: file.additions,
      deletions: file.deletions,
      status: file.status,
    }
  }

  if (file.status === "deleted") {
    const before = content?.content ?? (patch ? applyPatch("", reversePatch(patch)) || "" : "")
    return {
      file: file.file,
      before,
      after: "",
      additions: file.additions,
      deletions: file.deletions,
      status: file.status,
    }
  }

  const after = content?.content ?? ""
  const before = patch ? applyPatch(after, reversePatch(patch)) || after : after

  if (!patch && file.additions + file.deletions === 0) return

  return {
    file: file.file,
    before,
    after,
    additions: file.additions,
    deletions: file.deletions,
    status: file.status,
  }
}

async function hydrateProjectDiffFile(
  client: ReturnType<typeof useSDK>["client"],
  directory: string,
  file: VcsFileStatus,
): Promise<ProjectDiffEntry> {
  const content = await retry(() => client.file.read({ path: file.file, directory }))
    .then((result) => result.data)
    .catch(() => undefined)
  return buildWorkspaceDiff(file, content) ?? createProjectPlaceholder(file)
}

function updateProjectDiffEntry(
  setStore: SetStoreFunction<any>,
  directory: string,
  path: string,
  updater: (current: ProjectDiffEntry) => ProjectDiffEntry,
) {
  setStore(
    "project_diff",
    directory,
    produce((draft: ProjectDiffEntry[]) => {
      const index = draft.findIndex((item) => item.file === path)
      if (index === -1) return
      draft[index] = updater(draft[index])
    }),
  )
}

async function hydrateProjectDiffBatch(input: {
  client: ReturnType<typeof useSDK>["client"]
  directory: string
  setStore: SetStoreFunction<any>
  entries: ProjectDiffEntry[]
}) {
  for (let i = 0; i < input.entries.length; i += PROJECT_DIFF_READ_CONCURRENCY) {
    const chunk = input.entries.slice(i, i + PROJECT_DIFF_READ_CONCURRENCY)
    await Promise.all(
      chunk.map(async (entry) => {
        const file: VcsFileStatus = {
          file: entry.file,
          additions: entry.additions,
          deletions: entry.deletions,
          status: entry.status ?? "modified",
        }
        const hydrated = await hydrateProjectDiffFile(input.client, input.directory, file)
        updateProjectDiffEntry(input.setStore, input.directory, entry.file, () => ({
          ...hydrated,
          lazy: false,
          loading: false,
        }))
      }),
    )
  }
}

function sortParts(parts: Part[]) {
  return parts.filter((part) => !!part?.id).sort((a, b) => cmp(a.id, b.id))
}

function runInflight(map: Map<string, Promise<void>>, key: string, task: () => Promise<void>) {
  const pending = map.get(key)
  if (pending) return pending
  const promise = task().finally(() => {
    map.delete(key)
  })
  map.set(key, promise)
  return promise
}

const keyFor = (directory: string, id: string) => `${directory}\n${id}`

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

type OptimisticStore = {
  message: Record<string, Message[] | undefined>
  part: Record<string, Part[] | undefined>
}

type OptimisticAddInput = {
  sessionID: string
  message: Message
  parts: Part[]
}

type OptimisticRemoveInput = {
  sessionID: string
  messageID: string
}

export function applyOptimisticAdd(draft: OptimisticStore, input: OptimisticAddInput) {
  const messages = draft.message[input.sessionID]
  if (messages) {
    const result = Binary.search(messages, input.message.id, (m) => m.id)
    messages.splice(result.index, 0, input.message)
  } else {
    draft.message[input.sessionID] = [input.message]
  }
  draft.part[input.message.id] = sortParts(input.parts)
}

export function applyOptimisticRemove(draft: OptimisticStore, input: OptimisticRemoveInput) {
  const messages = draft.message[input.sessionID]
  if (messages) {
    const result = Binary.search(messages, input.messageID, (m) => m.id)
    if (result.found) messages.splice(result.index, 1)
  }
  delete draft.part[input.messageID]
}

function setOptimisticAdd(setStore: (...args: unknown[]) => void, input: OptimisticAddInput) {
  setStore("message", input.sessionID, (messages: Message[] | undefined) => {
    if (!messages) return [input.message]
    const result = Binary.search(messages, input.message.id, (m) => m.id)
    const next = [...messages]
    next.splice(result.index, 0, input.message)
    return next
  })
  setStore("part", input.message.id, sortParts(input.parts))
}

function setOptimisticRemove(setStore: (...args: unknown[]) => void, input: OptimisticRemoveInput) {
  setStore("message", input.sessionID, (messages: Message[] | undefined) => {
    if (!messages) return messages
    const result = Binary.search(messages, input.messageID, (m) => m.id)
    if (!result.found) return messages
    const next = [...messages]
    next.splice(result.index, 1)
    return next
  })
  setStore("part", (part: Record<string, Part[] | undefined>) => {
    if (!(input.messageID in part)) return part
    const next = { ...part }
    delete next[input.messageID]
    return next
  })
}

export const { use: useSync, provider: SyncProvider } = createSimpleContext({
  name: "Sync",
  init: () => {
    const globalSync = useGlobalSync()
    const sdk = useSDK()

    type Child = ReturnType<(typeof globalSync)["child"]>
    type Setter = Child[1]

    const current = createMemo(() => globalSync.child(sdk.directory))
    const target = (directory?: string) => {
      if (!directory || directory === sdk.directory) return current()
      return globalSync.child(directory)
    }
    const absolute = (path: string) => (current()[0].path.directory + "/" + path).replace("//", "/")
    const messagePageSize = 200
    const inflight = new Map<string, Promise<void>>()
    const inflightDiff = new Map<string, Promise<void>>()
    const inflightProjectFile = new Map<string, Promise<void>>()
    const inflightTodo = new Map<string, Promise<void>>()
    const [meta, setMeta] = createStore({
      limit: {} as Record<string, number>,
      complete: {} as Record<string, boolean>,
      loading: {} as Record<string, boolean>,
    })

    const getSession = (sessionID: string) => {
      const store = current()[0]
      const match = Binary.search(store.session, sessionID, (s) => s.id)
      if (match.found) return store.session[match.index]
      return undefined
    }

    const fetchMessages = async (input: { client: typeof sdk.client; sessionID: string; limit: number }) => {
      const messages = await retry(() =>
        input.client.session.messages({ sessionID: input.sessionID, limit: input.limit }),
      )
      const items = (messages.data ?? []).filter((x) => !!x?.info?.id)
      const session = items.map((x) => x.info).sort((a, b) => cmp(a.id, b.id))
      const part = items.map((message) => ({ id: message.info.id, part: sortParts(message.parts) }))
      return {
        session,
        part,
        complete: session.length < input.limit,
      }
    }

    const loadMessages = async (input: {
      directory: string
      client: typeof sdk.client
      setStore: Setter
      sessionID: string
      limit: number
    }) => {
      const key = keyFor(input.directory, input.sessionID)
      if (meta.loading[key]) return

      setMeta("loading", key, true)
      await fetchMessages(input)
        .then((next) => {
          batch(() => {
            input.setStore("message", input.sessionID, reconcile(next.session, { key: "id" }))
            for (const p of next.part) {
              input.setStore("part", p.id, p.part)
            }
            setMeta("limit", key, input.limit)
            setMeta("complete", key, next.complete)
          })
        })
        .finally(() => {
          setMeta("loading", key, false)
        })
    }

    return {
      get data() {
        return current()[0]
      },
      get set(): Setter {
        return current()[1]
      },
      get status() {
        return current()[0].status
      },
      get ready() {
        return current()[0].status !== "loading"
      },
      get project() {
        const store = current()[0]
        const match = Binary.search(globalSync.data.project, store.project, (p) => p.id)
        if (match.found) return globalSync.data.project[match.index]
        return undefined
      },
      session: {
        get: getSession,
        optimistic: {
          add(input: { directory?: string; sessionID: string; message: Message; parts: Part[] }) {
            const [, setStore] = target(input.directory)
            setOptimisticAdd(setStore as (...args: unknown[]) => void, input)
          },
          remove(input: { directory?: string; sessionID: string; messageID: string }) {
            const [, setStore] = target(input.directory)
            setOptimisticRemove(setStore as (...args: unknown[]) => void, input)
          },
        },
        addOptimisticMessage(input: {
          sessionID: string
          messageID: string
          parts: Part[]
          agent: string
          model: { providerID: string; modelID: string }
        }) {
          const message: Message = {
            id: input.messageID,
            sessionID: input.sessionID,
            role: "user",
            time: { created: Date.now() },
            agent: input.agent,
            model: input.model,
          }
          const [, setStore] = target()
          setOptimisticAdd(setStore as (...args: unknown[]) => void, {
            sessionID: input.sessionID,
            message,
            parts: input.parts,
          })
        },
        async sync(sessionID: string) {
          const directory = sdk.directory
          const client = sdk.client
          const [store, setStore] = globalSync.child(directory)
          const key = keyFor(directory, sessionID)
          const hasSession = Binary.search(store.session, sessionID, (s) => s.id).found

          const limit = meta.limit[key] ?? messagePageSize

          const sessionReq = hasSession
            ? Promise.resolve()
            : retry(() => client.session.get({ sessionID })).then((session) => {
                const data = session.data
                if (!data) return
                setStore(
                  "session",
                  produce((draft) => {
                    const match = Binary.search(draft, sessionID, (s) => s.id)
                    if (match.found) {
                      draft[match.index] = data
                      return
                    }
                    draft.splice(match.index, 0, data)
                  }),
                )
              })

          const messagesReq = loadMessages({
            directory,
            client,
            setStore,
            sessionID,
            limit,
          })

          return runInflight(inflight, key, () => Promise.all([sessionReq, messagesReq]).then(() => {}))
        },
        async diff(sessionID: string) {
          const directory = sdk.directory
          const client = sdk.client
          const [store, setStore] = globalSync.child(directory)
          if (store.session_diff[sessionID] !== undefined) return

          const key = keyFor(directory, sessionID)
          return runInflight(inflightDiff, key, () =>
            retry(() => client.session.diff({ sessionID })).then((diff) => {
              const converted = (diff.data ?? []).map(snapshotToFileDiff)
              setStore("session_diff", sessionID, reconcile(converted, { key: "file" }))
            }),
          )
        },
        async todo(sessionID: string) {
          const directory = sdk.directory
          const client = sdk.client
          const [store, setStore] = globalSync.child(directory)
          const existing = store.todo[sessionID]
          const cached = globalSync.data.session_todo[sessionID]
          if (existing !== undefined) {
            if (cached === undefined) {
              globalSync.todo.set(sessionID, existing)
            }
            return
          }

          if (cached !== undefined) {
            setStore("todo", sessionID, reconcile(cached, { key: "id" }))
          }

          const key = keyFor(directory, sessionID)
          return runInflight(inflightTodo, key, () =>
            retry(() => client.session.todo({ sessionID })).then((todo) => {
              const list = todo.data ?? []
              setStore("todo", sessionID, reconcile(list, { key: "id" }))
              globalSync.todo.set(sessionID, list)
            }),
          )
        },
        history: {
          more(sessionID: string) {
            const store = current()[0]
            const key = keyFor(sdk.directory, sessionID)
            if (store.message[sessionID] === undefined) return false
            if (meta.limit[key] === undefined) return false
            if (meta.complete[key]) return false
            return true
          },
          loading(sessionID: string) {
            const key = keyFor(sdk.directory, sessionID)
            return meta.loading[key] ?? false
          },
          async loadMore(sessionID: string, count?: number) {
            const directory = sdk.directory
            const client = sdk.client
            const [, setStore] = globalSync.child(directory)
            const key = keyFor(directory, sessionID)
            const step = count ?? messagePageSize
            if (meta.loading[key]) return
            if (meta.complete[key]) return

            const currentLimit = meta.limit[key] ?? messagePageSize
            await loadMessages({
              directory,
              client,
              setStore,
              sessionID,
              limit: currentLimit + step,
            })
          },
        },
        fetch: async (count = 10) => {
          const directory = sdk.directory
          const client = sdk.client
          const [store, setStore] = globalSync.child(directory)
          setStore("limit", (x) => x + count)
          await client.session.list().then((x) => {
            const sessions = (x.data ?? [])
              .filter((s) => !!s?.id)
              .sort((a, b) => cmp(a.id, b.id))
              .slice(0, store.limit)
            setStore("session", reconcile(sessions, { key: "id" }))
          })
        },
        more: createMemo(() => current()[0].session.length >= current()[0].limit),
        archive: async (sessionID: string) => {
          return globalSync.project.archiveSession(sdk.directory, sessionID)
        },
      },
      projectDiff: {
        async diff() {
          const directory = sdk.directory
          const client = sdk.client
          const [store, setStore] = globalSync.child(directory)
          if (store.project_diff[directory] !== undefined) return

          const key = `project\n${directory}`
          return runInflight(inflightDiff, key, async () => {
            // Fast pass: seed placeholders from the lightweight VCS status so
            // the pane paints file names and +/- counts immediately.
            const status = await retry(() => client.vcs.status({ directory })).then((result) => result.data ?? [])
            const placeholders = status.map((file) =>
              createProjectPlaceholder(file, {
                loading: true,
                binary: isLikelyBinaryPath(file.file),
              }),
            )
            setStore("project_diff", directory, reconcile(placeholders, { key: "file" }))
            if (!status.length) return

            // Full pass: one `vcs.diff` call returns full-context patches for
            // the entire working tree (uncommitted changes, not commits).
            const patches = await retry(() =>
              client.vcs.diff({ directory, mode: "git", context: PROJECT_DIFF_CONTEXT_LINES }),
            )
              .then((result) => result.data ?? [])
              .catch(() => [])
            const byFile = new Map(patches.map((patch) => [patch.file, patch] as const))

            const missing: ProjectDiffEntry[] = []
            const resolved = status.map((file) => {
              const patch = byFile.get(file.file)
              if (patch?.patch && !isLikelyBinaryPath(file.file)) {
                return {
                  ...snapshotToFileDiff(patch),
                  file: file.file,
                  status: patch.status ?? file.status,
                } as ProjectDiffEntry
              }
              const placeholder = createProjectPlaceholder(file, {
                loading: true,
                binary: isLikelyBinaryPath(file.file),
              })
              missing.push(placeholder)
              return placeholder
            })
            setStore("project_diff", directory, reconcile(resolved, { key: "file" }))

            if (!missing.length) return

            // Fallback pass: read the few files the VCS diff could not cover
            // (binary/media files, untracked edge cases).
            await hydrateProjectDiffBatch({
              client,
              directory,
              setStore,
              entries: missing,
            })
          })
        },
        hydrate(path: string) {
          const directory = sdk.directory
          const client = sdk.client
          const [store, setStore] = globalSync.child(directory)
          const entries = store.project_diff[directory] as ProjectDiffEntry[] | undefined
          const existing = entries?.find((item) => item.file === path)
          if (!existing || (!existing.lazy && !existing.loading)) return

          const fileKey = `project-file\n${directory}\n${path}`
          return runInflight(inflightProjectFile, fileKey, async () => {
            updateProjectDiffEntry(setStore, directory, path, (current) => ({
              ...current,
              loading: true,
            }))

            const file: VcsFileStatus = {
              file: existing.file,
              additions: existing.additions,
              deletions: existing.deletions,
              status: existing.status ?? "modified",
            }
            const hydrated = await hydrateProjectDiffFile(client, directory, file)
            updateProjectDiffEntry(setStore, directory, path, () => ({
              ...hydrated,
              lazy: false,
              loading: false,
            }))
          })
        },
      },
      absolute,
      get directory() {
        return current()[0].path.directory
      },
    }
  },
})
