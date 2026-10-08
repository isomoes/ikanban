import { createMemo, onCleanup, Show } from "solid-js"
import type { SetStoreFunction } from "solid-js/store"
import { InlineInput } from "@ikanban/ui/inline-input"
import { Icon } from "@ikanban/ui/icon"
import { IconButton } from "@ikanban/ui/icon-button"
import { Menu } from "@ikanban/ui/menu"
import { Tooltip } from "@ikanban/ui/tooltip"
import { sessionLabel } from "@/session/title"
import type { HomeSessionRecord } from "./controller"
import { HomeSessionLeadingController, HomeSessionProjectName, HomeSessionTitle } from "./row-parts"
import { isBackgroundOpen, type HomeSessionRowUI, type HomeSessionsViewProps } from "./view-types"

const SHOW_HOME_SESSION_ARCHIVE = false
const HOME_SESSION_LONG_PRESS_MS = 500

export function HomeSessionRow(
  props: HomeSessionsViewProps & {
    record: HomeSessionRecord
    rowUI: HomeSessionRowUI
    setRowUI: SetStoreFunction<HomeSessionRowUI>
  },
) {
  const title = createMemo(() => sessionLabel(props.record.session))
  const showProjectName = () => props.showProjectName && props.record.projectName
  const sessionID = () => props.record.session.id
  const menu = () => (props.rowUI.menu?.id === sessionID() ? props.rowUI.menu : undefined)
  const editor = () => (props.rowUI.editor?.id === sessionID() ? props.rowUI.editor : undefined)
  let longPressTimer: ReturnType<typeof setTimeout> | undefined
  let longPressStart: { x: number; y: number } | undefined
  let suppressClick = false
  let menuInteractedOutside = false

  // Focus targets are looked up by session ID: session store updates recreate
  // row components, so instance refs can point at detached nodes by the time
  // deferred focus runs.
  const rowSelector = () => `[data-component="home-session-row-container"][data-session-id="${sessionID()}"]`
  const rowButton = () =>
    document.querySelector<HTMLButtonElement>(`${rowSelector()} [data-component="home-session-row"]`)
  const renameInput = () =>
    document.querySelector<HTMLInputElement>(`${rowSelector()} [data-component="home-session-rename"]`)

  const clearLongPress = () => {
    if (longPressTimer !== undefined) clearTimeout(longPressTimer)
    longPressTimer = undefined
    longPressStart = undefined
  }
  onCleanup(clearLongPress)

  const openMenu = (element: HTMLElement, clientX: number, clientY: number) => {
    const bounds = element.getBoundingClientRect()
    props.setRowUI("menu", { id: sessionID(), x: clientX - bounds.left, y: clientY - bounds.top })
  }

  const openEditor = () => {
    props.setRowUI("editor", { id: sessionID(), draft: title(), renaming: false })
    requestAnimationFrame(() => {
      const input = renameInput()
      input?.focus()
      input?.select()
    })
  }
  const closeEditor = () => {
    if (editor()?.renaming) return
    props.setRowUI("editor", (value) => (value?.id === sessionID() ? undefined : value))
  }
  const saveEditor = async () => {
    const current = editor()
    if (!current || current.renaming) return
    props.setRowUI("editor", { ...current, renaming: true })
    const saved = await props.onRenameSession(props.server, props.record.session, current.draft)
    // Disabling the input during the request drops focus to the body; restore
    // it unless the user focused another control while the rename was pending.
    const restore = document.activeElement === document.body || document.activeElement === renameInput()
    props.setRowUI("editor", (value) => {
      if (value?.id !== sessionID()) return value
      return saved ? undefined : { ...value, renaming: false }
    })
    if (!restore) return
    requestAnimationFrame(() => {
      if (saved) {
        rowButton()?.focus()
        return
      }
      renameInput()?.focus()
    })
  }

  return (
    <div
      data-component="home-session-row-container"
      data-project-name={!!showProjectName()}
      data-session-id={props.record.session.id}
      class="group/session relative flex h-10 min-w-0 items-center rounded-[6px] outline-none focus:outline-none focus-visible:outline-none"
      onContextMenu={(event) => {
        // While renaming, keep the native menu so paste and spelling work.
        if (editor()) return
        event.preventDefault()
        openMenu(event.currentTarget, event.clientX, event.clientY)
      }}
    >
      <Show
        when={!editor()}
        fallback={
          <div
            data-slot="home-session-editor"
            class="flex h-10 min-w-0 w-full flex-1 items-center gap-2 py-3 ps-1.5 pe-3 md:ps-3 md:pe-10"
          >
            <HomeSessionLeadingController server={props.server} isOpenTab={props.isOpenTab} record={props.record} />
            <div data-slot="home-session-labels" class="contents">
              <InlineInput
                data-component="home-session-rename"
                aria-label={props.language.t("common.rename")}
                dir="auto"
                value={editor()?.draft ?? ""}
                disabled={editor()?.renaming ?? false}
                class={`
                block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-v2-text-text-base
                [font-weight:530] field-sizing-content outline-none focus:outline-none focus-visible:outline-none
                ${showProjectName() ? "max-w-[min(70%,480px)] flex-[0_1_auto]" : "flex-[1_1_auto]"}
              `}
                style={{ "--inline-input-shadow": "none", "text-align": "start" }}
                onInput={(event) => {
                  const draft = event.currentTarget.value
                  props.setRowUI("editor", (value) => (value?.id === sessionID() ? { ...value, draft } : value))
                }}
                onKeyDown={(event) => {
                  event.stopPropagation()
                  // Enter and Escape during IME composition commit or cancel
                  // the composition, not the rename. Safari can report the
                  // composition-confirming keydown with isComposing false but
                  // keyCode 229.
                  if (event.isComposing || event.keyCode === 229) return
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void saveEditor()
                    return
                  }
                  if (event.key !== "Escape") return
                  event.preventDefault()
                  closeEditor()
                  requestAnimationFrame(() => rowButton()?.focus())
                }}
                onBlur={closeEditor}
              />
              <Show when={showProjectName()}>
                <HomeSessionProjectName name={props.record.projectName} />
              </Show>
            </div>
          </div>
        }
      >
        <button
          type="button"
          data-component="home-session-row"
          aria-haspopup="menu"
          aria-expanded={!!menu()}
          class={`
            flex h-10 min-w-0 w-full flex-1 shrink-0 cursor-default items-center gap-2 rounded-[6px] border-0
            bg-transparent py-3 ps-1.5 pe-3 md:ps-3 md:pe-10 text-start text-v2-text-text-muted [font-weight:530]
            transition-[background-color,color,box-shadow] duration-[120ms] ease-in-out
            hover:bg-v2-overlay-simple-overlay-hover focus-visible:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none
          `}
          onMouseDown={(event) => {
            if (event.button === 1) event.preventDefault()
          }}
          onPointerDown={(event) => {
            suppressClick = false
            if (event.pointerType !== "touch") return
            clearLongPress()
            const element = event.currentTarget
            const x = event.clientX
            const y = event.clientY
            longPressStart = { x, y }
            longPressTimer = setTimeout(() => {
              suppressClick = true
              clearLongPress()
              openMenu(element, x, y)
            }, HOME_SESSION_LONG_PRESS_MS)
          }}
          onPointerMove={(event) => {
            if (!longPressStart) return
            if (Math.abs(event.clientX - longPressStart.x) <= 8 && Math.abs(event.clientY - longPressStart.y) <= 8)
              return
            clearLongPress()
          }}
          onPointerUp={clearLongPress}
          onPointerCancel={() => {
            clearLongPress()
            suppressClick = false
          }}
          onKeyDown={(event) => {
            if (event.key !== "ContextMenu" && (event.key !== "F10" || !event.shiftKey)) return
            event.preventDefault()
            const bounds = event.currentTarget.getBoundingClientRect()
            openMenu(event.currentTarget, bounds.left + 12, bounds.bottom)
          }}
          onClick={(event) => {
            // The flag stays set until the long-press compatibility click
            // arrives, however delayed; keyboard activation (detail 0) is
            // never that click and passes through.
            if (suppressClick) {
              suppressClick = false
              if (event.detail !== 0) {
                event.preventDefault()
                return
              }
            }
            props.onOpenSession(props.record.session, { background: isBackgroundOpen(event) })
          }}
          onAuxClick={(event) => {
            if (!isBackgroundOpen(event)) return
            event.preventDefault()
            props.onOpenSession(props.record.session, { background: true })
          }}
        >
          <HomeSessionLeadingController server={props.server} isOpenTab={props.isOpenTab} record={props.record} />
          <div data-slot="home-session-labels" class="contents">
            <HomeSessionTitle title={title()} showProjectName={!!showProjectName()} />
            <Show when={showProjectName()}>
              <HomeSessionProjectName name={props.record.projectName} />
            </Show>
          </div>
        </button>
      </Show>
      <Menu
        modal={false}
        placement="bottom-start"
        gutter={2}
        open={!!menu()}
        onOpenChange={(open) => {
          if (open) return
          props.setRowUI("menu", (value) => (value?.id === sessionID() ? undefined : value))
        }}
      >
        <Menu.Trigger
          as="span"
          aria-hidden="true"
          tabIndex={-1}
          class="pointer-events-none absolute size-px"
          style={{ left: `${menu()?.x ?? 0}px`, top: `${menu()?.y ?? 0}px` }}
        />
        <Menu.Portal>
          <Menu.Content
            onInteractOutside={() => {
              menuInteractedOutside = true
            }}
            onCloseAutoFocus={(event) => {
              // The trigger is an invisible positioning span, so Kobalte's
              // default close focus restore has no useful target. Skip the
              // row focus when the rename editor owns focus or the user
              // dismissed the menu by interacting elsewhere.
              event.preventDefault()
              const outside = menuInteractedOutside
              menuInteractedOutside = false
              if (outside || editor()) return
              requestAnimationFrame(() => rowButton()?.focus())
            }}
          >
            <Menu.Item onSelect={openEditor}>{props.language.t("common.rename")}</Menu.Item>
            <Menu.Item onSelect={() => void props.onExportSession(props.server, props.record.session)}>
              {props.language.t("common.export")}…
            </Menu.Item>
            <Menu.Separator />
            <Menu.Item onSelect={() => props.onDeleteSession(props.server, props.record.session)}>
              {props.language.t("common.delete")}…
            </Menu.Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu>
      <Show when={SHOW_HOME_SESSION_ARCHIVE}>
        <div
          class={`
            hover-reveal absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1
            group-hover/session:opacity-100 focus-within:opacity-100
          `}
        >
          <Tooltip class="flex shrink-0 items-center" placement="bottom" value={props.language.t("common.archive")}>
            <IconButton
              data-action="home-session-archive"
              variant="ghost-muted"
              size="large"
              icon={<Icon name="archive" />}
              aria-label={props.language.t("common.archive")}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void props.onArchiveSession(props.record.session)
              }}
            />
          </Tooltip>
        </div>
      </Show>
    </div>
  )
}
