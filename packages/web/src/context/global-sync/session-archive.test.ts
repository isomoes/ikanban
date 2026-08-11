import { describe, expect, test } from "bun:test"
import type { SessionInfo as Session } from "@opencode-ai/client"
import { applySessionArchive, sessionArchiveKey } from "./session-archive"

describe("session archive", () => {
  test("applies browser-persisted archive state to a server session", () => {
    const session: Session = {
      id: "ses_1",
      projectID: "project",
      location: { directory: "/project" },
      title: "Session",
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      time: { created: 1, updated: 123 },
    }

    const result = applySessionArchive(session, {
      [sessionArchiveKey("/project", "ses_1")]: 456,
    })

    expect(result.time.archived).toBe(456)
    expect(session.time.archived).toBeUndefined()
  })
})
