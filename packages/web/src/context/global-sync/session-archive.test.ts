import { describe, expect, test } from "bun:test"
import type { Session } from "@/types/opencode"
import { applySessionArchive, sessionArchiveKey } from "./session-archive"

describe("session archive", () => {
  test("applies browser-persisted archive state to a server session", () => {
    const session: Session = {
      id: "ses_1",
      slug: "session",
      projectID: "project",
      directory: "/project",
      title: "Session",
      version: "1",
      time: { created: 1, updated: 123 },
    }

    const result = applySessionArchive(session, {
      [sessionArchiveKey("/project", "ses_1")]: 456,
    })

    expect(result.time.archived).toBe(456)
    expect(session.time.archived).toBeUndefined()
  })
})
