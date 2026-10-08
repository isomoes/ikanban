import { For, Show, createResource } from "solid-js"
import { Icon } from "@ikanban/ui/icon"
import { resolveBlobUrl } from "@/runtime/persistence/drafts"
import { useI18n } from "@ikanban/ui/context/i18n"
import { Tooltip } from "@ikanban/ui/tooltip"
import { AttachmentCard } from "@ikanban/session-ui/attachment-card"
import { ProgressCircle } from "@ikanban/ui/progress-circle"
import { CommentCard } from "@ikanban/session-ui/comment-card"
import { typeLabel } from "@ikanban/session-ui/message-file"
import type { Upload } from "../attachments/uploads"
import type { ComposerAttachment, ComposerComment } from "../types"
import "../attachments/attachments.css"

export function ComposerAttachments(props: {
  attachments: ComposerAttachment[]
  uploads?: Upload[]
  comments?: ComposerComment[]
  activeCommentID?: string
  removeLabel: string
  onAttachmentClick?: (attachment: ComposerAttachment) => void
  onAttachmentRemove: (attachment: ComposerAttachment) => void
  onUploadCancel?: (upload: Upload) => void
  onCommentClick?: (comment: ComposerComment) => void
  onCommentRemove?: (comment: ComposerComment) => void
}) {
  const i18n = useI18n()
  const percent = (upload: Upload) => (upload.size === 0 ? 100 : Math.floor((upload.loaded / upload.size) * 100))
  return (
    <Show
      when={props.attachments.length > 0 || (props.uploads?.length ?? 0) > 0 || (props.comments?.length ?? 0) > 0}
    >
      <div data-component="composer-attachments" data-slot="composer-attachments" class="relative">
        <div
          data-slot="composer-attachments-scroll"
          class="flex flex-nowrap gap-2 overflow-x-auto no-scrollbar px-2 pt-2 pb-1"
        >
          <For each={props.comments ?? []}>
            {(comment) => (
              <div class="relative group shrink-0">
                <Tooltip
                  value={comment.comment}
                  placement="top"
                  openDelay={800}
                  contentClass="max-w-[300px] break-words"
                >
                  <CommentCard
                    comment={comment.comment ?? ""}
                    path={comment.path}
                    selection={comment.selection}
                    active={comment.key === props.activeCommentID}
                    onClick={() => props.onCommentClick?.(comment)}
                  />
                </Tooltip>
                <button
                  type="button"
                  onClick={() => props.onCommentRemove?.(comment)}
                  class="absolute -top-1 -end-1 size-4 rounded-full bg-v2-icon-icon-muted outline-solid outline-1 outline-v2-icon-icon-contrast flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={props.removeLabel}
                >
                  <Icon name="outline-xmark" class="text-v2-icon-icon-contrast" />
                </button>
              </div>
            )}
          </For>
          <For each={props.attachments}>
            {(attachment) => (
              <div class="relative group shrink-0">
                <Tooltip
                  value={attachment.type === "path" ? attachment.path : attachment.filename}
                  placement="top"
                  contentClass="break-all"
                >
                  <Show
                    when={attachment.type === "image" && attachment.mime.startsWith("image/") ? attachment : undefined}
                    fallback={
                      <AttachmentCard title={attachment.filename}>
                        {typeLabel(attachment.filename, attachment.mime, i18n.t("ui.common.file"))}
                      </AttachmentCard>
                    }
                  >
                    {(image) => {
                      // Restored drafts and history carry image ids only; bytes load when shown.
                      const [url] = createResource(() => image().blob, resolveBlobUrl)
                      return (
                        <>
                          <img
                            src={url() ?? ""}
                            alt={attachment.filename}
                            class="w-[58px] h-[46px] rounded-[6px] object-cover"
                            onClick={() => props.onAttachmentClick?.(attachment)}
                          />
                          <div class="absolute inset-0 rounded-[6px] shadow-[inset_0_0_0_0.5px_var(--v2-border-border-base)] pointer-events-none" />
                        </>
                      )
                    }}
                  </Show>
                </Tooltip>
                <button
                  type="button"
                  onClick={() => props.onAttachmentRemove(attachment)}
                  class="absolute -top-1 -end-1 size-4 rounded-full bg-v2-icon-icon-muted outline-solid outline-1 outline-v2-icon-icon-contrast flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={props.removeLabel}
                >
                  <Icon name="outline-xmark" class="text-v2-icon-icon-contrast" />
                </button>
              </div>
            )}
          </For>
          <For each={props.uploads ?? []}>
            {(upload) => (
              <div class="relative group shrink-0" data-slot="composer-upload">
                <Tooltip value={upload.filename} placement="top" contentClass="break-all">
                  <AttachmentCard title={upload.filename}>
                    <span class="inline-flex items-center gap-1">
                      <ProgressCircle percentage={percent(upload)} />
                      {i18n.t("ui.promptInput.uploading", { percent: percent(upload) })}
                    </span>
                  </AttachmentCard>
                </Tooltip>
                <button
                  type="button"
                  onClick={() => props.onUploadCancel?.(upload)}
                  class="absolute -top-1 -end-1 size-4 rounded-full bg-v2-icon-icon-muted outline-solid outline-1 outline-v2-icon-icon-contrast flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={i18n.t("ui.promptInput.cancelUpload")}
                >
                  <Icon name="outline-xmark" class="text-v2-icon-icon-contrast" />
                </button>
              </div>
            )}
          </For>
        </div>
        <div
          data-slot="composer-attachments-fade-left"
          class="pointer-events-none absolute inset-y-0 start-0 z-10 w-6 bg-[linear-gradient(to_right,var(--v2-background-bg-base),transparent)] rtl:bg-[linear-gradient(to_left,var(--v2-background-bg-base),transparent)]"
        />
        <div
          data-slot="composer-attachments-fade-right"
          class="pointer-events-none absolute inset-y-0 end-0 z-10 w-6 bg-[linear-gradient(to_left,var(--v2-background-bg-base),transparent)] rtl:bg-[linear-gradient(to_right,var(--v2-background-bg-base),transparent)]"
        />
      </div>
    </Show>
  )
}
