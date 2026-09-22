import { afterEach, beforeEach, expect, test } from "bun:test"
import { MemoryRouter, createMemoryHistory } from "@solidjs/router"
import { createComponent, render } from "solid-js/web"
import { isStandalone, PwaRoutePersistence, restorePwaRoute } from "../src/runtime/platform/pwa"
import { appBase, appHref } from "../src/shell/routes/base"

const key = "ikanban.v2.pwa.last-route"
const originalUrl = window.location.href

beforeEach(() => {
  window.location.href = `http://localhost${appHref("/")}`
})

afterEach(() => {
  localStorage.removeItem(key)
  window.location.href = originalUrl
})

test("normal browser windows are not standalone", () => {
  expect(isStandalone()).toBe(false)
})

test("detects iOS home-screen apps when the standalone media query does not match", () => {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "standalone")
  Object.defineProperty(navigator, "standalone", { configurable: true, value: true })
  try {
    expect(window.matchMedia("(display-mode: standalone)").matches).toBe(false)
    expect(isStandalone()).toBe(true)
  } finally {
    if (descriptor) Object.defineProperty(navigator, "standalone", descriptor)
    if (!descriptor) delete (navigator as Navigator & { standalone?: boolean }).standalone
  }
})

test("restores the last PWA route including query and hash without adding history", () => {
  window.history.replaceState({ retained: true }, "", appHref("/"))
  const length = window.history.length
  localStorage.setItem(key, appHref("/server/local/session/session-1?view=files#file"))

  restorePwaRoute()

  expect(window.location.pathname + window.location.search + window.location.hash).toBe(
    appHref("/server/local/session/session-1?view=files#file"),
  )
  expect(window.history.length).toBe(length)
  expect(window.history.state).toEqual({ retained: true })
})

test("preserves explicit launch routes, queries, and hashes", () => {
  localStorage.setItem(key, appHref("/server/local/session/saved"))
  for (const route of ["/server/local/session/linked", "/new-session?draftId=123", "/?launch=1", "/#launch"]) {
    window.history.replaceState(null, "", appHref(route))
    restorePwaRoute()
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(appHref(route))
  }
})

test("ignores missing, invalid, external, and auth-bearing saved routes", () => {
  restorePwaRoute()
  expect(window.location.pathname).toBe(appHref("/"))

  for (const value of [
    appHref("/removed-route"),
    `https://example.com${appHref("/new-session")}`,
    `//example.com${appHref("/new-session")}`,
    "http://[",
    appHref("/new-session?auth_token=secret"),
    "/new-session",
    "/server/local/session/outside-app",
    "/ikanban-other/new-session",
    "/ikanban/../new-session",
  ]) {
    localStorage.setItem(key, value)
    restorePwaRoute()
    expect(window.location.href).toBe(`http://localhost${appHref("/")}`)
  }
})

test("persists router navigation including returning home", async () => {
  const host = document.createElement("div")
  const history = createMemoryHistory()
  history.set({ value: appHref("/new-session?draftId=123"), replace: true, scroll: false })
  const dispose = render(() => createComponent(MemoryRouter, { history, base: appBase, root: PwaRoutePersistence }), host)
  try {
    expect(localStorage.getItem(key)).toBe(appHref("/new-session?draftId=123"))
    history.set({ value: appHref("/server/local/session/next#file"), scroll: false })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(localStorage.getItem(key)).toBe(appHref("/server/local/session/next#file"))
    history.set({ value: appHref("/"), scroll: false })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(localStorage.getItem(key)).toBe(appHref("/"))
  } finally {
    dispose()
  }
})

test("restores from the base without a trailing slash, but never from the origin root", () => {
  const saved = appHref("/new-session?draftId=saved#composer")
  localStorage.setItem(key, saved)
  window.history.replaceState(null, "", "/")
  restorePwaRoute()
  expect(window.location.pathname).toBe("/")

  window.history.replaceState(null, "", appBase)
  restorePwaRoute()
  expect(window.location.pathname + window.location.search + window.location.hash).toBe(saved)
})

test("does not persist authentication links", () => {
  const saved = appHref("/server/local/session/saved")
  localStorage.setItem(key, saved)
  const host = document.createElement("div")
  const history = createMemoryHistory()
  history.set({ value: appHref("/new-session?auth_token=secret"), replace: true, scroll: false })
  const dispose = render(() => createComponent(MemoryRouter, { history, base: appBase, root: PwaRoutePersistence }), host)
  try {
    expect(localStorage.getItem(key)).toBe(saved)
  } finally {
    dispose()
  }
})
