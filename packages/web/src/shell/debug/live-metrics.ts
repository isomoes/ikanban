import { createMemo, createEffect, on, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useParams } from "@solidjs/router"
import { useGlobal } from "@/runtime/server/runtime"
import { ServerConnection } from "@/runtime/server/registry"
import { base64Encode } from "@opencode/util/encode"
import {
  applyProviderMetricEvent,
  isProviderMetricEvent,
  projectedProviderMetrics,
  type ProviderMetrics,
  type ProviderMetricState,
} from "./provider-metrics"

export function createLiveProviderMetrics() {
  const global = useGlobal()
  const params = useParams<{ serverKey?: string; id?: string }>()
  const [state, setState] = createStore({
    live: undefined as ProviderMetrics | undefined,
  })

  const target = createMemo(
    () => {
      if (!params.serverKey || !params.id) return
      const connection = global.servers
        .list()
        .find((item) => base64Encode(ServerConnection.key(item)) === params.serverKey)
      if (!connection) return
      return { ctx: global.ensureServerCtx(connection), id: params.id }
    },
    undefined,
    { equals: (a, b) => a?.ctx === b?.ctx && a?.id === b?.id },
  )
  // History comes from the already-loaded message projection; live requests refine it in place.
  const projected = createMemo(() => {
    const current = target()
    if (!current) return
    return projectedProviderMetrics(current.ctx.data.session.message.list(current.id))
  })
  const metrics = () => state.live ?? projected()

  // Missed events during an outage are never replayed; the refreshed projection must win.
  createEffect(
    on(
      () => target()?.ctx.sdk.connection.status(),
      (status) => {
        if (status !== "connected") setState("live", undefined)
      },
      { defer: true },
    ),
  )

  createEffect(
    on(target, (current) => {
      setState("live", undefined)
      if (!current) return
      const accumulator: ProviderMetricState = {}
      onCleanup(
        current.ctx.sdk.event.listen((event) => {
          if (!isProviderMetricEvent(event) || event.data.sessionID !== current.id) return
          applyProviderMetricEvent(accumulator, event)
          if (accumulator.latest) setState("live", accumulator.latest)
        }),
      )
    }),
  )

  return metrics
}
