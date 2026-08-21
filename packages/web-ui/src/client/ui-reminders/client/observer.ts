/** Pure session-list edge detector for reminder sounds. */

import type { PendingInteractionStatus, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'

/** Sound events emitted from authoritative session-list state transitions. */
export type ReminderEvent = {
  kind: 'attention' | 'completion'
  sessionId: string
}

/** Minimal row accepted by the edge detector (keeps fixtures independent of UI state). */
export type ReminderSessionRow = Pick<SessionSummary, 'id' | 'running' | 'pendingInteraction' | 'origin'>

type PreviousState = {
  running: boolean
  pendingInteraction: PendingInteractionStatus | undefined
}

/**
 * Detect new waits and running→idle edges without replaying stale state on boot.
 * Subagents are intentionally quiet: their parent session is the human-facing
 * completion boundary, matching the legacy implementation's child-session guard.
 */
export class SessionReminderObserver {
  private initialized = false
  private previous = new Map<string, PreviousState>()
  private readonly lastAttentionAt = new Map<string, number>()

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly attentionCooldownMs = 5_000,
  ) {}

  /** Adopt one complete list projection and return newly crossed reminder edges. */
  update(rows: readonly ReminderSessionRow[]): ReminderEvent[] {
    const next = new Map<string, PreviousState>()
    const events: ReminderEvent[] = []
    const liveIds = new Set<string>()

    for (const row of rows) {
      liveIds.add(row.id)
      next.set(row.id, { running: row.running, pendingInteraction: row.pendingInteraction })
      if (!this.initialized || row.origin === 'subagent') continue
      const previous = this.previous.get(row.id)
      if (previous === undefined) continue
      const needsAttention = previous.pendingInteraction === undefined && row.pendingInteraction !== undefined
      if (needsAttention) {
        const now = this.now()
        const last = this.lastAttentionAt.get(row.id)
        if (last === undefined || now - last >= this.attentionCooldownMs) {
          this.lastAttentionAt.set(row.id, now)
          events.push({ kind: 'attention', sessionId: row.id })
        }
        // A wait is the actionable edge. Do not double-chime if a projection
        // publication also happens to carry a running→idle transition.
        continue
      }
      if (previous.running && !row.running) {
        events.push({ kind: 'completion', sessionId: row.id })
      }
    }

    for (const id of this.lastAttentionAt.keys()) {
      if (!liveIds.has(id)) this.lastAttentionAt.delete(id)
    }
    this.previous = next
    this.initialized = true
    return events
  }
}
