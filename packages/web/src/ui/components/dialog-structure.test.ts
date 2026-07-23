import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const dialogSource = readFileSync(join(import.meta.dir, "dialog.tsx"), "utf8")

describe("Dialog structure", () => {
  test("keeps dialog actions and close controls together", () => {
    expect(dialogSource).toContain('data-slot="dialog-action"')
    expect(dialogSource).toContain('data-slot="dialog-close-button"')
    expect(dialogSource).not.toContain("<Switch>")
  })
})
