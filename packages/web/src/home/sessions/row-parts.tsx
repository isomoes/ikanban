import { Show } from "solid-js"
import { SessionTabAvatarView } from "@/shell/layout/session-tab-avatar"
import { HomeSessionStatusController, type HomeSessionRecord } from "./controller"
import type { HomeSessionsViewProps } from "./view-types"

export function HomeSessionLeadingController(props: {
  server: HomeSessionsViewProps["server"]
  isOpenTab: HomeSessionsViewProps["isOpenTab"]
  record: HomeSessionRecord
}) {
  return (
    <HomeSessionStatusController
      server={props.server}
      record={props.record}
      isOpenTab={props.isOpenTab}
      render={(state) => (
        <HomeSessionLeading
          record={props.record}
          open={state.open()}
          unread={state.unread()}
          loading={state.loading()}
        />
      )}
    />
  )
}

function HomeSessionLeading(props: { record: HomeSessionRecord; open: boolean; unread: boolean; loading: boolean }) {
  return (
    <div class="relative shrink-0">
      <Show when={props.open}>
        <span
          aria-hidden="true"
          class={`
            pointer-events-none absolute top-1/2 h-3 w-0.5 -translate-y-1/2
            rounded-[2px] bg-v2-background-bg-layer-04
          `}
          style={{ right: "calc(100% + 4px)" }}
        />
      </Show>
      <SessionTabAvatarView
        project={props.record.project}
        directory={props.record.session.location.directory}
        unread={props.unread}
        loading={props.loading}
      />
    </div>
  )
}

export function HomeSessionTitle(props: { title: string; showProjectName: boolean; search?: boolean }) {
  return (
    <span
      data-component="home-session-title"
      dir="auto"
      class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-v2-text-text-base [font-weight:530]"
      classList={{
        "text-[13px] leading-4 tracking-[-0.04px]": !!props.search,
        "max-w-[min(70%,480px)] flex-[0_1_auto]": props.showProjectName,
        "flex-[1_1_auto]": !props.showProjectName,
      }}
    >
      {props.title}
    </span>
  )
}

export function HomeSessionProjectName(props: { name: string; search?: boolean }) {
  return (
    <span
      data-component="home-session-project-name"
      dir="auto"
      class="min-w-0 flex-[1_1_auto] overflow-hidden text-ellipsis whitespace-nowrap text-v2-text-text-muted [font-weight:440]"
      classList={{ "text-[13px] leading-4 tracking-[-0.04px]": !!props.search }}
    >
      {props.name}
    </span>
  )
}
