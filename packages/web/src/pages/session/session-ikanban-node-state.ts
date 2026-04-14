export type NodeSessionState = "unstart" | "starting" | "finish"

export function resolveNodeSessionState(input: {
  sessionID?: string
  finished?: boolean
}): NodeSessionState {
  if (!input.sessionID) return "unstart"
  if (input.finished) return "finish"
  return "starting"
}
