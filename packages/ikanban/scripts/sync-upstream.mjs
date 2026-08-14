import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const source = require.resolve('@deepseek-ai/dsh-web-app/cordis.patch.yml')
const destination = new URL('../cordis.patch.yml', import.meta.url)

const upstream = await readFile(source, 'utf8')
const repackaged = upstream
  .replace("name: '@deepseek-ai/dsh-web-app/startup'", "name: '@isomoes/dsh-ikanban/startup'")
  .replace("name: '@deepseek-ai/dsh-web-app'", "name: '@isomoes/dsh-ikanban'")

await writeFile(destination, repackaged)
