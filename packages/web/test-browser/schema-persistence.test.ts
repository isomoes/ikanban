import { describe, expect, test } from "bun:test"
import { Schema, SchemaGetter } from "effect"
import { createComputed, createRoot } from "solid-js"
import type { Platform } from "@/runtime/platform/platform"
import { flushPersisted } from "@/runtime/persistence/persist"
import { Persist, persisted } from "@/runtime/persistence/storage"
import { Persistence } from "@/runtime/persistence/schema"
import { TabStorage } from "@/shell/tabs/schema"

const Current = Persistence.struct({
  enabled: Schema.Boolean,
  label: Schema.String,
})
const initial = { enabled: true, label: "default" }
const Stored = Persistence.migrate(
  Current,
  Schema.Struct({ oldLabel: Schema.optional(Schema.String), label: Schema.optional(Schema.String) }).pipe(
    Schema.decode({
      decode: SchemaGetter.transform((value) =>
        value.oldLabel === undefined ? value : { ...value, label: value.oldLabel },
      ),
      encode: SchemaGetter.passthrough(),
    }),
  ),
)

const web: Platform = {
  openExternal: () => undefined,
  restart: async () => undefined,
  notify: async () => undefined,
}

describe("schema-backed persistence", () => {
  test("clears the recent tab after restoring it from storage", () => {
    const target = Persist.global("schema-recent-clear")
    const key = `${target.storage}:${target.key}`
    localStorage.setItem(key, JSON.stringify({ key: "session-tab" }))
    createRoot((dispose) => {
      const [state, setState] = persisted(target, TabStorage.Recent, { key: undefined }, web)
      try {
        expect(state.key).toBe("session-tab")
        setState("key", undefined)
        expect(state.key).toBeUndefined()
        flushPersisted()
        expect(localStorage.getItem(key)).toBe("{}")
      } finally {
        dispose()
      }
    })
  })

  test("migrates sync storage and writes only the current representation", () => {
    const target = Persist.global("schema-sync")
    const key = `${target.storage}:${target.key}`
    localStorage.setItem(key, JSON.stringify({ oldLabel: "saved" }))
    createRoot((dispose) => {
      const [state, setState, , ready] = persisted(target, Stored, initial, web)
      expect(ready.promise).toBeUndefined()
      expect(state).toEqual({ enabled: true, label: "saved" })
      expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ enabled: true, label: "saved" })
      setState("enabled", false)
      flushPersisted()
      expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ enabled: false, label: "saved" })
      dispose()
    })
  })

  test("recovers invalid fields and strips fields outside the schema", () => {
    const target = Persist.global("schema-invalid-field")
    localStorage.setItem(
      `${target.storage}:${target.key}`,
      JSON.stringify({ enabled: "false", label: "kept", extra: 1 }),
    )
    createRoot((dispose) => {
      const [state] = persisted(target, Stored, initial, web)
      expect(state).toEqual({ enabled: true, label: "kept" })
      dispose()
    })
  })

  test("malformed JSON falls back to a typed initial state", () => {
    const target = Persist.global("schema-invalid-json")
    localStorage.setItem(`${target.storage}:${target.key}`, '{"label":"\\x"}')
    createRoot((dispose) => {
      const [state] = persisted(target, Stored, { enabled: false, label: "initial" }, web)
      expect(state).toEqual({ enabled: false, label: "initial" })
      expect(localStorage.getItem(`${target.storage}:${target.key}`)).toBeNull()
      dispose()
    })
  })

  test("a late draft read does not overwrite an edit made while loading", async () => {
    const pending = Promise.withResolvers<string | null>()
    const platform: Platform = {
      ...web,
      draftStore: {
        getItem: () => pending.promise,
        setItem: async () => undefined,
        removeItem: async () => undefined,
        setDocument: async () => undefined,
        putBlob: async () => ({ id: "blob", url: "blob:test" }),
      },
    }
    const root = createRoot((dispose) => ({
      dispose,
      state: persisted({ ...Persist.global("schema-late"), draft: true }, Stored, initial, platform),
    }))
    try {
      root.state[1]("label", "new edit")
      pending.resolve(JSON.stringify({ oldLabel: "old state" }))
      await root.state[3].promise
      expect(root.state[0].label).toBe("new edit")
    } finally {
      root.dispose()
    }
  })

  test("cross-window updates use the same migration and validation boundary", async () => {
    const target = { ...Persist.global("schema-sync-channel"), sync: true }
    const channel = new BroadcastChannel(`ikanban.v2.persist:${target.storage}:${target.key}`)
    const received = Promise.withResolvers<void>()
    const values: unknown[] = []
    const root = createRoot((dispose) => {
      const [state] = persisted(target, Stored, initial, web)
      createComputed(() => {
        values.push({ enabled: state.enabled, label: state.label })
        if (state.label === "from another window") received.resolve()
      })
      return { dispose, state }
    })
    try {
      channel.postMessage({ key: target.key, newValue: JSON.stringify({ enabled: "false", label: "recovered" }) })
      channel.postMessage({ key: target.key, newValue: JSON.stringify({ oldLabel: "from another window" }) })
      await received.promise
      expect(root.state).toEqual({ enabled: true, label: "from another window" })
      expect(values).toContainEqual({ enabled: true, label: "recovered" })
      expect(values).toContainEqual({ enabled: true, label: "from another window" })
    } finally {
      channel.close()
      root.dispose()
    }
  })
})
