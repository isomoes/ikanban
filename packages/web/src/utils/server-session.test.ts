import { describe, expect, test } from "bun:test"
import { ServerSession } from "./server-session"

function storage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe("ServerSession", () => {
  test("restores the active server independently for each browser tab", () => {
    const firstTab = storage()
    const secondTab = storage()

    ServerSession.write("http://server-one:4097", firstTab)
    ServerSession.write("http://server-two:4097", secondTab)

    expect(ServerSession.read("http://default:4097", firstTab)).toBe("http://server-one:4097")
    expect(ServerSession.read("http://default:4097", secondTab)).toBe("http://server-two:4097")
  })

  test("uses the default server when the tab has no saved selection", () => {
    expect(ServerSession.read("http://default:4097", storage())).toBe("http://default:4097")
  })
})
