import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { discoverClientEntries } from '../../web-ui/build/client-entries.js'

const packageRoot = new URL('../', import.meta.url)
const sharedRoot = new URL('../../web-ui/', import.meta.url)
const entries = await discoverClientEntries({ packageRoot: fileURLToPath(sharedRoot) })
const manifest = JSON.parse(await readFile(new URL('package.json', packageRoot), 'utf8'))
const composition = await readFile(new URL('cordis.patch.yml', packageRoot), 'utf8')
const brandId = '@isomoes/dsh-ikanban/client/ui-brand-ikanban'

test('consumes neutral shared clients and publishes only product branding', async () => {
  assert.equal(entries.length, 35)
  assert.equal(manifest.dependencies['@isomoes/dsh-web-ui'], 'workspace:*')
  assert.equal(manifest.devDependencies['@isomoes/dsh-web-ui'], undefined)
  assert.match(composition, /name: '@isomoes\/dsh-web-ui\/client\/ui-timeline'/)
  assert.match(composition, /name: '@isomoes\/dsh-web-ui\/client\/ui-reminders'/)
  assert.match(composition, /name: '@isomoes\/dsh-ikanban\/client\/ui-brand-ikanban'/)
  assert.doesNotMatch(composition, /ui-brand-official/)

  const output = new URL('lib/clients/ui-brand-ikanban/', packageRoot)
  const [bundle, productManifest, index] = await Promise.all([
    readFile(new URL('client.js', output), 'utf8'),
    JSON.parse(await readFile(new URL('package.json', output), 'utf8')),
    readFile(new URL('index.js', output), 'utf8'),
  ])
  assert.match(bundle, /iKanban/)
  assert.ok(bundle.includes(`id: ${JSON.stringify(brandId)}`))
  assert.equal(productManifest.name, brandId)
  assert.deepEqual(productManifest.dsh.client.inject, [
    '@deepseek-ai/dsh-client-runtime',
    '@isomoes/dsh-web-ui/client/ui-conversation',
    '@isomoes/dsh-web-ui/client/ui-sidebar',
  ])
  assert.match(index, /^export function apply\(\) \{\}\s*$/)
})

test('loads shared host entries from the shared package', async () => {
  await Promise.all(entries
    .filter(entry => entry.host !== undefined)
    .map(entry => import(new URL(`lib/clients/${entry.id}/index.js`, sharedRoot))))
})

test('resolves product and shared virtual clients from an install-like anchor', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ikanban-install-'))
  const productPath = fileURLToPath(packageRoot)
  const sharedPath = fileURLToPath(sharedRoot)
  const installedProduct = join(root, 'node_modules', '@isomoes', 'dsh-ikanban')
  const installedShared = join(root, 'node_modules', '@isomoes', 'dsh-web-ui')
  await mkdir(dirname(installedProduct), { recursive: true })
  await symlink(productPath, installedProduct, 'dir')
  await symlink(sharedPath, installedShared, 'dir')
  const resolve = createRequire(join(root, 'anchor.cjs')).resolve

  try {
    assert.equal(resolve('@isomoes/dsh-ikanban'), join(productPath, 'lib', 'index.js'))
    assert.equal(resolve(brandId), join(productPath, 'lib', 'clients', 'ui-brand-ikanban', 'index.js'))
    assert.equal(resolve(`${brandId}/client`), join(productPath, 'lib', 'clients', 'ui-brand-ikanban', 'client.js'))
    for (const { id, virtualId } of entries) {
      assert.equal(resolve(virtualId), join(sharedPath, 'lib', 'clients', id, 'index.js'))
      assert.equal(resolve(`${virtualId}/client`), join(sharedPath, 'lib', 'clients', id, 'client.js'))
      assert.equal(resolve(`${virtualId}/package.json`), join(sharedPath, 'lib', 'clients', id, 'package.json'))
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
