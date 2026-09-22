import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test"
import { ServerScope } from "@/runtime/server/scope"
import { Schema } from "effect"
import { renderToString } from "solid-js/web"
import { flushPersisted } from "./persist"
import { Persistence } from "./schema"

type PersistTestingType = typeof import("./storage").PersistTesting
type PersistType = typeof import("./storage").Persist
type RemovePersistedType = typeof import("./storage").removePersisted
type PersistedType = typeof import("./storage").persisted

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  readonly events: string[] = []
  readonly calls = { get: 0, set: 0, remove: 0 }

  clear() {
    this.values.clear()
  }

  get length() {
    return this.values.size
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null
  }

  getItem(key: string) {
    this.calls.get += 1
    this.events.push(`get:${key}`)
    if (key.startsWith("ikanban.v2.throw")) throw new Error("storage get failed")
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.calls.set += 1
    this.events.push(`set:${key}`)
    if (key.startsWith("ikanban.v2.quota")) throw new DOMException("quota", "QuotaExceededError")
    if (key.startsWith("ikanban.v2.throw")) throw new Error("storage set failed")
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.calls.remove += 1
    this.events.push(`remove:${key}`)
    if (key.startsWith("ikanban.v2.throw")) throw new Error("storage remove failed")
    this.values.delete(key)
  }
}

const storage = new MemoryStorage()

let persistTesting: PersistTestingType
let Persist: PersistType
let removePersisted: RemovePersistedType
let persisted: PersistedType

beforeAll(async () => {
  mock.module("@/runtime/platform/platform", () => ({
    usePlatform: () => ({ platform: "web" }),
  }))

  const mod = await import("./storage")
  persistTesting = mod.PersistTesting
  Persist = mod.Persist
  removePersisted = mod.removePersisted
  persisted = mod.persisted
})

beforeEach(() => {
  storage.clear()
  storage.events.length = 0
  storage.calls.get = 0
  storage.calls.set = 0
  storage.calls.remove = 0
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  })
})

