import { describe, expect, test } from "bun:test"
import { createRoot, getOwner, type Owner } from "solid-js"
import { createStore } from "solid-js/store"
import type { State } from "./types"
import { createChildStoreManager } from "./child-store"
import { ServerScope } from "@/runtime/server/scope"
import type { persisted } from "@/runtime/persistence/storage"

const persist: typeof persisted = (_target, _schema, initial) => [
  ...createStore(initial),
  null,
  Object.assign(() => true, { promise: undefined }),
]

const child = () => createStore({} as State)

function createOwner(callback: (owner: Owner) => void) {
  return createRoot((dispose) => {
    const owner = getOwner()
    if (!owner) throw new Error("owner required")
    callback(owner)

    return dispose
  })
}

function create(owner: Owner) {
  return createChildStoreManager({
    owner,
    scope: ServerScope.local,
    persist,
    translate: (key) => key,
  })
}

describe("createChildStoreManager", () => {
  test("does not evict the active directory during mark", () => {
    const owner = createRoot((dispose) => {
      const current = getOwner()
      dispose()
      return current
    })
    if (!owner) throw new Error("owner required")

    const manager = create(owner)

    Array.from({ length: 30 }, (_, index) => `/pinned-${index}`).forEach((directory) => {
      manager.children[directory] = child()
      manager.pin(directory)
    })

    const directory = "/active"
    manager.children[directory] = child()
    manager.mark(directory)

    expect(manager.children[directory]).toBeDefined()
  })

  test("creates passive stores holding only client-owned workspace state", () => {
    let manager: ReturnType<typeof create> | undefined
    const dispose = createOwner((owner) => {
      manager = create(owner)
    })

    try {
      if (!manager) throw new Error("manager required")
      const [store, setStore] = manager.child("/project")

      expect(store.project).toBe("")
      expect(store.projectMeta).toBeUndefined()
      expect(store.icon).toBeUndefined()
      setStore("project", "prj")
      expect(manager.child("/project")[0].project).toBe("prj")
    } finally {
      dispose()
    }
  })

  test("reads project metadata and icon directly from the persisted stores", () => {
    let manager: ReturnType<typeof create> | undefined
    const dispose = createOwner((owner) => {
      manager = create(owner)
    })

    try {
      if (!manager) throw new Error("manager required")
      const [store] = manager.child("/project")

      manager.projectMeta("/project", { name: "Repo", icon: { color: "blue" } })
      manager.projectMeta("/project", { icon: { override: "data:icon" }, commands: { start: "bun dev" } })
      manager.projectIcon("/project", "data:image")

      expect(store.projectMeta).toEqual({
        name: "Repo",
        icon: { color: "blue", override: "data:icon" },
        commands: { start: "bun dev" },
      })
      expect(store.icon).toBe("data:image")
      expect(manager.metaCache.get("/project")?.store.value).toBe(store.projectMeta)
      expect(manager.iconCache.get("/project")?.store.value).toBe("data:image")
    } finally {
      dispose()
    }
  })

  test("disposes unpinned directories and keeps pinned ones", () => {
    let manager: ReturnType<typeof create> | undefined
    const dispose = createOwner((owner) => {
      manager = create(owner)
    })

    try {
      if (!manager) throw new Error("manager required")
      manager.ensureChild("/idle")
      manager.ensureChild("/held")
      manager.pin("/held")

      expect(manager.disposeDirectory("/held" as never)).toBe(false)
      expect(manager.disposeDirectory("/idle" as never)).toBe(true)
      expect(manager.children["/idle"]).toBeUndefined()
      expect(manager.children["/held"]).toBeDefined()

      manager.unpin("/held")
      expect(manager.pinned("/held")).toBe(false)
    } finally {
      dispose()
    }
  })
})
