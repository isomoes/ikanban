import { Key } from "@solid-primitives/keyed"
import { For, Index, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Button } from "@ikanban/ui/button"
import type { useLanguage } from "@/runtime/i18n/language"
import { HomeSessionRow } from "./row"
import { HomeSessionSearch } from "./search-panel"
import type { HomeSessionRowUI, HomeSessionsViewProps } from "./view-types"
import "./view.css"

export type { HomeSessionsViewProps } from "./view-types"

const HOME_SECTION_LABEL = "text-v2-text-text-muted [font-weight:440]"

export function HomeSessionsView(props: HomeSessionsViewProps) {
  const [rowUI, setRowUI] = createStore<HomeSessionRowUI>({ menu: undefined, editor: undefined })
  return (
    <section
      ref={props.onSetHoverTarget}
      class="min-h-0 min-w-0 flex-1 flex flex-col"
      aria-label={props.language.t("sidebar.project.recentSessions")}
    >
      <div
        class="sticky top-0 z-30 shrink-0 bg-v2-background-bg-base pb-1 pt-6 md:pb-3 lg:pt-12"
        onWheel={props.onWheel}
      >
        <HomeSessionSearch {...props} />
        <Show when={props.groups.length > 0 && props.canCreateSession}>
          <div class="pointer-events-none absolute right-0 top-[68px] z-20 flex md:top-[84px] lg:top-[108px]">
            <Button
              data-action="home-new-session"
              variant="ghost-muted"
              size="normal"
              icon="edit"
              class="pointer-events-auto h-7 px-2 [font-weight:530]"
              onClick={props.onCreateSession}
            >
              {props.language.t("command.session.new")}
            </Button>
          </div>
        </Show>
      </div>
      <div class="pointer-events-none sticky top-[68px] z-40 h-0 -mr-3 md:top-[84px] lg:top-[108px]">
        <div
          ref={props.onSetThumbTrack}
          data-component="home-session-scroll-track"
          class="relative ml-auto h-[calc(100cqh-68px)] w-3 md:h-[calc(100cqh-84px)] lg:h-[calc(100cqh-108px)]"
        />
      </div>
      <div class="-mr-3 min-h-[calc(100cqh-64px)] md:min-h-[calc(100cqh-72px)] lg:min-h-[calc(100cqh-96px)]">
        <Show
          when={!props.loading}
          fallback={
            <div class="pt-1 md:pt-3">
              <HomeSessionSkeleton label={props.language.t("common.loading")} />
            </div>
          }
        >
          <Show
            when={props.groups.length > 0}
            fallback={
              <HomeSessionsEmpty
                onNewSession={props.canCreateSession ? props.onCreateSession : undefined}
                language={props.language}
              />
            }
          >
            <div ref={props.onSetContent} class="flex flex-col pt-1 pr-3 pb-16 md:pt-3">
              {/* Index keeps group subtrees mounted when the group arrays are
                  rebuilt, so store updates cannot recreate rows mid-gesture. */}
              <Index each={props.groups}>
                {(group, index) => (
                  <>
                    <HomeSessionGroupHeader
                      title={group().title}
                      titleOpacity={props.titleOpacity(group().id)}
                      onSetRef={(element) => props.onSetHeader(group().id, element)}
                      elevated={index === 0}
                    />
                    <div
                      class={`flex min-w-0 flex-col gap-px pt-2 md:pt-4 ${index === props.groups.length - 1 ? "" : "mb-6"}`}
                    >
                      {/* Rows key by session ID: session.sync replaces the
                          stored session object wholesale, so reference-keyed
                          rows would be disposed mid-interaction whenever a
                          sync response lands. */}
                      <Key each={group().sessions} by={(record) => record.session.id}>
                        {(record) => <HomeSessionRow {...props} record={record()} rowUI={rowUI} setRowUI={setRowUI} />}
                      </Key>
                    </div>
                  </>
                )}
              </Index>
            </div>
          </Show>
        </Show>
      </div>
    </section>
  )
}

function HomeSessionGroupHeader(props: {
  title: string
  titleOpacity: number
  onSetRef: (element: HTMLDivElement) => void
  elevated?: boolean
}) {
  return (
    <div
      ref={props.onSetRef}
      class={`
        pointer-events-none sticky top-[68px] flex h-7 min-w-0 items-center justify-between
        bg-v2-background-bg-base ps-1.5 md:ps-3 md:top-[84px] lg:top-[108px]
      `}
      classList={{ "home-session-group-header z-[5]": !!props.elevated, "z-10": !props.elevated }}
    >
      <div class={HOME_SECTION_LABEL} style={{ opacity: props.titleOpacity }}>
        {props.title}
      </div>
    </div>
  )
}

function HomeSessionsEmpty(props: { onNewSession?: () => void; language: ReturnType<typeof useLanguage> }) {
  return (
    <div class="flex min-h-full flex-col items-center gap-4 px-6 pt-[52px] text-center">
      <div
        class={`
          shrink-0 text-[13px] leading-text-compact tracking-[-0.04px]
          text-v2-text-text-base [font-weight:530]
        `}
      >
        {props.language.t("home.sessions.empty")}
      </div>
      <p
        class={`
          mb-1 text-center text-[13px] leading-5 tracking-[-0.04px]
          text-v2-text-text-muted [font-weight:440]
        `}
      >
        {props.language.t("home.sessions.empty.description")}
      </p>
      <Show when={props.onNewSession}>
        {(onNewSession) => (
          <Button data-action="home-new-session" variant="neutral" size="normal" icon="edit" onClick={onNewSession()}>
            {props.language.t("command.session.new")}
          </Button>
        )}
      </Show>
    </div>
  )
}

function HomeSessionSkeleton(props: { label: string }) {
  return (
    <div class="flex min-w-0 flex-col gap-4">
      <div class="flex h-7 min-w-0 items-center justify-between ps-1.5 pe-4 md:ps-4">
        <div class={HOME_SECTION_LABEL}>{props.label}</div>
      </div>
      <div class="flex min-w-0 flex-col gap-px" aria-hidden="true">
        <For each={[0, 1, 2, 3]}>{() => <div class="h-10 rounded-[6px] bg-v2-background-bg-deep opacity-70" />}</For>
      </div>
    </div>
  )
}
