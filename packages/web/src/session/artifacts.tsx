import { createQuery, useQueryClient } from "@tanstack/solid-query"
import { Dialog, DialogBody, DialogHeader, DialogTitleGroup } from "@ikanban/ui/dialog"
import { Button } from "@ikanban/ui/button"
import { For, Show, createEffect, createSignal, onCleanup } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import type { ServerSDK } from "@/runtime/server/client"
import { formatServerError } from "@/runtime/server/errors"

export function publishedArtifactURL(value: string, server: string, directory: string) {
  try {
    const base = server.replace(/\/?$/, "/")
    const local = value.startsWith("/api/experimental/artifacts/")
    const url = local ? new URL(value.slice(1), base) : new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return
    if (local) url.searchParams.set("location[directory]", directory)
    return url.href
  } catch {
    return
  }
}

export function SessionArtifacts(props: { sdk: ServerSDK; directory: string; sessionID: string }) {
  const language = useLanguage()
  const cache = useQueryClient()
  const key = () => [props.sdk.scope, "artifacts", props.directory, props.sessionID] as const
  const location = () => ({ directory: props.directory })
  const api = props.sdk.api.experimental.artifacts
  const list = createQuery(() => ({
    queryKey: key(),
    queryFn: ({ signal }) => api.list({ location: location(), sessionID: props.sessionID }, { signal }).then((v) => v.data),
    retry: false,
  }))
  createEffect(() => {
    const sdk = props.sdk
    const invalidate = () => void cache.invalidateQueries({ queryKey: key() })
    onCleanup(sdk.event.location(props.directory).on("artifact.updated", invalidate))
    onCleanup(sdk.event.on("server.connected", invalidate))
  })
  const [selected, select] = createSignal("")
  const [path, setPath] = createSignal("")
  const artifact = () => list.data?.find((item) => item.id === selected())
  const content = createQuery(() => ({
    queryKey: [...key(), selected()],
    enabled: !!artifact(),
    queryFn: ({ signal }) => api.get({ artifactID: selected(), location: location() }, { signal }).then((v) => v.data),
  }))
  const failure = (error: unknown) => formatServerError(error, language.t, language.t("error.chain.unknown"))
  return (
    <Dialog>
      <DialogHeader><DialogTitleGroup title={language.t("session.artifacts.title")} description={language.t("session.artifacts.description")} /></DialogHeader>
      <DialogBody>
        <div class="flex max-h-[70vh] flex-col gap-3 overflow-auto px-4 pb-4 text-13-regular">
          <Show when={list.isPending}>{language.t("common.loading")}</Show>
          <Show when={list.isError}>
            <div role="alert">{failure(list.error)}</div>
            <Button onClick={() => void list.refetch()}>{language.t("session.summary.retry")}</Button>
          </Show>
          <Show when={list.isSuccess && !list.data?.length}>{language.t("session.artifacts.empty")}</Show>
          <For each={list.data}>{(item) => (
            <div class="flex min-w-0 items-center justify-between gap-2">
              <Button variant="ghost" aria-pressed={selected() === item.id} onClick={() => { select(item.id); setPath(item.entry) }}>
                <span class="truncate">{item.title || item.entry}</span>
              </Button>
              <Show when={publishedArtifactURL(item.url, props.sdk.url, props.directory)}>
                {(url) => <a href={url()} target="_blank" rel="noopener noreferrer" class="shrink-0 underline">{language.t("session.artifacts.open")}</a>}
              </Show>
            </div>
          )}</For>
          <Show when={artifact()}>
            <Show when={content.isPending}>{language.t("common.loading")}</Show>
            <Show when={content.isError}><div role="alert">{failure(content.error)}</div></Show>
            <Show when={content.data}>{(data) => {
              const filename = () => Object.hasOwn(data().files, path()) ? path() : data().info.entry
              return <>
                <select aria-label={language.t("session.artifacts.files")} value={filename()} onChange={(e) => setPath(e.currentTarget.value)}>
                  <For each={Object.keys(data().files)}>{(name) => <option value={name}>{name}</option>}</For>
                </select>
                <pre class="overflow-auto whitespace-pre text-12-regular">{data().files[filename()]}</pre>
              </>
            }}</Show>
          </Show>
        </div>
      </DialogBody>
    </Dialog>
  )
}
