import { describe, expect, test } from "bun:test"
import {
  buildDurationPrefix,
  buildInlineDurationDetail,
  formatTurnDurationLabel,
  getTurnDurationMs,
} from "./session-turn-duration"

describe("getTurnDurationMs", () => {
  test("returns elapsed milliseconds from the user start to latest assistant completion", () => {
    expect(
      getTurnDurationMs(
        { time: { created: 1_000 } },
        [{ time: { created: 2_000, completed: 65_000 } }, { time: { created: 3_000, completed: 20_000 } }],
      ),
    ).toBe(64_000)
  })

  test("returns undefined when the user start time is missing", () => {
    expect(getTurnDurationMs({ time: {} }, [{ time: { completed: 65_000 } }])).toBeUndefined()
  })

  test("returns undefined when assistant completion times are missing", () => {
    expect(getTurnDurationMs({ time: { created: 1_000 } }, [{ time: { created: 2_000 } }])).toBeUndefined()
  })

  test("returns undefined when completion is earlier than start", () => {
    expect(getTurnDurationMs({ time: { created: 5_000 } }, [{ time: { completed: 4_000 } }])).toBeUndefined()
  })
})

describe("formatTurnDurationLabel", () => {
  test("formats seconds-only durations", () => {
    expect(formatTurnDurationLabel(12_100)).toBe("12s")
  })

  test("formats minute-plus-second durations", () => {
    expect(formatTurnDurationLabel(64_000)).toBe("1m 04s")
  })

  test("returns an empty string for missing duration", () => {
    expect(formatTurnDurationLabel(undefined)).toBe("")
  })

  test("returns an empty string for invalid duration", () => {
    expect(formatTurnDurationLabel(-1)).toBe("")
  })
})

describe("buildInlineDurationDetail", () => {
  test("prefixes the detail with the duration label", () => {
    expect(buildInlineDurationDetail("Shows NVIDIA GPU and driver info", "7s")).toBe(
      "7s · Shows NVIDIA GPU and driver info",
    )
  })

  test("falls back to the detail when the duration label is missing", () => {
    expect(buildInlineDurationDetail("Shows NVIDIA GPU and driver info", "")).toBe(
      "Shows NVIDIA GPU and driver info",
    )
  })
})

describe("buildDurationPrefix", () => {
  test("formats a title-following duration prefix", () => {
    expect(buildDurationPrefix("11s")).toBe("11s · ")
  })

  test("returns an empty prefix when there is no duration", () => {
    expect(buildDurationPrefix("")).toBe("")
  })
})
