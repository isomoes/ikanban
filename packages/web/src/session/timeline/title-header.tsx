import { Show, Suspense, createEffect, createMemo, createSignal, lazy, type Accessor, type ComponentProps, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { Icon } from "@ikanban/ui/icon"
import { IconButton } from "@ikanban/ui/icon-button"
import { InlineInput } from "@ikanban/ui/inline-input"
import { Menu } from "@ikanban/ui/menu"
import { useLanguage } from "@/runtime/i18n/language"
import { useServer } from "@/runtime/server/current"
import { useWorkspaceLocation } from "@/workspaces/location"
import { SessionContextUsage } from "@/session/timeline/session-context-usage"
import { SessionHeaderSpacer } from "@/session/header/session-header"
import { SessionProjectMenu, SessionTitleHeader } from "../session-identity-header"
import { SummaryPopover } from "../summary/popover"
import type { Project } from "@/runtime/server/types"
import type { BackgroundTask } from "../summary/background"
import type { TimelineController } from "./controller"

const SessionSummaryPanel = lazy(async () => {
  const { SessionSummaryPanel } = await import("../summary/panel")
  return { default: SessionSummaryPanel }
})

export function TimelineHeader(props: {
  active?: boolean
  data: TimelineController["data"]
  action: TimelineController["action"]
  pending: TimelineController["pending"]
  project: Accessor<Project | undefined>
  avatarProject: Accessor<ComponentProps<typeof SessionProjectMenu>["project"]>
  sessionDirectory: Accessor<string>
  workspaceSession: Accessor<boolean>
  showProjectIcon: Accessor<boolean>
  projectAvatar: () => JSX.Element
  diffs: Accessor<{ additions: number; deletions: number }[] | undefined>
  tasks: Accessor<BackgroundTask[]>
  workspaceMoveEligible: boolean
  reserveReviewToggle: boolean
  search?: JSX.Element
  onSummaryOpenChange: (open: boolean) => void
  onReview: () => void
}) {
  const language = useLanguage()
  const server = useServer()
  const data = server.ctx.data
  const sdk = useWorkspaceLocation()
  const sessionID = props.data.sessionID
  const parentID = props.data.parentID
  const parentTitle = props.data.parentTitle
  const childTitle = props.data.childTitle
  const titleLabel = props.data.titleLabel
  const project = props.project
  const avatarProject = props.avatarProject
  const sessionDirectory = props.sessionDirectory
  const workspaceSession = props.workspaceSession
  const showProjectIcon = props.showProjectIcon
  const projectAvatar = props.projectAvatar
  const [workspaceSuggestionDismissed, setWorkspaceSuggestionDismissed] = createSignal(false)
  const [summaryOpen, setSummaryOpen] = createSignal(false)
  const setSummary = (open: boolean) => {
    setSummaryOpen(open)
    props.onSummaryOpenChange(open)
  }
  const sessionDiffs = createMemo(props.diffs)
  const [title, setTitle] = createStore({
    draft: "",
    editing: false,
    menuOpen: false,
    pendingRename: false,
  })
  let titleRef: HTMLInputElement | undefined

  const openTitleEditor = () => {
    if (!sessionID() || parentID()) return
    setTitle({ editing: true, draft: titleLabel() ?? "" })
    requestAnimationFrame(() => {
      if (!titleRef) return
      titleRef.focus()
      titleRef.select()
    })
  }

  const closeTitleEditor = () => {
    if (props.pending.rename()) return
    setTitle("editing", false)
  }

  const saveTitleEditor = async () => {
    if (!title.editing || props.pending.rename()) return
    if (await props.action.rename(title.draft)) setTitle("editing", false)
  }

  createEffect(() => {
    if (props.active !== false) return
    setSummary(false)
    setTitle({ draft: "", editing: false, menuOpen: false, pendingRename: false })
  })

  return (
    <SessionTitleHeader>
      <div class="h-12 w-full flex items-center justify-between gap-2">
        <div class="flex items-center gap-1 min-w-0 flex-1">
          <div class="flex items-center gap-0.5 min-w-0 flex-1 w-full">
            <SessionProjectMenu
              project={avatarProject()}
              directory={sessionDirectory()}
              workspace={workspaceSession()}
              showProjectIcon={showProjectIcon()}
            />
            <Show when={parentID()}>
              <button
                type="button"
                data-slot="session-title-parent"
                class="min-w-0 max-w-[40%] truncate pl-2 text-[13px] font-[530] leading-4 tracking-[-0.04px] text-v2-text-text-faint transition-colors hover:text-v2-text-text-muted"
                onClick={props.action.navigateParent}
              >
                {parentTitle()}
              </button>
              <span
                data-slot="session-title-separator"
                class="-translate-y-[0.5px] pl-2 pr-1 text-[11px] font-medium text-v2-text-text-faint"
                aria-hidden="true"
              >
                /
              </span>
            </Show>
            <Show when={childTitle() || title.editing}>
              <Show
                when={title.editing}
                fallback={
                  <h1
                    data-slot="session-title-child"
                    class="truncate text-[13px] font-[530] leading-4 tracking-[-0.04px] text-v2-text-text-base w-fit rounded-[6px] px-1 py-1 hover:bg-v2-overlay-simple-overlay-hover"
                    onClick={openTitleEditor}
                  >
                    {childTitle()}
                  </h1>
                }
              >
                <InlineInput
                  ref={(el) => {
                    titleRef = el
                  }}
                  data-slot="session-title-child"
                  dir="auto"
                  value={title.draft}
                  disabled={props.pending.rename()}
                  class="block text-[13px] font-[530] leading-4 tracking-[-0.04px] text-v2-text-text-base field-sizing-content rounded-[6px] px-1 py-1"
                  style={{
                    "--inline-input-shadow": "none",
                    "text-align": "start",
                  }}
                  onInput={(event) => setTitle("draft", event.currentTarget.value)}
                  onKeyDown={(event) => {
                    event.stopPropagation()
                    if (event.isComposing || event.keyCode === 229) return
                    if (event.key === "Enter") {
                      event.preventDefault()
                      void saveTitleEditor()
                      return
                    }
                    if (event.key === "Escape") {
                      event.preventDefault()
                      closeTitleEditor()
                    }
                  }}
                  onBlur={() => void saveTitleEditor()}
                />
              </Show>
            </Show>
            <Show when={!parentID() && sessionID()} keyed>
              {(id) => (
                <Menu
                  gutter={6}
                  placement="bottom-start"
                  open={title.menuOpen}
                  onOpenChange={(open) => setTitle("menuOpen", open)}
                >
                  <Menu.Trigger
                    as={IconButton}
                    icon={<Icon name="outline-dots" />}
                    variant="ghost-muted"
                    size="large"
                    class="shrink-0"
                    aria-label={language.t("common.moreOptions")}
                    aria-expanded={title.menuOpen}
                  />
                  <Menu.Portal>
                    <Menu.Content
                      class="session-options-menu w-max"
                      style={{ "min-width": "0" }}
                      onCloseAutoFocus={(event) => {
                        if (!title.pendingRename) return
                        event.preventDefault()
                        setTitle("pendingRename", false)
                        openTitleEditor()
                      }}
                    >
                      <Show when={!parentID()}>
                        <Menu.Item
                          onSelect={() => {
                            setTitle("pendingRename", true)
                            setTitle("menuOpen", false)
                          }}
                        >
                          {language.t("common.rename")}
                        </Menu.Item>
                        <Menu.Item onSelect={() => void props.action.export(id)}>
                          {language.t("common.export")}…
                        </Menu.Item>
                      </Show>
                      <Show when={!parentID()}>
                        {/* TODO: Need a session archive API. */}
                        <Menu.Separator />
                        <Menu.Item onSelect={() => props.action.showDelete(id)}>
                          {language.t("common.delete")}…
                        </Menu.Item>
                      </Show>
                    </Menu.Content>
                  </Menu.Portal>
                </Menu>
              )}
            </Show>
          </div>
        </div>
        <Show when={sessionID()} keyed>
          {(id) => (
            <div class="shrink-0 flex items-center gap-2">
              {props.search}
              <SessionContextUsage placement="bottom" />
              <Show when={!parentID() && project()}>
                {(project) => (
                  <SummaryPopover active={props.active} open={summaryOpen()} onOpenChange={setSummary}>
                    <Suspense>
                      <SessionSummaryPanel
                        shown={summaryOpen()}
                        project={project()}
                        avatar={showProjectIcon() ? projectAvatar() : undefined}
                        directory={sessionDirectory()}
                        local={!workspaceSession()}
                        branch={data.location.vcs.info({ directory: sdk().directory })?.branch.current}
                        baseBranch={data.location.vcs.info({ directory: project().worktree })?.branch.current}
                        diffs={sessionDiffs()}
                        sessionID={id}
                        moveEligible={props.workspaceMoveEligible}
                        moveDismissed={workspaceSuggestionDismissed()}
                        onMoveDismiss={() => setWorkspaceSuggestionDismissed(true)}
                        onReview={() => {
                          setSummary(false)
                          props.onReview()
                        }}
                        backgroundTasks={props.tasks()}
                      />
                    </Suspense>
                  </SummaryPopover>
                )}
              </Show>
              <SessionHeaderSpacer visible={props.reserveReviewToggle} />
            </div>
          )}
        </Show>
      </div>
    </SessionTitleHeader>
  )
}
