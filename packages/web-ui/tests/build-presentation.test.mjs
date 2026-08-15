import assert from 'node:assert/strict'
import test from 'node:test'

import { buildBadge, productTitle } from '../src/build-presentation.ts'

test('release builds display their tagged version', () => {
  assert.equal(buildBadge('1.2.3', false), 'v1.2.3')
})

test('development builds are visibly distinct', () => {
  assert.equal(buildBadge('1.2.3', true), 'dev')
  assert.equal(productTitle('iKanban', true), 'iKanban dev')
})
