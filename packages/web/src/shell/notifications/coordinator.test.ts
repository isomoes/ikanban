import { afterEach, describe, expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createNotificationCoordinator } from "./coordinator"

afterEach(() => {
  localStorage.removeItem("ikanban.v2.notification-sound")
  localStorage.removeItem("opencode:notification-sound")
})

describe("notification storage isolation", () => {
  test("claims events independently of other apps on the same origin", async () => {
    const legacy = JSON.stringify(["sound:event-1"])
    localStorage.setItem("opencode:notification-sound", legacy)
    const root = createRoot((dispose) => ({ dispose, coordinator: createNotificationCoordinator() }))
    let played = 0
    try {
      await root.coordinator.sound("event-1", () => void played++)
      await root.coordinator.sound("event-1", () => void played++)

      expect(played).toBe(1)
      expect(localStorage.getItem("ikanban.v2.notification-sound")).toBe(legacy)
      expect(localStorage.getItem("opencode:notification-sound")).toBe(legacy)
    } finally {
      root.dispose()
    }
  })

  test("deduplicates claims made by another iKanban coordinator", async () => {
    localStorage.setItem("ikanban.v2.notification-sound", JSON.stringify(["sound:event-2"]))
    const root = createRoot((dispose) => ({ dispose, coordinator: createNotificationCoordinator() }))
    let played = 0
    try {
      await root.coordinator.sound("event-2", () => void played++)
      expect(played).toBe(0)
    } finally {
      root.dispose()
    }
  })
})
