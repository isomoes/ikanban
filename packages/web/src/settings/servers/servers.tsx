import { Badge } from "@ikanban/ui/badge"
import { useDialog } from "@ikanban/ui/context/dialog"
import { createMemo, Show, type Component } from "solid-js"
import { ServerRowMenu } from "@/servers/registry/row-menu"
import { ServerHealthIndicator } from "@/servers/registry/row"
import { useLanguage } from "@/runtime/i18n/language"
import { ServerConnection, serverName } from "@/runtime/server/registry"
import { useServerCollectionController } from "@/servers/registry/controller"
import { DialogServer } from "@/servers/connect/dialog"
import { AddServerMenu } from "@/servers/registry/add-menu"
import { SettingsList } from "@/settings/list"
import { ShellSetting } from "@/settings/general/general"
import { createServerShellController } from "@/settings/general/controllers"
import type { SettingsServer } from "./inventory"
import "@/settings/settings.css"

export const SettingsServerGeneral: Component<{
  entry: SettingsServer
  nested?: boolean
  onAddServer?: () => void
  onServerChange?: (server: ServerConnection.Http) => void
}> = (props) => {
  const dialog = useDialog()
  const language = useLanguage()
  const controller = useServerCollectionController()
  const health = createMemo(() => controller.collection.health()[props.entry.key])
  const edit = (server: ServerConnection.Http) =>
    void dialog.push(() => <DialogServer mode="edit" server={server} onSave={props.onServerChange} />)

  return (
    <>
      <div class="settings-tab-header">
        <div class="settings-tab-header-row">
          <div class="flex flex-col gap-1">
            <h2 class="settings-tab-title">
              {props.nested ? props.entry.name : language.t("settings.section.server")}
            </h2>
            <span class="text-11-regular text-v2-text-text-muted">
              {language.t(props.nested ? "settings.server.description" : "settings.servers.description")}
            </span>
          </div>
          <Show when={!props.nested && props.onAddServer}>
            <AddServerMenu onAddServer={() => props.onAddServer?.()} />
          </Show>
        </div>
      </div>

      <div class="settings-tab-body settings-tab-body--sectioned">
        <section class="settings-section settings-server-connection" data-component="settings-server-connection">
          <h3 class="settings-section-title">{language.t("settings.server.section.connection")}</h3>
          <SettingsList>
            <div class="settings-servers-row">
              <div class="settings-servers-lead">
                <ServerHealthIndicator health={health()} />
                <div class="settings-servers-copy">
                  <bdi class="settings-servers-name" dir="auto">
                    {serverName(props.entry.connection) || props.entry.key}
                  </bdi>
                  <bdi class="settings-servers-meta" dir="ltr">
                    {props.entry.connection.http.url}
                  </bdi>
                </div>
              </div>
              <div class="settings-servers-actions">
                <Show when={controller.defaults.available() && controller.defaults.key() === props.entry.key}>
                  <Badge>{language.t("dialog.server.status.default")}</Badge>
                </Show>
                <ServerRowMenu server={props.entry.connection} domain={controller} onEdit={edit} />
              </div>
            </div>
          </SettingsList>
        </section>

        <Show when={props.entry.connection} keyed>
          {(server) => <ServerShell server={server} />}
        </Show>
      </div>
    </>
  )
}

function ServerShell(props: { server: ServerConnection.Http }) {
  const language = useLanguage()
  const controller = createServerShellController(() => props.server)
  return (
    <section class="settings-section">
      <h3 class="settings-section-title">{language.t("settings.tab.preferences")}</h3>
      <SettingsList>
        <ShellSetting controller={controller} />
      </SettingsList>
    </section>
  )
}
