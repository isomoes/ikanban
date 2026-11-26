const artifactPath = /^\/api\/experimental\/artifacts\/(art_[a-zA-Z0-9]+)(?:\/view\/([^?#]*))?(?:[?#].*)?$/

export function publishedArtifactLink(value: string, server?: string) {
  try {
    if (!value.startsWith("/") && server) {
      const url = new URL(value)
      const base = new URL(server)
      const prefix = base.pathname.replace(/\/$/, "")
      if (url.origin !== base.origin || !url.pathname.startsWith(`${prefix}/`)) return
      value = url.pathname.slice(prefix.length)
    }
    const match = artifactPath.exec(value)
    const id = match?.[1]
    if (!id) return
    const file = match[2] ? decodeURIComponent(match[2]) : undefined
    return { id, file }
  } catch {
    return
  }
}

export function externalArtifactURL(value: string) {
  if (!URL.canParse(value)) return
  const url = new URL(value)
  if (url.protocol === "http:" || url.protocol === "https:") return url.href
}

const outputTabPrefix = "published-artifact:"

export function publishedArtifactTab(artifact: { id: string; file?: string }) {
  return `${outputTabPrefix}${artifact.id}/${encodeURIComponent(artifact.file ?? "")}`
}

export function publishedArtifactFromTab(tab: string | undefined) {
  if (!tab?.startsWith(outputTabPrefix)) return
  const match = /^(art_[a-zA-Z0-9]+)\/([^/]*)$/.exec(tab.slice(outputTabPrefix.length))
  if (!match?.[1]) return
  try {
    return { id: match[1], file: match[2] ? decodeURIComponent(match[2]) : undefined }
  } catch {
    return
  }
}
