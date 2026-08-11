import type { Session } from "@/types/opencode"

export function sessionArchiveKey(directory: string, sessionID: string) {
  return `${directory}\n${sessionID}`
}

export function applySessionArchive(session: Session, archived: Record<string, number>) {
  const value = archived[sessionArchiveKey(session.directory, session.id)]
  if (value === undefined || session.time.archived === value) return session
  return { ...session, time: { ...session.time, archived: value } }
}
