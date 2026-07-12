type TimeInput = {
  created?: number
  completed?: number
}

export function getTurnDurationMs(
  message: { time: TimeInput } | undefined,
  assistantMessages: Array<{ time: TimeInput }>,
) {
  const start = message?.time.created
  if (typeof start !== "number") return undefined

  const end = assistantMessages.reduce<number | undefined>((max, item) => {
    const completed = item.time.completed
    if (typeof completed !== "number") return max
    if (max === undefined) return completed
    return Math.max(max, completed)
  }, undefined)

  if (typeof end !== "number") return undefined
  if (end < start) return undefined
  return end - start
}

export function formatTurnDurationLabel(ms: number | undefined) {
  if (!(typeof ms === "number" && ms >= 0)) return ""

  const total = Math.round(ms / 1000)
  if (total < 60) return `${total}s`

  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`
}

type ToolTimeState = {
  status?: string
  time?: {
    start?: number
    end?: number
  }
}

export function getToolDurationMs(state: ToolTimeState | undefined) {
  if (!state) return undefined
  if (state.status !== "completed" && state.status !== "error") return undefined
  const start = state.time?.start
  const end = state.time?.end
  if (typeof start !== "number" || typeof end !== "number") return undefined
  if (end < start) return undefined
  return end - start
}

export function formatToolDurationLabel(ms: number | undefined) {
  if (!(typeof ms === "number" && ms >= 0)) return ""
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`
  return formatTurnDurationLabel(ms)
}

export function buildInlineDurationDetail(detail: string, durationLabel?: string) {
  if (!durationLabel) return detail
  if (!detail) return durationLabel
  return `${durationLabel} · ${detail}`
}

export function buildDurationPrefix(durationLabel?: string) {
  if (!durationLabel) return ""
  return `${durationLabel} · `
}
