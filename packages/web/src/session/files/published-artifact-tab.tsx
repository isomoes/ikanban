import { createQuery } from "@tanstack/solid-query"
import { createMemo, createSignal, onCleanup, Show } from "solid-js"
import { Select } from "@ikanban/ui/select"
import { getFilename } from "@opencode/util/path"
import { useLanguage } from "@/runtime/i18n/language"
import { useServerSDK } from "@/runtime/server/client"
import { formatServerError } from "@/runtime/server/errors"
import { useWorkspaceLocation } from "@/workspaces/location"
import { artifactKind, artifactMime } from "@/workspaces/files/artifact"
import { artifactQueryKey, PublishedWebsiteLink } from "../artifacts"
import { externalArtifactURL, publishedArtifactLink } from "../artifact-link"
import { ArtifactView } from "./artifact-view"
import { PublishedHTMLPreview } from "./published-html-preview"

type Artifact = { id: string; file?: string }

function usePublishedArtifact(artifact: () => Artifact, enabled = true) {
  const sdk = useServerSDK()
  const location = useWorkspaceLocation()
  return createQuery(() => {
    const directory = location().directory
    const artifactID = artifact().id
    return {
      queryKey: [...artifactQueryKey(sdk, directory), "get", artifactID],
      queryFn: ({ signal }) => sdk.api.experimental.artifacts.get({ location: { directory }, artifactID }, { signal })
        .then((value) => value.data),
      enabled,
      retry: false,
    }
  })
}

export function PublishedArtifactTabLabel(props: { artifact: Artifact }) {
  const language = useLanguage()
  const query = usePublishedArtifact(() => props.artifact, false)
  return (
    <span class="truncate">
      {query.data?.info.title || (props.artifact.file && getFilename(props.artifact.file)) || language.t("session.artifacts.title")}
    </span>
  )
}

export function PublishedArtifactTab(props: { artifact: Artifact }) {
  const language = useLanguage()
  const sdk = useServerSDK()
  const location = useWorkspaceLocation()
  const query = usePublishedArtifact(() => props.artifact)
  const [selected, setSelected] = createSignal(props.artifact.file)
  const [linkedText, setLinkedText] = createSignal<string>()
  const bundleFiles = createMemo(() => Object.keys(query.data?.files ?? {}))
  const files = createMemo(() => bundleFiles().filter((name) => artifactKind(name) !== "text" || name === linkedText()))
  const openFile = (name: string) => {
    setLinkedText(artifactKind(name) === "text" ? name : undefined)
    setSelected(name)
  }
  const filename = createMemo(() => {
    const file = selected()
    const entry = query.data?.info.entry
    return file && files().includes(file) ? file : entry && files().includes(entry) ? entry : files()[0] ?? entry
  })
  const website = createMemo(() => {
    const url = query.data?.info.url
    return url && !publishedArtifactLink(url, sdk.url) && externalArtifactURL(url)
  })
  const content = createMemo(() => {
    const name = filename()
    const files = query.data?.files
    if (!name || !files || !Object.hasOwn(files, name)) return
    const mime = artifactMime(name)
    return {
      path: name,
      type: "text" as const,
      content: files[name]!,
      mimeType: mime === "text/html" ? "text/html;charset=utf-8" : mime,
    }
  })
  onCleanup(sdk.event.location(location().directory).on("artifact.updated", () => void query.refetch()))

  return (
    <div data-slot="published-artifact-panel" class="flex h-full min-h-0 flex-col overflow-hidden">
      <Show when={query.isPending}><div class="px-6 py-4 text-text-weak">{language.t("common.loading")}</div></Show>
      <Show when={query.isError}>
        <div role="alert" class="px-6 py-4 text-text-weak">
          {formatServerError(query.error, language.t, language.t("error.chain.unknown"))}
        </div>
      </Show>
      <Show when={content()}>
        {(file) => (
          <>
            <Show when={files().length > 1 || website()}>
              <div class="flex shrink-0 items-center gap-2 border-b border-v2-border-border-base px-3 py-1">
                <Show when={files().length > 1}>
                <Select
                  options={files()}
                  current={filename()}
                  label={(name) => name}
                  aria-label={language.t("session.artifacts.files")}
                  placement="bottom-start"
                  onSelect={(name) => name && openFile(name)}
                />
                </Show>
                <Show when={website()}>{(url) => <div class="ms-auto"><PublishedWebsiteLink url={url()} /></div>}</Show>
              </div>
            </Show>
            <Show when={artifactKind(file().path) !== "text"} fallback={
              <Show when={file().path === linkedText()} fallback={
                <div class="px-6 py-4 text-text-weak">{language.t("session.artifacts.noPreview")}</div>
              }>
                <pre tabIndex={0} class="min-h-0 flex-1 select-text overflow-auto p-4 text-12-regular">{file().content}</pre>
              </Show>
            }>
              <Show when={artifactKind(file().path) === "html"} fallback={
                <ArtifactView path={file().path} content={file()} />
              }>
                <PublishedHTMLPreview filename={file().path} html={file().content} files={bundleFiles()} onFile={openFile} />
              </Show>
            </Show>
          </>
        )}
      </Show>
    </div>
  )
}
