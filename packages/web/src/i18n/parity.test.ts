import { describe, expect, test } from "bun:test"
import { dict as en } from "./en"
import { dict as zh } from "./zh"

const keys = ["command.session.previous.unseen", "command.session.next.unseen"] as const

describe("i18n parity", () => {
  test("zh translates targeted unseen session keys", () => {
    for (const key of keys) {
      expect(zh[key]).toBeDefined()
      expect(zh[key]).not.toBe(en[key])
    }
  })
})
