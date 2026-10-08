import { onCleanup, Show } from "solid-js"
import { Icon } from "@ikanban/ui/icon"
import { IconButton } from "@ikanban/ui/icon-button"
import { Tooltip } from "@ikanban/ui/tooltip"
import { ServerConnection } from "@/runtime/server/registry"
import type { ServerHealth } from "@/runtime/server/health"
import { ServerRowMenuView, serverMenuLabels } from "@/servers/registry/row-menu"
import { ServerHealthIndicator } from "@/servers/registry/row"
import { HomeProjectNavButton } from "./nav-parts"
import { serverContextMenuID, type HomeProjectsContextMenuProps, type HomeProjectsViewProps } from "./view-types"

export function HomeServerRow(props: {
  language: HomeProjectsViewProps["language"]
  projectsForServer: HomeProjectsViewProps["projectsForServer"]
  contextMenuOpen: HomeProjectsContextMenuProps["contextMenuOpen"]
  canDefaultServer: HomeProjectsViewProps["canDefaultServer"]
  defaultServerKey: HomeProjectsViewProps["defaultServerKey"]
  onFocusServer: HomeProjectsViewProps["onFocusServer"]
  onToggleCollapsed: HomeProjectsViewProps["onToggleCollapsed"]
  onEditServer: HomeProjectsViewProps["onEditServer"]
  onSetDefaultServer: HomeProjectsViewProps["onSetDefaultServer"]
  canRemoveServer: HomeProjectsViewProps["canRemoveServer"]
  onRemoveServer: HomeProjectsViewProps["onRemoveServer"]
  onSetContextMenuOpen: HomeProjectsContextMenuProps["onSetContextMenuOpen"]
  onChooseProject: HomeProjectsViewProps["onChooseProject"]
  server: ServerConnection.Http
  selected: boolean
  collapsed: boolean
  health: ServerHealth | undefined
}) {
  const healthy = () => !!props.health?.healthy
  const canToggle = () => healthy() && props.projectsForServer(props.server).length > 0
  const contextMenuID = () => serverContextMenuID(props.server)
  onCleanup(() => {
    const id = contextMenuID()
    if (props.contextMenuOpen(id)) props.onSetContextMenuOpen(id, false)
  })
  return (
    <div
      class="group/server relative flex h-7 w-full min-w-0 items-center rounded-[6px]"
      data-home-row
      data-dimmed={!healthy()}
      data-selected={props.selected ? "" : undefined}
    >
      <HomeProjectNavButton
        type="button"
        data-selected={props.selected ? "" : undefined}
        disabled={!healthy()}
        onClick={() => props.onFocusServer(props.server)}
      >
        <span
          data-action="home-server-collapse"
          class={`
          -ml-0.5 -mr-1.5 inline-flex size-5 shrink-0 items-center justify-center
          rounded-[4px] text-v2-icon-icon-muted
        `}
          classList={{
            "hover:bg-v2-overlay-simple-overlay-hover": canToggle(),
            "cursor-default opacity-40": !canToggle(),
          }}
          aria-label={
            props.collapsed ? props.language.t("home.server.expand") : props.language.t("home.server.collapse")
          }
          aria-disabled={!canToggle()}
          aria-expanded={canToggle() ? !props.collapsed : undefined}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            if (!canToggle()) return
            props.onToggleCollapsed(props.server)
          }}
          onPointerDown={(event) => event.preventDefault()}
        >
          <Icon
            name="chevron-down"
            size="small"
            class="transition-transform duration-150 ease-in-out"
            style={{ transform: `rotate(${props.collapsed || !canToggle() ? -90 : 0}deg)` }}
          />
        </span>
        <div class="flex size-4 shrink-0 items-center justify-center -mr-0.5">
          <ServerHealthIndicator health={props.health} />
        </div>
        <span
          data-slot="home-row-label"
          class="flex min-w-0 flex-1 items-center gap-1"
          classList={{ "opacity-60": !healthy() }}
        >
          <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {props.server.displayName ?? new URL(props.server.http.url).host}
          </span>
          <Show when={props.server.label}>
            {(label) => (
              <span
                class={`
                shrink-0 rounded-[3px] border border-v2-border-border-base px-1 py-0.5
                text-[9px] leading-none text-v2-text-text-muted
              `}
              >
                {label()}
              </span>
            )}
          </Show>
        </span>
      </HomeProjectNavButton>
      <div
        data-slot="home-row-actions"
        class={`
        hover-reveal absolute bottom-0 right-1 top-0 flex items-center gap-1 rounded-r-[6px] pl-2
        group-hover/server:opacity-100 focus-within:opacity-100 data-[menu=true]:opacity-100
      `}
        data-menu={props.contextMenuOpen(contextMenuID())}
      >
        <ServerRowMenuView
          server={props.server}
          labels={serverMenuLabels(props.language)}
          canDefault={props.canDefaultServer}
          isDefault={props.defaultServerKey === ServerConnection.key(props.server)}
          canRemove={props.canRemoveServer(props.server)}
          onEdit={props.onEditServer}
          onSetDefault={() => props.onSetDefaultServer(props.server)}
          onRemoveDefault={() => props.onSetDefaultServer(undefined)}
          onRemove={() => props.onRemoveServer(props.server)}
          open={props.contextMenuOpen(contextMenuID())}
          onOpenChange={(open) => props.onSetContextMenuOpen(contextMenuID(), open)}
        />
        <Tooltip class="flex shrink-0 items-center" placement="bottom" value={props.language.t("home.project.add")}>
          <IconButton
            data-action="home-add-project"
            variant="ghost-muted"
            size="small"
            icon={<Icon name="folder-add-left" />}
            aria-label={props.language.t("home.project.add")}
            disabled={props.health?.healthy === false}
            onClick={() => props.onChooseProject(props.server)}
          />
        </Tooltip>
      </div>
    </div>
  )
}
