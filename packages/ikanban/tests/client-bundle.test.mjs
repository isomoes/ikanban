import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const packageRoot = new URL('../', import.meta.url)
const entries = JSON.parse(await readFile(new URL('../../web-ui/src/entries.json', import.meta.url), 'utf8'))
const manifest = JSON.parse(await readFile(new URL('package.json', packageRoot), 'utf8'))

test('publishes every local client as an isolated virtual package', async () => {
  assert.equal(Object.keys(entries).length, 30)
  assert.equal(manifest.dsh.client, undefined)

  for (const [stockId, entry] of Object.entries(entries)) {
    const id = stockId.replace('@deepseek-ai/dsh-client-', '')
    const virtualId = `@isomoes/dsh-ikanban/client/${id}`
    const output = new URL(`lib/clients/${id}/`, packageRoot)
    const [bundle, sourcemap, manifest, index] = await Promise.all([
      readFile(new URL('client.js', output), 'utf8'),
      JSON.parse(await readFile(new URL('client.js.map', output), 'utf8')),
      JSON.parse(await readFile(new URL('package.json', output), 'utf8')),
      readFile(new URL('index.js', output), 'utf8'),
    ])

    assert.match(bundle, new RegExp(`id: ${JSON.stringify(virtualId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    assert.equal(manifest.name, virtualId)
    assert.deepEqual(manifest.dsh.client, entry.client)
    assert.match(index, /^export function apply\(\) \{\}\s*$/)
    assert.equal(sourcemap.sources.length, sourcemap.sourcesContent.length)
  }
})

test('resolves virtual clients and their manifests from an install-like anchor', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ikanban-install-'))
  const packagePath = fileURLToPath(packageRoot)
  const installedPath = join(root, 'node_modules', '@isomoes', 'dsh-ikanban')
  await mkdir(dirname(installedPath), { recursive: true })
  await symlink(packagePath, installedPath, 'dir')
  const resolve = createRequire(join(root, 'anchor.cjs')).resolve

  try {
    for (const stockId of Object.keys(entries)) {
      const id = stockId.replace('@deepseek-ai/dsh-client-', '')
      const virtualId = `@isomoes/dsh-ikanban/client/${id}`
      assert.equal(resolve(virtualId), join(packagePath, 'lib', 'clients', id, 'index.js'))
      assert.equal(resolve(`${virtualId}/package.json`), join(packagePath, 'lib', 'clients', id, 'package.json'))
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
