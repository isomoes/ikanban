import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const entries = JSON.parse(await readFile(new URL('../../web-ui/src/entries.json', import.meta.url), 'utf8'))

test('runtime entry serves the packaged frontend dist', async () => {
  const ikanban = await import('../lib/index.js')
  let frontendConfig
  const ctx = {
    webServer: { host: '127.0.0.1', port: 3080 },
    provide() {},
    plugin(_plugin, config) { frontendConfig = config },
    get() {},
  }

  assert.equal(ikanban.name, 'web-app')
  assert.equal(ikanban.internals.resolveDistIndex(), fileURLToPath(new URL('../lib/web/index.html', import.meta.url)))
  ikanban.apply(ctx, { printUrl: false, surfaceContext: false, trustedHosts: [] })
  assert.equal(frontendConfig.distIndex, fileURLToPath(new URL('../lib/web/index.html', import.meta.url)))
})

test('startup and invariant entries are locally owned', async () => {
  const ikanbanStartup = await import('../lib/startup.js')
  const ikanbanInvariant = await import('../lib/invariant.js')

  assert.equal(ikanbanStartup.name, 'web-startup')
  assert.equal(ikanbanInvariant.name, 'ikanban-invariant')
})

test('bundle composition replaces the complete UI roster and keeps DSH infrastructure', async () => {
  const actual = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
  const explicitStockEntries = Object.keys(entries).filter((stockId) => actual.includes(`client/${stockId.replace('@deepseek-ai/dsh-client-', '')}'`))

  assert.equal(explicitStockEntries.length, 28)
  for (const stockId of explicitStockEntries) {
    const id = stockId.replace('@deepseek-ai/dsh-client-', '')
    assert.match(actual, new RegExp(`name: '@isomoes/dsh-ikanban/client/${id}'`))
  }
  assert.doesNotMatch(actual, /name: '@deepseek-ai\/dsh-client-(?:ui-|locale)/)
  assert.match(actual, /name: '@isomoes\/dsh-ikanban\/directory-picker-auto'/)
  for (const packageName of [
    '@deepseek-ai/dsh-client-modules',
    '@deepseek-ai/dsh-client-connection',
    '@deepseek-ai/dsh-api-remotes',
    '@deepseek-ai/dsh-client-runtime',
    '@deepseek-ai/dsh-cordis-client-runner',
  ]) {
    assert.match(actual, new RegExp(`name: '${packageName.replaceAll('/', '\\/')}'`))
  }
})

test('local directory chooser uses the browser surface without native dependencies', async () => {
  const local = await import('../lib/directory-picker-auto.js')

  assert.deepEqual(local.BACKEND_PACKAGES, {
    browse: '@deepseek-ai/dsh-host-directory-picker-browse',
  })
  assert.deepEqual(local.SURFACE_PACKAGES, {
    browse: '@isomoes/dsh-ikanban/client/ui-directory-picker-browse',
  })
  assert.equal(local.resolveDirectoryPickerBackend({
    bindHost: '127.0.0.1',
    platform: 'darwin',
    env: {},
    linuxChooser: false,
  }), 'browse')
})
