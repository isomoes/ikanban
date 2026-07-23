import { Component, For, Show } from "solid-js"
import { FileIcon } from "@/ui/components/file-icon"
import { IconButton } from "@/ui/components/icon-button"
import { Tooltip } from "@/ui/components/tooltip"
import { getDirectory, getFilename, getFilenameTruncated } from "@/utils/path"
import type { ContextItem } from "@/context/prompt"

type PromptContextItem = ContextItem & { key: string }

type ContextItemsProps = {
  items: PromptContextItem[]
  active: (item: PromptContextItem) => boolean
  openComment: (item: PromptContextItem) => void
  remove: (item: PromptContextItem) => void
  t: (key: string) => string
}

export const PromptContextItems: Component<ContextItemsProps> = (props) => {
  return (
    <Show when={props.items.length > 0}>
      <div class="flex flex-nowrap items-start gap-2 p-2 overflow-x-auto no-scrollbar">
        <For each={props.items}>
          {(item) => {
            const directory = getDirectory(item.path)
            const filename = getFilename(item.path)
            const label = getFilenameTruncated(item.path, 14)
            const selected = () => props.active(item)

            return (
              <Tooltip
                value={
                  <span class="flex max-w-[300px]">
                    <span class="text-text-invert-base truncate-start [unicode-bidi:plaintext] min-w-0">
                      {directory}
                    </span>
                    <span class="shrink-0">{filename}</span>
                  </span>
                }
                placement="top"
                openDelay={2000}
              >
                <div
                  classList={{
                    "group relative shrink-0 flex max-w-[200px] h-12 rounded-[6px] cursor-default transition-all shadow-xs-border hover:shadow-xs-border-hover": true,
                    "hover:bg-surface-interactive-weak": !!item.commentID && !selected(),
                    "bg-surface-interactive-hover hover:bg-surface-interactive-hover shadow-xs-border-hover": selected(),
                    "bg-background-stronger": !selected(),
                  }}
                >
                  <button
                    type="button"
                    data-action="prompt-context-open"
                    class="flex min-w-0 flex-1 flex-col py-1 pl-2 pr-6 text-left"
                    onClick={() => props.openComment(item)}
                  >
                    <div class="flex items-center gap-1.5">
                      <FileIcon node={{ path: item.path, type: "file" }} class="shrink-0 size-3.5" />
                      <div class="flex items-center text-11-regular min-w-0 font-medium">
                        <span class="text-text-strong whitespace-nowrap">{label}</span>
                        <Show when={item.selection}>
                          {(sel) => (
                            <span class="text-text-weak whitespace-nowrap shrink-0">
                              {sel().startLine === sel().endLine
                                ? `:${sel().startLine}`
                                : `:${sel().startLine}-${sel().endLine}`}
                            </span>
                          )}
                        </Show>
                      </div>
                    </div>
                    <Show when={item.comment}>
                      {(comment) => <span class="text-12-regular text-text-strong ml-5 pr-1 truncate">{comment()}</span>}
                    </Show>
                  </button>
                  <IconButton
                    type="button"
                    icon="close-small"
                    variant="ghost"
                    class="absolute right-1 top-1 size-4 text-text-weak hover:text-text-strong"
                    onClick={() => props.remove(item)}
                    aria-label={props.t("prompt.context.removeFile")}
                  />
                </div>
              </Tooltip>
            )
          }}
        </For>
      </div>
    </Show>
  )
}
