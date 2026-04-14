import { describe, expect, test } from "bun:test"
import { resolveNodeSessionState } from "./session-ikanban-node-state"

describe("resolveNodeSessionState", () => {
  test("returns unstart when the node has no linked session", () => {
    expect(resolveNodeSessionState({})).toBe("unstart")
  })

  test("returns starting when a linked session exists and is not finished", () => {
    expect(resolveNodeSessionState({ sessionID: "session-1" })).toBe("starting")
  })

  test("returns finish when the linked session is marked finished", () => {
    expect(resolveNodeSessionState({ sessionID: "session-1", finished: true })).toBe("finish")
  })

  test("prefers unstart when no session is stored even if finished is true", () => {
    expect(resolveNodeSessionState({ finished: true })).toBe("unstart")
  })
})
