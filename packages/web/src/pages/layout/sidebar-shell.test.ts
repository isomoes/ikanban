import { describe, expect, test } from "bun:test"
import { sidebarExpanded } from "./sidebar-shell-helpers"

const layoutSource = await Bun.file(new URL("../layout.tsx", import.meta.url)).text()
const projectSource = await Bun.file(new URL("./sidebar-project.tsx", import.meta.url)).text()
const workspaceSource = await Bun.file(new URL("./sidebar-workspace.tsx", import.meta.url)).text()
const itemsSource = await Bun.file(new URL("./sidebar-items.tsx", import.meta.url)).text()
const cockpitStyles = await Bun.file(new URL("./sidebar-cockpit.css", import.meta.url))
  .text()
  .catch(() => "")

describe("sidebarExpanded", () => {
  test("expands on mobile regardless of desktop open state", () => {
    expect(sidebarExpanded(true, false)).toBe(true)
  })

  test("stays closed on desktop now that the helper only models mobile expansion", () => {
    expect(sidebarExpanded(false, true)).toBe(false)
    expect(sidebarExpanded(false, false)).toBe(false)
  })
})

describe("sidebar navigation surfaces", () => {
  test("keeps the desktop cockpit sidebar-free", () => {
    expect(layoutSource).not.toContain('data-component="sidebar-nav-desktop"')
    expect(layoutSource).toContain('data-component="sidebar-nav-mobile"')
  })

  test("removes the closed mobile drawer from accessibility navigation", () => {
    expect(layoutSource).toContain("inert={!layout.mobileSidebar.opened()}")
    expect(layoutSource).toContain("aria-hidden={!layout.mobileSidebar.opened()}")
  })

  test("marks current project, workspace, and session links", () => {
    expect(projectSource).toContain("data-current={props.selected() ? true : undefined}")
    expect(projectSource).toContain('aria-current={props.selected() ? "page" : undefined}')
    expect(workspaceSource).toContain("data-current={active() ? true : undefined}")
    expect(itemsSource).toContain("data-current={props.active() ? true : undefined}")
    expect(itemsSource).toContain('aria-current={props.active() ? "page" : undefined}')
  })

  test("keeps workspace overflow controls reachable on mobile and touch devices", () => {
    expect(workspaceSource).toContain("props.mobile || props.touch()")
  })
})

describe("sidebar cockpit styling", () => {
  test("uses compact rail and row metrics", () => {
    expect(cockpitStyles).toContain("--sidebar-project-pitch: 48px")
    expect(cockpitStyles).toContain("--sidebar-row-height: 28px")
    expect(cockpitStyles).toContain("--sidebar-section-gap: 8px")
  })
})
