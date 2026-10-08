import { Show, createMemo, lazy } from "solid-js"
import { useServer } from "@/runtime/server/current"
import { projectForSession } from "@/shell/layout/helpers"
import type { SessionModel } from "@/session/model"
import type { BackgroundTask } from "./summary/background"
import type { SessionReviewModel } from "./review/model"
import { SessionMobileViewTabs } from "./review/view"

const SessionSummaryPanel = lazy(async () => {
  const { SessionSummaryPanel } = await import("./summary/panel")
  return { default: SessionSummaryPanel }
})

export function SessionMobileTabs(props: {
  session: SessionModel
  review: SessionReviewModel
  mobileView: Parameters<typeof SessionMobileViewTabs>[0]["current"]
  workspaceMoveEligible: () => boolean
  backgroundTasks: () => BackgroundTask[]
  moveDismissed: boolean
  onMoveDismiss: () => void
}) {
  const server = useServer()
  const detailsProject = createMemo(() => {
    const info = props.session.data.info()
    return info ? projectForSession(info, server.ctx.sync.data.project) : undefined
  })

  return (
    <Show when={props.session.identity.sessionKey()} keyed>
      {(_key) => (
        <SessionMobileViewTabs
          current={props.mobileView}
          onDetailsOpenChange={props.review.details.setOpen}
          details={
            !props.session.data.isChild() && detailsProject()
              ? (close) => (
                  <Show when={detailsProject()}>
                    {(project) => (
                      <SessionSummaryPanel
                        mobile
                        project={project()}
                        directory={props.session.workspace.directory()}
                        local={!props.session.workspace.current()}
                        branch={
                          props.session.shared.data.location.vcs.info({ directory: props.session.workspace.directory() })?.branch
                            .current
                        }
                        baseBranch={
                          props.session.shared.data.location.vcs.info({ directory: project().worktree })?.branch.current
                        }
                        diffs={project().vcs ? props.review.details.diffs() : []}
                        sessionID={props.session.identity.params.id ?? ""}
                        moveEligible={props.workspaceMoveEligible()}
                        moveDismissed={props.moveDismissed}
                        onMoveDismiss={() => props.onMoveDismiss()}
                        onReview={() => {
                          close()
                          props.review.mobile.setTab("changes")
                          props.session.layout.view().terminal.close()
                        }}
                        backgroundTasks={props.backgroundTasks()}
                      />
                    )}
                  </Show>
                )
              : undefined
          }
          onSelect={(view) => {
            if (view === "terminal") {
              props.session.layout.view().terminal.open()
              return
            }
            props.review.mobile.setTab(view)
            props.session.layout.view().terminal.close()
          }}
        />
      )}
    </Show>
  )
}
