import { createMemo, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Popover } from "@kobalte/core/popover"
import { ScrollView } from "@ikanban/ui/scroll-view"
import { Icon } from "@ikanban/ui/icon"
import { IconButton } from "@ikanban/ui/icon-button"
import { Tooltip } from "@ikanban/ui/tooltip"
import { ServerConnection } from "@/runtime/server/registry"
import type { useLanguage } from "@/runtime/i18n/language"
import { displayName } from "@/shell/layout/helpers"
import { HomeProjectAvatar, HomeProjectNavButton } from "./nav-parts"
import { HomeProjectEmpty, HomeProjectList } from "./project-list"
import { HomeServerRow } from "./server-row"
import { HOME_PROJECT_NAV_LABEL, type HomeProjectsViewProps } from "./view-types"
import "./view.css"

export type { HomeProjectsViewProps } from "./view-types"

export function HomeProjectsView(props: HomeProjectsViewProps) {
  const [state, setState] = createStore({ open: false })
  const selected = createMemo(() => props.projects.find((project) => project.worktree === props.selection.directory))
  const server = createMemo(() =>
    props.servers.find((server) => ServerConnection.key(server) === props.selection.server),
  )
  return (
    <Show when={props.dropdown} fallback={<HomeProjectsPanel {...props} />}>
      <Popover
        open={state.open}
        onOpenChange={(open) => setState("open", open)}
        placement="bottom-start"
        sameWidth
        gutter={6}
      >
        <Popover.Trigger
          data-component="home-projects-dropdown"
          aria-label={props.language.t("home.projects")}
          class="flex h-10 w-full min-w-0 items-center gap-2 rounded-[6px] bg-v2-background-bg-base px-1.5 text-start text-v2-text-text-base outline-none hover:bg-v2-background-bg-layer-01"
        >
          <Show when={selected()} fallback={<Icon name="folder" size="small" />}>
            {(project) => <HomeProjectAvatar project={project()} />}
          </Show>
          <span class="flex min-w-0 flex-1 flex-col leading-[var(--line-height-compact)]">
            <bdi class="truncate">
              <Show when={selected()} fallback={props.language.t("home.projects.all")}>
                {(project) => displayName(project())}
              </Show>
            </bdi>
            <Show when={props.servers.length > 1 && server()}>
              {(server) => (
                <bdi class="truncate text-v2-text-text-muted opacity-70">
                  {server().displayName ?? new URL(server().http.url).host}
                </bdi>
              )}
            </Show>
          </span>
          <Icon name="chevron-down" size="small" class="shrink-0 text-v2-icon-icon-muted" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            aria-label={props.language.t("home.projects")}
            dir={props.language.direction()}
            class="z-50 max-h-[min(70dvh,var(--kb-popper-content-available-height))] overflow-hidden rounded-[10px] bg-v2-background-bg-base p-1.5 shadow-[var(--v2-elevation-floating)] outline-none data-[expanded]:animate-in data-[expanded]:fade-in data-[expanded]:slide-in-from-top-2 duration-150 ease-out motion-reduce:animate-none"
          >
            <HomeProjectsPanel
              {...props}
              onSelectProject={(server, directory) => {
                props.onSelectProject(server, directory)
                setState("open", false)
              }}
              onFocusServer={(server) => {
                props.onFocusServer(server)
                setState("open", false)
              }}
              onChooseProject={(server) => {
                setState("open", false)
                props.onChooseProject(server)
              }}
              onAddProjects={(server, directories) => {
                setState("open", false)
                props.onAddProjects(server, directories)
              }}
              onOpenProjectNewSession={(server, directory) => {
                setState("open", false)
                props.onOpenProjectNewSession(server, directory)
              }}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover>
    </Show>
  )
}

