import { Popover } from "@kobalte/core/popover"
import { Icon } from "@ikanban/ui/icon"
import { Tooltip } from "@ikanban/ui/tooltip"
import { createEffect, createMemo, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/runtime/i18n/language"
import { useServer } from "@/runtime/server/current"
import { useServerSDK } from "@/runtime/server/client"
import { showToast } from "@/shell/notifications/toast"
import type { McpControls } from "@/providers/connect/mcp"

export const services = [
  { type: "mcp", icon: "mcp", label: "session.summary.mcp" },
  { type: "plugins", icon: "cube", label: "session.summary.plugins" },
  { type: "skills", icon: "graduation-cap", label: "session.summary.skills" },
  { type: "lsp", icon: "code-slash", label: "session.summary.lsp" },
] as const

export type Service = (typeof services)[number]["type"]

export type ServiceMenuProps = {
  service: (typeof services)[number]
  directory: string
  shown: boolean
  open: boolean
  mobile?: boolean
  mcp?: McpControls
  onOpenChange: (open: boolean) => void
}

export function ServicePopover(
  props: ServiceMenuProps & {
    loading: boolean
    ready: boolean
    empty: boolean
    error: unknown
    retry: () => unknown
    children: JSX.Element
  },
) {
  const language = useLanguage()
  const placement = createMemo(() =>
    props.mobile ? "top-end" : language.direction() === "rtl" ? "right-start" : "left-start",
  )
  return (
    <Popover
      open={props.open}
      onOpenChange={(open) => {
        props.onOpenChange(open)
        if (open && !props.loading) void props.retry()
      }}
      placement={placement()}
      gutter={4}
      overflowPadding={16}
      modal={false}
    >
      <Popover.Trigger as="button" type="button" class="session-summary-row">
        <Icon name={props.service.icon} class="shrink-0 text-v2-icon-icon-muted" />
        <span class="session-summary-label">{language.t(props.service.label)}</span>
        <Icon name="fill-triangle-down" class="session-summary-menu-indicator shrink-0 text-v2-icon-icon-muted" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          class="session-service-menu"
          data-service={props.service.type}
          data-empty={(props.ready && !props.error && props.empty) || undefined}
          aria-busy={props.loading}
          aria-label={language.t(props.service.label)}
        >
          <Show
            when={props.ready || !props.loading}
            fallback={
              <div class="session-service-message" role="status">
                {language.t("common.loading")}
              </div>
            }
          >
            <Show
              when={!props.error}
              fallback={
                <div class="session-service-message" role="alert">
                  <p>{language.t("common.requestFailed")}</p>
                  <button type="button" class="session-summary-row" onClick={() => props.retry()}>
                    {language.t("session.summary.retry")}
                  </button>
                </div>
              }
            >
              {props.children}
            </Show>
          </Show>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  )
}

export function ServiceConfigLink(props: { directory: string; service: Service }) {
  const language = useLanguage()
  const server = useServer()
  const sdk = useServerSDK()
  const [store, setStore] = createStore({ opening: false, copied: false })
  createEffect(() => {
    if (!store.copied) return
    const timeout = setTimeout(() => setStore("copied", false), 2000)
    onCleanup(() => clearTimeout(timeout))
  })
  const activate = async () => {
    if (store.opening) return
    setStore({ opening: true, copied: false })
    const directory = props.directory
    await sdk.api.config
      .get({ location: { directory } })
      .then(async (entries) => {
        const documents = entries
          .filter((entry) => entry.type === "document")
          .filter((entry) => entry.path !== undefined && /\.jsonc?$/.test(entry.path))
        const path =
          documents.findLast((entry) => entry.info[props.service] !== undefined)?.path ?? documents.at(-1)?.path
        if (!path) throw new Error(language.t("session.summary.configFileMissing"))
        await navigator.clipboard.writeText(path)
        setStore("copied", true)
      })
      .catch((error: unknown) =>
        showToast({
          variant: "error",
          title: language.t("common.requestFailed"),
          description: error instanceof Error ? error.message : String(error),
        }),
      )
      .finally(() => setStore("opening", false))
  }
  return (
    <>
      <span class="session-service-config-separator" role="separator" />
      <Show
        when={!server.isLocal}
        fallback={
          <span class="session-service-row">
            <Icon name="settings-gear" class="shrink-0 text-v2-icon-icon-muted" />
            {language.t("session.summary.configure")}
          </span>
        }
      >
        <Tooltip
          value={language.t(store.copied ? "ui.message.copied" : "ui.message.copy")}
          placement="top"
          getAnchorRect={(anchor) => anchor?.querySelector("svg")?.getBoundingClientRect()}
          forceOpen={store.copied ? true : undefined}
          class="w-full"
        >
          <button
            type="button"
            class="session-service-config"
            disabled={store.opening}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void activate()}
          >
            <Icon name={store.copied ? "check" : "outline-copy"} class="shrink-0 text-v2-icon-icon-muted" />
            <span class="session-summary-label">{language.t("session.summary.copyConfigPath")}</span>
          </button>
        </Tooltip>
      </Show>
    </>
  )
}

export function ServiceEmpty(props: { title: string; directory: string; service: Service }) {
  return (
    <div class="session-service-empty">
      <strong>{props.title}</strong>
      <div class="session-service-footer">
        <ServiceConfigLink directory={props.directory} service={props.service} />
      </div>
    </div>
  )
}
