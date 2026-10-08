import { Match, Show, Switch } from "solid-js"
import { Tabs } from "@ikanban/ui/tabs"
import { ResizeHandle } from "@ikanban/ui/resize-handle"
import FileTree from "@/session/files/file-tree"
import { useLanguage } from "@/runtime/i18n/language"
import { useLayout } from "@/shell/state/layout"
import type { Sizing } from "@/session/helpers"
import type { FileTreeKind } from "./side-panel-kinds"

export const FILE_TREE_WIDTH_MIN = 240

function EmptyMessage(props: { message: string }) {
  return (
    <div class="h-full flex flex-col">
      <div class="h-6 shrink-0" aria-hidden />
      <div class="flex-1 pb-64 flex items-center justify-center text-center">
        <div class="text-12-regular text-text-weak">{props.message}</div>
      </div>
    </div>
  )
}

export function SessionSideFileTree(props: {
  width: string
  fileTreeWidth: number
  reviewOpen: boolean
  tab: string
  onTabChange: (value: string) => void
  reviewCount: number
  hasReview: boolean
  diffsReady: boolean
  diffFiles: string[]
  kinds: Map<string, FileTreeKind>
  activeDiff?: string
  empty: boolean
  size: Sizing
  focusReviewDiff: (path: string) => void
  openFile: (path: string) => void
}) {
  const language = useLanguage()
  const layout = useLayout()

  return (
    <div
      id="file-tree-panel"
      class="relative min-w-0 h-full shrink-0 overflow-hidden"
      classList={{
        "transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] motion-reduce:transition-none":
          !props.size.active(),
      }}
      style={{ width: props.width }}
    >
      <div
        class="h-full flex flex-col overflow-hidden group/filetree"
        classList={{ "border-l border-border-weaker-base": props.reviewOpen }}
      >
        <Tabs
          variant="surface"
          value={props.tab}
          onChange={props.onTabChange}
          class="h-full"
          data-scope="filetree"
        >
          <Tabs.List>
            <Tabs.Trigger value="changes" class="flex-1" classes={{ button: "w-full" }}>
              {language.t("session.review.filesChanged", { count: props.reviewCount })}
            </Tabs.Trigger>
            <Tabs.Trigger value="all" class="flex-1" classes={{ button: "w-full" }}>
              {language.t("session.files.all")}
            </Tabs.Trigger>
          </Tabs.List>
          <Show when={props.tab === "changes"}>
            <Tabs.Content value="changes" class="bg-background-stronger px-3 py-0">
              <Switch>
                <Match when={props.hasReview || !props.diffsReady}>
                  <Show
                    when={props.diffsReady}
                    fallback={
                      <div class="px-2 py-2 text-12-regular text-text-weak">
                        {language.t("common.loading")}
                        {language.t("common.loading.ellipsis")}
                      </div>
                    }
                  >
                    <FileTree
                      path=""
                      class="pt-3"
                      allowed={props.diffFiles}
                      kinds={props.kinds}
                      draggable={false}
                      active={props.activeDiff}
                      onFileClick={(node) => props.focusReviewDiff(node.path)}
                    />
                  </Show>
                </Match>
              </Switch>
            </Tabs.Content>
          </Show>
          <Show when={props.tab === "all"}>
            <Tabs.Content value="all" class="bg-background-stronger px-3 py-0">
              <Switch>
                <Match when={props.empty}><EmptyMessage message={language.t("session.files.empty")} /></Match>
                <Match when={true}>
                  <FileTree
                    path=""
                    class="pt-3"
                    modified={props.diffFiles}
                    kinds={props.kinds}
                    onFileClick={(node) => props.openFile(node.path)}
                  />
                </Match>
              </Switch>
            </Tabs.Content>
          </Show>
        </Tabs>
      </div>
      <div onPointerDown={() => props.size.start()}>
        <ResizeHandle
          direction="horizontal"
          edge="start"
          size={props.fileTreeWidth}
          min={FILE_TREE_WIDTH_MIN}
          max={480}
          onResize={(width) => {
            props.size.touch()
            layout.fileTree.resize(width)
          }}
        />
      </div>
    </div>
  )
}
