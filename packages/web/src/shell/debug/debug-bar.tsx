import { Show } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { Cell, ToggleCell } from "./cells"
import { createDebugDiagnostics } from "./diagnostics"
import { bad, duration, fixed, mb, ms, time } from "./format"
import { createLiveProviderMetrics } from "./live-metrics"

export function DebugBar(props: { diagnostics?: boolean; inline?: boolean } = {}) {
  const language = useLanguage()
  const metrics = createLiveProviderMetrics()
  const state = createDebugDiagnostics(props)

  const na = () => language.t("debugBar.na").toUpperCase()
  const heap = () => (state.heap.limit ? (state.heap.used ?? 0) / state.heap.limit : undefined)
  const heapv = () => {
    const value = heap()
    if (value === undefined) return na()
    return `${Math.round(value * 100)}%`
  }
  const longv = () => (state.long.count === undefined ? na() : `${time(state.long.block) ?? na()}/${state.long.count}`)
  const navv = () => (state.nav.pending ? "…" : (time(state.nav.dur) ?? na()))

  return (
    <aside
      aria-label={language.t(props.diagnostics ? "debugBar.ariaLabel" : "debugBar.providerAriaLabel")}
      classList={{
        "pointer-events-auto hidden overflow-hidden text-text-strong md:block": true,
        "mt-[-6px] w-full shrink-0 px-3 py-1": !!props.inline,
        "fixed bottom-3 right-3 z-50 w-[308px] max-w-[calc(100vw-1.5rem)] rounded-xl border border-border-base bg-surface-raised-stronger-non-alpha p-0.5 shadow-[var(--shadow-lg-border-base)] sm:bottom-4 sm:right-4 sm:w-[324px]":
          !props.inline,
      }}
    >
      <div
        classList={{
          "font-mono": true,
          "gap-[9px]": !!props.inline,
          "gap-px": !props.inline,
          "flex w-full flex-nowrap items-center justify-start": !!props.inline,
          "grid-cols-4": !props.inline,
          grid: !props.inline,
        }}
      >
        <Cell
          label={language.t("debugBar.tps.label")}
          tip={language.t("debugBar.tps.tip")}
          value={fixed(metrics()?.tps, 1) ?? na()}
          dim={metrics()?.tps === undefined}
          inline={props.inline}
        />
        <Cell
          label={language.t("debugBar.ttft.label")}
          tip={language.t("debugBar.ttft.tip")}
          value={duration(metrics()?.ttft) ?? na()}
          dim={metrics()?.ttft === undefined}
          inline={props.inline}
        />
        <Cell
          label={language.t("debugBar.ttfa.label")}
          tip={language.t("debugBar.ttfa.tip")}
          value={duration(metrics()?.ttfa) ?? na()}
          dim={metrics()?.ttfa === undefined}
          inline={props.inline}
        />
        <Cell
          label={language.t("debugBar.e2e.label")}
          tip={language.t("debugBar.e2e.tip")}
          value={duration(metrics()?.e2e) ?? na()}
          dim={metrics()?.e2e === undefined}
          inline={props.inline}
        />
        <Show when={props.diagnostics}>
          <Cell
            label={language.t("debugBar.nav.label")}
            tip={language.t("debugBar.nav.tip")}
            value={navv()}
            bad={bad(state.nav.dur, 400)}
            dim={state.nav.dur === undefined && !state.nav.pending}
            inline={props.inline}
          />
          <Cell
            label={language.t("debugBar.fps.label")}
            tip={language.t("debugBar.fps.tip")}
            value={state.fps === undefined ? na() : `${Math.round(state.fps)}`}
            bad={bad(state.fps, 50, true)}
            dim={state.fps === undefined}
            inline={props.inline}
          />
          <Cell
            label={language.t("debugBar.frame.label")}
            tip={language.t("debugBar.frame.tip")}
            value={time(state.gap) ?? na()}
            bad={bad(state.gap, 50)}
            dim={state.gap === undefined}
            inline={props.inline}
          />
          <Cell
            label={language.t("debugBar.jank.label")}
            tip={language.t("debugBar.jank.tip")}
            value={state.jank === undefined ? na() : `${state.jank}`}
            bad={bad(state.jank, 8)}
            dim={state.jank === undefined}
            inline={props.inline}
          />
          <Cell
            label={language.t("debugBar.long.label")}
            tip={language.t("debugBar.long.tip", { max: ms(state.long.max) ?? na() })}
            value={longv()}
            bad={bad(state.long.block, 200)}
            dim={state.long.count === undefined}
            inline={props.inline}
          />
          <Cell
            label={language.t("debugBar.delay.label")}
            tip={language.t("debugBar.delay.tip")}
            value={time(state.delay) ?? na()}
            bad={bad(state.delay, 100)}
            dim={state.delay === undefined}
            inline={props.inline}
          />
          <Cell
            label={language.t("debugBar.inp.label")}
            tip={language.t("debugBar.inp.tip")}
            value={time(state.inp) ?? na()}
            bad={bad(state.inp, 200)}
            dim={state.inp === undefined}
            inline={props.inline}
          />
          <Cell
            label={language.t("debugBar.cls.label")}
            tip={language.t("debugBar.cls.tip")}
            value={state.cls === undefined ? na() : state.cls.toFixed(2)}
            bad={bad(state.cls, 0.1)}
            dim={state.cls === undefined}
            inline={props.inline}
          />
          <Cell
            label={language.t("debugBar.mem.label")}
            tip={
              state.heap.used === undefined
                ? language.t("debugBar.mem.tipUnavailable")
                : language.t("debugBar.mem.tip", {
                    used: mb(state.heap.used) ?? na(),
                    limit: mb(state.heap.limit) ?? na(),
                  })
            }
            value={heapv()}
            bad={bad(heap(), 0.8)}
            dim={state.heap.used === undefined}
            inline={props.inline}
            span={3}
          />
          <ToggleCell
            active={language.direction() === "rtl"}
            inline={props.inline}
            label={language.t("debugBar.direction.label")}
            tip={language.t("debugBar.direction.tip")}
            value={language.t(`debugBar.direction.${language.direction()}`)}
            onClick={() => language.setDirection(language.direction() === "rtl" ? "ltr" : "rtl")}
          />
        </Show>
      </div>
    </aside>
  )
}
