import { Popover } from "@kobalte/core/popover"
import { Button } from "@ikanban/ui/button"
import { Icon } from "@ikanban/ui/icon"
import { Tooltip } from "@ikanban/ui/tooltip"
import { For, Show, createMemo, createSignal } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { useData } from "@/runtime/server/current"
import { formatElapsed, sessionMetrics } from "./session-metrics"
import "./session-metrics.css"

const SPARK_STEPS = 24

export function SessionMetricsPopover(props: { sessionID: string }) {
  const data = useData()
  const language = useLanguage()
  const [open, setOpen] = createSignal(false)
  const metrics = createMemo(() => sessionMetrics(data.session.message.list(props.sessionID)))
  const visible = createMemo(() => metrics().turns > 0 || metrics().steps > 0)
  const tps = () => {
    const value = metrics().tps
    return value === undefined ? "—" : value.toFixed(1)
  }

  return (
    <Show when={visible()}>
      <Popover open={open()} onOpenChange={setOpen} placement="bottom-end" gutter={8} overflowPadding={16}>
        <Tooltip placement="bottom" value={language.t("session.metrics.title")}>
          <Popover.Trigger
            as={Button}
            type="button"
            variant="ghost-muted"
            size="small"
            class="session-metrics-trigger shrink-0"
            aria-label={language.t("session.metrics.title")}
            aria-expanded={open()}
          >
            <Icon name="pulse" class="size-3.5 shrink-0 text-v2-icon-icon-muted" />
            <span>{tps()}</span>
            <span class="session-metrics-trigger-unit hidden sm:inline">
              {language.t("session.metrics.unit")}
            </span>
          </Popover.Trigger>
        </Tooltip>
        <Popover.Portal>
          <Popover.Content
            class="session-metrics-popover z-50 border-0 bg-transparent p-1 outline-none"
            aria-label={language.t("session.metrics.title")}
          >
            <SessionMetricsPanel sessionID={props.sessionID} />
          </Popover.Content>
        </Popover.Portal>
      </Popover>
    </Show>
  )
}

export function SessionMetricsPanel(props: { sessionID: string; embedded?: boolean }) {
  const data = useData()
  const language = useLanguage()
  const metrics = createMemo(() => sessionMetrics(data.session.message.list(props.sessionID)))
  const compact = createMemo(
    () => new Intl.NumberFormat(language.intl(), { notation: "compact", maximumFractionDigits: 1 }),
  )
  const visible = createMemo(() => metrics().turns > 0 || metrics().steps > 0)
  const tps = () => {
    const value = metrics().tps
    return value === undefined ? "—" : value.toFixed(1)
  }
  const spark = createMemo(() => {
    const steps = metrics().history.flatMap((step) => (step.tps === undefined ? [] : [step.tps]))
    const window = steps.slice(-SPARK_STEPS)
    const max = Math.max(...window)
    return max > 0 ? window.map((value) => Math.max(4, (value / max) * 100)) : []
  })
  const share = createMemo(() => {
    const total = metrics().total
    return total > 0 ? (metrics().llm / total) * 100 : 0
  })
  const usage = () => {
    const tokens = metrics().tokens
    // Cache is listed separately; summing it here would let context reads dwarf generated tokens.
    return tokens.input + tokens.output + tokens.reasoning
  }

  return (
    <Show when={visible()}>
      <div data-component="session-metrics" data-embedded={props.embedded ? "" : undefined}>
        <div class="session-metrics-hero">
          <div class="min-w-0">
            <div class="session-metrics-value">{tps()}</div>
            <div class="session-metrics-unit">{language.t("session.metrics.tps")}</div>
          </div>
          <Show when={spark().length > 1}>
            <div class="session-metrics-spark" aria-hidden="true">
              <For each={spark()}>
                {(height, index) => (
                  <span
                    class="session-metrics-spark-bar"
                    data-current={index() === spark().length - 1 ? "" : undefined}
                    style={{ height: `${height}%` }}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>

        <div class="session-metrics-stats">
          <Stat label={language.t("session.metrics.turns")} value={metrics().turns} />
          <Stat label={language.t("session.metrics.steps")} value={metrics().steps} />
          <Stat label={language.t("session.metrics.calls")} value={metrics().calls} />
        </div>

        <section class="session-metrics-section">
          <div class="session-metrics-section-head">
            <span>{language.t("session.metrics.time")}</span>
            <strong>{formatElapsed(metrics().total)}</strong>
          </div>
          <div class="session-metrics-split" aria-hidden="true">
            <span class="session-metrics-split-llm" style={{ width: `${share()}%` }} />
            <span class="session-metrics-split-tools" style={{ width: `${100 - share()}%` }} />
          </div>
          <div class="session-metrics-legend">
            <span>
              <i class="session-metrics-dot session-metrics-dot-llm" />
              {language.t("session.metrics.llm")} {formatElapsed(metrics().llm)}
            </span>
            <span>
              <i class="session-metrics-dot session-metrics-dot-tools" />
              {language.t("session.metrics.tools")} {formatElapsed(metrics().tools)}
            </span>
          </div>
        </section>

        <section class="session-metrics-section">
          <div class="session-metrics-section-head">
            <span>{language.t("session.metrics.tokens")}</span>
            <strong>{compact().format(usage())}</strong>
          </div>
          <div class="session-metrics-rows">
            <Row label={language.t("session.metrics.input")} value={compact().format(metrics().tokens.input)} />
            <Row label={language.t("session.metrics.output")} value={compact().format(metrics().tokens.output)} />
            <Row
              label={language.t("session.metrics.reasoning")}
              value={compact().format(metrics().tokens.reasoning)}
            />
            <Row
              label={language.t("session.metrics.cache")}
              value={language.t("session.metrics.cacheValue", {
                read: compact().format(metrics().tokens.cache.read),
                write: compact().format(metrics().tokens.cache.write),
              })}
            />
          </div>
        </section>
      </div>
    </Show>
  )
}

function Stat(props: { label: string; value: number }) {
  return (
    <div class="session-metrics-stat">
      <div class="session-metrics-stat-value">{props.value}</div>
      <div class="session-metrics-stat-label">{props.label}</div>
    </div>
  )
}

function Row(props: { label: string; value: string }) {
  return (
    <div class="session-metrics-row">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  )
}
