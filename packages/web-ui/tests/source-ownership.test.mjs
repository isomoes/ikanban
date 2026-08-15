import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('pins the source fork and declares its client entries', async () => {
  const provenance = await readFile(new URL('../UPSTREAM.md', import.meta.url), 'utf8')
  assert.match(provenance, /47f943859b/)
  const entries = JSON.parse(await readFile(new URL('../src/entries.json', import.meta.url), 'utf8'))
  assert.equal(entries['@deepseek-ai/dsh-client-ui-layout'].source, 'packages/client/ui-layout/src/client/index.ts')
  assert.equal(entries['@deepseek-ai/dsh-client-ui-sidebar'].source, 'packages/client/ui-sidebar/src/client/index.ts')
  assert.equal(entries['@deepseek-ai/dsh-client-ui-workspace'].source, 'packages/client/ui-workspace/src/client/index.ts')
})

test('owns the complete path-preserved browser source surface', async () => {
  const sources = [
    '../src/upstream/apps/web/src/main.ts',
    '../src/upstream/packages/client/web/src/AppRoot.tsx',
    '../src/upstream/packages/client/web/src/AppRoot.module.css',
    '../src/upstream/packages/client/ui-directory-picker-browse/src/client/DirectoryBrowser.tsx',
    '../src/upstream/packages/client/ui-directory-picker-native/src/client/index.ts',
    '../src/upstream/packages/extensions/ui-cordis/src/client/CordisPanel.tsx',
  ]

  await Promise.all(sources.map(source => access(new URL(source, import.meta.url))))
})
