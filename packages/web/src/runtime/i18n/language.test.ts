import { afterEach, describe, expect, test } from "bun:test"
import { Persist } from "@/runtime/persistence/storage"
import { readStoredLocale } from "./language"

const target = Persist.global("language")
const key = `${target.storage}:${target.key}`

afterEach(() => {
  localStorage.removeItem(key)
  localStorage.removeItem("opencode.global.dat:language")
})

describe("initial locale storage", () => {
  test("reads the same namespace as the persisted language store", () => {
    localStorage.setItem("opencode.global.dat:language", '{"locale":"de"}')
    localStorage.setItem(key, '{"locale":"fr"}')

    expect(readStoredLocale()).toBe("fr")
    expect(localStorage.getItem("opencode.global.dat:language")).toBe('{"locale":"de"}')
  })

  test("ignores previous frontend locale preferences", () => {
    localStorage.setItem("opencode.global.dat:language", '{"locale":"de"}')

    expect(readStoredLocale()).toBeUndefined()
    expect(localStorage.getItem("opencode.global.dat:language")).toBe('{"locale":"de"}')
  })
})
