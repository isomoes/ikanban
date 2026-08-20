import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { discoverClientEntries } from '../build/client-entries.js'

test('pins the reviewed rc.8 source baseline', async () => {
  const provenance = await readFile(new URL('../UPSTREAM.md', import.meta.url), 'utf8')
  assert.match(provenance, /dsh-v0\.1\.0-rc\.8/)
  assert.match(provenance, /141eb6fef83422698aef7a981029e843e8161534/)
})

test('discovers owned client entries', async () => {
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
    '../src/client/web/boot.ts',
    '../src/client/web/boot-page.ts',
    '../src/client/ui-renderer/client/app.tsx',
    '../src/client/ui-directory-picker-browse/client/DirectoryBrowser.tsx',
    '../src/client/ui-directory-picker-native/client/index.ts',
    '../src/extensions/ui-cordis/client/CordisPanel.tsx',
  ]

  await Promise.all(sources.map(source => access(new URL(source, import.meta.url))))
})

test('bridges every published infrastructure import to an owned singleton', async () => {
  const [platform, seed, manifest] = await Promise.all([
    readFile(new URL('../src/client/web/platform.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/client/web/seed.ts', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
  ])
  const aliases = [
    ['@deepseek-ai/dsh-client-ui-slots', '@isomoes/dsh-ikanban/client/ui-slots', 'UiSlots'],
    ['@deepseek-ai/dsh-client-ui-primitives', '@isomoes/dsh-ikanban/client/ui-primitives', 'UiPrimitives'],
  ]
  for (const [legacy, owned, binding] of aliases) {
    assert.ok(platform.includes(`'${legacy}': '${owned}'`), legacy)
    assert.ok(seed.includes(`'${legacy}': ${binding}`), legacy)
    assert.ok(seed.includes(`'${owned}': ${binding}`), owned)
    assert.equal(manifest.dependencies[legacy], undefined, `${legacy} must not be an upstream dependency`)
  }
})

test('loads theme styles from the owned dynamic theme plugin', async () => {
  const styles = await readFile(new URL('../src/client/ui-theme/client/styles.ts', import.meta.url), 'utf8')
  assert.match(styles, /import base from '\.\.\/styles\/base\.css\?inline'/)
  assert.match(styles, /@isomoes\/dsh-ikanban\/client\/ui-theme/)
  assert.doesNotMatch(styles, /@deepseek-ai\/dsh-client-ui-theme/)
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
