import { describe, expect, test } from "bun:test"
import { createPasteUndoHistory } from "./paste-undo"

describe("prompt-input paste undo", () => {
  test("restores programmatic paste snapshots from newest to oldest", () => {
    const history = createPasteUndoHistory<string>()

    history.push("first")
    history.push("second")

    expect(history.pop()).toBe("second")
    expect(history.pop()).toBe("first")
    expect(history.pop()).toBeUndefined()
  })

  test("clears stale paste snapshots after another edit", () => {
    const history = createPasteUndoHistory<string>()

    history.push("draft")
    history.clear()

    expect(history.pop()).toBeUndefined()
  })

  test("commits a captured snapshot after a synchronous input clears history", () => {
    const history = createPasteUndoHistory<string>()
    const commit = history.capture("before paste")

    history.clear()
    commit()

    expect(history.pop()).toBe("before paste")
  })

  test("inspects a pending snapshot without consuming it", () => {
    const history = createPasteUndoHistory<string>()
    history.push("before paste")

    expect(history.peek()).toBe("before paste")
    expect(history.pop()).toBe("before paste")
  })
})
