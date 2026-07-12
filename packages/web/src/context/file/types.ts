import type { FileContent, SnapshotFileDiff } from "@opencode-ai/sdk/v2"
import { applyPatch, parsePatch, reversePatch } from "diff"

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
 * Convert the SDK `SnapshotFileDiff` shape (returned by `session.diff()` and
 * carried on `UserMessage.summary.diffs`) into the app's canonical `FileDiff`.
 * Snapshot diffs are patch-only, so `before`/`after` are reconstructed from the
 * patch when available.
 */
export function snapshotToFileDiff(snapshot: SnapshotFileDiff): FileDiff {
  const file = snapshot.file ?? ""
  const status = snapshot.status ?? "modified"
  const patch = snapshot.patch ? parsePatch(snapshot.patch)[0] : undefined

  let before = ""
  let after = ""
  if (patch) {
    if (status === "added") {
      after = applyPatch("", patch) || ""
    } else if (status === "deleted") {
      before = applyPatch("", reversePatch(patch)) || ""
    } else {
      after = applyPatch("", patch) || ""
      before = applyPatch(after, reversePatch(patch)) || after
    }
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
