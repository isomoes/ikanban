import { expect, test } from "bun:test"
import type { SessionMessageAssistant, SessionMessageInfo } from "@opencode/client/promise"
import { formatElapsed, sessionMetrics } from "./session-metrics"

const user = (created: number): SessionMessageInfo => ({
  id: `user_${created}`,
  type: "user",
  text: "Hi",
  time: { created },
})

const assistant = (
  input: Pick<SessionMessageAssistant, "id" | "time"> & Partial<Omit<SessionMessageAssistant, "id" | "time">>,
): SessionMessageAssistant => ({
  type: "assistant",
  agent: "build",
  model: { id: "model", providerID: "provider" },
  content: [],
  ...input,
})

const tool = (
  ran: number,
  completed?: number,
  status: "completed" | "running" = "completed",
): SessionMessageAssistant["content"][number] => ({
  type: "tool",
  id: `call_${ran}`,
  name: "read",
  state:
    status === "completed"
      ? { status: "completed", input: {}, content: [{ type: "text", text: "" }] }
      : { status: "running", input: {}, metadata: {} },
  time: { created: ran, ran, completed },
})

test("counts turns, steps and tool calls while subtracting unioned tool time", () => {
  const messages: SessionMessageInfo[] = [
    user(0),
    assistant({
      id: "assistant",
      time: { created: 1_000, completed: 5_000 },
      content: [tool(2_000, 3_000), tool(2_500, 4_000)],
      tokens: { input: 100, output: 100, reasoning: 20, cache: { read: 10, write: 5 } },
    }),
  ]

  expect(sessionMetrics(messages, 9_999)).toEqual({
    turns: 1,
    steps: 1,
    calls: 2,
    // The two calls overlap: 2_000 → 4_000 is two seconds, not two and a half.
    tools: 2_000,
    llm: 2_000,
    total: 4_000,
    tokens: { input: 100, output: 100, reasoning: 20, cache: { read: 10, write: 5 } },
    tps: 60,
    history: [{ id: "assistant", llm: 2_000, tools: 2_000, tps: 60 }],
  })
})

test("keeps a running step in durations but out of throughput", () => {
  const messages: SessionMessageInfo[] = [
    assistant({
      id: "done",
      time: { created: 0, completed: 1_000 },
      tokens: { input: 10, output: 50, reasoning: 0, cache: { read: 0, write: 0 } },
    }),
    assistant({
      id: "running",
      time: { created: 2_000 },
      content: [tool(3_000, undefined, "running")],
    }),
  ]

  const metrics = sessionMetrics(messages, 5_000)
  expect(metrics.turns).toBe(0)
  expect(metrics.steps).toBe(2)
  expect(metrics.calls).toBe(1)
  expect(metrics.tools).toBe(2_000)
  expect(metrics.llm).toBe(2_000)
  expect(metrics.total).toBe(4_000)
  expect(metrics.tps).toBe(50)
  expect(metrics.history).toEqual([
    { id: "done", llm: 1_000, tools: 0, tps: 50 },
    { id: "running", llm: 1_000, tools: 2_000 },
  ])
})

test("reports nothing for an empty session", () => {
  expect(sessionMetrics([], 1_000)).toEqual({
    turns: 0,
    steps: 0,
    calls: 0,
    llm: 0,
    tools: 0,
    total: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    tps: undefined,
    history: [],
  })
})

test("leaves throughput unavailable without completed token usage", () => {
  expect(
    sessionMetrics([assistant({ id: "running", time: { created: 0 }, tokens: undefined })], 1_000).tps,
  ).toBeUndefined()
})

test("formats elapsed durations like the TUI plugin", () => {
  expect(formatElapsed(0)).toBe("0.0s")
  expect(formatElapsed(3_200)).toBe("3.2s")
  expect(formatElapsed(62_000)).toBe("1m2s")
})
