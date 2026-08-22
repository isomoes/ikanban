import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveLanTrust } from '../lib/index.js'

test('keeps loopback binding private while preserving explicit trusted hosts', () => {
  assert.deepEqual(resolveLanTrust('127.0.0.1', ['app.internal']), {
    lanAddresses: [],
    trustedHosts: ['app.internal'],
  })
})

test('trusts discovered LAN addresses when binding all interfaces', () => {
  const runtime = resolveLanTrust('0.0.0.0', ['app.internal'])

  assert.equal(runtime.trustedHosts.at(-1), 'app.internal')
  for (const address of runtime.lanAddresses) {
    assert.equal(runtime.trustedHosts.includes(address), true)
  }
})
