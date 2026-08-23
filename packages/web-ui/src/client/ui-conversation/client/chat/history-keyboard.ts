/** One arrow-key nudge through conversation history, in CSS pixels. */
export const HISTORY_ARROW_STEP = 40

/** Navigation keys may move the active history even when it does not own focus. */
export function isHistoryNavigationKey(key: string): boolean {
  return key === 'ArrowUp' || key === 'ArrowDown' || key === 'PageUp' || key === 'PageDown'
}

/** Resolve supported history-navigation keys to a scroll delta. */
export function historyScrollDelta(key: string, viewportHeight: number): number | null {
  if (key === 'ArrowUp') return -HISTORY_ARROW_STEP
  if (key === 'ArrowDown') return HISTORY_ARROW_STEP
  if (key === 'PageUp') return -Math.max(HISTORY_ARROW_STEP, viewportHeight - HISTORY_ARROW_STEP)
  if (key === 'PageDown') return Math.max(HISTORY_ARROW_STEP, viewportHeight - HISTORY_ARROW_STEP)
  return null
}