function HomeProjectsPanel(props: HomeProjectsViewProps) {
  const [contextMenu, setContextMenu] = createStore({ open: undefined as string | undefined })
  const contextMenuProps = {
    contextMenuOpen: (id: string) => contextMenu.open === id,
    onSetContextMenuOpen: (id: string, open: boolean) => setContextMenu("open", open ? id : undefined),
  }
  return (
    <aside
      class={
        props.dropdown
          ? "flex max-h-[min(60dvh,calc(var(--kb-popper-content-available-height)-12px))] min-h-0 min-w-0 flex-col overflow-hidden"
          : `
        mt-6 flex min-h-0 min-w-0 flex-col gap-4 overflow-hidden
        lg:sticky lg:top-14 lg:mt-14 lg:h-[calc(100cqh-56px)] lg:self-start lg:pt-[52px]
      `
      }
      aria-label={props.language.t("home.projects")}
      onWheel={(event) => {
        if (event.target === event.currentTarget) return
        props.onWheel(event)
      }}
    >
      <Show when={!props.dropdown}>
        <div class="flex h-7 min-w-0 shrink-0 items-center justify-between pl-1.5 pr-3">
          <div class="text-v2-text-text-muted [font-weight:530]">{props.language.t("home.projects")}</div>
          <Show when={props.servers.length === 1 && !(props.projects.length === 0 && props.recentlyClosed.length > 0)}>
            <Tooltip placement="bottom" value={props.language.t("home.project.add")}>
              <IconButton
                data-action="home-add-project"
                variant="ghost-muted"
                size="large"
                class="titlebar-icon [&_[data-slot=icon-svg]]:text-v2-icon-icon-muted"
                icon={<Icon name="folder-add-left" />}
                disabled={props.serverHealth(props.servers[0])?.healthy === false}
                onClick={() => props.onChooseProject(props.servers[0])}
                aria-label={props.language.t("home.project.add")}
              />
            </Tooltip>
          </Show>
        </div>
      </Show>
      <ScrollView data-slot="home-projects-scroll" class="min-h-0 min-w-0 shrink">
        <Show when={props.dropdown && props.servers.length === 1}>
          <HomeProjectNavButton
            type="button"
            class="mb-1"
            data-selected={!props.selection.directory ? "" : undefined}
            onClick={() => props.onFocusServer(props.servers[0])}
          >
            <Icon name="folder" size="small" />
            <span class={HOME_PROJECT_NAV_LABEL}>{props.language.t("home.projects.all")}</span>
          </HomeProjectNavButton>
        </Show>
        <Show
          when={props.servers.length > 1}
          fallback={
            <Show when={props.servers[0]}>
              {(server) => (
                <div class={props.dropdown ? "" : "pr-3"}>
                  <Show
                    when={props.projects.length > 0}
                    fallback={<HomeProjectEmpty {...props} server={server()} items={props.recentlyClosed} />}
                  >
                    <HomeProjectList {...props} {...contextMenuProps} server={server()} items={props.projects} />
                    <Show when={props.dropdown}>
                      <HomeProjectNavButton
                        type="button"
                        data-action="home-add-project-row"
                        class="mt-1 disabled:opacity-60"
                        disabled={props.serverHealth(server())?.healthy === false}
                        onClick={() => props.onChooseProject(server())}
                      >
                        <Icon name="folder-add-left" size="small" />
                        <span class={HOME_PROJECT_NAV_LABEL}>{props.language.t("home.project.add")}</span>
                      </HomeProjectNavButton>
                    </Show>
                  </Show>
                </div>
              )}
            </Show>
          }
        >
          <div class={`flex min-w-0 flex-col ${props.dropdown ? "gap-1" : "gap-4 pr-3"}`}>
            <For each={props.servers}>
              {(item) => {
                const projects = () => props.projectsForServer(item)
                const healthy = () => !!props.serverHealth(item)?.healthy
                const hasProjects = () => projects().length > 0
                const collapsed = () => props.collapsed(item)
                return (
                  <div class="flex min-w-0 flex-col gap-1">
                    <HomeServerRow
                      server={item}
                      {...props}
                      {...contextMenuProps}
                      selected={props.selection.server === ServerConnection.key(item) && !props.selection.directory}
                      collapsed={collapsed()}
                      health={props.serverHealth(item)}
                    />
                    <Show when={healthy() && hasProjects() && !collapsed()}>
                      <div class="mx-3 h-px bg-v2-border-border-base" />
                      <HomeProjectList {...props} {...contextMenuProps} server={item} items={projects()} />
                    </Show>
                  </div>
                )
              }}
            </For>
          </div>
        </Show>
      </ScrollView>
      <HomeUtilityNav
        class="mb-8 mt-4 hidden shrink-0 lg:flex"
        onOpenSettings={props.onOpenSettings}
        onOpenHelp={props.onOpenHelp}
        language={props.language}
      />
    </aside>
  )
}

export function HomeUtilityNav(props: {
  class?: string
  onOpenSettings: () => void
  onOpenHelp: () => void
  language: ReturnType<typeof useLanguage>
}) {
  return (
    <div
      class={`${props.class ?? ""} min-w-0 flex-row justify-between gap-1 lg:flex-col lg:justify-start lg:pr-3 [&>button]:w-auto lg:[&>button]:w-full`}
    >
      <HomeProjectNavButton
        type="button"
        class="text-v2-text-text-faint [&>[data-slot=icon-svg]]:text-v2-icon-icon-muted"
        onClick={props.onOpenSettings}
      >
        <Icon name="settings-gear" size="small" />
        <span class={HOME_PROJECT_NAV_LABEL}>{props.language.t("sidebar.settings")}</span>
      </HomeProjectNavButton>
      <HomeProjectNavButton
        type="button"
        class="text-v2-text-text-faint [&>[data-slot=icon-svg]]:text-v2-icon-icon-muted"
        onClick={props.onOpenHelp}
      >
        <Icon name="help" size="small" />
        <span class={HOME_PROJECT_NAV_LABEL}>{props.language.t("sidebar.help")}</span>
      </HomeProjectNavButton>
    </div>
  )
}
