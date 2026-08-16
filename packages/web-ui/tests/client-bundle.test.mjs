import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { discoverClientEntries } from '../build/client-entries.js'

const packageRoot = new URL('../', import.meta.url)
const entries = await discoverClientEntries({
  packageRoot: fileURLToPath(packageRoot),
  upstreamAnchor: fileURLToPath(new URL('../../ikanban/package.json', import.meta.url)),
})
const packageManifest = JSON.parse(await readFile(new URL('package.json', packageRoot), 'utf8'))

test('each forked client entry emits an isolated virtual package', async () => {
  assert.equal(entries.length, 30)

  for (const entry of entries) {
    const { id, stockId, virtualId } = entry
    assert.equal(typeof entry.source, 'string', `${stockId} source`)
    assert.ok(entry.client && Array.isArray(entry.client.inject), `${stockId} client metadata`)
    const output = new URL(`lib/clients/${id}/`, packageRoot)
    await Promise.all([
      access(new URL('client.js', output)),
      access(new URL('client.js.map', output)),
      access(new URL('index.js', output)),
      access(new URL('package.json', output)),
    ])

    const [bundle, sourcemap, manifest, index] = await Promise.all([
      readFile(new URL('client.js', output), 'utf8'),
      JSON.parse(await readFile(new URL('client.js.map', output), 'utf8')),
      JSON.parse(await readFile(new URL('package.json', output), 'utf8')),
      readFile(new URL('index.js', output), 'utf8'),
    ])
    assert.match(bundle, new RegExp(`id: ${JSON.stringify(virtualId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    assert.equal(manifest.name, virtualId)
    assert.deepEqual(manifest.dsh.client, entry.client)
    assert.deepEqual(manifest.exports, {
      '.': './index.js',
      './client': './client.js',
      './package.json': './package.json',
    })
    if (entry.host !== undefined) {
      assert.doesNotMatch(index, /^export function apply\(\) \{\}\s*$/)
      assert.match(index, /function apply\(ctx\)/)
    } else {
      assert.match(index, /^export function apply\(\) \{\}\s*$/)
    }
    assert.equal(sourcemap.sources.length, sourcemap.sourcesContent.length)
    assert.doesNotMatch(JSON.stringify(sourcemap.sources), /deepseek-harness/)
    if (stockId === '@deepseek-ai/dsh-client-ui-conversation') {
      assert.ok(bundle.includes(`buildBadge(${JSON.stringify(packageManifest.version)}, false)`))
      assert.doesNotMatch(bundle, /__IKANBAN_(?:DEV|VERSION)__/)
    }
    if (stockId === '@deepseek-ai/dsh-client-ui-sidebar') {
      assert.match(bundle, /https:\/\/github\.com\/isomoes\/ikanban/)
    }
    if (stockId === '@deepseek-ai/dsh-client-ui-theme') {
      assert.match(bundle, /github-dark-colorblind/)
      assert.match(bundle, /GitHub Dark Colorblind/)
      assert.match(bundle, /--shiki-token-string/)
    }
    for (const owner of bundle.matchAll(/tag\.dataset\.plugin = "([^"]+)"/g)) {
      assert.equal(owner[1], virtualId)
    }
  }
})
