// Explicit maintenance helper only. This overwrites the fork-owned composition;
// normal builds must not invoke it.
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const source = require.resolve('@deepseek-ai/dsh-web-app/cordis.patch.yml')
const destination = new URL('../cordis.patch.yml', import.meta.url)
const entries = JSON.parse(await readFile(new URL('../../web-ui/src/entries.json', import.meta.url), 'utf8'))

let repackaged = (await readFile(source, 'utf8'))
  .replace("name: '@deepseek-ai/dsh-web-app/startup'", "name: '@isomoes/dsh-ikanban/startup'")
  .replace("name: '@deepseek-ai/dsh-web-app'", "name: '@isomoes/dsh-ikanban'")
  .replace("name: '@deepseek-ai/dsh-host-directory-picker-auto'", "name: '@isomoes/dsh-ikanban/directory-picker-auto'")
  .replace(
    '# Resolve bind host, SSH launch, and display once at boot, then mount the\n    # matching dual-face directory picker. Mount -native or -browse directly in\n    # an overlay to pin the interaction.',
    '# Use the browser directory picker on every host; the published bundle has\n    # no native addon installation path.',
  )
  .replace('assembly fact of dsh-web-app, never user config)', 'assembly fact of iKanban, never user config)')

for (const stockId of Object.keys(entries)) {
  const id = stockId.replace('@deepseek-ai/dsh-client-', '')
  repackaged = repackaged.replaceAll(`name: '${stockId}'`, `name: '@isomoes/dsh-ikanban/client/${id}'`)
}

await writeFile(destination, repackaged)
