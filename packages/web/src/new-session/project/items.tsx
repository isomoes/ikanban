import { Show, splitProps, type ComponentProps } from "solid-js"
import { Menu } from "@ikanban/ui/menu"
import { Icon } from "@ikanban/ui/icon"
import { ProjectAvatar } from "@ikanban/ui/project-avatar"
import { getProjectAvatarVariant } from "@/shell/state/layout"
import { displayName, getProjectAvatarSource } from "@/shell/layout/helpers"
import type { PromptProject, PromptProjectController } from "./prompt-controller"

export function PromptProjectAddButton(props: { controller: PromptProjectController }) {
  return (
    <button
      data-action="prompt-project"
      type="button"
      class="flex h-7 min-w-0 max-w-[160px] items-center gap-1.5 rounded-sm px-2 text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-faint transition-colors hover:bg-v2-overlay-simple-overlay-hover focus-visible:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none"
      onClick={() => props.controller.add()}
    >
      <Icon name="folder-add-left" size="small" class="shrink-0 text-v2-icon-icon-muted" />
      <span class="min-w-0 truncate leading-5">{props.controller.labels.new()}</span>
      <Icon name="chevron-down" size="small" class="shrink-0 text-v2-icon-icon-muted" />
    </button>
  )
}

export function ProjectTrigger(props: ComponentProps<"button"> & { controller: PromptProjectController }) {
  const [local, rest] = splitProps(props, ["controller", "class", "classList", "onClick", "onKeyDown"])
  const project = () => local.controller.selected()
  return (
    <button
      {...rest}
      data-action="prompt-project"
      type="button"
      class="flex h-7 min-w-0 max-w-[203px] items-center gap-1.5 rounded-sm px-1.5 transition-colors focus-visible:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none"
      classList={{
        ...local.classList,
        "hover:bg-v2-overlay-simple-overlay-hover": !local.controller.open(),
        "bg-v2-overlay-simple-overlay-pressed": local.controller.open(),
        "text-v2-text-text-muted": local.controller.open(),
      }}
      onClick={local.onClick ?? (() => local.controller.setOpen(true))}
      onKeyDown={(event) => {
        if (!local.controller.open() && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
        if (typeof local.onKeyDown === "function") local.onKeyDown(event)
      }}
    >
      <Show
        when={project()}
        fallback={<Icon name="folder-add-left" size="small" class="shrink-0 text-v2-icon-icon-muted" />}
      >
        {(item) => (
          <ProjectAvatar
            fallback={displayName(item())}
            src={getProjectAvatarSource(item().id, item().icon)}
            variant={getProjectAvatarVariant(item().icon?.color)}
          />
        )}
      </Show>
      <span class="min-w-0 truncate leading-5">
        {project() ? displayName(project()!) : local.controller.labels.new()}
      </span>
      <Icon name="chevron-down" size="small" class="shrink-0 text-v2-icon-icon-muted" />
    </button>
  )
}

export function ProjectItem(props: {
  project: PromptProject
  controller: PromptProjectController
  onSelect: (project: PromptProject) => void
}) {
  const key = () => props.controller.projectKey(props.project)
  return (
    <Menu.RadioItem
      id={key()}
      value={key()}
      data-option-key={key()}
      class="h-7 gap-2 rounded-sm px-3 text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-base [font-family:var(--v2-font-family-sans)] data-[highlighted]:!bg-v2-overlay-simple-overlay-hover"
      classList={{ "!bg-v2-overlay-simple-overlay-hover": props.controller.active() === key() }}
      closeOnSelect
      onMouseEnter={() => {
        props.controller.setActive(key())
        props.controller.focusSearch()
      }}
      onSelect={() => props.onSelect(props.project)}
    >
      <ProjectAvatar
        fallback={displayName(props.project)}
        src={getProjectAvatarSource(props.project.id, props.project.icon)}
        variant={getProjectAvatarVariant(props.project.icon?.color)}
      />
      <span class="min-w-0 truncate leading-5">{displayName(props.project)}</span>
    </Menu.RadioItem>
  )
}

export const projectActionClass =
  "h-7 gap-2 rounded-sm px-3 text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-base [font-family:var(--v2-font-family-sans)] data-[highlighted]:!bg-v2-overlay-simple-overlay-hover"

export function ProjectAction(props: {
  server?: string
  controller: PromptProjectController
  onSelect: (server?: string) => void
}) {
  const key = () => props.controller.actionKey(props.server)
  return (
    <Menu.Item
      id={key()}
      data-option-key={key()}
      class="h-7 gap-2 rounded-sm px-3 text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-base [font-family:var(--v2-font-family-sans)] data-[highlighted]:!bg-v2-overlay-simple-overlay-hover"
      classList={{ "!bg-v2-overlay-simple-overlay-hover": props.controller.active() === key() }}
      onMouseEnter={() => {
        props.controller.setActive(key())
        props.controller.focusSearch()
      }}
      onSelect={() => props.onSelect(props.server)}
    >
      <Icon name="plus" size="small" />
      <span class="min-w-0 truncate leading-5">{props.controller.labels.add()}</span>
    </Menu.Item>
  )
}

export function ServerAction(props: { server: { key: string; name: string }; onSelect: (server: string) => void }) {
  return (
    <Menu.Item class={projectActionClass} onSelect={() => props.onSelect(props.server.key)}>
      <span class="min-w-0 flex-1 truncate leading-5">{props.server.name}</span>
    </Menu.Item>
  )
}
