import type { FileDiffInfo } from "@opencode/client/promise"
import { normalizeFileTreeV2Path } from "@/session/files/file-tree-v2-model"

export type FileTreeKind = "add" | "del" | "mix"

export function fileTreeKinds(diffs: readonly FileDiffInfo[]) {
  const merge = (a: FileTreeKind | undefined, b: FileTreeKind) => {
    if (!a) return b
    if (a === b) return a
    return "mix" as const
  }

  const out = new Map<string, FileTreeKind>()
  for (const diff of diffs) {
    const file = normalizeFileTreeV2Path(diff.file)
    const kind = diff.status === "added" ? "add" : diff.status === "deleted" ? "del" : "mix"

    out.set(file, kind)

    const parts = file.split("/")
    for (const [idx] of parts.slice(0, -1).entries()) {
      const dir = parts.slice(0, idx + 1).join("/")
      if (!dir) continue
      out.set(dir, merge(out.get(dir), kind))
    }
  }
  return out
}
