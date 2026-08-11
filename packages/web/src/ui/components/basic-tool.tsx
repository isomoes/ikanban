import { createEffect, createSignal, For, Match, on, onCleanup, Show, Switch, type JSX } from "solid-js"
import { animate, type AnimationPlaybackControls } from "motion"
import { Collapsible } from "./collapsible"
import { Icon, type IconProps } from "./icon"
import { Markdown } from "./markdown"
import { TextShimmer } from "./text-shimmer"
import { buildInlineDurationDetail } from "./session-turn-duration"
import { useI18n } from "../context/i18n"

export type TriggerTitle = {
  title: string
  titleClass?: string
  subtitle?: string
  subtitleClass?: string
  args?: string[]
  argsClass?: string
  action?: JSX.Element
}

const isTriggerTitle = (val: any): val is TriggerTitle => {
  return (
    typeof val === "object" && val !== null && "title" in val && (typeof Node === "undefined" || !(val instanceof Node))
  )
}

export interface BasicToolProps {
  icon: IconProps["name"]
  tool?: string
  badge?: string
  trigger: TriggerTitle | JSX.Element
  children?: JSX.Element
  status?: string
  hideDetails?: boolean
  defaultOpen?: boolean
  forceOpen?: boolean
  defer?: boolean
  locked?: boolean
  animated?: boolean
  onSubtitleClick?: () => void
  turnDurationLabel?: string
}

const SPRING = { type: "spring" as const, visualDuration: 0.35, bounce: 0 }

const TOOL_BADGES: Record<string, string> = {
  read: "READ",
  list: "LIST",
  glob: "GLOB",
  grep: "GREP",
  webfetch: "FETCH",
  websearch: "WEB",
  codesearch: "CODE",
  task: "AGENT",
  bash: "SHELL",
  shell: "SHELL",
  edit: "EDIT",
  write: "WRITE",
  apply_patch: "PATCH",
  patch: "PATCH",
  todowrite: "TODO",
  question: "ASK",
  skill: "SKILL",
  execute: "CODE",
  lsp: "LSP",
  plan_exit: "PLAN",
  invalid: "ERROR",
}

export function toolBadge(tool?: string) {
  if (!tool) return "TOOL"
  return TOOL_BADGES[tool] ?? "MCP"
}

export function ToolBadge(props: { icon: IconProps["name"]; tool?: string; badge?: string }) {
  const badge = () => props.badge ?? toolBadge(props.tool)
  return (
    <span data-slot="basic-tool-tool-badge" data-type={badge().toLowerCase()}>
      <Icon name={props.icon} size="small" />
      <span>{badge()}</span>
    </span>
  )
}

