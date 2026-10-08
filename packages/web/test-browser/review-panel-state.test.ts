import { afterEach, beforeAll, expect, mock, test } from "bun:test"
import { createRoot } from "solid-js"
import type { Platform } from "@/runtime/platform/platform"
import type { ReviewPanelState } from "@/session/review/panel-state"

let createReviewPanelState: (platform?: Platform) => ReviewPanelState

const key = "ikanban.v2.global.dat:review-panel-v2"

const platform: Platform = {
  openExternal: () => undefined,
  restart: async () => undefined,
  notify: async () => undefined,
}

beforeAll(async () => {
  mock.module("@ikanban/session-ui/v2/session-review-v2", () => ({
    SESSION_REVIEW_V2_SIDEBAR_WIDTH_DEFAULT: 240,
    SESSION_REVIEW_V2_SIDEBAR_WIDTH_MIN: 200,
    SESSION_REVIEW_V2_SIDEBAR_WIDTH_MAX: 480,
  }))

  createReviewPanelState = (await import("@/session/review/panel-state")).createReviewPanelState
})

afterEach(() => localStorage.clear())

test("restores a stored custom width", () => {
  const root = createPanel({ sidebarOpened: true, sidebarWidth: 360, expandMode: "collapse" })
  expect(root.state.sidebarWidth()).toBe(360)
  root.dispose()
})

test("recovers malformed preferences independently and keeps the filter transient", () => {
  localStorage.setItem(
    key,
    JSON.stringify({ sidebarOpened: false, sidebarWidth: "wide", expandMode: "invalid", filter: "stored" }),
  )
  const root = createPanel()
  root.state.setFilter("transient")
  expect(root.state.sidebarOpened()).toBeFalse()
  expect(root.state.sidebarWidth()).toBe(240)
  expect(root.state.expandMode()).toBe("collapse")
  expect(root.state.filter()).toBe("transient")
  root.dispose()
})

test.each([0, 199, 481, null])("rejects invalid persisted sidebar width %p", (sidebarWidth) => {
  const root = createPanel({ sidebarWidth, expandMode: "expand" })
  expect(root.state.sidebarWidth()).toBe(240)
  expect(root.state.sidebarOpened()).toBeTrue()
  expect(root.state.expandMode()).toBe("expand")
  root.state.resizeSidebar(1000)
  expect(root.state.sidebarWidth()).toBe(480)
  root.state.resizeSidebar(0)
  expect(root.state.sidebarWidth()).toBe(200)
  root.dispose()
})

function createPanel(stored?: unknown) {
  if (stored !== undefined) localStorage.setItem(key, JSON.stringify(stored))
  return createRoot((dispose) => ({ dispose, state: createReviewPanelState(platform) }))
}
