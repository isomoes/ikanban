import { snapshotToFileDiff, type FileDiff } from "./types"

export type ApplyPatchFile = {
  filePath: string
  relativePath: string
  type: "add" | "update" | "delete" | "move"
  patch?: string
  diff?: string
  before?: string
  after?: string
  additions: number
  deletions: number
  movePath?: string
}

export function applyPatchFileDiff(file: ApplyPatchFile): FileDiff {
  const status = file.type === "add" ? "added" : file.type === "delete" ? "deleted" : "modified"
  const diff = snapshotToFileDiff({
    file: file.relativePath,
    status,
    additions: file.additions,
    deletions: file.deletions,
    patch: file.patch ?? file.diff,
  })

  return {
    ...diff,
    before: file.before ?? diff.before,
    after: file.after ?? diff.after,
  }
}
