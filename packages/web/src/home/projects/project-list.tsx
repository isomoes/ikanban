import { createMemo, For, Show } from "solid-js"
import { DragDropProvider, PointerSensor } from "@dnd-kit/solid"
import { isSortable } from "@dnd-kit/solid/sortable"
import { AutoScroller, Feedback, PointerActivationConstraints } from "@dnd-kit/dom"
import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers"
import { RestrictToElement } from "@dnd-kit/dom/modifiers"
import { Icon } from "@ikanban/ui/icon"
import { Tooltip } from "@ikanban/ui/tooltip"
import { ServerConnection } from "@/runtime/server/registry"
import type { LocalProject } from "@/shell/state/layout"
import { displayName } from "@/shell/layout/helpers"
import { HomeProjectAvatar, HomeProjectNavButton } from "./nav-parts"
import { HomeProjectRow } from "./project-row"
import { HOME_PROJECT_NAV_LABEL, type HomeProjectListProps, type HomeProjectsViewProps } from "./view-types"

export function HomeProjectList(props: HomeProjectListProps) {
  let listRef!: HTMLDivElement

  return (
    <DragDropProvider
      sensors={(defaults) => [
        ...defaults.filter((sensor) => sensor !== PointerSensor),
        PointerSensor.configure({
          activationConstraints: (event) =>
            event.pointerType === "touch"
              ? [new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })]
              : [new PointerActivationConstraints.Distance({ value: 4 })],
          preventActivation: (event) => event.target instanceof Element && !!event.target.closest("[data-action]"),
        }),
      ]}
      modifiers={[RestrictToVerticalAxis, RestrictToElement.configure({ element: () => listRef })]}
      plugins={(defaults) => [
        ...defaults.filter((plugin) => plugin !== AutoScroller && plugin !== Feedback),
        AutoScroller.configure({ acceleration: 8, threshold: { x: 0, y: 0.05 } }),
        Feedback.configure({ dropAnimation: null }),
      ]}
      onDragEnd={(event) => {
        const source = event.operation.source
        if (event.canceled || !isSortable(source)) return
        if (source.initialIndex !== source.index) props.onMoveProject(props.server, source.id.toString(), source.index)
        if (props.selection.server !== ServerConnection.key(props.server))
          props.onSelectProject(props.server, source.id.toString())
      }}
    >
      <div class="flex min-w-0 flex-col gap-1" ref={listRef}>
        {/* Keyed on worktree strings: the enriched project objects are
            recreated on every store or sync update, so iterating them directly
            remounts all rows — killing any in-flight drag activation (the
            row's sortable unregisters on unmount) and discarding animations.
            String keys keep row elements alive and move them on reorder. */}
        <For each={props.items.map((project) => project.worktree)}>
          {(worktree, index) => <HomeProjectSlot {...props} worktree={worktree} index={index()} />}
        </For>
      </div>
    </DragDropProvider>
  )
}

function HomeProjectSlot(
  props: HomeProjectListProps & {
    worktree: string
    index: number
  },
) {
  const initial = props.items.find((item) => item.worktree === props.worktree)
  if (!initial) return
  const project = createMemo<LocalProject>(
    (previous) => props.items.find((item) => item.worktree === props.worktree) ?? previous,
    initial,
  )

  return (
    <HomeProjectRow
      {...props}
      project={project()}
      server={props.server}
      index={props.index}
      serverSelected={props.selection.server === ServerConnection.key(props.server)}
      selected={
        props.selection.server === ServerConnection.key(props.server) && props.selection.directory === props.worktree
      }
      unseen={props.unseenCount(props.server, project())}
    />
  )
}

export function HomeProjectEmpty(
  props: HomeProjectsViewProps & {
    server: ServerConnection.Http
    items: LocalProject[]
  },
) {
  const unreachable = () => props.serverHealth(props.server)?.healthy === false
  return (
    <div class="flex min-w-0 flex-col gap-1">
      <HomeProjectNavButton
        type="button"
        data-action="home-add-project-row"
        class="disabled:opacity-60 [&>[data-slot=icon-svg]]:text-v2-icon-icon-muted"
        disabled={unreachable()}
        onClick={() => props.onChooseProject(props.server)}
      >
        <Icon name="folder-add-left" size="small" />
        <span class={HOME_PROJECT_NAV_LABEL}>{props.language.t("home.project.add")}</span>
      </HomeProjectNavButton>
      <Show when={props.items.length > 0}>
        <div class="mt-3 flex h-7 min-w-0 shrink-0 items-center pl-1.5 pr-3">
          <div class="text-v2-text-text-faint [font-weight:530]">{props.language.t("home.recentlyClosed")}</div>
        </div>
        <For each={props.items}>
          {(project) => <HomeRecentlyClosedRow {...props} project={project} server={props.server} />}
        </For>
      </Show>
    </div>
  )
}

function HomeRecentlyClosedRow(
  props: HomeProjectsViewProps & {
    project: LocalProject
    server: ServerConnection.Http
  },
) {
  const unreachable = () => props.serverHealth(props.server)?.healthy === false
  const path = () => {
    const home = props.homedir
    const worktree = props.project.worktree
    if (home && (worktree === home || worktree.startsWith(`${home}/`))) return `~${worktree.slice(home.length)}`
    return worktree
  }
  return (
    <Tooltip placement="right" value={path()}>
      <HomeProjectNavButton
        type="button"
        data-component="home-recently-closed-row"
        class="disabled:opacity-60"
        disabled={unreachable()}
        onClick={() => props.onAddProjects(props.server, [props.project.worktree])}
      >
        <HomeProjectAvatar project={props.project} outline />
        <span class={HOME_PROJECT_NAV_LABEL}>{displayName(props.project)}</span>
      </HomeProjectNavButton>
    </Tooltip>
  )
}
