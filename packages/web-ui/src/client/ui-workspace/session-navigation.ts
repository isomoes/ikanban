/** Minimal Session-list shape needed to choose an archive successor. */
export interface SessionNavigationList<Id extends string> {
  readonly ids: readonly Id[]
  readonly byId: Readonly<Record<Id, {
    readonly blank: boolean
    readonly origin?: 'subagent' | undefined
  }>>
}

/**
 * Pick the visible ordinary Session following an archived row in Host-list
 * order, falling back to the preceding row when the archived row was last.
 * Blank placeholders, subagents, and already archived rows cannot be targets.
 */
export function nextSessionAfterArchive<Id extends string>(
  list: SessionNavigationList<Id>,
  archivedSessionIds: readonly Id[],
  sessionId: Id,
): Id | undefined {
  const archived = new Set(archivedSessionIds)
  const eligible = (id: Id): boolean => {
    const summary = list.byId[id]
    return id !== sessionId
      && summary !== undefined
      && !summary.blank
      && summary.origin !== 'subagent'
      && !archived.has(id)
  }
  const index = list.ids.indexOf(sessionId)
  if (index < 0) return list.ids.find(eligible)
  for (let cursor = index + 1; cursor < list.ids.length; cursor++) {
    const id = list.ids[cursor]
    if (id !== undefined && eligible(id)) return id
  }
  for (let cursor = index - 1; cursor >= 0; cursor--) {
    const id = list.ids[cursor]
    if (id !== undefined && eligible(id)) return id
  }
  return undefined
}
