import type { Message, Session } from "@opencode-ai/sdk/v2/client"

export function sessionHistoryChanges(summary: Session["summary"], messages: Message[] | undefined) {
  if (!messages) return summary

  let additions = 0
  let deletions = 0
  for (const message of messages) {
    if (message.role !== "user") continue
    for (const diff of message.summary?.diffs ?? []) {
      additions += diff.additions
      deletions += diff.deletions
    }
  }
  return { additions, deletions }
}
