import { describe, expect, test } from "bun:test"
import { listInitialDirectories, toggleSelectedDirectory } from "./dialog-select-directory-helpers"

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

  test("toggles independently selected directories", () => {
    expect(toggleSelectedDirectory([], "/one")).toEqual(["/one"])
    expect(toggleSelectedDirectory(["/one"], "/two")).toEqual(["/one", "/two"])
    expect(toggleSelectedDirectory(["/one", "/two"], "/one")).toEqual(["/two"])
  })
})
