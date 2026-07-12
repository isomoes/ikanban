import type { FileContent, SnapshotFileDiff } from "@opencode-ai/sdk/v2"
import { parsePatch, type StructuredPatch } from "diff"

/**
 * Canonical diff shape used throughout the app UI.
 *
 * The upstream `@opencode-ai/sdk` `FileDiff` type changed in v1.17.x to a
 * patch-only shape (`{ path, status, additions, deletions, patch }`) and the
 * session diff endpoint now returns `SnapshotFileDiff`. The app still models
 * diffs with explicit `before`/`after` content keyed by `file`, so we keep a
 * local type and convert SDK payloads at the boundaries.
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
 * Convert the SDK `SnapshotFileDiff` shape (returned by `session.diff()`,
 * `vcs.diff()`, and carried on `UserMessage.summary.diffs`) into the app's
 * canonical `FileDiff`. These diffs are patch-only, so `before`/`after` are
 * reconstructed from the patch when available.
 */
export function snapshotToFileDiff(snapshot: SnapshotFileDiff): FileDiff {
  const file = snapshot.file ?? ""
  const status = snapshot.status ?? "modified"
  const patch = snapshot.patch ? parsePatch(snapshot.patch)[0] : undefined

  let before = ""
  let after = ""
  if (patch) {
    const texts = patchToTexts(patch)
    before = status === "added" ? "" : texts.before
    after = status === "deleted" ? "" : texts.after
  }

  return {
    file,
    before,
    after,
    additions: snapshot.additions,
    deletions: snapshot.deletions,
    status,
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
