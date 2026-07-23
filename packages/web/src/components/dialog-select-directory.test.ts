import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { listInitialDirectories } from "./dialog-select-directory-helpers"

const dialogSource = readFileSync(join(import.meta.dir, "dialog-select-directory.tsx"), "utf8")
const homeSource = readFileSync(join(import.meta.dir, "../pages/home.tsx"), "utf8")
const layoutSource = readFileSync(join(import.meta.dir, "../pages/layout.tsx"), "utf8")

describe("directory selection", () => {
  test("lists the starting directory before the user enters a search", async () => {
    const sdk = {
        client: {
          file: {
            list: async () => ({
              data: [
                { name: "src", absolute: "/home/user/src", type: "directory" },
                { name: "notes.txt", absolute: "/home/user/notes.txt", type: "file" },
              ],
            }),
          },
        },
      } as never

    expect((await listInitialDirectories(sdk, "/home/user")).map((item) => item.absolute)).toEqual([
      "/home/user/src",
    ])
  })

  test("opens one directory immediately without multi-selection controls", () => {
    expect(dialogSource).not.toContain("multiple")
    expect(dialogSource).not.toContain("submitSelection")
    expect(homeSource).toContain("multiple: false")
    expect(layoutSource).toContain("multiple: false")
    expect(homeSource).not.toContain("<DialogSelectDirectory multiple=")
    expect(layoutSource).not.toContain("<DialogSelectDirectory multiple=")
  })
})
