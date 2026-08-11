import type { V2Event } from "@opencode-ai/client"
import { createSimpleContext } from "@/ui/context/index"
import { createGlobalEmitter, type GlobalEmitter } from "@solid-primitives/event-bus"
import { batch, onCleanup, onMount } from "solid-js"
import { createSdkForServer } from "@/utils/server"
import { usePlatform } from "./platform"
import { useServer } from "./server"

type SDKClient = ReturnType<typeof createSdkForServer>

export interface GlobalSDKContext {
  url: string
  client: SDKClient
  event: GlobalEmitter<Record<string, V2Event>> & { start: () => Promise<void> | undefined }
  createClient(opts?: { directory?: string; throwOnError?: boolean }): SDKClient
}

type QueuedV2Event = { directory: string; event: V2Event }
type DeltaEvent = Extract<
  V2Event,
  { type: "session.text.delta" | "session.reasoning.delta" | "session.tool.input.delta" | "session.compaction.delta" }
>

function deltaKey(event: DeltaEvent) {
  if (event.type === "session.tool.input.delta") {
    return `${event.type}:${event.data.sessionID}:${event.data.assistantMessageID}:${event.data.id}`
  }
  if (event.type === "session.compaction.delta") return `${event.type}:${event.data.sessionID}`
  return `${event.type}:${event.data.sessionID}:${event.data.assistantMessageID}:${event.data.ordinal}`
}

function deltaFragment(event: DeltaEvent) {
  return event.type === "session.compaction.delta" ? event.data.text : event.data.delta
}

function asDelta(event: V2Event | undefined): DeltaEvent | undefined {
  if (
    event?.type === "session.text.delta" ||
    event?.type === "session.reasoning.delta" ||
    event?.type === "session.tool.input.delta" ||
    event?.type === "session.compaction.delta"
  ) {
    return event
  }
}

export function eventDirectory(event: V2Event) {
  if (event.location?.directory) return event.location.directory
  if (event.type === "session.created") return event.data.location.directory
  return "global"
}

export function coalesceV2Events(events: QueuedV2Event[]) {
  const output: QueuedV2Event[] = []
  for (const item of events) {
    const current = asDelta(item.event)
    const previous = output[output.length - 1]
    const prior = asDelta(previous?.event)
    if (!current || !prior || previous.directory !== item.directory || deltaKey(prior) !== deltaKey(current)) {
      output.push(item)
      continue
    }
    const fragment = deltaFragment(prior) + deltaFragment(current)
    const data =
      current.type === "session.compaction.delta"
        ? { ...current.data, text: fragment }
        : { ...current.data, delta: fragment }
    output[output.length - 1] = {
      directory: item.directory,
      event: { ...current, data } as DeltaEvent,
    }
  }
  return output
}

export function resumeStreamAfterPageShow(event: PageTransitionEvent, start: () => unknown) {
  if (event.persisted) start()
}

export function createStreamLifecycle(input: {
  subscribe: (signal: AbortSignal) => AsyncIterable<V2Event>
  onEvent: (event: V2Event) => void | Promise<void>
  onError?: (error: unknown) => void
  reconnectDelayMs?: number
}) {
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
  let attempt: AbortController | undefined
  let run: Promise<void> | undefined
  let started = false
  let disposed = false
  let generation = 0

  const start = () => {
    if (disposed || started) return run
    started = true
    const active = ++generation
    const previous = run
    const current = (async () => {
      if (previous) await previous
      while (!disposed && started && generation === active) {
        attempt = new AbortController()
        try {
          for await (const event of input.subscribe(attempt.signal)) await input.onEvent(event)
        } catch (error) {
          const aborted = attempt.signal.aborted || (error instanceof Error && error.name === "AbortError")
          if (!aborted) input.onError?.(error)
        } finally {
          attempt = undefined
        }
        if (disposed || !started || generation !== active) return
        await wait(input.reconnectDelayMs ?? 250)
      }
    })().finally(() => {
      if (run === current) run = undefined
    })
    run = current
    return run
  }

  const stop = () => {
    started = false
    generation++
    attempt?.abort()
  }

  return {
    start,
    stop,
    dispose() {
      disposed = true
      stop()
    },
  }
}

export const { use: useGlobalSDK, provider: GlobalSDKProvider } = createSimpleContext<GlobalSDKContext, {}>({
  name: "GlobalSDK",
  init: () => {
    const server = useServer()
    const platform = usePlatform()
    const eventFetch = (() => {
      if (!platform.fetch || !server.current) return
      try {
        const url = new URL(server.current.http.url)
        const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1"
        if (url.protocol === "http:" && !loopback) return platform.fetch
      } catch {
        return
      }
    })()

    const currentServer = server.current
    if (!currentServer) throw new Error("No server available")

    const eventSdk = createSdkForServer({
      fetch: eventFetch,
      server: currentServer.http,
    })
    const emitter = createGlobalEmitter<{ [key: string]: V2Event }>()

    type Queued = QueuedV2Event
    const FLUSH_FRAME_MS = 16
    const STREAM_YIELD_MS = 8
    const RECONNECT_DELAY_MS = 250

    let queue: Queued[] = []
    let buffer: Queued[] = []
    let timer: ReturnType<typeof setTimeout> | undefined
    let last = 0

    const flush = () => {
      if (timer) clearTimeout(timer)
      timer = undefined

      if (queue.length === 0) return

      const events = queue
      queue = buffer
      buffer = events
      queue.length = 0

      last = Date.now()
      batch(() => {
        for (const item of coalesceV2Events(events)) {
          emitter.emit(item.directory, item.event)
        }
      })

      buffer.length = 0
    }

    const schedule = () => {
      if (timer) return
      const elapsed = Date.now() - last
      timer = setTimeout(flush, Math.max(0, FLUSH_FRAME_MS - elapsed))
    }

    let yielded = Date.now()
    let streamErrorLogged = false
    const lifecycle = createStreamLifecycle({
      subscribe: (signal) => eventSdk.event.subscribe({ signal }),
      reconnectDelayMs: RECONNECT_DELAY_MS,
      async onEvent(event) {
        streamErrorLogged = false
        queue.push({ directory: eventDirectory(event), event })
        schedule()
        if (Date.now() - yielded < STREAM_YIELD_MS) return
        yielded = Date.now()
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      },
      onError(error) {
        if (streamErrorLogged) return
        streamErrorLogged = true
        console.error("[global-sdk] event stream failed", {
          url: currentServer.http.url,
          fetch: eventFetch ? "platform" : "webview",
          error,
        })
      },
    })

    const onPageHide = () => lifecycle.stop()
    const onPageShow = (event: PageTransitionEvent) => resumeStreamAfterPageShow(event, lifecycle.start)
    onMount(() => {
      window.addEventListener("pagehide", onPageHide)
      window.addEventListener("pageshow", onPageShow)
    })

    onCleanup(() => {
      window.removeEventListener("pagehide", onPageHide)
      window.removeEventListener("pageshow", onPageShow)
      lifecycle.dispose()
      flush()
    })

    const sdk = createSdkForServer({
      server: server.current.http,
      fetch: platform.fetch,
    })

    return {
      url: currentServer.http.url,
      client: sdk,
      event: Object.assign(emitter, { start: lifecycle.start }),
      createClient(_opts: { directory?: string; throwOnError?: boolean } = {}) {
        const s = server.current
        if (!s) throw new Error("Server not available")
        return createSdkForServer({
          server: s.http,
          fetch: platform.fetch,
        })
      },
    }
  },
})
