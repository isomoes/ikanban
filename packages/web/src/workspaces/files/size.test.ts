import { describe, expect, test } from "bun:test"
import { formatBytes } from "./size"

describe("file size labels", () => {
  test("formats bytes including empty files", () => {
    expect(formatBytes("en", 0)).toBe("0 bytes")
    expect(formatBytes("en", 1)).toBe("1 byte")
    expect(formatBytes("en", 25)).toBe("25 bytes")
  })

  test("keeps larger sizes compact", () => {
    expect(formatBytes("en", 616_000)).toBe("616 kB")
    expect(formatBytes("en", 1_500_000)).toBe("1.5 MB")
    expect(formatBytes("en", 2_000_000_000)).toBe("2 GB")
  })
})
