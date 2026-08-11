import type { Session } from "@/types/opencode"

export async function archiveSessionOnServer(
  _clientOrInput: unknown,
  _legacyInput?: { directory: string; sessionID: string; archivedAt?: number },
): Promise<Session | undefined> {
  // V2 does not expose session archive mutation.
  return undefined
}
