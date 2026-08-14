import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const require = createRequire(import.meta.url)

test('runtime entry delegates to the published web app', async () => {
  const ikanban = await import('../lib/index.js')
  const upstream = await import('@deepseek-ai/dsh-web-app')

  assert.equal(ikanban.apply, upstream.apply)
  assert.equal(ikanban.Config, upstream.Config)
  assert.equal(ikanban.resolveLanTrust, upstream.resolveLanTrust)
})

test('startup and invariant entries delegate to the published web app', async () => {
  const ikanbanStartup = await import('../lib/startup.js')
  const upstreamStartup = await import('@deepseek-ai/dsh-web-app/startup')
  const ikanbanInvariant = await import('../lib/invariant.js')
  const upstreamInvariant = await import('@deepseek-ai/dsh-web-app/invariant')

  assert.equal(ikanbanStartup.apply, upstreamStartup.apply)
  assert.equal(ikanbanInvariant.apply, upstreamInvariant.apply)
})

test('bundle composition matches the published web app', async () => {
  const upstreamPatch = require.resolve('@deepseek-ai/dsh-web-app/cordis.patch.yml')
  const [actual, expected] = await Promise.all([
    readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8'),
    readFile(upstreamPatch, 'utf8'),
  ])

  const repackaged = expected
    .replace("name: '@deepseek-ai/dsh-web-app/startup'", "name: '@isomoes/dsh-ikanban/startup'")
    .replace("name: '@deepseek-ai/dsh-web-app'", "name: '@isomoes/dsh-ikanban'")
    .replace("name: '@deepseek-ai/dsh-client-ui-layout'", "name: '@isomoes/dsh-ikanban/layout'")
    .replace("name: '@deepseek-ai/dsh-client-ui-sidebar'", "name: '@isomoes/dsh-ikanban/sidebar'")
    .replace("name: '@deepseek-ai/dsh-client-ui-workspace'", "name: '@isomoes/dsh-ikanban/workspace'")
    .replace("name: '@deepseek-ai/dsh-client-hmr'", "name: '@isomoes/dsh-ikanban/hmr'")

  assert.equal(actual, repackaged)
  assert.doesNotMatch(actual, /name: '@deepseek-ai\/dsh-web-app(?:\/startup)?'/)
  assert.match(actual, /name: '@isomoes\/dsh-ikanban\/layout'/)
  assert.match(actual, /name: '@isomoes\/dsh-ikanban\/sidebar'/)
  assert.match(actual, /name: '@isomoes\/dsh-ikanban\/workspace'/)
  assert.match(actual, /name: '@isomoes\/dsh-ikanban\/hmr'/)
})
