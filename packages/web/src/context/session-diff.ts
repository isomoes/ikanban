import type { Message, SnapshotFileDiff } from "@opencode-ai/sdk/v2/client"
import { diffLines } from "diff"
import { snapshotToFileDiff, type FileDiff } from "./file/types"

type LoadSessionDiffInput = {
  messages: () => Promise<Message[]>
  diff: (messageID: string) => Promise<SnapshotFileDiff[]>
}

export async function loadSessionDiff(input: LoadSessionDiffInput): Promise<FileDiff[]> {
  const messages = await input.messages()
  const turns = await Promise.all(
    messages
      .filter((message) => message.role === "user")
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((message) => input.diff(message.id)),
  )

  const files = new Map<string, FileDiff>()
  for (const turn of turns) {
    for (const snapshot of turn) {
      const diff = snapshotToFileDiff(snapshot)
      const previous = files.get(diff.file)
      if (!previous) {
        files.set(diff.file, diff)
        continue
      }
      previous.after = diff.after
      previous.status = previous.status === "added" ? "added" : diff.status === "deleted" ? "deleted" : "modified"
    }
  }

  return [...files.values()].flatMap((file) => {
    if (file.before === file.after) return []
    let additions = 0
    let deletions = 0
    for (const change of diffLines(file.before, file.after)) {
      if (change.added) additions += change.count ?? 0
      if (change.removed) deletions += change.count ?? 0
    }
    return [{ ...file, additions, deletions }]
  })
}
