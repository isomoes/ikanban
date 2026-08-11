import { describe, expect, test } from "bun:test"
import type { V2Event } from "@/types/opencode"
import {
  coalesceV2Events,
  createStreamLifecycle,
  eventDirectory,
  resumeStreamAfterPageShow,
} from "./global-sdk"

const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve))

describe("native V2 event stream", () => {
  test("routes session creation using its data location", () => {
    const event = {
      id: "evt_1",
      created: 10,
      type: "session.created",
      durable: { aggregateID: "ses_1", seq: 1, version: 1 },
      data: {
        sessionID: "ses_1",
        projectID: "prj_1",
        location: { directory: "/repo" },
        slug: "session",
        version: "2",
      },
    } satisfies V2Event

    expect(eventDirectory(event)).toBe("/repo")
  })

  test("coalesces adjacent native text deltas without changing the event envelope", () => {
    const first = {
      id: "evt_1",
      created: 10,
      type: "session.text.delta",
      location: { directory: "/repo" },
      data: { sessionID: "ses_1", assistantMessageID: "msg_1", ordinal: 0, delta: "hel" },
    } satisfies V2Event
    const second = {
      ...first,
      id: "evt_2",
      created: 11,
      data: { ...first.data, delta: "lo" },
    } satisfies V2Event

    expect(
      coalesceV2Events([
        { directory: "/repo", event: first },
        { directory: "/repo", event: second },
      ]),
    ).toEqual([{ directory: "/repo", event: { ...second, data: { ...second.data, delta: "hello" } } }])
  })

  test("restarts only when a page is restored from the back-forward cache", () => {
    let starts = 0
    resumeStreamAfterPageShow({ persisted: false } as PageTransitionEvent, () => starts++)
    resumeStreamAfterPageShow({ persisted: true } as PageTransitionEvent, () => starts++)
    expect(starts).toBe(1)
  })

  test("starts once, aborts on stop, and creates one fresh subscription after restart", async () => {
    const signals: AbortSignal[] = []
    const lifecycle = createStreamLifecycle({
      subscribe(signal) {
        signals.push(signal)
        return {
          async *[Symbol.asyncIterator]() {
            await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }))
          },
        }
      },
      onEvent() {},
      reconnectDelayMs: 0,
    })

    lifecycle.start()
    lifecycle.start()
    await tick()
    expect(signals).toHaveLength(1)

    lifecycle.stop()
    expect(signals[0]?.aborted).toBe(true)
    await tick()

    lifecycle.start()
    await tick()
    await tick()
    expect(signals).toHaveLength(2)

    lifecycle.dispose()
    expect(signals[1]?.aborted).toBe(true)
  })
})
