import { snapshotToFileDiff, type FileDiff } from "./types"

export type ApplyPatchFile = {
  filePath?: string
  relativePath?: string
  type?: "add" | "update" | "delete" | "move"
  file?: string
  status?: "added" | "deleted" | "modified"
  patch?: string
  diff?: string
  before?: string
  after?: string
  additions: number
  deletions: number
  movePath?: string
}

export type NormalizedApplyPatchFile = ApplyPatchFile & {
  filePath: string
  relativePath: string
  type: "add" | "update" | "delete" | "move"
}

export function normalizeApplyPatchFile(file: ApplyPatchFile): NormalizedApplyPatchFile {
  const relativePath = file.relativePath ?? file.file ?? file.filePath ?? ""
  const type = file.type ?? (file.status === "added" ? "add" : file.status === "deleted" ? "delete" : "update")
  return {
    ...file,
    filePath: file.filePath ?? file.file ?? relativePath,
    relativePath,
    type,
  }
}

export function applyPatchFileDiff(file: ApplyPatchFile): FileDiff {
  const normalized = normalizeApplyPatchFile(file)
  const status = normalized.type === "add" ? "added" : normalized.type === "delete" ? "deleted" : "modified"
  const diff = snapshotToFileDiff({
    file: normalized.relativePath,
    status,
    additions: normalized.additions,
    deletions: normalized.deletions,
    patch: normalized.patch ?? normalized.diff ?? "",
  })

  return {
    ...diff,
    before: normalized.before ?? diff.before,
    after: normalized.after ?? diff.after,
  }
}
