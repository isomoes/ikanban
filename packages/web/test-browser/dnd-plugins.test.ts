import { expect, test } from "bun:test"
import { DragDropManager, Feedback } from "@dnd-kit/dom"

test("updating drag plugins preserves the required DOM plugins", () => {
  const manager = new DragDropManager({ plugins: [], sensors: [] })

  try {
    const required = manager.plugins.map((plugin) => plugin.constructor)
    expect(required.map((plugin) => plugin.name)).toEqual(
      expect.arrayContaining(["ScrollListener", "Scroller", "_StyleInjector"]),
    )

    manager.plugins = [Feedback]
    expect(manager.plugins.map((plugin) => plugin.constructor)).toEqual(expect.arrayContaining([...required, Feedback]))

    manager.plugins = []
    expect(manager.plugins.map((plugin) => plugin.constructor)).toEqual(required)
  } finally {
    manager.destroy()
  }
})
