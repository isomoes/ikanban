import { readFile } from "node:fs/promises"

const version = process.argv[2]?.replace(/^v/, "")
if (!version) throw new Error("Usage: node scripts/check-release.mjs <tag-or-version>")
for (const file of ["package.json", "packages/web/package.json", "packages/ui/package.json", "packages/session-ui/package.json"]) {
  const manifest = JSON.parse(await readFile(new URL(`../${file}`, import.meta.url), "utf8"))
  if (manifest.version !== version) {
    throw new Error(`${file} is ${manifest.version}; expected ${version}`)
  }
  if (manifest.private !== true) throw new Error(`${file} must be private`)
}
