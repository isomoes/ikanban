import { describe, expect, test } from "bun:test"
import { sidebarExpanded } from "./sidebar-shell-helpers"

describe("sidebarExpanded", () => {
  test("expands on mobile regardless of desktop open state", () => {
    expect(sidebarExpanded(true, false)).toBe(true)
  })

  test("stays closed on desktop now that the sidebar pane is removed", () => {
    expect(sidebarExpanded(false, true)).toBe(false)
    expect(sidebarExpanded(false, false)).toBe(false)
  })
})
