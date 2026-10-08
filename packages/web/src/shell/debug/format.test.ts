import { describe, expect, test } from "bun:test"
import { bad, duration, fixed, mb, ms, session, time } from "./format"

describe("debug bar formatting", () => {
  test("returns undefined for missing or NaN values", () => {
    for (const format of [ms, time, fixed, mb, duration]) {
      expect(format(undefined)).toBeUndefined()
      expect(format(Number.NaN)).toBeUndefined()
    }
  })

  test("formats numbers", () => {
    expect(ms(12.345, 1)).toBe("12.3ms")
    expect(time(12.6)).toBe("13")
    expect(fixed(1.234, 1)).toBe("1.2")
    expect(mb(512 * 1024 * 1024)).toBe("512.0MB")
    expect(mb(2048 * 1024 * 1024)).toBe("2048MB")
  })

  test("formats durations", () => {
    expect(duration(250.4)).toBe("250ms")
    expect(duration(1500)).toBe("1.5s")
    expect(duration(12_000)).toBe("12s")
  })

  test("flags values past a limit", () => {
    expect(bad(10, 5)).toBe(true)
    expect(bad(3, 5, true)).toBe(true)
    expect(bad(undefined, 5)).toBe(false)
  })

  test("detects session paths", () => {
    expect(session("/server/session/abc")).toBe(true)
    expect(session("/home")).toBe(false)
  })
})
