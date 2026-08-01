import { describe, expect, test } from "bun:test"
import { parseArgs, startIkanban } from "./index"
import type { AgentRuntime } from "./protocol"

describe("parseArgs", () => {
  test("parses a port and repeatable project roots", () => {
    expect(parseArgs(["--port", "4010", "--project", "/one", "--project", "/two"], "/cwd")).toEqual({
      port: 4010,
      roots: ["/one", "/two"],
    })
  })

  test("defaults to port 3000 and the current directory", () => {
    expect(parseArgs([], "/cwd")).toEqual({ port: 3000, roots: ["/cwd"] })
  })

  test("rejects missing, unknown, and invalid values", () => {
    for (const args of [["--project"], ["--unknown"], ["--port", "0"], ["--port", "word"]]) {
      expect(() => parseArgs(args, "/cwd")).toThrow()
    }
  })
})

test("startup creates one runtime and one Bun server and disposes both once", async () => {
  let runtimeCount = 0
  let serveCount = 0
  let stopCount = 0
  let disposeCount = 0
  let fetchHandler: ((request: Request) => Response | Promise<Response>) | undefined
  const signals: string[] = []
  const runtime = {
    dispose: async () => { disposeCount++ },
  } as unknown as AgentRuntime & { dispose(): Promise<void> }

  const service = startIkanban({
    args: ["--project", "/one", "--project", "/two"],
    cwd: "/cwd",
    root: "/web/dist",
    createRuntime: (roots) => {
      runtimeCount++
      expect(roots).toEqual(["/one", "/two"])
      return runtime
    },
    serve: (options) => {
      serveCount++
      expect(options.port).toBe(3000)
      expect(options.fetch).toBeFunction()
      fetchHandler = options.fetch
      return {
        url: new URL("http://localhost:3000/"),
        stop: async () => { stopCount++ },
      }
    },
    registerSignal: (signal) => { signals.push(signal) },
  })

  expect(runtimeCount).toBe(1)
  expect(serveCount).toBe(1)
  expect(signals).toEqual(["SIGINT", "SIGTERM"])
  const health = await fetchHandler!(new Request("http://localhost/ikanban/global/health"))
  expect(await health.json()).toEqual({ healthy: true })

  await service.shutdown()
  await service.shutdown()

  expect(stopCount).toBe(1)
  expect(disposeCount).toBe(1)
})
