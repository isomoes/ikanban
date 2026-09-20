import type { SelectedLineRange } from "@/context/file"

type SessionHandoff = {
  prompt?: string
  files?: Record<string, SelectedLineRange | null>
}

const store = new Map<string, SessionHandoff>()

export const setSessionHandoff = (key: string, value: SessionHandoff) => {
  const previous = store.get(key)
  store.set(key, { ...previous, ...value })
}

export const getSessionHandoff = (key: string) => store.get(key)
