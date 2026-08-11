import { describe, expect, test } from "bun:test"
import type { SessionMessageInfo as Message } from "@opencode-ai/client"
import { sessionHistoryChanges } from "./sidebar-session-changes"

describe("sessionHistoryChanges", () => {
  test("does not invent V1 summary data for native messages", () => {
    const messages = [{ id: "user", type: "user", text: "", time: { created: 1 } }] as Message[]
    expect(sessionHistoryChanges(undefined, messages)).toBeUndefined()
  })

  test("returns undefined before history loads", () => {
    expect(sessionHistoryChanges(undefined, undefined)).toBeUndefined()
  })
})
