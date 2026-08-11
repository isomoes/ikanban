import type { SessionMessageAssistant, SessionMessageInfo as Message, SessionMessageUser } from "@opencode-ai/client"

export type SessionContextBreakdownKey = "system" | "user" | "assistant" | "tool" | "other"

export type SessionContextBreakdownSegment = {
  key: SessionContextBreakdownKey
  tokens: number
  width: number
  percent: number
}

const estimateTokens = (chars: number) => Math.ceil(chars / 4)
const toPercent = (tokens: number, input: number) => (tokens / input) * 100
const toPercentLabel = (tokens: number, input: number) => Math.round(toPercent(tokens, input) * 10) / 10

const charsFromUserMessage = (message: SessionMessageUser) => {
  const files = (message.files ?? []).reduce((sum, file) => sum + (file.mention?.text.length ?? 0), 0)
  const agents = (message.agents ?? []).reduce((sum, agent) => sum + (agent.mention?.text.length ?? 0), 0)
  const skills = (message.skills ?? []).reduce((sum, skill) => sum + skill.text.length, 0)
  return message.text.length + files + agents + skills
}

const charsFromAssistantContent = (part: SessionMessageAssistant["content"][number]) => {
  if (part.type === "text" || part.type === "reasoning") return { assistant: part.text.length, tool: 0 }

  if (part.state.status === "streaming") return { assistant: 0, tool: part.state.input.length }
  const input = JSON.stringify(part.state.input).length
  if (part.state.status === "completed") {
    const output = part.state.content.reduce((sum, item) => sum + (item.type === "text" ? item.text.length : item.uri.length), 0)
    return { assistant: 0, tool: input + output }
  }
  if (part.state.status === "error") return { assistant: 0, tool: input + part.state.error.message.length }
  return { assistant: 0, tool: input }
}

const build = (
  tokens: { system: number; user: number; assistant: number; tool: number; other: number },
  input: number,
) => {
  return [
    {
      key: "system",
      tokens: tokens.system,
    },
    {
      key: "user",
      tokens: tokens.user,
    },
    {
      key: "assistant",
      tokens: tokens.assistant,
    },
    {
      key: "tool",
      tokens: tokens.tool,
    },
    {
      key: "other",
      tokens: tokens.other,
    },
  ]
    .filter((x) => x.tokens > 0)
    .map((x) => ({
      key: x.key,
      tokens: x.tokens,
      width: toPercent(x.tokens, input),
      percent: toPercentLabel(x.tokens, input),
    })) as SessionContextBreakdownSegment[]
}

export function estimateSessionContextBreakdown(args: {
  messages: Message[]
  input: number
  systemPrompt?: string
}) {
  if (!args.input) return []

  const counts = args.messages.reduce(
    (acc, msg) => {
      if (msg.type === "user") {
        return { ...acc, user: acc.user + charsFromUserMessage(msg) }
      }

      if (msg.type !== "assistant") return acc
      const assistant = msg.content.reduce(
        (sum, part) => {
          const next = charsFromAssistantContent(part)
          return {
            assistant: sum.assistant + next.assistant,
            tool: sum.tool + next.tool,
          }
        },
        { assistant: 0, tool: 0 },
      )
      return {
        ...acc,
        assistant: acc.assistant + assistant.assistant,
        tool: acc.tool + assistant.tool,
      }
    },
    {
      system: args.systemPrompt?.length ?? 0,
      user: 0,
      assistant: 0,
      tool: 0,
    },
  )

  const tokens = {
    system: estimateTokens(counts.system),
    user: estimateTokens(counts.user),
    assistant: estimateTokens(counts.assistant),
    tool: estimateTokens(counts.tool),
  }
  const estimated = tokens.system + tokens.user + tokens.assistant + tokens.tool

  if (estimated <= args.input) {
    return build({ ...tokens, other: args.input - estimated }, args.input)
  }

  const scale = args.input / estimated
  const scaled = {
    system: Math.floor(tokens.system * scale),
    user: Math.floor(tokens.user * scale),
    assistant: Math.floor(tokens.assistant * scale),
    tool: Math.floor(tokens.tool * scale),
  }
  const total = scaled.system + scaled.user + scaled.assistant + scaled.tool
  return build({ ...scaled, other: Math.max(0, args.input - total) }, args.input)
}
