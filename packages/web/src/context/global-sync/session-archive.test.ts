import { describe, expect, test } from "bun:test"
import type { Session } from "@opencode-ai/sdk/v2/client"
import { archiveSessionOnServer } from "./session-archive"

describe("archiveSessionOnServer", () => {
  test("persists the archived timestamp through the session SDK", async () => {
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

    expect(calls).toEqual([
      {
        directory: "/project",
        sessionID: "ses_1",
        time: { archived: 123 },
      },
    ])
    expect(result).toBe(archived)
  })
})
