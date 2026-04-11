import { describe, expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createTitlebarPortalMount } from "./titlebar-portal-mount"

describe("createTitlebarPortalMount", () => {
  test("picks up a titlebar mount added after creation", async () => {
    document.body.innerHTML = ""

    await new Promise<void>((resolve) => {
      createRoot((dispose) => {
        const mount = createTitlebarPortalMount("opencode-titlebar-right")

        expect(mount()).toBeUndefined()

        const el = document.createElement("div")
        el.id = "opencode-titlebar-right"
        document.body.append(el)

        queueMicrotask(() => {
          expect(mount()).toBe(el)
          dispose()
          resolve()
        })
      })
    })
  })

  test("updates when the titlebar mount gets replaced", async () => {
    document.body.innerHTML = '<div id="opencode-titlebar-right"></div>'
    const initial = document.getElementById("opencode-titlebar-right") ?? undefined

    await new Promise<void>((resolve) => {
      createRoot((dispose) => {
        const mount = createTitlebarPortalMount("opencode-titlebar-right")

        expect(mount()).toBe(initial)

        initial?.remove()
        const replacement = document.createElement("div")
        replacement.id = "opencode-titlebar-right"
        document.body.append(replacement)

        queueMicrotask(() => {
          expect(mount()).toBe(replacement)
          dispose()
          resolve()
        })
      })
    })
  })
})
