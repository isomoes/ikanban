import { useGlobalSync } from "@/context/global-sync"
import { decode64 } from "@/utils/base64"
import { useParams } from "@solidjs/router"
import { createMemo } from "solid-js"

export const popularProviders = [
  "opencode",
  "opencode-go",
  "anthropic",
  "github-copilot",
  "openai",
  "google",
  "openrouter",
  "vercel",
]
const popularProviderSet = new Set(popularProviders)

export function useProviders() {
  const globalSync = useGlobalSync()
  const params = useParams()
  const currentDirectory = createMemo(() => decode64(params.dir) ?? "")
  const providers = createMemo(() => {
    if (currentDirectory()) {
      const [projectStore] = globalSync.child(currentDirectory())
      return projectStore.provider
    }
    return globalSync.data.provider
  })
  const all = createMemo(() =>
    providers().providers.map((provider) => ({
      ...provider,
      models: Object.fromEntries(providers().models.filter((model) => model.providerID === provider.id).map((model) => [model.id, model])),
    })),
  )
  const connectedIDs = createMemo(() => {
    const integrations = new Map(providers().integrations.map((integration) => [integration.id, integration]))
    return new Set(
      providers().providers
        .filter((provider) => provider.integrationID && integrations.get(provider.integrationID)?.connections.length)
        .map((provider) => provider.id),
    )
  })
  const connected = createMemo(() => all().filter((p) => connectedIDs().has(p.id)))
  const paid = createMemo(() =>
    connected().filter((p) => p.id !== "opencode" || Object.values(p.models).find((m) => m.cost.some((cost) => cost.input))),
  )
  const popular = createMemo(() => all().filter((p) => popularProviderSet.has(p.id)))
  return {
    all,
    default: createMemo(() => {
      const model = providers().defaultModel
      return model ? { [model.providerID]: model.id } : {}
    }),
    popular,
    connected,
    paid,
  }
}
