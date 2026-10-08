import { Switch } from "@ikanban/ui/switch"
import { createEffect, createMemo, createResource, For, Index, onCleanup, Show } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { useData } from "@/runtime/server/current"
import { useServerSDK } from "@/runtime/server/client"
import { pluginLabel } from "@/providers/catalog/plugin"
import { useMcpToggle } from "@/providers/connect/mcp"
import { configuredLsps } from "./configured-lsp"
import { ServiceConfigLink, ServiceEmpty, ServicePopover, type ServiceMenuProps } from "./service-popover"

export function ServiceMenu(props: ServiceMenuProps) {
  if (props.service.type === "mcp") return <McpMenu {...props} />
  if (props.service.type === "lsp") return <LspMenu {...props} />
  return <ServiceCatalog {...props} />
}

function LspMenu(props: ServiceMenuProps) {
  const data = useData()
  const sdk = useServerSDK()
  const language = useLanguage()
  const [load, { refetch }] = createResource(
    () => props.shown && props.directory,
    (directory) => {
      data.location.config.invalidate({ directory })
      return data.location.config.sync({ directory })
    },
  )
  const names = createMemo(() => configuredLsps(data.location.config.list({ directory: props.directory }) ?? []))
  createEffect(() => {
    onCleanup(sdk.event.location(props.directory).on("config.updated", () => void refetch()))
  })
  return (
    <ServicePopover
      {...props}
      loading={load.loading}
      ready={data.location.config.list({ directory: props.directory }) !== undefined}
      empty={names().length === 0}
      error={load.error}
      retry={refetch}
    >
      <Show
        when={names().length}
        fallback={
          <ServiceEmpty title={language.t("session.summary.lsp.empty")} directory={props.directory} service="lsp" />
        }
      >
        <h3 class="session-service-title">{language.t("session.summary.lsp.configured")}</h3>
        <For each={names()}>
          {(name) => (
            <div class="session-service-row">
              <span dir="auto" class="session-summary-label">
                {name}
              </span>
            </div>
          )}
        </For>
        <div class="session-service-footer">
          <ServiceConfigLink directory={props.directory} service="lsp" />
        </div>
      </Show>
    </ServicePopover>
  )
}

function McpMenu(props: ServiceMenuProps) {
  const data = useData()
  const language = useLanguage()
  const toggle = useMcpToggle(() => props.directory)
  const [load, { refetch }] = createResource(
    () => props.shown && ([props.directory, props.mcp?.preview] as const),
    async ([directory, preview]) => {
      data.location.mcp.server.invalidate({ directory })
      await Promise.all([
        data.location.mcp.server.sync({ directory }),
        ...(preview ? [data.location.config.sync({ directory })] : []),
      ])
    },
  )
  const servers = createMemo(() =>
    (data.location.mcp.server.list({ directory: props.directory }) ?? []).toSorted((a, b) =>
      a.name.localeCompare(b.name),
    ),
  )
  const defaults = createMemo(() =>
    Object.fromEntries(
      (data.location.config.list({ directory: props.directory }) ?? []).flatMap((entry) =>
        entry.type === "document"
          ? Object.entries(entry.info.mcp?.servers ?? {}).map(([name, config]) => [name, !config.disabled] as const)
          : [],
      ),
    ),
  )

  return (
    <ServicePopover
      {...props}
      loading={load.loading}
      ready={
        data.location.mcp.server.list({ directory: props.directory }) !== undefined &&
        (!props.mcp?.preview || data.location.config.list({ directory: props.directory }) !== undefined)
      }
      empty={servers().length === 0}
      error={load.error}
      retry={refetch}
    >
      <Show
        when={servers().length}
        fallback={
          <ServiceEmpty title={language.t("session.summary.mcp.empty")} directory={props.directory} service="mcp" />
        }
      >
        <h3 class="session-service-title">{language.t("session.summary.mcp.title")}</h3>
        <Show when={props.mcp?.preview}>
          <div class="session-service-message" data-slot="mcp-preview-hint">
            {language.t("session.summary.mcp.onCreation")}
          </div>
        </Show>
        <Index each={servers()}>
          {(server) => {
            const preview = () => props.mcp?.preview === true
            const enabled = () =>
              preview()
                ? (props.mcp?.states[server().name] ?? defaults()[server().name] ?? true)
                : server().status.status !== "disabled"
            const pending = () =>
              (props.mcp?.pending ?? toggle.isPending) || (!preview() && server().status.status === "pending")
            const error = () => {
              const status = server().status
              return status.status === "failed" ? status.error : undefined
            }
            const label = () => {
              if (preview()) return undefined
              const status = server().status.status
              if (status === "failed") return language.t("session.summary.failed")
              if (status === "pending") return language.t("session.summary.connecting")
              if (status === "needs_auth") return language.t("session.summary.needsAuth")
              return undefined
            }
            const change = (value: boolean) => {
              if (pending()) return
              if (props.mcp) return props.mcp.change(server().name, value)
              toggle.mutate({ name: server().name, enabled: value })
            }
            return (
              <Switch
                class="session-mcp-row [&_[data-slot=switch-description]]:sr-only"
                description={preview() ? language.t("session.summary.mcp.onCreation") : label()}
                checked={enabled()}
                readOnly={pending()}
                aria-disabled={pending()}
                aria-busy={props.mcp?.pending ?? toggle.isPending}
                onChange={change}
                onClick={(event: MouseEvent) => {
                  if (event.target === event.currentTarget) change(!enabled())
                }}
                title={preview() ? server().name : (error() ?? server().name)}
              >
                <span
                  class="session-service-dot"
                  data-status={preview() ? undefined : server().status.status}
                  aria-hidden="true"
                />
                <span dir="auto" class="session-summary-label">
                  {server().name}
                </span>
                <Show when={label()}>
                  {(status) => (
                    <span class="session-service-status" aria-hidden="true">
                      {status()}
                    </span>
                  )}
                </Show>
              </Switch>
            )
          }}
        </Index>
        <div class="session-service-footer">
          <ServiceConfigLink directory={props.directory} service="mcp" />
        </div>
      </Show>
    </ServicePopover>
  )
}

