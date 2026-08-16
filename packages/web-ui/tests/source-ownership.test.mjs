import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { discoverClientEntries } from '../build/client-entries.js'

test('pins the source fork and discovers its client entries', async () => {
  const provenance = await readFile(new URL('../UPSTREAM.md', import.meta.url), 'utf8')
  assert.match(provenance, /47f943859b/)
  const entries = await discoverClientEntries({
    packageRoot: fileURLToPath(new URL('../', import.meta.url)),
  })
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  assert.match(byId.get('ui-layout').source, /client\/ui-layout\/client\/index\.ts$/)
  assert.match(byId.get('ui-sidebar').source, /client\/ui-sidebar\/client\/index\.ts$/)
  assert.match(byId.get('ui-workspace').source, /client\/ui-workspace\/client\/index\.ts$/)
})

test('uses iKanban identities for every owned invariant package', async () => {
  const sourceRoot = new URL('../src/', import.meta.url)
  const invariantPaths = (await readdir(sourceRoot, { recursive: true }))
    .filter(path => path.endsWith('/invariant.ts'))
  assert.ok(invariantPaths.length > 0)
  for (const path of invariantPaths) {
    const source = await readFile(new URL(path, sourceRoot), 'utf8')
    assert.match(source, /const PACKAGE_NAME = '@isomoes\/dsh-ikanban\/client\//, path)
    assert.doesNotMatch(source, /const PACKAGE_NAME = '@deepseek-ai\//, path)
  }
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

test('bridges published runtime imports to the owned slots singleton', async () => {
  const [platform, seed] = await Promise.all([
    readFile(new URL('../src/client/web/platform.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/client/web/seed.ts', import.meta.url), 'utf8'),
  ])
  assert.match(platform, /'@deepseek-ai\/dsh-client-ui-slots': '@isomoes\/dsh-ikanban\/client\/ui-slots'/)
  assert.match(seed, /'@deepseek-ai\/dsh-client-ui-slots': UiSlots/)
  assert.match(seed, /'@isomoes\/dsh-ikanban\/client\/ui-slots': UiSlots/)
})

test('loads theme styles from the owned source tree', async () => {
  const css = await readFile(new URL('../src/client/web/base.css', import.meta.url), 'utf8')
  assert.match(css, /@import '\.\.\/ui-theme\/styles\/base\.css'/)
  assert.doesNotMatch(css, /@deepseek-ai\/dsh-client-ui-theme/)
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
