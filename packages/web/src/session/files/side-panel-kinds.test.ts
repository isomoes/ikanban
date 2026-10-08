import { describe, expect, test } from "bun:test"
import type { FileDiffInfo } from "@opencode/client/promise"
import { fileTreeKinds } from "./side-panel-kinds"

const diff = (file: string, status: "added" | "deleted" | "modified") => ({ file, status }) as FileDiffInfo

describe("fileTreeKinds", () => {
  test("marks files by status and merges kinds into parent directories", () => {
    const kinds = fileTreeKinds([diff("src/a.ts", "added"), diff("src/b.ts", "deleted"), diff("docs/c.md", "added")])

    expect(kinds.get("src/a.ts")).toBe("add")
    expect(kinds.get("src/b.ts")).toBe("del")
    expect(kinds.get("src")).toBe("mix")
    expect(kinds.get("docs")).toBe("add")
  })

  test("treats modified files as mixed", () => {
    expect(fileTreeKinds([diff("a/b/c.ts", "modified")]).get("a/b")).toBe("mix")
  })
})
