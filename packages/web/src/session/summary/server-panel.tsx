import { Icon } from "@ikanban/ui/icon"
import { createEffect, createMemo, createUniqueId, For, on, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/runtime/i18n/language"
import { useServer } from "@/runtime/server/current"
import { ServerConnection, serverName } from "@/runtime/server/registry"
import { useGlobal } from "@/runtime/server/runtime"
import { useSettings } from "@/settings/model"
import type { McpControls } from "@/providers/connect/mcp"
import { ServiceMenu } from "./service-menus"
import { services, type Service } from "./service-popover"

export function SessionServerPanel(props: { directory: string; shown: boolean; mobile?: boolean; mcp?: McpControls }) {
  const language = useLanguage()
  const server = useServer()
  const global = useGlobal()
  const settings = useSettings()
  const contentID = createUniqueId()
  const expanded = settings.sessionSummary.serverExpanded
  const name = createMemo(() => {
    const servers = global.servers.list()
    if (servers.length < 2) return language.t("session.summary.server")
    return serverName(servers.find((connection) => ServerConnection.key(connection) === server.key) ?? server.conn)
  })
  const [store, setStore] = createStore<{ submenu?: Service }>({})
  createEffect(on([() => props.directory, () => props.shown, expanded], () => setStore("submenu", undefined)))

  return (
    <section class="session-summary-card" data-section="server">
      <button
        type="button"
        class="session-summary-row session-summary-heading"
        aria-expanded={expanded()}
        aria-controls={contentID}
        onClick={() => settings.sessionSummary.setServerExpanded(!expanded())}
      >
        <Icon name="server" class="shrink-0 text-v2-icon-icon-muted" />
        <span dir="auto" class="session-summary-label">
          {name()}
        </span>
        <Icon name="chevron-down" size="small" class="session-summary-disclosure" />
      </button>
      <Show when={expanded() ? props.directory : undefined} keyed>
        {(directory) => (
          <div id={contentID} class="session-summary-rows">
            <For each={services}>
              {(service) => (
                <ServiceMenu
                  service={service}
                  directory={directory}
                  shown={props.shown}
                  open={store.submenu === service.type}
                  mobile={props.mobile}
                  mcp={props.mcp}
                  onOpenChange={(open) => setStore("submenu", open ? service.type : undefined)}
                />
              )}
            </For>
          </div>
        )}
      </Show>
    </section>
  )
}
