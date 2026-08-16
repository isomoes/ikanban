import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { discoverClientEntries } from '../build/client-entries.js'

test('pins the source fork and discovers its client entries', async () => {
  const provenance = await readFile(new URL('../UPSTREAM.md', import.meta.url), 'utf8')
  assert.match(provenance, /47f943859b/)
  const entries = await discoverClientEntries({
    packageRoot: fileURLToPath(new URL('../', import.meta.url)),
    upstreamAnchor: fileURLToPath(new URL('../../ikanban/package.json', import.meta.url)),
  })
  const byStockId = new Map(entries.map(entry => [entry.stockId, entry]))
  assert.match(byStockId.get('@deepseek-ai/dsh-client-ui-layout').source, /client\/ui-layout\/client\/index\.ts$/)
  assert.match(byStockId.get('@deepseek-ai/dsh-client-ui-sidebar').source, /client\/ui-sidebar\/client\/index\.ts$/)
  assert.match(byStockId.get('@deepseek-ai/dsh-client-ui-workspace').source, /client\/ui-workspace\/client\/index\.ts$/)
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

test('allows full-width trigger labels when no description is present', async () => {
  const css = await readFile(new URL('../src/client/ui-input-trigger/client/MenuView.module.css', import.meta.url), 'utf8')
  assert.match(css, /\.itemName:only-child\s*\{[^}]*max-width:\s*100%/s)
})

test('keeps the trigger menu width stable while filtering', async () => {
  const css = await readFile(new URL('../src/client/ui-input-trigger/client/MenuView.module.css', import.meta.url), 'utf8')
  assert.match(css, /\.menu\s*\{[^}]*\n\s{2}width:\s*min\(537px,\s*100%\)/s)
  assert.match(css, /\.menu\s*\{[^}]*\n\s{2}height:\s*320px/s)
})
