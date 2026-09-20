import { describe, expect, test } from "bun:test"

const errorSource = await Bun.file(new URL("error.tsx", import.meta.url)).text()

describe("error page structure", () => {
  test("announces error recovery failures", () => {
    expect(errorSource).toContain('role="alert"')
    expect(errorSource).toContain("store.installing")
  })

  test("gates supported actions and exposes their busy state", () => {
    expect(errorSource).toContain("when={platform.restart}")
    expect(errorSource).toContain("when={platform.checkUpdate && platform.update && platform.restart}")
    expect(errorSource).toContain("disabled={store.checking || store.installing}")
  })

  test("uses a compact two-region cockpit layout", () => {
    expect(errorSource).toContain("min-h-dvh")
    expect(errorSource).not.toContain("h-screen")
    expect(errorSource).toContain('data-component="error-summary"')
    expect(errorSource).toContain('data-component="error-diagnostics"')
  })
})
