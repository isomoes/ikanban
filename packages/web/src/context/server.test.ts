import { describe, expect, test } from "bun:test"
import { ServerConnection } from "./server"

describe("ServerConnection.runtimeKey", () => {
  test("changes when credentials change for the same server URL", () => {
    const unauthenticated: ServerConnection.Http = {
      type: "http",
      http: { url: "http://localhost:4097" },
    }
    const authenticated: ServerConnection.Http = {
      type: "http",
      http: { url: "http://localhost:4097", username: "opencode", password: "secret" },
    }

    expect(ServerConnection.key(unauthenticated)).toBe(ServerConnection.key(authenticated))
    expect(ServerConnection.runtimeKey(unauthenticated)).not.toBe(ServerConnection.runtimeKey(authenticated))
  })
})
