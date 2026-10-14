import { describe, expect, test } from "bun:test"
import { nextModelOption } from "./selector-navigation"

describe("model selector keyboard navigation", () => {
  const keys = ["favorite:a", "favorite:b", "recent:c", "provider:d"]

  test("starts at the first favorite with either arrow", () => {
    expect(nextModelOption(keys, undefined, 1)).toBe("favorite:a")
    expect(nextModelOption(keys, undefined, -1)).toBe("favorite:a")
  })

  test("follows displayed order and wraps after keyboard navigation begins", () => {
    expect(nextModelOption(keys, "favorite:a", 1)).toBe("favorite:b")
    expect(nextModelOption(keys, "favorite:b", 1)).toBe("recent:c")
    expect(nextModelOption(keys, "recent:c", -1)).toBe("favorite:b")
    expect(nextModelOption(keys, "provider:d", 1)).toBe("favorite:a")
    expect(nextModelOption(keys, "favorite:a", -1)).toBe("provider:d")
  })

  test("falls back to the first available result or handles empty results", () => {
    expect(nextModelOption(["recent:c"], undefined, 1)).toBe("recent:c")
    expect(nextModelOption(keys, "removed", -1)).toBe("favorite:a")
    expect(nextModelOption([], undefined, 1)).toBe("")
  })
})
