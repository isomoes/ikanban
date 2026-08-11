import { describe, expect, test } from "bun:test"
import { createSdkForServer } from "./server"

describe("createSdkForServer", () => {
  test("uses the V2 health route and server credentials", async () => {
    const requests: Request[] = []
    const client = createSdkForServer({
      server: { url: "http://localhost:4097", username: "opencode", password: "secret" },
      fetch: (async (input, init) => {
        const request = new Request(input, init)
        requests.push(request)
        return Response.json({ healthy: true, version: "2.0.0", pid: 1 })
      }) as typeof globalThis.fetch,
    })

    await client.health.get()

    expect(requests[0]?.url).toBe("http://localhost:4097/api/health")
    expect(requests[0]?.headers.get("authorization")).toBe(`Basic ${btoa("opencode:secret")}`)
  })
})
