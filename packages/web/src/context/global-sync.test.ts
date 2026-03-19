import { describe, expect, test } from "bun:test"
import {
  canDisposeDirectory,
  estimateRootSessionTotal,
  loadRootSessionsWithFallback,
  pickDirectoriesToEvict,
} from "./global-sync"
import { bootstrapGlobal } from "./global-sync/bootstrap"
import { shouldLoadProjectsOnBootstrap } from "./global-sync/bootstrap-mode"

describe("pickDirectoriesToEvict", () => {
  test("keeps pinned stores and evicts idle stores", () => {
    const now = 5_000
    const picks = pickDirectoriesToEvict({
      stores: ["a", "b", "c", "d"],
      state: new Map([
        ["a", { lastAccessAt: 1_000 }],
        ["b", { lastAccessAt: 4_900 }],
        ["c", { lastAccessAt: 4_800 }],
        ["d", { lastAccessAt: 3_000 }],
      ]),
      pins: new Set(["a"]),
      max: 2,
      ttl: 1_500,
      now,
    })

    expect(picks).toEqual(["d", "c"])
  })
})

describe("loadRootSessionsWithFallback", () => {
  test("uses limited roots query when supported", async () => {
    const calls: Array<{ directory: string; roots: true; limit?: number }> = []

    const result = await loadRootSessionsWithFallback({
      directory: "dir",
      limit: 10,
      list: async (query) => {
        calls.push(query)
        return { data: [] }
      },
    })

    expect(result.data).toEqual([])
    expect(result.limited).toBe(true)
    expect(calls).toEqual([{ directory: "dir", roots: true, limit: 10 }])
  })

  test("falls back to full roots query on limited-query failure", async () => {
    const calls: Array<{ directory: string; roots: true; limit?: number }> = []

    const result = await loadRootSessionsWithFallback({
      directory: "dir",
      limit: 25,
      list: async (query) => {
        calls.push(query)
        if (query.limit) throw new Error("unsupported")
        return { data: [] }
      },
    })

    expect(result.data).toEqual([])
    expect(result.limited).toBe(false)
    expect(calls).toEqual([
      { directory: "dir", roots: true, limit: 25 },
      { directory: "dir", roots: true },
    ])
  })
})

describe("estimateRootSessionTotal", () => {
  test("keeps exact total for full fetches", () => {
    expect(estimateRootSessionTotal({ count: 42, limit: 10, limited: false })).toBe(42)
  })

  test("marks has-more for full-limit limited fetches", () => {
    expect(estimateRootSessionTotal({ count: 10, limit: 10, limited: true })).toBe(11)
  })

  test("keeps exact total when limited fetch is under limit", () => {
    expect(estimateRootSessionTotal({ count: 9, limit: 10, limited: true })).toBe(9)
  })
})

describe("canDisposeDirectory", () => {
  test("rejects pinned or inflight directories", () => {
    expect(
      canDisposeDirectory({
        directory: "dir",
        hasStore: true,
        pinned: true,
        booting: false,
        loadingSessions: false,
      }),
    ).toBe(false)
    expect(
      canDisposeDirectory({
        directory: "dir",
        hasStore: true,
        pinned: false,
        booting: true,
        loadingSessions: false,
      }),
    ).toBe(false)
    expect(
      canDisposeDirectory({
        directory: "dir",
        hasStore: true,
        pinned: false,
        booting: false,
        loadingSessions: true,
      }),
    ).toBe(false)
  })

  test("accepts idle unpinned directory store", () => {
    expect(
      canDisposeDirectory({
        directory: "dir",
        hasStore: true,
        pinned: false,
        booting: false,
        loadingSessions: false,
      }),
    ).toBe(true)
  })
})

describe("bootstrapGlobal", () => {
  test("does not call project list when project loading is disabled", async () => {
    let projectListCalls = 0
    const project = {
      list: async () => {
        projectListCalls += 1
        return { data: [] }
      },
    }

    const updates: Array<[string, unknown]> = []

    await bootstrapGlobal({
      globalSDK: {
        global: {
          health: async () => ({ data: { healthy: true } }),
          config: { get: async () => ({ data: {} }) },
        },
        path: { get: async () => ({ data: { state: "", config: "", worktree: "", directory: "", home: "" } }) },
        project,
        provider: {
          list: async () => ({ data: { all: [], connected: [], default: {} } }),
          auth: async () => ({ data: {} }),
        },
      } as never,
      connectErrorTitle: "connect",
      connectErrorDescription: "connect desc",
      requestFailedTitle: "request",
      unknownError: "unknown",
      invalidConfigurationError: "invalid",
      formatMoreCount: () => "",
      setGlobalStore: ((key: string, value: unknown) => {
        updates.push([key, value])
        return value
      }) as never,
      loadProjects: false,
    } as never)

    expect(projectListCalls).toBe(0)
    expect(updates.some(([key]) => key === "ready")).toBe(true)
  })
})

describe("shouldLoadProjectsOnBootstrap", () => {
  test("skips project loading on the home route", () => {
    expect(shouldLoadProjectsOnBootstrap("/", "/")).toBe(false)
    expect(shouldLoadProjectsOnBootstrap("/ikanban", "/ikanban/")).toBe(false)
  })

  test("loads projects away from the home route", () => {
    expect(shouldLoadProjectsOnBootstrap("/dGVzdA", "/")).toBe(true)
    expect(shouldLoadProjectsOnBootstrap("/ikanban/dGVzdA", "/ikanban/")).toBe(true)
  })
})
