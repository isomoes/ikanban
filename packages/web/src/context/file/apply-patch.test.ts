import { describe, expect, test } from "bun:test"
import { applyPatchFileDiff } from "./apply-patch"

describe("applyPatchFileDiff", () => {
  test("reconstructs file contents from apply_patch metadata", () => {
    const result = applyPatchFileDiff({
      filePath: "/repo/src/example.ts",
      relativePath: "src/example.ts",
      type: "update",
      patch: [
        "--- a/src/example.ts",
        "+++ b/src/example.ts",
        "@@ -1 +1 @@",
        "-const value = 1",
        "+const value = 2",
        "",
      ].join("\n"),
      additions: 1,
      deletions: 1,
    })

    expect(result).toEqual({
      file: "src/example.ts",
      status: "modified",
      additions: 1,
      deletions: 1,
      before: "const value = 1\n",
      after: "const value = 2\n",
    })
  })
})
