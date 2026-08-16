import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { discoverClientEntries } from '../../web-ui/build/client-entries.js'

const packageRoot = new URL('../', import.meta.url)
const entries = await discoverClientEntries({
  packageRoot: fileURLToPath(new URL('../../web-ui/', import.meta.url)),
})
const manifest = JSON.parse(await readFile(new URL('package.json', packageRoot), 'utf8'))

test('publishes every local client as an isolated virtual package', async () => {
  assert.equal(entries.length, 30)
  assert.equal(manifest.dsh.client, undefined)

  for (const entry of entries) {
    const { id, virtualId } = entry
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
    if (entry.host === undefined) {
      assert.match(index, /^export function apply\(\) \{\}\s*$/)
    } else {
      assert.doesNotMatch(index, /^export function apply\(\) \{\}\s*$/)
      assert.match(index, /function apply\(ctx\)/)
    }
    assert.equal(sourcemap.sources.length, sourcemap.sourcesContent.length)
  }
})

test('loads every host entry with public runtime dependencies', async () => {
  assert.equal(manifest.dependencies['@deepseek-ai/dsh-settings'], '^0.1.0-rc.6')
  assert.equal(manifest.dependencies['@deepseek-ai/schemastery'], '^3.18.1')

  await Promise.all(entries
    .filter(entry => entry.host !== undefined)
    .map(entry => import(new URL(`lib/clients/${entry.id}/index.js`, packageRoot))))
})

test('resolves virtual clients and their manifests from an install-like anchor', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ikanban-install-'))
  const packagePath = fileURLToPath(packageRoot)
  const installedPath = join(root, 'node_modules', '@isomoes', 'dsh-ikanban')
  await mkdir(dirname(installedPath), { recursive: true })
  await symlink(packagePath, installedPath, 'dir')
  const resolve = createRequire(join(root, 'anchor.cjs')).resolve

  try {
    assert.equal(resolve('@isomoes/dsh-ikanban'), join(packagePath, 'lib', 'index.js'))
    assert.equal(resolve('@isomoes/dsh-ikanban/package.json'), join(packagePath, 'package.json'))
    for (const { id, virtualId } of entries) {
      assert.equal(resolve(virtualId), join(packagePath, 'lib', 'clients', id, 'index.js'))
      assert.equal(resolve(`${virtualId}/client`), join(packagePath, 'lib', 'clients', id, 'client.js'))
      assert.equal(resolve(`${virtualId}/package.json`), join(packagePath, 'lib', 'clients', id, 'package.json'))
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
