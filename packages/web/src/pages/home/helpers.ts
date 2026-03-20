import type { Session } from "@opencode-ai/sdk/v2/client"

export type BoardColumn = "progress" | "idle"

export type BoardCard = {
  session: Session
  projectDirectory: string
  updatedAt: number
}

type OpenProject = { worktree: string }

type SessionStatus = {
  type?: string
}

export function trackedProjectDirectories(projects: OpenProject[]) {
  return [...new Set(projects.map((project) => project.worktree).filter(Boolean))]
}

export function buildBoardColumns(input: {
  projectDirectories: string[]
  sessionsByProject: Record<string, Session[]>
  statusesByProject: Record<string, Record<string, SessionStatus | undefined>>
}) {
  const cards = new Map<string, BoardCard & { column: BoardColumn }>()

  for (const directory of input.projectDirectories) {
    const sessions = input.sessionsByProject[directory] ?? []
    const statuses = input.statusesByProject[directory] ?? {}

    for (const session of sessions) {
      if (!session?.id || session.time?.archived) continue

      const updatedAt = session.time.updated ?? session.time.created ?? 0
      const nextColumn: BoardColumn =
        statuses[session.id]?.type === "busy" || statuses[session.id]?.type === "retry"
          ? "progress"
          : "idle"

      const existing = cards.get(session.id)
      if (!existing) {
        cards.set(session.id, {
          column: nextColumn,
          projectDirectory: directory,
          session,
          updatedAt,
        })
        continue
      }

      if (nextColumn === "progress") existing.column = "progress"

      if (updatedAt > existing.updatedAt) {
        existing.projectDirectory = directory
        existing.session = session
        existing.updatedAt = updatedAt
      }
    }
  }

  const columns: Record<BoardColumn, BoardCard[]> = {
    progress: [],
    idle: [],
  }

  for (const card of cards.values()) {
    columns[card.column].push({
      projectDirectory: card.projectDirectory,
      session: card.session,
      updatedAt: card.updatedAt,
    })
  }

  for (const key of Object.keys(columns) as BoardColumn[]) {
    columns[key].sort((a, b) => b.updatedAt - a.updatedAt)
  }

  return columns
}
