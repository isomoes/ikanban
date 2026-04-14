import type { ParentProps } from "solid-js"
import { createStore, produce } from "solid-js/store"
import type { Session } from "@opencode-ai/sdk/v2/client"
import { createSimpleContext } from "@/ui/context/index"
import { Persist, persisted } from "@/utils/persist"

type ArchiveState = {
  sessions: Record<string, number>
}

function archiveKey(directory: string, sessionID: string) {
  return `${directory}\n${sessionID}`
}

function normalizeSession(input: Pick<Session, "directory" | "id"> | { directory: string; sessionID: string }) {
  if ("sessionID" in input) {
    return { directory: input.directory, sessionID: input.sessionID }
  }
  return { directory: input.directory, sessionID: input.id }
}

export const { use: useBrowserArchive, provider: BrowserArchiveProvider } = createSimpleContext({
  name: "BrowserArchive",
  init: (_props: ParentProps) => {
    const [store, setStore, _init, ready] = persisted(
      Persist.global("browserArchive", ["browserArchive.v1"]),
      createStore<ArchiveState>({ sessions: {} }),
    )

    const remove = (directory: string, sessionID: string) => {
      const key = archiveKey(directory, sessionID)
      if (!(key in store.sessions)) return
      setStore(
        produce((draft) => {
          delete draft.sessions[key]
        }),
      )
    }

    const isArchived = (input: Pick<Session, "directory" | "id"> | { directory: string; sessionID: string }) => {
      const value = normalizeSession(input)
      return store.sessions[archiveKey(value.directory, value.sessionID)] !== undefined
    }

    return {
      ready,
      isArchived,
      isVisibleSession(session: Pick<Session, "directory" | "id">) {
        return !isArchived(session)
      },
      archiveSession(input: Pick<Session, "directory" | "id"> | { directory: string; sessionID: string }) {
        const value = normalizeSession(input)
        setStore("sessions", archiveKey(value.directory, value.sessionID), Date.now())
      },
      unarchiveSession(input: Pick<Session, "directory" | "id"> | { directory: string; sessionID: string }) {
        const value = normalizeSession(input)
        remove(value.directory, value.sessionID)
      },
      clearDirectory(directory: string) {
        setStore(
          produce((draft) => {
            for (const key of Object.keys(draft.sessions)) {
              if (!key.startsWith(`${directory}\n`)) continue
              delete draft.sessions[key]
            }
          }),
        )
      },
    }
  },
})
