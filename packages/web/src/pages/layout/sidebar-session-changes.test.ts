import { describe, expect, test } from "bun:test"
import type { Message } from "@/types/opencode"
import { sessionHistoryChanges } from "./sidebar-session-changes"

describe("sessionHistoryChanges", () => {
  test("uses historical message diffs after history loads", () => {
    const messages = [
      {
        role: "user",
        summary: {
          diffs: [
            { additions: 5, deletions: 2 },
            { additions: 3, deletions: 1 },
          ],
        },
      },
      { role: "assistant" },
      { role: "user", summary: { diffs: [{ additions: 4, deletions: 6 }] } },
    ] as Message[]

    expect(sessionHistoryChanges({ additions: 0, deletions: 0, files: 0 }, messages)).toEqual({
      additions: 12,
      deletions: 9,
    })
  })

  test("keeps the session summary until history loads", () => {
    const summary = { additions: 2, deletions: 1, files: 1 }
    expect(sessionHistoryChanges(summary, undefined)).toBe(summary)
  })
})
