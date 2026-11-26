import { createQuery, useQueryClient } from "@tanstack/solid-query"
import { Dialog, DialogBody, DialogHeader, DialogTitleGroup } from "@ikanban/ui/dialog"
import { Button } from "@ikanban/ui/button"
import { Icon } from "@ikanban/ui/icon"
import { IconButton } from "@ikanban/ui/icon-button"
import { FileIcon } from "@ikanban/ui/file-icon"
import { Tooltip } from "@ikanban/ui/tooltip"
import { useDialog } from "@ikanban/ui/context/dialog"
import { For, Show, createEffect, onCleanup } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import type { ServerSDK } from "@/runtime/server/client"
import { formatServerError } from "@/runtime/server/errors"
import { externalArtifactURL, publishedArtifactLink } from "./artifact-link"
import { artifactExtension } from "@/workspaces/files/artifact"

export function artifactQueryKey(sdk: ServerSDK, directory: string) {
  return [sdk.scope, "artifacts", directory] as const
}

export function SessionOutputsButton(props: {
  sdk: ServerSDK
  directory: string
  sessionID: string
  active: boolean
  onOpen: (artifact: { id: string; file?: string }) => void
}) {
  const language = useLanguage()
  const dialog = useDialog()
  const cache = useQueryClient()
  const key = () => artifactQueryKey(props.sdk, props.directory)
  const list = createQuery(() => ({
    queryKey: [...key(), "list", props.sessionID],
    enabled: props.active,
    queryFn: ({ signal }) => props.sdk.api.experimental.artifacts.list({
      location: { directory: props.directory },
      sessionID: props.sessionID,
    }, { signal }).then((v) => v.data),
    retry: false,
  }))
  createEffect(() => {
    if (!props.active) return
    const listKey = [...key(), "list", props.sessionID]
    const invalidate = () => void cache.invalidateQueries({ queryKey: listKey })
    onCleanup(props.sdk.event.location(props.directory).on("artifact.updated", invalidate))
    onCleanup(props.sdk.event.on("server.connected", invalidate))
  })
  const label = () => list.data ? `${language.t("session.artifacts.title")} (${list.data.length})` : language.t("session.artifacts.title")
  const openItem = (item: { id: string; url: string }) => props.onOpen({
    id: item.id,
    file: publishedArtifactLink(item.url, props.sdk.url)?.file,
  })
  let disposed = false
  let opening = false
  onCleanup(() => { disposed = true })
  const open = async () => {
    if (opening) return
    opening = true
    try {
      const items = list.data ?? (await list.refetch()).data
      if (disposed || !props.active) return
      if (items?.length === 1) return openItem(items[0]!)
      dialog.show(picker)
    } finally {
      opening = false
    }
  }

  const picker = () => (
    <Dialog>
      <DialogHeader>
        <DialogTitleGroup title={language.t("session.artifacts.title")} description={language.t("session.artifacts.description")} />
      </DialogHeader>
      <DialogBody>
        <div class="flex max-h-[70vh] flex-col gap-1 overflow-auto px-4 pb-4 text-13-regular">
          <Show when={list.isPending}>{language.t("common.loading")}</Show>
          <Show when={list.isError}>
            <div role="alert">{formatServerError(list.error, language.t, language.t("error.chain.unknown"))}</div>
            <Button onClick={() => void list.refetch()}>{language.t("session.summary.retry")}</Button>
          </Show>
          <Show when={list.isSuccess && !list.data?.length}>{language.t("session.artifacts.empty")}</Show>
          <For each={list.data}>{(item) => (
            <div class="flex min-w-0 items-center rounded-md hover:bg-v2-overlay-simple-overlay-hover">
              <button type="button" class="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 text-start" onClick={() => {
                dialog.close()
                openItem(item)
              }}>
                <FileIcon node={{ path: item.entry, type: "file" }} class="size-5 shrink-0" />
                <span class="flex min-w-0 flex-col">
                  <span class="truncate text-13-medium">{item.title || item.entry}</span>
                  <span class="truncate text-12-regular text-text-weak">
                    {item.entry}{artifactExtension(item.entry) && ` · ${artifactExtension(item.entry).toUpperCase()}`}
                  </span>
                </span>
              </button>
              <Show when={!publishedArtifactLink(item.url, props.sdk.url) && externalArtifactURL(item.url)}>
                {(url) => <PublishedWebsiteLink url={url()} />}
              </Show>
            </div>
          )}</For>
        </div>
      </DialogBody>
    </Dialog>
  )
  return (
    <Tooltip placement="bottom" value={label()}>
      <IconButton size="small" variant="ghost-muted" icon={<Icon name="folder" />} aria-label={label()} onClick={open} />
    </Tooltip>
  )
}

export function PublishedWebsiteLink(props: { url: string }) {
  const language = useLanguage()
  return (
    <a href={props.url} target="_blank" rel="noopener noreferrer" title={language.t("session.artifacts.open")}
      aria-label={language.t("session.artifacts.open")} class="mx-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-text-weak hover:text-text-strong">
      <Icon name="arrow-up-right" size="small" />
    </a>
  )
}
