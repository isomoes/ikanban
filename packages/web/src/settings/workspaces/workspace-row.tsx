import { For, Show, type JSX } from "solid-js"
import type { SessionInfo } from "@opencode/client/promise"
import { Icon } from "@ikanban/ui/icon"
import { IconButton } from "@ikanban/ui/icon-button"
import { Tooltip } from "@ikanban/ui/tooltip"
import { getFilename } from "@opencode/util/path"
import { useLanguage } from "@/runtime/i18n/language"
import { sessionLabel } from "@/session/title"
import type { Project } from "@/runtime/server/types"
import { WorkspacePath } from "./workspace-path"

export type Workspace = {
  directory: string
  project: Project
}

export function WorkspaceRow(props: {
  workspace: Workspace
  sessions: SessionInfo[]
  count: JSX.Element
  lastActive: string | undefined
  sessionTime: (session: SessionInfo) => string | undefined
  deleting: boolean
  removing: boolean
  disabled: boolean
  onDelete: () => void
}) {
  const language = useLanguage()
  return (
    <div class="settings-workspaces-row-motion" data-removing={props.removing}>
      <div class="settings-workspaces-row">
        <div class="settings-workspaces-row-header">
          <div class="settings-workspaces-copy">
            <div class="settings-workspaces-main">
              <WorkspacePath directory={props.workspace.directory} />
            </div>
            <span class="settings-workspaces-meta">{props.count}</span>
          </div>
          <div class="settings-workspaces-row-actions">
            <Show
              when={props.deleting}
              fallback={
                <>
                  <Show when={props.lastActive}>
                    {(value) => (
                      <Tooltip value={language.t("settings.workspaces.lastActiveSession")} placement="top-end">
                        <span tabIndex={0} class="settings-workspaces-active">
                          {value()}
                        </span>
                      </Tooltip>
                    )}
                  </Show>
                  <IconButton
                    type="button"
                    variant="ghost-muted"
                    size="small"
                    aria-label={language.t("workspace.delete.confirm", {
                      name: getFilename(props.workspace.directory),
                    })}
                    disabled={props.disabled}
                    icon={<Icon name="outline-trash" size="small" />}
                    onClick={props.onDelete}
                  />
                </>
              }
            >
              <span class="settings-workspaces-active">{language.t("workspace.lifecycle.deleting")}</span>
            </Show>
          </div>
        </div>
        <Show when={props.sessions.length > 0}>
          <div class="settings-workspaces-sessions">
            <For each={props.sessions}>
              {(session) => (
                <div class="settings-workspaces-session">
                  <span>{sessionLabel(session)}</span>
                  <Show when={props.sessions.length > 1 ? props.sessionTime(session) : undefined}>
                    {(time) => <span class="settings-workspaces-session-time">{time()}</span>}
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  )
}
