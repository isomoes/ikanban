import { describe, expect, test } from "bun:test"
import type { Session } from "@opencode-ai/sdk/v2/client"
import { buildBoardColumns, trackedProjectDirectories } from "./helpers"

const session = (input: Partial<Session> & Pick<Session, "id">) =>
  ({
    title: input.id,
    version: "v2",
    messageCount: 0,
    permissions: { session: {}, share: {} },
    time: { created: 0, updated: 0, archived: undefined },
    ...input,
  }) as Session

describe("trackedProjectDirectories", () => {
  test("keeps only unique opened project directories", () => {
    expect(
      trackedProjectDirectories([
        { worktree: "/open" },
        { worktree: "/open" },
        { worktree: "/other" },
      ]),
    ).toEqual(["/open", "/other"])
  })
})

describe("buildBoardColumns", () => {
  test("shows sessions only for opened projects", () => {
    const columns = buildBoardColumns({
      projectDirectories: ["/open"],
      sessionsByProject: {
        "/open": [session({ id: "open-session", title: "Open session" })],
        "/closed": [session({ id: "closed-session", title: "Closed session" })],
      },
      statusesByProject: {},
    })

    expect(columns.idle.map((card) => card.session.id)).toEqual(["open-session"])
    expect(columns.progress).toEqual([])
  })

  test("deduplicates the same session across projects and keeps progress state", () => {
    const shared = session({ id: "session-1", title: "Shared", time: { created: 1, updated: 2, archived: undefined } })

    const columns = buildBoardColumns({
      projectDirectories: ["/open", "/other-open"],
      sessionsByProject: {
        "/open": [shared],
        "/other-open": [shared],
      },
      statusesByProject: {
        "/other-open": {
          "session-1": { type: "busy" },
        },
      },
    })

    expect(columns.progress).toHaveLength(1)
    expect(columns.progress[0]?.session.id).toBe("session-1")
    expect(columns.idle).toEqual([])
  })
})