describe("persist localStorage resilience", () => {
  test("does not cache values as persisted when quota write and eviction fail", () => {
    const storageApi = persistTesting.localStorageWithPrefix("ikanban.v2.quota.scope")
    storageApi.setItem("value", '{"value":1}')

    expect(storage.getItem("ikanban.v2.quota.scope:value")).toBeNull()
    expect(storageApi.getItem("value")).toBeNull()
  })

  test("disables only the failing scope when storage throws", () => {
    const bad = persistTesting.localStorageWithPrefix("ikanban.v2.throw.scope")
    bad.setItem("value", '{"value":1}')

    const before = storage.calls.set
    bad.setItem("value", '{"value":2}')
    expect(storage.calls.set).toBe(before)
    expect(bad.getItem("value")).toBeNull()

    const healthy = persistTesting.localStorageWithPrefix("ikanban.v2.safe.scope")
    healthy.setItem("value", '{"value":3}')
    expect(storage.getItem("ikanban.v2.safe.scope:value")).toBe('{"value":3}')
  })

  test("failing fallback scope does not poison direct storage scope", () => {
    const broken = persistTesting.localStorageWithPrefix("ikanban.v2.throw.scope2")
    broken.setItem("value", '{"value":1}')

    const direct = persistTesting.localStorageDirect()
    direct.setItem("direct-value", '{"value":5}')

    expect(storage.getItem("ikanban.v2.direct.dat:direct-value")).toBe('{"value":5}')
  })

  test("workspace storage sanitizes Windows filename characters", () => {
    const result = persistTesting.workspaceStorage("C:\\Users\\foo")

    expect(result).toStartWith("ikanban.v2.workspace.")
    expect(result.endsWith(".dat")).toBeTrue()
    expect(/[:\\/]/.test(result)).toBeFalse()
  })

  test("workspace target keeps raw path storage as a relocation source", () => {
    const target = Persist.workspace("C:\\Users\\foo", "vcs")

    expect(target.storage).toBe(persistTesting.workspaceStorage("C:/Users/foo"))
    expect(target.workspaceStorageAliases).toEqual([persistTesting.workspaceStorage("C:\\Users\\foo")])
  })

  test("workspace target keeps a backslash alias for normalized Windows paths", () => {
    const target = Persist.workspace("C:/Users/foo", "vcs")

    expect(target.storage).toBe(persistTesting.workspaceStorage("C:/Users/foo"))
    expect(target.workspaceStorageAliases).toEqual([persistTesting.workspaceStorage("C:\\Users\\foo")])
  })

  test("removes workspace storage aliases when removing persisted target", () => {
    const target = Persist.workspace("C:\\Users\\foo", "terminal")
    storage.setItem(`${target.storage}:${target.key}`, '{"value":1}')
    storage.setItem(`${target.workspaceStorageAliases![0]}:${target.key}`, '{"value":2}')

    removePersisted(target)

    expect(storage.getItem(`${target.storage}:${target.key}`)).toBeNull()
    expect(storage.getItem(`${target.workspaceStorageAliases![0]}:${target.key}`)).toBeNull()
  })

  test("draft target isolates storage per draft and namespaces keys", () => {
    const a = Persist.draft("draft-a", "prompt")
    const b = Persist.draft("draft-b", "prompt")

    expect(a.key).toBe("draft:prompt")
    expect(a.storage).not.toBe(b.storage)
    expect(a.storage).not.toBe(Persist.workspace("/home/luke/repo", "prompt").storage)
  })

  test("removes draft storage when removing persisted target", () => {
    const target = Persist.draft("draft-a", "prompt")
    storage.setItem(`${target.storage}:${target.key}`, '{"value":1}')

    removePersisted(target)

    expect(storage.getItem(`${target.storage}:${target.key}`)).toBeNull()
  })

  test("server workspace target preserves local storage and isolates remote storage", () => {
    const local = Persist.serverWorkspace(ServerScope.local, "/home/luke/repo", "prompt")
    const windows = Persist.serverWorkspace("https://windows.example" as ServerScope, "/home/luke/repo", "prompt")
    const debian = Persist.serverWorkspace("https://debian.example" as ServerScope, "/home/luke/repo", "prompt")

    expect(local).toEqual(Persist.workspace("/home/luke/repo", "prompt"))
    expect(windows.storage).not.toBe(local.storage)
    expect(debian.storage).not.toBe(local.storage)
    expect(debian.storage).not.toBe(windows.storage)
    expect(windows.workspaceStorageAliases).toBeUndefined()
    expect(debian.workspaceStorageAliases).toBeUndefined()
  })

  test("server global target preserves local key and isolates remote keys", () => {
    expect(Persist.serverGlobal(ServerScope.local, "notification")).toEqual(Persist.global("notification"))
    expect(Persist.serverGlobal("https://debian.example" as ServerScope, "notification")).toEqual({
      storage: "ikanban.v2.global.dat",
      key: "https://debian.example\0notification",
    })
  })

  test("server global target cannot collide when scope and key contain colons", () => {
    expect(Persist.serverGlobal("a:b" as ServerScope, "c")).not.toEqual(Persist.serverGlobal("a" as ServerScope, "b:c"))
  })

  test("does not read, migrate, or delete another app's state", () => {
    const previousKey = "old-layout"
    const target = { ...Persist.global("isolated-layout"), previousKey }
    const legacy = {
      "opencode.global.dat:isolated-layout": '{"value":41}',
      [previousKey]: '{"value":42}',
      "opencode.quota-other-app": "unrelated",
      "ikanban.v1.state": "previous version",
    }
    for (const [key, value] of Object.entries(legacy)) storage.setItem(key, value)
    storage.events.length = 0

    renderToString(() => {
      const [state, setState] = persisted(target, Persistence.struct({ value: Schema.Number }), { value: 0 })
      expect(state.value).toBe(0)
      setState("value", 7)
      flushPersisted()
      expect(storage.getItem(`${target.storage}:${target.key}`)).toBe('{"value":7}')
      removePersisted(target)
      removePersisted({ key: previousKey })
      // Force quota eviction after saving some state in this app's own namespace.
      storage.setItem("ikanban.v2.evictable", "own state")
      persistTesting.localStorageWithPrefix("ikanban.v2.quota.isolation").setItem("value", "full")
      expect(storage.getItem("ikanban.v2.evictable")).toBeNull()
      for (const key of Object.keys(legacy)) {
        expect(storage.events).not.toContain(`get:${key}`)
        expect(storage.events).not.toContain(`remove:${key}`)
      }
      for (const [key, value] of Object.entries(legacy)) expect(storage.getItem(key)).toBe(value)
      return ""
    })
  })

  test("relocates previousKey only from the namespaced direct store", () => {
    const previousKey = "namespaced-old-layout"
    const target = { ...Persist.global("relocated-layout"), previousKey }
    storage.setItem(previousKey, '{"value":99}')
    persistTesting.localStorageDirect().setItem(previousKey, '{"value":5}')

    renderToString(() => {
      const [state] = persisted(target, Schema.Struct({ value: Schema.Number }), { value: 0 })
      expect(state.value).toBe(5)
      expect(storage.getItem(`${target.storage}:${target.key}`)).toBe('{"value":5}')
      expect(storage.getItem(`ikanban.v2.direct.dat:${previousKey}`)).toBeNull()
      expect(storage.getItem(previousKey)).toBe('{"value":99}')
      return ""
    })
  })
})
