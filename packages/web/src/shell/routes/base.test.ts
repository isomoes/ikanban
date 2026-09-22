import { describe, expect, test } from "bun:test"
import { appHref, normalizeBase, preloadPathname, stripBase } from "./base"

describe("deployment base", () => {
  test.each(["ikanban", "/ikanban", "/ikanban/", "//ikanban//"])("normalizes %s", (base) => {
    expect(normalizeBase(base)).toBe("/ikanban")
    expect(appHref("/new-session?draftId=a%2Fb#composer", base)).toBe(
      "/ikanban/new-session?draftId=a%2Fb#composer",
    )
    expect(appHref("/", base)).toBe("/ikanban/")
  })

  test("supports root and nested deployment bases", () => {
    expect(normalizeBase("/")).toBe("")
    expect(appHref("/settings", "/")).toBe("/settings")
    expect(stripBase("/settings", "/")).toBe("/settings")
    expect(stripBase("/tools/ikanban/settings", "/tools/ikanban/")).toBe("/settings")
  })

  test("strips only a complete base path segment", () => {
    expect(stripBase("/ikanban", "/ikanban/")).toBe("/")
    expect(stripBase("/ikanban/", "/ikanban/")).toBe("/")
    expect(stripBase("/ikanban/server/encoded/session/session-1", "/ikanban/")).toBe(
      "/server/encoded/session/session-1",
    )
    for (const path of ["/", "/settings", "/ikanban-other/settings", "/ikanbanana", "//ikanban/settings"]) {
      expect(stripBase(path, "/ikanban/")).toBeUndefined()
    }
  })

  test("preloads internal targets and deployed deep links with search, hash, and trailing slash", () => {
    for (const path of ["/new-session", "/settings", "/server/encoded/session/session-1"]) {
      expect(preloadPathname(`${path}?draftId=draft#message`, "/ikanban/")).toBe(path)
      expect(preloadPathname(`/ikanban${path}/?draftId=draft#message`, "/ikanban/")).toBe(path)
      expect(preloadPathname(`https://example.com/ikanban${path}?draftId=draft#message`, "/ikanban/")).toBe(path)
    }
    expect(preloadPathname("/ikanban/", "/ikanban/")).toBe("/")
    expect(preloadPathname("/ikanban-other/settings", "/ikanban/")).toBe("/ikanban-other/settings")
    expect(preloadPathname("http://[", "/ikanban/")).toBeUndefined()
  })
})
