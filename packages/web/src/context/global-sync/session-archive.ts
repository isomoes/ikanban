import type { Session } from "@opencode-ai/sdk/v2/client"

type ArchiveClient = {
  session: {
    update(input: {
      directory: string
      sessionID: string
      time: { archived: number }
    }): PromiseLike<{ data?: Session }>
  }
}

export async function archiveSessionOnServer(
  client: ArchiveClient,
  input: { directory: string; sessionID: string; archivedAt?: number },
) {
  const result = await client.session.update({
    directory: input.directory,
    sessionID: input.sessionID,
    time: { archived: input.archivedAt ?? Date.now() },
  })
  return result.data
}
