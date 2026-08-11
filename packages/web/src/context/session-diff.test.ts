import { describe, expect, test } from "bun:test"
import type { Message, SnapshotFileDiff } from "@/types/opencode"
import { loadSessionDiff } from "./session-diff"

const patch = (before: string, after: string): SnapshotFileDiff => ({
  file: "src/example.ts",
  status: "modified",
  additions: 1,
  deletions: 1,
  patch: [
    "--- a/src/example.ts",
    "+++ b/src/example.ts",
    "@@ -1 +1 @@",
    `-${before}`,
    `+${after}`,
    "",
  ].join("\n"),
})

describe("loadSessionDiff", () => {
  test("loads every user message diff and combines the session snapshots", async () => {
    const requested: string[] = []
    const messages = [
      { id: "user-2", role: "user" },
      { id: "assistant-1", role: "assistant" },
      { id: "user-1", role: "user" },
    ] as Message[]

    const result = await loadSessionDiff({
      messages: async () => messages,
      diff: async (messageID) => {
        requested.push(messageID)
        return messageID === "user-1" ? [patch("one", "two")] : [patch("two", "three")]
      },
    })

    expect(requested).toEqual(["user-1", "user-2"])
    expect(result).toEqual([
      {
        file: "src/example.ts",
        status: "modified",
        additions: 1,
        deletions: 1,
        before: "one\n",
        after: "three\n",
      },
    ])
  })
})
