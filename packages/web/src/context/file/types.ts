import type { DecodedFileContent as FileContent } from "@/types/app"
import type { FileDiffInfo } from "@opencode-ai/client"
import { parsePatch, type StructuredPatch } from "diff"

const BINARY_FILE_RE = /\.(?:png|jpe?g|gif|webp|bmp|ico|avif|mp3|wav|ogg|flac|mp4|mov|avi|mkv|webm|pdf|zip|gz|tar|7z|woff2?|ttf|eot|otf|exe|bin|so|dylib|dll|class|jar|wasm)$/i

const MIME_TYPES: Record<string, string> = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  ogg: "audio/ogg",
  pdf: "application/pdf",
  png: "image/png",
  svg: "image/svg+xml",
  wav: "audio/wav",
  webm: "video/webm",
  webp: "image/webp",
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ""
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

export function bytesToFileContent(bytes: Uint8Array, path: string): FileContent {
  const extension = path.split(".").pop()?.toLowerCase() ?? ""
  const mimeType = MIME_TYPES[extension] ?? "application/octet-stream"
  const binary = BINARY_FILE_RE.test(path) || bytes.includes(0)

  if (!binary) {
    try {
      return {
        type: "text",
        content: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        mimeType: extension === "svg" ? mimeType : undefined,
      }
    } catch {}
  }

  return {
    type: "binary",
    content: bytesToBase64(bytes),
    encoding: "base64",
    mimeType,
  }
}

/**
 * Canonical diff shape used throughout the app UI.
 *
 * OpenCode exposes patch-only diffs, while the app models diffs with explicit
 * `before`/`after` content keyed by `file`, so conversion happens at the API
 * boundary.
 */
export type FileDiff = {
  file: string
  before: string
  after: string
  additions: number
  deletions: number
  status?: "added" | "deleted" | "modified"
}

/**
 * Rebuild `before`/`after` texts directly from patch hunk lines. Works for
 * added, deleted, and modified files alike, as long as the patch carries the
 * full file as context (which both snapshot diffs and `vcs.diff` requested
 * with a large `context` do). Unlike `applyPatch("", …)`, this does not
 * require the patch context to match an empty source.
 */
export function patchToTexts(patch: StructuredPatch): { before: string; after: string } {
  let before = ""
  let after = ""
  let lastMarker = ""
  for (const hunk of patch.hunks) {
    for (const raw of hunk.lines) {
      const marker = raw[0]
      if (marker === "\\") {
        // "\ No newline at end of file": strip the newline added for the previous line.
        if (lastMarker === " " || lastMarker === "-") before = before.replace(/\n$/, "")
        if (lastMarker === " " || lastMarker === "+") after = after.replace(/\n$/, "")
        continue
      }
      const text = raw.slice(1) + "\n"
      if (marker === " ") {
        before += text
        after += text
      } else if (marker === "-") {
        before += text
      } else if (marker === "+") {
        after += text
      }
      lastMarker = marker
    }
  }
  return { before, after }
}

/**
 * Convert an OpenCode snapshot/VCS diff into the app's
 * canonical `FileDiff`. These diffs are patch-only, so `before`/`after` are
 * reconstructed from the patch when available.
 */
export function snapshotToFileDiff(snapshot: FileDiffInfo): FileDiff {
  const patch = parsePatch(snapshot.patch)[0]

  let before = ""
  let after = ""
  if (patch) {
    const texts = patchToTexts(patch)
    before = snapshot.status === "added" ? "" : texts.before
    after = snapshot.status === "deleted" ? "" : texts.after
  }

  return {
    file: snapshot.file,
    before,
    after,
    additions: snapshot.additions,
    deletions: snapshot.deletions,
    status: snapshot.status,
  }
}

export type FileSelection = {
  startLine: number
  startChar: number
  endLine: number
  endChar: number
}

export type SelectedLineRange = {
  start: number
  end: number
  side?: "additions" | "deletions"
  endSide?: "additions" | "deletions"
}

export type FileViewState = {
  scrollTop?: number
  scrollLeft?: number
  selectedLines?: SelectedLineRange | null
}

export type FileState = {
  path: string
  name: string
  loaded?: boolean
  loading?: boolean
  error?: string
  content?: FileContent
}

export function selectionFromLines(range: SelectedLineRange): FileSelection {
  const startLine = Math.min(range.start, range.end)
  const endLine = Math.max(range.start, range.end)
  return {
    startLine,
    endLine,
    startChar: 0,
    endChar: 0,
  }
}
