import type { AgentInfo, ModelInfo } from "@opencode-ai/client"

type VariantInput = {
  variants: string[]
  selected: string | undefined
  configured: string | undefined
}

export function getConfiguredAgentVariant(input: {
  agent: Pick<AgentInfo, "model"> | undefined
  model: Pick<ModelInfo, "id" | "providerID" | "variants"> | undefined
}) {
  if (!input.agent?.model?.variant) return undefined
  if (!input.agent.model) return undefined
  if (!input.model) return undefined
  if (input.agent.model.providerID !== input.model.providerID) return undefined
  if (input.agent.model.id !== input.model.id) return undefined
  const variant = input.agent.model.variant
  if (!input.model.variants.some((item) => item.id === variant)) return undefined
  return variant
}

export function resolveModelVariant(input: VariantInput) {
  if (input.selected && input.variants.includes(input.selected)) return input.selected
  if (input.configured && input.variants.includes(input.configured)) return input.configured
  return undefined
}

export function cycleModelVariant(input: VariantInput) {
  if (input.variants.length === 0) return undefined
  if (input.selected && input.variants.includes(input.selected)) {
    const index = input.variants.indexOf(input.selected)
    if (index === input.variants.length - 1) return undefined
    return input.variants[index + 1]
  }
  if (input.configured && input.variants.includes(input.configured)) {
    const index = input.variants.indexOf(input.configured)
    if (index === input.variants.length - 1) return input.variants[0]
    return input.variants[index + 1]
  }
  return input.variants[0]
}
