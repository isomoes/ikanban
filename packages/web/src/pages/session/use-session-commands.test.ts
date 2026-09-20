import { describe, expect, test } from "bun:test"
import { canAddSelectionContext, restartOpenCode } from "./session-command-helpers"

describe("canAddSelectionContext", () => {
  test("returns false without active tab", () => {
    expect(
      canAddSelectionContext({
        active: undefined,
        pathFromTab: () => "src/a.ts",
        selectedLines: () => ({ start: 1, end: 1 }),
      }),
    ).toBe(false)
  })

  test("returns false when active tab is not a file", () => {
    expect(
      canAddSelectionContext({
        active: "context",
        pathFromTab: () => undefined,
        selectedLines: () => ({ start: 1, end: 1 }),
      }),
    ).toBe(false)
  })

  test("returns false without selected lines", () => {
    expect(
      canAddSelectionContext({
        active: "file://src/a.ts",
        pathFromTab: () => "src/a.ts",
        selectedLines: () => null,
      }),
    ).toBe(false)
  })

  test("returns true when file and selection exist", () => {
    expect(
      canAddSelectionContext({
        active: "file://src/a.ts",
        pathFromTab: () => "src/a.ts",
        selectedLines: () => ({ start: 1, end: 2 }),
      }),
    ).toBe(true)
  })
})

describe("restartOpenCode", () => {
  test("disposes the project before reloading config, skills, and MCPs", async () => {
    const calls: string[] = []
    let releaseDispose: (() => void) | undefined
    const disposed = new Promise<void>((resolve) => {
      releaseDispose = resolve
    })

    const restarting = restartOpenCode({
      directory: "/projects/ikanban",
      dispose: async (input) => {
        calls.push(`dispose:${input.directory}`)
        await disposed
      },
      loadConfig: async () => calls.push("config"),
      loadSkills: async () => calls.push("skills"),
      loadMcp: async () => calls.push("mcp"),
    })

    await Promise.resolve()
    expect(calls).toEqual(["dispose:/projects/ikanban"])

    releaseDispose?.()
    await restarting
    expect(calls.slice(1).sort()).toEqual(["config", "mcp", "skills"])
  })
})
