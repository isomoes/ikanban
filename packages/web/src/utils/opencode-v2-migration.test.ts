import { describe, expect, test } from "bun:test"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) return sourceFiles(target)
      return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [target] : []
    }),
  )
  return files.flat()
}

describe("OpenCode V2 migration", () => {
  test("production code does not import the legacy SDK", async () => {
    const root = path.resolve(import.meta.dir, "..")
    const files = await sourceFiles(root)
    const legacy = [] as string[]

    for (const file of files) {
      if ((await readFile(file, "utf8")).includes("@opencode-ai/sdk")) legacy.push(path.relative(root, file))
    }

    expect(legacy).toEqual([])
  })
})