function ServiceCatalog(props: ServiceMenuProps) {
  const data = useData()
  const sdk = useServerSDK()
  const language = useLanguage()
  const [items, { refetch }] = createResource(
    () => props.shown && props.directory,
    async (directory) => {
      if (props.service.type === "plugins") {
        const result = await sdk.api.plugin.list({ location: { directory } })
        return result.data
          .filter((plugin) => plugin.source.type !== "builtin")
          .map((plugin) => ({
            name: pluginLabel(plugin),
            status: plugin.state.status,
            error: plugin.state.status === "failed" ? plugin.state.error : undefined,
          }))
      }
      data.location.skill.invalidate({ directory })
      await data.location.skill.sync({ directory })
      return undefined
    },
  )
  const loaded = () => items.state === "ready" || items.state === "refreshing"
  const list = createMemo(() => {
    const entries =
      props.service.type === "plugins"
        ? loaded()
          ? (items.latest ?? [])
          : []
        : (data.location.skill.list({ directory: props.directory }) ?? []).map((skill) => ({
            name: skill.name,
            status: "active",
            error: undefined,
          }))
    return entries.toSorted((a, b) => a.name.localeCompare(b.name))
  })
  createEffect(() => {
    onCleanup(
      sdk.event
        .location(props.directory)
        .on(props.service.type === "plugins" ? "plugin.updated" : "skill.updated", () => void refetch()),
    )
  })
  return (
    <ServicePopover
      {...props}
      loading={items.loading}
      ready={
        props.service.type === "plugins"
          ? loaded()
          : data.location.skill.list({ directory: props.directory }) !== undefined
      }
      empty={list().length === 0}
      error={items.error}
      retry={refetch}
    >
      <Show
        when={list().length}
        fallback={
          <ServiceEmpty
            title={language.t(
              props.service.type === "plugins" ? "session.summary.plugins.empty" : "session.summary.skills.empty",
            )}
            directory={props.directory}
            service={props.service.type}
          />
        }
      >
        <h3 class="session-service-title">
          {language.t(
            props.service.type === "plugins"
              ? "session.summary.plugins.configured"
              : "session.summary.skills.configured",
          )}
        </h3>
        <For each={list()}>
          {(item) => (
            <div class="session-service-row" title={item.error ?? item.name}>
              <span class="session-service-dot" data-status={item.status} aria-hidden="true" />
              <span dir="auto" class="session-summary-label">
                {item.name}
              </span>
              <Show when={item.status === "failed"}>
                <span class="session-service-status">{language.t("session.summary.failed")}</span>
              </Show>
            </div>
          )}
        </For>
        <div class="session-service-footer">
          <ServiceConfigLink directory={props.directory} service={props.service.type} />
        </div>
      </Show>
    </ServicePopover>
  )
}

