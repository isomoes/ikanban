import { readFile } from "node:fs/promises"

const version = process.argv[2]?.replace(/^v/, "")
if (!version) throw new Error("Usage: node scripts/check-release.mjs <tag-or-version>")
const upstream = JSON.parse(await readFile(new URL("../docs/upstream.json", import.meta.url), "utf8"))
for (const file of ["package.json", "packages/web/package.json", "packages/ui/package.json", "packages/session-ui/package.json"]) {
  const manifest = JSON.parse(await readFile(new URL(`../${file}`, import.meta.url), "utf8"))
  const expected = ["package.json", "packages/web/package.json"].includes(file) ? version : upstream.version
  if (manifest.version !== expected) {
    throw new Error(`${file} is ${manifest.version}; expected ${expected}`)
  }
  if (manifest.private !== true) throw new Error(`${file} must be private`)
}
