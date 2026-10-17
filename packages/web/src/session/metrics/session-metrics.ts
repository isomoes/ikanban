import type { SessionMessageInfo, TokenUsageInfo } from "@opencode/client/promise"

export type SessionStepMetric = {
  id: string
  llm: number
  tools: number
  tps?: number
}

export type SessionMetrics = {
  turns: number
  steps: number
  calls: number
  llm: number
  tools: number
  total: number
  tokens: TokenUsageInfo
  tps?: number
  history: SessionStepMetric[]
}

/**
 * Mirrors the `session-metrics` TUI plugin. Turns are user prompts, steps are assistant
 * responses, and tool time is the union of tool intervals so parallel calls are not counted
 * twice. Throughput is generated tokens per second of LLM time over completed steps only, so
 * a running step cannot dilute the average with time it has not accounted for yet.
 */
export function sessionMetrics(messages: readonly SessionMessageInfo[], now = Date.now()): SessionMetrics {
  let turns = 0
  let steps = 0
  let calls = 0
  let llm = 0
  let tools = 0
  let measured = 0
  let generated = 0
  const tokens: TokenUsageInfo = { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }
  const history: SessionStepMetric[] = []

  for (const message of messages) {
    if (message.type === "user") {
      turns++
      continue
    }
    if (message.type !== "assistant") continue

    steps++
    const end = message.time.completed ?? now
    const intervals = message.content
      .flatMap((part): [number, number][] => {
        if (part.type !== "tool") return []
        calls++
        if (part.time.ran === undefined) return []
        return [[part.time.ran, Math.min(part.time.completed ?? end, end)]]
      })
      .sort((a, b) => a[0] - b[0])

    let toolTime = 0
    let through = message.time.created
    for (const [start, stop] of intervals) {
      toolTime += Math.max(0, stop - Math.max(start, through))
      through = Math.max(through, stop)
    }

    const generation = Math.max(0, end - message.time.created - toolTime)
    tools += toolTime
    llm += generation

    let tps: number | undefined
    if (message.tokens) {
      tokens.input += message.tokens.input
      tokens.output += message.tokens.output
      tokens.reasoning += message.tokens.reasoning
      tokens.cache.read += message.tokens.cache.read
      tokens.cache.write += message.tokens.cache.write

      if (message.time.completed !== undefined) {
        const output = message.tokens.output + message.tokens.reasoning
        if (generation > 0 && output > 0) tps = output / (generation / 1_000)
        measured += generation
        generated += output
      }
    }

    history.push({ id: message.id, llm: generation, tools: toolTime, tps })
  }

  return {
    turns,
    steps,
    calls,
    llm,
    tools,
    total: llm + tools,
    tokens,
    tps: measured > 0 && generated > 0 ? generated / (measured / 1_000) : undefined,
    history,
  }
}

export function formatElapsed(milliseconds: number): string {
  const seconds = Math.max(0, milliseconds) / 1000
  return seconds >= 60
    ? `${Math.floor(seconds / 60)}m${Math.floor(seconds % 60)}s`
    : `${seconds.toFixed(1)}s`
}
