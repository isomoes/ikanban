type Model = { id: string; provider: { id: string } }
type Key = { modelID: string; providerID: string }

export type ModelSection<T> = {
  category: string
  kind: "favorites" | "recent" | "provider"
  items: T[]
}

const key = (model: Model) => JSON.stringify([model.provider.id, model.id])

// Only partition the already-filtered catalog: hidden or disconnected models stay hidden.
export function modelSelectorSections<T extends Model>(input: {
  groups: { category: string; items: T[] }[]
  favorites: readonly Key[]
  recent: readonly Key[]
  searching: boolean
}): ModelSection<T>[] {
  const providers = input.groups.map((group) => ({ ...group, kind: "provider" as const }))
  if (input.searching) return providers

  const available = new Map(providers.flatMap((group) => group.items.map((item) => [key(item), item] as const)))
  const seen = new Set<string>()
  const take = (keys: readonly Key[]) =>
    keys.flatMap((item) => {
      const id = JSON.stringify([item.providerID, item.modelID])
      const model = available.get(id)
      if (!model || seen.has(id)) return []
      seen.add(id)
      return [model]
    })
  const favorites = take(input.favorites)
  const recent = take(input.recent)
  return [
    { category: "favorites", kind: "favorites" as const, items: favorites },
    { category: "recent", kind: "recent" as const, items: recent },
    ...providers.map((group) => ({ ...group, items: group.items.filter((item) => !seen.has(key(item))) })),
  ].filter((group) => group.items.length > 0)
}
