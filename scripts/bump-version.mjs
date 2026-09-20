import { readFile, writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const version = process.argv[2]
if (!version || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) {
  throw new Error("Usage: bun run bump-version <version>")
}
const root = new URL("../", import.meta.url)
for (const file of ["package.json", "packages/web/package.json"]) {
  const url = new URL(file, root)
  const manifest = JSON.parse(await readFile(url, "utf8"))
  manifest.version = version
  await writeFile(url, `${JSON.stringify(manifest, null, 2)}\n`)
}
execFileSync("bun", ["install", "--lockfile-only"], { cwd: fileURLToPath(root), stdio: "inherit" })
console.log(`Updated standalone app and lockfile to ${version}`)
