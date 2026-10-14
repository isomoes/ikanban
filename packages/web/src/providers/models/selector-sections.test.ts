import { describe, expect, test } from "bun:test"
import { modelSelectorSections } from "./selector-sections"

const a = { id: "shared", provider: { id: "a" } }
const b = { id: "shared", provider: { id: "b" } }
const c = { id: "other", provider: { id: "a" } }
const groups = [
  { category: "a", items: [a, c] },
  { category: "b", items: [b] },
]
const key = (model: typeof a) => ({ providerID: model.provider.id, modelID: model.id })

describe("modelSelectorSections", () => {
  test("puts favorites first, preserves preference order, and deduplicates recent and providers", () => {
    expect(modelSelectorSections({ groups, favorites: [key(b), key(a)], recent: [key(a), key(c)], searching: false }))
      .toEqual([
        { category: "favorites", kind: "favorites", items: [b, a] },
        { category: "recent", kind: "recent", items: [c] },
      ])
  })

  test("keeps provider and recent ordering and omits empty sections", () => {
    expect(modelSelectorSections({ groups, favorites: [], recent: [key(b), key(a)], searching: false })).toEqual([
      { category: "recent", kind: "recent", items: [b, a] },
      { category: "a", kind: "provider", items: [c] },
    ])
    expect(modelSelectorSections({ groups, favorites: [], recent: [], searching: false })).toEqual(
      groups.map((group) => ({ ...group, kind: "provider" })),
    )
  })

  test("does not restore hidden, unavailable or filtered models", () => {
    expect(modelSelectorSections({
      groups: [{ category: "a", items: [c] }],
      favorites: [key(a)],
      recent: [key(b)],
      searching: false,
    })).toEqual([{ category: "a", kind: "provider", items: [c] }])
  })

  test("leaves search results in their original provider groups", () => {
    expect(modelSelectorSections({ groups, favorites: [key(a)], recent: [key(b)], searching: true })).toEqual(
      groups.map((group) => ({ ...group, kind: "provider" })),
    )
  })

  test("handles empty results and duplicate preference entries", () => {
    expect(modelSelectorSections({ groups: [], favorites: [key(a)], recent: [key(b)], searching: false })).toEqual([])
    expect(modelSelectorSections({ groups, favorites: [key(a), key(a)], recent: [key(b), key(b)], searching: false }))
      .toEqual([
        { category: "favorites", kind: "favorites", items: [a] },
        { category: "recent", kind: "recent", items: [b] },
        { category: "a", kind: "provider", items: [c] },
      ])
  })
})
