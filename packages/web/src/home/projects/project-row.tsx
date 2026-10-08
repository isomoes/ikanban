import { onCleanup } from "solid-js"
import { useSortable } from "@dnd-kit/solid/sortable"
import { Icon } from "@ikanban/ui/icon"
import { IconButton } from "@ikanban/ui/icon-button"
import { Menu } from "@ikanban/ui/menu"
import type { ServerConnection } from "@/runtime/server/registry"
import type { LocalProject } from "@/shell/state/layout"
import { displayName } from "@/shell/layout/helpers"
import { HomeProjectAvatar, HomeProjectNavButton } from "./nav-parts"
import {
  HOME_PROJECT_NAV_LABEL,
  projectContextMenuID,
  type HomeProjectsContextMenuProps,
  type HomeProjectsViewProps,
} from "./view-types"

export function HomeProjectRow(
  props: HomeProjectsViewProps &
    HomeProjectsContextMenuProps & {
      project: LocalProject
      server: ServerConnection.Http
      index: number
      serverSelected: boolean
      selected: boolean
      unseen: number
    },
) {
  const serverUnreachable = () => props.serverHealth(props.server)?.healthy === false
  const sortable = useSortable({
    get id() {
      return props.project.worktree
    },
    get index() {
      return props.index
    },
  })
  let pointerDownSelected: boolean | undefined
  const contextMenuID = () => projectContextMenuID(props.server, props.project.worktree)
  onCleanup(() => {
    const id = contextMenuID()
    if (props.contextMenuOpen(id)) props.onSetContextMenuOpen(id, false)
  })
  return (
    <div
      ref={sortable.ref}
      class="group/project relative flex h-7 min-w-0 items-center rounded-[6px]"
      classList={{ "z-10": sortable.isDragSource() }}
      data-home-row
      data-dimmed={serverUnreachable()}
      data-dragging={sortable.isDragSource()}
      data-selected={props.selected ? "" : undefined}
      onContextMenu={(event) => {
        event.preventDefault()
        props.onSetContextMenuOpen(contextMenuID(), true)
      }}
    >
      <HomeProjectNavButton
        type="button"
        data-component="home-project-row"
        class="disabled:opacity-60"
        classList={{
          "bg-v2-background-bg-layer-01 text-v2-text-text-base": sortable.isDragSource(),
        }}
        data-selected={props.selected ? "" : undefined}
        aria-current={props.selected ? "page" : undefined}
        disabled={serverUnreachable()}
        onPointerDown={(event) => {
          // Same-server mouse selection happens on pointerdown (like tabs),
          // but only ever selects; selectProject toggles, and deselecting here
          // would fire on every drag before the threshold is met. Cross-server
          // selection waits for click so reordering a remote server's projects
          // does not focus that server and load its session index. Touch is
          // excluded so flick-scrolling the list cannot select rows.
          pointerDownSelected = undefined
          if (props.dropdown) return
          if (event.button !== 0 || event.pointerType === "touch") return
          if (!props.serverSelected) return
          pointerDownSelected = props.selected
          if (!props.selected) props.onSelectProject(props.server, props.project.worktree)
        }}
        onClick={(event) => {
          // The drag sensor calls preventDefault on post-drag clicks; never
          // toggle selection as part of a reorder.
          if (event.defaultPrevented) return
          // Keyboard activation and touch taps keep the original toggle.
          if (event.detail === 0 || pointerDownSelected === undefined) {
            props.onSelectProject(props.server, props.project.worktree)
            return
          }
          // Mouse: pointerdown already selected unselected rows; a plain click
          // on an already-selected row toggles it off.
          if (pointerDownSelected) props.onSelectProject(props.server, props.project.worktree)
          pointerDownSelected = undefined
        }}
      >
        <HomeProjectAvatar project={props.project} />
        <span data-slot="home-row-label" class={HOME_PROJECT_NAV_LABEL}>
          {displayName(props.project)}
        </span>
      </HomeProjectNavButton>
      <div
        data-slot="home-row-actions"
        class={`
          hover-reveal absolute bottom-0 right-1 top-0 flex items-center gap-1 rounded-r-[6px] pl-2
          group-hover/project:opacity-100 focus-within:opacity-100 data-[menu=true]:opacity-100
        `}
        data-menu={props.contextMenuOpen(contextMenuID())}
      >
        <Menu
          gutter={6}
          modal={false}
          placement="bottom-end"
          open={props.contextMenuOpen(contextMenuID())}
          onOpenChange={(open) => props.onSetContextMenuOpen(contextMenuID(), open)}
        >
          <Menu.Trigger
            as={IconButton}
            data-action="home-project-menu"
            variant="ghost-muted"
            size="small"
            icon={<Icon name="outline-dots" />}
            aria-label={props.language.t("common.moreOptions")}
          />
          <Menu.Portal>
            <Menu.Content>
              <Menu.Item onSelect={() => props.onOpenProjectNewSession(props.server, props.project.worktree)}>
                {props.language.t("command.session.new")}
              </Menu.Item>
              <Menu.Item onSelect={() => props.onEditProject(props.server, props.project)}>
                {props.language.t("dialog.project.edit.title")}
              </Menu.Item>
              <Menu.Item
                disabled={props.unseen === 0}
                onSelect={() => props.onClearNotifications(props.server, props.project)}
              >
                {props.language.t("sidebar.project.clearNotifications")}
              </Menu.Item>
              <Menu.Separator />
              <Menu.Item onSelect={() => props.onCloseProject(props.server, props.project.worktree)}>
                {props.language.t("common.close")}
              </Menu.Item>
            </Menu.Content>
          </Menu.Portal>
        </Menu>
        <IconButton
          data-action="home-project-new-session"
          variant="ghost-muted"
          size="small"
          icon={<Icon name="edit" />}
          aria-label={props.language.t("command.session.new")}
          onClick={() => props.onOpenProjectNewSession(props.server, props.project.worktree)}
        />
      </div>
    </div>
  )
}