export function BasicTool(props: BasicToolProps) {
  const [open, setOpen] = createSignal(props.defaultOpen ?? false)
  const [ready, setReady] = createSignal(open())
  const pending = () => props.status === "streaming" || props.status === "running"
  const compactTitle = () => {
    const badge = props.badge ?? toolBadge(props.tool)
    return badge !== "MCP" && badge !== "SKILL" && badge !== "AGENT"
  }
  const inlineSubtitle = () => {
    if (!isTriggerTitle(props.trigger)) return ""
    return buildInlineDurationDetail(props.trigger.subtitle ?? "", pending() ? undefined : props.turnDurationLabel)
  }

  let frame: number | undefined

  const cancel = () => {
    if (frame === undefined) return
    cancelAnimationFrame(frame)
    frame = undefined
  }

  onCleanup(cancel)

  createEffect(() => {
    if (props.forceOpen) setOpen(true)
  })

  createEffect(
    on(
      open,
      (value) => {
        if (!props.defer) return
        if (!value) {
          cancel()
          setReady(false)
          return
        }

        cancel()
        frame = requestAnimationFrame(() => {
          frame = undefined
          if (!open()) return
          setReady(true)
        })
      },
      { defer: true },
    ),
  )

  // Animated height for collapsible open/close
  let contentRef: HTMLDivElement | undefined
  let heightAnim: AnimationPlaybackControls | undefined
  const initialOpen = open()

  createEffect(
    on(
      open,
      (isOpen) => {
        if (!props.animated || !contentRef) return
        heightAnim?.stop()
        if (isOpen) {
          contentRef.style.overflow = "hidden"
          heightAnim = animate(contentRef, { height: "auto" }, SPRING)
          heightAnim.finished.then(() => {
            if (!contentRef || !open()) return
            contentRef.style.overflow = "visible"
            contentRef.style.height = "auto"
          })
        } else {
          contentRef.style.overflow = "hidden"
          heightAnim = animate(contentRef, { height: "0px" }, SPRING)
        }
      },
      { defer: true },
    ),
  )

  onCleanup(() => {
    heightAnim?.stop()
  })

  const handleOpenChange = (value: boolean) => {
    if (pending()) return
    if (props.locked && !value) return
    setOpen(value)
  }

  return (
    <Collapsible open={open()} onOpenChange={handleOpenChange} class="tool-collapsible">
      <Collapsible.Trigger>
        <div data-component="tool-trigger">
          <div
            data-slot="basic-tool-tool-trigger-content"
            data-hide-title={compactTitle() ? "true" : undefined}
          >
            <ToolBadge icon={props.icon} tool={props.tool} badge={props.badge} />
            <div data-slot="basic-tool-tool-info">
              <Switch>
                <Match when={isTriggerTitle(props.trigger) && props.trigger}>
                  {(trigger) => (
                    <div data-slot="basic-tool-tool-info-structured">
                      <div data-slot="basic-tool-tool-info-main">
                        <span
                          data-slot="basic-tool-tool-title"
                          classList={{
                            [trigger().titleClass ?? ""]: !!trigger().titleClass,
                          }}
                        >
                          <TextShimmer text={trigger().title} active={pending()} />
                        </span>
                        <Show when={!pending()}>
                          <Show when={inlineSubtitle()}>
                            <span
                              data-slot="basic-tool-tool-subtitle"
                              classList={{
                                [trigger().subtitleClass ?? ""]: !!trigger().subtitleClass,
                                clickable: !!props.onSubtitleClick,
                              }}
                              onClick={(e) => {
                                if (props.onSubtitleClick) {
                                  e.stopPropagation()
                                  props.onSubtitleClick()
                                }
                              }}
                            >
                              {inlineSubtitle()}
                            </span>
                          </Show>
                          <Show when={trigger().args?.length}>
                            <For each={trigger().args}>
                              {(arg) => (
                                <span
                                  data-slot="basic-tool-tool-arg"
                                  classList={{
                                    [trigger().argsClass ?? ""]: !!trigger().argsClass,
                                  }}
                                >
                                  {arg}
                                </span>
                              )}
                            </For>
                          </Show>
                        </Show>
                      </div>
                      <Show when={!pending() && trigger().action}>{trigger().action}</Show>
                    </div>
                  )}
                </Match>
                <Match when={true}>{props.trigger as JSX.Element}</Match>
              </Switch>
            </div>
          </div>
          <Show when={props.children && !props.hideDetails && !props.locked && !pending()}>
            <Collapsible.Arrow />
          </Show>
        </div>
      </Collapsible.Trigger>
      <Show when={props.animated && props.children && !props.hideDetails}>
        <div
          ref={contentRef}
          data-slot="collapsible-content"
          data-animated
          style={{
            height: initialOpen ? "auto" : "0px",
            overflow: initialOpen ? "visible" : "hidden",
          }}
        >
          {props.children}
        </div>
      </Show>
      <Show when={!props.animated && props.children && !props.hideDetails}>
        <Collapsible.Content>
          <Show when={!props.defer || ready()}>{props.children}</Show>
        </Collapsible.Content>
      </Show>
    </Collapsible>
  )
}

export function formatToolResult(value: unknown) {
  if (typeof value !== "string") return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``

  try {
    return `\`\`\`json\n${JSON.stringify(JSON.parse(value), null, 2)}\n\`\`\``
  } catch {
    return value
  }
}

export function GenericTool(props: {
  tool: string
  input?: Record<string, unknown>
  output?: string
  status?: string
  hideDetails?: boolean
  defaultOpen?: boolean
  turnDurationLabel?: string
}) {
  const i18n = useI18n()
  const external = () => toolBadge(props.tool) === "MCP"
  const hasInput = () => !!props.input && Object.keys(props.input).length > 0
  const hasOutput = () => props.output !== undefined && props.output !== ""

  return (
    <BasicTool
      icon={external() ? "mcp" : "code"}
      tool={props.tool}
      status={props.status}
      trigger={{ title: props.tool, titleClass: "external-tool-title" }}
      hideDetails={props.hideDetails}
      defaultOpen={props.defaultOpen}
      turnDurationLabel={props.turnDurationLabel}
    >
      <div
        data-component="generic-tool-console"
        role="region"
        aria-label={`${props.tool} ${external() ? i18n.t("ui.tool.mcpCall") : i18n.t("ui.tool.call")}`}
      >
        <div data-slot="generic-tool-console-header">
          <div data-slot="generic-tool-console-identity">
            <span data-slot="generic-tool-console-prompt" aria-hidden="true">
              &gt;_
            </span>
            <span>{external() ? i18n.t("ui.tool.mcpCall") : i18n.t("ui.tool.call")}</span>
          </div>
          <Show when={props.status}>
            <span data-slot="generic-tool-console-status" data-status={props.status}>
              {props.status}
            </span>
          </Show>
        </div>
        <Show when={hasInput()}>
          <section data-slot="generic-tool-console-request">
            <div data-slot="generic-tool-console-label">
              <span aria-hidden="true">›</span>
              {i18n.t("ui.tool.input")}
            </div>
            <div data-component="tool-output" data-slot="generic-tool-console-content">
              <Markdown text={formatToolResult(props.input)} />
            </div>
          </section>
        </Show>
        <Show when={hasOutput()}>
          <section data-slot="generic-tool-console-response">
            <div data-slot="generic-tool-console-label">
              <span aria-hidden="true">›</span>
              {i18n.t("ui.tool.output")}
            </div>
            <div data-component="tool-output" data-slot="generic-tool-console-content">
              <Markdown text={formatToolResult(props.output)} />
            </div>
          </section>
        </Show>
      </div>
    </BasicTool>
  )
}
