import { describe, expect, test } from "bun:test"
import type { Session } from "@/types/opencode"
import { archiveSessionOnServer } from "./session-archive"

describe("archiveSessionOnServer", () => {
  test("does not call a removed V2 archive endpoint", async () => {
    const calls: unknown[] = []
    const archived = {
      id: "ses_1",
      slug: "session",
      projectID: "project",
      directory: "/project",
      title: "Session",
      version: "1",
      time: { created: 1, updated: 123, archived: 123 },
    } satisfies Session
    const client = {
      session: {
        update: async (input: unknown) => {
          calls.push(input)
          return { data: archived }
        },
      },
    }

    const result = await archiveSessionOnServer(client, {
      directory: "/project",
      sessionID: "ses_1",
      archivedAt: 123,
    })

    expect(calls).toEqual([])
    expect(result).toBeUndefined()
  })
})
