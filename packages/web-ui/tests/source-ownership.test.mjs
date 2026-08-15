import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('pins the source fork and declares its client entries', async () => {
  const provenance = await readFile(new URL('../UPSTREAM.md', import.meta.url), 'utf8')
  assert.match(provenance, /47f943859b/)
  const entries = JSON.parse(await readFile(new URL('../src/entries.json', import.meta.url), 'utf8'))
  assert.equal(entries['@deepseek-ai/dsh-client-ui-layout'].source, 'client/ui-layout/client/index.ts')
  assert.equal(entries['@deepseek-ai/dsh-client-ui-sidebar'].source, 'client/ui-sidebar/client/index.ts')
  assert.equal(entries['@deepseek-ai/dsh-client-ui-workspace'].source, 'client/ui-workspace/client/index.ts')
})

test('owns the complete browser source surface', async () => {
  const sources = [
    '../src/main.ts',
    '../src/client/modules/client/index.ts',
    '../src/client/web/AppRoot.tsx',
    '../src/client/web/AppRoot.module.css',
    '../src/client/ui-directory-picker-browse/client/DirectoryBrowser.tsx',
    '../src/client/ui-directory-picker-native/client/index.ts',
    '../src/extensions/ui-cordis/client/CordisPanel.tsx',
  ]

  await Promise.all(sources.map(source => access(new URL(source, import.meta.url))))
})
