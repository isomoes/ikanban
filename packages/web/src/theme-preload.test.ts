import { beforeEach, describe, expect, test } from "bun:test"

const src = await Bun.file(new URL("../public/oc-theme-preload.js", import.meta.url)).text()

const run = () => Function(src)()
const setSystemDark = (matches: boolean) =>
  Object.defineProperty(window, "matchMedia", {
    value: () => ({ matches }) as MediaQueryList,
    configurable: true,
  })

beforeEach(() => {
  document.head.innerHTML = ""
  document.documentElement.removeAttribute("data-theme")
  document.documentElement.removeAttribute("data-color-scheme")
  document.documentElement.style.removeProperty("background-color")
  localStorage.clear()
  setSystemDark(false)
})

describe("theme preload", () => {
  test("uses default theme and system light mode when settings are absent", () => {
    run()

    expect(document.documentElement.dataset.theme).toBe("oc-2")
    expect(document.documentElement.dataset.colorScheme).toBe("light")
    expect(document.documentElement.style.backgroundColor).toBe("#fafafa")
  })

  test("restores explicit dark mode on a light system", () => {
    localStorage.setItem("ikanban.v2.color-scheme", "dark")
    run()

    expect(document.documentElement.dataset.colorScheme).toBe("dark")
    expect(document.documentElement.style.backgroundColor).toBe("#080808")
  })

  test("restores explicit light mode on a dark system", () => {
    setSystemDark(true)
    localStorage.setItem("ikanban.v2.color-scheme", "light")
    run()

    expect(document.documentElement.dataset.colorScheme).toBe("light")
    expect(document.documentElement.style.backgroundColor).toBe("#fafafa")
  })

  test("resolves persisted system mode before paint", () => {
    setSystemDark(true)
    localStorage.setItem("ikanban.v2.color-scheme", "system")
    run()

    expect(document.documentElement.dataset.colorScheme).toBe("dark")
    expect(document.documentElement.style.backgroundColor).toBe("#080808")
  })

  test("keeps cached css for non-default themes", () => {
    localStorage.setItem("ikanban.v2.theme-id", "nightowl")
    localStorage.setItem("ikanban.v2.theme-css-light", "--background-base:#fff;")

    run()

    expect(document.documentElement.dataset.theme).toBe("nightowl")
    expect(document.getElementById("oc-theme-preload")?.textContent).toContain("--background-base:#fff;")
  })

  test("restores the cached variant for a persisted custom dark theme", () => {
    localStorage.setItem("ikanban.v2.theme-id", "nightowl")
    localStorage.setItem("ikanban.v2.color-scheme", "dark")
    localStorage.setItem("ikanban.v2.theme-css-dark", "--background-base:#010203;")
    run()

    expect(document.documentElement.dataset.theme).toBe("nightowl")
    expect(document.documentElement.dataset.colorScheme).toBe("dark")
    expect(document.getElementById("oc-theme-preload")?.textContent).toContain("--background-base:#010203;")
  })

  test("ignores and preserves legacy theme preferences and cached CSS", () => {
    localStorage.setItem("opencode-theme-id", "nightowl")
    localStorage.setItem("opencode-color-scheme", "dark")
    localStorage.setItem("opencode-theme-css-dark", "--background-base:#010203;")
    run()

    expect(document.documentElement.dataset.theme).toBe("oc-2")
    expect(document.documentElement.dataset.colorScheme).toBe("light")
    expect(document.getElementById("oc-theme-preload")).toBeNull()
    expect(localStorage.getItem("opencode-theme-id")).toBe("nightowl")
    expect(localStorage.getItem("opencode-color-scheme")).toBe("dark")
    expect(localStorage.getItem("opencode-theme-css-dark")).toBe("--background-base:#010203;")
  })
})
