import type { SessionInfo } from "@opencode-ai/client"

export function sessionArchiveKey(directory: string, sessionID: string) {
  return `${directory}\n${sessionID}`
}

export function applySessionArchive(session: SessionInfo, archived: Record<string, number>) {
  const value = archived[sessionArchiveKey(session.location.directory, session.id)]
  if (value === undefined || session.time.archived === value) return session
  return { ...session, time: { ...session.time, archived: value } }
}
