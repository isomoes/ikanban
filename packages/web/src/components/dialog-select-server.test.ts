import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const dialogSource = readFileSync(join(import.meta.dir, "dialog-select-server.tsx"), "utf8")
const frameSource = readFileSync(join(import.meta.dir, "server-list-item-frame.tsx"), "utf8")

describe("DialogSelectServer structure", () => {
  test("wraps each http server row so menu actions stay outside the list button", () => {
    expect(dialogSource).toContain("itemWrapper={(item, node) =>")
    expect(dialogSource).toContain("<ServerListItemFrame")
    expect(dialogSource).toContain("row={node}")
    expect(dialogSource).toContain("actions={")
    expect(frameSource).toContain('data-slot="server-list-item-actions"')
  })
})
