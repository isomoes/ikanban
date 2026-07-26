import { describe, expect, test } from "bun:test"
import { formatToolDurationLabel, resolveToolDurationLabel } from "./session-turn-duration"

describe("formatToolDurationLabel", () => {
  test("hides durations that would display as zero", () => {
    expect(formatToolDurationLabel(0)).toBe("")
    expect(formatToolDurationLabel(49)).toBe("")
  })

  test("keeps the first meaningful tenth of a second", () => {
    expect(formatToolDurationLabel(50)).toBe("0.1s")
  })

  test("does not replace a known zero tool duration with the turn duration", () => {
    expect(resolveToolDurationLabel(0, "12s")).toBe("")
    expect(resolveToolDurationLabel(49, "12s")).toBe("")
  })

  test("uses the turn duration only when tool timing is unavailable", () => {
    expect(resolveToolDurationLabel(undefined, "12s")).toBe("12s")
  })
})
