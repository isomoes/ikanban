import type {
  SessionMessageAssistant as AssistantMessage,
  SessionMessageInfo as Message,
  ModelInfo,
  ProviderInfo,
} from "@opencode-ai/client"

type Context = {
  message: AssistantMessage
  provider?: ProviderInfo
  model?: ModelInfo
  providerLabel: string
  modelLabel: string
  limit: number | undefined
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
  total: number
  usage: number | null
}

type Metrics = {
  totalCost: number
  context: Context | undefined
}

const tokenTotal = (msg: AssistantMessage) => {
  const tokens = msg.tokens
  if (!tokens) return 0
  return tokens.input + tokens.output + tokens.reasoning + tokens.cache.read + tokens.cache.write
}

const lastAssistantWithTokens = (messages: Message[]) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.type !== "assistant") continue
    if (tokenTotal(msg) <= 0) continue
    return msg
  }
}

const build = (messages: Message[] = [], providers: ProviderInfo[] = [], models: ModelInfo[] = []): Metrics => {
  const totalCost = messages.reduce((sum, msg) => sum + (msg.type === "assistant" ? (msg.cost ?? 0) : 0), 0)
  const message = lastAssistantWithTokens(messages)
  if (!message) return { totalCost, context: undefined }

  const provider = providers.find((item) => item.id === message.model.providerID)
  const model = models.find((item) => item.providerID === message.model.providerID && item.id === message.model.id)
  const limit = model?.limit.context
  const total = tokenTotal(message)

  return {
    totalCost,
    context: {
      message,
      provider,
      model,
      providerLabel: provider?.name ?? message.model.providerID,
      modelLabel: model?.name ?? message.model.id,
      limit,
      input: message.tokens?.input ?? 0,
      output: message.tokens?.output ?? 0,
      reasoning: message.tokens?.reasoning ?? 0,
      cacheRead: message.tokens?.cache.read ?? 0,
      cacheWrite: message.tokens?.cache.write ?? 0,
      total,
      usage: limit ? Math.round((total / limit) * 100) : null,
    },
  }
}

export function getSessionContextMetrics(messages: Message[] = [], providers: ProviderInfo[] = [], models: ModelInfo[] = []) {
  return build(messages, providers, models)
}
