import { createEffect, createSignal, For, onCleanup, Show } from "solid-js"
import { Menu } from "@ikanban/ui/menu"
import { Icon } from "@ikanban/ui/icon"
import { createMenuDismissController } from "@/shell/commands/menu-dismiss"
import {
  createPromptProjectController,
  type PromptProject,
  type PromptProjectControls,
  type PromptProjectController,
} from "./prompt-controller"
import { ProjectAction, ProjectItem, ProjectTrigger, ServerAction, projectActionClass } from "./items"

export { createPromptProjectController }
export type { PromptProject, PromptProjectControls, PromptProjectController }
export { PromptProjectAddButton } from "./items"

export function PromptProjectSelector(props: {
  controller: PromptProjectController
  placement?: "top" | "bottom" | "bottom-start"
}) {
  const [triggerReady, setTriggerReady] = createSignal(false)
  let contentRef: HTMLDivElement | undefined
  const dismiss = createMenuDismissController(() => contentRef)
  let triggerFrame: number | undefined

  // Floating UI requires a connected anchor; route transitions can construct this trigger before adoption.
  const setTriggerRef = (element: HTMLButtonElement) => {
    const ready = () => {
      if (!element.isConnected) {
        triggerFrame = requestAnimationFrame(ready)
        return
      }
      triggerFrame = undefined
      setTriggerReady(true)
    }
    ready()
  }

  onCleanup(() => {
    if (triggerFrame !== undefined) cancelAnimationFrame(triggerFrame)
  })

  const activeItem = () =>
    props.controller.active()
      ? contentRef?.querySelector<HTMLElement>(`[data-option-key="${CSS.escape(props.controller.active())}"]`)
      : undefined
  const selectProject = (project: PromptProject) => {
    dismiss.preventTriggerRestore()
    props.controller.setOpen(false)
    dismiss.afterClose(() => props.controller.select(project))
  }
  const selectAction = (server?: string) => {
    dismiss.preventTriggerRestore()
    props.controller.setOpen(false)
    dismiss.afterClose(() => props.controller.add(server))
  }
  const selectActive = () => {
    const project = props.controller.activeProject()
    if (project) {
      selectProject(project)
      return
    }
    if (props.controller.activeAction() && props.controller.servers().length > 1) {
      const item = activeItem()
      item?.focus()
      item?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
      return
    }
    selectAction(props.controller.activeServer())
  }
  const moveActive = (delta: number) => {
    props.controller.moveActive(delta)
    queueMicrotask(() => activeItem()?.scrollIntoView({ block: "nearest" }))
  }
  const focusPreviousControl = () => {
    const target = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    )
      .filter((element) => !contentRef?.contains(element) && !element.hasAttribute("data-focus-trap"))
      .findLast((element) => element.offsetParent !== null)
    dismiss.preventTriggerRestore()
    target?.focus()
    queueMicrotask(() => {
      if (props.controller.open()) props.controller.setOpen(false)
    })
  }
  const selectedValue = () => {
    const project = props.controller.selected()
    return project ? props.controller.projectKey(project) : undefined
  }

  createEffect(() => {
    if (!props.controller.open()) return
    const handler = (event: KeyboardEvent) => props.controller.handleSearchKeydown(event)
    document.addEventListener("keydown", handler, true)
    onCleanup(() => document.removeEventListener("keydown", handler, true))
  })

  return (
    <Menu
      open={triggerReady() && props.controller.open()}
      placement={props.placement ?? "bottom"}
      gutter={4}
      modal={false}
      onOpenChange={(open) => {
        if (open) dismiss.allowTriggerRestore()
        props.controller.setOpen(open)
      }}
    >
      <Menu.Trigger as={ProjectTrigger} ref={setTriggerRef} controller={props.controller} />
      <Menu.Portal>
        <Menu.Content
          ref={contentRef}
          id="prompt-project-menu"
          class="w-[243px] overflow-hidden rounded-md border-0 bg-v2-background-bg-layer-01 shadow-[var(--v2-elevation-floating)] focus:outline-none [&[data-closed]]:!animate-none"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onPointerDownOutside={dismiss.preventTriggerRestore}
          onFocusOutside={dismiss.preventTriggerRestore}
          onCloseAutoFocus={dismiss.onCloseAutoFocus}
        >
          <div class="flex flex-col">
            <div class="flex h-7 items-center gap-2 rounded-sm pl-3 pr-2.5 text-v2-icon-icon-muted">
              <Icon name="magnifying-glass" size="small" class="shrink-0" />
              <input
                ref={(el) => props.controller.setSearchRef(el)}
                value={props.controller.search()}
                placeholder={props.controller.labels.search()}
                aria-autocomplete="list"
                aria-controls="prompt-project-menu"
                aria-activedescendant={props.controller.active() || undefined}
                class="h-7 min-w-0 flex-1 border-0 bg-transparent text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-base outline-none placeholder:text-v2-text-text-faint"
                onInput={(event) => props.controller.setSearch(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Tab") {
                    event.preventDefault()
                    event.stopPropagation()
                    if (event.shiftKey) {
                      focusPreviousControl()
                      return
                    }
                    activeItem()?.focus()
                    return
                  }
                  event.stopPropagation()
                  if (event.key === "Escape") {
                    event.preventDefault()
                    props.controller.setOpen(false)
                    return
                  }
                  if (event.altKey || event.metaKey) return
                  if (event.key === "ArrowDown") {
                    event.preventDefault()
                    moveActive(1)
                    return
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault()
                    moveActive(-1)
                    return
                  }
                  if (event.key === "Enter" && !event.isComposing) {
                    event.preventDefault()
                    selectActive()
                  }
                }}
              />
              <Show when={props.controller.search().trim()}>
                <button
                  type="button"
                  class="flex size-5 items-center justify-center rounded-sm text-v2-icon-icon-muted hover:bg-v2-overlay-simple-overlay-hover"
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => props.controller.clearSearch()}
                  aria-label={props.controller.labels.clear()}
                >
                  <Icon name="close-small" size="small" />
                </button>
              </Show>
            </div>
            <div class="max-h-[224px] overflow-y-auto">
              <Show
                when={props.controller.servers().length > 1}
                fallback={
                  <Menu.RadioGroup value={selectedValue()}>
                    <For each={props.controller.projects()}>
                      {(project) => (
                        <ProjectItem project={project} controller={props.controller} onSelect={selectProject} />
                      )}
                    </For>
                  </Menu.RadioGroup>
                }
              >
                <For
                  each={props.controller
                    .servers()
                    .filter((server) =>
                      props.controller.projects().some((project) => project.server?.key === server!.key),
                    )}
                >
                  {(server) => (
                    <div>
                      <div class="flex h-7 select-none items-center pl-1.5 pr-3 text-[11px] font-[530] leading-none tracking-[0.05px] text-v2-text-text-faint">
                        {server!.name}
                      </div>
                      <Menu.RadioGroup value={selectedValue()}>
                        <For
                          each={props.controller.projects().filter((project) => project.server?.key === server!.key)}
                        >
                          {(project) => (
                            <ProjectItem project={project} controller={props.controller} onSelect={selectProject} />
                          )}
                        </For>
                      </Menu.RadioGroup>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </div>
          <div class="h-px bg-v2-border-border-muted" />
          <div class="flex flex-col">
            <Show
              when={props.controller.servers().length > 1}
              fallback={
                <ProjectAction
                  server={props.controller.servers()[0]?.key}
                  controller={props.controller}
                  onSelect={selectAction}
                />
              }
            >
              <Menu.Sub>
                <Menu.SubTrigger
                  id={props.controller.actionKey()}
                  data-option-key={props.controller.actionKey()}
                  class={projectActionClass}
                  classList={{
                    "!bg-v2-overlay-simple-overlay-hover": props.controller.active() === props.controller.actionKey(),
                  }}
                  onMouseEnter={() => props.controller.setActive(props.controller.actionKey())}
                >
                  <Icon name="plus" size="small" />
                  <span class="min-w-0 flex-1 truncate leading-5">{props.controller.labels.add()}</span>
                </Menu.SubTrigger>
                <Menu.Portal>
                  <Menu.SubContent class="max-h-[224px] min-w-[180px] overflow-y-auto rounded-md border-0 bg-v2-background-bg-layer-01 shadow-[var(--v2-elevation-floating)] focus:outline-none">
                    <For each={props.controller.servers()}>
                      {(server) => <ServerAction server={server!} onSelect={selectAction} />}
                    </For>
                  </Menu.SubContent>
                </Menu.Portal>
              </Menu.Sub>
            </Show>
          </div>
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  )
}
